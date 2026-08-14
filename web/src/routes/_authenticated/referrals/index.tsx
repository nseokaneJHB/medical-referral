import { useState } from "react";

import { createFileRoute, useNavigate } from "@tanstack/react-router";

import {
	flexRender,
	useReactTable,
	createColumnHelper,
	getCoreRowModel,
} from "@tanstack/react-table";

import { PlusIcon } from "lucide-react";

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
import { Table, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";

import { Link } from "@/components/custom/link";
import { Loader } from "@/components/custom/loader";
import { SelectInput } from "@/components/custom/select-input";
import { SearchField } from "@/components/custom/search-field";
import { VariantBadge } from "@/components/custom/variant-badge";
import { PaginationFooter } from "@/components/custom/pagination-footer";
import { SortableTableHeader } from "@/components/custom/sortable-table-header";

import { QUERY_KEYS } from "@/api/constant";
import { referralsRequest } from "@/api/referrals";
import { canCreateReferral } from "@/lib/permissions";

const columnHelper = createColumnHelper<Referral>();

const SORTABLE_COLUMNS = ["priority", "status", "created"];

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
	const response = Route.useLoaderData();

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
			cell: (info) => <VariantBadge value={info.getValue()} type="referralStatus" />,
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
										No referrals found.
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
											title="View referral"
											to={FRONTEND_URLS.REFERRAL}
											params={{ referralId: row.original.id }}
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

export const Route = createFileRoute("/_authenticated/referrals/")({
	component: ReferralsPage,
	validateSearch: referralsQuerySchema,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		const response = await context.queryClient.ensureQueryData({
			queryKey: [...QUERY_KEYS.REFERRALS, deps],
			queryFn: () => referralsRequest({ data: deps }),
		});

		return response;
	},
	pendingComponent: () => (
		<div className="flex h-64 items-center justify-center">
			<Loader text="Loading referrals..." size="md" />
		</div>
	),
});
