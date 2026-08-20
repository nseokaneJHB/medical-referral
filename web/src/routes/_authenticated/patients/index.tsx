import { useState } from "react";

import {
	createFileRoute,
	useNavigate,
	Link as RouterLink,
} from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import {
	useReactTable,
	createColumnHelper,
	getCoreRowModel,
} from "@tanstack/react-table";

import { PlusIcon, EyeIcon, UsersIcon, UserPlusIcon } from "lucide-react";

import {
	GENDER,
	FRONTEND_URLS,
	stringToTitleCase,
	DEFAULT_PAGE_LIMIT,
	patientsQuerySchema,
	type Patient,
} from "@referral-tracking/shared";

import { Card, CardTitle, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { TableHead } from "@/components/ui/table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

import { Link } from "@/components/custom/link";
import { Loader } from "@/components/custom/loader";
import { StatCard } from "@/components/custom/stat-card";
import { Table } from "@/components/custom/table";
import { SelectInput } from "@/components/custom/select-input";
import { SearchField } from "@/components/custom/search-field";
import { RowActionsMenu } from "@/components/custom/row-actions-menu";
import { PaginationFooter } from "@/components/custom/pagination-footer";

import { QUERY_KEYS } from "@/api/constant";
import { patientsRequest } from "@/api/patients";
import { isNurse } from "@/lib/permissions";

const GENDER_ITEMS = Object.values(GENDER).map((value) => ({
	value,
	label: stringToTitleCase(value),
}));

const columnHelper = createColumnHelper<Patient>();

const columns = [
	columnHelper.accessor("first_name", { header: "First name" }),
	columnHelper.accessor("last_name", { header: "Last name" }),
	columnHelper.accessor("date_of_birth", { header: "Date of birth" }),
	columnHelper.accessor("gender", {
		header: "Gender",
		cell: (info) => info.getValue() ?? "—",
	}),
	columnHelper.accessor("phone", {
		header: "Phone",
		cell: (info) => info.getValue() ?? "—",
	}),
	columnHelper.accessor("creator", {
		header: "Registered by",
		cell: (info) => info.getValue().name ?? "—",
	}),
];

const SORTABLE_COLUMNS = [
	"first_name",
	"last_name",
	"date_of_birth",
	"created_at",
];

const PatientsPage = () => {
	const navigate = useNavigate({ from: Route.fullPath });

	const { user } = Route.useRouteContext();
	const search = Route.useSearch();

	/**
	 * `useSuspenseQuery` (not `Route.useLoaderData()`) deliberately — the
	 * loader's `ensureQueryData` primes this exact cache entry, so this
	 * doesn't cost an extra fetch, but unlike `useLoaderData` it's a live
	 * subscription: the detail page's `invalidateQueries` after a mutation
	 * (e.g. flag/unflag) is enough on its own to make this list re-render
	 * with fresh data. `useLoaderData` reads a snapshot from the router's
	 * own match cache, which isn't subscribed to query-cache invalidation
	 * at all — a change made on the detail page would toast success there
	 * but leave this list showing stale data indefinitely.
	 */
	const { data: response } = useSuspenseQuery({
		queryKey: [...QUERY_KEYS.PATIENTS, search],
		queryFn: () => patientsRequest({ data: search }),
	});

	const [searchInput, setSearchInput] = useState(search.search ?? "");

	const canCreate = isNurse(user);

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
				<CardHeader className="flex items-center justify-between px-0 py-1">
					<CardTitle className="text-2xl">Patients</CardTitle>
					{canCreate && (
						<Link
							variant="default"
							title="Register patient"
							to={FRONTEND_URLS.NEW_PATIENT}
						>
							<PlusIcon />
							<span>Register patient</span>
						</Link>
					)}
				</CardHeader>
			</Card>

			<div className="grid gap-4 sm:grid-cols-2">
				<StatCard
					icon={UsersIcon}
					value={String(response.total)}
					label="Total patients"
				/>
				<StatCard
					icon={UserPlusIcon}
					value={String(response.registered_this_period)}
					label="Registered this month"
				/>
			</div>

			<Card>
				<CardContent className="flex flex-wrap items-end gap-2">
					<SelectInput
						multiple
						items={GENDER_ITEMS}
						placeholder="Gender"
						value={search.gender ? search.gender.split(",") : []}
						onChange={(value) =>
							navigate({
								search: (prev) => ({
									...prev,
									gender: value.length > 0 ? value.join(",") : undefined,
									page: "1",
								}),
							})
						}
						className="h-10 w-40"
						containerClassName="w-40"
					/>

					<Field className="w-fit gap-1">
						<FieldLabel>Born from</FieldLabel>
						<Input
							type="date"
							value={search.dob_from ?? ""}
							onChange={(event) =>
								navigate({
									search: (prev) => ({
										...prev,
										dob_from: event.target.value || undefined,
										page: "1",
									}),
								})
							}
							className="h-10 text-base"
						/>
					</Field>
					<Field className="w-fit gap-1">
						<FieldLabel>Born to</FieldLabel>
						<Input
							type="date"
							value={search.dob_to ?? ""}
							onChange={(event) =>
								navigate({
									search: (prev) => ({
										...prev,
										dob_to: event.target.value || undefined,
										page: "1",
									}),
								})
							}
							className="h-10 text-base"
						/>
					</Field>

					<SearchField
						value={searchInput}
						onChange={setSearchInput}
						onCommit={commitSearch}
						onClear={clearSearch}
						placeholder="Search by name or phone..."
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
						emptyMessage="No patients found."
						trailingHeader={
							<TableHead className="text-right">Actions</TableHead>
						}
						rowActionClassName="text-right"
						rowAction={(row) => (
							<RowActionsMenu
								label={`Actions for ${row.original.first_name} ${row.original.last_name}`}
							>
								<DropdownMenuItem asChild>
									<RouterLink
										to={FRONTEND_URLS.PATIENT}
										params={{ patientId: row.original.id }}
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

export const Route = createFileRoute("/_authenticated/patients/")({
	component: PatientsPage,
	validateSearch: patientsQuerySchema,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		const response = await context.queryClient.ensureQueryData({
			queryKey: [...QUERY_KEYS.PATIENTS, deps],
			queryFn: () => patientsRequest({ data: deps }),
		});

		return response;
	},
	pendingComponent: () => (
		<div className="flex h-64 items-center justify-center">
			<Loader text="Loading patients..." size="md" />
		</div>
	),
});
