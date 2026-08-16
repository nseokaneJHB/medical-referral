import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import {
	REFERRAL_STATUS,
	stringToTitleCase,
	DEFAULT_PAGE_LIMIT,
} from "@referral-tracking/shared";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Accordion,
	AccordionItem,
	AccordionTrigger,
	AccordionContent,
} from "@/components/ui/accordion";

import { TimelineList } from "@/components/custom/timeline-list";

import { QUERY_KEYS } from "@/api/constant";
import { referralsRequest, referralHistoryRequest } from "@/api/referrals";

const STATUS_VARIANT: Record<
	string,
	"default" | "info" | "success" | "warning" | "error"
> = {
	[REFERRAL_STATUS.PENDING]: "default",
	[REFERRAL_STATUS.ACCEPTED]: "info",
	[REFERRAL_STATUS.IN_PROGRESS]: "info",
	[REFERRAL_STATUS.ON_HOLD]: "warning",
	[REFERRAL_STATUS.COMPLETED]: "success",
	[REFERRAL_STATUS.REJECTED]: "error",
	[REFERRAL_STATUS.CANCELED]: "error",
};

// Only fetched once its accordion entry is actually expanded — collapsed
// entries never trigger a per-referral history request.
const VisitTimeline = ({ referralId }: { referralId: string }) => {
	const { data } = useQuery({
		queryKey: [...QUERY_KEYS.REFERRAL_HISTORY, referralId],
		queryFn: () => referralHistoryRequest({ data: { id: referralId } }),
	});

	return (
		<TimelineList
			entries={data?.data ?? []}
			emptyMessage="No status changes yet."
		/>
	);
};

interface MedicalHistoryProps {
	patientId: string;
}

/**
 * A patient's history isn't a stored field — it's every referral they've
 * had, each carrying its own visit reason, referral reason, and outcome
 * trail. Collapsed rows show the story at a glance; expanding one loads
 * that referral's timeline.
 */
export const MedicalHistory = ({ patientId }: MedicalHistoryProps) => {
	const [page, setPage] = useState(1);
	const limit = Number(DEFAULT_PAGE_LIMIT);

	const { data } = useQuery({
		queryKey: [...QUERY_KEYS.REFERRALS, "medical-history", patientId, page],
		queryFn: () =>
			referralsRequest({
				data: {
					patient_id: patientId,
					page: String(page),
					limit: String(limit),
					sort: "created_at",
					order: "desc",
				},
			}),
	});

	const referrals = data?.data ?? [];
	const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg">Medical History</CardTitle>
			</CardHeader>
			<CardContent>
				{referrals.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No visits recorded yet.
					</p>
				) : (
					<Accordion type="single" collapsible>
						{referrals.map((referral) => (
							<AccordionItem key={referral.id} value={referral.id}>
								<AccordionTrigger>
									<div className="flex flex-1 flex-wrap items-center justify-between gap-2 pr-2">
										<span>
											{new Date(referral.created_at).toLocaleDateString()}{" "}
											&middot; {referral.destination_facility.name}
										</span>
										<Badge variant={STATUS_VARIANT[referral.status]}>
											{stringToTitleCase(referral.status)}
										</Badge>
									</div>
								</AccordionTrigger>
								<AccordionContent className="space-y-3">
									<p className="text-sm">
										<span className="font-medium">Why they came in: </span>
										{referral.visit_reason}
									</p>
									<p className="text-sm">
										<span className="font-medium">Reason for referral: </span>
										{referral.referral_reason}
									</p>
									<VisitTimeline referralId={referral.id} />
								</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				)}

				{totalPages > 1 && (
					<div className="flex items-center justify-between pt-4">
						<small className="text-muted-foreground">
							Page {page} of {totalPages}
						</small>
						<div className="flex gap-2">
							<Button
								size="sm"
								variant="outline"
								title="Previous page"
								disabled={page <= 1}
								onClick={() => setPage((p) => p - 1)}
							>
								<ChevronLeftIcon />
							</Button>
							<Button
								size="sm"
								variant="outline"
								title="Next page"
								disabled={page >= totalPages}
								onClick={() => setPage((p) => p + 1)}
							>
								<ChevronRightIcon />
							</Button>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
};
