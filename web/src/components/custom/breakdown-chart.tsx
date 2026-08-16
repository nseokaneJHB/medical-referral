import { Bar, Cell, XAxis, YAxis, BarChart, CartesianGrid } from "recharts";

import {
	ChartTooltip,
	ChartContainer,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart";

interface BreakdownChartProps {
	data: { key: string; label: string; value: number }[];
	config: ChartConfig;
}

export const BreakdownChart = ({ data, config }: BreakdownChartProps) => (
	<ChartContainer config={config} className="h-64">
		<BarChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
			<CartesianGrid vertical={false} />
			<XAxis dataKey="label" tickLine={false} axisLine={false} />
			<YAxis
				allowDecimals={false}
				tickLine={false}
				axisLine={false}
				width={32}
			/>
			<ChartTooltip content={<ChartTooltipContent />} />
			<Bar dataKey="value" radius={4}>
				{data.map((entry) => (
					<Cell key={entry.key} fill={`var(--color-${entry.key})`} />
				))}
			</Bar>
		</BarChart>
	</ChartContainer>
);
