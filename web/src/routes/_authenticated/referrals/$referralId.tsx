import { useState, useMemo } from "react";

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { SaveIcon, UserCheckIcon, SignpostIcon } from "lucide-react";

import {
	ROLES,
	PRIORITY,
	REFERRAL_STATUS,
	FRONTEND_URLS,
	stringToTitleCase,
	UpdateReferralSchema,
	STATUS_TRANSITIONS,
	NURSE_STATUS_TARGETS,
	redirectReferralSchema,
	DOCTOR_STATUS_TARGETS_BY_STATUS,
	type GlobalResponse,
	type ReferralResponse,
	type UpdateReferralBody,
	type ReferralStatus,
	type SpecialtyRef,
	type RedirectReferralBody,
	type ReferralSpecialtyLinkResponse,
} from "@referral-tracking/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogTitle,
	DialogFooter,
	DialogHeader,
	DialogContent,
	DialogDescription,
} from "@/components/ui/dialog";

import { Link } from "@/components/custom/link";
import { TextArea } from "@/components/custom/text-area";
import { SelectInput } from "@/components/custom/select-input";
import { ReadOnlyField } from "@/components/custom/read-only-field";
import { BackLink } from "@/components/back-link";
import { TimelineList } from "@/components/custom/timeline-list";
import { SpecialtyManager } from "@/components/specialties/specialty-manager";

import { useFormField } from "@/hooks/use-form-field";
import { useToastMutation } from "@/hooks/use-toast-mutation";
import { useFacilitySearch } from "@/hooks/use-facility-search";

import { QUERY_KEYS } from "@/api/constant";
import { usersRequest } from "@/api/users";
import {
	referralRequest,
	updateReferral,
	assignReferral,
	redirectReferral,
	updateReferralStatus,
	referralHistoryRequest,
} from "@/api/referrals";
import {
	specialtiesRequest,
	referralSpecialtiesRequest,
	assignReferralSpecialty,
	unassignReferralSpecialty,
} from "@/api/specialties";
import {
	isNurse,
	isDoctor,
	canActOnReferral,
	canEditReferralFull,
	canAssignDoctorToReferral,
	canSelfAssignReferral,
	canRedirectReferral,
	canManageReferralSpecialties,
} from "@/lib/permissions";

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
	ReferralStatus,
	"default" | "info" | "success" | "warning" | "error"
> = {
	[REFERRAL_STATUS.PENDING]: "default",
	[REFERRAL_STATUS.ACCEPTED]: "info",
	[REFERRAL_STATUS.IN_PROGRESS]: "info",
	[REFERRAL_STATUS.ON_HOLD]: "warning",
	[REFERRAL_STATUS.COMPLETED]: "success",
	[REFERRAL_STATUS.REJECTED]: "error",
	[REFERRAL_STATUS.CANCELED]: "error",
};

// Buttons describe the action, not the resulting state — "Accept" not "Accepted".
const TRANSITION_ACTION_LABELS: Record<ReferralStatus, string> = {
	[REFERRAL_STATUS.PENDING]: "Reopen",
	[REFERRAL_STATUS.ACCEPTED]: "Accept",
	[REFERRAL_STATUS.IN_PROGRESS]: "Start Treatment",
	[REFERRAL_STATUS.ON_HOLD]: "Put on hold",
	[REFERRAL_STATUS.COMPLETED]: "Complete",
	[REFERRAL_STATUS.REJECTED]: "Reject",
	[REFERRAL_STATUS.CANCELED]: "Cancel",
};

// No reason required moving into these — accepting/starting needs no explanation.
const REASON_NOT_REQUIRED_TARGETS = new Set<ReferralStatus>([
	REFERRAL_STATUS.ACCEPTED,
	REFERRAL_STATUS.IN_PROGRESS,
]);

/**
 * Doctor-only. Server enforces the destination must be `APPROVED` and a
 * facility this referral hasn't already been at — this dialog only
 * excludes the current destination from the picker (a trivially-always-
 * invalid choice); it doesn't pre-filter the rest of the visited history,
 * so a rejected pick surfaces as a toast error, same as any other conflict.
 */
const RedirectReferralAction = ({
	referralId,
	currentDestinationId,
	specialties,
	allSpecialties,
	onAssignSpecialty,
	onUnassignSpecialty,
	onChanged,
}: {
	referralId: string;
	currentDestinationId: string;
	specialties: { id: string; specialty: SpecialtyRef }[];
	allSpecialties: SpecialtyRef[];
	onAssignSpecialty: (specialtyId: string) => Promise<void>;
	onUnassignSpecialty: (link: { specialty: { id: string } }) => Promise<void>;
	onChanged: () => Promise<void>;
}) => {
	const [open, setOpen] = useState(false);

	const {
		setSearch: setFacilitySearch,
		items: facilityItems,
		loading: facilitiesLoading,
	} = useFacilitySearch({ enabled: open, excludeId: currentDestinationId });

	const { control, handleSubmit, reset } = useForm<RedirectReferralBody>({
		mode: "onChange",
		resolver: zodResolver(redirectReferralSchema),
		defaultValues: { destination_facility_id: "", notes: "" },
	});

	const destinationFacilityId = useFormField({
		name: "destination_facility_id",
		control,
		type: "select",
	});
	const notes = useFormField({ name: "notes", control });

	const redirectMutation = useMutation<
		ReferralResponse,
		Error,
		RedirectReferralBody
	>({
		mutationFn: (payload) => redirectReferral(referralId, payload),
	});

	const onSubmit = async (payload: RedirectReferralBody) =>
		useToastMutation({
			loading: "Redirecting referral...",
			promise: redirectMutation.mutateAsync(payload),
			onSuccess: async () => {
				setOpen(false);
				reset();
				await onChanged();
			},
		});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<Button
				type="button"
				variant="outline"
				title="Redirect referral"
				onClick={() => setOpen(true)}
			>
				<SignpostIcon />
				<span>Redirect</span>
			</Button>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Redirect this referral</DialogTitle>
					<DialogDescription>
						Sends it to a different facility, unassigned and pending — the new
						facility triages it fresh.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-2">
					<p className="text-sm font-medium">Specialties needed</p>
					<SpecialtyManager
						assigned={specialties}
						allSpecialties={allSpecialties}
						editable
						onAssign={onAssignSpecialty}
						onUnassign={onUnassignSpecialty}
					/>
				</div>
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<SelectInput
						searchable
						filterMode="server"
						loading={facilitiesLoading}
						label="New destination facility"
						items={facilityItems}
						error={destinationFacilityId.error}
						placeholder="Select a facility"
						value={destinationFacilityId.value as string | undefined}
						onChange={
							destinationFacilityId.onChange as (
								value: string | undefined,
							) => void
						}
						onSearchChange={setFacilitySearch}
					/>
					<TextArea
						required
						name="notes"
						label="Reason"
						error={notes.error}
						value={notes.value}
						onChange={notes.onChange}
					/>
					<DialogFooter>
						<Button
							type="submit"
							title="Confirm redirect"
							disabled={redirectMutation.isPending}
						>
							{redirectMutation.isPending ? <Spinner /> : null}
							<span>Redirect</span>
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

const ReferralDetailPage = () => {
	const router = useRouter();
	const { user, queryClient } = Route.useRouteContext();
	const { referralId } = Route.useParams();

	/**
	 * `useSuspenseQuery` (not `Route.useLoaderData()`) deliberately — the
	 * loader's `ensureQueryData` primes this exact cache entry, so this
	 * doesn't cost an extra fetch, but unlike `useLoaderData` it's a live
	 * subscription: `invalidateQueries` below is enough on its own to make
	 * this page re-render with fresh data after a mutation.
	 */
	const { data: response } = useSuspenseQuery({
		queryKey: [...QUERY_KEYS.REFERRAL, referralId],
		queryFn: () => referralRequest({ data: { id: referralId } }),
	});
	const referral = response.data;

	const { data: historyResponse } = useQuery({
		queryKey: [...QUERY_KEYS.REFERRAL_HISTORY, referral.id],
		queryFn: () => referralHistoryRequest({ data: { id: referral.id } }),
	});

	const canAct = canActOnReferral(user, referral);

	const canEditFull = canEditReferralFull(user, referral);
	const canAssignDoctor = canAssignDoctorToReferral(user, referral);
	const canEdit = canEditFull || canAssignDoctor;

	const canSelfAssign = canSelfAssignReferral(user, referral);

	const canRedirect = canRedirectReferral(user, referral);

	const canManageSpecialties = canManageReferralSpecialties(user, referral);

	const legalNextStates = STATUS_TRANSITIONS[referral.status] ?? [];
	const roleTargets = isNurse(user)
		? NURSE_STATUS_TARGETS
		: isDoctor(user)
			? (DOCTOR_STATUS_TARGETS_BY_STATUS[referral.status] ?? [])
			: null;
	const availableTransitions = canAct
		? roleTargets
			? legalNextStates.filter((state) => roleTargets.includes(state))
			: legalNextStates
		: [];

	// Only fetched for editors — display uses the referral response's own
	// nested facility/doctor objects, not a separate lookup call. Redirect's
	// own facility picker (in `RedirectReferralAction`) runs its own
	// independent search, since it excludes a different facility.
	const {
		setSearch: setFacilitySearch,
		items: facilitySearchItems,
		loading: facilitiesLoading,
	} = useFacilitySearch({ enabled: canEditFull });

	// The search hook only returns facilities matching the current search
	// term, so the referral's already-selected destination facility won't be
	// in `items` until someone types a matching query — seed it in so the
	// select shows the current value instead of rendering blank.
	const facilityItems = useMemo(() => {
		const current = {
			value: referral.destination_facility.id,
			label: referral.destination_facility.name,
		};
		return facilitySearchItems.some((item) => item.value === current.value)
			? facilitySearchItems
			: [current, ...facilitySearchItems];
	}, [facilitySearchItems, referral.destination_facility]);

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

	const { data: specialtiesResponse } = useQuery({
		queryKey: [...QUERY_KEYS.REFERRAL_SPECIALTIES, referral.id],
		queryFn: () => referralSpecialtiesRequest({ data: { id: referral.id } }),
	});

	const { data: allSpecialtiesResponse } = useQuery({
		queryKey: [...QUERY_KEYS.SPECIALTIES, "picker"],
		queryFn: () => specialtiesRequest({ data: { page: "1", limit: "100" } }),
	});

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

	// No single static schema fits this field — it's a shared "reason" for
	// N different status-transition buttons, each with its own
	// requiredness (see REASON_NOT_REQUIRED_TARGETS) — so this uses
	// useForm/useFormField without a zodResolver, and requiredness is
	// enforced per-button below instead.
	const { control: notesControl, reset: resetStatusNotes } = useForm<{
		notes: string;
	}>({
		defaultValues: { notes: "" },
	});
	const statusNotes = useFormField({ name: "notes", control: notesControl });

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
				notes: statusNotes.value.trim() || undefined,
			}),
	});

	const assignReferralMutation = useMutation<ReferralResponse, Error, void>({
		mutationFn: () => assignReferral(referral.id),
	});

	const assignSpecialtyMutation = useMutation<
		ReferralSpecialtyLinkResponse,
		Error,
		string
	>({
		mutationFn: (specialtyId) =>
			assignReferralSpecialty(referral.id, { specialty_id: specialtyId }),
	});

	const unassignSpecialtyMutation = useMutation<GlobalResponse, Error, string>({
		mutationFn: (specialtyId) =>
			unassignReferralSpecialty(referral.id, specialtyId),
	});

	const invalidateReferral = async () => {
		await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REFERRALS });
		await queryClient.invalidateQueries({
			queryKey: [...QUERY_KEYS.REFERRAL, referral.id],
		});
		await queryClient.invalidateQueries({
			queryKey: [...QUERY_KEYS.REFERRAL_HISTORY, referral.id],
		});
		await router.invalidate({ sync: true });
	};

	/**
	 * Redirecting moves the referral to a different facility, which almost
	 * always revokes the current Doctor's own `canViewReferral` access to it.
	 * Re-fetching this same referral/history query would just fail a
	 * background refetch against data that's already cached, so React Query
	 * silently keeps showing the stale pre-redirect page instead of erroring
	 * — navigate back to the list (whose cache we do still have valid access
	 * to refresh) instead of trying to keep this detail page alive.
	 */
	const handleRedirected = async () => {
		await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REFERRALS });
		await router.navigate({ to: FRONTEND_URLS.REFERRALS });
	};

	const onSpecialtiesChanged = async () => {
		await queryClient.invalidateQueries({
			queryKey: [...QUERY_KEYS.REFERRAL_SPECIALTIES, referral.id],
		});
	};

	const handleAssignSpecialty = async (specialtyId: string): Promise<void> => {
		await useToastMutation({
			loading: "Tagging specialty...",
			promise: assignSpecialtyMutation.mutateAsync(specialtyId),
			onSuccess: onSpecialtiesChanged,
		});
	};

	const handleUnassignSpecialty = async (link: {
		specialty: { id: string };
	}): Promise<void> => {
		await useToastMutation({
			loading: "Removing specialty...",
			promise: unassignSpecialtyMutation.mutateAsync(link.specialty.id),
			onSuccess: onSpecialtiesChanged,
		});
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
				resetStatusNotes();
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

			<div className="grid gap-4 lg:grid-cols-3">
				<div className="lg:col-span-2">
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
										filterMode="server"
										loading={facilitiesLoading}
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
										onSearchChange={setFacilitySearch}
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
									onChange={
										doctor.onChange as (value: string | undefined) => void
									}
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
									<Button
										type="submit"
										title="Save referral"
										disabled={isSaving}
									>
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

							<div className="flex flex-wrap gap-2">
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
								{canRedirect && (
									<RedirectReferralAction
										referralId={referral.id}
										currentDestinationId={referral.destination_facility.id}
										specialties={specialtiesResponse?.data ?? []}
										allSpecialties={allSpecialtiesResponse?.data ?? []}
										onAssignSpecialty={handleAssignSpecialty}
										onUnassignSpecialty={handleUnassignSpecialty}
										onChanged={handleRedirected}
									/>
								)}
							</div>
						</CardContent>
					</Card>
				</div>

				<div className="space-y-4 lg:col-span-1">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Specialties needed</CardTitle>
						</CardHeader>
						<CardContent>
							<SpecialtyManager
								assigned={specialtiesResponse?.data ?? []}
								allSpecialties={allSpecialtiesResponse?.data ?? []}
								editable={canManageSpecialties}
								onAssign={handleAssignSpecialty}
								onUnassign={handleUnassignSpecialty}
							/>
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
									error={statusNotes.error}
									value={statusNotes.value}
									onChange={statusNotes.onChange}
									disabled={isTransitioning}
								/>
								<div className="flex flex-wrap gap-2">
									{availableTransitions.map((state) => {
										const reasonRequired =
											!REASON_NOT_REQUIRED_TARGETS.has(state);
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
													(reasonRequired &&
														statusNotes.value.trim().length === 0)
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
				</div>
			</div>

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
