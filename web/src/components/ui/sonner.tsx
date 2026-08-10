import type { CSSProperties } from "react";

import {
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	CircleCheckIcon,
	TriangleAlertIcon,
} from "lucide-react";

import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

import { stringToTitleCase } from "@referral-tracking/shared";

import { useTheme } from "@/integrations/theme-provider";

import { cn } from "@/lib/utils";

const Toaster = ({ ...props }: ToasterProps) => {
	const { theme } = useTheme();

	return (
		<SonnerToaster
			richColors
			closeButton
			duration={5000}
			position="top-center"
			className="toaster group"
			theme={theme as ToasterProps["theme"]}
			toastOptions={{
				classNames: {
					icon: "mt-1",
					toast: "items-start!",
					closeButton:
						"border-error! bg-error! text-light-error! hover:bg-light-error! hover:text-error!",
				},
			}}
			icons={{
				success: <CircleCheckIcon className="h-5 w-5" />,
				info: <InfoIcon className="h-5 w-5" />,
				warning: <TriangleAlertIcon className="h-5 w-5" />,
				error: <OctagonXIcon className="h-5 w-5" />,
				loading: <Loader2Icon className="h-5 w-5 animate-spin" />,
			}}
			style={
				{
					"--border-radius": "var(--radius)",
					// Normal
					"--normal-bg": "var(--popover)",
					"--normal-text": "var(--popover-foreground)",
					"--normal-border": "var(--border)",
					// Success
					"--success-bg": "var(--color-light-success)",
					"--success-text": "var(--color-success)",
					"--success-border": "var(--color-success)",
					// Info
					"--info-bg": "var(--color-light-info)",
					"--info-text": "var(--color-info)",
					"--info-border": "var(--color-info)",
					// Warning
					"--warning-bg": "var(--color-light-warning)",
					"--warning-text": "var(--color-warning)",
					"--warning-border": "var(--color-warning)",
					// Error
					"--error-bg": "var(--color-light-error)",
					"--error-text": "var(--color-error)",
					"--error-border": "var(--color-error)",
				} as CSSProperties
			}
			{...props}
		/>
	);
};

type ToastType = "loading" | "success" | "info" | "warning" | "error";

interface ToastContentProps {
	title: string;
	type: ToastType;
	description: string;
}

const ToastContent = (payload: ToastContentProps) => {
	const { title, description, type } = payload;

	return (
		<div className="space-y-2">
			<h3 className="text-lg font-bold">{stringToTitleCase(title)}</h3>
			<p
				className={cn({
					"toast-info": type === "info",
					"toast-error": type === "error",
					"toast-normal": type === "loading",
					"toast-success": type === "success",
					"toast-warning": type === "warning",
				})}
			>
				{description}
			</p>
		</div>
	);
};

export { ToastContentProps, Toaster, ToastContent };
