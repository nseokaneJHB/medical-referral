import {
	useRouter,
	useCanGoBack,
	type LinkProps,
} from "@tanstack/react-router";

import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Link } from "@/components/custom/link";

import { cn } from "@/lib/utils";

interface BackLinkProps {
	label: string;
	fallbackTo: LinkProps["to"];
	className?: string;
}

// Real browser-history back when there's app-internal history to return to
// (preserves the exact prior URL + filters for free); falls back to a
// fixed list page for a direct/bookmarked visit with nothing to go back to.
export const BackLink = ({ label, fallbackTo, className }: BackLinkProps) => {
	const router = useRouter();
	const canGoBack = useCanGoBack();

	if (canGoBack) {
		return (
			<Button
				variant="ghost"
				title={label}
				onClick={() => router.history.back()}
				className={cn("w-fit space-x-1", className)}
			>
				<ArrowLeftIcon />
				<span>{label}</span>
			</Button>
		);
	}

	return (
		<Link
			variant="ghost"
			title={label}
			to={fallbackTo}
			className={cn("w-fit space-x-1", className)}
		>
			<ArrowLeftIcon />
			<span>{label}</span>
		</Link>
	);
};
