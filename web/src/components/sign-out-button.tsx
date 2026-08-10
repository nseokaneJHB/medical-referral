import {
	useNavigate,
	useRouter,
	useRouteContext,
} from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";

import { LogOutIcon } from "lucide-react";

import { HTTP_CODE, type GlobalResponse } from "@referral-tracking/shared";

import { Button } from "@/components/ui/button";

import { useToastMutation } from "@/hooks/use-toast-mutation";

import { QUERY_KEYS } from "@/api/constant";

import { signOut } from "@/api/auth";

export const SignOutButton = () => {
	const router = useRouter();
	const navigate = useNavigate();

	const { queryClient } = useRouteContext({ strict: false });

	const signOutMutation = useMutation<{ success: boolean }, Error>({
		mutationFn: signOut,
	});

	const handleSignOut = () =>
		useToastMutation({
			loading: `Signing out...`,
			promise: signOutMutation.mutateAsync().then(
				(): GlobalResponse => ({
					code: HTTP_CODE.OK,
					message: "Signed out.",
				}),
			),
			onSuccess: async () => {
				if (queryClient) {
					queryClient.removeQueries({ queryKey: QUERY_KEYS.ME });
				}

				await router.invalidate();
				navigate({ to: "/sign-in", replace: true });
			},
		});

	return (
		<Button
			title="Sign out"
			variant="outline"
			onClick={handleSignOut}
			className="w-full justify-start border-none bg-inherit"
		>
			<LogOutIcon />
			<span>Sign out</span>
		</Button>
	);
};
