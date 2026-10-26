import type { FastifyRequest, FastifyReply } from "fastify";

import { API_PATHS } from "@referral-tracking/shared";

const correlationName = "X-Correlation-Id";

/** Header must be set here, not in onResponse — that hook fires after the response is already sent. */
export const onRequestTimerHook = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	request.correlationId = request.id;
	request.startTime = process.hrtime.bigint();
	reply.header(correlationName, request.correlationId);
};

/**
 * Self-contained response logger optimized for Fastify v5 and Docker routing.
 * Automatically tracks processing latency in milliseconds.
 */
export const onResponseLoggingHook = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	const ignoredRoutes = [`/k8${API_PATHS.LIVEZ}`, `/k8${API_PATHS.READYZ}`]; // Exclude health check endpoints from logging

	if (ignoredRoutes.includes(request.url)) {
		return;
	}
	const correlationId = request.correlationId;

	const { statusCode } = reply;

	// 2. Calculate processing duration in milliseconds using nanosecond bigints
	let durationMs = 0;
	if (request.startTime) {
		const endTime = process.hrtime.bigint();
		durationMs = Number(endTime - request.startTime) / 1e6;
	}

	// 3. Resolve log level priority based on standard HTTP status categories
	let logLevel: "info" | "warn" | "error" = "info";
	if (statusCode >= 400 && statusCode < 500) {
		logLevel = "warn";
	} else if (statusCode >= 500) {
		logLevel = "error";
	}

	// 4. Extract request metadata safely for Docker/Cloud proxies
	const userAgent = request.headers["user-agent"] || "unknown";
	const rawForwardedFor = request.headers["x-forwarded-for"];
	const clientIp =
		typeof rawForwardedFor === "string"
			? rawForwardedFor.split(",")[0].trim()
			: request.ip || "unknown";

	const matchedRoute = request.routeOptions.url || "unknown";

	// 5. Trigger the structural log via Fastify's contextual logger instance
	request.log[logLevel](
		{
			userAgent,
			ip: clientIp,
			timestamp: new Date().toISOString(),
			data: {
				url: request.url,
				route: matchedRoute,
				method: request.method,
				statusCode,
				correlationId,
				eventName: request.eventName || "unknown",
				durationMs: Number(durationMs.toFixed(2)),
			},
		},
		`HTTP ${request.method} ${matchedRoute} responded with status ${statusCode} in ${durationMs.toFixed(2)}ms`,
	);
};
