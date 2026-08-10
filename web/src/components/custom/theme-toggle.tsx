import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/integrations/theme-provider";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
	className?: string;
	showLabel?: boolean;
	labelClassName?: string;
}

export const ThemeToggle = ({
	className,
	labelClassName,
	showLabel = false,
}: ThemeToggleProps) => {
	const { setTheme, theme } = useTheme();

	return (
		<Button
			size="icon"
			variant="outline"
			title="Toggle theme"
			className={cn("rounded-full p-4!", className)}
			onClick={() => setTheme(theme === "light" ? "dark" : "light")}
		>
			<div className="relative items-center justify-center">
				<Sun className="h-5! w-5! scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
				<Moon className="absolute top-0 h-5! w-5! scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
			</div>
			{showLabel && <span className={labelClassName}>Toggle theme</span>}
		</Button>
	);
};
