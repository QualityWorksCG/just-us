import { listBackedCases } from "@just-us/db/donations";
import {
	followedCaseIdsWithUnseenUpdates,
	listFollowedCases,
} from "@just-us/db/follows";
import { listSavedCases } from "@just-us/db/saves";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { Bell, Bookmark, HandCoins } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { toDonorCase } from "@/components/dashboard/donor-case";
import { DonorCaseCard } from "@/components/dashboard/donor-case-card";
import { requireRole } from "@/lib/auth-server";

const TABS = [
	{ key: "saved", label: "Saved" },
	{ key: "following", label: "Following" },
	{ key: "backed", label: "Supported" },
] as const;

type Tab = (typeof TABS)[number]["key"];

const INTRO: Record<Tab, string> = {
	saved: "",
	following:
		"Cases you're following. You'll see every new update here and in your bell.",
	backed:
		"Cases you've contributed to, including ones that have closed, so you can look back on them any time.",
};

export default async function SavedPage({
	searchParams,
}: {
	searchParams: Promise<{ tab?: string }>;
}) {
	const { session } = await requireRole("donor");
	const raw = (await searchParams)?.tab;
	const tab: Tab = raw === "following" || raw === "backed" ? raw : "saved";

	const [saved, followed, unseen, backed] = await Promise.all([
		listSavedCases(session.user.id),
		listFollowedCases(session.user.id),
		followedCaseIdsWithUnseenUpdates(session.user.id),
		// Every case this donor has given to, live or closed, newest gift first.
		listBackedCases(session.user.id),
	]);

	const backedCases = backed.map((b) => b.case);
	const cases =
		tab === "following" ? followed : tab === "backed" ? backedCases : saved;
	const savedIds = new Set(saved.map((c) => c.id));
	const followedIds = new Set(followed.map((c) => c.id));
	const backedSet = new Set(backedCases.map((c) => c.id));

	const counts: Record<Tab, number> = {
		saved: saved.length,
		following: followed.length,
		backed: backedCases.length,
	};

	return (
		<div className="flex flex-col gap-6">
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				{INTRO[tab]}
			</p>

			{/* Tabs */}
			<div className="flex flex-wrap gap-2">
				{TABS.map((t) => {
					const active = t.key === tab;
					return (
						<Link
							key={t.key}
							href={
								(t.key === "saved" ? "/saved" : `/saved?tab=${t.key}`) as Route
							}
							aria-current={active ? "page" : undefined}
							className={cn(
								"inline-flex items-center gap-2 rounded-[var(--radius-pill)] border px-4 py-2 font-semibold text-[13px] transition-colors",
								active
									? "border-ink bg-ink text-paper"
									: "border-border bg-surface text-ink-soft hover:border-brass-deep hover:text-ink",
							)}
						>
							{t.label}
							<span
								className={cn(
									"inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 font-bold text-[11px]",
									active
										? "bg-paper/20 text-paper"
										: "bg-surface-2 text-ink-soft",
								)}
							>
								{counts[t.key]}
							</span>
						</Link>
					);
				})}
			</div>

			{cases.length === 0 ? (
				<div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border border-dashed bg-surface px-6 py-16 text-center">
					<span className="flex size-12 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
						{tab === "following" ? (
							<Bell className="size-6" aria-hidden="true" />
						) : tab === "backed" ? (
							<HandCoins className="size-6" aria-hidden="true" />
						) : (
							<Bookmark className="size-6" aria-hidden="true" />
						)}
					</span>
					<p className="font-bold text-[16px] text-ink">
						{tab === "following"
							? "Not following any cases yet"
							: tab === "backed"
								? "You haven't donated to a case yet"
								: "Nothing saved yet"}
					</p>
					<p className="max-w-[42ch] text-[13.5px] text-muted-foreground leading-relaxed">
						{tab === "following"
							? "Follow a case while you browse to get its updates here and in your bell."
							: tab === "backed"
								? "When you donate to a case, it shows here, even after it closes, so you can always look back."
								: "Not ready to decide? Save your interests here. Explore our active directory to find a cause to fund."}
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
						<DonorCaseCard
							key={c.id}
							c={toDonorCase(c)}
							initialSaved={savedIds.has(c.id)}
							initialFollowing={followedIds.has(c.id)}
							backed={backedSet.has(c.id)}
							hasNewUpdate={tab === "following" && unseen.has(c.id)}
						/>
					))}
				</div>
			)}
		</div>
	);
}
