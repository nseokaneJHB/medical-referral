import type { ComponentType } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
	value: string;
	label: string;
	className?: string;
	onClick?: VoidFunction;
	icon: ComponentType<{ className?: string }>;
}

export const StatCard = ({
	value,
	label,
	className,
	onClick,
	icon: Icon,
}: StatCardProps) => {
	return (
		<Card className={cn(className)} onClick={onClick}>
			<CardContent className="space-y-2">
				<Icon className="h-5! w-5!" />
				<h1 className="text-2xl font-bold">{value}</h1>
				<small className="text-muted-foreground text-sm">{label}</small>
			</CardContent>
		</Card>
	);
};
