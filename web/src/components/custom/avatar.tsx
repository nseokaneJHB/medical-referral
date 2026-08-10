import { useState, type ComponentType } from "react";

import {
	Avatar as RadixAvatar,
	AvatarImage as RadixAvatarImage,
	AvatarFallback as RadixAvatarFallback,
} from "@radix-ui/react-avatar";

import { Spinner } from "@/components/ui/spinner";

import { cn } from "@/lib/utils";

type ImageLoadingStatus = "loading" | "idle" | "loaded" | "error";

interface AvatarProps {
	rounded?: boolean;
	className?: string;
	name: string | null;
	image: string | null;
	fallbackIcon: ComponentType<{ className?: string }>;
}

export const Avatar = ({
	name,
	image,
	className,
	fallbackIcon,
	rounded = false,
}: AvatarProps) => {
	const [imageStatus, setImageStatus] = useState<ImageLoadingStatus>(
		image ? "loading" : "idle",
	);

	const Icon = fallbackIcon;

	return (
		<RadixAvatar
			className={cn(
				"bg-foreground/10 text-foreground flex border",
				rounded ? "rounded-full" : "rounded-lg",
				image ? "" : "", // TODO: See what to do here
				{ "p-1": !image || imageStatus === "error" },
				className,
			)}
		>
			{image && imageStatus !== "error" ? (
				<RadixAvatarImage
					src={image}
					alt={name || "Anonymous"}
					onLoadingStatusChange={(status: ImageLoadingStatus) => {
						setImageStatus(status);
					}}
					className={cn(
						"h-full w-full",
						rounded ? "rounded-full" : "rounded-lg",
					)}
				/>
			) : (
				<RadixAvatarFallback
					className={cn(
						"flex h-full w-full items-center justify-center text-lg font-semibold text-inherit uppercase",
						rounded ? "rounded-full" : "rounded-lg",
					)}
				>
					{imageStatus === "loading" ? (
						<Spinner className="h-full! w-full! stroke-1" />
					) : (
						<Icon className="h-full! w-full! stroke-1" />
					)}
				</RadixAvatarFallback>
			)}
		</RadixAvatar>
	);
};
