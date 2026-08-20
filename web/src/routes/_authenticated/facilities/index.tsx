import { useState } from "react";

import {
	createFileRoute,
	useNavigate,
	redirect,
	Link as RouterLink,
} from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import {
	useReactTable,
	createColumnHelper,
	getCoreRowModel,
} from "@tanstack/react-table";

import {
	EyeIcon,
	BuildingIcon,
	ClockIcon,
	CheckCircleIcon,
	FlagIcon,
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
import { TableHead } from "@/components/ui/table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

import { Loader } from "@/components/custom/loader";
import { StatCard } from "@/components/custom/stat-card";
import { Table } from "@/components/custom/table";
import { SelectInput } from "@/components/custom/select-input";
import { SearchField } from "@/components/custom/search-field";
import { VariantBadge } from "@/components/custom/variant-badge";
import { RowActionsMenu } from "@/components/custom/row-actions-menu";
import { PaginationFooter } from "@/components/custom/pagination-footer";

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
		cell: (info) => (
			<VariantBadge value={info.getValue()} type="facilityStatus" />
		),
	}),
];

const SORTABLE_COLUMNS = ["name", "created_at"];

const FacilitiesPage = () => {
	const navigate = useNavigate({ from: Route.fullPath });

	const search = Route.useSearch();

	/**
	 * `useSuspenseQuery` (not `Route.useLoaderData()`) deliberately — the
	 * loader's `ensureQueryData` primes this exact cache entry, so this
	 * doesn't cost an extra fetch, but unlike `useLoaderData` it's a live
	 * subscription: the detail page's `invalidateQueries` after a
	 * moderation action (approve/reject/flag/suspend) is enough on its own
	 * to make this list re-render with fresh data. `useLoaderData` reads a
	 * snapshot from the router's own match cache, which isn't subscribed to
	 * query-cache invalidation at all — a moderation action made on the
	 * detail page would toast success there but leave this list showing the
	 * old status indefinitely.
	 */
	const { data: response } = useSuspenseQuery({
		queryKey: [...QUERY_KEYS.FACILITIES, search],
		queryFn: () => facilitiesRequest({ data: search }),
	});

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

	const clearSearch = () => {
		setSearchInput("");
		navigate({
			search: (prev) => ({
				...prev,
				search: undefined,
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

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					icon={BuildingIcon}
					value={String(response.total)}
					label="Total facilities"
				/>
				<StatCard
					icon={ClockIcon}
					value={String(response.status_counts.PENDING)}
					label="Pending"
				/>
				<StatCard
					icon={CheckCircleIcon}
					value={String(response.status_counts.APPROVED)}
					label="Approved"
				/>
				<StatCard
					icon={FlagIcon}
					value={String(response.status_counts.FLAGGED)}
					label="Flagged"
				/>
			</div>

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
						onClear={clearSearch}
						placeholder="Search by name or address..."
					/>
				</CardContent>
			</Card>

			<Card>
				<CardContent>
					<Table
						table={table}
						sortableColumns={SORTABLE_COLUMNS}
						activeSort={search.sort}
						activeOrder={search.order}
						onSort={toggleSort}
						emptyMessage="No facilities found."
						trailingHeader={
							<TableHead className="text-right">Actions</TableHead>
						}
						rowActionClassName="text-right"
						rowAction={(row) => (
							<RowActionsMenu label={`Actions for ${row.original.name}`}>
								<DropdownMenuItem asChild>
									<RouterLink
										to={FRONTEND_URLS.FACILITY}
										params={{ facilityId: row.original.id }}
									>
										<EyeIcon />
										<span>View</span>
									</RouterLink>
								</DropdownMenuItem>
							</RowActionsMenu>
						)}
					/>
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
