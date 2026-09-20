import {
	redirect,
	useRouter,
	useNavigate,
	createFileRoute,
} from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { KeyRoundIcon } from "lucide-react";

import {
	FRONTEND_URLS,
	changePasswordSchema,
	type GlobalResponse,
	type ChangePasswordBody,
} from "@referral-tracking/shared";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/custom/input";
import { Navigation } from "@/components/navigation";
import { SignOutButton } from "@/components/sign-out-button";

import { useFormField } from "@/hooks/use-form-field";
import { useToastMutation } from "@/hooks/use-toast-mutation";

import { QUERY_KEYS } from "@/api/constant";
import { changePassword } from "@/api/account";

const changePasswordFormSchema = changePasswordSchema
	.extend({
		confirm_new_password: z.string().min(1, "Please confirm your new password"),
	})
	.refine((data) => data.new_password === data.confirm_new_password, {
		path: ["confirm_new_password"],
		message: "Passwords do not match",
	});

type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>;

const ChangePasswordPage = () => {
	const router = useRouter();
	const navigate = useNavigate();

	const { queryClient } = Route.useRouteContext();

	const { control, handleSubmit } = useForm<ChangePasswordFormValues>({
		mode: "onChange",
		resolver: zodResolver(changePasswordFormSchema),
		defaultValues: {
			current_password: "",
			new_password: "",
			confirm_new_password: "",
		},
	});

	const currentPassword = useFormField({ name: "current_password", control });
	const newPassword = useFormField({ name: "new_password", control });
	const confirmNewPassword = useFormField({
		name: "confirm_new_password",
		control,
	});

	const changePasswordMutation = useMutation<
		GlobalResponse,
		Error,
		ChangePasswordBody
	>({ mutationFn: changePassword });

	const onSubmit = async (payload: ChangePasswordFormValues) =>
		useToastMutation({
			loading: "Changing password...",
			promise: changePasswordMutation.mutateAsync({
				current_password: payload.current_password,
				new_password: payload.new_password,
			}),
			onSuccess: async () => {
				queryClient.removeQueries({ queryKey: QUERY_KEYS.ME });
				await router.invalidate();
				navigate({ to: FRONTEND_URLS.HOME });
			},
			onError: async (error) => {
				if (error.errors) {
					for (const field of error.errors) {
						control.setError(field.field as keyof ChangePasswordFormValues, {
							message: field.message,
						});
					}
				}
			},
		});

	const isLoading = changePasswordMutation.isPending;

	return (
		<div className="flex flex-1 grow flex-col">
			<Navigation />
			<main className="mx-auto w-full max-w-lg flex-1 space-y-4 p-4">
				<form onSubmit={handleSubmit(onSubmit)}>
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-xl">
								<KeyRoundIcon className="h-5 w-5" />
								<span>Change your password</span>
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-muted-foreground text-sm">
								Your account was set up with a temporary password. Set a new
								password to continue.
							</p>

							<Input
								required
								type="password"
								name="current_password"
								label="Temporary password"
								error={currentPassword.error}
								value={currentPassword.value}
								onChange={currentPassword.onChange}
								placeholder="********"
								disabled={isLoading}
							/>

							<Input
								required
								type="password"
								name="new_password"
								label="New password"
								error={newPassword.error}
								value={newPassword.value}
								onChange={newPassword.onChange}
								placeholder="********"
								disabled={isLoading}
							/>

							<Input
								required
								type="password"
								name="confirm_new_password"
								label="Confirm new password"
								error={confirmNewPassword.error}
								value={confirmNewPassword.value}
								onChange={confirmNewPassword.onChange}
								placeholder="********"
								disabled={isLoading}
							/>

							<Button
								type="submit"
								title="Change password"
								disabled={isLoading}
								className="w-full"
							>
								{isLoading ? (
									<>
										<Spinner /> <span>Changing password...</span>
									</>
								) : (
									<span>Change password</span>
								)}
							</Button>

							<SignOutButton />
						</CardContent>
					</Card>
				</form>
			</main>
		</div>
	);
};

export const Route = createFileRoute("/change-password")({
	component: ChangePasswordPage,
	beforeLoad: ({ context }) => {
		if (!context.user) throw redirect({ to: FRONTEND_URLS.SIGN_IN });
		if (!context.user.must_change_password)
			throw redirect({ to: FRONTEND_URLS.HOME });
	},
});
