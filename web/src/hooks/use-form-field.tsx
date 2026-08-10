import type { ChangeEvent } from "react";

import {
	useController,
	type Path,
	type Control,
	type FieldValues,
} from "react-hook-form";

type UseFormFieldProps<TFieldValues extends FieldValues> = {
	name: Path<TFieldValues>;
	control: Control<TFieldValues>;
	type?: "string" | "number" | "date" | "boolean" | "select";
};

type DomChangeHandler = (
	event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
) => void;

// Shared shape every branch returns — only `value`/`onChange` differ per type.
type FieldFieldResult<TValue, TOnChange> = {
	value: TValue;
	onChange: TOnChange;
	loading: boolean;
	error: string | undefined;
};

// One generic DOM-based overload covers number/date/boolean/string — only
// `value`'s type changes per type literal, onChange shape never does.
export function useFormField<TFieldValues extends FieldValues>(
	props: UseFormFieldProps<TFieldValues> & { type: "number" },
): FieldFieldResult<number | string, DomChangeHandler>;

export function useFormField<TFieldValues extends FieldValues>(
	props: UseFormFieldProps<TFieldValues> & { type: "date" },
): FieldFieldResult<string, DomChangeHandler>;

export function useFormField<TFieldValues extends FieldValues>(
	props: UseFormFieldProps<TFieldValues> & { type: "boolean" },
): FieldFieldResult<boolean, DomChangeHandler>;

export function useFormField<TFieldValues extends FieldValues>(
	props: UseFormFieldProps<TFieldValues> & { type?: "string" },
): FieldFieldResult<string, DomChangeHandler>;

// "select" is the one genuinely different shape — no DOM event involved.
export function useFormField<TFieldValues extends FieldValues>(
	props: UseFormFieldProps<TFieldValues> & { type: "select" },
): FieldFieldResult<
	string | Array<string>,
	(value: string | Array<string>) => void
>;

export function useFormField<TFieldValues extends FieldValues>({
	name,
	control,
	type = "string",
}: UseFormFieldProps<TFieldValues>) {
	const { field, fieldState, formState } = useController({
		name,
		control,
	});

	const base = {
		loading: formState.isSubmitting,
		error: fieldState.error?.message,
	};

	if (type === "select") {
		return {
			...base,
			value: field.value,
			onChange: (value: string | Array<string>) => field.onChange(value),
		};
	}

	const handleChange = (
		event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => {
		const { value } = event.target;
		const isCheckbox = event.target.type === "checkbox";

		let parsed: string | number | Date | boolean = value;

		if (type === "number" && value) {
			parsed = Number(value);
		} else if (type === "boolean") {
			parsed = isCheckbox
				? (event.target as HTMLInputElement).checked
				: Boolean(value);
		}

		field.onChange(parsed);
	};

	const value = (() => {
		if (type === "number") {
			return field.value ?? "";
		}

		if (type === "date") {
			if (!field.value) return "";
			return new Date(field.value).toISOString().split("T")[0];
		}

		if (type === "boolean") {
			return field.value ?? false;
		}

		return field.value?.toString() ?? "";
	})();

	return { ...base, value, onChange: handleChange };
}
