import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center group justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none  aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground hover:bg-primary/90",
				destructive:
					"bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
				outline:
					"border bg-background hover:text-primary-foreground hover:bg-accent dark:hover:bg-accent/50",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80",
				ghost:
					"hover:bg-accent dark:hover:bg-accent/50 border hover:text-background",
				link: "text-primary underline-offset-8 hover:text-accent hover:underline",
				success: "bg-success text-light-success hover:bg-success/80",
				"success-outline":
					"border border-success text-success hover:bg-light-success hover:text-success dark:hover:bg-light-success/10",
				warning: "bg-warning text-night-ink hover:bg-warning/80",
				"warning-outline":
					"border border-warning text-warning hover:bg-light-warning hover:text-warning dark:hover:bg-light-warning/10",
				error: "bg-error text-light-error hover:bg-error/80",
				"error-outline":
					"border border-error text-error hover:bg-light-error hover:text-error dark:hover:bg-light-error/10",
				info: "bg-info text-light-info hover:bg-info/80",
				"info-outline":
					"border border-info text-info hover:bg-light-info hover:text-info dark:hover:bg-light-info/10",
			},
			size: {
				default: "h-10 px-4 py-2 has-[>svg]:px-3",
				sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
				lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
				icon: "size-9",
				"icon-sm": "size-8",
				"icon-lg": "size-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	...props
}: ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot.Root : "button";

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
