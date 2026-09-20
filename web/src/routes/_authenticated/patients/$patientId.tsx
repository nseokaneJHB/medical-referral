import { useState } from "react";

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
	SaveIcon,
	FlagIcon,
	ActivityIcon,
	FlagOffIcon,
	ClipboardListIcon,
	ArrowLeftRightIcon,
} from "lucide-react";

import {
	GENDER,
	FRONTEND_URLS,
	stringToTitleCase,
	UpdatePatientSchema,
	transferRequestSchema,
	type TransferResponse,
	type PatientResponse,
	type UpdatePatientBody,
	type TransferRequestBody,
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

import { Input } from "@/components/custom/input";
import { BackLink } from "@/components/back-link";
import { StatCard } from "@/components/custom/stat-card";
import { TextArea } from "@/components/custom/text-area";
import { SelectInput } from "@/components/custom/select-input";
import { ReadOnlyField } from "@/components/custom/read-only-field";
import { MedicalHistory } from "@/components/patients/medical-history";

import { useFormField } from "@/hooks/use-form-field";
import { useToastMutation } from "@/hooks/use-toast-mutation";
import { useFacilitySearch } from "@/hooks/use-facility-search";

import { QUERY_KEYS } from "@/api/constant";
import {
	patientRequest,
	flagPatient,
	updatePatient,
	unflagPatient,
	requestPatientTransfer,
} from "@/api/patients";
import { isNurse, isDoctor, canRequestTransfer } from "@/lib/permissions";

const GENDER_ITEMS = Object.values(GENDER).map((value) => ({
	value,
	label: stringToTitleCase(value),
}));

/**
 * Doctor-only flag/unflag control. Advisory marker, not a status/lifecycle
 * value — see `docs/roles-permissions.md` — so this is a simple direct
 * action with a reason, not a moderation/approval flow.
 */
const FlagPatientAction = ({
	patientId,
	flagged,
	onChanged,
}: {
	patientId: string;
	flagged: boolean;
	onChanged: () => Promise<void>;
}) => {
	const [open, setOpen] = useState(false);

	// No single static schema fits both branches — flagging requires a
	// reason, unflagging's note is optional — so this builds a schema off
	// the (stable, per-instance) `flagged` prop instead of reusing one of
	// the shared moderation schemas directly.
	const reasonSchema = flagged
		? z.string()
		: z.string().min(1, "A reason is required.");
	const formSchema = z.object({ reason: reasonSchema });

	const { control, handleSubmit, reset } = useForm<{ reason: string }>({
		mode: "onChange",
		resolver: zodResolver(formSchema),
		defaultValues: { reason: "" },
	});

	const reason = useFormField({ name: "reason", control });

	const flagMutation = useMutation<PatientResponse, Error, string>({
		mutationFn: (notes) =>
			flagged
				? unflagPatient(patientId, { notes: notes || undefined })
				: flagPatient(patientId, { reason: notes }),
	});

	const onSubmit = async (payload: { reason: string }) =>
		useToastMutation({
			loading: flagged ? "Unflagging patient..." : "Flagging patient...",
			promise: flagMutation.mutateAsync(payload.reason),
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
				variant={flagged ? "outline" : "warning-outline"}
				title={flagged ? "Unflag patient" : "Flag patient"}
				onClick={() => setOpen(true)}
			>
				{flagged ? <FlagOffIcon /> : <FlagIcon />}
				<span>{flagged ? "Unflag" : "Flag"}</span>
			</Button>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{flagged ? "Unflag this patient?" : "Flag this patient"}
					</DialogTitle>
					<DialogDescription>
						{flagged
							? "Optionally add a note on why the flag is being lifted."
							: "Advisory only — flagging a patient doesn't block care or referrals, it's a visible marker with a reason for other clinicians."}
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(event) => {
						event.stopPropagation();
						void handleSubmit(onSubmit)(event);
					}}
					className="space-y-4"
				>
					<TextArea
						name="reason"
						label={flagged ? "Note (optional)" : "Reason"}
						required={!flagged}
						error={reason.error}
						value={reason.value}
						onChange={reason.onChange}
					/>
					<DialogFooter>
						<Button
							type="submit"
							variant={flagged ? "outline" : "warning"}
							title={flagged ? "Confirm unflag" : "Confirm flag"}
							disabled={flagMutation.isPending}
						>
							{flagMutation.isPending ? <Spinner /> : null}
							<span>{flagged ? "Unflag" : "Flag"}</span>
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

/**
 * Nurse/Doctor at the patient's *current* facility only. Replaces every
 * direct `facility_id` edit — see `docs/roles-permissions.md`, Row 1. This
 * only starts the request; the origin facility's Manager decides next,
 * then the destination facility's Manager, before anything actually moves.
 */
const RequestTransferAction = ({
	patientId,
	currentFacilityId,
	onChanged,
}: {
	patientId: string;
	currentFacilityId: string;
	onChanged: () => Promise<void>;
}) => {
	const [open, setOpen] = useState(false);

	const {
		setSearch: setFacilitySearch,
		items: facilityItems,
		loading: facilitiesLoading,
	} = useFacilitySearch({ enabled: open, excludeId: currentFacilityId });

	const { control, handleSubmit, reset } = useForm<TransferRequestBody>({
		mode: "onChange",
		resolver: zodResolver(transferRequestSchema),
		defaultValues: { destination_facility_id: "", reason: "" },
	});

	const destinationFacilityId = useFormField({
		name: "destination_facility_id",
		control,
		type: "select",
	});
	const reason = useFormField({ name: "reason", control });

	const transferMutation = useMutation<
		TransferResponse,
		Error,
		TransferRequestBody
	>({
		mutationFn: (payload) => requestPatientTransfer(patientId, payload),
	});

	const onSubmit = async (payload: TransferRequestBody) =>
		useToastMutation({
			loading: "Requesting transfer...",
			promise: transferMutation.mutateAsync(payload),
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
				title="Request transfer"
				onClick={() => setOpen(true)}
			>
				<ArrowLeftRightIcon />
				<span>Request transfer</span>
			</Button>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Request a facility transfer</DialogTitle>
					<DialogDescription>
						The origin facility&apos;s Manager decides first, then the
						destination facility&apos;s — the patient only moves once both
						approve.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(event) => {
						event.stopPropagation();
						void handleSubmit(onSubmit)(event);
					}}
					className="space-y-4"
				>
					<SelectInput
						searchable
						filterMode="server"
						loading={facilitiesLoading}
						label="Destination facility"
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
						name="reason"
						label="Reason"
						error={reason.error}
						value={reason.value}
						onChange={reason.onChange}
					/>
					<DialogFooter>
						<Button
							type="submit"
							title="Confirm transfer request"
							disabled={transferMutation.isPending}
						>
							{transferMutation.isPending ? <Spinner /> : null}
							<span>Request transfer</span>
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

const PatientDetailPage = () => {
	const router = useRouter();
	const { user, queryClient } = Route.useRouteContext();
	const { patientId } = Route.useParams();

	/**
	 * `useSuspenseQuery` (not `Route.useLoaderData()`) deliberately — the
	 * loader's `ensureQueryData` primes this exact cache entry, so this
	 * doesn't cost an extra fetch, but unlike `useLoaderData` it's a live
	 * subscription: `invalidateQueries` below is enough on its own to make
	 * this page re-render with fresh data after a mutation.
	 */
	const { data: response } = useSuspenseQuery({
		queryKey: [...QUERY_KEYS.PATIENT, patientId],
		queryFn: () => patientRequest({ data: { id: patientId } }),
	});
	const patient = response.data;

	// Doctors and Managers have no patient fields left to edit — medical
	// history is now derived from referrals, not a field on the patient.
	const readOnlyFields = !isNurse(user);

	const { control, handleSubmit } = useForm<UpdatePatientBody>({
		mode: "onChange",
		resolver: zodResolver(UpdatePatientSchema),
		defaultValues: {
			first_name: patient.first_name,
			last_name: patient.last_name,
			date_of_birth: patient.date_of_birth,
			gender: patient.gender,
			phone: patient.phone,
			address: patient.address,
		},
	});

	const firstName = useFormField({ name: "first_name", control });
	const lastName = useFormField({ name: "last_name", control });
	const dateOfBirth = useFormField({
		name: "date_of_birth",
		control,
		type: "date",
	});
	const gender = useFormField({ name: "gender", control, type: "select" });
	const phone = useFormField({ name: "phone", control });
	const address = useFormField({ name: "address", control });

	const updatePatientMutation = useMutation<
		PatientResponse,
		Error,
		UpdatePatientBody
	>({
		mutationFn: (payload) => updatePatient(patient.id, payload),
	});

	const onSubmit = async (payload: UpdatePatientBody) =>
		useToastMutation({
			loading: "Saving patient...",
			promise: updatePatientMutation.mutateAsync(payload),
			onSuccess: async () => {
				await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENTS });
				await queryClient.invalidateQueries({
					queryKey: [...QUERY_KEYS.PATIENT, patient.id],
				});
				await router.invalidate({ sync: true });
			},
			onError: async (error) => {
				if (error.errors) {
					for (const field of error.errors) {
						control.setError(field.field as keyof UpdatePatientBody, {
							message: field.message,
						});
					}
				}
			},
		});

	const isSaving = updatePatientMutation.isPending;

	const invalidatePatient = async () => {
		await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENTS });
		await queryClient.invalidateQueries({
			queryKey: [...QUERY_KEYS.PATIENT, patient.id],
		});
		await router.invalidate({ sync: true });
	};

	const patientCanRequestTransfer = canRequestTransfer(user, patient);

	return (
		<div className="space-y-4">
			<BackLink label="Back to patients" fallbackTo={FRONTEND_URLS.PATIENTS} />

			<div className="grid gap-4 sm:grid-cols-2">
				<StatCard
					icon={ClipboardListIcon}
					label="Total referrals"
					value={String(patient.stats.total_referrals)}
				/>
				<StatCard
					icon={ActivityIcon}
					label="Active referrals"
					value={String(patient.stats.active_referrals)}
				/>
			</div>

			{patient.flagged && (
				<div className="border-warning bg-warning/10 flex items-start justify-between gap-4 rounded-md border p-3">
					<div>
						<Badge variant="warning">Flagged</Badge>
						{patient.flag_reason && (
							<p className="text-muted-foreground mt-1 text-sm">
								{patient.flag_reason}
							</p>
						)}
					</div>
					{isDoctor(user) && (
						<FlagPatientAction
							patientId={patient.id}
							flagged
							onChanged={invalidatePatient}
						/>
					)}
				</div>
			)}

			<form onSubmit={handleSubmit(onSubmit)}>
				<Card>
					<CardHeader className="flex items-center justify-between">
						<CardTitle className="text-xl">
							{patient.first_name} {patient.last_name}
						</CardTitle>
						{isDoctor(user) && !patient.flagged && (
							<FlagPatientAction
								patientId={patient.id}
								flagged={false}
								onChanged={invalidatePatient}
							/>
						)}
					</CardHeader>
					<CardContent className="space-y-4">
						<ReadOnlyField label="Facility" value={patient.facility.name} />
						<ReadOnlyField label="Registered by" value={patient.creator.name} />

						<div className="grid gap-4 sm:grid-cols-2">
							{readOnlyFields ? (
								<ReadOnlyField label="First name" value={patient.first_name} />
							) : (
								<Input
									required
									name="first_name"
									label="First name"
									error={firstName.error}
									value={firstName.value}
									onChange={firstName.onChange}
									disabled={isSaving}
								/>
							)}
							{readOnlyFields ? (
								<ReadOnlyField label="Last name" value={patient.last_name} />
							) : (
								<Input
									required
									name="last_name"
									label="Last name"
									error={lastName.error}
									value={lastName.value}
									onChange={lastName.onChange}
									disabled={isSaving}
								/>
							)}
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							{readOnlyFields ? (
								<ReadOnlyField
									label="Date of birth"
									value={patient.date_of_birth}
								/>
							) : (
								<Input
									required
									type="date"
									name="date_of_birth"
									label="Date of birth"
									error={dateOfBirth.error}
									value={dateOfBirth.value}
									onChange={dateOfBirth.onChange}
									disabled={isSaving}
								/>
							)}
							{readOnlyFields ? (
								<ReadOnlyField
									label="Gender"
									value={
										patient.gender ? stringToTitleCase(patient.gender) : null
									}
								/>
							) : (
								<SelectInput
									label="Gender"
									items={GENDER_ITEMS}
									error={gender.error}
									disabled={isSaving}
									placeholder="Select a gender"
									value={gender.value as string | undefined}
									onChange={
										gender.onChange as (value: string | undefined) => void
									}
								/>
							)}
						</div>

						{readOnlyFields ? (
							<ReadOnlyField label="Phone" value={patient.phone} />
						) : (
							<Input
								name="phone"
								label="Phone"
								error={phone.error}
								value={phone.value}
								onChange={phone.onChange}
								disabled={isSaving}
							/>
						)}

						{readOnlyFields ? (
							<ReadOnlyField label="Address" value={patient.address} />
						) : (
							<TextArea
								name="address"
								label="Address"
								error={address.error}
								value={address.value}
								onChange={address.onChange}
								disabled={isSaving}
							/>
						)}

						<div className="flex flex-wrap gap-2">
							{!readOnlyFields && (
								<Button type="submit" title="Save patient" disabled={isSaving}>
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
							)}
							{patientCanRequestTransfer && (
								<RequestTransferAction
									patientId={patient.id}
									currentFacilityId={patient.facility.id}
									onChanged={invalidatePatient}
								/>
							)}
						</div>
					</CardContent>
				</Card>
			</form>

			<MedicalHistory patientId={patient.id} />
		</div>
	);
};

export const Route = createFileRoute("/_authenticated/patients/$patientId")({
	component: PatientDetailPage,
	loader: async ({ context, params }) => {
		const response = await context.queryClient.ensureQueryData({
			queryKey: [...QUERY_KEYS.PATIENT, params.patientId],
			queryFn: () => patientRequest({ data: { id: params.patientId } }),
		});

		return response;
	},
});
