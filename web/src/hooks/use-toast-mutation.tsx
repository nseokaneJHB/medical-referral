import { toast } from "sonner";

import { type GlobalResponse } from "@referral-tracking/shared";

import { ToastContent } from "@/components/ui/sonner";

import type { ApiError } from "@/api";

interface ToastMutationPayload<T extends GlobalResponse> {
	loading: string;
	promise: Promise<T>;
	onSuccess?: (data: T) => void;
	onError?: (error: ApiError) => void;
}

export const useToastMutation = <T extends GlobalResponse>(
	payload: ToastMutationPayload<T>,
) => {
	toast.dismiss();

	const { promise, loading, onSuccess, onError } = payload;

	return toast.promise(promise, {
		loading,

		success: (data: T) => {
			Promise.resolve(onSuccess?.(data)).catch((error) => {
				console.error("useToastMutation onSuccess failed:", error);
			});
			return (
				<ToastContent
					type="info"
					title={data.code}
					description={data.message}
				/>
			);
		},

		error: (error: unknown) => {
			const apiError = error as ApiError;
			Promise.resolve(onError?.(apiError)).catch((err) => {
				console.error("useToastMutation onError failed:", err);
			});

			return (
				<ToastContent
					type="error"
					title={apiError.code}
					description={apiError.message}
				/>
			);
		},
	});
};
