import { useState, type ComponentType } from "react";

import { useMutation } from "@tanstack/react-query";

import type { GlobalResponse } from "@referral-tracking/shared";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogTitle,
	DialogFooter,
	DialogHeader,
	DialogContent,
	DialogDescription,
} from "@/components/ui/dialog";

import { TextArea } from "@/components/custom/text-area";

import { useToastMutation } from "@/hooks/use-toast-mutation";

/**
 * A punitive/decision action (reject, flag, disable, suspend, deny, ...)
 * behind a required-reason confirm dialog — the shared shape behind every
 * such action across users, facilities, and appeals: a button that opens a
 * dialog, requires a non-empty reason, and disables its confirm button
 * until one is entered.
 */
export const ReasonActionButton = <T extends GlobalResponse>({
	label,
	title,
	variant,
	icon: Icon,
	description,
	reasonLabel = "Reason",
	mutationFn,
	onChanged,
}: {
	label: string;
	title: string;
	variant: "warning-outline" | "error-outline";
	icon: ComponentType<{ className?: string }>;
	description: string;
	reasonLabel?: string;
	mutationFn: (reason: string) => Promise<T>;
	onChanged: () => Promise<void>;
}) => {
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState("");

	const mutation = useMutation<T, Error, string>({ mutationFn });

	const onConfirm = async () =>
		useToastMutation({
			loading: `${label}ing...`,
			promise: mutation.mutateAsync(reason),
			onSuccess: async () => {
				setOpen(false);
				setReason("");
				await onChanged();
			},
		});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<Button
				type="button"
				variant={variant}
				title={title}
				size="sm"
				onClick={() => setOpen(true)}
			>
				<Icon />
				<span>{label}</span>
			</Button>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}?</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<TextArea
					required
					name="reason"
					label={reasonLabel}
					value={reason}
					onChange={(event) => setReason(event.target.value)}
				/>
				<DialogFooter>
					<Button
						type="button"
						variant="error"
						title={`Confirm ${label.toLowerCase()}`}
						disabled={mutation.isPending || reason.trim().length === 0}
						onClick={onConfirm}
					>
						<span>{label}</span>
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
