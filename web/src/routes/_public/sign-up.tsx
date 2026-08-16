import { useEffect, useState } from "react";

import {
	createFileRoute,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";

import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
	ROLES,
	HTTP_CODE,
	SignUpSchema,
	FRONTEND_URLS,
	stringToTitleCase,
	type SignUpBody,
	type GlobalResponse,
} from "@referral-tracking/shared";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Link } from "@/components/custom/link";
import { Input } from "@/components/custom/input";
import { TextArea } from "@/components/custom/text-area";
import { SelectInput } from "@/components/custom/select-input";

import { useFormField } from "@/hooks/use-form-field";
import { useToastMutation } from "@/hooks/use-toast-mutation";
import { useFacilitySearch } from "@/hooks/use-facility-search";

import { QUERY_KEYS } from "@/api/constant";
import { signUp, type AuthUserResponse } from "@/api/auth";

const signUpFormSchema = SignUpSchema.extend({
	confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
	path: ["confirmPassword"],
	message: "Passwords do not match",
});

type SignUpFormValues = z.infer<typeof signUpFormSchema>;

const ROLE_ITEMS = Object.values(ROLES).map((role) => ({
	value: role,
	label: stringToTitleCase(role),
}));

const SignUpPage = () => {
	const router = useRouter();
	const navigate = useNavigate();

	const { queryClient } = Route.useRouteContext();

	const { control, setValue, handleSubmit } = useForm<SignUpFormValues>({
		mode: "onChange",
		resolver: zodResolver(signUpFormSchema),
		defaultValues: {
			name: "",
			email: "",
			password: "",
			confirmPassword: "",
			role: ROLES.NURSE,
		},
	});

	const watchedRole = useWatch({ control, name: "role" });
	const needsExistingFacility =
		watchedRole === ROLES.NURSE || watchedRole === ROLES.DOCTOR;
	const isManager = watchedRole === ROLES.MANAGER;

	const [facilityMode, setFacilityMode] = useState<"join" | "register">("join");
	const showFacilityPicker =
		needsExistingFacility || (isManager && facilityMode === "join");
	const showNewFacilityFields = isManager && facilityMode === "register";

	const {
		setSearch: setFacilitySearch,
		items: facilityItems,
		loading: facilitiesLoading,
	} = useFacilitySearch({ enabled: showFacilityPicker });

	useEffect(() => {
		if (!showFacilityPicker) setValue("facility_id", undefined);
		if (!showNewFacilityFields) {
			setValue("new_facility_name", undefined);
			setValue("new_facility_address", undefined);
		}
	}, [showFacilityPicker, showNewFacilityFields, setValue]);

	const name = useFormField({ name: "name", control });
	const email = useFormField({ name: "email", control });
	const password = useFormField({ name: "password", control });
	const confirmPassword = useFormField({ name: "confirmPassword", control });
	const role = useFormField({ name: "role", control, type: "select" });
	const facilityId = useFormField({
		name: "facility_id",
		control,
		type: "select",
	});
	const newFacilityName = useFormField({ name: "new_facility_name", control });
	const newFacilityAddress = useFormField({
		name: "new_facility_address",
		control,
	});

	const signUpMutation = useMutation<AuthUserResponse, Error, SignUpBody>({
		mutationFn: signUp,
	});

	const onSubmit = async (payload: SignUpFormValues) =>
		useToastMutation({
			loading: "Creating your account...",
			promise: signUpMutation
				.mutateAsync({
					name: payload.name,
					email: payload.email,
					password: payload.password,
					role: payload.role,
					facility_id: payload.facility_id,
					new_facility_name: payload.new_facility_name,
					new_facility_address: payload.new_facility_address,
				})
				.then(
					(): GlobalResponse => ({
						code: HTTP_CODE.CREATED,
						message: "Account created.",
					}),
				),
			onSuccess: async () => {
				queryClient.removeQueries({ queryKey: QUERY_KEYS.ME });
				await router.invalidate();
				navigate({ to: FRONTEND_URLS.HOME });
			},
			onError: async (error) => {
				if (error.errors) {
					for (const field of error.errors) {
						control.setError(field.field as keyof SignUpFormValues, {
							message: field.message,
						});
					}
				}
			},
		});

	const isLoading = signUpMutation.isPending;

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-md">
			<Card>
				<CardHeader>
					<CardTitle className="text-xl">Create an account</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{isManager && (
						<div className="flex gap-2">
							<Button
								type="button"
								title="Join an existing facility"
								disabled={isLoading}
								variant={facilityMode === "join" ? "default" : "outline"}
								onClick={() => setFacilityMode("join")}
								className="flex-1"
							>
								Join existing facility
							</Button>
							<Button
								type="button"
								title="Register a new facility"
								disabled={isLoading}
								variant={facilityMode === "register" ? "default" : "outline"}
								onClick={() => setFacilityMode("register")}
								className="flex-1"
							>
								Register a new facility
							</Button>
						</div>
					)}

					{showFacilityPicker && (
						<SelectInput
							searchable
							filterMode="server"
							loading={facilitiesLoading}
							label="Facility"
							items={facilityItems}
							value={facilityId.value as string}
							error={facilityId.error}
							disabled={isLoading}
							placeholder="Select a facility"
							onChange={
								facilityId.onChange as (value: string | undefined) => void
							}
							onSearchChange={setFacilitySearch}
						/>
					)}

					{showNewFacilityFields && (
						<>
							<Input
								required
								name="new_facility_name"
								label="Facility name"
								error={newFacilityName.error}
								value={newFacilityName.value}
								onChange={newFacilityName.onChange}
								placeholder="Saint Johns Clinic"
								disabled={isLoading}
							/>
							<TextArea
								name="new_facility_address"
								label="Facility address"
								error={newFacilityAddress.error}
								value={newFacilityAddress.value}
								onChange={newFacilityAddress.onChange}
								disabled={isLoading}
							/>
						</>
					)}

					<Input
						required
						name="name"
						type="text"
						label="Name"
						error={name.error}
						value={name.value}
						onChange={name.onChange}
						placeholder="Jane Doe"
						disabled={isLoading}
					/>

					<Input
						required
						name="email"
						type="email"
						label="Email"
						error={email.error}
						value={email.value}
						onChange={email.onChange}
						placeholder="email@example.com"
						disabled={isLoading}
					/>

					<SelectInput
						label="Role"
						items={ROLE_ITEMS}
						value={role.value as string}
						error={role.error}
						disabled={isLoading}
						placeholder="Select a role"
						onChange={role.onChange as (value: string | undefined) => void}
					/>

					<Input
						required
						name="password"
						type="password"
						label="Password"
						error={password.error}
						value={password.value}
						onChange={password.onChange}
						placeholder="********"
						disabled={isLoading}
					/>

					<Input
						required
						type="password"
						label="Confirm password"
						name="confirmPassword"
						error={confirmPassword.error}
						value={confirmPassword.value}
						onChange={confirmPassword.onChange}
						placeholder="********"
						disabled={isLoading}
					/>

					<Button
						type="submit"
						title="Sign up"
						disabled={isLoading}
						className="w-full"
					>
						{isLoading ? (
							<>
								<Spinner /> <span>Creating account...</span>
							</>
						) : (
							<span>Sign up</span>
						)}
					</Button>

					<p className="text-muted-foreground text-center text-sm">
						Already have an account?{" "}
						<Link
							variant="link"
							title="Sign in"
							to={FRONTEND_URLS.SIGN_IN}
							buttonClassName="h-auto p-0 text-sm underline"
						>
							Sign in
						</Link>
					</p>
				</CardContent>
			</Card>
		</form>
	);
};

export const Route = createFileRoute("/_public/sign-up")({
	component: SignUpPage,
});
