import { listCertificatesForUser } from "@just-us/db/certificates";
import { donorStats, listDonations } from "@just-us/db/donations";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import {
	Award,
	Download,
	ExternalLink,
	HandCoins,
	Scale,
	Trophy,
} from "lucide-react";

import { requireRole } from "@/lib/auth-server";

function money(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

function formatDate(d: Date) {
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export default async function DonationsPage() {
	const { session } = await requireRole("donor");
	const year = new Date().getFullYear();
	const [rows, stats, certificates] = await Promise.all([
		listDonations(session.user.id),
		donorStats(session.user.id, year),
		listCertificatesForUser(session.user.id),
	]);

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
					Every gift you've given, and the causes behind them.
				</p>
				{/* Offered only when there is something to export — a button that
				    downloads an empty file reads as a broken feature. */}
				{rows.length > 0 && (
					<a
						href="/api/donations/export"
						download
						className={cn(
							buttonVariants({ variant: "outline", size: "sm" }),
							"shrink-0",
						)}
					>
						<Download className="size-4" aria-hidden="true" />
						Export CSV
					</a>
				)}
			</div>

			{/* Stats */}
			<div className="grid gap-4 sm:grid-cols-3">
				<div className="rounded-[var(--radius-card)] bg-green-soft p-5 shadow-[var(--shadow-rest)]">
					<span className="mb-4 flex size-9 items-center justify-center rounded-lg bg-surface text-green-deep">
						<HandCoins className="size-[18px]" aria-hidden="true" />
					</span>
					<p className="font-extrabold text-[28px] text-ink tabular-nums leading-none tracking-[-0.02em]">
						{money(stats.totalCents / 100)}
					</p>
					<p className="mt-2 text-[12.5px] text-green-deep/80">Total donated</p>
				</div>
				<div className="rounded-[var(--radius-card)] bg-brass-wash p-5 shadow-[var(--shadow-rest)]">
					<span className="mb-4 flex size-9 items-center justify-center rounded-lg bg-surface text-brass-deep">
						<Scale className="size-[18px]" aria-hidden="true" />
					</span>
					<p className="font-extrabold text-[28px] text-ink tabular-nums leading-none tracking-[-0.02em]">
						{stats.casesBacked}
					</p>
					<p className="mt-2 text-[12.5px] text-brass-deep/80">
						Cases supported
					</p>
				</div>
				<div className="rounded-[var(--radius-card)] bg-gold-bright p-5 shadow-[var(--shadow-rest)]">
					<span className="mb-4 flex size-9 items-center justify-center rounded-lg bg-surface/60 text-gold-bright-ink">
						<Trophy className="size-[18px]" aria-hidden="true" />
					</span>
					<p className="font-extrabold text-[28px] text-gold-bright-ink tabular-nums leading-none tracking-[-0.02em]">
						{money(stats.thisYearCents / 100)}
					</p>
					<p className="mt-2 text-[12.5px] text-gold-bright-ink/75">
						Given this year
					</p>
				</div>
			</div>

			{/* Certificates of appreciation — issued when a case the donor backed is
			    closed. Shown only once they have at least one. */}
			{certificates.length > 0 && (
				<section className="flex flex-col gap-3">
					<div className="flex items-center gap-2">
						<Award className="size-[18px] text-brass-deep" aria-hidden="true" />
						<h2 className="font-bold text-[15px] text-ink">
							Certificates of appreciation
						</h2>
					</div>
					<div className="grid gap-3 sm:grid-cols-2">
						{certificates.map((c) => (
							<a
								key={c.id}
								href={`/certificates/${c.accessToken}`}
								target="_blank"
								rel="noopener noreferrer"
								className="group flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 transition-colors hover:border-brass-deep"
							>
								<span className="min-w-0">
									<span className="block truncate font-bold text-[14px] text-ink">
										{c.caseTitle}
									</span>
									<span className="mt-0.5 block font-mono text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
										{c.serial} · {formatDate(c.issuedAt)}
									</span>
								</span>
								<span className="inline-flex shrink-0 items-center gap-1 font-semibold text-[12.5px] text-brass-deep transition-colors group-hover:text-ink">
									View
									<ExternalLink className="size-3.5" aria-hidden="true" />
								</span>
							</a>
						))}
					</div>
				</section>
			)}

			{/* Table / empty state */}
			<section className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
				{rows.length === 0 ? (
					<div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
						<HandCoins
							className="size-7 text-muted-foreground"
							aria-hidden="true"
						/>
						<p className="font-bold text-[15px] text-ink">No donations yet</p>
						<p className="max-w-[42ch] text-[13px] text-muted-foreground leading-relaxed">
							When you back a case, each gift and its receipt will appear here.
						</p>
					</div>
				) : (
					<table className="w-full text-left text-[13.5px]">
						<thead>
							<tr className="border-border border-b text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
								<th className="px-5 py-3 font-semibold">Case</th>
								<th className="px-5 py-3 text-right font-semibold">Amount</th>
								<th className="px-5 py-3 font-semibold">Date</th>
								<th className="px-5 py-3 font-semibold">Receipt</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((d) => (
								<tr key={d.id} className="border-border border-b last:border-0">
									<td className="px-5 py-4">
										<p className="font-bold text-ink">{d.case.title}</p>
										<p className="text-[12px] text-muted-foreground">
											{d.case.category} · {d.case.location}
										</p>
									</td>
									<td className="px-5 py-4 text-right font-bold text-ink tabular-nums">
										{money(d.amountCents / 100)}
									</td>
									<td className="px-5 py-4 text-muted-foreground">
										{formatDate(d.createdAt)}
									</td>
									<td className="px-5 py-4">
										{/* Stripe's own receipt for the charge. Absent for gifts made
										    before receipts were recorded, and for payment methods that
										    produce none — so the cell degrades to a dash rather than a
										    link that goes nowhere. */}
										{d.stripeReceiptUrl ? (
											<a
												href={d.stripeReceiptUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="inline-flex items-center gap-1 font-semibold text-[12.5px] text-brass-deep transition-colors hover:text-ink"
											>
												View
												<ExternalLink className="size-3.5" aria-hidden="true" />
											</a>
										) : (
											<span
												className="text-muted-foreground"
												title="No receipt was recorded for this gift."
											>
												—
											</span>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</section>
		</div>
	);
}
