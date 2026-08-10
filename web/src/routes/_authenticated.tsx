import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { USER_STATUS, FRONTEND_URLS } from "@referral-tracking/shared";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { SideBar } from "@/components/custom/side-bar";

const AuthenticatedLayout = () => {
	return (
		<SidebarProvider className="h-svh">
			<SideBar />
			<SidebarInset className="flex flex-col overflow-hidden">
				<main className="flex-1 overflow-y-auto p-4">
					<Outlet />
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
};

export const Route = createFileRoute("/_authenticated")({
	component: AuthenticatedLayout,
	beforeLoad: ({ context }) => {
		const { user } = context;

		if (!user) {
			throw redirect({ to: FRONTEND_URLS.SIGN_IN });
		}

		if (user.status !== USER_STATUS.ACTIVE) {
			throw redirect({ to: "/account-status" });
		}

		return { user };
	},
});
