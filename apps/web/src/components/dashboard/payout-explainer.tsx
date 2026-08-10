import { Landmark, Scale, ShieldCheck } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

/**
 * What a plaintiff sees where their payout setup used to be.
 *
 * Donations now pay the operating account of the firm representing the case, so a
 * plaintiff has nothing to set up — but "nothing to set up" is exactly the state that
 * reads as a broken or missing screen if it is left blank. This says where the money
 * goes, who has to act, and what it means for the fee they agreed with their attorney.
 *
 * Deliberately not a form, not a toggle, and with no Stripe call behind it: there is
 * no account for a plaintiff to open any more, and offering one would create a balance
 * nothing can route to.
 */
export function PayoutExplainer() {
	return (
		<section className="rounded-[var(--radius-card)] border border-border bg-card">
			<div className="border-border border-b px-5 py-4">
				<h2 className="font-bold text-[15px] text-ink">Where donations go</h2>
				<p className="mt-1 text-[13.5px] text-ink-soft leading-relaxed">
					Donations to your case are paid to your attorney's firm. There's
					nothing for you to set up, and no bank details for us to ask you for.
				</p>
			</div>
			<div className="flex flex-col gap-3 px-5 py-4">
				<Row icon={Landmark} title="Your attorney's firm receives">
					Money moves through Stripe straight into the business account of the
					firm representing you — one opened for your case alone, so your funds
					are never pooled with another of their clients'. JustUs never holds
					it, and it never passes through a JustUs balance.
				</Row>
				<Row icon={Scale} title="Your attorney handles it from there">
					Firms are required by their state bar to move funds like these into
					their client trust account and apply them to your fee. That obligation
					is theirs, under their bar's supervision — it isn't something JustUs
					administers.
				</Row>
				<Row icon={ShieldCheck} title="What you do">
					Make sure your case names your attorney and their email address, and
					that they've opened a payout account for <em>this</em> case — being
					set up for their other matters doesn't cover yours. Your case page
					shows exactly what's outstanding.
				</Row>
				<Link
					href={"/my-cases" as Route}
					className="mt-1 self-start font-semibold text-[12.5px] text-brass-deep hover:underline"
				>
					Check my cases
				</Link>
			</div>
		</section>
	);
}

function Row({
	icon: Icon,
	title,
	children,
}: {
	icon: typeof Landmark;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-start gap-3">
			<span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brass-wash text-brass-deep">
				<Icon className="size-[15px]" aria-hidden="true" />
			</span>
			<span className="min-w-0 flex-1">
				<span className="block font-semibold text-[13.5px] text-ink">
					{title}
				</span>
				<span className="mt-0.5 block text-[12.5px] text-ink-soft leading-relaxed">
					{children}
				</span>
			</span>
		</div>
	);
}
