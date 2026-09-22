import axios from "axios";

import { AxiosError } from "axios";

import { getRequest } from "@tanstack/react-start/server";

import { GlobalResponse } from "@referral-tracking/shared";

import { env } from "@/lib/env";

/** Forwards the incoming request's session cookie (plus any caller-supplied headers) onto a server-side `api` call — needed since axios on the server has no browser cookie jar of its own. */
export const forwardedRequestOptions = (
	extraHeaders?: Record<string, string>,
) => {
	const request = getRequest();
	const cookie = request.headers.get("cookie");
	const headers = { ...(cookie ? { cookie } : {}), ...extraHeaders };

	return Object.keys(headers).length > 0 ? { headers } : {};
};

export const CLIENT_ERROR = {
	ECONNREFUSED: "ECONNREFUSED",
	NETWORK_ERROR: "NETWORK_ERROR",
	UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

type ClientErrorCode = keyof typeof CLIENT_ERROR;

// Combined type for all possible error responses
export interface ApiErrorResponse extends Omit<GlobalResponse, "code"> {
	status: number;
	errors?: GlobalResponse["errors"];
	redirectUrl?: GlobalResponse["redirectUrl"];
	code: GlobalResponse["code"] | ClientErrorCode | string;
}

// Custom error class that extends the ApiErrorResponse type
export class ApiError extends Error {
	public code: ApiErrorResponse["code"];
	public status: ApiErrorResponse["status"];
	public errors: ApiErrorResponse["errors"];
	public redirectUrl: ApiErrorResponse["redirectUrl"];

	constructor(response: ApiErrorResponse, status: number) {
		super(response.message);
		this.status = status;
		this.code = response.code;

		if (response.errors) this.errors = response.errors;
		if (response.redirectUrl) this.redirectUrl = response.redirectUrl;
	}

	normalize = (): ApiErrorResponse => {
		const { message, status, code, errors, redirectUrl } = this;
		const result: Record<string, unknown> = { status, code, message };

		if (redirectUrl) result.redirectUrl = redirectUrl;
		if (errors) result.errors = errors;

		return result as unknown as ApiErrorResponse;
	};
}

export const isApiErrorResponse = (
	error: unknown,
): error is ApiErrorResponse => {
	return (
		error !== null &&
		typeof error === "object" &&
		"message" in error &&
		"code" in error
	);
};

export const toRouterError = (
	err: Record<string, unknown>,
): ApiErrorResponse => {
	const error: Record<string, unknown> = err;

	if (typeof err.status === "number") {
		error.status = err.status;
	}
	if (typeof err.code === "string") {
		error.code = err.code;
	}
	if (typeof err.message === "string") {
		error.message = err.message;
	}
	if (typeof err.redirectUrl === "string" && err.redirectUrl !== undefined) {
		error.redirectUrl = err.redirectUrl;
	}
	if (err.errors && err.errors !== undefined && Array.isArray(err.errors)) {
		error.errors = err.errors as ApiErrorResponse["errors"];
	}

	return error as unknown as ApiErrorResponse;
};

// Detect environment at runtime
const isServer = typeof window === "undefined";

// Select URL based on environment
// Server uses internal Docker URL, Client uses localhost
const baseURL = isServer ? env.SERVER_API_URL : env.VITE_API_URL;

const api = axios.create({
	baseURL,
	withCredentials: !isServer,
	headers: {
		"Content-Type": "application/json",
	},
});

api.interceptors.response.use(
	(response) => response,
	(error: AxiosError<unknown>): Promise<AxiosError> => {
		if (isApiErrorResponse(error?.response?.data)) {
			const errorPayload = {
				...error.response.data,
				status: error.response.status,
			};

			const response = toRouterError(errorPayload);

			const apiError = new ApiError(response, errorPayload.status);

			return Promise.reject(apiError.normalize());
		}

		if (isApiErrorResponse(error.request.data)) {
			const errorPayload = {
				...error.request.data,
				status: error.request.status,
				code: error.request.code || CLIENT_ERROR.NETWORK_ERROR,
				message:
					error.request.message ||
					"The service is temporarily unavailable. Please try again later.",
			};

			const response = toRouterError(errorPayload);

			const apiError = new ApiError(response, errorPayload.status);

			return Promise.reject(apiError.normalize());
		}

		const errorPayload = {
			...error,
			status: error.status || 0,
			code: error.code || CLIENT_ERROR.UNKNOWN_ERROR,
			message: error.message || "An unexpected error occurred",
		};

		const response = toRouterError(errorPayload);

		const apiError = new ApiError(response, errorPayload.status);

		return Promise.reject(apiError.normalize());
	},
);

export { api };
