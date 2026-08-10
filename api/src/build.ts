import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";

import type { ZodTypeProvider } from "fastify-type-provider-zod";

import { route } from "./route";
import { middlewares } from "./middleware";

import { generateUuid } from "./lib/util";

export const build = async (
	logger?: FastifyBaseLogger,
): Promise<FastifyInstance> => {
	const baseApp = Fastify({
		trustProxy: true,
		bodyLimit: 1048576,
		pluginTimeout: 30000,
		loggerInstance: logger,
		requestTimeout: 120000,
		exposeHeadRoutes: false,
		keepAliveTimeout: 120000,
		requestIdLogLabel: "reqId",
		disableRequestLogging: true,
		genReqId: () => generateUuid(),
		requestIdHeader: "x-request-id",
	});

	const app = baseApp.withTypeProvider<ZodTypeProvider>();

	app.log.info("App is loading...\n");

	await middlewares(app);

	app.log.info("Enabling routes...");
	await route(app);
	app.log.info("Routes enabled.\n");

	await app.ready();

	app.log.info("App is ready.\n");

	return app;
};
