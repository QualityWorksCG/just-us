import { listDonationActivity, platformRevenue } from "@just-us/db/admin";
import { cn } from "@just-us/ui/lib/utils";
import { Receipt } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { requireAdministrator } from "@/lib/auth-server";

const ACTIVITY_LIMIT = 100;

function money(cents: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(cents / 100);
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
});

const STATUS_FILTERS: { value: string; label: string }[] = [
	{ value: "", label: "All" },
	{ value: "succeeded", label: "Succeeded" },
	{ value: "refunded", label: "Refunded" },
	{ value: "pending", label: "Pending" },
	{ value: "failed", label: "Failed" },
];

const STATUS_BADGE: Record<string, string> = {
	succeeded: "bg-green-soft text-green-deep",
	refunded: "bg-danger/10 text-danger",
	pending: "bg-gold-bright/20 text-gold-bright-ink",
	failed: "bg-surface-2 text-ink-soft",
};

/**
 * Platform-fee revenue reporting + donation activity. Administrators only.
 *
 * The headline platform-fee figure is `SUM(feeCents)` over succeeded donations —
 * the same rows and column the activity feed lists — so it reconciles with the
 * individual records by construction. Donor identity is a label only; no payment
 * credentials, Stripe references, or account details appear here. See
 * `@just-us/db/admin`.
 */
export default async function RevenuePage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	await requireAdministrator();
	const sp = await searchParams;
	const status = typeof sp.status === "string" ? sp.status : "";

	const [rev, activity] = await Promise.all([
		platformRevenue(),
		listDonationActivity({
			take: ACTIVITY_LIMIT,
			status: status || undefined,
		}),
	]);

	const cards = [
		{
			label: "Platform-fee revenue",
			value: money(rev.platformFeeCents),
			sub: `across ${rev.donationCount} succeeded donation${rev.donationCount === 1 ? "" : "s"}`,
			accent: "text-brass-deep",
		},
		{
			label: "Gross donated",
			value: money(rev.grossCents),
			sub: "total charged to donors",
			accent: "text-ink",
		},
		{
			label: "Net to firms",
			value: money(rev.netToFirmsCents),
			sub: "after the platform fee",
			accent: "text-ink",
		},
	];

	return (
		<div className="flex flex-col gap-6">
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				Platform-fee revenue and donation activity across the platform.
			</p>

			{/* Revenue cards */}
			<div className="grid gap-4 sm:grid-cols-3">
				{cards.map((c) => (
					<div
						key={c.label}
						className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]"
					>
						<p className="text-[12.5px] text-muted-foreground">{c.label}</p>
						<p
							className={cn(
								"mt-2 font-extrabold text-[26px] tabular-nums leading-none tracking-[-0.02em]",
								c.accent,
							)}
						>
							{c.value}
						</p>
						<p className="mt-2 text-[12px] text-muted-foreground">{c.sub}</p>
					</div>
				))}
			</div>

			{/* Reconciliation statement — the AC made explicit for whoever reads it. */}
			<div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-brass/30 bg-brass-wash/40 p-4">
				<Receipt
					className="mt-0.5 size-4 shrink-0 text-brass-deep"
					aria-hidden="true"
				/>
				<p className="text-[13px] text-ink-soft leading-relaxed">
					Platform-fee revenue of{" "}
					<strong className="text-ink">{money(rev.platformFeeCents)}</strong> is
					the exact sum of the platform fee recorded on each of the{" "}
					<strong className="text-ink">{rev.donationCount}</strong> succeeded
					donation record{rev.donationCount === 1 ? "" : "s"} — gross{" "}
					{money(rev.grossCents)} = fee {money(rev.platformFeeCents)} + net{" "}
					{money(rev.netToFirmsCents)}.
					{rev.refundedCount > 0 && (
						<>
							{" "}
							{rev.refundedCount} refunded donation
							{rev.refundedCount === 1 ? "" : "s"} (
							{money(rev.refundedAmountCents)}) are reported separately and
							excluded from revenue.
						</>
					)}
				</p>
			</div>

			{/* Donation activity */}
			<div className="flex flex-col gap-3">
				<h2 className="font-bold text-[15px] text-ink">Donation activity</h2>
				<div className="flex flex-wrap gap-2">
					{STATUS_FILTERS.map((f) => {
						const active = status === f.value;
						return (
							<Link
								key={f.value || "all"}
								href={
									(f.value ? `/revenue?status=${f.value}` : "/revenue") as Route
								}
								className={cn(
									"inline-flex items-center rounded-[var(--radius-pill)] px-3 py-1.5 font-semibold text-[12.5px] transition-colors",
									active
										? "bg-ink text-surface"
										: "bg-surface-2 text-ink-soft hover:text-ink",
								)}
							>
								{f.label}
							</Link>
						);
					})}
				</div>

				<section className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
					{activity.length === 0 ? (
						<div className="px-6 py-16 text-center text-[13px] text-muted-foreground">
							No donation activity in this view.
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-left text-[13.5px]">
								<thead>
									<tr className="border-border border-b text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
										<th className="px-5 py-3 font-semibold">Date</th>
										<th className="px-5 py-3 font-semibold">Case</th>
										<th className="px-5 py-3 font-semibold">Donor</th>
										<th className="px-5 py-3 text-right font-semibold">
											Amount
										</th>
										<th className="px-5 py-3 text-right font-semibold">Fee</th>
										<th className="px-5 py-3 text-right font-semibold">Net</th>
										<th className="px-5 py-3 font-semibold">Status</th>
									</tr>
								</thead>
								<tbody>
									{activity.map((d) => (
										<tr
											key={d.id}
											className="border-border border-b last:border-0"
										>
											<td className="px-5 py-4 text-muted-foreground">
												{dateFmt.format(d.createdAt)}
											</td>
											<td className="px-5 py-4">
												<span className="font-semibold text-ink">
													{d.caseTitle || "Untitled case"}
												</span>
											</td>
											<td className="px-5 py-4 text-ink-soft">
												{d.donorLabel}
											</td>
											<td className="px-5 py-4 text-right font-bold text-ink tabular-nums">
												{money(d.amountCents)}
											</td>
											<td className="px-5 py-4 text-right font-semibold text-brass-deep tabular-nums">
												{money(d.feeCents)}
											</td>
											<td className="px-5 py-4 text-right text-ink-soft tabular-nums">
												{money(d.netCents)}
											</td>
											<td className="px-5 py-4">
												<span
													className={cn(
														"inline-flex rounded-[var(--radius-pill)] px-2.5 py-0.5 font-mono font-semibold text-[10px] uppercase tracking-[0.06em]",
														STATUS_BADGE[d.status] ??
															"bg-surface-2 text-ink-soft",
													)}
												>
													{d.status}
												</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</section>
				<p className="text-[12px] text-muted-foreground">
					Showing the {ACTIVITY_LIMIT} most recent. Donor identity is shown as a
					label only — no payment details, card data, or account references are
					ever recorded here.
				</p>
			</div>
		</div>
	);
}
