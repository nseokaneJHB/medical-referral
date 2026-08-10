import mysql from "mysql2/promise";

import { env } from "../src/lib/env";

const main = async (): Promise<void> => {
	console.log("🗑️  Database Reset Script");
	console.log("============================\n");

	const connectionString = env.DATABASE_URL;

	if (!connectionString) {
		console.error("❌ DATABASE_URL not found in environment variables");
		process.exit(1);
	}

	console.log("⚠️  WARNING: This will delete all tables from your database!");
	console.log(
		`📍 Database: ${connectionString.split("@")[1]?.split("?")[0] || "Unknown"}\n`,
	);

	const connection = await mysql.createConnection(connectionString);

	try {
		console.log("\n🔍 Finding all tables...");

		const [rows] = await connection.query<mysql.RowDataPacket[]>(
			`SELECT table_name AS tableName
			 FROM information_schema.tables
			 WHERE table_schema = DATABASE()
			 ORDER BY table_name;`,
		);

		const tables = rows.map((row) => row.tableName as string);

		console.log(`📋 Found ${tables.length} tables:\n`);
		tables.forEach((table) => console.log(`   - ${table}`));

		if (tables.length > 0) {
			console.log("\n🗑️  Dropping all tables...");

			// Foreign keys between our own tables would otherwise block DROP in
			// dependency order — disable checks for the duration of the reset.
			await connection.query("SET FOREIGN_KEY_CHECKS = 0;");

			for (const table of tables) {
				await connection.query(`DROP TABLE IF EXISTS \`${table}\`;`);
				console.log(`   ✓ Dropped ${table}`);
			}

			await connection.query("SET FOREIGN_KEY_CHECKS = 1;");
		}

		console.log("\n✅ Database reset successfully!");
	} catch (error) {
		console.error("\n❌ Error resetting database:", error);
		process.exit(1);
	} finally {
		await connection.end();
	}
};

main().catch((error) => {
	console.error("\n❌ Reset failed.\n");
	console.error(error);

	process.exit(1);
});
