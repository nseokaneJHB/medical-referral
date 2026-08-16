import { useMutation, useQuery } from "@tanstack/react-query";

import { createFileRoute, redirect } from "@tanstack/react-router";

import { CheckCircleIcon, ClipboardListIcon, PercentIcon } from "lucide-react";

import {
	USER_STATUS,
	FRONTEND_URLS,
	stringToTitleCase,
	type GlobalResponse,
	type UserSpecialtyLinkResponse,
} from "@referral-tracking/shared";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { BackLink } from "@/components/back-link";
import { StatCard } from "@/components/custom/stat-card";
import { ReadOnlyField } from "@/components/custom/read-only-field";
import { SpecialtyManager } from "@/components/specialties/specialty-manager";

import { useToastMutation } from "@/hooks/use-toast-mutation";

import {
	isDoctor,
	isNurse,
	canManageUsers,
	canManageStaffSpecialties,
} from "@/lib/permissions";

import { QUERY_KEYS } from "@/api/constant";
import { userRequest } from "@/api/users";
import {
	specialtiesRequest,
	assignUserSpecialty,
	unassignUserSpecialty,
	userSpecialtiesRequest,
} from "@/api/specialties";

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
				<Badge
					variant={user.status === USER_STATUS.ACTIVE ? "success" : "error"}
				>
					{stringToTitleCase(user.status)}
				</Badge>
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
