import type { ReactNode } from "react";

import { Field, FieldLabel } from "@/components/ui/field";

import { cn } from "@/lib/utils";

interface ReadOnlyFieldProps {
	label?: string;
	value: ReactNode;
	className?: string;
	containerClassName?: string;
}

export const ReadOnlyField = ({
	label,
	value,
	className,
	containerClassName,
}: ReadOnlyFieldProps) => {
	return (
		<Field className={cn("flex w-full gap-1", containerClassName)}>
			{label && <FieldLabel>{label}</FieldLabel>}
			<p
				className={cn(
					"text-foreground flex h-12 w-full items-center overflow-hidden rounded-md border bg-transparent px-3 font-serif text-lg text-ellipsis whitespace-nowrap",
					className,
				)}
			>
				{value || "—"}
			</p>
		</Field>
	);
};
