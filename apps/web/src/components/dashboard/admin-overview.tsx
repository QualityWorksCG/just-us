import { adminOverviewStats, listDonationActivity } from "@just-us/db/admin";
import { cn } from "@just-us/ui/lib/utils";
import {
	ArrowRight,
	BadgeCheck,
	DollarSign,
	Heart,
	type LucideIcon,
	Megaphone,
	Receipt,
	ShieldAlert,
	Users,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

function money(cents: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(cents / 100);
}

const num = new Intl.NumberFormat("en-US");

type KpiTone = "green" | "tan" | "gold" | "dark";
const KPI_TONES: Record<
	KpiTone,
	{ card: string; chip: string; value: string; label: string; sub: string }
> = {
	green: {
		card: "bg-green-soft hover:brightness-[0.98]",
		chip: "bg-surface text-green-deep",
		value: "text-ink",
		label: "text-green-deep/80",
		sub: "text-green-deep/70",
	},
	tan: {
		card: "bg-brass-wash hover:brightness-[0.98]",
		chip: "bg-surface text-brass-deep",
		value: "text-ink",
		label: "text-brass-deep/80",
		sub: "text-brass-deep/70",
	},
	gold: {
		card: "bg-gold-bright hover:brightness-[0.98]",
		chip: "bg-surface/70 text-brass-deep",
		value: "text-gold-bright-ink",
		label: "text-gold-bright-ink/80",
		sub: "text-gold-bright-ink/70",
	},
	dark: {
		card: "bg-dark hover:brightness-110",
		chip: "bg-dark-fg/10 text-gold-bright",
		value: "text-gold-bright",
		label: "text-dark-fg/70",
		sub: "text-dark-fg/60",
	},
};

const dateFmt = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
});

/**
 * The administrator's home — platform health at a glance, and the doors into each
 * oversight surface. A server component: it reads the same sensitive-field-safe
 * admin model the sections do, so nothing here can surface more than they would.
 */
export async function AdminOverview() {
	const [stats, recent] = await Promise.all([
		adminOverviewStats(),
		listDonationActivity({ take: 6, status: "succeeded" }),
	]);

	const kpis: {
		label: string;
		value: string;
		sub: string;
		href: Route;
		icon: LucideIcon;
		tone: KpiTone;
	}[] = [
		{
			label: "Platform-fee revenue",
			value: money(stats.platformFeeCents),
			sub: "from 5% on donations",
			href: "/revenue" as Route,
			icon: DollarSign,
			tone: "green",
		},
		{
			label: "Gross donated",
			value: money(stats.grossCents),
			sub: "routed to attorney accounts",
			href: "/revenue" as Route,
			icon: Heart,
			tone: "tan",
		},
		{
			label: "Live campaigns",
			value: num.format(stats.liveCampaigns),
			sub: "funding right now",
			href: "/campaigns" as Route,
			icon: Megaphone,
			tone: "gold",
		},
		{
			label: "Users",
			value: num.format(stats.userCount),
			sub: "donors · plaintiffs · attorneys",
			href: "/users" as Route,
			icon: Users,
			tone: "dark",
		},
	];

	const queues = [
		{
			label: "Open reports",
			value: stats.openReports,
			hint: "Conversations awaiting moderation",
			href: "/moderation" as Route,
			icon: ShieldAlert,
		},
		{
			label: "Attorneys to verify",
			value: stats.attorneysPending,
			hint: "Have a claimed jurisdiction not yet verified",
			href: "/users?role=attorney" as Route,
			icon: BadgeCheck,
		},
	];

	const links = [
		{ label: "All campaigns", href: "/campaigns" as Route, icon: Megaphone },
		{ label: "Revenue & donations", href: "/revenue" as Route, icon: Receipt },
		{ label: "Users & attorneys", href: "/users" as Route, icon: Users },
		{ label: "Moderation", href: "/moderation" as Route, icon: ShieldAlert },
	];

	return (
		<div className="flex flex-col gap-6">
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				Health of the platform at a glance.
			</p>

			{/* KPI cards */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{kpis.map((k) => {
					const t = KPI_TONES[k.tone];
					return (
						<Link
							key={k.label}
							href={k.href}
							className={cn(
								"rounded-[var(--radius-card-lg)] p-5 shadow-[var(--shadow-rest)] transition-all",
								t.card,
							)}
						>
							<span
								className={cn(
									"mb-4 flex size-9 items-center justify-center rounded-lg",
									t.chip,
								)}
							>
								<k.icon className="size-[18px]" aria-hidden="true" />
							</span>
							<p className={cn("text-[12.5px]", t.label)}>{k.label}</p>
							<p
								className={cn(
									"mt-1 font-extrabold text-[28px] tabular-nums leading-none tracking-[-0.02em]",
									t.value,
								)}
							>
								{k.value}
							</p>
							<p className={cn("mt-2 text-[12px]", t.sub)}>{k.sub}</p>
						</Link>
					);
				})}
			</div>

			{/* Work queues */}
			<div className="grid gap-4 sm:grid-cols-2">
				{queues.map((q) => (
					<Link
						key={q.label}
						href={q.href}
						className="group flex items-center gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)] transition-colors hover:border-brass-deep"
					>
						<span
							className={cn(
								"flex size-11 shrink-0 items-center justify-center rounded-full",
								q.value > 0
									? "bg-brass-wash text-brass-deep"
									: "bg-surface-2 text-muted-foreground",
							)}
						>
							<q.icon className="size-5" aria-hidden="true" />
						</span>
						<span className="min-w-0 flex-1">
							<span className="flex items-baseline gap-2">
								<span className="font-extrabold text-[22px] text-ink tabular-nums leading-none">
									{q.value}
								</span>
								<span className="font-semibold text-[13.5px] text-ink">
									{q.label}
								</span>
							</span>
							<span className="mt-1 block text-[12px] text-muted-foreground">
								{q.hint}
							</span>
						</span>
						<ArrowRight
							className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
							aria-hidden="true"
						/>
					</Link>
				))}
			</div>

			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
				{/* Recent donations */}
				<section className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
					<div className="flex items-center justify-between border-border border-b px-5 py-3.5">
						<h2 className="font-bold text-[14px] text-ink">Recent donations</h2>
						<Link
							href={"/revenue" as Route}
							className="font-semibold text-[12px] text-brass-deep hover:text-ink"
						>
							View all
						</Link>
					</div>
					{recent.length === 0 ? (
						<p className="px-5 py-10 text-center text-[13px] text-muted-foreground">
							No donations yet.
						</p>
					) : (
						<ul className="divide-y divide-border">
							{recent.map((d) => (
								<li
									key={d.id}
									className="flex items-center justify-between gap-4 px-5 py-3"
								>
									<span className="min-w-0">
										<span className="block truncate font-semibold text-[13px] text-ink">
											{d.caseTitle || "Untitled case"}
										</span>
										<span className="block text-[11.5px] text-muted-foreground">
											{d.donorLabel} · {dateFmt.format(d.createdAt)}
										</span>
									</span>
									<span className="shrink-0 text-right">
										<span className="block font-bold text-[13px] text-ink tabular-nums">
											{money(d.amountCents)}
										</span>
										<span className="block font-mono text-[10.5px] text-brass-deep">
											{money(d.feeCents)} fee
										</span>
									</span>
								</li>
							))}
						</ul>
					)}
				</section>

				{/* Section shortcuts */}
				<section className="flex flex-col gap-2 rounded-[var(--radius-card-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-rest)]">
					<h2 className="px-1 py-1 font-bold text-[14px] text-ink">
						Oversight
					</h2>
					{links.map((l) => (
						<Link
							key={l.href}
							href={l.href}
							className="flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-[13.5px] text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
						>
							<l.icon
								className="size-4 text-muted-foreground"
								aria-hidden="true"
							/>
							{l.label}
							<ArrowRight className="ml-auto size-3.5" aria-hidden="true" />
						</Link>
					))}
				</section>
			</div>
		</div>
	);
}
