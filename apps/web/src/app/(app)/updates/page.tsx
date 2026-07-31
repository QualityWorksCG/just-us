import type { Role } from "@just-us/auth";
import { Megaphone } from "lucide-react";
import { redirect } from "next/navigation";

import { ScreenPlaceholder } from "@/components/dashboard/screen-placeholder";
import { requireOnboarded } from "@/lib/auth-server";
import { findScreen } from "@/lib/dashboard-nav";

export default async function UpdatesPage() {
	const session = await requireOnboarded();
	const role = ((session.user as { role?: Role }).role ?? "donor") as Role;

	if (role === "donor") {
		return (
			<div className="flex flex-col gap-6">
				<div>
					<h1 className="font-extrabold text-[30px] text-ink tracking-[-0.02em]">
						Updates
					</h1>
					<p className="mt-1.5 text-[14.5px] text-ink-soft">
						The latest from the cases you're backing.
					</p>
				</div>
				<div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border border-dashed bg-surface px-6 py-16 text-center">
					<span className="flex size-12 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
						<Megaphone className="size-6" aria-hidden="true" />
					</span>
					<p className="font-bold text-[16px] text-ink">No updates yet</p>
					<p className="max-w-[42ch] text-[13.5px] text-muted-foreground leading-relaxed">
						Back a case and its attorney's progress updates will show up here.
					</p>
				</div>
			</div>
		);
	}

	// Non-donor roles keep their own "updates" screen (e.g. plaintiff case updates).
	const screen = findScreen(role, "updates");
	if (!screen) redirect("/home");
	return <ScreenPlaceholder sub={screen.sub} />;
}
