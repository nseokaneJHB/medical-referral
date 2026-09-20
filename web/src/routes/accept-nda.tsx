import {
	redirect,
	useRouter,
	useNavigate,
	createFileRoute,
} from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";

import { z } from "zod";
import { useForm, useController } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { ShieldCheckIcon } from "lucide-react";

import {
	NDA_VERSION,
	FRONTEND_URLS,
	type AcceptNdaBody,
	type GlobalResponse,
} from "@referral-tracking/shared";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { CheckBox } from "@/components/custom/check-box";
import { Navigation } from "@/components/navigation";
import { SignOutButton } from "@/components/sign-out-button";

import { useToastMutation } from "@/hooks/use-toast-mutation";

import { QUERY_KEYS } from "@/api/constant";
import { acceptNda } from "@/api/account";

const acceptNdaFormSchema = z.object({
	acknowledged: z.boolean().refine((value) => value === true, {
		message: "You must acknowledge the NDA to continue.",
	}),
});

type AcceptNdaFormValues = z.infer<typeof acceptNdaFormSchema>;

const AcceptNdaPage = () => {
	const router = useRouter();
	const navigate = useNavigate();

	const { queryClient } = Route.useRouteContext();

	const { control, handleSubmit } = useForm<AcceptNdaFormValues>({
		mode: "onChange",
		resolver: zodResolver(acceptNdaFormSchema),
		defaultValues: { acknowledged: false },
	});

	const { field: acknowledged, fieldState: acknowledgedState } = useController({
		name: "acknowledged",
		control,
	});

	const acceptNdaMutation = useMutation<GlobalResponse, Error, AcceptNdaBody>({
		mutationFn: acceptNda,
	});

	const onSubmit = async () =>
		useToastMutation({
			loading: "Recording your acceptance...",
			promise: acceptNdaMutation.mutateAsync({}),
			onSuccess: async () => {
				queryClient.removeQueries({ queryKey: QUERY_KEYS.ME });
				await router.invalidate();
				navigate({ to: FRONTEND_URLS.HOME });
			},
		});

	const isLoading = acceptNdaMutation.isPending;

	return (
		<div className="flex flex-1 grow flex-col">
			<Navigation />
			<main className="mx-auto w-full max-w-lg flex-1 space-y-4 p-4">
				<form onSubmit={handleSubmit(onSubmit)}>
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-xl">
								<ShieldCheckIcon className="h-5 w-5" />
								<span>Non-disclosure agreement</span>
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="text-muted-foreground max-h-64 overflow-y-auto rounded-md border p-3 text-sm">
								<p>
									By continuing, you agree not to disclose, copy, or use any
									patient or referral information you access through this system
									— including anything surfaced by the chatbot — for any purpose
									outside your official duties. Unauthorized disclosure may
									result in account suspension and further action.
								</p>
							</div>

							<CheckBox
								name="acknowledged"
								label="I have read and agree to this NDA"
								checked={acknowledged.value}
								onCheckedChange={acknowledged.onChange}
								disabled={isLoading}
							/>
							{acknowledgedState.error && (
								<p className="text-destructive text-sm">
									{acknowledgedState.error.message}
								</p>
							)}

							<Button
								type="submit"
								title="Accept NDA"
								disabled={isLoading}
								className="w-full"
							>
								{isLoading ? (
									<>
										<Spinner /> <span>Recording acceptance...</span>
									</>
								) : (
									<span>Accept and continue</span>
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

export const Route = createFileRoute("/accept-nda")({
	component: AcceptNdaPage,
	beforeLoad: ({ context }) => {
		if (!context.user) throw redirect({ to: FRONTEND_URLS.SIGN_IN });
		if (context.user.nda_accepted_version === NDA_VERSION)
			throw redirect({ to: FRONTEND_URLS.HOME });
	},
});
