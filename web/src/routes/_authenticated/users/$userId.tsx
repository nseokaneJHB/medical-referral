import { useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";

import { createFileRoute, redirect } from "@tanstack/react-router";

import { toast } from "sonner";
import {
	CopyIcon,
	KeyRoundIcon,
	CheckCircleIcon,
	ClipboardListIcon,
	PercentIcon,
} from "lucide-react";

import {
	USER_STATUS,
	FRONTEND_URLS,
	getRelativeTime,
	stringToTitleCase,
	type GlobalResponse,
	type ResetUserPasswordResponse,
	type UserSpecialtyLinkResponse,
} from "@referral-tracking/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogTitle,
	DialogFooter,
	DialogHeader,
	DialogContent,
	DialogDescription,
} from "@/components/ui/dialog";

import { BackLink } from "@/components/back-link";
import { StatCard } from "@/components/custom/stat-card";
import { ReadOnlyField } from "@/components/custom/read-only-field";
import { SpecialtyManager } from "@/components/specialties/specialty-manager";

import { useToastMutation } from "@/hooks/use-toast-mutation";

import {
	isDoctor,
	isNurse,
	canManageUsers,
	isAdministrator,
	canManageStaffSpecialties,
} from "@/lib/permissions";

import { QUERY_KEYS } from "@/api/constant";
import { userRequest, resetUserPassword } from "@/api/users";
import {
	specialtiesRequest,
	assignUserSpecialty,
	unassignUserSpecialty,
	userSpecialtiesRequest,
} from "@/api/specialties";

/**
 * Administrator-only: regenerate this user's password — the recovery path
 * when a temporary password (from account creation or a prior reset) is
 * lost before being shared, since it's never recoverable once hashed.
 * Re-clickable rather than persisted: nothing stores the generated
 * password anywhere, so if it's lost again the fix is another reset, not
 * a lookup — same two-stage confirm-then-reveal-once shape as
 * `CreateUserDialog` on `/users`.
 */
const ResetPasswordAction = ({
	userId,
	passwordSetAt,
}: {
	userId: string;
	passwordSetAt: string | null;
}) => {
	const [open, setOpen] = useState(false);
	const [result, setResult] = useState<
		ResetUserPasswordResponse["data"] | null
	>(null);

	const resetMutation = useMutation<ResetUserPasswordResponse, Error, void>({
		mutationFn: () => resetUserPassword(userId),
	});

	const onConfirm = async () => {
		const response = await resetMutation.mutateAsync();
		setResult(response.data);
	};

	const onOpenChange = (next: boolean) => {
		setOpen(next);
		if (!next) setResult(null);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<Button
				type="button"
				variant="outline"
				title="Reset password"
				onClick={() => setOpen(true)}
			>
				<KeyRoundIcon />
				<span>Reset password</span>
			</Button>
			<DialogContent>
				{result ? (
					<>
						<DialogHeader>
							<DialogTitle>Password reset</DialogTitle>
							<DialogDescription>
								Share this new temporary password with {result.user.name} — it
								won&apos;t be shown again.
							</DialogDescription>
						</DialogHeader>
						<div className="flex items-center gap-2 rounded-md border p-2 font-mono text-sm">
							<span className="flex-1 break-all">
								{result.temporary_password}
							</span>
							<Button
								type="button"
								variant="outline"
								size="sm"
								title="Copy password"
								onClick={() => {
									navigator.clipboard.writeText(result.temporary_password);
									toast.success("Password copied to clipboard");
								}}
							>
								<CopyIcon />
							</Button>
						</div>
						<DialogFooter>
							<Button
								type="button"
								title="Done"
								onClick={() => onOpenChange(false)}
							>
								<span>Done</span>
							</Button>
						</DialogFooter>
					</>
				) : (
					<>
						<DialogHeader>
							<DialogTitle>Reset password?</DialogTitle>
							<DialogDescription>
								This immediately invalidates their current password and issues a
								new one-time temporary password.
								{passwordSetAt && (
									<>
										{" "}
										Current password was set {getRelativeTime(passwordSetAt)}.
									</>
								)}
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button
								type="button"
								title="Reset password"
								disabled={resetMutation.isPending}
								onClick={onConfirm}
							>
								{resetMutation.isPending ? (
									<>
										<Spinner /> <span>Resetting...</span>
									</>
								) : (
									<span>Reset password</span>
								)}
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
};

const UserDetailPage = () => {
	const { user: viewer, queryClient } = Route.useRouteContext();
	const response = Route.useLoaderData();
	const user = response.data;

	const isClinical = isDoctor(user) || isNurse(user);

	const { data: specialtiesResponse } = useQuery({
		queryKey: [...QUERY_KEYS.USER_SPECIALTIES, user.id],
		queryFn: () => userSpecialtiesRequest({ data: { id: user.id } }),
		enabled: isClinical,
	});

	const { data: allSpecialtiesResponse } = useQuery({
		queryKey: [...QUERY_KEYS.SPECIALTIES, "picker"],
		queryFn: () => specialtiesRequest({ data: { page: "1", limit: "100" } }),
		enabled: isClinical,
	});

	const assignSpecialtyMutation = useMutation<
		UserSpecialtyLinkResponse,
		Error,
		string
	>({
		mutationFn: (specialtyId) =>
			assignUserSpecialty(user.id, { specialty_id: specialtyId }),
	});

	const unassignSpecialtyMutation = useMutation<GlobalResponse, Error, string>({
		mutationFn: (specialtyId) => unassignUserSpecialty(user.id, specialtyId),
	});

	const onSpecialtiesChanged = async () => {
		await queryClient.invalidateQueries({
			queryKey: [...QUERY_KEYS.USER_SPECIALTIES, user.id],
		});
	};

	const handleAssignSpecialty = async (specialtyId: string): Promise<void> => {
		await useToastMutation({
			loading: "Assigning specialty...",
			promise: assignSpecialtyMutation.mutateAsync(specialtyId),
			onSuccess: onSpecialtiesChanged,
		});
	};

	const handleUnassignSpecialty = async (link: {
		specialty: { id: string };
	}): Promise<void> => {
		await useToastMutation({
			loading: "Removing specialty...",
			promise: unassignSpecialtyMutation.mutateAsync(link.specialty.id),
			onSuccess: onSpecialtiesChanged,
		});
	};

	const profileCard = (
		<Card>
			<CardHeader className="flex items-center justify-between">
				<CardTitle className="text-xl">{user.name ?? user.email}</CardTitle>
				<div className="flex items-center gap-3">
					<Badge
						variant={user.status === USER_STATUS.ACTIVE ? "success" : "error"}
					>
						{stringToTitleCase(user.status)}
					</Badge>
					{isAdministrator(viewer) && (
						<ResetPasswordAction
							userId={user.id}
							passwordSetAt={
								(user.password_set_at as unknown as string | null) ?? null
							}
						/>
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-4 sm:grid-cols-2">
					<ReadOnlyField label="Name" value={user.name} />
					<ReadOnlyField label="Email" value={user.email} />
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<ReadOnlyField label="Role" value={stringToTitleCase(user.role)} />
					<ReadOnlyField label="Facility" value={user.facility?.name} />
				</div>

				<ReadOnlyField
					label="Joined"
					value={new Date(user.created_at).toLocaleDateString()}
				/>
			</CardContent>
		</Card>
	);

	return (
		<div className="space-y-4">
			<BackLink label="Back to users" fallbackTo={FRONTEND_URLS.USERS} />

			{isDoctor(user) && user.stats && (
				<div className="grid gap-4 sm:grid-cols-3">
					<StatCard
						icon={ClipboardListIcon}
						label="Referrals handled"
						value={String(user.stats.total_referrals)}
					/>
					<StatCard
						icon={CheckCircleIcon}
						label="Completed"
						value={String(user.stats.completed_referrals)}
					/>
					<StatCard
						icon={PercentIcon}
						label="Completion rate"
						value={`${Math.round(user.stats.completion_rate * 100)}%`}
					/>
				</div>
			)}

			{isClinical ? (
				<div className="grid gap-4 lg:grid-cols-3">
					<div className="lg:col-span-2">{profileCard}</div>
					<Card className="lg:col-span-1">
						<CardHeader>
							<CardTitle className="text-lg">Specialties</CardTitle>
						</CardHeader>
						<CardContent>
							<SpecialtyManager
								assigned={specialtiesResponse?.data ?? []}
								allSpecialties={allSpecialtiesResponse?.data ?? []}
								editable={canManageStaffSpecialties(viewer, user)}
								onAssign={handleAssignSpecialty}
								onUnassign={handleUnassignSpecialty}
							/>
						</CardContent>
					</Card>
				</div>
			) : (
				profileCard
			)}
		</div>
	);
};

export const Route = createFileRoute("/_authenticated/users/$userId")({
	component: UserDetailPage,
	beforeLoad: ({ context }) => {
		if (!canManageUsers(context.user)) {
			throw redirect({ to: FRONTEND_URLS.HOME });
		}
	},
	loader: async ({ context, params }) => {
		const response = await context.queryClient.ensureQueryData({
			queryKey: [...QUERY_KEYS.USER, params.userId],
			queryFn: () => userRequest({ data: { id: params.userId } }),
		});

		return response;
	},
});
