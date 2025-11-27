import { GameMode, Table, User, FullTable, Team } from '../db/schema.types';
import { DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';
import { users, tables, tablesUsers, gameModes } from "../db/schema"; // your schema file
import { and, eq } from 'drizzle-orm';
import { shuffleArray } from '../helpers';


const TEAMS = ['red', 'black', 'orange', 'blue', 'green'];

export class GameService {
    db: DrizzleSqliteDODatabase<any>;
    constructor(db: DrizzleSqliteDODatabase<any>) {
          this.db = db;
    }
    public async getPanamaTable(): Promise<FullTable> {
        let tables = await this.getTables();
        return tables.find((tableWithUsers) => tableWithUsers.table.panama)!!; 
    }
    public async addUserToTable(user:User, tableId: number) {
        await this.addUserToTableWithTeamName(user,tableId, TEAMS[0]);
    }
    private async addUserToTableWithTeamName(user:User, tableId: number, teamName: string) {
        const currentUserTables = await this.getCurrentTablesFromUser(user);
        if (currentUserTables.length == 0) {
            await this.db
            .insert(tablesUsers)
            .values({
                tableId: tableId,
                userId: user.id,
                team: teamName
            })
            .returning();
        }
    }
    public async getGameMode(name:string) : Promise<GameMode> {
        return await this.db
        .select()
        .from(gameModes)
        .where(
            and(
                eq(gameModes.name, name),
            )
        ).get()!!;
    }
    public async getCurrentTablesFromUser(user:User) : Promise<Table[] > {
        return await this.db
        .select()
        .from(tables)
        .innerJoin(tablesUsers, eq(tablesUsers.tableId, tables.id))
        .where(
            and(
                eq(tablesUsers.userId, user.id),
                eq(tables.finished, false),
            )
        ).all().map((elem) => elem.tables);
    }
    public async createTable(tableName: string, gameMode: GameMode, teams: Team[]): Promise<Table> {
        const newTable: Table = await this.db
            .insert(tables)
            .values({
                name: tableName,
                gamemodeId: gameMode.id
            })
            .returning().get();
        for (const team of teams) {
            for (const user of team.users) {
                await this.addUserToTableWithTeamName(user, newTable!!.id, team.name);
            }
        }
        return newTable;
    }

    public async getTables(): Promise<FullTable[]> {
        const rows = await this.db
        .select({
            table: tables,
            user: users,
            tablesUsers: tablesUsers
        })
        .from(tables)
        .leftJoin(tablesUsers, eq(tablesUsers.tableId, tables.id))
        .leftJoin(users, eq(tablesUsers.userId, users.id))
        .where(eq(tables.finished, false))
        .all();
        const map = new Map<number, FullTable>();

        for (const row of rows) {
            const table = row.table;
            const user = row.user;
            const tablesUsers = row.tablesUsers

            if (!map.has(table.id)) {
                map.set(table.id, {
                table,
                teams: []
                });
            }

            if (user) {
                let currentTeam = map.get(table.id)!.teams.find((team) => team.name === tablesUsers!!.team);
                if (!currentTeam) {
                    map.get(table.id)!.teams.push({
                        name: tablesUsers!!.team!!,
                        users: []
                    });
                }
                currentTeam?.users.push({
                    ...user,
                    token: null,
                    password: null
                });
            }
        }

        return [...map.values()];
    }

    public async generateTables() {
        let tables = await this.getTables();
        let readyUsers = tables.find((tableWithUsers) => tableWithUsers.table.panama)!!.teams[0].users.filter(user => user.ready); 
        let users = shuffleArray(readyUsers);
        // Index 0 for 4,Index 1 for 5,Index 2 for 6,Index 3 for 7,
        let maxAllocationPossible = [
            Math.floor(users.length / 4),
            //Maximum de nombre de tables qui peuvent jouer au tarot
            Math.floor(users.filter((user) => user.canPlayTarot).length / 5),
            Math.floor(users.length / 6),
            //Maximum de nombre de tables ayant un joueur qui peut jouer sur deux tables
            users.filter((user) => user.canPlayTwoTables).length,
        ];
        let candidates = [];
        for (let t4 = 0; t4 <= maxAllocationPossible[0]; t4++) {
            for (let t5 = 0; t5 <= maxAllocationPossible[1]; t5++) {
                for (let t6 = 0; t6 <= maxAllocationPossible[2]; t6++) {
                    for (let t7 = 0; t7 <= maxAllocationPossible[3]; t7++) {
                        const usedPlayers = 4 * t4 + 5 * t5 + 6 * t6 + 7 * t7;
                        if (usedPlayers <= users.length) {
                            candidates.push([t4, t5, t6, t7]);
                        }
                    }
                }
            }
        }
        if (candidates.length === 0) {
            for (const user of users) {
                await this.addUserToTableWithTeamName(user, (await this.getPanamaTable()).table.id, TEAMS[0]);
            }
        }

        const usedPlayers = (p: number[]): number => {
            return p[0] * 4 + p[1] * 5 + p[2] * 6 + p[3] * 7;
        };

        const combinationsWithNumberMatchingTotalParticipants = candidates.filter((combination) => usedPlayers(combination) === users.length);
        let bestCombinationPossible: number[] = [];
        let currentPlayers = [...users];
        if (combinationsWithNumberMatchingTotalParticipants.length != 0) {
            //We find the one that max the number of tables of 4
            const maxT4 = Math.max(...combinationsWithNumberMatchingTotalParticipants.map((combination) => combination[0]));
            bestCombinationPossible = combinationsWithNumberMatchingTotalParticipants.filter((combination) => combination[0] === maxT4)[0];
        } else {
            //We try to find the combinations that maxes the number of participants
            let secondBestCombinationParticipantNumber = users.length;
            let secondBestCombinations = [];
            do {
                secondBestCombinationParticipantNumber--;
                secondBestCombinations = candidates.filter((combination) => usedPlayers(combination) === secondBestCombinationParticipantNumber);
            } while (secondBestCombinations.length == 0);
            //Maximize number of tables of 4
            const maxT4 = Math.max(...secondBestCombinations.map((combination) => combination[0]));
            bestCombinationPossible = secondBestCombinations.filter((combination) => combination[0] === maxT4)[0];

            //Now we assign the players that would be left to Panama...
            let currentPlayersThatDontTarotOrSeven = currentPlayers.filter((user) => !user.canPlayTarot && !user.canPlayTwoTables);
            let numberOfPlayersToGoToPanama = currentPlayers.length - secondBestCombinationParticipantNumber;
            let playersSelected = [];
            if (currentPlayersThatDontTarotOrSeven.length >= numberOfPlayersToGoToPanama) {
                playersSelected = currentPlayersThatDontTarotOrSeven.slice(0, numberOfPlayersToGoToPanama);
            } else {
                playersSelected = currentPlayers
                    .filter(
                        (user) => (!user.canPlayTarot || bestCombinationPossible[1] == 0) && (!user.canPlayTwoTables || bestCombinationPossible[3] == 0)
                    )
                    .slice(0, numberOfPlayersToGoToPanama);
            }
            for (const user of playersSelected) {
                await this.addUserToTableWithTeamName(user, (await this.getPanamaTable()).table.id, TEAMS[0]);
            }
            currentPlayers = currentPlayers.filter((user) => !playersSelected.find((userSelected) => userSelected.pseudo === user.pseudo));
        }
        let usedTableNames = tables.map((fullTable) => fullTable.table.name);

        //Tarot is priority
        while (currentPlayers.length != 0) {
            let playersSelected: User[] = [];
            let playerThatWillPlayTwoTables;
            // 5 priority for tarot
            if (bestCombinationPossible[1] != 0) {
                playersSelected = currentPlayers.filter((user) => user.canPlayTarot).splice(0, 5);
                bestCombinationPossible[1]--;
            } else {
                // 7 priority for users playing two tables
                if (bestCombinationPossible[3] != 0) {
                    let usersThanCanPlayTwoTables = currentPlayers.filter((user) => user.canPlayTwoTables);
                    playerThatWillPlayTwoTables = usersThanCanPlayTwoTables[0];
                    playersSelected = [
                        playerThatWillPlayTwoTables,
                        ...currentPlayers.filter((user) => user.pseudo !== playerThatWillPlayTwoTables!!.pseudo).slice(0, 6),
                    ];
                    bestCombinationPossible[3]--;
                } else {
                    if (bestCombinationPossible[0] != 0) {
                        playersSelected = currentPlayers.splice(0, 4);
                        bestCombinationPossible[0]--;
                    } else {
                        playersSelected = currentPlayers.splice(0, 6);
                        bestCombinationPossible[2]--;
                    }
                }
            }
            let teamsNeeded = Math.ceil(playersSelected.length / 2);
            let gameMode = await this.getGameMode('Belote');
            switch(playersSelected.length) {
                case 4 :
                    teamsNeeded = 2;
                case 5:
                    gameMode = await this.getGameMode('Tarot');
                    teamsNeeded = 5;
                    break;
                case 6:
                    teamsNeeded = 3;
                    // Mode specifique pour le 6 pour des stats différentes de la belote a 4
                    gameMode = await this.getGameMode('Belote a 6');
                    break;
                case 7 :
                    teamsNeeded = 4;
                    break;
            }
            switch(playersSelected.length) {
                case 7 :
                    await this.generateTable(
                        [
                            ...playersSelected.filter((player) => player.pseudo!=playerThatWillPlayTwoTables!!.pseudo).slice(0,3),
                            playerThatWillPlayTwoTables!!
                        ], 
                        playerThatWillPlayTwoTables, 
                        gameMode, 
                        usedTableNames,
                        teamsNeeded
                    );
                    await this.generateTable(
                        [
                            ...playersSelected.filter((player) => player.pseudo!=playerThatWillPlayTwoTables!!.pseudo).slice(3,6),
                            playerThatWillPlayTwoTables!!
                        ], 
                        playerThatWillPlayTwoTables, 
                        gameMode, 
                        usedTableNames,
                        teamsNeeded
                    );
                    break;
                default:
                    await this.generateTable(
                        playersSelected,
                        playerThatWillPlayTwoTables, 
                        gameMode, 
                        usedTableNames,
                        teamsNeeded
                    );
                    break;

            }


            
            currentPlayers = currentPlayers.filter((user) => !playersSelected.find((userSelected) => userSelected.pseudo === user.pseudo));
        }
    }
    private async generateTable(players: User[], playerOnTwoTable: User | undefined, gameMode: GameMode, usedTableNames: string[],teamsNeeded : number) {
        let teams: Team[] = [];
            
        for (let index = 0;index < teamsNeeded; index++) {
            let users: User[] = teamsNeeded == players.length ? [
                players[index],
            ]: [
                players[2*index],//0,2,4
                players[(2*index)+1],//1,3,5
            ];
            teams.push({
                name: TEAMS[index % teamsNeeded],
                users : users
            })
        }
        var nextTableAvailable = 1;
        while (usedTableNames.filter((tableName) => tableName.startsWith(`Table ${nextTableAvailable} `))) {
            nextTableAvailable++;
        }
        await this.createTable(`Table ${nextTableAvailable} ${playerOnTwoTable ? '(Table of 7)' : ''}`,gameMode, teams);
    }

    public async finish(tableId: number, winningTeam: string | undefined, pseudo: string | undefined) {
        const fullTables = await this.getTables();
        const table = fullTables.filter((fullTable) => fullTable.table.id == tableId)[0];
        if (pseudo) {
            let hasPseudo = false;
            for (const team of table.teams) {
                if (team.users.filter((user) => user.pseudo === pseudo).length > 0) {
                    hasPseudo = true;
                }
            }
            if (!hasPseudo) {
                return;
            }
        }
        await this.db.update(tables)
            .set({ finished: true })
            .where(eq(tables.id, tableId));
        if (winningTeam) {
            await this.db.update(tablesUsers)
            .set({ winner: true })
            .where(and(eq(tablesUsers.tableId, tableId),eq(tablesUsers.team, winningTeam)));
        }
        
        for (const team of table.teams) {
            for (const player of team.users) {
                await this.addUserToTable(player, ((await this.getPanamaTable()).table.id));
            }
        }
    }
}
