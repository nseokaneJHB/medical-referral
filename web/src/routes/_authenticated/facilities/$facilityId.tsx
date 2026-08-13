import { useState } from "react";

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { SaveIcon, CheckIcon, XIcon, FlagIcon, BanIcon } from "lucide-react";

import {
	appealSchema,
	FRONTEND_URLS,
	FACILITY_STATUS,
	stringToTitleCase,
	UpdateFacilitySchema,
	type AppealBody,
	type TimelineResponse,
	type FacilityResponse,
	type UpdateFacilityBody,
	type GlobalResponse,
	type FacilitySpecialtyLinkResponse,
} from "@referral-tracking/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/custom/input";
import { TextArea } from "@/components/custom/text-area";
import { BackLink } from "@/components/custom/back-link";
import { TimelineList } from "@/components/custom/timeline-list";
import { SpecialtyManager } from "@/components/custom/specialty-manager";
import { ReasonActionButton } from "@/components/custom/reason-action-button";

import { useFormField } from "@/hooks/use-form-field";
import { useToastMutation } from "@/hooks/use-toast-mutation";

import { QUERY_KEYS } from "@/api/constant";
import {
	flagFacility,
	updateFacility,
	rejectFacility,
	approveFacility,
	facilityRequest,
	suspendFacility,
	fileFacilityAppeal,
	facilityHistoryRequest,
} from "@/api/facilities";
import {
	specialtiesRequest,
	assignFacilitySpecialty,
	unassignFacilitySpecialty,
	facilitySpecialtiesRequest,
} from "@/api/specialties";
import {
	isAdministrator,
	isOwnFacilityManager,
	canFileFacilityAppeal,
	canManageFacilitySpecialties,
} from "@/lib/permissions";

const STATUS_VARIANT: Record<
	string,
	"default" | "success" | "warning" | "error"
> = {
	[FACILITY_STATUS.PENDING]: "default",
	[FACILITY_STATUS.APPROVED]: "success",
	[FACILITY_STATUS.REJECTED]: "error",
	[FACILITY_STATUS.FLAGGED]: "warning",
	[FACILITY_STATUS.SUSPENDED]: "error",
};

/** Administrator-only moderation actions — which buttons show depends on the facility's current status. */
const FacilityModerationActions = ({
	facilityId,
	status,
	onChanged,
}: {
	facilityId: string;
	status: string;
	onChanged: () => Promise<void>;
}) => {
	const approveMutation = useMutation<FacilityResponse, Error, void>({
		mutationFn: () => approveFacility(facilityId, {}),
	});

	const onApprove = async () =>
		useToastMutation({
			loading: "Approving...",
			promise: approveMutation.mutateAsync(),
			onSuccess: onChanged,
		});

	if (status === FACILITY_STATUS.PENDING) {
		return (
			<div className="flex gap-2">
				<Button
					type="button"
					variant="success-outline"
					title="Approve"
					size="sm"
					disabled={approveMutation.isPending}
					onClick={onApprove}
				>
					<CheckIcon />
					<span>Approve</span>
				</Button>
				<ReasonActionButton
					label="Reject"
					title="Reject this facility"
					variant="error-outline"
					icon={XIcon}
					description="This facility's registration will be rejected — a reason is required."
					mutationFn={(reason) => rejectFacility(facilityId, { reason })}
					onChanged={onChanged}
				/>
			</div>
		);
	}

	if (status === FACILITY_STATUS.APPROVED) {
		return (
			<div className="flex gap-2">
				<ReasonActionButton
					label="Flag"
					title="Flag this facility"
					variant="warning-outline"
					icon={FlagIcon}
					description="Flagging restricts this facility to exit-only actions until it's cleared — a reason is required."
					mutationFn={(reason) => flagFacility(facilityId, { reason })}
					onChanged={onChanged}
				/>
				<ReasonActionButton
					label="Suspend"
					title="Suspend this facility"
					variant="error-outline"
					icon={BanIcon}
					description="Suspending fully freezes this facility — a reason is required."
					mutationFn={(reason) => suspendFacility(facilityId, { reason })}
					onChanged={onChanged}
				/>
			</div>
		);
	}

	if (status === FACILITY_STATUS.FLAGGED) {
		return (
			<ReasonActionButton
				label="Suspend"
				title="Suspend this facility"
				variant="error-outline"
				icon={BanIcon}
				description="Suspending fully freezes this facility — a reason is required."
				mutationFn={(reason) => suspendFacility(facilityId, { reason })}
				onChanged={onChanged}
			/>
		);
	}

	return null;
};

/** Manager-only: file an appeal against their own facility's punitive status. */
const FacilityAppealForm = ({
	onSubmitted,
}: {
	onSubmitted: () => Promise<void>;
}) => {
	const [submitted, setSubmitted] = useState(false);

	const { control, handleSubmit } = useForm<AppealBody>({
		mode: "onChange",
		resolver: zodResolver(appealSchema),
		defaultValues: { reason: "" },
	});

	const reason = useFormField({ name: "reason", control });

	const appealMutation = useMutation<TimelineResponse, Error, AppealBody>({
		mutationFn: fileFacilityAppeal,
	});

	const onSubmit = async (payload: AppealBody) =>
		useToastMutation({
			loading: "Submitting appeal...",
			promise: appealMutation.mutateAsync(payload),
			onSuccess: async () => {
				setSubmitted(true);
				await onSubmitted();
			},
		});

	if (submitted) {
		return (
			<Card>
				<CardContent className="text-muted-foreground pt-6 text-sm">
					Your appeal has been submitted and is awaiting review.
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg">File an appeal</CardTitle>
			</CardHeader>
			<form onSubmit={handleSubmit(onSubmit)}>
				<CardContent className="space-y-3">
					<TextArea
						required
						name="reason"
						label="Appeal reason"
						error={reason.error}
						value={reason.value}
						onChange={reason.onChange}
						disabled={appealMutation.isPending}
					/>
					<Button
						type="submit"
						title="Submit appeal"
						disabled={appealMutation.isPending}
					>
						{appealMutation.isPending ? <Spinner /> : null}
						<span>Submit appeal</span>
					</Button>
				</CardContent>
			</form>
		</Card>
	);
};

const FacilityDetailPage = () => {
	const { user, queryClient } = Route.useRouteContext();
	const { facilityId } = Route.useParams();

	/**
	 * `useSuspenseQuery` (not `Route.useLoaderData()`) deliberately — the
	 * loader's `ensureQueryData` primes this exact cache entry, so this
	 * doesn't cost an extra fetch, but unlike `useLoaderData` it's a live
	 * subscription: `invalidateQueries` below is enough on its own to make
	 * this page re-render with a fresh status after a moderation action.
	 */
	const { data: response } = useSuspenseQuery({
		queryKey: [...QUERY_KEYS.FACILITY, facilityId],
		queryFn: () => facilityRequest({ data: { id: facilityId } }),
	});
	const facility = response.data;

	const { data: historyResponse } = useQuery({
		queryKey: [...QUERY_KEYS.FACILITY_HISTORY, facility.id],
		queryFn: () => facilityHistoryRequest({ data: { id: facility.id } }),
	});

	const { data: specialtiesResponse } = useQuery({
		queryKey: [...QUERY_KEYS.FACILITY_SPECIALTIES, facility.id],
		queryFn: () => facilitySpecialtiesRequest({ data: { id: facility.id } }),
	});

	const { data: allSpecialtiesResponse } = useQuery({
		queryKey: [...QUERY_KEYS.SPECIALTIES, "picker"],
		queryFn: () => specialtiesRequest({ data: { page: "1", limit: "100" } }),
	});

	const assignSpecialtyMutation = useMutation<
		FacilitySpecialtyLinkResponse,
		Error,
		string
	>({
		mutationFn: (specialtyId) =>
			assignFacilitySpecialty(facility.id, { specialty_id: specialtyId }),
	});

	const unassignSpecialtyMutation = useMutation<GlobalResponse, Error, string>({
		mutationFn: (specialtyId) =>
			unassignFacilitySpecialty(facility.id, specialtyId),
	});

	const onSpecialtiesChanged = async () => {
		await queryClient.invalidateQueries({
			queryKey: [...QUERY_KEYS.FACILITY_SPECIALTIES, facility.id],
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

	const { control, handleSubmit } = useForm<UpdateFacilityBody>({
		mode: "onChange",
		resolver: zodResolver(UpdateFacilitySchema),
		defaultValues: {
			name: facility.name,
			address: facility.address,
		},
	});

	const name = useFormField({ name: "name", control });
	const address = useFormField({ name: "address", control });

	const updateFacilityMutation = useMutation<
		FacilityResponse,
		Error,
		UpdateFacilityBody
	>({
		mutationFn: (payload) => updateFacility(facility.id, payload),
	});

	const onChanged = async () => {
		await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FACILITIES });
		await queryClient.invalidateQueries({
			queryKey: [...QUERY_KEYS.FACILITY, facility.id],
		});
		await queryClient.invalidateQueries({
			queryKey: [...QUERY_KEYS.FACILITY_HISTORY, facility.id],
		});
	};

	const onSubmit = async (payload: UpdateFacilityBody) =>
		useToastMutation({
			loading: "Saving facility...",
			promise: updateFacilityMutation.mutateAsync(payload),
			onSuccess: onChanged,
			onError: async (error) => {
				if (error.errors) {
					for (const field of error.errors) {
						control.setError(field.field as keyof UpdateFacilityBody, {
							message: field.message,
						});
					}
				}
			},
		});

	const isSaving = updateFacilityMutation.isPending;
	const canModerate = isAdministrator(user);
	const canAppeal = canFileFacilityAppeal(user, facility);

	return (
		<div className="space-y-4">
			<BackLink
				label="Back to facilities"
				fallbackTo={FRONTEND_URLS.FACILITIES}
			/>

			<form onSubmit={handleSubmit(onSubmit)}>
				<Card>
					<CardHeader className="flex items-center justify-between">
						<CardTitle className="text-xl">{facility.name}</CardTitle>
						<div className="flex items-center gap-3">
							<Badge variant={STATUS_VARIANT[facility.status]}>
								{stringToTitleCase(facility.status)}
							</Badge>
							{canModerate && (
								<FacilityModerationActions
									facilityId={facility.id}
									status={facility.status}
									onChanged={onChanged}
								/>
							)}
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<Input
							required
							name="name"
							label="Name"
							error={name.error}
							value={name.value}
							onChange={name.onChange}
							disabled={isSaving}
						/>

						<TextArea
							name="address"
							label="Address"
							error={address.error}
							value={address.value}
							onChange={address.onChange}
							disabled={isSaving}
						/>

						<Button type="submit" title="Save facility" disabled={isSaving}>
							{isSaving ? (
								<>
									<Spinner /> <span>Saving...</span>
								</>
							) : (
								<>
									<SaveIcon /> <span>Save changes</span>
								</>
							)}
						</Button>
					</CardContent>
				</Card>
			</form>

			<Card>
				<CardHeader>
					<CardTitle className="text-lg">Specialties</CardTitle>
				</CardHeader>
				<CardContent>
					<SpecialtyManager
						assigned={specialtiesResponse?.data ?? []}
						allSpecialties={allSpecialtiesResponse?.data ?? []}
						editable={canManageFacilitySpecialties(user, facility)}
						onAssign={handleAssignSpecialty}
						onUnassign={handleUnassignSpecialty}
					/>
				</CardContent>
			</Card>

			{canAppeal && <FacilityAppealForm onSubmitted={onChanged} />}

			<TimelineList
				title="Facility history"
				entries={historyResponse?.data ?? []}
				emptyMessage="No history yet."
			/>
		</div>
	);
};

export const Route = createFileRoute("/_authenticated/facilities/$facilityId")({
	component: FacilityDetailPage,
	beforeLoad: ({ context, params }) => {
		const { user } = context;

		if (!isAdministrator(user) && !isOwnFacilityManager(user, params.facilityId)) {
			throw redirect({ to: FRONTEND_URLS.HOME });
		}
	},
	loader: async ({ context, params }) => {
		const response = await context.queryClient.ensureQueryData({
			queryKey: [...QUERY_KEYS.FACILITY, params.facilityId],
			queryFn: () => facilityRequest({ data: { id: params.facilityId } }),
		});

		return response;
	},
});
