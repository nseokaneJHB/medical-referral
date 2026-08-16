import { useState } from "react";

import { z } from "zod";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
	PlusIcon,
	PencilIcon,
	SearchIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	StethoscopeIcon,
} from "lucide-react";

import {
	FRONTEND_URLS,
	DEFAULT_PAGE_LIMIT,
	DEFAULT_PAGE_NUMBER,
	CreateSpecialtySchema,
	type Specialty,
	type SpecialtyResponse,
	type CreateSpecialtyBody,
	type UpdateSpecialtyBody,
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
import { StatCard } from "@/components/custom/stat-card";
import { Input as FormInput } from "@/components/custom/input";
import { TextArea } from "@/components/custom/text-area";
import { RowActionsMenu } from "@/components/custom/row-actions-menu";

import { useFormField } from "@/hooks/use-form-field";
import { useToastMutation } from "@/hooks/use-toast-mutation";

import { isAdministrator } from "@/lib/permissions";

import { QUERY_KEYS } from "@/api/constant";
import {
	specialtiesRequest,
	createSpecialty,
	updateSpecialty,
} from "@/api/specialties";

const searchSchema = z.object({
	page: z.string().default(`${DEFAULT_PAGE_NUMBER}`),
	limit: z.string().default(`${DEFAULT_PAGE_LIMIT}`),
	search: z.string().optional(),
});

/** Administrator-only. One dialog handles both create (no `specialty`) and rename. */
const SpecialtyDialog = ({
	specialty,
	open,
	onOpenChange,
	onSaved,
}: {
	specialty: Specialty | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSaved: () => Promise<void>;
}) => {
	const isEditing = Boolean(specialty);

	const { control, handleSubmit, reset } = useForm<CreateSpecialtyBody>({
		mode: "onChange",
		resolver: zodResolver(CreateSpecialtySchema),
		values: {
			name: specialty?.name ?? "",
			description: specialty?.description ?? "",
		},
	});

	const name = useFormField({ name: "name", control });
	const description = useFormField({ name: "description", control });

	const saveMutation = useMutation<
		SpecialtyResponse,
		Error,
		CreateSpecialtyBody | UpdateSpecialtyBody
	>({
		mutationFn: (payload) =>
			isEditing
				? updateSpecialty(specialty!.id, payload)
				: createSpecialty(payload as CreateSpecialtyBody),
	});

	const handleOpenChange = (next: boolean) => {
		onOpenChange(next);
		if (!next) reset({ name: "", description: "" });
	};

	const onSubmit = async (payload: CreateSpecialtyBody) =>
		useToastMutation({
			loading: isEditing ? "Saving specialty..." : "Creating specialty...",
			promise: saveMutation.mutateAsync(payload),
			onSuccess: async () => {
				await onSaved();
				handleOpenChange(false);
			},
			onError: async (error) => {
				if (error.errors) {
					for (const field of error.errors) {
						control.setError(field.field as keyof CreateSpecialtyBody, {
							message: field.message,
						});
					}
				}
			},
		});

	const isSaving = saveMutation.isPending;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{isEditing ? "Rename specialty" : "New specialty"}
					</DialogTitle>
					<DialogDescription>
						{isEditing
							? "Existing facility/staff assignments are unaffected."
							: "Added to the shared vocabulary any facility or Doctor/Nurse can be assigned."}
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
						placeholder="Cardiology"
						disabled={isSaving}
					/>
					<TextArea
						required
						name="description"
						label="Description"
						error={description.error}
						value={description.value}
						onChange={description.onChange}
						placeholder="Diagnosis and treatment of heart and blood vessel conditions."
						disabled={isSaving}
					/>
					<DialogFooter>
						<Button type="submit" title="Save specialty" disabled={isSaving}>
							{isSaving ? (
								<>
									<Spinner /> <span>Saving...</span>
								</>
							) : (
								<span>{isEditing ? "Save changes" : "Create specialty"}</span>
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};

const SpecialtiesPage = () => {
	const navigate = useNavigate({ from: Route.fullPath });

	const { user, queryClient } = Route.useRouteContext();
	const search = Route.useSearch();

	const { data: response } = useSuspenseQuery({
		queryKey: [...QUERY_KEYS.SPECIALTIES, search],
		queryFn: () => specialtiesRequest({ data: search }),
	});

	const [searchInput, setSearchInput] = useState(search.search ?? "");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<Specialty | null>(null);

	const page = Number(search.page ?? DEFAULT_PAGE_NUMBER);
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

	const openCreate = () => {
		setEditing(null);
		setDialogOpen(true);
	};

	const openEdit = (specialty: Specialty) => {
		setEditing(specialty);
		setDialogOpen(true);
	};

	const onSaved = async () => {
		await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SPECIALTIES });
	};

	return (
		<div className="space-y-4">
			<Card className="border-0 bg-transparent px-0 py-1 shadow-none">
				<CardHeader className="flex items-center justify-between px-0 py-1">
					<CardTitle className="text-2xl">Specialties</CardTitle>
					{isAdministrator(user) && (
						<Button type="button" title="New specialty" onClick={openCreate}>
							<PlusIcon />
							<span>New specialty</span>
						</Button>
					)}
				</CardHeader>
			</Card>

			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<StatCard
					value={String(response.total)}
					label="Total specialties"
					icon={StethoscopeIcon}
				/>
			</div>

			<Card>
				<CardContent className="flex items-center gap-2">
					<div className="ml-auto flex items-center gap-2">
						<Input
							value={searchInput}
							placeholder="Search specialties..."
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
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Description</TableHead>
								<TableHead>Facilities</TableHead>
								<TableHead>Staff</TableHead>
								<TableHead>Created</TableHead>
								{isAdministrator(user) && <TableHead className="w-10" />}
							</TableRow>
						</TableHeader>
						<TableBody>
							{response.data.length === 0 && (
								<TableRow>
									<TableCell
										colSpan={isAdministrator(user) ? 6 : 5}
										className="text-muted-foreground text-center"
									>
										No specialties found.
									</TableCell>
								</TableRow>
							)}
							{response.data.map((specialty) => (
								<TableRow key={specialty.id}>
									<TableCell className="font-medium">
										{specialty.name}
									</TableCell>
									<TableCell className="text-muted-foreground max-w-xs truncate">
										{specialty.description}
									</TableCell>
									<TableCell>{specialty.facility_count}</TableCell>
									<TableCell>{specialty.staff_count}</TableCell>
									<TableCell>
										{new Date(specialty.created_at).toLocaleDateString()}
									</TableCell>
									{isAdministrator(user) && (
										<TableCell>
											<RowActionsMenu>
												<DropdownMenuItem onSelect={() => openEdit(specialty)}>
													<PencilIcon /> <span>Rename</span>
												</DropdownMenuItem>
											</RowActionsMenu>
										</TableCell>
									)}
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

			<SpecialtyDialog
				specialty={editing}
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				onSaved={onSaved}
			/>
		</div>
	);
};

export const Route = createFileRoute("/_authenticated/specialties/")({
	component: SpecialtiesPage,
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => search,
	beforeLoad: ({ context }) => {
		if (!isAdministrator(context.user)) {
			throw redirect({ to: FRONTEND_URLS.HOME });
		}
	},
	loader: async ({ context, deps }) => {
		await context.queryClient.ensureQueryData({
			queryKey: [...QUERY_KEYS.SPECIALTIES, deps],
			queryFn: () => specialtiesRequest({ data: deps }),
		});
	},
	pendingComponent: () => (
		<div className="flex h-64 items-center justify-center">
			<Loader text="Loading specialties..." size="md" />
		</div>
	),
});
