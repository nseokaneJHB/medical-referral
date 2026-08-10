import {
	createFileRoute,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
	HTTP_CODE,
	SignInSchema,
	FRONTEND_URLS,
	type SignInBody,
	type GlobalResponse,
} from "@referral-tracking/shared";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Link } from "@/components/custom/link";
import { Input } from "@/components/custom/input";

import { useFormField } from "@/hooks/use-form-field";
import { useToastMutation } from "@/hooks/use-toast-mutation";

import { QUERY_KEYS } from "@/api/constant";
import { signIn, type AuthUserResponse } from "@/api/auth";

const SignInPage = () => {
	const router = useRouter();
	const navigate = useNavigate();

	const { queryClient } = Route.useRouteContext();

	const { control, handleSubmit } = useForm<SignInBody>({
		mode: "onChange",
		resolver: zodResolver(SignInSchema),
		defaultValues: { email: "", password: "" },
	});

	const email = useFormField({ name: "email", control });
	const password = useFormField({ name: "password", control });

	const signInMutation = useMutation<AuthUserResponse, Error, SignInBody>({
		mutationFn: signIn,
	});

	const onSubmit = async (payload: SignInBody) =>
		useToastMutation({
			loading: "Signing in...",
			promise: signInMutation.mutateAsync(payload).then(
				(): GlobalResponse => ({
					code: HTTP_CODE.OK,
					message: "Signed in.",
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
						control.setError(field.field as keyof SignInBody, {
							message: field.message,
						});
					}
				}
			},
		});

	const isLoading = signInMutation.isPending;

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-md">
			<Card>
				<CardHeader>
					<CardTitle className="text-xl">Sign in</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
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

					<Button
						type="submit"
						title="Sign in"
						disabled={isLoading}
						className="w-full"
					>
						{isLoading ? (
							<>
								<Spinner /> <span>Signing in...</span>
							</>
						) : (
							<span>Sign in</span>
						)}
					</Button>

					<p className="text-muted-foreground text-center text-sm">
						Don&apos;t have an account?{" "}
						<Link
							variant="link"
							title="Sign up"
							to={FRONTEND_URLS.SIGN_UP}
							buttonClassName="h-auto p-0 text-sm underline"
						>
							Sign up
						</Link>
					</p>
				</CardContent>
			</Card>
		</form>
	);
};

export const Route = createFileRoute("/_public/sign-in")({
	component: SignInPage,
});
