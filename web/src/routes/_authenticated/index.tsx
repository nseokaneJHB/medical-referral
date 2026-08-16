import type { ComponentType, ReactNode } from "react";

import {
	createFileRoute,
	useNavigate,
	type LinkProps,
} from "@tanstack/react-router";

import {
	ClockIcon,
	UsersIcon,
	RepeatIcon,
	UserPlusIcon,
	HistoryIcon,
	XCircleIcon,
	Building2Icon,
	CheckCircleIcon,
	FilePlus2Icon,
	ArrowLeftRightIcon,
	ClipboardListIcon,
} from "lucide-react";

import {
	ROLES,
	FRONTEND_URLS,
	stringToTitleCase,
	referralsReportQuerySchema,
	type NurseSummary,
	type DoctorSummary,
	type AdminSummary,
	type ManagerSummary,
	type ReferralsReport,
} from "@referral-tracking/shared";

import { Card, CardTitle, CardHeader, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import type { ChartConfig } from "@/components/ui/chart";

import { Link } from "@/components/custom/link";
import { Loader } from "@/components/custom/loader";
import { StatCard } from "@/components/custom/stat-card";
import { BreakdownChart } from "@/components/custom/breakdown-chart";

import { QUERY_KEYS } from "@/api/constant";
import {
	nurseSummaryRequest,
	doctorSummaryRequest,
	adminSummaryRequest,
	managerSummaryRequest,
} from "@/api/dashboard";
import { referralsReportRequest } from "@/api/reports";
import { patientsRequest } from "@/api/patients";
import { referralsRequest } from "@/api/referrals";
import { facilitiesRequest } from "@/api/facilities";
import { usersRequest } from "@/api/users";

interface Action {
	to: LinkProps["to"];
	label: string;
	icon: ComponentType<{ className?: string }>;
	params?: Record<string, string>;
}

const ActionBar = ({ actions }: { actions: Action[] }) => (
	<Card>
		<CardHeader>
			<CardTitle>Quick actions</CardTitle>
		</CardHeader>
		<CardContent className="flex flex-wrap gap-2">
			{actions.map((action) => (
				<Link
					key={action.label}
					to={action.to}
					params={action.params}
					title={action.label}
					variant="outline"
					className="space-x-1"
				>
					<action.icon />
					<span>{action.label}</span>
				</Link>
			))}
		</CardContent>
	</Card>
);

// Keys here are the aggregate report's own field names — decoupled from
// `REFERRAL_STATUS`'s casing on purpose, same as `dashboard/service.ts`'s
// per-status counts, so this doesn't move if the enum's casing ever does.
const STATUS_CHART_CONFIG: ChartConfig = {
	pending: { label: "Pending", color: "var(--color-muted-foreground)" },
	accepted: { label: "Accepted", color: "var(--color-info)" },
	in_progress: { label: "In Progress", color: "var(--color-info)" },
	on_hold: { label: "On Hold", color: "var(--color-warning)" },
	completed: { label: "Completed", color: "var(--color-success)" },
	rejected: { label: "Rejected", color: "var(--color-error)" },
	canceled: { label: "Canceled", color: "var(--color-error)" },
};

const PRIORITY_CHART_CONFIG: ChartConfig = {
	low: { label: "Low", color: "var(--color-muted-foreground)" },
	medium: { label: "Medium", color: "var(--color-info)" },
	high: { label: "High", color: "var(--color-warning)" },
	urgent: { label: "Urgent", color: "var(--color-error)" },
};

// Date range filter for scoping the referrals report data.
const DateRangeFilter = () => {
	const navigate = useNavigate({ from: Route.fullPath });
	const search = Route.useSearch();

	return (
		<Card>
			<CardContent className="flex flex-wrap items-end gap-4">
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
								}),
							})
						}
						className="h-10 text-base"
					/>
				</Field>
			</CardContent>
		</Card>
	);
};

// Referral breakdown charts for status and priority distribution, scoped by date.
const BreakdownChartsSection = ({ report }: { report: ReferralsReport }) => {
	const statusData = Object.entries(report.by_status).map(([key, value]) => ({
		key,
		label: stringToTitleCase(key),
		value,
	}));
	const priorityData = Object.entries(report.by_priority).map(
		([key, value]) => ({ key, label: stringToTitleCase(key), value }),
	);

	return (
		<div className="space-y-4">
			<h2 className="text-lg font-semibold">Referral trends</h2>

			<div className="grid gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle className="text-base">By status</CardTitle>
					</CardHeader>
					<CardContent>
						<BreakdownChart data={statusData} config={STATUS_CHART_CONFIG} />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-base">By priority</CardTitle>
					</CardHeader>
					<CardContent>
						<BreakdownChart
							data={priorityData}
							config={PRIORITY_CHART_CONFIG}
						/>
					</CardContent>
				</Card>
			</div>
		</div>
	);
};

interface RecentItem {
	key: string;
	label: ReactNode;
	sublabel?: ReactNode;
	to: LinkProps["to"];
	params?: Record<string, string>;
}

const RecentActivityCard = ({
	title,
	to,
	items,
}: {
	title: string;
	to: LinkProps["to"];
	items: RecentItem[];
}) => (
	<Card>
		<CardHeader className="flex items-center justify-between">
			<CardTitle className="text-lg">{title}</CardTitle>
			<Link
				variant="link"
				title={`View all — ${title}`}
				to={to}
				buttonClassName="h-auto p-0 text-sm underline"
			>
				View all
			</Link>
		</CardHeader>
		<CardContent className="space-y-2">
			{items.length === 0 ? (
				<p className="text-muted-foreground text-sm">Nothing yet.</p>
			) : (
				items.map((item) => (
					<Link
						key={item.key}
						variant="link"
						title={typeof item.label === "string" ? item.label : title}
						to={item.to}
						params={item.params}
						className="border-b pb-2 last:border-0 last:pb-0"
						buttonClassName="hover:text-primary h-auto w-full p-0 text-sm font-normal text-foreground no-underline hover:no-underline"
					>
						<span className="flex w-full items-center justify-between">
							<span>{item.label}</span>
							{item.sublabel && (
								<span className="text-muted-foreground">{item.sublabel}</span>
							)}
						</span>
					</Link>
				))
			)}
		</CardContent>
	</Card>
);

const NurseDashboard = ({
	summary,
	report,
	recentPatients,
	recentReferrals,
}: {
	summary: NurseSummary;
	report: ReferralsReport;
	recentPatients: RecentItem[];
	recentReferrals: RecentItem[];
}) => (
	<div className="space-y-6">
		<DateRangeFilter />

		<div className="grid grid-cols-2 gap-4 md:grid-cols-3">
			<StatCard
				icon={FilePlus2Icon}
				label="Referrals Created"
				value={summary.referrals_created.toString()}
			/>
			<StatCard
				icon={ClockIcon}
				label="Pending Referrals"
				value={summary.pending.toString()}
			/>
			<StatCard
				icon={XCircleIcon}
				label="Canceled Referrals"
				value={summary.canceled.toString()}
			/>
		</div>

		<BreakdownChartsSection report={report} />

		<div className="grid gap-4 md:grid-cols-2">
			<RecentActivityCard
				title="Recent patients"
				to={FRONTEND_URLS.PATIENTS}
				items={recentPatients}
			/>
			<RecentActivityCard
				title="Referrals you created"
				to={FRONTEND_URLS.REFERRALS}
				items={recentReferrals}
			/>
		</div>

		<ActionBar
			actions={[
				{
					to: FRONTEND_URLS.PATIENTS,
					label: "Register Patient",
					icon: UserPlusIcon,
				},
				{
					to: FRONTEND_URLS.REFERRALS,
					label: "Create Referral",
					icon: FilePlus2Icon,
				},
			]}
		/>
	</div>
);

const DoctorDashboard = ({
	summary,
	report,
	recentReferrals,
}: {
	summary: DoctorSummary;
	report: ReferralsReport;
	recentReferrals: RecentItem[];
}) => (
	<div className="space-y-6">
		<DateRangeFilter />

		<div className="grid grid-cols-2 gap-4 md:grid-cols-3">
			<StatCard
				icon={ClipboardListIcon}
				label="My Referrals"
				value={summary.my_referrals.toString()}
			/>
			<StatCard
				icon={CheckCircleIcon}
				label="Accepted Referrals"
				value={summary.accepted.toString()}
			/>
			<StatCard
				icon={ClockIcon}
				label="Pending Referrals"
				value={summary.pending.toString()}
			/>
		</div>

		<BreakdownChartsSection report={report} />

		<RecentActivityCard
			title="Referrals assigned to you"
			to={FRONTEND_URLS.REFERRALS}
			items={recentReferrals}
		/>

		<ActionBar
			actions={[
				{
					to: FRONTEND_URLS.PATIENTS,
					label: "View Patient Records",
					icon: UsersIcon,
				},
				{
					to: FRONTEND_URLS.REFERRALS,
					label: "View Referrals",
					icon: ArrowLeftRightIcon,
				},
			]}
		/>
	</div>
);

const AdminDashboard = ({
	summary,
	report,
	recentUsers,
	recentFacilities,
}: {
	summary: AdminSummary;
	report: ReferralsReport;
	recentUsers: RecentItem[];
	recentFacilities: RecentItem[];
}) => (
	<div className="space-y-6">
		<DateRangeFilter />

		<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
			<StatCard
				icon={UsersIcon}
				label="Total Users"
				value={summary.total_users.toString()}
			/>
			<StatCard
				icon={ClipboardListIcon}
				label="Total Patients"
				value={summary.total_patients.toString()}
			/>
			<StatCard
				icon={Building2Icon}
				label="Total Facilities"
				value={summary.total_facilities.toString()}
			/>
			<StatCard
				icon={ArrowLeftRightIcon}
				label="Total Referrals"
				value={summary.total_referrals.toString()}
			/>
		</div>

		<BreakdownChartsSection report={report} />

		<div className="grid gap-4 md:grid-cols-2">
			<RecentActivityCard
				title="Recently created users"
				to={FRONTEND_URLS.USERS}
				items={recentUsers}
			/>
			<RecentActivityCard
				title="Recently registered facilities"
				to={FRONTEND_URLS.FACILITIES}
				items={recentFacilities}
			/>
		</div>

		<ActionBar
			actions={[
				{ to: FRONTEND_URLS.USERS, label: "Manage Users", icon: UsersIcon },
				{
					to: FRONTEND_URLS.FACILITIES,
					label: "Manage Facilities",
					icon: Building2Icon,
				},
				{
					to: FRONTEND_URLS.AUDIT,
					label: "View Audit Logs",
					icon: HistoryIcon,
				},
			]}
		/>
	</div>
);

const ManagerDashboard = ({
	facilityId,
	summary,
	report,
	recentPatients,
	recentReferrals,
}: {
	facilityId: string;
	summary: ManagerSummary;
	report: ReferralsReport;
	recentPatients: RecentItem[];
	recentReferrals: RecentItem[];
}) => {
	const navigate = useNavigate();

	const hasPendingActions =
		summary.pending_staff_applications > 0 || summary.pending_transfers > 0;

	return (
		<div className="space-y-6">
			<DateRangeFilter />

			<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
				<StatCard
					icon={UsersIcon}
					label="Total Staff"
					value={summary.total_staff.toString()}
				/>
				<StatCard
					icon={ClipboardListIcon}
					label="Total Patients"
					value={summary.total_patients.toString()}
				/>
				<StatCard
					icon={UserPlusIcon}
					label="Pending Applications"
					value={summary.pending_staff_applications.toString()}
					className={
						summary.pending_staff_applications > 0
							? "border-warning cursor-pointer"
							: undefined
					}
					onClick={() => navigate({ to: FRONTEND_URLS.USERS })}
				/>
				<StatCard
					icon={RepeatIcon}
					label="Pending Transfers"
					value={summary.pending_transfers.toString()}
					className={
						summary.pending_transfers > 0
							? "border-warning cursor-pointer"
							: undefined
					}
					onClick={() => navigate({ to: FRONTEND_URLS.TRANSFERS })}
				/>
			</div>

			{hasPendingActions && (
				<div className="border-warning bg-warning/10 text-warning rounded-md border p-3 text-sm">
					You have pending actions awaiting your decision.
				</div>
			)}

			<BreakdownChartsSection report={report} />

			<div className="grid gap-4 md:grid-cols-2">
				<RecentActivityCard
					title="Recent patients"
					to={FRONTEND_URLS.PATIENTS}
					items={recentPatients}
				/>
				<RecentActivityCard
					title="Recent referrals"
					to={FRONTEND_URLS.REFERRALS}
					items={recentReferrals}
				/>
			</div>

			<ActionBar
				actions={[
					{
						to: FRONTEND_URLS.PATIENTS,
						label: "View Patients",
						icon: ClipboardListIcon,
					},
					{
						to: FRONTEND_URLS.REFERRALS,
						label: "View Referrals",
						icon: ArrowLeftRightIcon,
					},
					{ to: FRONTEND_URLS.USERS, label: "Manage Staff", icon: UsersIcon },
					{
						label: "My Facility",
						icon: Building2Icon,
						to: FRONTEND_URLS.FACILITY,
						params: { facilityId },
					},
				]}
			/>
		</div>
	);
};

const DashboardPage = () => {
	const { user } = Route.useRouteContext();
	const data = Route.useLoaderData();

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold">Welcome, {user.name}</h1>

			{data.role === ROLES.NURSE && (
				<NurseDashboard
					summary={data.summary}
					report={data.report}
					recentPatients={data.recentPatients}
					recentReferrals={data.recentReferrals}
				/>
			)}
			{data.role === ROLES.DOCTOR && (
				<DoctorDashboard
					summary={data.summary}
					report={data.report}
					recentReferrals={data.recentReferrals}
				/>
			)}
			{data.role === ROLES.ADMINISTRATOR && (
				<AdminDashboard
					summary={data.summary}
					report={data.report}
					recentUsers={data.recentUsers}
					recentFacilities={data.recentFacilities}
				/>
			)}
			{data.role === ROLES.MANAGER && user.facility_id && (
				<ManagerDashboard
					facilityId={user.facility_id}
					summary={data.summary}
					report={data.report}
					recentPatients={data.recentPatients}
					recentReferrals={data.recentReferrals}
				/>
			)}
		</div>
	);
};

export const Route = createFileRoute("/_authenticated/")({
	component: DashboardPage,
	validateSearch: referralsReportQuerySchema,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		const { queryClient, user } = context;

		const tz_offset =
			typeof window !== "undefined"
				? String(new Date().getTimezoneOffset())
				: undefined;
		const queryDeps = { ...deps, tz_offset };

		const report = (
			await queryClient.ensureQueryData({
				queryKey: [...QUERY_KEYS.REPORTS_REFERRALS, deps],
				queryFn: () => referralsReportRequest({ data: queryDeps }),
			})
		).data;

		if (user.role === ROLES.DOCTOR) {
			const [summary, recentReferrals] = await Promise.all([
				queryClient
					.ensureQueryData({
						queryKey: [QUERY_KEYS.DASHBOARD_DOCTOR, deps],
						queryFn: () => doctorSummaryRequest({ data: queryDeps }),
					})
					.then((r) => r.data),
				queryClient
					.ensureQueryData({
						queryKey: [...QUERY_KEYS.REFERRALS, "recent"],
						queryFn: () =>
							referralsRequest({
								data: {
									page: "1",
									limit: "5",
									sort: "created_at",
									order: "desc",
								},
							}),
					})
					.then((r) =>
						r.data.map((referral) => ({
							key: referral.id,
							label: `${referral.origin_facility.name} → ${referral.destination_facility.name}`,
							sublabel: stringToTitleCase(referral.status),
							to: FRONTEND_URLS.REFERRAL,
							params: { referralId: referral.id },
						})),
					),
			]);

			return { role: user.role, summary, report, recentReferrals };
		}

		if (user.role === ROLES.ADMINISTRATOR) {
			const [summary, recentUsers, recentFacilities] = await Promise.all([
				queryClient
					.ensureQueryData({
						queryKey: [QUERY_KEYS.DASHBOARD_ADMIN, deps],
						queryFn: () => adminSummaryRequest({ data: queryDeps }),
					})
					.then((r) => r.data),
				queryClient
					.ensureQueryData({
						queryKey: [...QUERY_KEYS.USERS, "recent"],
						queryFn: () =>
							usersRequest({
								data: {
									page: "1",
									limit: "5",
									sort: "created_at",
									order: "desc",
								},
							}),
					})
					.then((r) =>
						r.data.map((created) => ({
							key: created.id,
							label: created.name ?? created.email,
							sublabel: stringToTitleCase(created.status),
							to: FRONTEND_URLS.USER,
							params: { userId: created.id },
						})),
					),
				queryClient
					.ensureQueryData({
						queryKey: [...QUERY_KEYS.FACILITIES, "recent"],
						queryFn: () =>
							facilitiesRequest({
								data: {
									page: "1",
									limit: "5",
									sort: "created_at",
									order: "desc",
								},
							}),
					})
					.then((r) =>
						r.data.map((facility) => ({
							key: facility.id,
							label: facility.name,
							sublabel: stringToTitleCase(facility.status),
							to: FRONTEND_URLS.FACILITY,
							params: { facilityId: facility.id },
						})),
					),
			]);

			return {
				role: user.role,
				summary,
				report,
				recentUsers,
				recentFacilities,
			};
		}

		if (user.role === ROLES.MANAGER) {
			const [summary, recentPatients, recentReferrals] = await Promise.all([
				queryClient
					.ensureQueryData({
						queryKey: [QUERY_KEYS.DASHBOARD_MANAGER, deps],
						queryFn: () => managerSummaryRequest({ data: queryDeps }),
					})
					.then((r) => r.data),
				queryClient
					.ensureQueryData({
						queryKey: [...QUERY_KEYS.PATIENTS, "recent"],
						queryFn: () =>
							patientsRequest({
								data: {
									page: "1",
									limit: "5",
									sort: "created_at",
									order: "desc",
								},
							}),
					})
					.then((r) =>
						r.data.map((patient) => ({
							key: patient.id,
							label: `${patient.first_name} ${patient.last_name}`,
							to: FRONTEND_URLS.PATIENT,
							params: { patientId: patient.id },
						})),
					),
				queryClient
					.ensureQueryData({
						queryKey: [...QUERY_KEYS.REFERRALS, "recent"],
						queryFn: () =>
							referralsRequest({
								data: {
									page: "1",
									limit: "5",
									sort: "created_at",
									order: "desc",
								},
							}),
					})
					.then((r) =>
						r.data.map((referral) => ({
							key: referral.id,
							label: `${referral.origin_facility.name} → ${referral.destination_facility.name}`,
							sublabel: stringToTitleCase(referral.status),
							to: FRONTEND_URLS.REFERRAL,
							params: { referralId: referral.id },
						})),
					),
			]);

			return {
				role: user.role,
				summary,
				report,
				recentPatients,
				recentReferrals,
			};
		}

		const [summary, recentPatients, recentReferrals] = await Promise.all([
			queryClient
				.ensureQueryData({
					queryKey: [QUERY_KEYS.DASHBOARD_NURSE, deps],
					queryFn: () => nurseSummaryRequest({ data: queryDeps }),
				})
				.then((r) => r.data),
			queryClient
				.ensureQueryData({
					queryKey: [...QUERY_KEYS.PATIENTS, "recent"],
					queryFn: () =>
						patientsRequest({
							data: {
								page: "1",
								limit: "5",
								sort: "created_at",
								order: "desc",
							},
						}),
				})
				.then((r) =>
					r.data.map((patient) => ({
						key: patient.id,
						label: `${patient.first_name} ${patient.last_name}`,
						to: FRONTEND_URLS.PATIENT,
						params: { patientId: patient.id },
					})),
				),
			queryClient
				.ensureQueryData({
					queryKey: [...QUERY_KEYS.REFERRALS, "recent"],
					queryFn: () =>
						referralsRequest({
							data: {
								page: "1",
								limit: "5",
								sort: "created_at",
								order: "desc",
							},
						}),
				})
				.then((r) =>
					r.data.map((referral) => ({
						key: referral.id,
						label: `${referral.origin_facility.name} → ${referral.destination_facility.name}`,
						sublabel: stringToTitleCase(referral.status),
						to: FRONTEND_URLS.REFERRAL,
						params: { referralId: referral.id },
					})),
				),
		]);

		return {
			role: user.role,
			summary,
			report,
			recentPatients,
			recentReferrals,
		};
	},
	pendingComponent: () => (
		<div className="flex h-64 items-center justify-center">
			<Loader text="Loading dashboard..." size="md" />
		</div>
	),
});
