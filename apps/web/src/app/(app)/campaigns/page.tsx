import {
	adminCampaignStatusCounts,
	countAdminCampaigns,
	listAdminCampaigns,
} from "@just-us/db/admin";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { requireAdministrator } from "@/lib/auth-server";

const PAGE_SIZE = 15;

function money(cents: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(cents / 100);
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
});

/** The statuses, in lifecycle order, for the filter row. */
const STATUS_FILTERS: { value: string; label: string }[] = [
	{ value: "", label: "All" },
	{ value: "live", label: "Live" },
	{ value: "seeking", label: "Seeking" },
	{ value: "pending_payout", label: "Pending payout" },
	{ value: "closed", label: "Closed" },
	{ value: "draft", label: "Draft" },
];

const STATUS_BADGE: Record<string, string> = {
	live: "bg-green-soft text-green-deep",
	seeking: "bg-brass-wash text-brass-deep",
	pending_payout: "bg-gold-bright/20 text-gold-bright-ink",
	closed: "bg-surface-2 text-ink-soft",
	draft: "bg-surface-2 text-ink-soft",
};

const STATUS_LABEL: Record<string, string> = {
	live: "Live",
	seeking: "Seeking",
	pending_payout: "Pending payout",
	closed: "Closed",
	draft: "Draft",
};

/**
 * Case/campaign oversight — every case on the platform with its funding status
 * and the platform fee it has generated. Administrators only.
 *
 * Deliberately funding-and-status only: nothing here reveals where the money
 * physically routes (payout destination, Stripe account), which is not the
 * admin's to see. See `@just-us/db/admin`.
 */
export default async function CampaignsPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	await requireAdministrator();
	const sp = await searchParams;
	const status = typeof sp.status === "string" ? sp.status : "";
	const q = typeof sp.q === "string" ? sp.q.trim() : "";
	const page = Math.max(1, Number(sp.page) || 1);

	const filter = { status: status || undefined, q: q || undefined };
	const [rows, total, counts] = await Promise.all([
		listAdminCampaigns(filter, {
			skip: (page - 1) * PAGE_SIZE,
			take: PAGE_SIZE,
		}),
		countAdminCampaigns(filter),
		adminCampaignStatusCounts(),
	]);
	const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

	const hrefFor = (next: Record<string, string | number | undefined>) => {
		const params = new URLSearchParams();
		const merged = { status, q, page, ...next };
		if (merged.status) params.set("status", String(merged.status));
		if (merged.q) params.set("q", String(merged.q));
		if (merged.page && Number(merged.page) > 1)
			params.set("page", String(merged.page));
		const qs = params.toString();
		return (qs ? `/campaigns?${qs}` : "/campaigns") as Route;
	};

	return (
		<div className="flex flex-col gap-6">
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				Every case on the platform, its funding status, and the platform fee it
				has generated.
			</p>

			{/* Status filter pills */}
			<div className="flex flex-wrap gap-2">
				{STATUS_FILTERS.map((f) => {
					const active = status === f.value;
					const count =
						f.value === "" ? counts.total : (counts.statuses[f.value] ?? 0);
					return (
						<Link
							key={f.value || "all"}
							href={hrefFor({ status: f.value, page: 1 })}
							className={cn(
								"inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 font-semibold text-[12.5px] transition-colors",
								active
									? "bg-ink text-surface"
									: "bg-surface-2 text-ink-soft hover:text-ink",
							)}
						>
							{f.label}
							<span
								className={cn(
									"font-mono text-[11px]",
									active ? "text-surface/70" : "text-muted-foreground",
								)}
							>
								{count}
							</span>
						</Link>
					);
				})}
			</div>

			{/* Table */}
			<section className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
				{rows.length === 0 ? (
					<div className="px-6 py-16 text-center text-[13px] text-muted-foreground">
						No campaigns match this view.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-[13.5px]">
							<thead>
								<tr className="border-border border-b text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
									<th className="px-5 py-3 font-semibold">Case</th>
									<th className="px-5 py-3 font-semibold">Status</th>
									<th className="px-5 py-3 text-right font-semibold">Raised</th>
									<th className="px-5 py-3 text-right font-semibold">Goal</th>
									<th className="px-5 py-3 text-right font-semibold">Donors</th>
									<th className="px-5 py-3 text-right font-semibold">
										Platform fee
									</th>
									<th className="px-5 py-3 font-semibold">Created</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((c) => (
									<tr
										key={c.id}
										className="group relative cursor-pointer border-border border-b transition-colors last:border-0 hover:bg-paper-alt"
									>
										<td className="px-5 py-4">
											{/* The whole row opens the case; the link sits on the title
											    so the accessible name is the case, and stretches to
											    cover the row via `after:absolute`. */}
											<Link
												href={`/campaigns/${c.id}` as Route}
												className="after:absolute after:inset-0 after:content-['']"
											>
												<p className="font-bold text-ink group-hover:text-brass-deep">
													{c.title || "Untitled case"}
												</p>
											</Link>
											<p className="text-[12px] text-muted-foreground">
												{c.category} · {c.location} ·{" "}
												{c.owner?.name ?? "Unknown owner"}
											</p>
										</td>
										<td className="px-5 py-4">
											<span
												className={cn(
													"inline-flex rounded-[var(--radius-pill)] px-2.5 py-0.5 font-mono font-semibold text-[10px] uppercase tracking-[0.06em]",
													STATUS_BADGE[c.status] ??
														"bg-surface-2 text-ink-soft",
												)}
											>
												{STATUS_LABEL[c.status] ?? c.status}
											</span>
										</td>
										<td className="px-5 py-4 text-right font-bold text-ink tabular-nums">
											{money(c.raisedCents)}
										</td>
										<td className="px-5 py-4 text-right text-ink-soft tabular-nums">
											{money(c.goalCents)}
										</td>
										<td className="px-5 py-4 text-right text-ink-soft tabular-nums">
											{c.donorsCount}
										</td>
										<td className="px-5 py-4 text-right font-semibold text-brass-deep tabular-nums">
											{money(c.platformFeeCents)}
										</td>
										<td className="px-5 py-4 text-muted-foreground">
											{dateFmt.format(c.createdAt)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>

			{/* Pagination */}
			{pageCount > 1 && (
				<div className="flex items-center justify-between">
					<span className="text-[12.5px] text-muted-foreground">
						Page {page} of {pageCount} · {total} campaign
						{total === 1 ? "" : "s"}
					</span>
					<div className="flex gap-2">
						<Link
							aria-disabled={page <= 1}
							href={hrefFor({ page: Math.max(1, page - 1) })}
							className={cn(
								buttonVariants({ variant: "outline", size: "sm" }),
								page <= 1 && "pointer-events-none opacity-40",
							)}
						>
							<ArrowLeft data-icon="inline-start" aria-hidden="true" />
							Previous
						</Link>
						<Link
							aria-disabled={page >= pageCount}
							href={hrefFor({ page: Math.min(pageCount, page + 1) })}
							className={cn(
								buttonVariants({ variant: "outline", size: "sm" }),
								page >= pageCount && "pointer-events-none opacity-40",
							)}
						>
							Next
							<ArrowRight data-icon="inline-end" aria-hidden="true" />
						</Link>
					</div>
				</div>
			)}
		</div>
	);
}
