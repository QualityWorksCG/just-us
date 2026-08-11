import { MapPin, Tag, UserRound, Wallet } from "lucide-react";

/**
 * The case, as much of it as a link-holder is allowed to see.
 *
 * Enough to recognise the matter and the person asking, and no more — the
 * story, the evidence, and any way to reach the plaintiff are absent by
 * construction (see `findCaseInvitationByTokenHash`). Whoever opened this link
 * has proved only that they received it.
 */
export function CaseInviteSummary({
	title,
	summary,
	category,
	location,
	goalCents,
	plaintiffName,
}: {
	title: string;
	summary: string;
	category: string;
	location: string;
	goalCents: number;
	plaintiffName: string;
}) {
	const fee = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(goalCents / 100);

	return (
		<div className="rounded-[var(--radius-card)] border border-border bg-paper p-5">
			<p className="font-mono font-semibold text-[11px] text-brass-deep uppercase tracking-[0.06em]">
				The case
			</p>
			<h2 className="mt-1.5 font-bold text-[17px] text-ink leading-snug">
				{title || "Untitled case"}
			</h2>

			<dl className="mt-3.5 grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
				<Fact icon={Tag} label="Category" value={category} />
				<Fact icon={MapPin} label="Location" value={location} />
				<Fact icon={UserRound} label="Filed by" value={plaintiffName} />
				{/* The funding goal is the fee the plaintiff and their attorney agreed
				    — the case raises exactly that and nothing more. Named as the fee
				    here because that is what the attorney reading it is being asked
				    about. */}
				<Fact icon={Wallet} label="Agreed fee" value={fee} />
			</dl>

			{summary.trim() && (
				<p className="mt-4 border-line-strong border-t pt-4 text-[13.5px] text-ink-soft leading-relaxed">
					{summary}
				</p>
			)}
		</div>
	);
}

function Fact({
	icon: Icon,
	label,
	value,
}: {
	icon: typeof Tag;
	label: string;
	value: string;
}) {
	return (
		<div className="flex items-start gap-2">
			<Icon
				className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
				aria-hidden="true"
			/>
			<div className="min-w-0">
				<dt className="text-[11.5px] text-muted-foreground">{label}</dt>
				<dd className="truncate font-semibold text-[13.5px] text-ink">
					{value || "—"}
				</dd>
			</div>
		</div>
	);
}
