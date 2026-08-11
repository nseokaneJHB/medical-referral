import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

export type ChartConfig = Record<string, { label: string; color: string }>;

interface ChartContainerProps extends React.ComponentProps<"div"> {
	config: ChartConfig;
	children: React.ComponentProps<
		typeof RechartsPrimitive.ResponsiveContainer
	>["children"];
}

function ChartContainer({
	config,
	className,
	children,
	...props
}: ChartContainerProps) {
	const style = Object.fromEntries(
		Object.entries(config).map(([key, value]) => [`--color-${key}`, value.color]),
	) as React.CSSProperties;

	return (
		<div
			data-slot="chart"
			className={cn(
				"[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border/50 flex w-full text-xs",
				className,
			)}
			style={style}
			{...props}
		>
			<RechartsPrimitive.ResponsiveContainer>
				{children}
			</RechartsPrimitive.ResponsiveContainer>
		</div>
	);
}

function ChartTooltipContent({
	active,
	payload,
	label,
}: Partial<RechartsPrimitive.TooltipContentProps<number, string>>) {
	if (!active || !payload?.length) return null;

	return (
		<div className="bg-popover text-popover-foreground grid gap-1.5 rounded-lg border px-3 py-2 text-sm shadow-md">
			{label && <p className="font-medium">{label}</p>}
			{payload.map((item, index) => (
				<div key={index} className="flex items-center gap-2">
					<span
						className="h-2 w-2 shrink-0 rounded-full"
						style={{ backgroundColor: item.color }}
					/>
					<span className="text-muted-foreground">{item.name}</span>
					<span className="ml-auto font-medium">{item.value}</span>
				</div>
			))}
		</div>
	);
}

const ChartTooltip = RechartsPrimitive.Tooltip;

export { ChartContainer, ChartTooltip, ChartTooltipContent };
