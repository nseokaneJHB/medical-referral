import { z } from "zod";

import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import {
	LOGIN_STATUS,
	FRONTEND_URLS,
	getRelativeTime,
	stringToTitleCase,
	DEFAULT_PAGE_LIMIT,
	DEFAULT_PAGE_NUMBER,
} from "@referral-tracking/shared";

import { isAdministrator } from "@/lib/permissions";

import { Card, CardTitle, CardHeader, CardContent } from "@/components/ui/card";
import {
	Table,
	TableRow,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Loader } from "@/components/custom/loader";

import { QUERY_KEYS } from "@/api/constant";
import { loginsRequest } from "@/api/audit";

const searchSchema = z.object({
	page: z.string().default(`${DEFAULT_PAGE_NUMBER}`),
	limit: z.string().default(`${DEFAULT_PAGE_LIMIT}`),
});

const STATUS_VARIANT: Record<string, "success" | "error" | "warning"> = {
	[LOGIN_STATUS.SUCCESS]: "success",
	[LOGIN_STATUS.FAILED]: "error",
	[LOGIN_STATUS.LOCKED_OUT]: "warning",
};

const AuditPage = () => {
	const navigate = useNavigate({ from: Route.fullPath });

	const search = Route.useSearch();
	const response = Route.useLoaderData();

	const page = Number(search.page);
	const limit = Number(search.limit);
	const totalPages = Math.max(1, Math.ceil(response.total / limit));

	return (
		<div className="space-y-4">
			<Card className="border-0 bg-transparent px-0 py-1 shadow-none">
				<CardHeader className="px-0 py-1">
					<CardTitle className="text-2xl">Login audit</CardTitle>
				</CardHeader>
			</Card>

			<Card>
				<CardContent className="px-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>User</TableHead>
								<TableHead>Email</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Reason</TableHead>
								<TableHead>Login</TableHead>
								<TableHead>Logout</TableHead>
								<TableHead>IP</TableHead>
								<TableHead>Device</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{response.data.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={8}
										className="text-muted-foreground text-center"
									>
										No login activity found.
									</TableCell>
								</TableRow>
							)}
							{response.data.map((entry) => (
								<TableRow key={entry.id}>
									<TableCell className="max-w-40 truncate">
										{entry.user_id}
									</TableCell>
									<TableCell className="max-w-60 truncate">
										{entry.user?.email ?? "—"}
									</TableCell>
									<TableCell>
										<Badge variant={STATUS_VARIANT[entry.status]}>
											{stringToTitleCase(entry.status)}
										</Badge>
									</TableCell>
									<TableCell className="max-w-60 truncate">
										{entry.reason ?? "—"}
									</TableCell>
									<TableCell>
										{getRelativeTime(entry.login_at as unknown as string)}
									</TableCell>
									<TableCell>
										{entry.logout_at
											? getRelativeTime(entry.logout_at as unknown as string)
											: "—"}
									</TableCell>
									<TableCell>{entry.ip ?? "—"}</TableCell>
									<TableCell className="max-w-60 truncate">
										{entry.device ?? "—"}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<div className="flex items-center justify-between">
				<small className="text-muted-foreground">
					Page {page} of {totalPages} &middot; {response.total} total
				</small>
				<div className="flex gap-2">
					<Button
						variant="outline"
						title="Previous page"
						disabled={page <= 1}
						onClick={() =>
							navigate({
								search: (prev) => ({ ...prev, page: String(page - 1) }),
							})
						}
					>
						<ChevronLeftIcon />
					</Button>
					<Button
						variant="outline"
						title="Next page"
						disabled={page >= totalPages}
						onClick={() =>
							navigate({
								search: (prev) => ({ ...prev, page: String(page + 1) }),
							})
						}
					>
						<ChevronRightIcon />
					</Button>
				</div>
			</div>
		</div>
	);
};

export const Route = createFileRoute("/_authenticated/audit/")({
	component: AuditPage,
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => search,
	beforeLoad: ({ context }) => {
		if (!isAdministrator(context.user)) {
			throw redirect({ to: FRONTEND_URLS.HOME });
		}
	},
	loader: async ({ context, deps }) => {
		const response = await context.queryClient.ensureQueryData({
			queryKey: [...QUERY_KEYS.AUDIT_LOGINS, deps],
			queryFn: () => loginsRequest({ data: deps }),
		});

		return response;
	},
	pendingComponent: () => (
		<div className="flex h-64 items-center justify-center">
			<Loader text="Loading login audit..." size="md" />
		</div>
	),
});
