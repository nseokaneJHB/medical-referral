import type { ReactNode } from "react";

import {
	type Table as TanstackTable,
	type Row,
	flexRender,
} from "@tanstack/react-table";

import { ArrowUpIcon, ArrowDownIcon, ArrowUpDownIcon } from "lucide-react";

import {
	Table as ShadCnTable,
	TableRow,
	TableHead,
	TableBody,
	TableCell,
	TableHeader,
} from "@/components/ui/table";

interface TableProps<TData> {
	table: TanstackTable<TData>;
	sortableColumns: string[];
	activeSort?: string;
	activeOrder?: "asc" | "desc";
	onSort: (columnId: string) => void;
	emptyMessage: string;
	trailingHeader?: ReactNode;
	rowAction?: (row: Row<TData>) => ReactNode;
	rowActionClassName?: string;
}

export const Table = <TData,>({
	table,
	sortableColumns,
	activeSort,
	activeOrder,
	onSort,
	emptyMessage,
	trailingHeader = <TableHead />,
	rowAction,
	rowActionClassName,
}: TableProps<TData>) => {
	const rows = table.getRowModel().rows;
	const columnCount = table.getAllColumns().length + (rowAction ? 1 : 0);

	return (
		<ShadCnTable>
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
										flexRender(
											header.column.columnDef.header,
											header.getContext(),
										)
									)}
								</TableHead>
							);
						})}
						{trailingHeader}
					</TableRow>
				))}
			</TableHeader>
			<TableBody>
				{rows.length === 0 && (
					<TableRow>
						<TableCell
							colSpan={columnCount}
							className="text-muted-foreground text-center"
						>
							{emptyMessage}
						</TableCell>
					</TableRow>
				)}
				{rows.map((row) => (
					<TableRow key={row.id}>
						{row.getVisibleCells().map((cell) => (
							<TableCell key={cell.id}>
								{flexRender(cell.column.columnDef.cell, cell.getContext())}
							</TableCell>
						))}
						{rowAction && (
							<TableCell className={rowActionClassName}>
								{rowAction(row)}
							</TableCell>
						)}
					</TableRow>
				))}
			</TableBody>
		</ShadCnTable>
	);
};
