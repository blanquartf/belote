import { User } from '../db/schema.types';
import { eq } from "drizzle-orm";
import { DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';
import { users } from "../db/schema"; // your schema file
import { v4 as uuidv4 } from 'uuid';
const bcrypt = require('bcrypt');
const bluebird = require('bluebird');
bcrypt.promises.use(bluebird);
const saltRounds = 10;

export class UserService {
    db: DrizzleSqliteDODatabase<any>;
    constructor(db: DrizzleSqliteDODatabase<any>;) {
        this.db = db;
    }
    async createAccount(request: Request): Promise<Response> {
        const body: {pseudo: string, password: string} = await request.json();
        const pseudo = body.pseudo;
        const password = body.password;
        const userResult = await this.db
            .select()
            .from(users)
            .where(eq(users.pseudo, pseudo));

        if (userResult[0]) {
            return new Response('existing user', {
                status: 401,
            });
        }

        let newToken = uuidv4();

        await this.db
        .insert(users)
        .values({
            pseudo,
            password: await bcrypt.hash(password, saltRounds),               // store plain password only for testing!
            ready: false,
            admin: false,
            token: null,
            tokenValidity: null,
            lastActiveAt: new Date().toISOString(),
            ip: null
        })
        .returning();
    
        return new Response(Buffer.from(newToken).toString('base64'), {
            status: 200,
        });
    }
    async passwordChange(request: Request, user: User): Promise<Response> {
        const mustLoginResponse = new Response('you need to login', {
            status: 401,
        });
        const body: {oldPassword: string, newPassword: string} = await request.json();

        if (!await bcrypt.compare(body.oldPassword,user.password)) {
            return mustLoginResponse;
        }

        let newToken = uuidv4();

        await this.db.update(users)
            .set({ password: await bcrypt.hash(body.newPassword, saltRounds) })
            .where(eq(users.id, user.id));
    
        return new Response(Buffer.from(newToken).toString('base64'), {
            status: 200,
        });
    }
    async authenticate(request: Request): Promise<Response> {
        const mustLoginResponse = new Response('you need to login', {
            status: 401,
        });
        const body: {pseudo: string, password: string} = await request.json();
        const pseudo = body.pseudo;
        const password = body.password;
        const userResult = await this.db
            .select()
            .from(users)
            .where(eq(users.pseudo, pseudo));

        if (!userResult[0] || !await bcrypt.compare(password,userResult[0].password)) {
            return mustLoginResponse;
        }

        let newToken = uuidv4();

        await this.db.update(users)
            .set({ token: newToken, tokenValidity: new Date().toISOString() })
            .where(eq(users.id, userResult[0].id));
    
        return new Response(Buffer.from(newToken).toString('base64'), {
            status: 200,
        });
    }
    async validateToken(request: Request, operation: (user: User) => Promise<Response>, admin: Boolean = false): Promise<Response> {
        const mustLoginResponse = new Response('you need to login', {
            status: 401,
        });
        
        const authorization = request.headers.get('Authorization');
        if (!authorization) {
            return mustLoginResponse;
        }
        const [scheme, encoded] = authorization.split(' ');
        
        if (!encoded || scheme !== 'Basic') {
            return new Response('malformed authorization header', {
                status: 400,
            });
        }
        
        const token = Buffer.from(encoded, 'base64').toString();
        const userResult = await this.db
            .select()
            .from(users)
            .where(eq(users.token, token));
        
        if (!userResult[0] || !userResult[0].tokenValidity || (admin && !userResult[0].admin)) {
            return mustLoginResponse;
        }
        const now = new Date();
        const validity = new Date(userResult[0].tokenValidity);
        if (isNaN(validity.getTime()) || validity < now) {
            return mustLoginResponse;
        }

        await this.db.update(users)
            .set({ tokenValidity: new Date().toISOString() })
            .where(eq(users.id, userResult[0].id));
    
        return await operation(userResult[0]);
    }
    public async join(newUsername: string, ip: string | undefined, tables: Map<string, Map<string, User>>, DEFAULT_TABLE: string): Promise<boolean> {
        let existed = false;
        outerLoop: for (const [tableName, users] of tables) {
        innerLoop: for (const [username, user] of users) {
            if (username != newUsername) {
            continue innerLoop;
            }
            if (ip) {
            user.ip = ip;
            }
            existed = true;
            break outerLoop;
        }
        }
        if (!existed) {
        const user = new User(newUsername, ip);
        let table = tables.get(DEFAULT_TABLE);
        if (!table) {
            table = new Map<string, User>();
            tables.set(DEFAULT_TABLE, table);
        }
        table.set(newUsername, user);
        }
        await this.storage.put('tables', tables);
        return !existed;
    }

    public async quit(username: string, ip: string | undefined, tables: Map<string, Map<string, User>>, DEFAULT_TABLE: string): Promise<number> {
        let code = await this.finish(username, ip, tables, DEFAULT_TABLE);
        if (code != 200) {
        return code;
        }
        let panamaTable = tables.get(DEFAULT_TABLE) || new Map<string, User>();
        panamaTable.delete(username);
        await this.storage.put('tables', tables);
        return 200;
    }

    public async finish(username: string, ip: string | undefined, tables: Map<string, Map<string, User>>, DEFAULT_TABLE: string): Promise<number> {
        if (tables.size == 0) {
        return 304;
        }
        let panamaTable = tables.get(DEFAULT_TABLE) || new Map<string, User>();
        let foundUserTable: UserAndTable | undefined;
        outerLoop: for (const [tableName, users] of tables) {
        innerLoop: for (const [_, user] of users) {
            if (user.name != username) {
            continue innerLoop;
            }
            if (ip !== undefined && ip != user.ip) {
            return 401;
            }
            foundUserTable = new UserAndTable(tableName, user);
            if (tableName != DEFAULT_TABLE) {
            user.ready = false;
            users.delete(username);
            panamaTable.set(username, user);
            }
            break outerLoop;
        }
        }
        if (!foundUserTable) {
        return 404;
        }
        if (foundUserTable.table == DEFAULT_TABLE) {
        await this.storage.put('tables', tables);
        return 200;
        }
        let oldTable = tables.get(foundUserTable.table);
        if (oldTable) {
        for (let user of oldTable.values()) {
            user.ready = false;
            panamaTable.set(user.name, user);
        }
        tables.set(DEFAULT_TABLE, panamaTable);
        tables.delete(foundUserTable.table);
        }
        await this.storage.put('tables', tables);
        return 200;
    }

    public findUserAndTable(tables: Map<string, Map<string, User>>, searchedUsername: string, ip?: string): [Map<string, User>, User] | undefined {
        outerLoop: for (const [tableName, users] of tables) {
        innerLoop: for (const [username, user] of users) {
            if (username != searchedUsername) {
            continue innerLoop;
            }
            if (ip !== undefined && ip != user.ip) {
            continue innerLoop;
            }
            return [tables.get(tableName)!, user];
        }
        }
        return undefined;
    }

    public async toggleCanPlayTarot(searchedUsername: string, ip: string | undefined, tables: Map<string, Map<string, User>>): Promise<boolean> {
        if (tables.size == 0) {
        return false;
        }
        let foundResult = this.findUserAndTable(tables, searchedUsername, ip);
        let found = !!foundResult;
        if (foundResult) {
        foundResult[1].canPlayTarot = !foundResult[1].canPlayTarot;
        if (ip !== undefined) {
            foundResult[1].lastActiveAt = Date.now();
        }
        await this.storage.put('tables', tables);
        }
        return found;
    }

    public async toggleCanPlayTwoTables(searchedUsername: string, ip: string | undefined, tables: Map<string, Map<string, User>>): Promise<boolean> {
        if (tables.size == 0) {
        return false;
        }
        let foundResult = this.findUserAndTable(tables, searchedUsername, ip);
        let found = !!foundResult;
        if (foundResult) {
        foundResult[1].canPlayTwoTables = !foundResult[1].canPlayTwoTables;
        if (ip !== undefined) {
            foundResult[1].lastActiveAt = Date.now();
        }
        await this.storage.put('tables', tables);
        }
        return found;
    }

    public async setUserReadyOrNot(searchedUsername: string, ready: boolean, ip: string | undefined, tables: Map<string, Map<string, User>>): Promise<boolean> {
        if (tables.size == 0) {
        return false;
        }
        let foundResult = this.findUserAndTable(tables, searchedUsername, ip);
        let found = !!foundResult;
        if (foundResult) {
        foundResult[1].ready = ready;
        if (ip !== undefined) {
            foundResult[1].lastActiveAt = Date.now();
        }
        await this.storage.put('tables', tables);
        }
        return found;
    }

    public async adminSetUserInactive(searchedUsername: string, tables: Map<string, Map<string, User>>): Promise<boolean> {
        if (tables.size == 0) {
        return false;
        }
        let foundResult = this.findUserAndTable(tables, searchedUsername, undefined);
        let found = !!foundResult;
        if (foundResult) {
        const user = foundResult[1];
        if (user.lastActiveAt === undefined && !user.ready) {
            return false;
        }
        user.lastActiveAt = undefined;
        user.ready = false;
        await this.storage.put('tables', tables);
        }
        return found;
    }
}
