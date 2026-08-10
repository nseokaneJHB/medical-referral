import { Spinner } from "@/components/ui/spinner";

import { cn } from "@/lib/utils";

interface LoaderProps {
	text: string;
	size: "sm" | "md" | "lg";
}

export const Loader = ({ text, size }: LoaderProps) => {
	const sizes = {
		sm: {
			spinner: "h-10 w-10",
			text: "text-base",
			gap: "space-y-2",
		},
		md: {
			spinner: "h-14 w-14",
			text: "text-lg",
			gap: "space-y-3",
		},
		lg: {
			spinner: "h-16 w-16",
			text: "text-xl",
			gap: "space-y-4",
		},
	}[size];

	return (
		<div
			className={cn(
				"text-primary flex animate-pulse flex-col items-center justify-center",
				sizes.gap,
			)}
		>
			<Spinner className={sizes.spinner} />
			<p className={cn("font-medium tracking-wider", sizes.text)}>{text}</p>
		</div>
	);
};
