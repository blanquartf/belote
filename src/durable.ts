import { DurableObject } from 'cloudflare:workers';
import { replacer, shuffleArray } from './helpers';
import { User } from './db/schema.types';
import { drizzle, type DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import * as schema from "./db/schema";
import { GameService } from './services/GameService';
import { UserService } from './services/UserService';

type Sessions = Map<WebSocket, { [key: string]: string }>;
const DEFAULT_TABLE = 'panama';
type Table = Map<string, User>;
type Tables = Map<string, Table>;

export class MyDurableObject extends DurableObject<Env> {
	sessions: Sessions;
	storage: DurableObjectStorage;
  	db: DrizzleSqliteDODatabase<any>;
	gameService: GameService;
	userService: UserService;
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.storage = ctx.storage;
    	this.db = drizzle(this.storage, { logger: false });
		this.sessions = new Map<WebSocket, { [key: string]: string }>();
		this.gameService = new GameService(this.db);
		this.userService = new UserService(this.db);
	}
	
	async passwordChange(request: Request, user:User): Promise<Response> {
		return this.userService.passwordChange(request, user);
	}
	async createAccount(request: Request): Promise<Response> {
		return this.userService.createAccount(request);
	}
	async authenticate(request: Request): Promise<Response> {
		return this.userService.authenticate(request);
	}
	async validateToken(request: Request, operation: (user: User) => Promise<Response>, admin: Boolean = false): Promise<Response> {
		return this.userService.validateToken(request,operation,admin);
	}
	async finish(username: string, ip?: string): Promise<number> {
		const tables = (await this.storage.get<Tables>('tables')) || new Map<string, Table>();
		return await this.userService.finish(username, ip, tables, DEFAULT_TABLE);
	}
	async quit(username: string, ip?: string): Promise<number> {
		const tables = (await this.storage.get<Tables>('tables')) || new Map<string, Table>();
		return await this.userService.quit(username, ip, tables, DEFAULT_TABLE);
	}
	findUserAndTable(tables: Tables, searchedUsername: string, ip?: string): [Table, User] | undefined {
		outerLoop: for (const [tableName, users] of tables) {
			innerLoop: for (const [username, user] of users) {
				if (username != searchedUsername) {
					continue innerLoop;
				}
				if (ip !== undefined && ip != user.ip) {
					continue innerLoop;
				}
				console.log(`user ${user.name} found on table ${tableName}`);
				return [tables.get(tableName)!, user];
			}
		}
		return undefined;
	}
	async toggleCanPlayTarot(searchedUsername: string, ip?: string): Promise<boolean> {
		const tables = (await this.storage.get<Tables>('tables')) || new Map<string, Table>();
		return await this.userService.toggleCanPlayTarot(searchedUsername, ip, tables);
	}
	async toggleCanPlayTwoTables(searchedUsername: string, ip?: string): Promise<boolean> {
		const tables = (await this.storage.get<Tables>('tables')) || new Map<string, Table>();
		return await this.userService.toggleCanPlayTwoTables(searchedUsername, ip, tables);
	}
	async setUserReadyOrNot(searchedUsername: string, ready: boolean, ip?: string): Promise<boolean> {
		const tables = (await this.storage.get<Tables>('tables')) || new Map<string, Table>();
		return await this.userService.setUserReadyOrNot(searchedUsername, ready, ip, tables);
	}
	async join(newUsername: string, ip: string | undefined): Promise<boolean> {
		const tables = (await this.storage.get<Tables>('tables')) || new Map<string, Table>();
		return await this.userService.join(newUsername, ip, tables, DEFAULT_TABLE);
	}

	// for admin exclusively
	async adminSetUserInactive(searchedUsername: string): Promise<boolean> {
		const tables = (await this.storage.get<Tables>('tables')) || new Map<string, Table>();
		return await this.userService.adminSetUserInactive(searchedUsername, tables);
	}
	async adminTableReady(tableName: string): Promise<boolean> {
		const tables = (await this.storage.get<Tables>('tables')) || new Map<string, Table>();
		return await this.gameService.adminTableReady(tableName, tables);
	}
	async adminTableNotReady(tableName: string): Promise<boolean> {
		const tables = (await this.storage.get<Tables>('tables')) || new Map<string, Table>();
		return await this.gameService.adminTableNotReady(tableName, tables);
	}
	async adminGenerateTables(): Promise<boolean> {
		const tables = (await this.storage.get<Tables>('tables')) || new Map<string, Table>();
		return await this.gameService.adminGenerateTables(tables, DEFAULT_TABLE, shuffleArray);
	}

	affectTables(tables: Tables, users: User[], currentTable: number): void {
		// Now handled by GameService
		return;
	}

	async adminShuffleTables(): Promise<boolean> {
		const tables = (await this.storage.get<Tables>('tables')) || new Map<string, Table>();
		return await this.gameService.adminShuffleTables(tables, DEFAULT_TABLE, shuffleArray);
	}
	async adminDeleteAllTables(): Promise<boolean> {
		return await this.gameService.adminDeleteAllTables();
	}
	async adminDeleteTable(tableName: string): Promise<boolean> {
		const tables = (await this.storage.get<Tables>('tables')) || new Map<string, Table>();
		return await this.gameService.adminDeleteTable(tableName, tables, DEFAULT_TABLE);
	}

	// no modifying
	async getTables(): Promise<string> {
		const tables = (await this.ctx.storage.get<Tables>('tables')) || new Map<string, Table>();
		let pretty = JSON.stringify(Object.fromEntries(tables), replacer, 2);
		return pretty;
	}
	async getUsers(): Promise<string> {
		const tables = (await this.ctx.storage.get<Tables>('tables')) || new Map<string, Table>();
		const allUsers: User[] = [];
		for (const [_, users] of tables) {
			allUsers.push(...users.values());
		}
		let pretty = JSON.stringify(allUsers, replacer, 2);
		return pretty;
	}
	async notifyAll(reason: string) {
		this.sessions.forEach((_, session) => {
			session.send(`you must refresh tables because: ${reason}`);
		});
	}
	async fetch(request: Request): Promise<Response> {
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);
		this.ctx.acceptWebSocket(server);
		const id = crypto.randomUUID();
		this.sessions.set(server, { id });
		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}
}
