import { useState, type ComponentType } from "react";

import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import {
	FlagIcon,
	BanIcon,
	CheckIcon,
	XIcon,
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
	type Role,
	type User,
	type UserResponse,
	type ApproveActionBody,
	type ModerationReasonBody,
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
import {
	Dialog,
	DialogTitle,
	DialogFooter,
	DialogHeader,
	DialogContent,
	DialogDescription,
} from "@/components/ui/dialog";

import { Link } from "@/components/custom/link";
import { Loader } from "@/components/custom/loader";
import { TextArea } from "@/components/custom/text-area";
import { SelectInput } from "@/components/custom/select-input";

import { useToastMutation } from "@/hooks/use-toast-mutation";

import { QUERY_KEYS } from "@/api/constant";
import {
	flagStaff,
	usersRequest,
	rejectStaff,
	flagManager,
	approveStaff,
	disableStaff,
	rejectManager,
	approveManager,
	disableManager,
} from "@/api/users";

/**
 * Which set of moderation endpoints applies to a given row — Manager account
 * moderation (`*Manager`, Administrator-only) vs Nurse/Doctor moderation
 * (`*Staff`, exposed under both `/manager/staff/*` and, as the
 * orphan-facility fallback, `/administrator/staff/*` — see
 * `docs/roles-permissions.md`). Returns `null` when the viewer has no
 * moderation authority over this row at all (a Manager viewing another
 * Manager, or anyone viewing an Administrator) — same non-enumerating
 * philosophy as the backend's 404-not-403 on an out-of-scope target.
 */
const resolveModerationFns = (
	viewerRole: Role,
	targetRole: Role,
): {
	approve: (id: string, payload: ApproveActionBody) => Promise<UserResponse>;
	reject: (id: string, payload: ModerationReasonBody) => Promise<UserResponse>;
	flag: (id: string, payload: ModerationReasonBody) => Promise<UserResponse>;
	disable: (id: string, payload: ModerationReasonBody) => Promise<UserResponse>;
} | null => {
	if (targetRole === ROLES.MANAGER) {
		if (viewerRole !== ROLES.ADMINISTRATOR) return null;
		return {
			approve: approveManager,
			reject: rejectManager,
			flag: flagManager,
			disable: disableManager,
		};
	}

	if (targetRole === ROLES.NURSE || targetRole === ROLES.DOCTOR) {
		const namespace = viewerRole === ROLES.ADMINISTRATOR ? "ADMINISTRATOR" : "MANAGER";
		return {
			approve: (id, payload) => approveStaff(namespace, id, payload),
			reject: (id, payload) => rejectStaff(namespace, id, payload),
			flag: (id, payload) => flagStaff(namespace, id, payload),
			disable: (id, payload) => disableStaff(namespace, id, payload),
		};
	}

	return null;
};

/** A punitive action (reject/flag/disable) behind a required-reason confirm dialog. */
const ReasonActionButton = ({
	label,
	title,
	variant,
	icon: Icon,
	description,
	mutationFn,
	onChanged,
}: {
	label: string;
	title: string;
	variant: "warning-outline" | "error-outline";
	icon: ComponentType<{ className?: string }>;
	description: string;
	mutationFn: (reason: string) => Promise<UserResponse>;
	onChanged: () => Promise<void>;
}) => {
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState("");

	const mutation = useMutation<UserResponse, Error, string>({ mutationFn });

	const onConfirm = async () =>
		useToastMutation({
			loading: `${label}ing...`,
			promise: mutation.mutateAsync(reason),
			onSuccess: async () => {
				setOpen(false);
				setReason("");
				await onChanged();
			},
		});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<Button
				type="button"
				variant={variant}
				title={title}
				size="sm"
				onClick={() => setOpen(true)}
			>
				<Icon />
				<span>{label}</span>
			</Button>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}?</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<TextArea
					required
					name="reason"
					label="Reason"
					value={reason}
					onChange={(event) => setReason(event.target.value)}
				/>
				<DialogFooter>
					<Button
						type="button"
						variant="error"
						title={`Confirm ${label.toLowerCase()}`}
						disabled={mutation.isPending || reason.trim().length === 0}
						onClick={onConfirm}
					>
						<span>{label}</span>
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

/** Row moderation actions — which buttons show depends on the target's current status. */
const UserModerationActions = ({
	user,
	viewerRole,
	onChanged,
}: {
	user: User;
	viewerRole: Role;
	onChanged: () => Promise<void>;
}) => {
	const fns = resolveModerationFns(viewerRole, user.role);

	const approveMutation = useMutation<UserResponse, Error, void>({
		mutationFn: () => fns!.approve(user.id, {}),
	});

	const onApprove = async () =>
		useToastMutation({
			loading: "Approving...",
			promise: approveMutation.mutateAsync(),
			onSuccess: onChanged,
		});

	if (!fns) return null;

	if (user.status === USER_STATUS.PENDING) {
		return (
			<div className="flex justify-end gap-2">
				<Button
					type="button"
					variant="success-outline"
					title="Approve"
					size="sm"
					disabled={approveMutation.isPending}
					onClick={onApprove}
				>
					<CheckIcon />
					<span>Approve</span>
				</Button>
				<ReasonActionButton
					label="Reject"
					title="Reject this application"
					variant="error-outline"
					icon={XIcon}
					description="This application will be rejected — a reason is required."
					mutationFn={(reason) => fns.reject(user.id, { reason })}
					onChanged={onChanged}
				/>
			</div>
		);
	}

	if (user.status === USER_STATUS.ACTIVE) {
		return (
			<div className="flex justify-end gap-2">
				<ReasonActionButton
					label="Flag"
					title="Flag this account"
					variant="warning-outline"
					icon={FlagIcon}
					description="Flagging restricts this account until it's cleared — a reason is required."
					mutationFn={(reason) => fns.flag(user.id, { reason })}
					onChanged={onChanged}
				/>
				<ReasonActionButton
					label="Disable"
					title="Disable this account"
					variant="error-outline"
					icon={BanIcon}
					description="Disabling fully freezes this account — a reason is required."
					mutationFn={(reason) => fns.disable(user.id, { reason })}
					onChanged={onChanged}
				/>
			</div>
		);
	}

	if (user.status === USER_STATUS.FLAGGED) {
		return (
			<div className="flex justify-end gap-2">
				<ReasonActionButton
					label="Disable"
					title="Disable this account"
					variant="error-outline"
					icon={BanIcon}
					description="Disabling fully freezes this account — a reason is required."
					mutationFn={(reason) => fns.disable(user.id, { reason })}
					onChanged={onChanged}
				/>
			</div>
		);
	}

	return null;
};

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

	const { user, queryClient } = Route.useRouteContext();
	const search = Route.useSearch();

	/**
	 * `useSuspenseQuery` (not `Route.useLoaderData()`) deliberately — the
	 * loader's `ensureQueryData` primes this exact cache entry, so this
	 * doesn't cost an extra fetch, but unlike `useLoaderData` it's a live
	 * subscription: a moderation action's `invalidateQueries` below is
	 * enough on its own to make this table re-render with fresh data.
	 * `useLoaderData` reads a snapshot from the router's own match cache,
	 * which isn't subscribed to query-cache invalidation at all — a
	 * moderation action would toast success but leave the row showing its
	 * old status indefinitely.
	 */
	const { data: response } = useSuspenseQuery({
		queryKey: [...QUERY_KEYS.USERS, search],
		queryFn: () => usersRequest({ data: search }),
	});

	const [searchInput, setSearchInput] = useState(search.search ?? "");

	const onChanged = async () => {
		await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS });
	};

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
										<div className="flex justify-end gap-2">
											<UserModerationActions
												user={row.original}
												viewerRole={user.role}
												onChanged={onChanged}
											/>
											<Link
												variant="outline"
												title="View user"
												to={FRONTEND_URLS.USER}
												params={{ userId: row.original.id }}
											>
												View
											</Link>
										</div>
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
			throw redirect({ to: FRONTEND_URLS.HOME });
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
