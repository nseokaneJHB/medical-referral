import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { FRONTEND_URLS } from "@referral-tracking/shared";

import { Navigation } from "@/components/navigation";

const PublicLayout = () => {
	return (
		<div className="flex flex-1 grow flex-col overflow-hidden">
			<Navigation />
			<main className="flex w-full flex-1 grow items-center-safe justify-center overflow-y-auto p-4">
				<Outlet />
			</main>
		</div>
	);
};

export const Route = createFileRoute("/_public")({
	component: PublicLayout,
	beforeLoad: ({ context }) => {
		if (context.user) throw redirect({ to: FRONTEND_URLS.HOME });
	},
});
