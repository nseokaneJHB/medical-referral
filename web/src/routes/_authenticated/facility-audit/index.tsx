import { useState } from "react";

import { z } from "zod";

import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import {
	ROLES,
	FRONTEND_URLS,
	formatDate,
	getRelativeTime,
	stringToTitleCase,
	DEFAULT_PAGE_LIMIT,
	DEFAULT_PAGE_NUMBER,
	type ManagerAudit,
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
import {
	Dialog,
	DialogTitle,
	DialogHeader,
	DialogContent,
	DialogDescription,
} from "@/components/ui/dialog";

import { Loader } from "@/components/custom/loader";
import { ReadOnlyField } from "@/components/custom/read-only-field";

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

const ROLE_VARIANT: Record<
	string,
	"info" | "secondary" | "outline" | "suspended"
> = {
	[ROLES.NURSE]: "info",
	[ROLES.DOCTOR]: "outline",
	[ROLES.MANAGER]: "suspended",
	[ROLES.ADMINISTRATOR]: "secondary",
};

/**
 * A person's name, plus (when known) their role badge, plus a "You" tag
 * when the row is about the viewer themselves — disambiguates who's who on
 * rows where both the Subject and the "Performed by" actor are people.
 */
const PersonCell = ({
	name,
	role,
	isSelf,
}: {
	name: string | null;
	role?: string | null;
	isSelf: boolean;
}) => (
	<div className="flex items-center gap-1.5">
		<span className="truncate">{name ?? "—"}</span>
		{role && (
			<Badge variant={ROLE_VARIANT[role]} className="shrink-0">
				{stringToTitleCase(role)}
			</Badge>
		)}
		{isSelf && (
			<Badge variant="outline" className="shrink-0">
				You
			</Badge>
		)}
	</div>
);

/** Full, untruncated audit entry details — the table's cells are clipped for layout. */
const AuditDetailsDialog = ({
	entry,
	viewerId,
	open,
	onOpenChange,
}: {
	entry: ManagerAudit | null;
	viewerId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) => {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{entry && (
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Audit entry details</DialogTitle>
						<DialogDescription>
							{formatDate(entry.changed_at as unknown as string, {
								includeTime: true,
							})}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<ReadOnlyField
								label="Type"
								value={
									<Badge variant={TYPE_VARIANT[entry.type]}>
										{stringToTitleCase(entry.type)}
									</Badge>
								}
							/>
							<ReadOnlyField
								label="Action"
								value={stringToTitleCase(entry.action)}
							/>
						</div>
						<ReadOnlyField
							label="Subject"
							value={
								<PersonCell
									name={entry.subject.name}
									role={entry.subject.role}
									isSelf={entry.subject.id === viewerId}
								/>
							}
						/>
						<ReadOnlyField
							label="Performed by"
							value={
								<PersonCell
									name={entry.changer.name}
									isSelf={entry.changer.id === viewerId}
								/>
							}
						/>
						<div className="flex w-full flex-col gap-1">
							<span className="text-sm font-medium">Change</span>
							<p className="text-foreground rounded-md border bg-transparent p-3 text-sm whitespace-pre-wrap">
								{entry.previous && entry.next
									? `${stringToTitleCase(entry.previous)} → ${stringToTitleCase(entry.next)}`
									: "No value change recorded."}
							</p>
						</div>
						<div className="flex w-full flex-col gap-1">
							<span className="text-sm font-medium">Notes</span>
							<p className="text-foreground rounded-md border bg-transparent p-3 text-sm whitespace-pre-wrap">
								{entry.notes ?? "No notes."}
							</p>
						</div>
					</div>
				</DialogContent>
			)}
		</Dialog>
	);
};

const FacilityAuditPage = () => {
	const navigate = useNavigate({ from: Route.fullPath });

	const { user } = Route.useRouteContext();
	const search = Route.useSearch();
	const response = Route.useLoaderData();

	const [viewing, setViewing] = useState<ManagerAudit | null>(null);

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
								<TableHead>Performed by</TableHead>
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
								<TableRow
									key={entry.id}
									className="cursor-pointer"
									onClick={() => setViewing(entry)}
								>
									<TableCell>
										<Badge variant={TYPE_VARIANT[entry.type]}>
											{stringToTitleCase(entry.type)}
										</Badge>
									</TableCell>
									<TableCell className="max-w-56 truncate">
										<PersonCell
											name={entry.subject.name}
											role={entry.subject.role}
											isSelf={entry.subject.id === user.id}
										/>
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
									<TableCell className="max-w-48 truncate">
										<PersonCell
											name={entry.changer.name}
											isSelf={entry.changer.id === user.id}
										/>
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

			<AuditDetailsDialog
				entry={viewing}
				viewerId={user.id}
				open={viewing !== null}
				onOpenChange={(open) => {
					if (!open) setViewing(null);
				}}
			/>
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
