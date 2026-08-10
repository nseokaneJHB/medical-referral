import {
	Link as TanstackLink,
	type LinkProps as TanstackLinkProps,
} from "@tanstack/react-router";

import type { VariantProps } from "class-variance-authority";

import { Button, type buttonVariants } from "@/components/ui/button";

import { cn } from "@/lib/utils";

interface LinkProps extends TanstackLinkProps {
	title: string;
	className?: string;
	buttonClassName?: string;
	activePropsClassName?: string;
	size?: VariantProps<typeof buttonVariants>["size"];
	variant?: VariantProps<typeof buttonVariants>["variant"];
}

export const Link = ({
	title,
	children,
	className,
	buttonClassName,
	size = "default",
	variant = "ghost",
	activePropsClassName,
	...props
}: LinkProps) => {
	if (variant === "ghost" || variant === "outline") {
		activePropsClassName = cn(
			"bg-sunrise-orange text-background dark:hover:bg-root-red dark:text-foreground",
			activePropsClassName,
		);
	}

	return (
		<Button asChild size={size} variant={variant} className={buttonClassName}>
			<TanstackLink
				{...props}
				title={title}
				className={cn(
					"flex items-center justify-center space-x-2 font-normal",
					className,
				)}
				activeOptions={{ includeSearch: true, ...props.activeOptions }}
				activeProps={{ className: cn("font-bold!", activePropsClassName) }}
			>
				{children}
			</TanstackLink>
		</Button>
	);
};
