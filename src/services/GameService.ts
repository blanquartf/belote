import { User } from '../db/schema.types';
import { DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';
import { users } from "../db/schema"; // your schema file

export class GameService {
    db: DrizzleSqliteDODatabase<any>;
    constructor(db: DrizzleSqliteDODatabase<any>;) {
          this.db = db;
    }
    // Exported methods (already present)
    public async adminTableReady(tableName: string, tables: Map<string, Map<string, User>>): Promise<boolean> {
        if (tables.size == 0) {
        return false;
        }
        const table = tables.get(tableName);
        if (!table) {
        return false;
        }
        let ready = false;
        for (const [username, user] of table) {
        if (!user.ready) {
            user.ready = true;
            ready = true;
        }
        }
        if (ready) {
        await this.storage.put('tables', tables);
        }
        return ready;
    }

    public async adminTableNotReady(tableName: string, tables: Map<string, Map<string, User>>): Promise<boolean> {
        if (tables.size == 0) {
        return false;
        }
        const table = tables.get(tableName);
        if (!table) {
        return false;
        }
        let notReady = false;
        for (const [username, user] of table) {
        if (user.ready) {
            user.ready = false;
            notReady = true;
        }
        }
        if (notReady) {
        await this.storage.put('tables', tables);
        }
        return notReady;
    }

    public async adminGenerateTables(tables: Map<string, Map<string, User>>, DEFAULT_TABLE: string, shuffleArray: (arr: User[]) => User[]): Promise<boolean> {
        if (tables.size == 0) {
        return false;
        }
        let panamaTable = tables.get(DEFAULT_TABLE);
        if (!panamaTable) {
        panamaTable = new Map();
        }
        let readyUsers: User[] = [];
        for (const [username, user] of panamaTable) {
        if (user.ready) {
            readyUsers.push(user);
            panamaTable.delete(username);
        }
        }
        this.affectTables(tables, shuffleArray(readyUsers), 1, DEFAULT_TABLE);
        await this.storage.put('tables', tables);
        return true;
    }

    public affectTables(tables: Map<string, Map<string, User>>, users: User[], currentTable: number, DEFAULT_TABLE: string): void {
        if (users.length === 0) {
        return;
        }
        var currentTableSize = users.length < 8 ? users.length : (users.length % 4) + 4;
        const assignTable = function (tableName: string, users: User[]) {
        let table = tables.get(tableName);
        if (!table) {
            table = new Map<string, User>();
            tables.set(tableName, table);
        }
        for (let user of users) {
            table.set(user.name, user);
        }
        };
        let playersSelected: User[] = [];
        if (currentTableSize <= 3) {
        playersSelected = users;
        } else {
        if (currentTableSize == 5) {
            let tarotPlayers = users.filter((user) => user.canPlayTarot);
            if (tarotPlayers.length >= 5) {
            playersSelected = tarotPlayers.splice(0, 5);
            } else {
            playersSelected.push(users[users.length - 1]);
            }
        } else {
            if (currentTableSize == 7) {
            let usersThanCanPlayTwoTables = users.filter((user) => user.canPlayTwoTables);
            if (usersThanCanPlayTwoTables.length > 0) {
                playersSelected = [
                usersThanCanPlayTwoTables[0],
                ...users.filter((user) => user.name !== usersThanCanPlayTwoTables[0].name).slice(0, 6),
                ];
            } else {
                playersSelected.push(...users.slice(0, 3));
            }
            } else {
            playersSelected = users.splice(0, currentTableSize);
            }
        }
        }
        if (playersSelected.length < 4) {
        assignTable(DEFAULT_TABLE, playersSelected);
        } else {
        assignTable(`Table ${currentTable}`, playersSelected);
        }
        this.affectTables(
        tables,
        users.filter((user) => !playersSelected.find((userSelected) => userSelected.name === user.name)),
        currentTable + 1,
        DEFAULT_TABLE
        );
    }

    public async adminShuffleTables(tables: Map<string, Map<string, User>>, DEFAULT_TABLE: string, shuffleArray: (arr: User[]) => User[]): Promise<boolean> {
        if (tables.size == 0) {
        return false;
        }
        let panamaTable = tables.get(DEFAULT_TABLE) || new Map<string, User>();
        for (const [tableName, table] of tables) {
        if (tableName == DEFAULT_TABLE) {
            continue;
        }
        for (const [username, user] of table) {
            table.delete(username);
            panamaTable.set(username, user);
        }
        tables.delete(tableName);
        }
        await this.storage.put('tables', tables);
        return await this.adminGenerateTables(tables, DEFAULT_TABLE, shuffleArray);
    }

    public async adminDeleteAllTables(): Promise<boolean> {
        await this.storage.delete('tables');
        return true;
    }

    public async adminDeleteTable(tableName: string, tables: Map<string, Map<string, User>>, DEFAULT_TABLE: string): Promise<boolean> {
        if (tableName == DEFAULT_TABLE) {
        return false;
        }
        if (tables.size == 0) {
        return false;
        }
        const table = tables.get(tableName);
        if (!table) {
        return false;
        }
        const panamaTable = tables.get(DEFAULT_TABLE) || new Map<string, User>();
        for (const [username, user] of table) {
        panamaTable.set(username, user);
        }
        tables.delete(tableName);
        await this.storage.put('tables', tables);
        return true;
    }
}
