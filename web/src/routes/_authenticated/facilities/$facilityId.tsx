import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { SaveIcon, CheckIcon, XIcon, FlagIcon, BanIcon } from "lucide-react";

import {
	ROLES,
	FRONTEND_URLS,
	FACILITY_STATUS,
	stringToTitleCase,
	UpdateFacilitySchema,
	type FacilityResponse,
	type UpdateFacilityBody,
} from "@referral-tracking/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/custom/input";
import { TextArea } from "@/components/custom/text-area";
import { BackLink } from "@/components/custom/back-link";
import { TimelineList } from "@/components/custom/timeline-list";
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
	facilityHistoryRequest,
} from "@/api/facilities";

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
	const isAdministrator = user.role === ROLES.ADMINISTRATOR;

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
							{isAdministrator && (
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
		const isOwnFacility =
			user.role === ROLES.MANAGER && user.facility_id === params.facilityId;

		if (user.role !== ROLES.ADMINISTRATOR && !isOwnFacility) {
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
