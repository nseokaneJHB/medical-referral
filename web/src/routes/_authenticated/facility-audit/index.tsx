import { z } from "zod";

import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import {
	FRONTEND_URLS,
	getRelativeTime,
	stringToTitleCase,
	DEFAULT_PAGE_LIMIT,
	DEFAULT_PAGE_NUMBER,
} from "@referral-tracking/shared";

import { isManager } from "@/lib/permissions";

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
import { managerAuditRequest } from "@/api/audit";

const searchSchema = z.object({
	page: z.string().default(`${DEFAULT_PAGE_NUMBER}`),
	limit: z.string().default(`${DEFAULT_PAGE_LIMIT}`),
});

const TYPE_VARIANT: Record<
	string,
	"info" | "suspended" | "outline" | "secondary"
> = {
	USER: "info",
	FACILITY: "suspended",
	REFERRAL: "outline",
	PATIENT: "secondary",
};

const FacilityAuditPage = () => {
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
					<CardTitle className="text-2xl">Facility audit</CardTitle>
				</CardHeader>
			</Card>

			<Card>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Type</TableHead>
								<TableHead>Subject</TableHead>
								<TableHead>Action</TableHead>
								<TableHead>Change</TableHead>
								<TableHead>Notes</TableHead>
								<TableHead>By</TableHead>
								<TableHead>When</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{response.data.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={7}
										className="text-muted-foreground text-center"
									>
										No activity recorded yet.
									</TableCell>
								</TableRow>
							)}
							{response.data.map((entry) => (
								<TableRow key={entry.id}>
									<TableCell>
										<Badge variant={TYPE_VARIANT[entry.type]}>
											{stringToTitleCase(entry.type)}
										</Badge>
									</TableCell>
									<TableCell className="max-w-48 truncate">
										{entry.subject.name ?? "—"}
									</TableCell>
									<TableCell>{stringToTitleCase(entry.action)}</TableCell>
									<TableCell className="max-w-48 truncate">
										{entry.previous && entry.next
											? `${stringToTitleCase(entry.previous)} → ${stringToTitleCase(entry.next)}`
											: "—"}
									</TableCell>
									<TableCell className="max-w-60 truncate">
										{entry.notes ?? "—"}
									</TableCell>
									<TableCell className="max-w-40 truncate">
										{entry.changer.name ?? "System"}
									</TableCell>
									<TableCell>
										{getRelativeTime(entry.changed_at as unknown as string)}
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

export const Route = createFileRoute("/_authenticated/facility-audit/")({
	component: FacilityAuditPage,
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => search,
	beforeLoad: ({ context }) => {
		if (!isManager(context.user)) {
			throw redirect({ to: FRONTEND_URLS.HOME });
		}
	},
	loader: async ({ context, deps }) => {
		const response = await context.queryClient.ensureQueryData({
			queryKey: [...QUERY_KEYS.FACILITY_AUDIT, deps],
			queryFn: () => managerAuditRequest({ data: deps }),
		});

		return response;
	},
	pendingComponent: () => (
		<div className="flex h-64 items-center justify-center">
			<Loader text="Loading facility audit..." size="md" />
		</div>
	),
});
