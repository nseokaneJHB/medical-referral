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

import {
	PlusIcon,
	EyeIcon,
	ListIcon,
	ClockIcon,
	XCircleIcon,
	ActivityIcon,
	CheckCheckIcon,
	CircleSlashIcon,
	CheckCircleIcon,
	PauseCircleIcon,
} from "lucide-react";

import {
	PRIORITY,
	FRONTEND_URLS,
	REFERRAL_STATUS,
	referralsQuerySchema,
	stringToTitleCase,
	DEFAULT_PAGE_LIMIT,
	type Referral,
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
import { VariantBadge } from "@/components/custom/variant-badge";
import { RowActionsMenu } from "@/components/custom/row-actions-menu";
import { PaginationFooter } from "@/components/custom/pagination-footer";

import { QUERY_KEYS } from "@/api/constant";
import { referralsRequest } from "@/api/referrals";
import { canCreateReferral } from "@/lib/permissions";

const columnHelper = createColumnHelper<Referral>();

const SORTABLE_COLUMNS = ["priority", "status", "created_at"];

const STATUS_ITEMS = Object.values(REFERRAL_STATUS).map((value) => ({
	value,
	label: stringToTitleCase(value),
}));

const PRIORITY_ITEMS = Object.values(PRIORITY).map((value) => ({
	value,
	label: stringToTitleCase(value),
}));

const ReferralsPage = () => {
	const navigate = useNavigate({ from: Route.fullPath });

	const { user } = Route.useRouteContext();
	const search = Route.useSearch();

	/**
	 * `useSuspenseQuery` (not `Route.useLoaderData()`) deliberately — the
	 * loader's `ensureQueryData` primes this exact cache entry, so this
	 * doesn't cost an extra fetch, but unlike `useLoaderData` it's a live
	 * subscription: the detail page's `invalidateQueries` after a mutation
	 * (e.g. a status update) is enough on its own to make this list
	 * re-render with fresh data. `useLoaderData` reads a snapshot from the
	 * router's own match cache, which isn't subscribed to query-cache
	 * invalidation at all — a status change made on the detail page would
	 * toast success there but leave this list showing the old status
	 * indefinitely.
	 */
	const { data: response } = useSuspenseQuery({
		queryKey: [...QUERY_KEYS.REFERRALS, search],
		queryFn: () =>
			referralsRequest({
				data: {
					...search,
					tz_offset:
						typeof window !== "undefined"
							? String(new Date().getTimezoneOffset())
							: undefined,
				},
			}),
	});

	const [searchInput, setSearchInput] = useState(search.search ?? "");

	const canCreate = canCreateReferral(user);

	const columns = [
		columnHelper.accessor("patient", {
			header: "Patient",
			cell: (info) =>
				`${info.getValue().first_name} ${info.getValue().last_name}`,
		}),
		columnHelper.accessor("origin_facility", {
			header: "From",
			cell: (info) => info.getValue().name,
		}),
		columnHelper.accessor("destination_facility", {
			header: "To",
			cell: (info) => info.getValue().name,
		}),
		columnHelper.accessor("assignedDoctor", {
			header: "Assigned",
			cell: (info) => info.getValue()?.name ?? "Unassigned",
		}),
		columnHelper.accessor("priority", {
			header: "Priority",
			cell: (info) => <VariantBadge value={info.getValue()} type="priority" />,
		}),
		columnHelper.accessor("status", {
			header: "Status",
			cell: (info) => (
				<VariantBadge value={info.getValue()} type="referralStatus" />
			),
		}),
	];

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
				<CardHeader className="flex items-center justify-between px-0 py-1">
					<CardTitle className="text-2xl">Referrals</CardTitle>
					{canCreate && (
						<Link
							variant="default"
							title="Create referral"
							to={FRONTEND_URLS.NEW_REFERRAL}
						>
							<PlusIcon />
							<span>Create referral</span>
						</Link>
					)}
				</CardHeader>
			</Card>

			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<StatCard
					value={String(response.total)}
					label="Total referrals"
					icon={ListIcon}
				/>
				<StatCard
					value={String(response.status_counts.PENDING)}
					label="Pending"
					icon={ClockIcon}
				/>
				<StatCard
					value={String(response.status_counts.ACCEPTED)}
					label="Accepted"
					icon={CheckCircleIcon}
				/>
				<StatCard
					value={String(response.status_counts.IN_PROGRESS)}
					label="In progress"
					icon={ActivityIcon}
				/>
				<StatCard
					value={String(response.status_counts.ON_HOLD)}
					label="On hold"
					icon={PauseCircleIcon}
				/>
				<StatCard
					value={String(response.status_counts.COMPLETED)}
					label="Completed"
					icon={CheckCheckIcon}
				/>
				<StatCard
					value={String(response.status_counts.REJECTED)}
					label="Rejected"
					icon={XCircleIcon}
				/>
				<StatCard
					value={String(response.status_counts.CANCELED)}
					label="Canceled"
					icon={CircleSlashIcon}
				/>
			</div>

			<Card>
				<CardContent className="flex flex-wrap items-end gap-2">
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
						items={PRIORITY_ITEMS}
						placeholder="Priority"
						value={search.priority ? search.priority.split(",") : []}
						onChange={(value) =>
							navigate({
								search: (prev) => ({
									...prev,
									priority: value.length > 0 ? value.join(",") : undefined,
									page: "1",
								}),
							})
						}
						className="h-10 w-48"
						containerClassName="w-48"
					/>

					<Field className="w-fit gap-1">
						<FieldLabel>From</FieldLabel>
						<Input
							type="date"
							value={search.from ?? ""}
							onChange={(event) =>
								navigate({
									search: (prev) => ({
										...prev,
										from: event.target.value || undefined,
										page: "1",
									}),
								})
							}
							className="h-10 text-base"
						/>
					</Field>
					<Field className="w-fit gap-1">
						<FieldLabel>To</FieldLabel>
						<Input
							type="date"
							value={search.to ?? ""}
							onChange={(event) =>
								navigate({
									search: (prev) => ({
										...prev,
										to: event.target.value || undefined,
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
						placeholder="Search by reason..."
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
						emptyMessage="No referrals found."
						trailingHeader={
							<TableHead className="text-right">Actions</TableHead>
						}
						rowActionClassName="text-right"
						rowAction={(row) => (
							<RowActionsMenu
								label={`Actions for ${row.original.patient.first_name} ${row.original.patient.last_name}`}
							>
								<DropdownMenuItem asChild>
									<RouterLink
										to={FRONTEND_URLS.REFERRAL}
										params={{ referralId: row.original.id }}
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

export const Route = createFileRoute("/_authenticated/referrals/")({
	component: ReferralsPage,
	validateSearch: referralsQuerySchema,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		const tz_offset =
			typeof window !== "undefined"
				? String(new Date().getTimezoneOffset())
				: undefined;

		const response = await context.queryClient.ensureQueryData({
			queryKey: [...QUERY_KEYS.REFERRALS, deps],
			queryFn: () => referralsRequest({ data: { ...deps, tz_offset } }),
		});

		return response;
	},
	pendingComponent: () => (
		<div className="flex h-64 items-center justify-center">
			<Loader text="Loading referrals..." size="md" />
		</div>
	),
});
