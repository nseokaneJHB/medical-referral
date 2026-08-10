import { useRouter } from "@tanstack/react-router";

import { HomeIcon, ArrowLeftIcon, ArrowLeftRightIcon } from "lucide-react";

import { Link } from "@/components/custom/link";
import { Button } from "@/components/ui/button";

export const NotFound = () => {
	const router = useRouter();

	return (
		<div className="flex w-full flex-col items-center justify-center space-y-6 text-center">
			<div>
				<div className="relative inline-block">
					<div className="bg-background absolute inset-0 animate-pulse rounded-full opacity-30 blur-3xl" />
					<Link
						to="/"
						title="Home"
						variant="link"
						buttonClassName="hover:no-underline relative h-72 w-fit rounded-full"
					>
						<div className="bg-primary/10 flex h-full w-full items-center justify-center rounded-full">
							<ArrowLeftRightIcon className="text-primary h-24 w-24" />
						</div>
					</Link>
				</div>
				<h1 className="text-primary font-serif text-8xl font-bold md:text-9xl">
					404
				</h1>

				<div className="bg-primary mx-auto h-1 w-48 rounded-full" />
			</div>

			<div className="space-y-2">
				<h2 className="text-ubuntu-brown dark:text-heritage-gold font-serif text-3xl font-bold md:text-4xl">
					Page Not Found
				</h2>
				<p className="text-muted-foreground text-lg">
					This page seems to have wandered off into an untold story. Let's get
					you back to familiar tales.
				</p>
			</div>

			<div className="flex flex-col items-center justify-center space-x-2 sm:flex-row">
				<Button
					size="lg"
					variant="outline"
					onClick={() => router.history.back()}
					className="transition-all duration-300"
				>
					<ArrowLeftIcon className="h-5 w-5 transition-transform group-hover:-translate-x-1 hover:shadow-xl" />
					<span>Go Back</span>
				</Button>

				<Link title="Home" size="lg" to="/" variant="default">
					<HomeIcon className="h-5 w-5 transition-transform group-hover:scale-110" />
					<span>Home</span>
				</Link>
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
					"Every story has a path, even the lost ones find their way home."
				</p>
			</div>
		</div>
	);
};
