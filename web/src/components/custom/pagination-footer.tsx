import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PaginationFooterProps {
	page: number;
	totalPages: number;
	total: number;
	onPrevious: () => void;
	onNext: () => void;
}

export const PaginationFooter = ({
	page,
	totalPages,
	total,
	onPrevious,
	onNext,
}: PaginationFooterProps) => (
	<div className="flex items-center justify-between">
		<small className="text-muted-foreground">
			Page {page} of {totalPages} &middot; {total} total
		</small>
		<div className="flex gap-2">
			<Button
				variant="outline"
				title="Previous page"
				disabled={page <= 1}
				onClick={onPrevious}
			>
				<ChevronLeftIcon />
			</Button>
			<Button
				variant="outline"
				title="Next page"
				disabled={page >= totalPages}
				onClick={onNext}
			>
				<ChevronRightIcon />
			</Button>
		</div>
	</div>
);
