import { useState } from "react";

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";

import { AlertTriangleIcon } from "lucide-react";

import {
	USER_STATUS,
	stringToTitleCase,
	type AppealBody,
	type TimelineResponse,
} from "@referral-tracking/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { TextArea } from "@/components/custom/text-area";
import { ReadOnlyField } from "@/components/custom/read-only-field";
import { Navigation } from "@/components/navigation";
import { SignOutButton } from "@/components/sign-out-button";

import { useToastMutation } from "@/hooks/use-toast-mutation";

import { QUERY_KEYS } from "@/api/constant";
import { submitAppeal, accountStatusRequest } from "@/api/account";

const STATUS_VARIANT: Record<string, "default" | "warning" | "error"> = {
	[USER_STATUS.PENDING]: "default",
	[USER_STATUS.REJECTED]: "error",
	[USER_STATUS.FLAGGED]: "warning",
	[USER_STATUS.DISABLED]: "error",
	[USER_STATUS.DEPARTED]: "default",
};

const CAN_APPEAL = new Set<string>([
	USER_STATUS.REJECTED,
	USER_STATUS.FLAGGED,
	USER_STATUS.DISABLED,
]);

const AccountStatusPage = () => {
	const response = Route.useLoaderData();
	const account = response.data;

	const [reason, setReason] = useState("");
	const [submitted, setSubmitted] = useState(false);

	const appealMutation = useMutation<TimelineResponse, Error, AppealBody>({
		mutationFn: submitAppeal,
	});

	const handleAppeal = () =>
		useToastMutation({
			loading: "Submitting appeal...",
			promise: appealMutation.mutateAsync({ reason }),
			onSuccess: async () => {
				setSubmitted(true);
			},
		});

	const canAppeal = CAN_APPEAL.has(account.status);
	const isSubmitting = appealMutation.isPending;

	return (
		<div className="flex flex-1 grow flex-col">
			<Navigation />
			<main className="mx-auto w-full max-w-lg flex-1 space-y-4 p-4">
				<Card>
					<CardHeader className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2 text-xl">
							<AlertTriangleIcon className="h-5 w-5" />
							<span>Account status</span>
						</CardTitle>
						<Badge variant={STATUS_VARIANT[account.status] ?? "default"}>
							{stringToTitleCase(account.status)}
						</Badge>
					</CardHeader>
					<CardContent className="space-y-4">
						<ReadOnlyField
							label="Reason"
							value={account.reason ?? "No reason has been recorded yet."}
						/>

						{account.facility && (
							<>
								<ReadOnlyField
									label="Facility"
									value={`${account.facility.name} — ${stringToTitleCase(account.facility.status)}`}
								/>
								{account.facility.reason && (
									<ReadOnlyField
										label="Facility reason"
										value={account.facility.reason}
									/>
								)}
							</>
						)}

						{canAppeal &&
							(submitted ? (
								<p className="text-muted-foreground text-sm">
									Your appeal has been submitted and is awaiting review.
								</p>
							) : (
								<div className="space-y-3">
									<TextArea
										required
										name="reason"
										label="Appeal reason"
										value={reason}
										onChange={(event) => setReason(event.target.value)}
										disabled={isSubmitting}
									/>
									<Button
										type="button"
										title="Submit appeal"
										disabled={isSubmitting || reason.trim().length === 0}
										onClick={handleAppeal}
									>
										{isSubmitting ? <Spinner /> : null}
										<span>Submit appeal</span>
									</Button>
								</div>
							))}

						<SignOutButton />
					</CardContent>
				</Card>
			</main>
		</div>
	);
};

export const Route = createFileRoute("/account-status")({
	component: AccountStatusPage,
	beforeLoad: ({ context }) => {
		if (!context.user) throw redirect({ to: "/sign-in" });
		if (context.user.status === USER_STATUS.ACTIVE) throw redirect({ to: "/" });
	},
	loader: async ({ context }) => {
		const response = await context.queryClient.ensureQueryData({
			queryKey: QUERY_KEYS.ACCOUNT_STATUS,
			queryFn: accountStatusRequest,
		});

		return response;
	},
});
