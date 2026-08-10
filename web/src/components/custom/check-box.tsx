import type { ComponentProps } from "react";

import { Checkbox as ShadcnCheckbox } from "@/components/ui/checkbox";

import { Label } from "@/components/ui/label";

interface CheckboxProps extends ComponentProps<typeof ShadcnCheckbox> {
	name: string;
	label?: string;
}

export const CheckBox = ({ label, name, ...props }: CheckboxProps) => {
	return (
		<div className="flex items-center space-x-2">
			<ShadcnCheckbox
				{...props}
				name={name}
				className="border-clay-gray data-[state=checked]:bg-root-red data-[state=checked]:border-root-red cursor-pointer"
			/>
			{label && (
				<Label htmlFor={name} className="cursor-pointer text-sm font-normal">
					{label}
				</Label>
			)}
		</div>
	);
};
