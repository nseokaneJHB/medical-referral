import { useState } from "react";

import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import {
	flexRender,
	useReactTable,
	createColumnHelper,
	getCoreRowModel,
} from "@tanstack/react-table";

import {
	FRONTEND_URLS,
	FACILITY_STATUS,
	stringToTitleCase,
	DEFAULT_PAGE_LIMIT,
	facilitiesQuerySchema,
	type Facility,
} from "@referral-tracking/shared";

import { Card, CardTitle, CardHeader, CardContent } from "@/components/ui/card";
import { Table, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Link } from "@/components/custom/link";
import { Loader } from "@/components/custom/loader";
import { SelectInput } from "@/components/custom/select-input";
import { SearchField } from "@/components/custom/search-field";
import { VariantBadge } from "@/components/custom/variant-badge";
import { PaginationFooter } from "@/components/custom/pagination-footer";
import { SortableTableHeader } from "@/components/custom/sortable-table-header";

import { QUERY_KEYS } from "@/api/constant";
import { facilitiesRequest } from "@/api/facilities";
import { specialtiesRequest } from "@/api/specialties";
import { isAdministrator } from "@/lib/permissions";

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
		cell: (info) => <VariantBadge value={info.getValue()} type="facilityStatus" />,
	}),
];

const SORTABLE_COLUMNS = ["name", "created"];

const FacilitiesPage = () => {
	const navigate = useNavigate({ from: Route.fullPath });

	const search = Route.useSearch();
	const response = Route.useLoaderData();

	const { data: allSpecialties } = useQuery({
		queryKey: [...QUERY_KEYS.SPECIALTIES, "picker"],
		queryFn: () => specialtiesRequest({ data: { page: "1", limit: "100" } }),
	});

	const specialtyItems =
		allSpecialties?.data.map((specialty) => ({
			value: specialty.id,
			label: specialty.name,
		})) ?? [];

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

					<SelectInput
						multiple
						searchable
						items={specialtyItems}
						placeholder="Specialty"
						value={search.specialty ? search.specialty.split(",") : []}
						onChange={(value) =>
							navigate({
								search: (prev) => ({
									...prev,
									specialty: value.length > 0 ? value.join(",") : undefined,
									page: "1",
								}),
							})
						}
						className="h-10 w-48"
						containerClassName="w-48"
					/>

					<SearchField
						value={searchInput}
						onChange={setSearchInput}
						onCommit={commitSearch}
						placeholder="Search by name or address..."
					/>
				</CardContent>
			</Card>

			<Card>
				<CardContent>
					<Table>
						<SortableTableHeader
							table={table}
							sortableColumns={SORTABLE_COLUMNS}
							activeSort={search.sort}
							activeOrder={search.order}
							onSort={toggleSort}
						/>
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

			<PaginationFooter
				page={page}
				totalPages={totalPages}
				total={response.total}
				onPrevious={() =>
					navigate({ search: (prev) => ({ ...prev, page: String(page - 1) }) })
				}
				onNext={() =>
					navigate({ search: (prev) => ({ ...prev, page: String(page + 1) }) })
				}
			/>
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
