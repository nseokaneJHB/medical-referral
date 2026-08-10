import type { ComponentType } from "react";

import { LinkProps } from "@tanstack/react-router";

import { Link } from "@/components/custom/link";
import { ThemeToggle } from "@/components/custom/theme-toggle";

import { env } from "@/lib/env";

export interface NavigationProps {
	title: string;
	count?: number;
	to: LinkProps["to"];
	icon: ComponentType<{ className?: string }>;
}

export const Navigation = () => {
	return (
		<div className="bg-background sticky top-0 z-50 shrink border-b px-8 py-4 shadow-sm">
			<nav className="flex items-center justify-between">
				<Link
					to="/"
					title="Home"
					variant="link"
					buttonClassName="hover:no-underline p-0"
					className="flex h-16 w-fit items-center space-x-3"
				>
					<span className="font-serif text-3xl font-bold normal-case">
						{env.VITE_APP_NAME}
					</span>
				</Link>

				<ThemeToggle />
			</nav>
		</div>
	);
};
