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
 * Short, standalone label per action for the "Action" column — distinct
 * from the sentence-flow verb phrases below, which have trailing
 * prepositions ("approved the appeal for") that only read correctly when
 * immediately followed by the subject's name.
 */
const ACTION_LABEL: Record<TimelineAction, string> = {
	STATUS_CHANGE: "Changed status",
	DOCTOR_ASSIGNED: "Assigned doctor",
	REDIRECTED: "Redirected",
	TRANSFER_REQUESTED: "Requested transfer",
	TRANSFER_APPROVED_ORIGIN: "Approved transfer (origin)",
	TRANSFER_APPROVED_DESTINATION: "Approved transfer (destination)",
	TRANSFER_REJECTED: "Rejected transfer",
	APPROVED: "Approved",
	REJECTED: "Rejected",
	DISABLED: "Disabled",
	FLAGGED: "Flagged",
	UNFLAGGED: "Unflagged",
	SUSPENDED: "Suspended",
	DEPARTED: "Recorded departure",
	APPEAL_SUBMITTED: "Submitted appeal",
	APPEAL_APPROVED: "Approved appeal",
	APPEAL_DENIED: "Denied appeal",
};

/**
 * Natural-language verb phrase per action, so the dialog's summary sentence
 * reads as "{actor} {verb} {subject}" — e.g. `STATUS_CHANGE` alone doesn't
 * say who did what to what, "changed the status of" does.
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
 * The actor's name — or just "You" when the viewer performed the action
 * themselves, replacing the name entirely rather than appending a badge.
 */
const ActorCell = ({
	name,
	isSelf,
}: {
	name: string | null;
	isSelf: boolean;
}) => <span className="font-medium">{isSelf ? "You" : (name ?? "—")}</span>;

/**
 * A subject's name, plus (when known) their role badge, plus a "You" tag
 * when the row is about the viewer themselves.
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
 * Action cell for the table: a small badge for which kind of entity the
 * row is about (User/Facility/Referral/Patient), then the action label.
 */
const ActionCell = ({ entry }: { entry: ManagerAudit }) => (
	<span className="inline-flex flex-wrap items-center gap-1.5">
		<Badge variant={TYPE_VARIANT[entry.type]} className="shrink-0">
			{stringToTitleCase(entry.type)}
		</Badge>
		<span className="whitespace-nowrap">
			{ACTION_LABEL[entry.action] ?? stringToTitleCase(entry.action)}
		</span>
	</span>
);

/**
 * The "who did what to whom, and what was the verdict" sentence used at
 * the top of the details dialog as a quick summary above the broken-out
 * fields below it.
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
			<ActorCell
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
				<DialogContent className="sm:max-w-2xl">
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
								value={ACTION_LABEL[entry.action] ?? stringToTitleCase(entry.action)}
							/>
						</div>
						<ReadOnlyField
							label="Performed by"
							value={
								<ActorCell
									name={entry.changer.name}
									isSelf={entry.changer.id === viewerId}
								/>
							}
						/>
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
						<div className="flex w-full flex-col gap-1">
							<span className="text-sm font-medium">Verdict</span>
							<p className="text-foreground rounded-md border bg-transparent p-3 text-sm whitespace-pre-wrap">
								{entry.previous && entry.next
									? `${stringToTitleCase(entry.previous)} → ${stringToTitleCase(entry.next)}`
									: "No value change recorded."}
							</p>
						</div>
						<div className="flex w-full flex-col gap-1">
							<span className="text-sm font-medium">Why</span>
							<p className="text-foreground rounded-md border bg-transparent p-3 text-sm whitespace-pre-wrap">
								{entry.reason ?? entry.notes ?? "No reason given."}
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
								<TableHead>Performed by</TableHead>
								<TableHead>Action</TableHead>
								<TableHead>Subject</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Why</TableHead>
								<TableHead>When</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{response.data.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={6}
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
									<TableCell className="max-w-40 truncate">
										<ActorCell
											name={entry.changer.name}
											isSelf={entry.changer.id === user.id}
										/>
									</TableCell>
									<TableCell>
										<ActionCell entry={entry} />
									</TableCell>
									<TableCell className="max-w-60 truncate">
										<PersonCell
											name={entry.subject.name}
											role={entry.subject.role}
											isSelf={entry.subject.id === user.id}
										/>
									</TableCell>
									<TableCell className="max-w-32 truncate">
										{entry.next ? stringToTitleCase(entry.next) : "—"}
									</TableCell>
									<TableCell className="max-w-48 truncate text-muted-foreground italic">
										{entry.reason ?? entry.notes ?? "—"}
									</TableCell>
									<TableCell className="text-muted-foreground whitespace-nowrap">
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
