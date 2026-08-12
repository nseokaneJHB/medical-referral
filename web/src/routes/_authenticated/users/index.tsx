import { useState, useEffect } from "react";

import {
	Link as RouterLink,
	createFileRoute,
	useNavigate,
	redirect,
} from "@tanstack/react-router";
import { useMutation, useSuspenseQuery, useQuery } from "@tanstack/react-query";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
	FlagIcon,
	BanIcon,
	EyeIcon,
	CheckIcon,
	XIcon,
	CopyIcon,
	SearchIcon,
	ArrowUpIcon,
	ArrowDownIcon,
	UserPlusIcon,
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
	FACILITY_STATUS,
	usersQuerySchema,
	stringToTitleCase,
	DEFAULT_PAGE_LIMIT,
	createUserByAdminSchema,
	type Role,
	type User,
	type UserResponse,
	type ApproveActionBody,
	type ModerationReasonBody,
	type CreateUserByAdminBody,
	type CreateUserByAdminResponse,
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
import { Spinner } from "@/components/ui/spinner";
import {
	Dialog,
	DialogTitle,
	DialogFooter,
	DialogHeader,
	DialogContent,
	DialogDescription,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

import { Loader } from "@/components/custom/loader";
import { Input as FormInput } from "@/components/custom/input";
import { SelectInput } from "@/components/custom/select-input";
import { RowActionsMenu } from "@/components/custom/row-actions-menu";
import { ReasonActionButton } from "@/components/custom/reason-action-button";

import { useFormField } from "@/hooks/use-form-field";
import { useToastMutation } from "@/hooks/use-toast-mutation";

import { QUERY_KEYS } from "@/api/constant";
import { facilitiesRequest } from "@/api/facilities";
import {
	flagStaff,
	createUser,
	usersRequest,
	rejectStaff,
	flagManager,
	approveStaff,
	disableStaff,
	rejectManager,
	approveManager,
	disableManager,
} from "@/api/users";

import { isAdministrator, canManageUsers, canModerateUser } from "@/lib/permissions";

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
	if (!canModerateUser(viewerRole, targetRole)) return null;

	if (targetRole === ROLES.MANAGER) {
		return {
			approve: approveManager,
			reject: rejectManager,
			flag: flagManager,
			disable: disableManager,
		};
	}

	const namespace = viewerRole === ROLES.ADMINISTRATOR ? "ADMINISTRATOR" : "MANAGER";
	return {
		approve: (id, payload) => approveStaff(namespace, id, payload),
		reject: (id, payload) => rejectStaff(namespace, id, payload),
		flag: (id, payload) => flagStaff(namespace, id, payload),
		disable: (id, payload) => disableStaff(namespace, id, payload),
	};
};

/** Row moderation menu items — which actions show depends on the target's current status. */
const UserModerationMenuItems = ({
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
			<>
				<DropdownMenuItem
					variant="success"
					disabled={approveMutation.isPending}
					onSelect={onApprove}
				>
					<CheckIcon />
					<span>Approve</span>
				</DropdownMenuItem>
				<ReasonActionButton
					label="Reject"
					title="Reject this application"
					variant="error-outline"
					icon={XIcon}
					description="This application will be rejected — a reason is required."
					mutationFn={(reason) => fns.reject(user.id, { reason })}
					onChanged={onChanged}
					renderTrigger={(onClick) => (
						<DropdownMenuItem
							variant="destructive"
							onSelect={(event) => {
								event.preventDefault();
								onClick();
							}}
						>
							<XIcon />
							<span>Reject</span>
						</DropdownMenuItem>
					)}
				/>
			</>
		);
	}

	if (user.status === USER_STATUS.ACTIVE) {
		return (
			<>
				<ReasonActionButton
					label="Flag"
					title="Flag this account"
					variant="warning-outline"
					icon={FlagIcon}
					description="Flagging restricts this account until it's cleared — a reason is required."
					mutationFn={(reason) => fns.flag(user.id, { reason })}
					onChanged={onChanged}
					renderTrigger={(onClick) => (
						<DropdownMenuItem
							variant="warning"
							onSelect={(event) => {
								event.preventDefault();
								onClick();
							}}
						>
							<FlagIcon />
							<span>Flag</span>
						</DropdownMenuItem>
					)}
				/>
				<ReasonActionButton
					label="Disable"
					title="Disable this account"
					variant="error-outline"
					icon={BanIcon}
					description="Disabling fully freezes this account — a reason is required."
					mutationFn={(reason) => fns.disable(user.id, { reason })}
					onChanged={onChanged}
					renderTrigger={(onClick) => (
						<DropdownMenuItem
							variant="destructive"
							onSelect={(event) => {
								event.preventDefault();
								onClick();
							}}
						>
							<BanIcon />
							<span>Disable</span>
						</DropdownMenuItem>
					)}
				/>
			</>
		);
	}

	if (user.status === USER_STATUS.FLAGGED) {
		return (
			<ReasonActionButton
				label="Disable"
				title="Disable this account"
				variant="error-outline"
				icon={BanIcon}
				description="Disabling fully freezes this account — a reason is required."
				mutationFn={(reason) => fns.disable(user.id, { reason })}
				onChanged={onChanged}
				renderTrigger={(onClick) => (
					<DropdownMenuItem
						variant="destructive"
						onSelect={(event) => {
							event.preventDefault();
							onClick();
						}}
					>
						<BanIcon />
						<span>Disable</span>
					</DropdownMenuItem>
				)}
			/>
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

/**
 * Administrator-only: create any role directly (active immediately, one-time
 * temporary password). Two-stage dialog — the form, then a success view
 * showing the password, since the server only ever returns it once.
 */
const CreateUserDialog = ({
	onCreated,
}: {
	onCreated: () => Promise<void>;
}) => {
	const [open, setOpen] = useState(false);
	const [created, setCreated] = useState<
		CreateUserByAdminResponse["data"] | null
	>(null);

	const { control, handleSubmit, reset, setValue } =
		useForm<CreateUserByAdminBody>({
			mode: "onChange",
			resolver: zodResolver(createUserByAdminSchema),
			defaultValues: {
				name: "",
				email: "",
				role: ROLES.NURSE,
				facility_id: undefined,
			},
		});

	const watchedRole = useWatch({ control, name: "role" });
	const needsFacility = watchedRole !== ROLES.ADMINISTRATOR;

	const { data: facilities } = useQuery({
		queryKey: [...QUERY_KEYS.FACILITIES, "picker", FACILITY_STATUS.APPROVED],
		queryFn: () =>
			facilitiesRequest({
				data: { page: "1", limit: "100", status: FACILITY_STATUS.APPROVED },
			}),
		enabled: needsFacility && open,
	});

	const facilityItems =
		facilities?.data.map((facility) => ({
			value: facility.id,
			label: facility.name,
		})) ?? [];

	useEffect(() => {
		if (!needsFacility) setValue("facility_id", undefined);
	}, [needsFacility, setValue]);

	const name = useFormField({ name: "name", control });
	const email = useFormField({ name: "email", control });
	const role = useFormField({ name: "role", control, type: "select" });
	const facilityId = useFormField({
		name: "facility_id",
		control,
		type: "select",
	});

	const createUserMutation = useMutation<
		CreateUserByAdminResponse,
		Error,
		CreateUserByAdminBody
	>({ mutationFn: createUser });

	const onSubmit = async (payload: CreateUserByAdminBody) =>
		useToastMutation({
			loading: "Creating user...",
			promise: createUserMutation.mutateAsync(payload),
			onSuccess: async (response) => {
				setCreated(response.data);
				await onCreated();
			},
			onError: async (error) => {
				if (error.errors) {
					for (const field of error.errors) {
						control.setError(field.field as keyof CreateUserByAdminBody, {
							message: field.message,
						});
					}
				}
			},
		});

	const onOpenChange = (next: boolean) => {
		setOpen(next);
		if (!next) {
			reset();
			setCreated(null);
		}
	};

	const isLoading = createUserMutation.isPending;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<Button
				type="button"
				title="Create user"
				onClick={() => setOpen(true)}
			>
				<UserPlusIcon />
				<span>Create user</span>
			</Button>
			<DialogContent>
				{created ? (
					<>
						<DialogHeader>
							<DialogTitle>User created</DialogTitle>
							<DialogDescription>
								Share this temporary password with {created.user.name} — it
								won&apos;t be shown again.
							</DialogDescription>
						</DialogHeader>
						<div className="flex items-center gap-2 rounded-md border p-2 font-mono text-sm">
							<span className="flex-1 break-all">
								{created.temporary_password}
							</span>
							<Button
								type="button"
								variant="outline"
								size="sm"
								title="Copy password"
								onClick={() => {
									navigator.clipboard.writeText(created.temporary_password);
									toast.success("Password copied to clipboard");
								}}
							>
								<CopyIcon />
							</Button>
						</div>
						<DialogFooter>
							<Button
								type="button"
								title="Done"
								onClick={() => onOpenChange(false)}
							>
								<span>Done</span>
							</Button>
						</DialogFooter>
					</>
				) : (
					<>
						<DialogHeader>
							<DialogTitle>Create user</DialogTitle>
							<DialogDescription>
								The account is active immediately with a one-time temporary
								password.
							</DialogDescription>
						</DialogHeader>
						<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
							<FormInput
								required
								name="name"
								label="Name"
								error={name.error}
								value={name.value}
								onChange={name.onChange}
								placeholder="Jane Doe"
								disabled={isLoading}
							/>
							<FormInput
								required
								name="email"
								type="email"
								label="Email"
								error={email.error}
								value={email.value}
								onChange={email.onChange}
								placeholder="email@example.com"
								disabled={isLoading}
							/>
							<SelectInput
								label="Role"
								items={ROLE_ITEMS}
								value={role.value as string}
								error={role.error}
								disabled={isLoading}
								placeholder="Select a role"
								onChange={role.onChange as (value: string | undefined) => void}
							/>
							{needsFacility && (
								<SelectInput
									searchable
									label="Facility"
									items={facilityItems}
									value={facilityId.value as string}
									error={facilityId.error}
									disabled={isLoading}
									placeholder="Select a facility"
									onChange={
										facilityId.onChange as (value: string | undefined) => void
									}
								/>
							)}
							<DialogFooter>
								<Button type="submit" title="Create user" disabled={isLoading}>
									{isLoading ? (
										<>
											<Spinner /> <span>Creating...</span>
										</>
									) : (
										<span>Create user</span>
									)}
								</Button>
							</DialogFooter>
						</form>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
};

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
				<CardHeader className="flex items-center justify-between px-0 py-1">
					<CardTitle className="text-2xl">Users</CardTitle>
					{isAdministrator(user) && (
						<CreateUserDialog onCreated={onChanged} />
					)}
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
									<TableHead className="text-right">Actions</TableHead>
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
									<TableCell className="text-right">
										<RowActionsMenu
											label={`Actions for ${row.original.name ?? row.original.email}`}
										>
											<DropdownMenuItem asChild>
												<RouterLink
													to={FRONTEND_URLS.USER}
													params={{ userId: row.original.id }}
												>
													<EyeIcon />
													<span>View</span>
												</RouterLink>
											</DropdownMenuItem>
											<UserModerationMenuItems
												user={row.original}
												viewerRole={user.role}
												onChanged={onChanged}
											/>
										</RowActionsMenu>
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
		if (!canManageUsers(context.user)) {
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
