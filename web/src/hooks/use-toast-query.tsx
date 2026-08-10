import { useEffect } from "react";

import { useNavigate } from "@tanstack/react-router";

import { toast } from "sonner";

import { ToastContent, type ToastContentProps } from "@/components/ui/sonner";

export const useToastQuery = (payload: ToastContentProps | null) => {
	const navigate = useNavigate();

	useEffect(() => {
		toast.dismiss();

		if (!payload) return;

		toast[payload.type](<ToastContent {...payload} />, {
			duration: Infinity,
			onDismiss: () => {
				navigate({
					replace: true,
					search: (prev: Record<string, unknown>) => {
						// eslint-disable-next-line @typescript-eslint/no-unused-vars
						const { code, message, ...rest } = prev;

						// The result will always be a subset of whatever the route allows
						return rest as never;
					},
				});
			},
		});
	}, [payload?.title, payload?.description, payload?.type]);
};
