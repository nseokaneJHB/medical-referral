import { useState } from "react";

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { QRCodeSVG } from "qrcode.react";

import {
	ShieldIcon,
	QrCodeIcon,
	KeyRoundIcon,
	ShieldOffIcon,
	ShieldCheckIcon,
} from "lucide-react";

import {
	type GlobalResponse,
	twoFactorVerifyCodeSchema,
	type TwoFactorEnableResponse,
	type TwoFactorVerifyCodeBody,
	twoFactorPasswordConfirmSchema,
	type TwoFactorGetTotpUriResponse,
	type TwoFactorPasswordConfirmBody,
	type TwoFactorGenerateBackupCodesResponse,
} from "@referral-tracking/shared";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
	Card,
	CardTitle,
	CardHeader,
	CardContent,
	CardDescription,
} from "@/components/ui/card";
import {
	Dialog,
	DialogTitle,
	DialogFooter,
	DialogHeader,
	DialogContent,
	DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

import { Input } from "@/components/custom/input";

import { useFormField } from "@/hooks/use-form-field";
import { useToastMutation } from "@/hooks/use-toast-mutation";

import { QUERY_KEYS } from "@/api/constant";
import { twoFactorVerifyTotp } from "@/api/auth";
import {
	twoFactorEnable,
	twoFactorDisable,
	twoFactorGetTotpUri,
	twoFactorGenerateBackupCodes,
} from "@/api/account";

/** Only used by disable — enroll, view-QR, and regenerate-backup-codes each have their own richer post-success displays. */
const PasswordConfirmDialog = ({
	open,
	title,
	description,
	confirmLabel,
	variant = "default",
	mutationFn,
	onOpenChange,
	onSuccess,
}: {
	open: boolean;
	title: string;
	description: string;
	confirmLabel: string;
	variant?: "default" | "error-outline";
	mutationFn: (
		payload: TwoFactorPasswordConfirmBody,
	) => Promise<GlobalResponse>;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => Promise<void>;
}) => {
	const { control, handleSubmit, reset, setError } =
		useForm<TwoFactorPasswordConfirmBody>({
			mode: "onChange",
			resolver: zodResolver(twoFactorPasswordConfirmSchema),
			defaultValues: { password: "" },
		});

	const password = useFormField({ name: "password", control });

	const mutation = useMutation<
		GlobalResponse,
		Error,
		TwoFactorPasswordConfirmBody
	>({ mutationFn });

	const onSubmit = async (values: TwoFactorPasswordConfirmBody) =>
		useToastMutation({
			loading: `${confirmLabel}...`,
			promise: mutation.mutateAsync(values),
			onSuccess: async () => {
				reset();
				onOpenChange(false);
				await onSuccess();
			},
			onError: async (error) => {
				setError("password", { message: error.message });
			},
		});

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) reset();
				onOpenChange(next);
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<Input
						required
						type="password"
						name="password"
						label="Password"
						error={password.error}
						value={password.value}
						onChange={password.onChange}
						placeholder="********"
						disabled={mutation.isPending}
					/>
					<DialogFooter>
						<Button
							type="submit"
							title={confirmLabel}
							variant={variant}
							disabled={mutation.isPending}
						>
							{mutation.isPending ? (
								<>
									<Spinner /> <span>{confirmLabel}...</span>
								</>
							) : (
								<span>{confirmLabel}</span>
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

const BackupCodesList = ({ codes }: { codes: string[] }) => (
	<div className="bg-muted grid grid-cols-2 gap-2 rounded-md p-4 font-mono text-sm">
		{codes.map((backupCode) => (
			<span key={backupCode}>{backupCode}</span>
		))}
	</div>
);

const EnableTwoFactorDialog = ({
	open,
	onOpenChange,
	onEnabled,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onEnabled: () => Promise<void>;
}) => {
	const [enrollment, setEnrollment] = useState<
		TwoFactorEnableResponse["data"] | null
	>(null);

	const passwordForm = useForm<TwoFactorPasswordConfirmBody>({
		mode: "onChange",
		resolver: zodResolver(twoFactorPasswordConfirmSchema),
		defaultValues: { password: "" },
	});
	const password = useFormField({
		name: "password",
		control: passwordForm.control,
	});

	const codeForm = useForm<TwoFactorVerifyCodeBody>({
		mode: "onChange",
		resolver: zodResolver(twoFactorVerifyCodeSchema),
		defaultValues: { code: "" },
	});
	const code = useFormField({ name: "code", control: codeForm.control });

	const enableMutation = useMutation<
		TwoFactorEnableResponse,
		Error,
		TwoFactorPasswordConfirmBody
	>({ mutationFn: twoFactorEnable });

	const confirmMutation = useMutation<
		GlobalResponse,
		Error,
		TwoFactorVerifyCodeBody
	>({ mutationFn: twoFactorVerifyTotp });

	const reset = () => {
		setEnrollment(null);
		passwordForm.reset();
		codeForm.reset();
	};

	const onSubmitPassword = async (values: TwoFactorPasswordConfirmBody) =>
		useToastMutation({
			loading: "Starting enrollment...",
			promise: enableMutation.mutateAsync(values),
			onSuccess: async (result) => setEnrollment(result.data),
			onError: async (error) => {
				passwordForm.setError("password", { message: error.message });
			},
		});

	const onSubmitCode = async (values: TwoFactorVerifyCodeBody) =>
		useToastMutation({
			loading: "Confirming...",
			promise: confirmMutation.mutateAsync(values),
			onSuccess: async () => {
				reset();
				onOpenChange(false);
				await onEnabled();
			},
			onError: async (error) => {
				codeForm.setError("code", { message: error.message });
			},
		});

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) reset();
				onOpenChange(next);
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Enable two-factor authentication</DialogTitle>
					<DialogDescription>
						{enrollment
							? "Scan this with your authenticator app, save your backup codes, then confirm with a generated code."
							: "Confirm your password to start."}
					</DialogDescription>
				</DialogHeader>

				{!enrollment ? (
					<form
						onSubmit={passwordForm.handleSubmit(onSubmitPassword)}
						className="space-y-4"
					>
						<Input
							required
							type="password"
							name="password"
							label="Password"
							error={password.error}
							value={password.value}
							onChange={password.onChange}
							placeholder="********"
							disabled={enableMutation.isPending}
						/>
						<DialogFooter>
							<Button
								type="submit"
								title="Continue"
								disabled={enableMutation.isPending}
							>
								{enableMutation.isPending ? (
									<>
										<Spinner /> <span>Starting...</span>
									</>
								) : (
									<span>Continue</span>
								)}
							</Button>
						</DialogFooter>
					</form>
				) : (
					<form
						onSubmit={codeForm.handleSubmit(onSubmitCode)}
						className="space-y-4"
					>
						<div className="flex justify-center">
							<div className="rounded-md bg-white p-4">
								<QRCodeSVG value={enrollment.totpURI} size={180} />
							</div>
						</div>

						<p className="text-muted-foreground text-sm">
							Save these backup codes somewhere safe — each can be used once if
							you lose access to your authenticator app.
						</p>
						<BackupCodesList codes={enrollment.backupCodes} />

						<Separator />

						<Input
							required
							name="code"
							label="Code from your authenticator app"
							error={code.error}
							value={code.value}
							onChange={code.onChange}
							placeholder="123456"
							disabled={confirmMutation.isPending}
						/>
						<DialogFooter>
							<Button
								type="submit"
								title="Confirm and enable"
								disabled={confirmMutation.isPending}
							>
								{confirmMutation.isPending ? (
									<>
										<Spinner /> <span>Confirming...</span>
									</>
								) : (
									<span>Confirm and enable</span>
								)}
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
};

const ViewQrCodeDialog = ({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) => {
	const [totpURI, setTotpURI] = useState<string | null>(null);

	const { control, handleSubmit, reset, setError } =
		useForm<TwoFactorPasswordConfirmBody>({
			mode: "onChange",
			resolver: zodResolver(twoFactorPasswordConfirmSchema),
			defaultValues: { password: "" },
		});
	const password = useFormField({ name: "password", control });

	const mutation = useMutation<
		TwoFactorGetTotpUriResponse,
		Error,
		TwoFactorPasswordConfirmBody
	>({ mutationFn: twoFactorGetTotpUri });

	const onSubmit = async (values: TwoFactorPasswordConfirmBody) =>
		useToastMutation({
			loading: "Loading QR code...",
			promise: mutation.mutateAsync(values),
			onSuccess: async (result) => setTotpURI(result.data.totpURI),
			onError: async (error) => {
				setError("password", { message: error.message });
			},
		});

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) {
					reset();
					setTotpURI(null);
				}
				onOpenChange(next);
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>View QR code</DialogTitle>
					<DialogDescription>
						Re-scan on a new device without changing your existing setup.
					</DialogDescription>
				</DialogHeader>

				{!totpURI ? (
					<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
						<Input
							required
							type="password"
							name="password"
							label="Password"
							error={password.error}
							value={password.value}
							onChange={password.onChange}
							placeholder="********"
							disabled={mutation.isPending}
						/>
						<DialogFooter>
							<Button
								type="submit"
								title="Show QR code"
								disabled={mutation.isPending}
							>
								{mutation.isPending ? (
									<>
										<Spinner /> <span>Loading...</span>
									</>
								) : (
									<span>Show QR code</span>
								)}
							</Button>
						</DialogFooter>
					</form>
				) : (
					<div className="flex justify-center">
						<div className="rounded-md bg-white p-4">
							<QRCodeSVG value={totpURI} size={180} />
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
};

const RegenerateBackupCodesDialog = ({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) => {
	const [codes, setCodes] = useState<string[] | null>(null);

	const { control, handleSubmit, reset, setError } =
		useForm<TwoFactorPasswordConfirmBody>({
			mode: "onChange",
			resolver: zodResolver(twoFactorPasswordConfirmSchema),
			defaultValues: { password: "" },
		});
	const password = useFormField({ name: "password", control });

	const mutation = useMutation<
		TwoFactorGenerateBackupCodesResponse,
		Error,
		TwoFactorPasswordConfirmBody
	>({ mutationFn: twoFactorGenerateBackupCodes });

	const onSubmit = async (values: TwoFactorPasswordConfirmBody) =>
		useToastMutation({
			loading: "Generating new backup codes...",
			promise: mutation.mutateAsync(values),
			onSuccess: async (result) => setCodes(result.data.backupCodes),
			onError: async (error) => {
				setError("password", { message: error.message });
			},
		});

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) {
					reset();
					setCodes(null);
				}
				onOpenChange(next);
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Regenerate backup codes</DialogTitle>
					<DialogDescription>
						Your existing backup codes stop working the moment you do this.
					</DialogDescription>
				</DialogHeader>

				{!codes ? (
					<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
						<Input
							required
							type="password"
							name="password"
							label="Password"
							error={password.error}
							value={password.value}
							onChange={password.onChange}
							placeholder="********"
							disabled={mutation.isPending}
						/>
						<DialogFooter>
							<Button
								type="submit"
								title="Regenerate"
								variant="warning-outline"
								disabled={mutation.isPending}
							>
								{mutation.isPending ? (
									<>
										<Spinner /> <span>Regenerating...</span>
									</>
								) : (
									<span>Regenerate</span>
								)}
							</Button>
						</DialogFooter>
					</form>
				) : (
					<>
						<p className="text-muted-foreground text-sm">
							Save these — each code works once.
						</p>
						<BackupCodesList codes={codes} />
						<DialogFooter>
							<Button
								type="button"
								title="Done"
								onClick={() => {
									setCodes(null);
									onOpenChange(false);
								}}
							>
								Done
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
};

const TwoFactorSection = () => {
	const router = useRouter();
	const { queryClient, user } = Route.useRouteContext();

	const [enableOpen, setEnableOpen] = useState(false);
	const [disableOpen, setDisableOpen] = useState(false);
	const [viewQrOpen, setViewQrOpen] = useState(false);
	const [regenerateOpen, setRegenerateOpen] = useState(false);

	const refreshSession = async () => {
		queryClient.removeQueries({ queryKey: QUERY_KEYS.ME });
		await router.invalidate();
	};

	const enabled = user.two_factor_enabled;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					{enabled ? (
						<ShieldCheckIcon className="text-success h-5 w-5" />
					) : (
						<ShieldOffIcon className="text-muted-foreground h-5 w-5" />
					)}
					<span>Two-factor authentication</span>
				</CardTitle>
				<CardDescription>
					{enabled
						? "Enabled — a code from your authenticator app or email is required at sign-in."
						: "Add a second step at sign-in using an authenticator app or emailed code."}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-wrap gap-2">
				{enabled ? (
					<>
						<Button
							type="button"
							title="View QR code"
							variant="outline"
							onClick={() => setViewQrOpen(true)}
						>
							<QrCodeIcon />
							<span>View QR code</span>
						</Button>
						<Button
							type="button"
							title="Regenerate backup codes"
							variant="warning-outline"
							onClick={() => setRegenerateOpen(true)}
						>
							<KeyRoundIcon />
							<span>Regenerate backup codes</span>
						</Button>
						<Button
							type="button"
							title="Disable"
							variant="error-outline"
							onClick={() => setDisableOpen(true)}
						>
							<ShieldOffIcon />
							<span>Disable</span>
						</Button>
					</>
				) : (
					<Button
						type="button"
						title="Enable"
						onClick={() => setEnableOpen(true)}
					>
						<ShieldIcon />
						<span>Enable two-factor authentication</span>
					</Button>
				)}
			</CardContent>

			<EnableTwoFactorDialog
				open={enableOpen}
				onOpenChange={setEnableOpen}
				onEnabled={refreshSession}
			/>
			<ViewQrCodeDialog open={viewQrOpen} onOpenChange={setViewQrOpen} />
			<RegenerateBackupCodesDialog
				open={regenerateOpen}
				onOpenChange={setRegenerateOpen}
			/>
			<PasswordConfirmDialog
				open={disableOpen}
				title="Disable two-factor authentication"
				description="Your account will only require a password to sign in."
				confirmLabel="Disable"
				variant="error-outline"
				mutationFn={twoFactorDisable}
				onOpenChange={setDisableOpen}
				onSuccess={refreshSession}
			/>
		</Card>
	);
};

const SettingsPage = () => {
	return (
		<div className="space-y-4">
			<Card className="border-0 bg-transparent px-0 py-1 shadow-none">
				<CardHeader className="px-0 py-1">
					<CardTitle className="text-2xl">Settings</CardTitle>
				</CardHeader>
			</Card>

			<TwoFactorSection />
		</div>
	);
};

export const Route = createFileRoute("/_authenticated/settings")({
	component: SettingsPage,
});
