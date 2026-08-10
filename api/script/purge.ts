import mysql from "mysql2/promise";

import { env } from "../src/lib/env";

const main = async (): Promise<void> => {
	console.log("🧹 Purging database...");
	console.log("=========================\n");

	const connectionString = env.DATABASE_URL;

	if (!connectionString) {
		throw new Error("DATABASE_URL is missing.");
	}

	const connection = await mysql.createConnection(connectionString);

	try {
		const [rows] = await connection.query<mysql.RowDataPacket[]>(
			`SELECT table_name AS tableName
			 FROM information_schema.tables
			 WHERE table_schema = DATABASE()
			 AND table_name <> '__drizzle_migrations'
			 ORDER BY table_name;`,
		);

		const tables = rows.map((row) => row.tableName as string);

		if (tables.length === 0) {
			console.log("ℹ️ No tables found.");
			return;
		}

		console.log(`Found ${tables.length} tables.\n`);

		await connection.query("SET FOREIGN_KEY_CHECKS = 0;");

		for (const table of tables) {
			await connection.query(`TRUNCATE TABLE \`${table}\`;`);
			console.log(`✓ Purged ${table}`);
		}

		await connection.query("SET FOREIGN_KEY_CHECKS = 1;");

		console.log("\n✅ Database successfully purged.");
	} finally {
		await connection.end();
	}
};

main().catch((error) => {
	console.error("\n❌ Purge failed.\n");
	console.error(error);

	process.exit(1);
});
