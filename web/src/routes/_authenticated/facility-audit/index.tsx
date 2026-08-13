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
	type TimelineAction,
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
 * Natural-language verb phrase per action, so a row reads as a sentence
 * ("{actor} {verb} {subject}") instead of a raw enum value — e.g.
 * `STATUS_CHANGE` alone doesn't say who did what to what, "changed the
 * status of" does.
 */
const ACTION_VERB: Record<TimelineAction, string> = {
	STATUS_CHANGE: "changed the status of",
	DOCTOR_ASSIGNED: "assigned a doctor to",
	REDIRECTED: "redirected",
	TRANSFER_REQUESTED: "requested a transfer for",
	TRANSFER_APPROVED_ORIGIN: "approved the origin side of the transfer for",
	TRANSFER_APPROVED_DESTINATION:
		"approved the destination side of the transfer for",
	TRANSFER_REJECTED: "rejected the transfer for",
	APPROVED: "approved",
	REJECTED: "rejected",
	DISABLED: "disabled",
	FLAGGED: "flagged",
	UNFLAGGED: "unflagged",
	SUSPENDED: "suspended",
	DEPARTED: "recorded the departure of",
	APPEAL_SUBMITTED: "submitted an appeal for",
	APPEAL_APPROVED: "approved the appeal for",
	APPEAL_DENIED: "denied the appeal for",
};

/**
 * A person's name, plus (when known) their role badge, plus a "You" tag
 * when the row is about the viewer themselves — disambiguates who's who on
 * rows where both the actor and the subject are people.
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
	<span className="inline-flex flex-wrap items-center gap-1.5">
		<span className="font-medium">{name ?? "—"}</span>
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
	</span>
);

/**
 * The "who did what to whom, and what was the verdict" sentence shared by
 * the table row and the details dialog — one place computing it keeps both
 * views consistent.
 */
const AuditSentence = ({
	entry,
	viewerId,
}: {
	entry: ManagerAudit;
	viewerId: string;
}) => {
	const verb = ACTION_VERB[entry.action] ?? stringToTitleCase(entry.action);

	return (
		<span className="inline-flex flex-wrap items-center gap-1.5">
			<PersonCell
				name={entry.changer.name}
				isSelf={entry.changer.id === viewerId}
			/>
			<span className="text-muted-foreground">{verb}</span>
			<PersonCell
				name={entry.subject.name}
				role={entry.subject.role}
				isSelf={entry.subject.id === viewerId}
			/>
			{entry.previous && entry.next && (
				<span className="text-muted-foreground">
					— {stringToTitleCase(entry.previous)} →{" "}
					{stringToTitleCase(entry.next)}
				</span>
			)}
		</span>
	);
};

/** Full, untruncated audit entry details — the table row is clipped for layout. */
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
						<p className="text-sm leading-relaxed">
							<AuditSentence entry={entry} viewerId={viewerId} />
						</p>
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
							<span className="text-sm font-medium">Verdict / change</span>
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
								<TableHead className="w-28">Type</TableHead>
								<TableHead>Details</TableHead>
								<TableHead className="w-32">When</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{response.data.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={3}
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
									<TableCell>
										<div className="text-sm leading-relaxed">
											<AuditSentence entry={entry} viewerId={user.id} />
										</div>
										{entry.notes && (
											<p className="text-muted-foreground mt-1 max-w-xl truncate text-sm italic">
												"{entry.notes}"
											</p>
										)}
									</TableCell>
									<TableCell className="text-muted-foreground text-sm whitespace-nowrap">
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
