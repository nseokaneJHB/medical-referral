import type { ReactNode } from "react";

import { EllipsisVerticalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * A table row's actions collapsed behind a single kebab-menu trigger —
 * replaces stacked per-row buttons (view/approve/reject/...) with one
 * "Actions" column across Users/Appeals/Transfers.
 */
export const RowActionsMenu = ({
	label = "Actions",
	children,
}: {
	label?: string;
	children: ReactNode;
}) => (
	<DropdownMenu>
		<DropdownMenuTrigger asChild>
			<Button type="button" variant="ghost" size="icon-sm" title={label}>
				<EllipsisVerticalIcon />
				<span className="sr-only">{label}</span>
			</Button>
		</DropdownMenuTrigger>
		<DropdownMenuContent align="end">{children}</DropdownMenuContent>
	</DropdownMenu>
);
