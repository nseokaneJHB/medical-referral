import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { SaveIcon } from "lucide-react";

import {
	GENDER,
	FRONTEND_URLS,
	stringToTitleCase,
	createPatientSchema,
	type PatientResponse,
	type CreatePatientBody,
} from "@referral-tracking/shared";

import { isNurse } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/custom/input";
import { BackLink } from "@/components/back-link";
import { TextArea } from "@/components/custom/text-area";
import { SelectInput } from "@/components/custom/select-input";

import { useFormField } from "@/hooks/use-form-field";
import { useToastMutation } from "@/hooks/use-toast-mutation";

import { QUERY_KEYS } from "@/api/constant";
import { createPatient } from "@/api/patients";

const GENDER_ITEMS = Object.values(GENDER).map((value) => ({
	value,
	label: stringToTitleCase(value),
}));

const NewPatientPage = () => {
	const navigate = useNavigate();

	const { queryClient } = Route.useRouteContext();

	const { control, handleSubmit } = useForm<CreatePatientBody>({
		mode: "onChange",
		resolver: zodResolver(createPatientSchema),
		defaultValues: {
			first_name: "",
			last_name: "",
			date_of_birth: "",
			gender: null,
			phone: null,
			address: null,
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

	const createPatientMutation = useMutation<
		PatientResponse,
		Error,
		CreatePatientBody
	>({
		mutationFn: createPatient,
	});

	const onSubmit = async (payload: CreatePatientBody) =>
		useToastMutation({
			loading: "Registering patient...",
			promise: createPatientMutation.mutateAsync(payload),
			onSuccess: async () => {
				await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PATIENTS });
				navigate({ to: FRONTEND_URLS.PATIENTS });
			},
			onError: async (error) => {
				if (error.errors) {
					for (const field of error.errors) {
						control.setError(field.field as keyof CreatePatientBody, {
							message: field.message,
						});
					}
				}
			},
		});

	const isLoading = createPatientMutation.isPending;

	return (
		<div className="space-y-4">
			<BackLink label="Back to patients" fallbackTo={FRONTEND_URLS.PATIENTS} />

			<form onSubmit={handleSubmit(onSubmit)}>
				<Card>
					<CardHeader>
						<CardTitle className="text-xl">Register patient</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<Input
								required
								name="first_name"
								label="First name"
								error={firstName.error}
								value={firstName.value}
								onChange={firstName.onChange}
								disabled={isLoading}
							/>
							<Input
								required
								name="last_name"
								label="Last name"
								error={lastName.error}
								value={lastName.value}
								onChange={lastName.onChange}
								disabled={isLoading}
							/>
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							<Input
								required
								type="date"
								name="date_of_birth"
								label="Date of birth"
								error={dateOfBirth.error}
								value={dateOfBirth.value}
								onChange={dateOfBirth.onChange}
								disabled={isLoading}
							/>
							<SelectInput
								label="Gender"
								items={GENDER_ITEMS}
								error={gender.error}
								disabled={isLoading}
								placeholder="Select a gender"
								value={gender.value as string | undefined}
								onChange={
									gender.onChange as (value: string | undefined) => void
								}
							/>
						</div>

						<Input
							name="phone"
							label="Phone"
							error={phone.error}
							value={phone.value}
							onChange={phone.onChange}
							disabled={isLoading}
						/>

						<TextArea
							name="address"
							label="Address"
							error={address.error}
							value={address.value}
							onChange={address.onChange}
							disabled={isLoading}
						/>

						<Button type="submit" title="Register patient" disabled={isLoading}>
							{isLoading ? (
								<>
									<Spinner /> <span>Registering...</span>
								</>
							) : (
								<>
									<SaveIcon /> <span>Register patient</span>
								</>
							)}
						</Button>
					</CardContent>
				</Card>
			</form>
		</div>
	);
};

export const Route = createFileRoute("/_authenticated/patients/new")({
	component: NewPatientPage,
	beforeLoad: ({ context }) => {
		const { user } = context;
		if (!isNurse(user)) {
			throw redirect({ to: FRONTEND_URLS.PATIENTS });
		}
	},
});
