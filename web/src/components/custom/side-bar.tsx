import type { ForwardRefExoticComponent, RefAttributes } from "react";

import {
	useRouteContext,
	useRouterState,
	type LinkProps,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import {
	GavelIcon,
	RepeatIcon,
	HomeIcon,
	UsersIcon,
	UserIcon,
	HistoryIcon,
	LucideProps,
	Building2Icon,
	PanelLeftIcon,
	ClipboardListIcon,
	ArrowLeftRightIcon,
	ChevronsUpDownIcon,
} from "lucide-react";

import {
	ROLES,
	FRONTEND_URLS,
	USER_STATUS,
	FACILITY_STATUS,
	REFERRAL_STATUS,
} from "@referral-tracking/shared";

import { Button } from "@/components/ui/button";
import {
	useSidebar,
	SidebarMenu,
	SidebarRail,
	SidebarGroup,
	SidebarHeader,
	SidebarFooter,
	SidebarContent,
	SidebarMenuItem,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarGroupContent,
	Sidebar as ShadcnSidebar,
} from "@/components/ui/sidebar";

import {
	DropdownMenu,
	DropdownMenuItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { Link } from "@/components/custom/link";
import { Avatar } from "@/components/custom/avatar";
import { ThemeToggle } from "@/components/custom/theme-toggle";

import { SignOutButton } from "@/components/sign-out-button";

import { isManager, canViewNavItem, resolveModerationNamespace } from "@/lib/permissions";

import { QUERY_KEYS } from "@/api/constant";
import { usersRequest } from "@/api/users";
import { appealsRequest } from "@/api/appeals";
import { patientsRequest } from "@/api/patients";
import { transfersRequest } from "@/api/transfers";
import { referralsRequest } from "@/api/referrals";
import { facilitiesRequest } from "@/api/facilities";

interface NavItem {
	to: LinkProps["to"];
	label: string;
	roles?: (typeof ROLES)[keyof typeof ROLES][];
	icon: ForwardRefExoticComponent<
		Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>
	>;
}

const NAV_ITEMS: NavItem[] = [
	{
		to: FRONTEND_URLS.HOME,
		icon: HomeIcon,
		label: "Dashboard",
		roles: [ROLES.NURSE, ROLES.DOCTOR, ROLES.ADMINISTRATOR, ROLES.MANAGER],
	},
	{
		to: FRONTEND_URLS.PATIENTS,
		icon: ClipboardListIcon,
		label: "Patients",
		roles: [ROLES.NURSE, ROLES.DOCTOR, ROLES.MANAGER],
	},
	{
		to: FRONTEND_URLS.REFERRALS,
		icon: ArrowLeftRightIcon,
		label: "Referrals",
		roles: [ROLES.NURSE, ROLES.DOCTOR, ROLES.MANAGER],
	},
	{
		to: FRONTEND_URLS.USERS,
		icon: UsersIcon,
		label: "Users",
		roles: [ROLES.ADMINISTRATOR, ROLES.MANAGER],
	},
	{
		to: FRONTEND_URLS.FACILITIES,
		icon: Building2Icon,
		label: "Facilities",
		roles: [ROLES.ADMINISTRATOR],
	},
	{
		to: FRONTEND_URLS.TRANSFERS,
		icon: RepeatIcon,
		label: "Transfers",
		roles: [ROLES.ADMINISTRATOR, ROLES.MANAGER],
	},
	{
		to: FRONTEND_URLS.APPEALS,
		icon: GavelIcon,
		label: "Appeals",
		roles: [ROLES.ADMINISTRATOR, ROLES.MANAGER],
	},
	{
		to: FRONTEND_URLS.AUDIT,
		icon: HistoryIcon,
		label: "Audit log",
		roles: [ROLES.ADMINISTRATOR, ROLES.MANAGER],
	},
];

export const SideBar = () => {
	const { user } = useRouteContext({ strict: true, from: "/_authenticated" });

	const pathname = useRouterState({ select: (s) => s.location.pathname });

	const { state, toggleSidebar } = useSidebar();

	const visibleNavItems = NAV_ITEMS.filter(
		(item) => canViewNavItem(user, item),
	);

	const showUsersBadge = visibleNavItems.some(
		(item) => item.to === FRONTEND_URLS.USERS,
	);
	const showFacilitiesBadge = visibleNavItems.some(
		(item) => item.to === FRONTEND_URLS.FACILITIES,
	);
	const showTransfersBadge = visibleNavItems.some(
		(item) => item.to === FRONTEND_URLS.TRANSFERS,
	);
	const showAppealsBadge = visibleNavItems.some(
		(item) => item.to === FRONTEND_URLS.APPEALS,
	);
	const showReferralsBadge = visibleNavItems.some(
		(item) => item.to === FRONTEND_URLS.REFERRALS,
	);
	const showPatientsBadge = visibleNavItems.some(
		(item) => item.to === FRONTEND_URLS.PATIENTS,
	);

	const namespace = resolveModerationNamespace(user);

	const { data: usersPending } = useQuery({
		queryKey: [...QUERY_KEYS.USERS, "pending-count"],
		queryFn: () =>
			usersRequest({
				data: { page: "1", status: USER_STATUS.PENDING, limit: "1" },
			}),
		enabled: showUsersBadge,
	});

	const { data: facilitiesPending } = useQuery({
		queryKey: [...QUERY_KEYS.FACILITIES, "pending-count"],
		queryFn: () =>
			facilitiesRequest({
				data: { page: "1", status: FACILITY_STATUS.PENDING, limit: "1" },
			}),
		enabled: showFacilitiesBadge,
	});

	const { data: transfersPending } = useQuery({
		queryKey: [...QUERY_KEYS.TRANSFERS, namespace],
		queryFn: () => transfersRequest({ data: { namespace } }),
		enabled: showTransfersBadge,
	});

	const { data: appealsPending } = useQuery({
		queryKey: [...QUERY_KEYS.APPEALS, namespace],
		queryFn: () => appealsRequest({ data: { namespace } }),
		enabled: showAppealsBadge,
	});

	const { data: referralsPending } = useQuery({
		queryKey: [...QUERY_KEYS.REFERRALS, "pending-count"],
		queryFn: () =>
			referralsRequest({
				data: { page: "1", status: REFERRAL_STATUS.PENDING, limit: "1" },
			}),
		enabled: showReferralsBadge,
	});

	const { data: patientsTotal } = useQuery({
		queryKey: [...QUERY_KEYS.PATIENTS, "total-count"],
		queryFn: () => patientsRequest({ data: { page: "1", limit: "1" } }),
		enabled: showPatientsBadge,
	});

	const badgeCounts: Record<string, number | undefined> = {
		[FRONTEND_URLS.USERS]: usersPending?.total,
		[FRONTEND_URLS.FACILITIES]: facilitiesPending?.total,
		[FRONTEND_URLS.TRANSFERS]: transfersPending?.total,
		[FRONTEND_URLS.APPEALS]: appealsPending?.total,
		[FRONTEND_URLS.REFERRALS]: referralsPending?.total,
	};

	const totalBadgeCounts: Record<string, number | undefined> = {
		[FRONTEND_URLS.PATIENTS]: patientsTotal?.total,
	};

	return (
		<ShadcnSidebar collapsible="icon">
			<SidebarHeader>
				<SidebarMenu className="group-data-[collapsible=icon]:items-center">
					{state === "collapsed" && (
						<SidebarMenuItem>
							<Button
								title="expand"
								variant="ghost"
								onClick={toggleSidebar}
								className="border-none transition-all"
							>
								<PanelLeftIcon size={18} aria-hidden="true" />
							</Button>
						</SidebarMenuItem>
					)}
					<SidebarMenuItem className="items-center">
						<SidebarMenuButton size="lg" className="self-center" asChild>
							<Link
								to={FRONTEND_URLS.HOME}
								title="Home"
								variant="link"
								buttonClassName="hover:no-underline"
								className="h-16 justify-start! space-x-1 p-0"
							>
								<span className="font-serif text-lg font-bold group-data-[collapsible=icon]:hidden">
									Referral Tracking
								</span>
							</Link>
						</SidebarMenuButton>
						{state === "expanded" && (
							<Button
								variant="ghost"
								title="collapse"
								onClick={toggleSidebar}
								data-sidebar="menu-action"
								data-slot="sidebar-menu-action"
								className="absolute right-1 aspect-square self-center border-none transition-all"
							>
								<PanelLeftIcon size={18} aria-hidden="true" />
							</Button>
						)}
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu className="gap-2">
							{visibleNavItems.map((item) => (
								<SidebarMenuItem key={item.to}>
									<SidebarMenuButton asChild isActive={pathname === item.to}>
										<Link
											to={item.to}
											variant="outline"
											title={item.label}
											className="justify-start space-x-1 group-data-[collapsible=icon]:space-x-0"
										>
											<item.icon />
											<span className="group-data-[collapsible=icon]:hidden">
												{item.label}
											</span>
										</Link>
									</SidebarMenuButton>
									{(item.to as string) in badgeCounts && (
										<SidebarMenuBadge className="right-2 min-w-5 rounded-full bg-destructive px-1.5 text-destructive-foreground top-1/2! -translate-y-1/2!">
											{badgeCounts[item.to as string] ?? 0}
										</SidebarMenuBadge>
									)}
									{(item.to as string) in totalBadgeCounts && (
										<SidebarMenuBadge className="right-2 min-w-5 rounded-full bg-muted px-1.5 text-muted-foreground top-1/2! -translate-y-1/2!">
											{totalBadgeCounts[item.to as string] ?? 0}
										</SidebarMenuBadge>
									)}
								</SidebarMenuItem>
							))}
							{isManager(user) && user.facility_id && (
								<SidebarMenuItem>
									<SidebarMenuButton
										asChild
										isActive={pathname === `/facilities/${user.facility_id}`}
									>
										<Link
											variant="outline"
											title="My Facility"
											to={FRONTEND_URLS.FACILITY}
											params={{ facilityId: user.facility_id }}
											className="justify-start space-x-1 group-data-[collapsible=icon]:space-x-0"
										>
											<Building2Icon />
											<span className="group-data-[collapsible=icon]:hidden">
												My Facility
											</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							)}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter className="border-t">
				<SidebarMenu className="gap-2 group-data-[collapsible=icon]:items-center">
					<SidebarMenuItem>
						<ThemeToggle
							showLabel
							labelClassName="group-data-[collapsible=icon]:hidden"
							className="flex h-fit w-full justify-start rounded-md group-data-[collapsible=icon]:w-fit group-data-[collapsible=icon]:rounded-full! group-data-[collapsible=icon]:p-1!"
						/>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild className="hover:cursor-pointer">
								<Button
									variant="outline"
									title="Profile menu"
									className="h-fit w-full group-data-[collapsible=icon]:w-fit group-data-[collapsible=icon]:rounded-full! group-data-[collapsible=icon]:p-1!"
								>
									<Avatar
										rounded
										name={user.name}
										image={null}
										fallbackIcon={UserIcon}
										className="h-10 w-10 group-data-[collapsible=icon]:h-7 group-data-[collapsible=icon]:w-7"
									/>
									<div className="flex flex-col overflow-hidden text-left group-data-[collapsible=icon]:hidden">
										<p className="overflow-hidden font-bold text-ellipsis whitespace-nowrap">
											{user.name}
										</p>
										<small className="overflow-hidden text-ellipsis whitespace-nowrap opacity-70">
											{user.email}
										</small>
									</div>
									<ChevronsUpDownIcon
										className="ml-auto group-data-[collapsible=icon]:hidden"
										style={{
											width: "16px",
											height: "16px",
											flexShrink: 0,
											opacity: 0.6,
										}}
									/>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								align="end"
								side="right"
								className="min-w-56"
							>
								<div className="flex items-center justify-between space-x-2 p-2">
									<p className="overflow-hidden font-bold text-ellipsis whitespace-nowrap">
										{user.name}
									</p>
									<span className="text-muted-foreground text-xs capitalize">
										{user.role.toLowerCase()}
									</span>
								</div>
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<SignOutButton />
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>

			<SidebarRail />
		</ShadcnSidebar>
	);
};
