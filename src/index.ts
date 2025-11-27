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
		const stub = env.MY_DURABLE_OBJECT.getByName('belote');
		if (!stub) {
			return new Response(JSON.stringify({ message: 'Durable Object not found' }), { status: 500 });
		}
		console.log(url.pathname);
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
				return new Response(JSON.stringify(tables), success);
			}
			case '/me/changeUserState': {
				await stub.changeUserState(request,user.pseudo)
				await stub.notifyAll(`user ${user.pseudo} toggleUserState!`);
				return new Response(JSON.stringify({ message: `🎉 User changed state !` }), success);
			}
			case '/me/quit': {
				await stub.quit(user.pseudo);
				await stub.notifyAll(`user ${user.pseudo} disconnected`);
				return new Response(JSON.stringify({ message: `🎉 User ${user.pseudo} disconnected!` }), success);
			}
			case '/me/finish': {
				const winningTeam = url.searchParams.get('winningTeam');
				if (!winningTeam) {
					return new Response(JSON.stringify({ message: 'missing winningTeam' }), { status: 400 });
				}
				if (!url.searchParams.get('tableId')) {
					return new Response(JSON.stringify({ message: 'missing tableId' }), { status: 400 });
				}
				await stub.finish(parseInt(url.searchParams.get('tableId')!!), winningTeam, user.pseudo);
			}
			case '/admin/users/quit': {
				const pseudo = url.searchParams.get('pseudo');
				if (!pseudo) {
					return new Response(JSON.stringify({ message: 'missing username' }), { status: 400 });
				}
				await stub.quit(pseudo);
			}
			case '/admin/users/toggleUserState': {
				const pseudo = url.searchParams.get('pseudo');
				if (!pseudo) {
					return new Response(JSON.stringify({ message: 'missing username' }), { status: 400 });
				}
				await stub.changeUserState(request, pseudo);
				await stub.notifyAll('User changed state');
				return new Response(JSON.stringify({ message: `🎉 User changed state!` }), success);
			}
			case '/admin/users/finish': {
				if (!url.searchParams.get('tableId')) {
					return new Response(JSON.stringify({ message: 'missing tableId' }), { status: 400 });
				}
				const winningTeam = url.searchParams.get('winningTeam');
				if (!winningTeam) {
					return new Response(JSON.stringify({ message: 'missing winningTeam' }), { status: 400 });
				}
				await stub.finish(parseInt(url.searchParams.get('tableId')!!), winningTeam, undefined);
			}
			case '/admin/tables/delete': {
				if (!url.searchParams.get('tableId')) {
					return new Response(JSON.stringify({ message: 'missing tableId' }), { status: 400 });
				}
				await stub.finish(parseInt(url.searchParams.get('tableId')!!), undefined, undefined);
				await stub.notifyAll(`table deleted`);
				return new Response(JSON.stringify({ message: `🎉 Table deleted` }), success);
			}
			case '/admin/tables/clear': {
				await stub.adminDeleteAllTables()
				await stub.notifyAll(`tables cleared`);
				return new Response(JSON.stringify({ message: `🎉 Tables cleared` }), success);
			}
			case '/admin/tables/generate': {
				await stub.adminGenerateTables()
				await stub.notifyAll(`tables generated`);
				return new Response(JSON.stringify({ message: `🎉 New tables generated` }), success);
			}
			case '/admin/tables/shuffle': {
				await stub.adminShuffleTables();
				await stub.notifyAll(`tables shuffled`);
				return new Response(JSON.stringify({ message: `🎉 New tables reshuffled` }), success);
			}
			case '/admin/meltdown': {
				const response = stub.fetch(request);
				console.log('admin user connected to room');
				return response;
			}
			default:
				return new Response(JSON.stringify({ message: `url ${url} not found` }), { status: 404 });
		}
		},adminAuth);
	},
} satisfies ExportedHandler<Env>;
