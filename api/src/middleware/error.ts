import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

import { APIError } from "better-auth";

import { GlobalResponse, HTTP_RESPONSE_CODE } from "@referral-tracking/shared";

export const error = async (
	error: FastifyError,
	_request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	// Validation errors
	if (error.code === "FST_ERR_VALIDATION") {
		const { status, code } = HTTP_RESPONSE_CODE.VALIDATION_ERROR;
		const response: GlobalResponse = {
			code,
			message: "Validation error",
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			errors: (error as any).validation?.map((e: any) => ({
				field: e.instancePath?.split("/")[1] || "body",
				message: e.message,
			})),
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
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const mysqlError = ((error as any).cause ?? error) as {
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

	// Generic errors — log so I can mitigate later
	console.log(
		"\n================================= UNHANDLED ERRORS ===========================\n",
	);
	console.log("ERROR:", error);
	console.log("ERROR INSTANCE:", typeof error);
	console.log("ERROR NAME:", error.name);
	console.log("ERROR CODE:", error.code);
	console.log("ERROR MESSAGE:", error.message);
	console.log("ERROR VALIDATION:", error.validation);
	console.log("ERROR VALIDATION CONTEXT:", error.validationContext);

	const { status, code } = HTTP_RESPONSE_CODE.INTERNAL_SERVER_ERROR;
	const response: GlobalResponse = {
		code,
		message: "An internal server error occurred",
	};

	return reply.status(status).send(response);
};
