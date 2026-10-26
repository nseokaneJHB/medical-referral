import type { FastifyInstance } from "fastify";

import {
	validatorCompiler,
	serializerCompiler,
} from "fastify-type-provider-zod";

import { error } from "./error";
import { event } from "./event";
import { authorize } from "./authorize";
import { authenticate } from "./authenticate";
import { onRequestTimerHook, onResponseLoggingHook } from "./logging";

import { env } from "../lib/env";
import { connection, close } from "../lib/database";

/** Registers every Fastify plugin, decoration, and hook the app needs, in dependency order. */
export const middlewares = async (app: FastifyInstance): Promise<void> => {
	app.log.info("Enabling plugins...");
	app.log.info("Loading helmet...");
	await app.register(import("@fastify/helmet"), {
		contentSecurityPolicy: {
			directives: {
				scriptSrc: ["'self'"],
				defaultSrc: ["'self'"],
				connectSrc: ["'self'"],
				imgSrc: ["'self'", "data:", "https:"],
				styleSrc: ["'self'", "'unsafe-inline'"],
			},
		},
	});

	app.log.info("Loading cors...");
	await app.register(import("@fastify/cors"), {
		credentials: true,
		origin: env.CORS_ORIGIN,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
	});

	app.log.info("Loading rate limit...");
	await app.register(import("@fastify/rate-limit"), {
		global: true,
		skipOnError: false,
		enableDraftSpec: false,
		max: env.RATE_LIMIT_MAX,
		timeWindow: env.RATE_LIMIT_WINDOW,
	});

	const isProduction = env.NODE_ENV === "production";

	await app.register(import("@fastify/cookie"), {
		secret: env.COOKIE_SECRET,
		parseOptions: {
			path: `/`,
			httpOnly: true,
			secure: isProduction,
			sameSite: isProduction ? "strict" : "lax",
		},
	});

	app.log.info("Enabling middlewares...");
	app.log.info("Loading error handler...");
	app.setErrorHandler(error);

	app.log.info("Loading zod validation...");
	app.setValidatorCompiler(validatorCompiler);

	app.log.info("Loading zod serializer...");
	app.setSerializerCompiler(serializerCompiler);

	app.log.info("Plugins Enabled.\n");

	app.log.info("Loading event...");
	app.decorate("event", event);

	app.addHook("onRequest", onRequestTimerHook);

	app.log.info("Loading database...");
	app.decorate("database", connection);
	app.decorate("closeDatabase", close);

	app.log.info("Loading authenticate...");
	app.decorate("authenticate", authenticate);

	app.log.info("Loading authorize...");
	app.decorate("authorize", authorize);

	app.addHook("onResponse", onResponseLoggingHook);

	app.log.info("Middlewares Enabled.\n");

	return;
};
