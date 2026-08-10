import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { SaveIcon } from "lucide-react";

import {
	GENDER,
	ROLES,
	FRONTEND_URLS,
	stringToTitleCase,
	UpdatePatientSchema,
	type PatientResponse,
	type UpdatePatientBody,
} from "@referral-tracking/shared";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/custom/input";
import { BackLink } from "@/components/custom/back-link";
import { TextArea } from "@/components/custom/text-area";
import { SelectInput } from "@/components/custom/select-input";
import { ReadOnlyField } from "@/components/custom/read-only-field";
import { MedicalHistory } from "@/components/custom/medical-history";

import { useFormField } from "@/hooks/use-form-field";
import { useToastMutation } from "@/hooks/use-toast-mutation";

import { QUERY_KEYS } from "@/api/constant";
import { patientRequest, updatePatient } from "@/api/patients";

const GENDER_ITEMS = Object.values(GENDER).map((value) => ({
	value,
	label: stringToTitleCase(value),
}));

const PatientDetailPage = () => {
	const router = useRouter();
	const { user, queryClient } = Route.useRouteContext();
	const response = Route.useLoaderData();
	const patient = response.data;

	// Doctors and Managers have no patient fields left to edit — medical
	// history is now derived from referrals, not a field on the patient.
	const readOnlyFields = user.role !== ROLES.NURSE;

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
				await router.invalidate();
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

	return (
		<div className="space-y-4">
			<BackLink label="Back to patients" fallbackTo={FRONTEND_URLS.PATIENTS} />

			<form onSubmit={handleSubmit(onSubmit)}>
				<Card>
					<CardHeader>
						<CardTitle className="text-xl">
							{patient.first_name} {patient.last_name}
						</CardTitle>
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
