import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";

import mysql from "mysql2/promise";

import { env } from "./env";

import * as schema from "../drizzle/schema";

interface globalSetup {
	close: () => Promise<void>;
	client: mysql.Pool;
	connection: MySql2Database<typeof schema>;
}

// 👇 Create a singleton client
const global = globalThis as unknown as globalSetup;

const isTesting = env.NODE_ENV === "test";
const isProduction = env.NODE_ENV === "production";

// Create a MySQL connection pool
const createClient = (): mysql.Pool => {
	return (
		global.client ??
		mysql.createPool({
			uri: env.DATABASE_URL,
			connectionLimit: isProduction ? 10 : 1,
			idleTimeout: 30000,
			connectTimeout: 10000,
		})
	);
};

// Initialize client and database
const initializeDatabase = (): globalSetup => {
	const client = createClient();
	return {
		client,
		close: async () => await client.end(),
		connection: drizzle(client, {
			schema,
			mode: "default",
			casing: "snake_case",
			logger: !isProduction && !isTesting,
		}),
	};
};

// Reuse databaseInstance in development to avoid exhausting databaseInstances
let databaseInstance: globalSetup;

if (isProduction) {
	databaseInstance = initializeDatabase();
} else if (!global.client || !global.connection) {
	databaseInstance = initializeDatabase();
	global.close = databaseInstance.close;
	global.client = databaseInstance.client;
	global.connection = databaseInstance.connection;
} else {
	databaseInstance = {
		close: global.close,
		client: global.client,
		connection: global.connection,
	};
}

export const { close, client, connection } = databaseInstance;
