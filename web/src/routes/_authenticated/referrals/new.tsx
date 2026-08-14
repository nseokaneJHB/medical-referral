import { useState } from "react";

import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { SaveIcon } from "lucide-react";

import {
	PRIORITY,
	FRONTEND_URLS,
	stringToTitleCase,
	CreateReferralSchema,
	TERMINAL_REFERRAL_STATUSES,
	type SpecialtyRef,
	type ReferralResponse,
	type CreateReferralBody,
} from "@referral-tracking/shared";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { TextArea } from "@/components/custom/text-area";
import { BackLink } from "@/components/custom/back-link";
import { SelectInput } from "@/components/custom/select-input";
import { SpecialtyManager } from "@/components/custom/specialty-manager";

import { useFormField } from "@/hooks/use-form-field";
import { useToastMutation } from "@/hooks/use-toast-mutation";

import { QUERY_KEYS } from "@/api/constant";
import { patientsRequest } from "@/api/patients";
import { createReferral, referralsRequest } from "@/api/referrals";
import { facilitiesRequest } from "@/api/facilities";
import { specialtiesRequest, assignReferralSpecialty } from "@/api/specialties";
import { canCreateReferral } from "@/lib/permissions";

const PRIORITY_ITEMS = Object.values(PRIORITY).map((value) => ({
	value,
	label: stringToTitleCase(value),
}));

// `priority` has a `.default()` in the schema, so zodResolver's inferred
// form-values type (the pre-parse shape, matching `z.input`) makes it
// optional — even though `CreateReferralBody` (the post-parse `z.infer`
// output) requires it. `useForm` must be typed against the input shape.
type ReferralFormValues = z.input<typeof CreateReferralSchema>;

const NewReferralPage = () => {
	const navigate = useNavigate();

	const { queryClient } = Route.useRouteContext();

	const { data: patients } = useQuery({
		queryKey: [...QUERY_KEYS.PATIENTS, "picker"],
		queryFn: () => patientsRequest({ data: { page: "1", limit: "100" } }),
	});

	const patientItems =
		patients?.data.map((patient) => ({
			value: patient.id,
			label: `${patient.first_name} ${patient.last_name}`,
		})) ?? [];

	const { data: facilities } = useQuery({
		queryKey: [...QUERY_KEYS.FACILITIES, "picker"],
		queryFn: () => facilitiesRequest({ data: { page: "1", limit: "100" } }),
	});

	const facilityItems =
		facilities?.data.map((facility) => ({
			value: facility.id,
			label: facility.name,
		})) ?? [];

	const { data: allSpecialties } = useQuery({
		queryKey: [...QUERY_KEYS.SPECIALTIES, "picker"],
		queryFn: () => specialtiesRequest({ data: { page: "1", limit: "100" } }),
	});

	// Staged locally — the referral doesn't exist yet, so there's nothing to
	// assign against until `onSubmit` creates it and fires one assign call
	// per staged specialty. Reuses `SpecialtyManager`'s chip-picker UI with
	// local-state `onAssign`/`onUnassign` in place of its usual remote ones.
	const [stagedSpecialties, setStagedSpecialties] = useState<
		{ id: string; specialty: SpecialtyRef }[]
	>([]);

	const handleStageSpecialty = async (specialtyId: string): Promise<void> => {
		const specialty = allSpecialties?.data.find(
			(item) => item.id === specialtyId,
		);
		if (!specialty) return;
		setStagedSpecialties((prev) => [...prev, { id: specialtyId, specialty }]);
	};

	const handleUnstageSpecialty = async (link: {
		specialty: { id: string };
	}): Promise<void> => {
		setStagedSpecialties((prev) =>
			prev.filter((item) => item.specialty.id !== link.specialty.id),
		);
	};

	const { control, handleSubmit } = useForm<ReferralFormValues>({
		mode: "onChange",
		resolver: zodResolver(CreateReferralSchema),
		defaultValues: {
			patient_id: "",
			destination_facility_id: "",
			visit_reason: "",
			referral_reason: "",
			priority: PRIORITY.MEDIUM,
		},
	});

	const patientId = useFormField({
		name: "patient_id",
		control,
		type: "select",
	});
	const destinationFacilityId = useFormField({
		name: "destination_facility_id",
		control,
		type: "select",
	});
	const visitReason = useFormField({ name: "visit_reason", control });
	const referralReason = useFormField({ name: "referral_reason", control });
	const priority = useFormField({ name: "priority", control, type: "select" });

	const selectedPatientId = patientId.value as string | undefined;

	const { data: patientReferrals } = useQuery({
		queryKey: [...QUERY_KEYS.REFERRALS, "active-check", selectedPatientId],
		queryFn: () =>
			referralsRequest({
				data: { patient_id: selectedPatientId, page: "1", limit: "5" },
			}),
		enabled: !!selectedPatientId,
	});

	const hasActiveReferral = patientReferrals?.data.some(
		(referral) => !TERMINAL_REFERRAL_STATUSES.includes(referral.status),
	);

	const createReferralMutation = useMutation<
		ReferralResponse,
		Error,
		CreateReferralBody
	>({
		mutationFn: createReferral,
	});

	const onSubmit = async (payload: ReferralFormValues) =>
		useToastMutation({
			loading: "Creating referral...",
			promise: createReferralMutation.mutateAsync({
				...payload,
				priority: payload.priority ?? PRIORITY.MEDIUM,
			}),
			onSuccess: async (data) => {
				const failedSpecialties: string[] = [];
				for (const staged of stagedSpecialties) {
					try {
						await assignReferralSpecialty(data.data.id, {
							specialty_id: staged.specialty.id,
						});
					} catch (error) {
						console.error(
							"Failed to tag a specialty on the new referral:",
							error,
						);
						failedSpecialties.push(staged.specialty.name);
					}
				}
				if (failedSpecialties.length > 0) {
					toast.warning(
						`Referral created, but ${failedSpecialties.length} specialty tag(s) failed to attach (${failedSpecialties.join(", ")}). Add them from the referral page.`,
					);
				}
				await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REFERRALS });
				navigate({ to: FRONTEND_URLS.REFERRALS });
			},
			onError: async (error) => {
				if (error.errors) {
					for (const field of error.errors) {
						control.setError(field.field as keyof ReferralFormValues, {
							message: field.message,
						});
					}
				}
			},
		});

	const isLoading = createReferralMutation.isPending;

	return (
		<div className="space-y-4">
			<BackLink
				label="Back to referrals"
				fallbackTo={FRONTEND_URLS.REFERRALS}
			/>

			<form onSubmit={handleSubmit(onSubmit)}>
				<Card>
					<CardHeader>
						<CardTitle className="text-xl">Create referral</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<SelectInput
							searchable
							label="Patient"
							items={patientItems}
							error={patientId.error}
							disabled={isLoading}
							placeholder="Select a patient"
							value={patientId.value as string}
							onChange={
								patientId.onChange as (value: string | undefined) => void
							}
						/>

						{hasActiveReferral && (
							<div className="border-warning bg-warning/20 text-warning rounded-md border p-3 text-sm">
								This patient already has an active referral. You can still
								continue if this is a new, unrelated visit.
							</div>
						)}

						<SelectInput
							searchable
							label="Receiving facility"
							items={facilityItems}
							error={destinationFacilityId.error}
							disabled={isLoading}
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
							disabled={isLoading}
						/>

						<TextArea
							required
							name="referral_reason"
							label="Reason for referral"
							error={referralReason.error}
							value={referralReason.value}
							onChange={referralReason.onChange}
							disabled={isLoading}
						/>

						<SelectInput
							label="Priority"
							items={PRIORITY_ITEMS}
							error={priority.error}
							disabled={isLoading}
							placeholder="Select priority"
							value={priority.value as string}
							onChange={
								priority.onChange as (value: string | undefined) => void
							}
						/>

						<div className="space-y-2">
							<p className="text-sm font-medium">
								Specialties needed (optional)
							</p>
							<p className="text-muted-foreground text-sm">
								Not sure? Leave this blank — the receiving doctor can tag
								specialties later.
							</p>
							<SpecialtyManager
								assigned={stagedSpecialties}
								allSpecialties={allSpecialties?.data ?? []}
								editable
								onAssign={handleStageSpecialty}
								onUnassign={handleUnstageSpecialty}
							/>
						</div>

						<Button type="submit" title="Create referral" disabled={isLoading}>
							{isLoading ? (
								<>
									<Spinner /> <span>Creating...</span>
								</>
							) : (
								<>
									<SaveIcon /> <span>Create referral</span>
								</>
							)}
						</Button>
					</CardContent>
				</Card>
			</form>
		</div>
	);
};

export const Route = createFileRoute("/_authenticated/referrals/new")({
	component: NewReferralPage,
	beforeLoad: ({ context }) => {
		if (!canCreateReferral(context.user)) {
			throw redirect({ to: FRONTEND_URLS.REFERRALS });
		}
	},
});
