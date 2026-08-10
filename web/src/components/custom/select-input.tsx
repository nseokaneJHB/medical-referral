import { useMemo, useRef, useState, useEffect } from "react";
import {
	CheckCircleIcon,
	MinusCircleIcon,
	ChevronsUpDownIcon,
} from "lucide-react";

import { stringToTitleCase } from "@referral-tracking/shared";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Command,
	CommandList,
	CommandItem,
	CommandEmpty,
	CommandGroup,
	CommandInput,
} from "@/components/ui/command";

import { cn } from "@/lib/utils";

export interface SelectItemProps {
	label: string;
	value: string;
}

interface SharedProps {
	label?: string;
	error?: string;
	disabled?: boolean;
	className?: string;
	placeholder: string;
	searchable?: boolean;
	description?: string;
	containerClassName?: string;
	items: Array<SelectItemProps>;
}

// multiple=true → value/onChange work with string[]
interface MultiSelectProps extends SharedProps {
	multiple: true;
	value: Array<string>;
	onChange: (value: Array<string>) => void;
}

// multiple=false (or omitted) → value/onChange work with a plain string
interface SingleSelectProps extends SharedProps {
	multiple?: false;
	value: string | undefined;
	onChange: (value: string | undefined) => void;
}

export type SelectInputProps = MultiSelectProps | SingleSelectProps;

export const SelectInput = (props: SelectInputProps) => {
	const {
		items,
		label,
		error,
		onChange,
		className,
		placeholder,
		description,
		disabled = false,
		multiple = false,
		containerClassName,
		searchable = false,
	} = props;

	const triggerRef = useRef<HTMLDivElement>(null);

	const [open, setOpen] = useState(false);

	const committedValues: Array<string> = props.multiple
		? props.value
		: props.value
			? [props.value]
			: [];

	// Draft selection used only while the multi-select popover is open,
	// so Apply/Reset can commit or discard without mutating `value` directly.
	const [draft, setDraft] = useState<Array<string>>(committedValues);

	useEffect(() => {
		if (open) setDraft(committedValues);
	}, [open]);

	const toggleItem = (itemValue: string) => {
		if (multiple) {
			setDraft((prev) =>
				prev.includes(itemValue)
					? prev.filter((v) => v !== itemValue)
					: [...prev, itemValue],
			);
			return;
		}

		(onChange as SingleSelectProps["onChange"])(itemValue);
		setOpen(false);
	};

	const activeSelection = multiple ? draft : committedValues;

	const displayValue = useMemo(() => {
		if (activeSelection.length === 0) return stringToTitleCase(placeholder);

		const selectedLabels = items
			.filter((item) => activeSelection.includes(item.value))
			.map((item) => item.label);

		if (selectedLabels.length > 2) {
			return `${selectedLabels.slice(0, 2).join(", ")} + ${selectedLabels.length - 2} more`;
		}

		return selectedLabels.join(", ");
	}, [activeSelection, items, placeholder]);

	const isDraftDirty = useMemo(() => {
		if (draft.length !== committedValues.length) return true;
		return !draft.every((v) => committedValues.includes(v));
	}, [draft, committedValues]);

	return (
		<Field className={cn("w-full gap-1", containerClassName)}>
			{label && <FieldLabel>{label}</FieldLabel>}
			<Popover open={open} onOpenChange={setOpen}>
				<div ref={triggerRef}>
					<PopoverTrigger asChild>
						<Button
							role="combobox"
							variant="outline"
							disabled={disabled}
							aria-expanded={open}
							aria-controls="combobox"
							className={cn(
								"h-12 w-full justify-between font-serif text-lg!",
								{
									"hover:bg-accent/50": open || committedValues.length > 0,
									"text-muted-foreground": committedValues.length < 1,
									"border-error": error,
								},
								className,
							)}
						>
							<span className="truncate">{displayValue}</span>
							<ChevronsUpDownIcon
								className={cn("ml-2 h-4 w-4 shrink-0", {
									"text-error": error,
								})}
							/>
						</Button>
					</PopoverTrigger>
				</div>
				<PopoverContent
					className="w-full p-0"
					style={{ width: Math.max(triggerRef.current?.offsetWidth ?? 0, 220) }}
				>
					<Command>
						{searchable && (
							<CommandInput placeholder={`Search ${label?.toLowerCase()}...`} />
						)}
						<CommandList>
							<CommandEmpty>No results found.</CommandEmpty>
							<CommandGroup>
								{items.map((item) => (
									<CommandItem
										key={item.value}
										value={item.label}
										className="relative cursor-pointer"
										onSelect={() => toggleItem(item.value)}
									>
										<CheckCircleIcon
											className={cn(
												"text-success h-4 w-4 transition-all",
												draft.includes(item.value)
													? "scale-100 rotate-0"
													: "scale-0 rotate-90",
											)}
										/>
										<MinusCircleIcon
											className={cn(
												"text-muted-foreground absolute h-4 w-4 transition-all",
												draft.includes(item.value)
													? "scale-0 rotate-90"
													: "scale-100 rotate-0",
											)}
										/>
										{item.label}
									</CommandItem>
								))}
							</CommandGroup>
						</CommandList>
					</Command>
					{multiple && (
						<div className="flex justify-end gap-2 border-t p-3">
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									setDraft([]);
									setOpen(false);
									(onChange as MultiSelectProps["onChange"])([]);
								}}
							>
								<span>{committedValues.length > 0 ? "Reset" : "Cancel"}</span>
							</Button>
							<Button
								size="sm"
								disabled={!isDraftDirty}
								onClick={() => {
									(onChange as MultiSelectProps["onChange"])(draft);
									setOpen(false);
								}}
							>
								<span>Apply</span>
							</Button>
						</div>
					)}
				</PopoverContent>
			</Popover>
			{description && <FieldDescription>{description}</FieldDescription>}
			{error && (
				<FieldDescription className="text-error pl-3 text-start">
					{error}
				</FieldDescription>
			)}
		</Field>
	);
};
