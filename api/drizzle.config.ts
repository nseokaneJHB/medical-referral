import { defineConfig } from "drizzle-kit";

import { env } from "./src/lib/env";

export default defineConfig({
	dialect: "mysql",
	out: "./src/drizzle/migrations",
	schema: "./src/drizzle/schema",
	strict: true, // Will add security question for changes
	verbose: true, // Tells me what changes are going to be made on the db
	dbCredentials: {
		url: env.DATABASE_URL,
	},
});
