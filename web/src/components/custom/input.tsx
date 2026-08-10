import type { ComponentType, ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input as ShadCnInput } from "@/components/ui/input";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";

import { cn } from "@/lib/utils";

interface InputProps extends ComponentProps<"input"> {
	name: string;
	label?: string;
	error?: string;
	loading?: boolean;
	containerClassName?: string;
	iconRightProps?: ComponentProps<"button">;
	iconRight?: ComponentType<{ className?: string }>;
}

export const Input = ({
	name,
	label,
	error,
	iconRightProps,
	loading = false,
	containerClassName,
	iconRight: IconRight,
	...props
}: InputProps) => {
	const rightIconClassNames =
		"absolute self-center border flex items-center justify-center rounded-sm transition-all";

	return (
		<Field className={cn("w-full gap-1", containerClassName)}>
			{label && <FieldLabel>{label}</FieldLabel>}
			<div className="relative flex items-center">
				<ShadCnInput
					{...props}
					name={name}
					className={cn(
						{
							"pr-8!": IconRight,
							"border-error": error,
						},
						props.className,
					)}
				/>
				{IconRight && (
					<Button
						variant="outline"
						{...iconRightProps}
						className="bg-background hover:bg-background! hover:text-foreground! absolute right-0.5 h-11 w-10 border-0 shadow-none hover:cursor-pointer"
					>
						<Spinner
							className={cn(
								rightIconClassNames,
								loading ? "scale-100 rotate-0" : "scale-0 rotate-90",
							)}
						/>
						<IconRight
							className={cn(
								"flex items-center justify-center rounded-sm transition-all",
								"",
								loading ? "scale-0 rotate-90" : "scale-100 rotate-0",
							)}
						/>
					</Button>
				)}
			</div>
			{error && (
				<FieldDescription className="text-error pl-3 text-start">
					{error}
				</FieldDescription>
			)}
		</Field>
	);
};
