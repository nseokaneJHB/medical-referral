import { useState } from "react";

import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";

import {
	SearchIcon,
	ArrowUpIcon,
	ArrowDownIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ArrowUpDownIcon,
} from "lucide-react";

import {
	flexRender,
	useReactTable,
	createColumnHelper,
	getCoreRowModel,
} from "@tanstack/react-table";

import {
	ROLES,
	USER_STATUS,
	FRONTEND_URLS,
	usersQuerySchema,
	stringToTitleCase,
	DEFAULT_PAGE_LIMIT,
	type User,
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
import { usersRequest } from "@/api/users";

const columnHelper = createColumnHelper<User>();

const columns = [
	columnHelper.accessor("name", {
		header: "Name",
		cell: (info) => info.getValue() ?? "—",
	}),
	columnHelper.accessor("email", { header: "Email" }),
	columnHelper.accessor("role", {
		header: "Role",
		cell: (info) => (
			<Badge variant="info">{stringToTitleCase(info.getValue())}</Badge>
		),
	}),
	columnHelper.accessor("status", {
		header: "Status",
		cell: (info) => (
			<Badge
				variant={info.getValue() === USER_STATUS.ACTIVE ? "success" : "error"}
			>
				{stringToTitleCase(info.getValue())}
			</Badge>
		),
	}),
];

const SORTABLE_COLUMNS = ["name", "email", "role", "status", "created"];

const ROLE_ITEMS = Object.values(ROLES).map((value) => ({
	value,
	label: stringToTitleCase(value),
}));

const STATUS_ITEMS = Object.values(USER_STATUS).map((value) => ({
	value,
	label: stringToTitleCase(value),
}));

const UsersPage = () => {
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
					<CardTitle className="text-2xl">Users</CardTitle>
				</CardHeader>
			</Card>

			<div className="flex flex-wrap items-center gap-2">
				<Input
					value={searchInput}
					placeholder="Search by name or email..."
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
					items={ROLE_ITEMS}
					placeholder="Role"
					value={search.role ? search.role.split(",") : []}
					onChange={(value) =>
						navigate({
							search: (prev) => ({
								...prev,
								role: value.length > 0 ? value.join(",") : undefined,
								page: "1",
							}),
						})
					}
					className="h-10 w-48"
					containerClassName="w-48"
				/>

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
			</div>

			<Card>
				<CardContent className="px-0">
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
										No users found.
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
											title="View user"
											to={FRONTEND_URLS.USER}
											params={{ userId: row.original.id }}
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

export const Route = createFileRoute("/_authenticated/users/")({
	component: UsersPage,
	validateSearch: usersQuerySchema,
	loaderDeps: ({ search }) => search,
	beforeLoad: ({ context }) => {
		if (
			context.user.role !== ROLES.ADMINISTRATOR &&
			context.user.role !== ROLES.MANAGER
		) {
			throw redirect({ to: "/" });
		}
	},
	loader: async ({ context, deps }) => {
		const response = await context.queryClient.ensureQueryData({
			queryKey: [...QUERY_KEYS.USERS, deps],
			queryFn: () => usersRequest({ data: deps }),
		});

		return response;
	},
	pendingComponent: () => (
		<div className="flex h-64 items-center justify-center">
			<Loader text="Loading users..." size="md" />
		</div>
	),
});
