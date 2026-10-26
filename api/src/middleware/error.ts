import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

import { APIError } from "better-auth";

import { GlobalResponse, HTTP_RESPONSE_CODE } from "@referral-tracking/shared";

import { httpCodeForStatus } from "../lib/util";

export const error = async (
	error: FastifyError,
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	// Validation errors
	if (error.code === "FST_ERR_VALIDATION") {
		const { status, code } = HTTP_RESPONSE_CODE.VALIDATION_ERROR;
		const response: GlobalResponse = {
			code,
			message: "Validation error",
			errors: request.validationError?.validation?.map(
				(e: { instancePath?: string; message?: string }) => ({
					field: e.instancePath?.split("/")[1] || "body",
					message: e.message,
				}),
			),
		};

		return reply.status(status).send(response);
	}

	// Errors explicitly marked as client-side (e.g. invalid query params)
	if (!(error instanceof APIError) && error.statusCode === 400) {
		const { status, code } = HTTP_RESPONSE_CODE.BAD_REQUEST;
		const response: GlobalResponse = {
			code,
			message: error.message,
		};

		return reply.status(status).send(response);
	}

	if (error instanceof APIError) {
		if (error.statusCode === 400) {
			const { status, code } = HTTP_RESPONSE_CODE.BAD_REQUEST;

			const response: GlobalResponse = {
				code,
				message: error.message,
			};

			return reply.status(status).send(response);
		}
	}

	// MySQL driver errors (thrown directly by mysql2, or wrapped in
	// Drizzle's own error type with the original as `.cause`).
	const mysqlError = (error.cause ?? error) as {
		code?: string;
		sqlMessage?: string;
	};

	if (mysqlError.code === "ER_DUP_ENTRY") {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		const response: GlobalResponse = {
			code,
			message: "A record with this information already exists.",
		};
		return reply.status(status).send(response);
	}

	if (
		mysqlError.code === "ER_ROW_IS_REFERENCED_2" ||
		mysqlError.code === "ER_ROW_IS_REFERENCED"
	) {
		const { status, code } = HTTP_RESPONSE_CODE.CONFLICT;
		const response: GlobalResponse = {
			code,
			message:
				"This record can't be deleted because other records still reference it.",
		};
		return reply.status(status).send(response);
	}

	if (mysqlError.code === "ER_NO_REFERENCED_ROW_2") {
		const { status, code } = HTTP_RESPONSE_CODE.BAD_REQUEST;
		const response: GlobalResponse = {
			code,
			message: "This request references a record that doesn't exist.",
		};
		return reply.status(status).send(response);
	}

	if (
		typeof error.statusCode === "number" &&
		error.statusCode >= 400 &&
		error.statusCode < 500
	) {
		const response: GlobalResponse = {
			code: httpCodeForStatus(error.statusCode),
			message: error.message,
		};

		return reply.status(error.statusCode).send(response);
	}

	request.log.error({ error }, "Unhandled error");

	const { status, code } = HTTP_RESPONSE_CODE.INTERNAL_SERVER_ERROR;
	const response: GlobalResponse = {
		code,
		message: "An internal server error occurred",
	};

	return reply.status(status).send(response);
};
