import { useState } from "react";

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { CheckIcon, XIcon } from "lucide-react";

import {
	ROLES,
	TIMELINE_ACTION,
	FRONTEND_URLS,
	type Transfer,
	type TransferResponse,
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogTitle,
	DialogFooter,
	DialogHeader,
	DialogContent,
	DialogDescription,
} from "@/components/ui/dialog";

import { TextArea } from "@/components/custom/text-area";
import { Loader } from "@/components/custom/loader";

import { useToastMutation } from "@/hooks/use-toast-mutation";

import { QUERY_KEYS } from "@/api/constant";
import {
	transfersRequest,
	rejectTransferOrigin,
	approveTransferOrigin,
	rejectTransferDestination,
	approveTransferDestination,
} from "@/api/transfers";

import { canManageUsers } from "@/lib/permissions";

/** Per-row decide buttons — which side (origin/destination) depends on the row's current stage. */
const TransferActions = ({
	transfer,
	namespace,
	onChanged,
}: {
	transfer: Transfer;
	namespace: "MANAGER" | "ADMINISTRATOR";
	onChanged: () => Promise<void>;
}) => {
	const [rejectOpen, setRejectOpen] = useState(false);
	const [reason, setReason] = useState("");

	const side =
		transfer.action === TIMELINE_ACTION.TRANSFER_REQUESTED
			? "origin"
			: "destination";

	const approveFn =
		side === "origin" ? approveTransferOrigin : approveTransferDestination;
	const rejectFn =
		side === "origin" ? rejectTransferOrigin : rejectTransferDestination;

	const approveMutation = useMutation<TransferResponse, Error, void>({
		mutationFn: () => approveFn(namespace, transfer.id, {}),
	});

	const rejectMutation = useMutation<TransferResponse, Error, string>({
		mutationFn: (rejectReason) =>
			rejectFn(namespace, transfer.id, { reason: rejectReason }),
	});

	const onApprove = async () =>
		useToastMutation({
			loading: `Approving ${side} side...`,
			promise: approveMutation.mutateAsync(),
			onSuccess: onChanged,
		});

	const onReject = async () =>
		useToastMutation({
			loading: `Rejecting ${side} side...`,
			promise: rejectMutation.mutateAsync(reason),
			onSuccess: async () => {
				setRejectOpen(false);
				setReason("");
				await onChanged();
			},
		});

	return (
		<div className="flex justify-end gap-2">
			<Button
				type="button"
				variant="success-outline"
				title={`Approve ${side} side`}
				disabled={approveMutation.isPending}
				onClick={onApprove}
			>
				<CheckIcon />
				<span>Approve</span>
			</Button>
			<Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
				<Button
					type="button"
					variant="error-outline"
					title={`Reject ${side} side`}
					onClick={() => setRejectOpen(true)}
				>
					<XIcon />
					<span>Reject</span>
				</Button>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Reject this transfer?</DialogTitle>
						<DialogDescription>
							The patient stays at their current facility — a reason is
							required either way.
						</DialogDescription>
					</DialogHeader>
					<TextArea
						required
						name="reason"
						label="Reason"
						value={reason}
						onChange={(event) => setReason(event.target.value)}
					/>
					<DialogFooter>
						<Button
							type="button"
							variant="error"
							title="Confirm rejection"
							disabled={rejectMutation.isPending || reason.trim().length === 0}
							onClick={onReject}
						>
							<span>Reject</span>
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
};

const TransfersPage = () => {
	const { user, queryClient } = Route.useRouteContext();

	const namespace = user.role === ROLES.ADMINISTRATOR ? "ADMINISTRATOR" : "MANAGER";

	/**
	 * `useSuspenseQuery` (not `Route.useLoaderData()`) deliberately — the
	 * loader's `ensureQueryData` primes this exact cache entry, so this
	 * doesn't cost an extra fetch, but unlike `useLoaderData` it's a live
	 * subscription: `invalidateQueries` below is enough on its own to make
	 * this table re-render with fresh data. `useLoaderData` reads a
	 * snapshot from the router's own match cache, which isn't subscribed
	 * to query-cache invalidation at all — a decided transfer would toast
	 * success but stay in the pending list indefinitely.
	 */
	const { data: response } = useSuspenseQuery({
		queryKey: [...QUERY_KEYS.TRANSFERS, namespace],
		queryFn: () => transfersRequest({ data: { namespace } }),
	});

	const onChanged = async () => {
		await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSFERS });
	};

	return (
		<div className="space-y-4">
			<Card className="border-0 bg-transparent px-0 py-1 shadow-none">
				<CardHeader className="px-0 py-1">
					<CardTitle className="text-2xl">Pending transfers</CardTitle>
				</CardHeader>
			</Card>

			<Card>
				<CardContent className="px-0">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Patient</TableHead>
								<TableHead>From</TableHead>
								<TableHead>To</TableHead>
								<TableHead>Reason</TableHead>
								<TableHead>Requested by</TableHead>
								<TableHead>Awaiting</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							{response.data.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={7}
										className="text-muted-foreground text-center"
									>
										No pending transfers.
									</TableCell>
								</TableRow>
							)}
							{response.data.map((transfer) => (
								<TableRow key={transfer.id}>
									<TableCell>
										{transfer.patient.first_name} {transfer.patient.last_name}
									</TableCell>
									<TableCell>{transfer.origin_facility.name}</TableCell>
									<TableCell>{transfer.destination_facility.name}</TableCell>
									<TableCell className="max-w-60 truncate">
										{transfer.reason}
									</TableCell>
									<TableCell>{transfer.requested_by.name}</TableCell>
									<TableCell>
										<Badge variant="warning">
											{transfer.action === TIMELINE_ACTION.TRANSFER_REQUESTED
												? "Origin"
												: "Destination"}
										</Badge>
									</TableCell>
									<TableCell>
										<TransferActions
											transfer={transfer}
											namespace={namespace}
											onChanged={onChanged}
										/>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
};

export const Route = createFileRoute("/_authenticated/transfers/")({
	component: TransfersPage,
	beforeLoad: ({ context }) => {
		if (!canManageUsers(context.user)) {
			throw redirect({ to: FRONTEND_URLS.HOME });
		}
	},
	loader: async ({ context }) => {
		const namespace =
			context.user.role === ROLES.ADMINISTRATOR ? "ADMINISTRATOR" : "MANAGER";

		const response = await context.queryClient.ensureQueryData({
			queryKey: [...QUERY_KEYS.TRANSFERS, namespace],
			queryFn: () => transfersRequest({ data: { namespace } }),
		});

		return response;
	},
	pendingComponent: () => (
		<div className="flex h-64 items-center justify-center">
			<Loader text="Loading transfers..." size="md" />
		</div>
	),
});
