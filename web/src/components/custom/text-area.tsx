import type { ComponentProps } from "react";

import { Textarea as ShadCnTextarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";

import { cn } from "@/lib/utils";

interface TextAreaProps extends ComponentProps<"textarea"> {
	name: string;
	label?: string;
	error?: string;
	containerClassName?: string;
}

export const TextArea = ({
	name,
	label,
	error,
	containerClassName,
	...props
}: TextAreaProps) => {
	return (
		<Field className={cn("w-full gap-1", containerClassName)}>
			{label && <FieldLabel>{label}</FieldLabel>}
			<ShadCnTextarea
				{...props}
				name={name}
				className={cn(
					"wrap-break-word",
					{ "border-error": error },
					props.className,
				)}
			/>
			{error && (
				<FieldDescription className="text-error pl-3 text-start">
					{error}
				</FieldDescription>
			)}
		</Field>
	);
};
