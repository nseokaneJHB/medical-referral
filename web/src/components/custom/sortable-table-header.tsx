import type { ReactNode } from "react";

import { type Table, flexRender } from "@tanstack/react-table";

import { ArrowUpIcon, ArrowDownIcon, ArrowUpDownIcon } from "lucide-react";

import { TableRow, TableHead, TableHeader } from "@/components/ui/table";

interface SortableTableHeaderProps<TData> {
	table: Table<TData>;
	sortableColumns: string[];
	activeSort?: string;
	activeOrder?: "asc" | "desc";
	onSort: (columnId: string) => void;
	trailingHeader?: ReactNode;
}

export const SortableTableHeader = <TData,>({
	table,
	sortableColumns,
	activeSort,
	activeOrder,
	onSort,
	trailingHeader = <TableHead />,
}: SortableTableHeaderProps<TData>) => (
	<TableHeader>
		{table.getHeaderGroups().map((headerGroup) => (
			<TableRow key={headerGroup.id}>
				{headerGroup.headers.map((header) => {
					const columnId = header.column.id;
					const sortable = sortableColumns.includes(columnId);
					const isActive = activeSort === columnId;

					return (
						<TableHead key={header.id}>
							{sortable ? (
								<button
									type="button"
									onClick={() => onSort(columnId)}
									className="flex items-center gap-1 hover:cursor-pointer"
								>
									{flexRender(
										header.column.columnDef.header,
										header.getContext(),
									)}
									{isActive ? (
										activeOrder === "asc" ? (
											<ArrowUpIcon className="h-4! w-4!" />
										) : (
											<ArrowDownIcon className="h-4! w-4!" />
										)
									) : (
										<ArrowUpDownIcon className="h-4! w-4! opacity-70" />
									)}
								</button>
							) : (
								flexRender(header.column.columnDef.header, header.getContext())
							)}
						</TableHead>
					);
				})}
				{trailingHeader}
			</TableRow>
		))}
	</TableHeader>
);
