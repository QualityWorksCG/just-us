import { cn } from "@just-us/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Brandmark } from "@/components/brandmark";

/** Centered single-card layout for secondary auth flows (reset, verify). */
export function AuthMiniShell({
	icon: Icon,
	title,
	description,
	children,
	tone = "brass",
}: {
	icon: LucideIcon;
	title: string;
	description: string;
	children: React.ReactNode;
	tone?: "brass" | "danger";
}) {
	return (
		<div className="flex min-h-svh items-center justify-center bg-paper px-5 py-10">
			<div className="w-full max-w-[440px]">
				<Link
					href="/"
					className="mb-8 flex items-center justify-center gap-2.5"
				>
					<Brandmark size={30} />
					<span className="font-bold text-[16px] tracking-tight">JustUs</span>
				</Link>
				<div className="rounded-[var(--radius-modal)] border border-border bg-surface p-7 shadow-[var(--shadow-rest)] sm:p-8">
					<span
						className={cn(
							"mb-5 flex size-12 items-center justify-center rounded-[13px] border",
							tone === "danger"
								? "border-danger/25 bg-danger/10 text-danger"
								: "border-brass/30 bg-brass-wash text-brass-deep",
						)}
					>
						<Icon className="size-5" aria-hidden="true" />
					</span>
					<h1 className="mb-2 font-extrabold text-[22px] text-ink tracking-[-0.02em]">
						{title}
					</h1>
					<p className="mb-6 text-[14px] text-ink-soft leading-relaxed">
						{description}
					</p>
					{children}
				</div>
			</div>
		</div>
	);
}
