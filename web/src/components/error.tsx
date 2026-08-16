import {
	useMatch,
	useRouter,
	rootRouteId,
	type ErrorComponentProps,
} from "@tanstack/react-router";

import {
	ArrowLeftIcon,
	HomeIcon,
	RotateCcwIcon,
	ArrowLeftRightIcon,
} from "lucide-react";

import { isApiErrorResponse, CLIENT_ERROR } from "@/api";

import { Link } from "@/components/custom/link";
import { Button } from "@/components/ui/button";
import { FRONTEND_URLS, stringToTitleCase } from "@referral-tracking/shared";

export const Error = ({ error }: ErrorComponentProps) => {
	const router = useRouter();
	const isRoot = useMatch({
		strict: false,
		select: (state) => state.id === rootRouteId,
	});

	const code = isApiErrorResponse(error)
		? error.code
		: CLIENT_ERROR.UNKNOWN_ERROR;

	const message =
		error.message ||
		"Something went wrong while trying to load this page. Let's get you back to familiar tales.";

	return (
		<div className="flex w-full flex-col items-center justify-center space-y-6 text-center">
			<div>
				<div className="relative inline-block">
					<div className="bg-background absolute inset-0 animate-pulse rounded-full opacity-30 blur-3xl" />
					<Link
						to={FRONTEND_URLS.HOME}
						title="Home"
						variant="link"
						buttonClassName="hover:no-underline relative h-72 w-fit rounded-full"
					>
						<div className="bg-primary/10 flex h-full w-full items-center justify-center rounded-full">
							<ArrowLeftRightIcon className="text-primary h-24 w-24" />
						</div>
					</Link>
				</div>
				<h2 className="text-primary font-serif text-3xl font-bold md:text-4xl">
					{stringToTitleCase(code).toUpperCase()}
				</h2>

				<div className="bg-primary mx-auto h-1 w-48 rounded-full" />
			</div>

			<div className="space-y-2">
				<p className="text-muted-foreground text-lg">{message}</p>
			</div>

			<div className="flex flex-col items-center justify-center space-x-2 sm:flex-row">
				<Button
					size="lg"
					variant="outline"
					onClick={() => router.invalidate()}
					className="transition-all duration-300"
				>
					<RotateCcwIcon className="h-5 w-5 transition-transform group-hover:-translate-x-1 hover:shadow-xl" />
					<span>Try again</span>
				</Button>

				{isRoot ? (
					<Link
						title="Home"
						size="lg"
						to={FRONTEND_URLS.HOME}
						variant="default"
					>
						<HomeIcon className="h-5 w-5 transition-transform group-hover:scale-110" />
						<span>Home</span>
					</Link>
				) : (
					<Button
						size="lg"
						variant="default"
						onClick={() => router.history.back()}
						className="transition-all duration-300"
					>
						<ArrowLeftIcon className="h-5 w-5 transition-transform group-hover:-translate-x-1 hover:shadow-xl" />
						<span>Go Back</span>
					</Button>
				)}
			</div>

			<div className="relative mt-6 space-y-2">
				<div className="flex justify-center space-x-2">
					{["dot-1", "dot-2", "dot-3", "dot-4", "dot-5"].map((id, i) => (
						<div
							key={id}
							className="animate-bounce-dot bg-primary h-2 w-2 rounded-full"
							style={{ animationDelay: `${i * 0.1}s` }}
						></div>
					))}
				</div>
				<p className="text-accent text-sm italic">
					"Every story has a potential, even the broken ones find their feet."
				</p>
			</div>
		</div>
	);
};
