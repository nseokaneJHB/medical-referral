import { useState } from "react";

import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";

import {
	flexRender,
	useReactTable,
	createColumnHelper,
	getCoreRowModel,
} from "@tanstack/react-table";

import {
	SearchIcon,
	ArrowUpIcon,
	ArrowDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ArrowUpDownIcon,
} from "lucide-react";

import {
	FRONTEND_URLS,
	FACILITY_STATUS,
	stringToTitleCase,
	DEFAULT_PAGE_LIMIT,
	facilitiesQuerySchema,
	type Facility,
} from "@referral-tracking/shared";

import { Card, CardTitle, CardHeader, CardContent } from "@/components/ui/card";
import {
	Table,
	TableRow,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Link } from "@/components/custom/link";
import { Loader } from "@/components/custom/loader";
import { SelectInput } from "@/components/custom/select-input";

import { QUERY_KEYS } from "@/api/constant";
import { facilitiesRequest } from "@/api/facilities";
import { isAdministrator } from "@/lib/permissions";

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

const STATUS_ITEMS = Object.values(FACILITY_STATUS).map((value) => ({
	value,
	label: stringToTitleCase(value),
}));

const columnHelper = createColumnHelper<Facility>();

const columns = [
	columnHelper.accessor("name", { header: "Name" }),
	columnHelper.accessor("address", {
		header: "Address",
		cell: (info) => info.getValue() ?? "—",
	}),
	columnHelper.accessor("status", {
		header: "Status",
		cell: (info) => (
			<Badge variant={STATUS_VARIANT[info.getValue()]}>
				{stringToTitleCase(info.getValue())}
			</Badge>
		),
	}),
];

const SORTABLE_COLUMNS = ["name", "created"];

const FacilitiesPage = () => {
	const navigate = useNavigate({ from: Route.fullPath });

	const search = Route.useSearch();
	const response = Route.useLoaderData();

	const [searchInput, setSearchInput] = useState(search.search ?? "");

	const table = useReactTable({
		columns,
		data: response.data,
		getCoreRowModel: getCoreRowModel(),
	});

	const page = Number(search.page ?? "1");
	const limit = Number(search.limit ?? DEFAULT_PAGE_LIMIT);
	const totalPages = Math.max(1, Math.ceil(response.total / limit));

	const commitSearch = () => {
		navigate({
			search: (prev) => ({
				...prev,
				search: searchInput || undefined,
				page: "1",
			}),
		});
	};

	const toggleSort = (column: string) => {
		navigate({
			search: (prev) => {
				const isActive = prev.sort === column;
				const nextOrder = isActive && prev.order === "asc" ? "desc" : "asc";
				return { ...prev, sort: column, order: nextOrder };
			},
		});
	};

	return (
		<div className="space-y-4">
			<Card className="border-0 bg-transparent px-0 py-1 shadow-none">
				<CardHeader className="px-0 py-1">
					<CardTitle className="text-2xl">Facilities</CardTitle>
				</CardHeader>
			</Card>

			<Card>
				<CardContent className="flex flex-wrap items-center gap-2">
					<Input
						value={searchInput}
						placeholder="Search by name or address..."
						onChange={(event) => setSearchInput(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") commitSearch();
						}}
						className="h-10 max-w-sm text-base"
					/>
					<Button variant="outline" title="Search" onClick={commitSearch}>
						<SearchIcon />
					</Button>

					<SelectInput
						multiple
						items={STATUS_ITEMS}
						placeholder="Status"
						value={search.status ? search.status.split(",") : []}
						onChange={(value) =>
							navigate({
								search: (prev) => ({
									...prev,
									status: value.length > 0 ? value.join(",") : undefined,
									page: "1",
								}),
							})
						}
						className="h-10 w-48"
						containerClassName="w-48"
					/>
				</CardContent>
			</Card>

			<Card>
				<CardContent>
					<Table>
						<TableHeader>
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id}>
									{headerGroup.headers.map((header) => {
										const columnId = header.column.id;
										const sortable = SORTABLE_COLUMNS.includes(columnId);
										const isActive = search.sort === columnId;

										return (
											<TableHead key={header.id}>
												{sortable ? (
													<button
														type="button"
														onClick={() => toggleSort(columnId)}
														className="flex items-center gap-1 hover:cursor-pointer"
													>
														{flexRender(
															header.column.columnDef.header,
															header.getContext(),
														)}
														{isActive ? (
															search.order === "asc" ? (
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
									<TableHead />
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{table.getRowModel().rows.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={columns.length + 1}
										className="text-muted-foreground text-center"
									>
										No facilities found.
									</TableCell>
								</TableRow>
							)}
							{table.getRowModel().rows.map((row) => (
								<TableRow key={row.id}>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
									<TableCell>
										<Link
											variant="outline"
											title="View facility"
											to={FRONTEND_URLS.FACILITY}
											params={{ facilityId: row.original.id }}
										>
											View
										</Link>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<div className="flex items-center justify-between">
				<small className="text-muted-foreground">
					Page {page} of {totalPages} &middot; {response.total} total
				</small>
				<div className="flex gap-2">
					<Button
						variant="outline"
						title="Previous page"
						disabled={page <= 1}
						onClick={() =>
							navigate({
								search: (prev) => ({ ...prev, page: String(page - 1) }),
							})
						}
					>
						<ChevronLeftIcon />
					</Button>
					<Button
						variant="outline"
						title="Next page"
						disabled={page >= totalPages}
						onClick={() =>
							navigate({
								search: (prev) => ({ ...prev, page: String(page + 1) }),
							})
						}
					>
						<ChevronRightIcon />
					</Button>
				</div>
			</div>
		</div>
	);
};

export const Route = createFileRoute("/_authenticated/facilities/")({
	component: FacilitiesPage,
	validateSearch: facilitiesQuerySchema,
	loaderDeps: ({ search }) => search,
	beforeLoad: ({ context }) => {
		if (!isAdministrator(context.user)) {
			throw redirect({ to: FRONTEND_URLS.HOME });
		}
	},
	loader: async ({ context, deps }) => {
		const response = await context.queryClient.ensureQueryData({
			queryKey: [...QUERY_KEYS.FACILITIES, deps],
			queryFn: () => facilitiesRequest({ data: deps }),
		});

		return response;
	},
	pendingComponent: () => (
		<div className="flex h-64 items-center justify-center">
			<Loader text="Loading facilities..." size="md" />
		</div>
	),
});
