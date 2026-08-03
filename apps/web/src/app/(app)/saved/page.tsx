import { listSavedCases } from "@just-us/db/saves";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { Bookmark } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { toDonorCase } from "@/components/dashboard/donor-case";
import { DonorCaseCard } from "@/components/dashboard/donor-case-card";
import { requireRole } from "@/lib/auth-server";

export default async function SavedPage() {
	const { session } = await requireRole("donor");
	const cases = await listSavedCases(session.user.id);

	return (
		<div className="flex flex-col gap-6">
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				Cases you've saved to come back to.
			</p>

			{cases.length === 0 ? (
				<div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border border-dashed bg-surface px-6 py-16 text-center">
					<span className="flex size-12 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
						<Bookmark className="size-6" aria-hidden="true" />
					</span>
					<p className="font-bold text-[16px] text-ink">Nothing saved yet</p>
					<p className="max-w-[42ch] text-[13.5px] text-muted-foreground leading-relaxed">
						Save cases while you browse to keep them handy here.
					</p>
					<Link
						href={"/discover" as Route}
						className={cn(buttonVariants(), "mt-1 px-5")}
					>
						Discover cases
					</Link>
				</div>
			) : (
				<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{cases.map((c) => (
						<DonorCaseCard key={c.id} c={toDonorCase(c)} initialSaved />
					))}
				</div>
			)}
		</div>
	);
}
