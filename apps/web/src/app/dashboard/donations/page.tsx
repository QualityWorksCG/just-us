import { donorStats, listDonations } from "@just-us/db/donations";
import { cn } from "@just-us/ui/lib/utils";
import { HeartHandshake, Scale, Trophy } from "lucide-react";

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
	const [rows, stats] = await Promise.all([
		listDonations(session.user.id),
		donorStats(session.user.id, year),
	]);

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="font-extrabold text-[30px] text-ink tracking-[-0.02em]">
					My donations
				</h1>
				<p className="mt-1.5 text-[14.5px] text-ink-soft">
					Every gift you've given, and the causes behind them.
				</p>
			</div>

			{/* Stats */}
			<div className="grid gap-4 sm:grid-cols-3">
				<div className="rounded-[var(--radius-card)] bg-green-soft p-5 shadow-[var(--shadow-rest)]">
					<span className="mb-4 flex size-9 items-center justify-center rounded-lg bg-surface text-green-deep">
						<HeartHandshake className="size-[18px]" aria-hidden="true" />
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

			{/* Table / empty state */}
			<section className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
				{rows.length === 0 ? (
					<div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
						<HeartHandshake
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
								<th className="px-5 py-3 font-semibold">Status</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((d) => {
								const live = d.case.status === "live";
								return (
									<tr
										key={d.id}
										className="border-border border-b last:border-0"
									>
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
											<span
												className={cn(
													"inline-flex rounded-[var(--radius-pill)] px-2.5 py-0.5 font-mono font-semibold text-[10px] uppercase tracking-[0.06em]",
													live
														? "bg-brass-wash text-brass-deep"
														: "bg-green-soft text-green-deep",
												)}
											>
												{live ? "Raising" : "Resolved"}
											</span>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				)}
			</section>
		</div>
	);
}
