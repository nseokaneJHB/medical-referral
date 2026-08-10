import type { ForwardRefExoticComponent, RefAttributes } from "react";

import {
	useRouteContext,
	useRouterState,
	type LinkProps,
} from "@tanstack/react-router";

import {
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

import { ROLES, FRONTEND_URLS } from "@referral-tracking/shared";

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
		to: FRONTEND_URLS.AUDIT,
		icon: HistoryIcon,
		label: "Audit log",
		roles: [ROLES.ADMINISTRATOR],
	},
];

export const SideBar = () => {
	const { user } = useRouteContext({ strict: true, from: "/_authenticated" });

	const pathname = useRouterState({ select: (s) => s.location.pathname });

	const { state, toggleSidebar } = useSidebar();

	const visibleNavItems = NAV_ITEMS.filter(
		(item) => !item.roles || item.roles.includes(user.role),
	);

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
								to="/"
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
								</SidebarMenuItem>
							))}
							{user.role === ROLES.MANAGER && user.facility_id && (
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
