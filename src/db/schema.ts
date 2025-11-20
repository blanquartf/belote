import {
  sqliteTable,
  text,
  integer,
  primaryKey
} from "drizzle-orm/sqlite-core";

// ======================================================================
// USERS TABLE
// ======================================================================
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  pseudo: text("pseudo").notNull().unique(),
  password: text("password").notNull(),
  ready: integer("ready", { mode: "boolean" })
    .notNull()
    .default(false),
  admin: integer("admin", { mode: "boolean" })
    .notNull()
    .default(false),

  token: text("token").unique(),
  tokenValidity: text("tokenValidity"),

  lastActiveAt: text("lastActiveAt"),  // store ISO date strings
  ip: text("ip")
});

// ======================================================================
// GAME MODES TABLE
// ======================================================================
export const gameModes = sqliteTable("gamesModes", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  name: text("name").notNull(),
  priority: integer("priority").notNull(),
  minPlayerCount: integer("minPlayerCount").notNull().default(4),
  maxPlayerCount: integer("maxPlayerCount").notNull().default(7)
});

// ======================================================================
// TABLES TABLE
// ======================================================================
export const tables = sqliteTable("tables", {
  id: integer("id").primaryKey({ autoIncrement: true }),

  name: text("name").notNull(),
  finished: integer("finished", { mode: "boolean" })
    .notNull()
    .default(false),

  gamemodeId: integer("gamemode_id")
    .notNull()
    .references(() => gameModes.id, { onDelete: "cascade" })
});

// ======================================================================
// TABLES_USERS (JOIN TABLE)
// ======================================================================
export const tablesUsers = sqliteTable(
  "tables_users",
  {
    tableId: integer("table_id")
      .notNull()
      .references(() => tables.id, { onDelete: "cascade" }),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tableId, t.userId] })
  })
);

// ======================================================================
// TABLES_USERS (JOIN TABLE)
// ======================================================================
export const users_gamemodes = sqliteTable(
  "users_gamesModes",
  {
    gameModeId: integer("gamemode_id")
      .notNull()
      .references(() => gameModes.id, { onDelete: "cascade" }),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    winner: integer("admin", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.gameModeId, t.userId] })
  })
);
