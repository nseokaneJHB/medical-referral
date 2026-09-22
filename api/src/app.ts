import closeWithGrace from "close-with-grace";

import { build } from "./build";

import { env } from "./lib/env";
import { logger } from "./lib/logger";
import { setShuttingDown } from "./lib/shutdown";

/** Builds the Fastify app, wires graceful shutdown, and starts listening. */
const start = async (): Promise<void> => {
	if (!logger) {
		throw new Error("Logger not initialized.");
	}

	const app = await build(logger);

	closeWithGrace({ delay: 500 }, async ({ signal, err: error }) => {
		app.log.error("Graceful shutdown started");
		setShuttingDown(true);
		app.log.error(
			"No longer accepting new requests, waiting for ongoing requests to finish...",
		);
		await app.closeDatabase();
		app.log.error("Database connections closed, shutting down server...");
		await app.close();

		app.log.error({ signal, error }, "Graceful shutdown complete");
	});

	try {
		await app.listen({ port: env.PORT, host: "0.0.0.0" });
		app.log.info(`🚀 Server is running on ${env.API_URL}\n`);
	} catch (error) {
		app.log.error(error, "Failed to start the server\n");
		process.exit(1);
	}
};

void start();
