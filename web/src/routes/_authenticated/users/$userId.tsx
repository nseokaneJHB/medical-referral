import { createFileRoute, redirect } from "@tanstack/react-router";

import { CheckCircleIcon, ClipboardListIcon, PercentIcon } from "lucide-react";

import {
	USER_STATUS,
	FRONTEND_URLS,
	stringToTitleCase,
} from "@referral-tracking/shared";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { BackLink } from "@/components/custom/back-link";
import { StatCard } from "@/components/custom/stat-card";
import { ReadOnlyField } from "@/components/custom/read-only-field";

import { isDoctor, canManageUsers } from "@/lib/permissions";

import { QUERY_KEYS } from "@/api/constant";
import { userRequest } from "@/api/users";

const UserDetailPage = () => {
	const response = Route.useLoaderData();
	const user = response.data;

	return (
		<div className="space-y-4">
			<BackLink label="Back to users" fallbackTo={FRONTEND_URLS.USERS} />

			<Card>
				<CardHeader className="flex items-center justify-between">
					<CardTitle className="text-xl">{user.name ?? user.email}</CardTitle>
					<Badge
						variant={user.status === USER_STATUS.ACTIVE ? "success" : "error"}
					>
						{stringToTitleCase(user.status)}
					</Badge>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<ReadOnlyField label="Name" value={user.name} />
						<ReadOnlyField label="Email" value={user.email} />
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<ReadOnlyField label="Role" value={stringToTitleCase(user.role)} />
						<ReadOnlyField label="Facility" value={user.facility?.name} />
					</div>

					<ReadOnlyField
						label="Joined"
						value={new Date(user.created_at).toLocaleDateString()}
					/>
				</CardContent>
			</Card>

			{isDoctor(user) && user.stats && (
				<div className="grid gap-4 sm:grid-cols-3">
					<StatCard
						icon={ClipboardListIcon}
						label="Referrals handled"
						value={String(user.stats.total_referrals)}
					/>
					<StatCard
						icon={CheckCircleIcon}
						label="Completed"
						value={String(user.stats.completed_referrals)}
					/>
					<StatCard
						icon={PercentIcon}
						label="Completion rate"
						value={`${Math.round(user.stats.completion_rate * 100)}%`}
					/>
				</div>
			)}
		</div>
	);
};

export const Route = createFileRoute("/_authenticated/users/$userId")({
	component: UserDetailPage,
	beforeLoad: ({ context }) => {
		if (!canManageUsers(context.user)) {
			throw redirect({ to: FRONTEND_URLS.HOME });
		}
	},
	loader: async ({ context, params }) => {
		const response = await context.queryClient.ensureQueryData({
			queryKey: [...QUERY_KEYS.USER, params.userId],
			queryFn: () => userRequest({ data: { id: params.userId } }),
		});

		return response;
	},
});
