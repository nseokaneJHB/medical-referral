import { useState } from "react";

import { createFileRoute, useNavigate } from "@tanstack/react-router";

import {
	flexRender,
	useReactTable,
	createColumnHelper,
	getCoreRowModel,
} from "@tanstack/react-table";

import {
	PlusIcon,
	SearchIcon,
	ArrowUpIcon,
	ArrowDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ArrowUpDownIcon,
} from "lucide-react";

import {
	GENDER,
	FRONTEND_URLS,
	stringToTitleCase,
	DEFAULT_PAGE_LIMIT,
	patientsQuerySchema,
	type Patient,
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
import { Field, FieldLabel } from "@/components/ui/field";

import { Link } from "@/components/custom/link";
import { Loader } from "@/components/custom/loader";
import { SelectInput } from "@/components/custom/select-input";

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
	"created",
];

const PatientsPage = () => {
	const navigate = useNavigate({ from: Route.fullPath });

	const { user } = Route.useRouteContext();
	const search = Route.useSearch();
	const response = Route.useLoaderData();

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

	const [dobFromYear, setDobFromYear] = useState(
		search.dob_from?.slice(0, 4) ?? "",
	);
	const [dobToYear, setDobToYear] = useState(search.dob_to?.slice(0, 4) ?? "");

	const commitSearch = () => {
		navigate({
			search: (prev) => ({
				...prev,
				search: searchInput || undefined,
				dob_from: dobFromYear.length === 4 ? `${dobFromYear}-01-01` : undefined,
				dob_to: dobToYear.length === 4 ? `${dobToYear}-12-31` : undefined,
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
						<Link title="Register patient" to={FRONTEND_URLS.NEW_PATIENT}>
							<PlusIcon />
							<span>Register patient</span>
						</Link>
					)}
				</CardHeader>
			</Card>

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
							type="number"
							placeholder="Year"
							value={dobFromYear}
							onChange={(event) => setDobFromYear(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") commitSearch();
							}}
							className="h-10 w-28 text-base"
						/>
					</Field>
					<Field className="w-fit gap-1">
						<FieldLabel>Born to</FieldLabel>
						<Input
							type="number"
							placeholder="Year"
							value={dobToYear}
							onChange={(event) => setDobToYear(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") commitSearch();
							}}
							className="h-10 w-28 text-base"
						/>
					</Field>

					<div className="ml-auto flex items-end gap-2">
						<Input
							value={searchInput}
							placeholder="Search by name or phone..."
							onChange={(event) => setSearchInput(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") commitSearch();
							}}
							className="h-10 max-w-sm text-base"
						/>
						<Button variant="outline" title="Search" onClick={commitSearch}>
							<SearchIcon />
						</Button>
					</div>
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
										No patients found.
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
											title="View patient"
											to={FRONTEND_URLS.PATIENT}
											params={{ patientId: row.original.id }}
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
