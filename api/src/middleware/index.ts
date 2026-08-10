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

import { CoreService } from "../core";

import { env } from "../lib/env";
import { auth } from "../lib/auth";
import { connection, close } from "../lib/database";

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
			httpOnly: true, // Cannot be accessed by JavaScript
			secure: isProduction, // HTTPS only in production
			sameSite: isProduction ? "strict" : "lax", // CSRF protection
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

	app.addHook("onRequest", onRequestTimerHook); // ⏱️ Start the clock

	app.log.info("Loading core...");
	const core = {
		close,
		connection,
		...new CoreService(connection, auth),
	};
	app.decorate("core", core);

	app.log.info("Loading authenticate...");
	app.decorate("authenticate", authenticate);

	app.log.info("Loading authorize...");
	app.decorate("authorize", authorize);

	// Register the metrics engine lifecycle tracking hooks
	app.addHook("onResponse", onResponseLoggingHook); // 📊 Stop the clock and log details

	app.log.info("Middlewares Enabled.\n");

	return;
};
