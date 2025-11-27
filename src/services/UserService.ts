import { User } from '../db/schema.types';
import { eq } from "drizzle-orm";
import { DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';
import { users } from "../db/schema"; // your schema file
import { v4 as uuidv4 } from 'uuid';
import { compare,hash } from "bcrypt-ts";
const saltRounds = 10;

export class UserService {
    db: DrizzleSqliteDODatabase<any>;
    constructor(db: DrizzleSqliteDODatabase<any>) {
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
            password: await hash(password, saltRounds),               // store plain password only for testing!
            ready: false,
            admin: false,
            token: null,
            tokenValidity: null,
            lastActiveAt: new Date().toISOString()
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

        if (!await compare(body.oldPassword,user.password!!)) {
            return mustLoginResponse;
        }

        await this.db.update(users)
            .set({ password: await hash(body.newPassword, saltRounds) })
            .where(eq(users.id, user.id));
    
        return new Response(user.token, {
            status: 200,
        });
    }
    async authenticate(request: Request): Promise<User | undefined> {
        const body: {pseudo: string, password: string} = await request.json();
        const pseudo = body.pseudo;
        const password = body.password;
        const userResult = await this.db
            .select()
            .from(users)
            .where(eq(users.pseudo, pseudo)).get();

        if (!userResult || !await bcrypt.compare(password,userResult.password)) {
            return undefined;
        }

        let newToken = uuidv4();
        userResult.token = newToken;

        await this.db.update(users)
            .set({ token: newToken, tokenValidity: new Date().toISOString() })
            .where(eq(users.id, userResult.id));
    
        return userResult;
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
            .where(eq(users.token, token)).get();
        
        if (!userResult || !userResult.tokenValidity || (admin && !userResult.admin)) {
            return mustLoginResponse;
        }
        const now = new Date();
        const validity = new Date(userResult.tokenValidity);
        if (isNaN(validity.getTime()) || validity < now) {
            return mustLoginResponse;
        }

        await this.db.update(users)
            .set({ tokenValidity: new Date().toISOString() })
            .where(eq(users.id, userResult.id));
    
        return await operation(userResult);
    }

    public async changeUserState(request: Request, pseudo: string) {
        const body: {ready: boolean | undefined, canPlayTarot: boolean | undefined, canPlayTwoTables: boolean | undefined} = await request.json();
        const user = await this.db
            .select()
            .from(users)
            .where(eq(users.pseudo, pseudo)).get();
            if (user) {
                await this.db.update(users)
                .set({ ready: body.ready ?? user.ready, canPlayTarot: body.canPlayTarot ?? user.canPlayTarot, canPlayTwoTables: body.canPlayTwoTables?? user.canPlayTwoTables })
                .where(eq(users.id, user.id));
            }
        
    }

    public async quit(pseudo: string) {
        const user = await this.db
            .select()
            .from(users)
            .where(eq(users.pseudo, pseudo)).get();
        if (user) {
            await this.db.update(users)
            .set({ tokenValidity: new Date(new Date().getDate() - 1).toISOString()})
            .where(eq(users.id, user.id));
        }
    }

    async resetUserPassword(request: Request, pseudo: string) {
        await this.db.update(users)
            .set({ password: await bcrypt.hash('tempPassword', saltRounds) })
            .where(eq(users.pseudo, pseudo));
    }
}
