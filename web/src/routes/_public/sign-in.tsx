import { useState } from "react";

import {
	createFileRoute,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";

import { z } from "zod";
import { useForm, useController } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
	SignInSchema,
	FRONTEND_URLS,
	type SignInBody,
	type GlobalResponse,
	type SignInResponse,
} from "@referral-tracking/shared";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Link } from "@/components/custom/link";
import { Input } from "@/components/custom/input";
import { CheckBox } from "@/components/custom/check-box";

import { useFormField } from "@/hooks/use-form-field";
import { useToastMutation } from "@/hooks/use-toast-mutation";

import { QUERY_KEYS } from "@/api/constant";
import {
	signIn,
	twoFactorSendOtp,
	twoFactorVerifyOtp,
	twoFactorVerifyTotp,
	twoFactorVerifyBackupCode,
} from "@/api/auth";

const twoFactorCodeSchema = z.object({
	code: z.string().min(1, "Code is required"),
	trustDevice: z.boolean(),
});

type TwoFactorCodeValues = z.infer<typeof twoFactorCodeSchema>;

const SignInPage = () => {
	const router = useRouter();
	const navigate = useNavigate();

	const { queryClient } = Route.useRouteContext();

	const [pendingMethods, setPendingMethods] = useState<Array<
		"totp" | "otp"
	> | null>(null);
	const [activeMethod, setActiveMethod] = useState<"totp" | "otp">("totp");
	const [useBackupCode, setUseBackupCode] = useState(false);
	const [otpSent, setOtpSent] = useState(false);

	const { control, handleSubmit } = useForm<SignInBody>({
		mode: "onChange",
		resolver: zodResolver(SignInSchema),
		defaultValues: { email: "", password: "" },
	});

	const email = useFormField({ name: "email", control });
	const password = useFormField({ name: "password", control });

	const {
		control: twoFactorControl,
		handleSubmit: handleTwoFactorSubmit,
		setValue: setTwoFactorValue,
		setError: setTwoFactorError,
	} = useForm<TwoFactorCodeValues>({
		mode: "onChange",
		resolver: zodResolver(twoFactorCodeSchema),
		defaultValues: { code: "", trustDevice: false },
	});

	const code = useFormField({ name: "code", control: twoFactorControl });
	const { field: trustDeviceField } = useController({
		name: "trustDevice",
		control: twoFactorControl,
	});

	const onSignedIn = async () => {
		queryClient.removeQueries({ queryKey: QUERY_KEYS.ME });
		await router.invalidate();
		navigate({ to: FRONTEND_URLS.HOME });
	};

	const signInMutation = useMutation<SignInResponse, Error, SignInBody>({
		mutationFn: signIn,
	});

	const onSubmit = async (payload: SignInBody) =>
		useToastMutation({
			loading: "Signing in...",
			promise: signInMutation.mutateAsync(payload),
			onSuccess: async (data) => {
				if (data.twoFactorRedirect) {
					const methods = data.twoFactorMethods ?? [];
					setPendingMethods(methods);
					setActiveMethod(methods[0] ?? "totp");
					return;
				}
				await onSignedIn();
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

	const sendOtpMutation = useMutation<GlobalResponse, Error, boolean>({
		mutationFn: (trust) => twoFactorSendOtp({ trustDevice: trust }),
	});

	const onSendOtp = async () =>
		useToastMutation({
			loading: "Sending code...",
			promise: sendOtpMutation.mutateAsync(trustDeviceField.value),
			onSuccess: async () => setOtpSent(true),
		});

	const verifyMutation = useMutation<
		GlobalResponse,
		Error,
		TwoFactorCodeValues
	>({
		mutationFn: (payload) => {
			if (useBackupCode) return twoFactorVerifyBackupCode(payload);
			if (activeMethod === "otp") return twoFactorVerifyOtp(payload);
			return twoFactorVerifyTotp(payload);
		},
	});

	const onVerify = async (payload: TwoFactorCodeValues) =>
		useToastMutation({
			loading: "Verifying...",
			promise: verifyMutation.mutateAsync(payload),
			onSuccess: onSignedIn,
			onError: async (error) => {
				setTwoFactorError("code", { message: error.message });
			},
		});

	const switchMethod = (method: "totp" | "otp") => {
		setActiveMethod(method);
		setOtpSent(false);
		setTwoFactorValue("code", "");
	};

	const toggleBackupCode = () => {
		setUseBackupCode((value) => !value);
		setTwoFactorValue("code", "");
	};

	const onBackToSignIn = () => {
		setPendingMethods(null);
		setActiveMethod("totp");
		setUseBackupCode(false);
		setOtpSent(false);
		setTwoFactorValue("code", "");
	};

	if (pendingMethods) {
		const hasBothMethods =
			pendingMethods.includes("totp") && pendingMethods.includes("otp");
		const isVerifying = verifyMutation.isPending;
		const awaitingOtpSend =
			activeMethod === "otp" && !otpSent && !useBackupCode;

		return (
			<form
				onSubmit={handleTwoFactorSubmit(onVerify)}
				className="w-full max-w-md"
			>
				<Card>
					<CardHeader>
						<CardTitle className="text-xl">Two-factor authentication</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						{!useBackupCode && hasBothMethods && (
							<div className="flex gap-2">
								<Button
									type="button"
									title="Authenticator app"
									variant={activeMethod === "totp" ? "default" : "outline"}
									className="flex-1"
									onClick={() => switchMethod("totp")}
								>
									Authenticator app
								</Button>
								<Button
									type="button"
									title="Email code"
									variant={activeMethod === "otp" ? "default" : "outline"}
									className="flex-1"
									onClick={() => switchMethod("otp")}
								>
									Email code
								</Button>
							</div>
						)}

						{useBackupCode ? (
							<Input
								required
								name="code"
								label="Backup code"
								error={code.error}
								value={code.value}
								onChange={code.onChange}
								placeholder="xxxxxxxx"
								disabled={isVerifying}
							/>
						) : awaitingOtpSend ? (
							<Button
								type="button"
								title="Email me a code"
								disabled={sendOtpMutation.isPending}
								className="w-full"
								onClick={onSendOtp}
							>
								{sendOtpMutation.isPending ? (
									<>
										<Spinner /> <span>Sending...</span>
									</>
								) : (
									<span>Email me a code</span>
								)}
							</Button>
						) : (
							<Input
								required
								name="code"
								label={
									activeMethod === "otp"
										? "Code emailed to you"
										: "Authenticator code"
								}
								error={code.error}
								value={code.value}
								onChange={code.onChange}
								placeholder="123456"
								disabled={isVerifying}
							/>
						)}

						<CheckBox
							name="trustDevice"
							label="Trust this device for 30 days"
							checked={trustDeviceField.value}
							onCheckedChange={trustDeviceField.onChange}
						/>

						{!awaitingOtpSend && (
							<Button
								type="submit"
								title="Verify"
								disabled={isVerifying}
								className="w-full"
							>
								{isVerifying ? (
									<>
										<Spinner /> <span>Verifying...</span>
									</>
								) : (
									<span>Verify</span>
								)}
							</Button>
						)}

						{activeMethod === "otp" && otpSent && !useBackupCode && (
							<Button
								type="button"
								title="Resend code"
								variant="link"
								className="h-auto p-0 text-sm"
								disabled={sendOtpMutation.isPending}
								onClick={onSendOtp}
							>
								Resend code
							</Button>
						)}

						<div className="flex items-center justify-between">
							<Button
								type="button"
								title={
									useBackupCode
										? "Use a code instead"
										: "Use a backup code instead"
								}
								variant="link"
								className="h-auto p-0 text-sm"
								onClick={toggleBackupCode}
							>
								{useBackupCode
									? "Use a code instead"
									: "Use a backup code instead"}
							</Button>
							<Button
								type="button"
								title="Back to sign in"
								variant="link"
								className="h-auto p-0 text-sm"
								onClick={onBackToSignIn}
							>
								Back to sign in
							</Button>
						</div>
					</CardContent>
				</Card>
			</form>
		);
	}

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
