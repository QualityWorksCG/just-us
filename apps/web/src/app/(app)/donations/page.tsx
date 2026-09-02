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
import type { Route } from "next";
import Link from "next/link";

import { requireRole } from "@/lib/auth-server";

// Exact cents, always — gifts carry fees, so amounts like $23.75 are the norm.
// Rounding to whole dollars made the per-gift rows ($24 + $48) disagree with the
// summed total ($71.25), so every figure on this page reconciles to the cent.
function money(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(n);
}

function formatDate(d: Date) {
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export default async function DonationsPage({
	searchParams,
}: {
	searchParams?: Promise<{ tab?: string }>;
}) {
	const { session } = await requireRole("donor");
	const year = new Date().getFullYear();
	const tab =
		(await searchParams)?.tab === "certificates" ? "certificates" : "gifts";

	const [rows, stats, certificates] = await Promise.all([
		listDonations(session.user.id),
		donorStats(session.user.id, year),
		listCertificatesForUser(session.user.id),
	]);

	// The donor's gifts grouped by case — used on the Certificates tab, where each
	// certificate (a case they backed that has since closed) lists the gifts that
	// earned it.
	const giftsByCase = new Map<string, typeof rows>();
	for (const r of rows) {
		const list = giftsByCase.get(r.caseId);
		if (list) list.push(r);
		else giftsByCase.set(r.caseId, [r]);
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-start justify-end gap-3">
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

			{/* Tabs: every gift, and the certificates from cases that have closed. */}
			<div className="flex items-center gap-2">
				<TabLink
					href={"/donations" as Route}
					label="Donations"
					count={rows.length}
					active={tab === "gifts"}
				/>
				<TabLink
					href={"/donations?tab=certificates" as Route}
					label="Certificates"
					count={certificates.length}
					active={tab === "certificates"}
				/>
			</div>

			{tab === "certificates" ? (
				<CertificatesTab
					certificates={certificates}
					giftsByCase={giftsByCase}
				/>
			) : (
				<GiftsTable rows={rows} />
			)}
		</div>
	);
}

/** A filter pill for the Donations / Certificates tabs. */
function TabLink({
	href,
	label,
	count,
	active,
}: {
	href: Route;
	label: string;
	count: number;
	active: boolean;
}) {
	return (
		<Link
			href={href}
			aria-current={active ? "page" : undefined}
			className={cn(
				"inline-flex items-center gap-2 rounded-[var(--radius-pill)] px-3.5 py-1.5 font-semibold text-[13px] transition-colors",
				active
					? "bg-ink text-paper"
					: "text-ink-soft hover:bg-surface-2 hover:text-ink",
			)}
		>
			{label}
			<span
				className={cn(
					"font-bold text-[11.5px]",
					active ? "text-paper/70" : "text-muted-foreground",
				)}
			>
				{count}
			</span>
		</Link>
	);
}

type DonationRows = Awaited<ReturnType<typeof listDonations>>;

/** The full ledger of gifts — every donation with its receipt. */
function GiftsTable({ rows }: { rows: DonationRows }) {
	return (
		<section className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
			{rows.length === 0 ? (
				<div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
					<HandCoins
						className="size-7 text-muted-foreground"
						aria-hidden="true"
					/>
					<p className="font-bold text-[15px] text-ink">No donations yet</p>
					<p className="max-w-[42ch] text-[13px] text-muted-foreground leading-relaxed">
						When you fund a case, each gift and its receipt will appear here.
					</p>
				</div>
			) : (
				// The ledger is wider than a phone, so it scrolls on its own axis
				// rather than being clipped by the card's rounded overflow-hidden.
				<div className="overflow-x-auto">
					<table className="w-full min-w-[640px] text-left text-[13.5px]">
						<thead>
							<tr className="border-border border-b text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
								<th className="px-5 py-3 font-semibold">Case</th>
								<th className="whitespace-nowrap px-5 py-3 font-semibold">
									Type & location
								</th>
								<th className="whitespace-nowrap px-5 py-3 text-right font-semibold">
									To the case
								</th>
								<th className="whitespace-nowrap px-5 py-3 text-right font-semibold">
									You paid
								</th>
								<th className="px-5 py-3 font-semibold">Date</th>
								<th className="px-5 py-3 font-semibold">Receipt</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((d) => (
								<tr key={d.id} className="border-border border-b last:border-0">
									<td className="px-5 py-4 font-bold text-ink">
										{d.case.title}
									</td>
									<td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
										{d.case.category} · {d.case.location}
									</td>
									<td className="px-5 py-4 text-right font-bold text-ink tabular-nums">
										{money(d.netCents / 100)}
									</td>
									<td className="px-5 py-4 text-right text-muted-foreground tabular-nums">
										{money(d.amountCents / 100)}
										{d.feeCents > 0 ? (
											<span className="mt-0.5 block whitespace-nowrap text-[11px]">
												incl. {money(d.feeCents / 100)} fee
											</span>
										) : null}
									</td>
									<td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
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
				</div>
			)}
		</section>
	);
}

/**
 * Certificates of appreciation — one per case the donor backed that has since
 * closed. Each card names the case, links to the certificate, and lists the gifts
 * that earned it, so the acknowledgement and the giving that prompted it sit
 * together.
 */
function CertificatesTab({
	certificates,
	giftsByCase,
}: {
	certificates: Awaited<ReturnType<typeof listCertificatesForUser>>;
	giftsByCase: Map<string, DonationRows>;
}) {
	if (certificates.length === 0) {
		return (
			<div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border border-dashed bg-surface px-6 py-16 text-center">
				<span className="flex size-12 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
					<Award className="size-6" aria-hidden="true" />
				</span>
				<p className="font-bold text-[16px] text-ink">No certificates yet</p>
				<p className="max-w-[46ch] text-[13.5px] text-muted-foreground leading-relaxed">
					When a case you supported reaches its close, a certificate of
					appreciation for it shows up here, with the gifts you gave to it.
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			<p className="text-[13.5px] text-ink-soft leading-relaxed">
				These are cases you supported that have now closed. Your support helped
				see each one through. Here's a certificate of appreciation for every
				one, with the gifts you gave to it.
			</p>
			{certificates.map((cert) => {
				const gifts = giftsByCase.get(cert.caseId) ?? [];
				const total = gifts.reduce((sum, g) => sum + g.netCents, 0);
				return (
					<section
						key={cert.id}
						className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]"
					>
						<div className="flex flex-wrap items-center justify-between gap-3 border-border border-b px-5 py-4">
							<div className="flex min-w-0 items-center gap-3">
								<span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-card-sm)] bg-brass-wash text-brass-deep">
									<Award className="size-[18px]" aria-hidden="true" />
								</span>
								<div className="min-w-0">
									<p className="truncate font-bold text-[15px] text-ink">
										{cert.caseTitle}
									</p>
									<p className="mt-0.5 font-mono text-[11px] text-muted-foreground uppercase tracking-[0.06em]">
										{cert.serial} · closed {formatDate(cert.issuedAt)}
									</p>
								</div>
							</div>
							<a
								href={`/certificates/${cert.accessToken}`}
								target="_blank"
								rel="noopener noreferrer"
								className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
							>
								View certificate
								<ExternalLink data-icon="inline-end" aria-hidden="true" />
							</a>
						</div>

						{gifts.length > 0 && (
							<ul className="divide-y divide-border">
								{gifts.map((g) => (
									<li
										key={g.id}
										className="flex items-center justify-between gap-3 px-5 py-3 text-[13.5px]"
									>
										<span className="text-muted-foreground">
											{formatDate(g.createdAt)}
										</span>
										<span className="font-semibold text-ink tabular-nums">
											{money(g.netCents / 100)}
										</span>
									</li>
								))}
								<li className="flex items-center justify-between gap-3 bg-paper-alt/40 px-5 py-3 text-[13px]">
									<span className="font-semibold text-ink">
										{gifts.length} {gifts.length === 1 ? "gift" : "gifts"} to
										this case
									</span>
									<span className="font-bold text-ink tabular-nums">
										{money(total / 100)}
									</span>
								</li>
							</ul>
						)}
					</section>
				);
			})}
		</div>
	);
}
