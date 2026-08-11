import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { SaveIcon } from "lucide-react";

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

import { useFormField } from "@/hooks/use-form-field";
import { useToastMutation } from "@/hooks/use-toast-mutation";

import { QUERY_KEYS } from "@/api/constant";
import { facilityRequest, updateFacility } from "@/api/facilities";

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

const FacilityDetailPage = () => {
	const router = useRouter();
	const { queryClient } = Route.useRouteContext();
	const response = Route.useLoaderData();
	const facility = response.data;

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

	const onSubmit = async (payload: UpdateFacilityBody) =>
		useToastMutation({
			loading: "Saving facility...",
			promise: updateFacilityMutation.mutateAsync(payload),
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: QUERY_KEYS.FACILITIES,
				});
				await queryClient.invalidateQueries({
					queryKey: [...QUERY_KEYS.FACILITY, facility.id],
				});
				/**
				 * Without `sync: true`, `router.invalidate()` reloads in the
				 * background rather than blocking — `await`ing it would resolve
				 * before the refetch actually lands, leaving the page stale.
				 */
				await router.invalidate({ sync: true });
			},
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
						<Badge variant={STATUS_VARIANT[facility.status]}>
							{stringToTitleCase(facility.status)}
						</Badge>
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
