import { MyDurableObject } from './durable';
import { User } from './db/schema.types';
export interface Env {
	MY_DURABLE_OBJECT: DurableObjectNamespace<MyDurableObject>;
}

const success = {
	status: 200,
	headers: {
		'Content-Type': 'application/json;charset=utf-8',
		'Cache-Control': 'no-store',
	},
};
const IP_HEADER = 'CF-Connecting-IP';
export { MyDurableObject };

export default {
	async fetch(request: Request, env: Env, _ctx): Promise<Response> {
		const url = new URL(request.url);
		const internalError = new Response(JSON.stringify({ message: `internal error` }), { status: 500 });
		const unauthorizedError = new Response(JSON.stringify({ message: `unauthorized` }), { status: 401 });
		const missingUsername = new Response(JSON.stringify({ message: 'missing username' }), { status: 400 });
		// unchanged body MUST be null
		const unchanged = new Response(null, { status: 304 });
		const ip = request.headers.get(IP_HEADER) || 'unknown';
		const username = url.searchParams.get('username');
		const userReady = (username: string): string => {
			if (username) {
				return `🎉 user ${username} ready!`;
			}
			return 'user ready!';
		};
		const userNotReady = (username: string): string => {
			if (username) {
				return `🎉 user ${username} not ready!`;
			}
			return 'user not ready!';
		};

		const stub = env.MY_DURABLE_OBJECT.getByName('belote');
		if (!stub) {
			return new Response(JSON.stringify({ message: 'Durable Object not found' }), { status: 500 });
		}
		if (url.pathname==='/auth') {
			return stub.authenticate(request);
		}
		if (url.pathname==='/createAccount') {
			return stub.createAccount(request);
		}
		let adminAuth = url.pathname.indexOf("/admin/") !== -1;
		return stub.validateToken(request, async (user: User) => {
			switch (url.pathname) {
			case '/passwordChange': {
				return await stub.passwordChange(request, user);
			}
			case '/public/tables': {
				const tables = await stub.getTables();
				return new Response(tables, success);
			}

			// for users
			case '/me/ready': {
				if (!username) {
					return missingUsername;
				}
				if (await stub.setUserReadyOrNot(username, true, ip)) {
					await stub.notifyAll(userReady(username));
				}
				return new Response(JSON.stringify({ message: `🎉 User ready!` }), success);
			}
			case '/me/notready': {
				if (!username) {
					return missingUsername;
				}
				if (await stub.setUserReadyOrNot(username, false, ip)) {
					await stub.notifyAll(userNotReady(username));
				}
				return new Response(JSON.stringify({ message: `🎉 User not ready!` }), success);
			}
			case '/me/toggleCanPlayTwoTables': {
				if (!username) {
					return missingUsername;
				}
				if (await stub.toggleCanPlayTwoTables(username, ip)) {
					await stub.notifyAll(`user ${username} toggleCanPlayTwoTables!`);
				}
				return new Response(JSON.stringify({ message: `🎉 User can play on 2 tables!` }), success);
			}
			case '/me/toggleCanPlayTarot': {
				if (!username) {
					return missingUsername;
				}
				if (await stub.toggleCanPlayTarot(username, ip)) {
					await stub.notifyAll(`user ${username} toggleCanPlayTarot!`);
				}
				return new Response(JSON.stringify({ message: `🎉 User can play tarot !` }), success);
			}
			case '/me/join': {
				if (!username) {
					return missingUsername;
				}
				const join = await stub.join(username, ip);
				if (join) {
					await stub.notifyAll(`user ${username} joined the Meltdown`);
					return new Response(JSON.stringify({ message: `🎉 User ${username} joined!` }), success);
				}
				return unchanged;
			}
			case '/me/meltdown': {
				if (!username) {
					return missingUsername;
				}
				const response = stub.fetch(request);
				console.log(`user ${username} connected to Meltdown room`);
				return response;
			}
			case '/me/quit': {
				if (!username) {
					return missingUsername;
				}
				const quit = await stub.quit(username, ip);
				if (quit) {
					await stub.notifyAll(`user ${username} quit the Meltdown`);
					return new Response(JSON.stringify({ message: `🎉 User ${username} left!` }), success);
				} else {
					return new Response(JSON.stringify({ message: `User ${username} not found or not authorized` }), { status: 404 });
				}
			}
			case '/me/finish': {
				if (!username) {
					return missingUsername;
				}
				const code = await stub.finish(username, ip);
				switch (code) {
					case 401:
						return unauthorizedError;
					case 404:
						return new Response(JSON.stringify({ message: `User ${username} not found` }), { status: 404 });
					case 304:
						return unchanged;
					case 200:
						await stub.notifyAll(`user ${username} and its friends at the same table finished their game`);
						return new Response(JSON.stringify({ message: `🎉 User ${username} moved!` }), success);
					default:
						return internalError;
				}
			}

			// ADMIN with username param
			case '/admin/users/join': {
				if (!username) {
						return missingUsername;
					}
					const join = await stub.join(username, undefined);
					if (join) {
						await stub.notifyAll(`user ${username} joined`);
						return new Response(JSON.stringify({ message: `🎉 User ${username} joined!` }), success);
					}
					return unchanged;
			}
			case '/admin/users/toggleCanPlayTarot': {
				if (!username) {
					return missingUsername;
				}
				const found = await stub.toggleCanPlayTarot(username);
				if (found) {
					await stub.notifyAll(`user ${username} toggleCanPlayTarot!`);
					return new Response(JSON.stringify({ message: `🎉 User ${username} toggleCanPlayTarot!` }), success);
				} else {
					return new Response(JSON.stringify({ message: `User ${username} not found` }), { status: 404 });
				}
			}
			case '/admin/users/toggleCanPlayTwoTables': {
				if (!username) {
					return missingUsername;
				}
				const found = await stub.toggleCanPlayTwoTables(username);
				if (found) {
					await stub.notifyAll(`user ${username} toggleCanPlayTwoTables!`);
					return new Response(JSON.stringify({ message: `🎉 User ${username} toggleCanPlayTwoTables!` }), success);
				} else {
					return new Response(JSON.stringify({ message: `User ${username} not found` }), { status: 404 });
				}
			}
			case '/admin/users/ready': {
				if (!username) {
					return missingUsername;
				}
				const found = await stub.setUserReadyOrNot(username, true, undefined);
				if (found) {
					await stub.notifyAll(`user ${username} ready`);
					return new Response(`🎉 User ${username} ready!`, success);
				} else {
					return new Response(`User ${username} not found`, { status: 404 });
				}
			}
			case '/admin/users/notready': {
				if (!username) {
					return missingUsername;
				}
				const ready = await stub.setUserReadyOrNot(username, false, undefined);
				if (ready) {
					await stub.notifyAll(userNotReady(username));
					return new Response(JSON.stringify({ message: userNotReady(username) }), success);
				} else {
					return new Response(`User ${username} not found`, { status: 404 });
				}
			}
			case '/admin/users/inactive': {
				if (!username) {
					return missingUsername;
				}
				const inactive = await stub.adminSetUserInactive(username);
				if (inactive) {
					await stub.notifyAll(`user ${username} set inactive`);
					return new Response(`🎉 User ${username} set inactive!`, success);
				} else {
					return new Response(`User ${username} not found`, { status: 404 });
				}
			}
			case '/admin/users/delete': {
				if (!username) {
					return missingUsername;
				}
				const deleted = await stub.quit(username, undefined);
				if (deleted) {
					await stub.notifyAll(`user ${username} deleted from Meltdown`);
					return new Response(`🎉 User ${username} deleted!`, success);
				} else {
					return new Response(`User ${username} not found`, { status: 404 });
				}
			}
			case '/admin/users/finish': {
				if (!username) {
					return missingUsername;
				}
				const code = await stub.finish(username, undefined);
				switch (code) {
					case 404:
						return new Response(JSON.stringify({ message: `User ${username} not found` }), { status: 404 });
					case 304:
						return unchanged;
					case 200:
						await stub.notifyAll(`user ${username} finished its game`);
						return new Response(JSON.stringify({ message: `🎉 User ${username} finished its game!` }), success);
					default:
						return internalError;
				}
			}

			// ADMIN without username param
			case '/admin/users': {
				const users = await stub.getUsers();
				return new Response(users, success);
			}
			case '/admin/notify': {
				await stub.notifyAll('force notify all');
				return new Response(JSON.stringify({ message: `🎉 Users notified!` }), success);
			}
			case '/admin/tables/delete': {
				const table = url.searchParams.get('table');
				if (!table) {
					return new Response(JSON.stringify({ message: 'missing table name' }), { status: 400 });
				}
				const deleted = await stub.adminDeleteTable(table);
				if (!deleted) {
					return unchanged;
				}
				await stub.notifyAll('table deleted');
				return new Response(JSON.stringify({ message: `🎉 table deleted!` }), success);
			}
			case '/admin/tables/notready': {
				const table = url.searchParams.get('table');
				if (!table) {
					return new Response(JSON.stringify({ message: 'missing table name' }), { status: 400 });
				}
				const notReady = await stub.adminTableNotReady(table);
				if (!notReady) {
					return unchanged;
				}
				await stub.notifyAll('table not ready');
				return new Response(JSON.stringify({ message: `🎉 table not ready!` }), success);
			}
			case '/admin/tables/ready': {
				const table = url.searchParams.get('table');
				if (!table) {
					return new Response(JSON.stringify({ message: 'missing table name' }), { status: 400 });
				}
				console.log(table);
				const ready = await stub.adminTableReady(table);
				if (!ready) {
					return unchanged;
				}
				await stub.notifyAll('table ready');
				return new Response(JSON.stringify({ message: `🎉 table ready!` }), success);
			}
			case '/admin/tables/clear': {
				if (await stub.adminDeleteAllTables()) {
					await stub.notifyAll(`tables cleared`);
				}
				return new Response(JSON.stringify({ message: `🎉 Tables cleared` }), success);
			}
			case '/admin/tables/generate': {
				if (await stub.adminGenerateTables()) {
					await stub.notifyAll(`tables generated`);
				}
				return new Response(JSON.stringify({ message: `🎉 New tables generated` }), success);
			}
			case '/admin/tables/shuffle': {
				if (await stub.adminShuffleTables()) {
					await stub.notifyAll(`tables shuffled`);
				}
				return new Response(JSON.stringify({ message: `🎉 New tables reshuffled` }), success);
			}
			case '/admin/meltdown': {
				const response = stub.fetch(request);
				console.log('admin user connected to room');
				return response;
			}
			default:
				return new Response(JSON.stringify({ message: 'not Found' }), { status: 404 });
		}
		},adminAuth);
	},
} satisfies ExportedHandler<Env>;
