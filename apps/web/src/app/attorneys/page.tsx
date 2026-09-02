import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { ArrowLeft, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Attorney directory",
	description:
		"Meet the attorneys taking on cases through JustUs and the work they do.",
};

export default function AttorneysPage() {
	return (
		<main className="flex h-full items-center justify-center overflow-y-auto px-6 py-20">
			<div className="mx-auto max-w-md text-center">
				<Users className="mx-auto size-8 text-foreground" aria-hidden="true" />
				<h1 className="mt-6 font-semibold text-2xl tracking-tight">
					The attorney directory is on its way
				</h1>
				<p className="mt-3 text-muted-foreground text-sm leading-relaxed">
					Soon you'll be able to meet the attorneys taking on cases through
					JustUs. Practice law and want to join them?
				</p>
				<div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
					<Link href="/login" className={cn(buttonVariants())}>
						Apply as an attorney
					</Link>
					<Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
						<ArrowLeft aria-hidden="true" />
						Back home
					</Link>
				</div>
			</div>
		</main>
	);
}
