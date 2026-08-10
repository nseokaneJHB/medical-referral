import { HistoryIcon } from "lucide-react";

import {
	getRelativeTime,
	stringToTitleCase,
	type Timeline,
} from "@referral-tracking/shared";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TimelineListProps {
	title?: string;
	entries: Timeline[];
	emptyMessage?: string;
}

export const TimelineList = ({
	title = "Timeline",
	entries,
	emptyMessage = "No history yet.",
}: TimelineListProps) => (
	<Card>
		<CardHeader>
			<CardTitle className="flex items-center gap-2 text-lg">
				<HistoryIcon className="h-4! w-4!" />
				<span>{title}</span>
			</CardTitle>
		</CardHeader>
		<CardContent className="max-h-96 space-y-3 overflow-y-auto">
			{entries.length === 0 ? (
				<p className="text-muted-foreground text-sm">{emptyMessage}</p>
			) : (
				entries.map((entry) => (
					<div key={entry.id} className="border-b pb-2 last:border-0 last:pb-0">
						<div className="flex flex-wrap items-center gap-2 text-sm">
							<Badge variant="info">{stringToTitleCase(entry.action)}</Badge>
							{entry.previous && entry.next && (
								<span className="font-medium">
									{stringToTitleCase(entry.previous)} &rarr;{" "}
									{stringToTitleCase(entry.next)}
								</span>
							)}
						</div>
						{entry.notes && (
							<p className="text-muted-foreground mt-1 text-sm">
								{entry.notes}
							</p>
						)}
						<small className="text-muted-foreground">
							{entry.changer.name ?? "System"} &middot;{" "}
							{getRelativeTime(entry.changed_at as unknown as string)}
						</small>
					</div>
				))
			)}
		</CardContent>
	</Card>
);
