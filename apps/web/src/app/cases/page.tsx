import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { ArrowLeft, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Browse cases",
	description:
		"Browse cases seeking support on JustUs and back someone's fight for justice.",
};

export default function CasesPage() {
	return (
		<main className="flex h-full items-center justify-center overflow-y-auto px-6 py-20">
			<div className="mx-auto max-w-md text-center">
				<FileText
					className="mx-auto size-8 text-foreground"
					aria-hidden="true"
				/>
				<h1 className="mt-6 font-semibold text-2xl tracking-tight">
					The case directory is on its way
				</h1>
				<p className="mt-3 text-muted-foreground text-sm leading-relaxed">
					Soon you'll be able to browse active cases and support the ones that
					speak to you. Every donation is a gift that goes straight to a
					person's legal representation.
				</p>
				<Link
					href="/"
					className={cn(buttonVariants({ variant: "outline" }), "mt-8")}
				>
					<ArrowLeft aria-hidden="true" />
					Back home
				</Link>
			</div>
		</main>
	);
}
