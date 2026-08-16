/// <reference types="vite/client" />
import type { PropsWithChildren } from "react";

import {
	Outlet,
	Scripts,
	HeadContent,
	createRootRouteWithContext,
} from "@tanstack/react-router";

import type { QueryClient } from "@tanstack/react-query";

import appCss from "../style.css?url";

import { APP_NAME } from "@referral-tracking/shared";

import { Toaster } from "@/components/ui/sonner";

import { RootProviders } from "@/integrations/root-provider";
import { TanStackQueryDevtools } from "@/integrations/tanstack-dev-tools";

import { QUERY_KEYS } from "@/api/constant";
import { sessionRequest, type AuthUser } from "@/api/auth";

export interface RouterContext {
	queryClient: QueryClient;
	user: AuthUser | null;
}

const themeInitScript = `(function(){try{var t=localStorage.getItem("vite-ui-theme");if(t==="light"||t==="dark"){document.documentElement.classList.remove("light","dark");document.documentElement.classList.add(t);}}catch(e){}})();`;

const RootDocument = ({ children }: PropsWithChildren) => {
	return (
		<html lang="en" className="dark" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
				<HeadContent />
			</head>
			<body suppressHydrationWarning>
				<RootProviders>
					{children}
					<Toaster />
					<TanStackQueryDevtools />
				</RootProviders>
				<Scripts />
			</body>
		</html>
	);
};

const RootComponent = () => {
	return (
		<RootDocument>
			<Outlet />
		</RootDocument>
	);
};

export const Route = createRootRouteWithContext<RouterContext>()({
	component: RootComponent,
	head: () => ({
		links: [{ rel: "stylesheet", href: appCss }],
		meta: [
			{ charSet: "utf-8" },
			{ title: APP_NAME },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
		],
	}),
	beforeLoad: async ({ context }) => {
		try {
			const response = await context.queryClient.ensureQueryData({
				queryKey: QUERY_KEYS.ME,
				queryFn: sessionRequest,
			});

			return { user: response.user };
		} catch (error: unknown) {
			console.error("__ROOT ERROR:", error);

			return { user: null };
		}
	},
});
