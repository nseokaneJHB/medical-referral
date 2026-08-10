import { createRouter } from "@tanstack/react-router";

import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { routeTree } from "@/routeTree.gen";

import { Error } from "@/components/error";
import { NotFound } from "@/components/not-found";

import { createQueryClient } from "@/integrations/query-provider";

/**
 * Every search param this app uses (page, limit, sort, order, status,
 * priority, role, search, from, to) is a plain string by design — comma-
 * joined lists instead of real arrays. The router's default JSON-based
 * search serialization re-quotes any numeric- or boolean-looking string
 * (e.g. `page: "1"`) to preserve its type through the URL, which produces
 * ugly URLs like `?page=%221%22`. A plain `URLSearchParams` round-trip
 * avoids that entirely since nothing here ever needs to be a number.
 */
const parseSearch = (searchStr: string): Record<string, string> => {
	const params = new URLSearchParams(
		searchStr[0] === "?" ? searchStr.slice(1) : searchStr,
	);

	const result: Record<string, string> = {};
	for (const [key, value] of params.entries()) result[key] = value;

	return result;
};

const stringifySearch = (search: Record<string, unknown>): string => {
	const params = new URLSearchParams();

	for (const key in search) {
		const value = search[key];
		if (value !== undefined) params.set(key, String(value));
	}

	const searchStr = params.toString();
	return searchStr ? `?${searchStr}` : "";
};

export const getRouter = () => {
	const queryClient = createQueryClient();

	const router = createRouter({
		routeTree,
		parseSearch,
		stringifySearch,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		defaultErrorComponent: Error,
		defaultNotFoundComponent: NotFound,
		context: { queryClient, user: null },
	});

	setupRouterSsrQueryIntegration({ router, queryClient });

	return router;
};
