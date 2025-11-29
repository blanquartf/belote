export function readyPlayer(name: string): User {
	const user = new User(name, undefined);
	user.ready = true;
	return user;
}

export function readyPlayerTarot(name: string): User {
	const user = new User(name, undefined);
	user.ready = true;
	user.canPlayTarot = true;
	return user;
}

export function readyPlayerTwoTables(name: string): User {
	const user = new User(name, undefined);
	user.ready = true;
	user.canPlayTwoTables = true;
	return user;
}

export function readyPlayerTarotAndTwoTables(name: string): User {
	const user = new User(name, undefined);
	user.ready = true;
	user.canPlayTarot = true;
	user.canPlayTwoTables = true;
	return user;
}
