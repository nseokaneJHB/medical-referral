import { useState } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { createFileRoute, redirect } from "@tanstack/react-router";

import {
	CheckIcon,
	EyeIcon,
	XIcon,
	GavelIcon,
	UserIcon,
	BuildingIcon,
} from "lucide-react";

import {
	FRONTEND_URLS,
	getRelativeTime,
	stringToTitleCase,
	type Appeal,
	type TimelineResponse,
} from "@referral-tracking/shared";

import { Card, CardTitle, CardHeader, CardContent } from "@/components/ui/card";
import {
	Table,
	TableRow,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogTitle,
	DialogHeader,
	DialogContent,
	DialogDescription,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

import { Loader } from "@/components/custom/loader";
import { StatCard } from "@/components/custom/stat-card";
import { ReadOnlyField } from "@/components/custom/read-only-field";
import { RowActionsMenu } from "@/components/custom/row-actions-menu";
import { ReasonActionButton } from "@/components/custom/reason-action-button";

import { QUERY_KEYS } from "@/api/constant";
import { denyAppeal, approveAppeal, appealsRequest } from "@/api/appeals";

import { canManageUsers, resolveModerationNamespace } from "@/lib/permissions";

/** Per-row decide menu items. */
const AppealMenuItems = ({
	appealId,
	namespace,
	onChanged,
}: {
	appealId: string;
	namespace: "MANAGER" | "ADMINISTRATOR";
	onChanged: () => Promise<void>;
}) => {
	return (
		<>
			<ReasonActionButton<TimelineResponse>
				label="Approve"
				title="Approve this appeal"
				variant="warning-outline"
				icon={CheckIcon}
				description="This reverts the entity to its good standing status — a comment is required either way."
				reasonLabel="Comment"
				mutationFn={(notes) => approveAppeal(namespace, appealId, { notes })}
				onChanged={onChanged}
				renderTrigger={(onClick) => (
					<DropdownMenuItem
						variant="warning"
						onSelect={(event) => {
							event.preventDefault();
							onClick();
						}}
					>
						<CheckIcon />
						<span>Approve</span>
					</DropdownMenuItem>
				)}
			/>
			<ReasonActionButton<TimelineResponse>
				label="Deny"
				title="Deny this appeal"
				variant="error-outline"
				icon={XIcon}
				description="The entity's status stays unchanged — a comment is required either way."
				reasonLabel="Comment"
				mutationFn={(notes) => denyAppeal(namespace, appealId, { notes })}
				onChanged={onChanged}
				renderTrigger={(onClick) => (
					<DropdownMenuItem
						variant="destructive"
						onSelect={(event) => {
							event.preventDefault();
							onClick();
						}}
					>
						<XIcon />
						<span>Deny</span>
					</DropdownMenuItem>
				)}
			/>
		</>
	);
};

/** Full, untruncated appeal details — the table's "Reason" cell is clipped for layout. */
const AppealDetailsDialog = ({
	appeal,
	open,
	onOpenChange,
}: {
	appeal: Appeal | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) => {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{appeal && (
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Appeal details</DialogTitle>
						<DialogDescription>
							Submitted{" "}
							{getRelativeTime(appeal.changed_at as unknown as string)}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<ReadOnlyField label="Subject" value={appeal.subject.name} />
							<ReadOnlyField
								label="Type"
								value={stringToTitleCase(appeal.type)}
							/>
						</div>
						<ReadOnlyField label="Submitted by" value={appeal.changer.name} />
						<div className="flex w-full flex-col gap-1">
							<span className="text-sm font-medium">Reason</span>
							<p className="text-foreground rounded-md border bg-transparent p-3 text-sm whitespace-pre-wrap">
								{appeal.notes}
							</p>
						</div>
					</div>
				</DialogContent>
			)}
		</Dialog>
	);
};

const AppealsPage = () => {
	const { user, queryClient } = Route.useRouteContext();

	const namespace = resolveModerationNamespace(user);

	/**
	 * `useSuspenseQuery` (not `Route.useLoaderData()`) deliberately — see
	 * the same note on `users/index.tsx`/`transfers/index.tsx`: a live
	 * query-cache subscription so a decided appeal drops out of the list
	 * in place, not `useLoaderData`'s router-match snapshot.
	 */
	const { data: response } = useSuspenseQuery({
		queryKey: [...QUERY_KEYS.APPEALS, namespace],
		queryFn: () => appealsRequest({ data: { namespace } }),
	});

	const [viewing, setViewing] = useState<Appeal | null>(null);

	const onChanged = async () => {
		await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.APPEALS });
	};

	return (
		<div className="space-y-4">
			<Card className="border-0 bg-transparent px-0 py-1 shadow-none">
				<CardHeader className="px-0 py-1">
					<CardTitle className="text-2xl">Appeals</CardTitle>
				</CardHeader>
			</Card>

			<div className="grid gap-4 sm:grid-cols-3">
				<StatCard
					icon={GavelIcon}
					value={String(response.total)}
					label="Open appeals"
				/>
				<StatCard
					icon={UserIcon}
					value={String(response.by_type.user)}
					label="User appeals"
				/>
				<StatCard
					icon={BuildingIcon}
					value={String(response.by_type.facility)}
					label="Facility appeals"
				/>
			</div>

			<Card>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Subject</TableHead>
								<TableHead>Type</TableHead>
								<TableHead>Reason</TableHead>
								<TableHead>Submitted by</TableHead>
								<TableHead>Submitted</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{response.data.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={6}
										className="text-muted-foreground text-center"
									>
										No pending appeals.
									</TableCell>
								</TableRow>
							)}
							{response.data.map((appeal) => (
								<TableRow key={appeal.id}>
									<TableCell>{appeal.subject.name ?? "—"}</TableCell>
									<TableCell>
										<Badge variant="info">
											{stringToTitleCase(appeal.type)}
										</Badge>
									</TableCell>
									<TableCell className="max-w-60 truncate">
										{appeal.notes}
									</TableCell>
									<TableCell>{appeal.changer.name ?? "—"}</TableCell>
									<TableCell>
										{getRelativeTime(appeal.changed_at as unknown as string)}
									</TableCell>
									<TableCell className="text-right">
										<RowActionsMenu
											label={`Actions for ${appeal.subject.name ?? "appeal"}`}
										>
											<DropdownMenuItem
												onSelect={(event) => {
													event.preventDefault();
													setViewing(appeal);
												}}
											>
												<EyeIcon />
												<span>View</span>
											</DropdownMenuItem>
											<AppealMenuItems
												appealId={appeal.id}
												namespace={namespace}
												onChanged={onChanged}
											/>
										</RowActionsMenu>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<AppealDetailsDialog
				appeal={viewing}
				open={viewing !== null}
				onOpenChange={(open) => {
					if (!open) setViewing(null);
				}}
			/>
		</div>
	);
};

export const Route = createFileRoute("/_authenticated/appeals/")({
	component: AppealsPage,
	beforeLoad: ({ context }) => {
		if (!canManageUsers(context.user)) {
			throw redirect({ to: FRONTEND_URLS.HOME });
		}
	},
	loader: async ({ context }) => {
		const namespace = resolveModerationNamespace(context.user);

		await context.queryClient.ensureQueryData({
			queryKey: [...QUERY_KEYS.APPEALS, namespace],
			queryFn: () => appealsRequest({ data: { namespace } }),
		});
	},
	pendingComponent: () => (
		<div className="flex h-64 items-center justify-center">
			<Loader text="Loading appeals..." size="md" />
		</div>
	),
});
