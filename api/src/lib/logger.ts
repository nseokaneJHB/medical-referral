import type { FastifyLoggerOptions } from "fastify";

import pino from "pino";

import { env } from "./env";
import { LEVELS } from "./constant";

/**
 * Extracted union type of all allowed custom logging levels.
 * Ensures strict compilation safety when triggering logger methods.
 */
export type CustomLevels = keyof typeof LEVELS;

/**
 * Safely parses logged data blocks to avoid uncaught string parsing runtime crashes.
 */
const safeParseJson = (value: unknown): unknown => {
	if (typeof value !== "string") return value;
	try {
		return JSON.parse(value);
	} catch {
		return value; // Fall back safely to raw string if it is not valid JSON
	}
};

const getFormattedLog = (
	object: Record<string, unknown>,
): Record<string, unknown> => {
	const { data, error } = object;

	return {
		...object,
		userAgent: object.userAgent,
		correlationId: object.correlationId,
		data: data ? safeParseJson(data) : data,
		error: error ? safeParseJson(error) : error,
	};
};

type LoggerConfig = Record<
	"development" | "test" | "production",
	pino.LoggerOptions<CustomLevels> & FastifyLoggerOptions
>;

const formatters = {
	level: (label: string) => ({ level: label }),
	log: (object: Record<string, unknown>) =>
		object ? getFormattedLog(object) : object,
};

const loggerConfig: LoggerConfig = {
	development: {
		formatters,
		customLevels: LEVELS,
		level: env.LOG_LEVEL,
		timestamp: pino.stdTimeFunctions.isoTime,
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true,
				timestampKey: "time",
				translateTime: "SYS:HH:MM:ss",
			},
		},
	},
	test: {
		formatters,
		customLevels: LEVELS,
		level: env.LOG_LEVEL,
		timestamp: pino.stdTimeFunctions.isoTime,
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true,
				translateTime: "SYS:HH:MM:ss",
			},
		},
	},
	production: {
		formatters,
		customLevels: LEVELS,
		level: env.LOG_LEVEL,
		timestamp: pino.stdTimeFunctions.isoTime, // Faster, native standardized production ISO strings
	},
};

// Select configuration based on current runtime environment
const configLogger = loggerConfig[env.NODE_ENV] || loggerConfig.production;

export const config = configLogger;

// Instantiate the clean global application logger
export const logger = pino<CustomLevels>(config);
