import { useState } from "react";

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { SaveIcon, UserCheckIcon } from "lucide-react";

import {
	ROLES,
	PRIORITY,
	REFERRAL_STATUS,
	FRONTEND_URLS,
	stringToTitleCase,
	UpdateReferralSchema,
	STATUS_TRANSITIONS,
	NURSE_STATUS_TARGETS,
	TERMINAL_REFERRAL_STATUSES,
	DOCTOR_STATUS_TARGETS_BY_STATUS,
	type ReferralResponse,
	type UpdateReferralBody,
	type ReferralStatus,
} from "@referral-tracking/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Link } from "@/components/custom/link";
import { TextArea } from "@/components/custom/text-area";
import { SelectInput } from "@/components/custom/select-input";
import { ReadOnlyField } from "@/components/custom/read-only-field";
import { BackLink } from "@/components/custom/back-link";
import { TimelineList } from "@/components/custom/timeline-list";

import { useFormField } from "@/hooks/use-form-field";
import { useToastMutation } from "@/hooks/use-toast-mutation";

import { QUERY_KEYS } from "@/api/constant";
import { usersRequest } from "@/api/users";
import { facilitiesRequest } from "@/api/facilities";
import {
	referralRequest,
	updateReferral,
	assignReferral,
	updateReferralStatus,
	referralHistoryRequest,
} from "@/api/referrals";

const PRIORITY_ITEMS = Object.values(PRIORITY).map((value) => ({
	value,
	label: stringToTitleCase(value),
}));

const PRIORITY_VARIANT: Record<
	string,
	"default" | "info" | "warning" | "error"
> = {
	[PRIORITY.LOW]: "default",
	[PRIORITY.MEDIUM]: "info",
	[PRIORITY.HIGH]: "warning",
	[PRIORITY.URGENT]: "error",
};

const STATUS_VARIANT: Record<
	string,
	"default" | "info" | "success" | "warning" | "error"
> = {
	pending: "default",
	accepted: "info",
	in_progress: "info",
	on_hold: "warning",
	completed: "success",
	rejected: "error",
	canceled: "error",
};

// Buttons describe the action, not the resulting state — "Accept" not "Accepted".
const TRANSITION_ACTION_LABELS: Record<string, string> = {
	pending: "Reopen",
	accepted: "Accept",
	in_progress: "Start Treatment",
	on_hold: "Put on hold",
	completed: "Complete",
	rejected: "Reject",
	canceled: "Cancel",
};

// No reason required moving into these — accepting/starting needs no explanation.
const REASON_NOT_REQUIRED_TARGETS = new Set<ReferralStatus>([
	REFERRAL_STATUS.ACCEPTED,
	REFERRAL_STATUS.IN_PROGRESS,
]);

const ReferralDetailPage = () => {
	const router = useRouter();
	const { user, queryClient } = Route.useRouteContext();
	const response = Route.useLoaderData();
	const referral = response.data;

	const [notes, setNotes] = useState("");

	const { data: historyResponse } = useQuery({
		queryKey: [...QUERY_KEYS.REFERRAL_HISTORY, referral.id],
		queryFn: () => referralHistoryRequest({ data: { id: referral.id } }),
	});

	const isDoctor = user.role === ROLES.DOCTOR;
	const isManager = user.role === ROLES.MANAGER;

	const canAct =
		(user.role === ROLES.NURSE && referral.referrer.id === user.id) ||
		(isDoctor && referral.assignedDoctor?.id === user.id);

	const isTerminal = TERMINAL_REFERRAL_STATUSES.includes(referral.status);

	const canEditFull =
		user.role === ROLES.NURSE &&
		referral.referrer.id === user.id &&
		!isTerminal;
	const canAssignDoctor =
		isManager &&
		referral.destination_facility.id === user.facility_id &&
		!isTerminal;
	const canEdit = canEditFull || canAssignDoctor;

	const canSelfAssign =
		isDoctor &&
		!referral.assignedDoctor &&
		!isTerminal &&
		user.facility_id === referral.destination_facility.id;

	const legalNextStates = STATUS_TRANSITIONS[referral.status] ?? [];
	const roleTargets =
		user.role === ROLES.NURSE
			? NURSE_STATUS_TARGETS
			: user.role === ROLES.DOCTOR
				? (DOCTOR_STATUS_TARGETS_BY_STATUS[referral.status] ?? [])
				: null;
	const availableTransitions = canAct
		? roleTargets
			? legalNextStates.filter((state) => roleTargets.includes(state))
			: legalNextStates
		: [];

	// Only fetched for editors — display uses the referral response's own
	// nested facility/doctor objects, not a separate lookup call.
	const { data: facilities } = useQuery({
		queryKey: [...QUERY_KEYS.FACILITIES, "picker"],
		queryFn: () => facilitiesRequest({ data: { page: "1", limit: "100" } }),
		enabled: canEditFull,
	});

	const facilityItems =
		facilities?.data.map((facility) => ({
			value: facility.id,
			label: facility.name,
		})) ?? [];

	const { data: doctors } = useQuery({
		queryKey: [...QUERY_KEYS.USERS, "doctors"],
		queryFn: () =>
			usersRequest({ data: { role: ROLES.DOCTOR, page: "1", limit: "100" } }),
		enabled: canAssignDoctor,
	});

	const doctorItems =
		doctors?.data.map((doctor) => ({
			value: doctor.id,
			label: doctor.name ?? doctor.email,
		})) ?? [];

	const { control, handleSubmit } = useForm<UpdateReferralBody>({
		mode: "onChange",
		resolver: zodResolver(UpdateReferralSchema),
		defaultValues: {
			destination_facility_id: referral.destination_facility.id,
			visit_reason: referral.visit_reason,
			referral_reason: referral.referral_reason,
			priority: referral.priority,
			doctor: referral.assignedDoctor?.id ?? undefined,
		},
	});

	const destinationFacilityId = useFormField({
		name: "destination_facility_id",
		control,
		type: "select",
	});
	const visitReason = useFormField({ name: "visit_reason", control });
	const referralReason = useFormField({ name: "referral_reason", control });
	const priority = useFormField({ name: "priority", control, type: "select" });
	const doctor = useFormField({ name: "doctor", control, type: "select" });

	const updateReferralMutation = useMutation<
		ReferralResponse,
		Error,
		UpdateReferralBody
	>({
		mutationFn: (payload) => updateReferral(referral.id, payload),
	});

	const updateStatusMutation = useMutation<
		ReferralResponse,
		Error,
		ReferralStatus
	>({
		mutationFn: (next) =>
			updateReferralStatus(referral.id, {
				next,
				notes: notes.trim() || undefined,
			}),
	});

	const assignReferralMutation = useMutation<ReferralResponse, Error, void>({
		mutationFn: () => assignReferral(referral.id),
	});

	const invalidateReferral = async () => {
		await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REFERRALS });
		await queryClient.invalidateQueries({
			queryKey: [...QUERY_KEYS.REFERRAL, referral.id],
		});
		await queryClient.invalidateQueries({
			queryKey: [...QUERY_KEYS.REFERRAL_HISTORY, referral.id],
		});
		await router.invalidate();
	};

	const onSubmit = async (payload: UpdateReferralBody) =>
		useToastMutation({
			loading: "Saving referral...",
			promise: updateReferralMutation.mutateAsync(
				// A Manager's write access through this endpoint is
				// narrowly "assign a doctor" — the API rejects any other key,
				// even unchanged (mirrors the Doctor/patient-history restriction).
				canAssignDoctor && !canEditFull ? { doctor: payload.doctor } : payload,
			),
			onSuccess: invalidateReferral,
			onError: async (error) => {
				if (error.errors) {
					for (const field of error.errors) {
						control.setError(field.field as keyof UpdateReferralBody, {
							message: field.message,
						});
					}
				}
			},
		});

	const handleTransition = (next: ReferralStatus) =>
		useToastMutation({
			loading: `${TRANSITION_ACTION_LABELS[next] ?? stringToTitleCase(next)}ing referral...`,
			promise: updateStatusMutation.mutateAsync(next),
			onSuccess: async () => {
				setNotes("");
				await invalidateReferral();
			},
		});

	const handleSelfAssign = () =>
		useToastMutation({
			loading: "Assigning referral to you...",
			promise: assignReferralMutation.mutateAsync(),
			onSuccess: invalidateReferral,
		});

	const isSaving = updateReferralMutation.isPending;
	const isTransitioning = updateStatusMutation.isPending;
	const isSelfAssigning = assignReferralMutation.isPending;

	const latestNote = historyResponse?.data[0]?.notes;

	return (
		<div className="space-y-4">
			<BackLink
				label="Back to referrals"
				fallbackTo={FRONTEND_URLS.REFERRALS}
			/>

			<Card>
				<CardHeader className="flex items-center justify-between">
					<CardTitle className="text-xl">
						{referral.origin_facility.name} &rarr;{" "}
						{referral.destination_facility.name}
					</CardTitle>
					<div className="flex gap-2">
						<Badge variant={PRIORITY_VARIANT[referral.priority]}>
							{stringToTitleCase(referral.priority)}
						</Badge>
						<Badge variant={STATUS_VARIANT[referral.status]}>
							{stringToTitleCase(referral.status)}
						</Badge>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<ReadOnlyField
						label="Patient"
						value={
							<Link
								variant="link"
								title="View patient"
								to={FRONTEND_URLS.PATIENT}
								params={{ patientId: referral.patient.id }}
								buttonClassName="h-auto p-0 text-lg underline"
							>
								{referral.patient.first_name} {referral.patient.last_name}
							</Link>
						}
					/>

					{latestNote && (
						<ReadOnlyField label="Status reason" value={latestNote} />
					)}

					{canEditFull ? (
						<>
							<SelectInput
								searchable
								label="Destination facility"
								items={facilityItems}
								error={destinationFacilityId.error}
								disabled={isSaving}
								placeholder="Select a facility"
								value={destinationFacilityId.value as string}
								onChange={
									destinationFacilityId.onChange as (
										value: string | undefined,
									) => void
								}
							/>

							<TextArea
								required
								name="visit_reason"
								label="Reason for visiting the facility"
								error={visitReason.error}
								value={visitReason.value}
								onChange={visitReason.onChange}
								disabled={isSaving}
							/>

							<TextArea
								required
								name="referral_reason"
								label="Reason for referral"
								error={referralReason.error}
								value={referralReason.value}
								onChange={referralReason.onChange}
								disabled={isSaving}
							/>

							<SelectInput
								label="Priority"
								items={PRIORITY_ITEMS}
								error={priority.error}
								disabled={isSaving}
								placeholder="Select priority"
								value={priority.value as string}
								onChange={
									priority.onChange as (value: string | undefined) => void
								}
							/>
						</>
					) : (
						<>
							<ReadOnlyField
								label="Reason for visiting the facility"
								value={referral.visit_reason}
							/>
							<ReadOnlyField
								label="Reason for referral"
								value={referral.referral_reason}
							/>
						</>
					)}

					{canAssignDoctor ? (
						<SelectInput
							searchable
							label="Assigned doctor"
							items={doctorItems}
							error={doctor.error}
							disabled={isSaving}
							placeholder="Unassigned"
							value={doctor.value as string}
							onChange={doctor.onChange as (value: string | undefined) => void}
						/>
					) : (
						<ReadOnlyField
							label="Assigned doctor"
							value={
								referral.assignedDoctor
									? referral.assignedDoctor.id === user.id
										? "You"
										: referral.assignedDoctor.name
									: "Unassigned"
							}
						/>
					)}

					{canEdit && (
						<form onSubmit={handleSubmit(onSubmit)}>
							<Button type="submit" title="Save referral" disabled={isSaving}>
								{isSaving ? (
									<>
										<Spinner /> <span>Saving...</span>
									</>
								) : (
									<>
										<SaveIcon /> <span>Save changes</span>
									</>
								)}
							</Button>
						</form>
					)}

					{canSelfAssign && (
						<Button
							type="button"
							variant="outline"
							title="Assign to me"
							disabled={isSelfAssigning}
							onClick={handleSelfAssign}
						>
							{isSelfAssigning ? <Spinner /> : <UserCheckIcon />}
							<span>Assign to me</span>
						</Button>
					)}
				</CardContent>
			</Card>

			{availableTransitions.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-lg">Update status</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<TextArea
							required={availableTransitions.some(
								(state) => !REASON_NOT_REQUIRED_TARGETS.has(state),
							)}
							name="notes"
							label="Reason for this change"
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
							disabled={isTransitioning}
						/>
						<div className="flex flex-wrap gap-2">
							{availableTransitions.map((state) => {
								const reasonRequired = !REASON_NOT_REQUIRED_TARGETS.has(state);
								return (
									<Button
										key={state}
										type="button"
										variant="outline"
										title={
											TRANSITION_ACTION_LABELS[state] ??
											stringToTitleCase(state)
										}
										disabled={
											isTransitioning ||
											(reasonRequired && notes.trim().length === 0)
										}
										onClick={() => handleTransition(state)}
									>
										{isTransitioning ? <Spinner /> : null}
										<span>
											{TRANSITION_ACTION_LABELS[state] ??
												stringToTitleCase(state)}
										</span>
									</Button>
								);
							})}
						</div>
					</CardContent>
				</Card>
			)}

			<TimelineList
				entries={historyResponse?.data ?? []}
				emptyMessage="No status changes yet."
			/>
		</div>
	);
};

export const Route = createFileRoute("/_authenticated/referrals/$referralId")({
	component: ReferralDetailPage,
	loader: async ({ context, params }) => {
		const response = await context.queryClient.ensureQueryData({
			queryKey: [...QUERY_KEYS.REFERRAL, params.referralId],
			queryFn: () => referralRequest({ data: { id: params.referralId } }),
		});

		return response;
	},
});
