import type {
	MyInterest,
	QueueCase,
	QueueSort,
} from "@just-us/db/representation";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { Eye, Inbox, MapPin, ShieldAlert, UserRound } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { ExpressInterestButton } from "@/components/dashboard/express-interest-button";
import { QueueControls } from "@/components/dashboard/queue-controls";

/**
 * The attorney's Seeking Representation queue (JUS-25) — their dashboard home.
 *
 * Every case here is one nobody is representing yet. A card carries what you scan
 * a list by — category, state, headline, one-line summary, and who is asking —
 * and links to the case itself for the full account and the evidence. Neither
 * this nor the case view carries a way to contact the plaintiff: see `cardSelect`
 * and `detailSelect`, which is where that line is actually held.
 */

export type InterestTally = {
	total: number;
	awaiting: number;
	accepted: number;
	declined: number;
};

const SORTS = new Set<QueueSort>(["newest", "oldest"]);

/** Only the sorts the queue offers; anything else falls back to newest first. */
export function toQueueSort(value: string | undefined): QueueSort {
	return value && SORTS.has(value as QueueSort)
		? (value as QueueSort)
		: "newest";
}

/** Reads the filter values the queue accepts out of its search params. */
export function readQueueParams(
	params: Record<string, string | string[] | undefined>,
) {
	const one = (key: string) => {
		const value = params[key];
		return Array.isArray(value) ? value[0] : value;
	};
	const category = one("category");
	const state = one("state");
	return {
		category,
		state,
		sort: one("sort"),
		filtered: !!(category || state),
	};
}

/** How long a case has been waiting for representation. The one piece of
 *  pressure the queue applies, and it is the plaintiff's, not the platform's. */
function waitingFor(publishedAt: Date | null, createdAt: Date): string {
	const since = publishedAt ?? createdAt;
	const days = Math.floor((Date.now() - since.getTime()) / 86_400_000);
	if (days < 1) return "Published today";
	if (days === 1) return "Waiting 1 day";
	if (days < 30) return `Waiting ${days} days`;
	const months = Math.floor(days / 30);
	return `Waiting ${months} ${months === 1 ? "month" : "months"}`;
}

export function SeekingQueue({
	cases,
	categories,
	states,
	admittedStates,
	verifiedStates,
	filtered,
	tally,
	interests,
	canExpressInterest,
}: {
	cases: QueueCase[];
	categories: string[];
	states: string[];
	/** Every state this attorney is admitted in. The queue is scoped to these
	 *  server-side (see `queueWhere`), so this is here to explain what they are
	 *  looking at rather than to filter it — and to say something useful when the
	 *  list is empty, which is the one case where the queue is empty by
	 *  construction rather than because nobody has published. */
	admittedStates: string[];
	/** The subset of those with a verified bar check. Expressing interest is gated
	 *  per state, so a case in a claimed-but-unchecked state is listed and its
	 *  button is not offered — the queue shows what they may look at, and this
	 *  decides what they may act on. */
	verifiedStates: string[];
	/** Whether any filter is active, which changes the empty-state wording. */
	filtered: boolean;
	tally: InterestTally;
	/** This attorney's own expressions of interest, newest first. */
	interests: MyInterest[];
	/** False until the attorney's bar standing is verified — they can browse the
	 *  queue either way, but cannot put themselves forward (JUS-24). */
	canExpressInterest: boolean;
}) {
	const nowhereAdmitted = admittedStates.length === 0;

	/**
	 * Why this particular case can't be put forward for, if it can't.
	 *
	 * Per case, because the gate is per state: an attorney verified in New York
	 * browsing a New Jersey case they have claimed but not yet had checked would
	 * otherwise be shown a live button and refused by the action behind it.
	 */
	function reasonFor(state: string): string | undefined {
		if (verifiedStates.includes(state)) return undefined;
		if (!canExpressInterest) {
			return "Verify your bar standing on your profile to express interest.";
		}
		return `You're not verified in ${state} yet — verify your bar standing there to express interest.`;
	}

	return (
		<div className="flex flex-col gap-6">
			{nowhereAdmitted ? (
				<div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-danger/30 bg-danger/5 px-5 py-4">
					<ShieldAlert
						className="size-5 shrink-0 text-danger"
						aria-hidden="true"
					/>
					<p className="min-w-[20ch] flex-1 text-[13.5px] text-ink leading-relaxed">
						<span className="font-bold">
							Add the states you're admitted in.
						</span>{" "}
						Cases are only shown to attorneys licensed where the case is, so
						until you add a state there's nothing here for you to see.
					</p>
					<Link
						href={"/profile" as Route}
						className={cn(buttonVariants({ size: "sm" }), "h-9 shrink-0")}
					>
						Add your states
					</Link>
				</div>
			) : null}

			{!canExpressInterest && !nowhereAdmitted && (
				<div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-brass/40 bg-brass-wash px-5 py-4">
					<ShieldAlert
						className="size-5 shrink-0 text-brass-deep"
						aria-hidden="true"
					/>
					<p className="min-w-[20ch] flex-1 text-[13.5px] text-ink leading-relaxed">
						<span className="font-bold">
							Verify your bar standing to put yourself forward.
						</span>{" "}
						You can browse the cases in your states now — expressing interest
						needs a verified licence there, so plaintiffs only ever see
						attorneys who can actually take the work.
					</p>
					<Link
						href={"/profile" as Route}
						className={cn(buttonVariants({ size: "sm" }), "h-9 shrink-0")}
					>
						Get verified
					</Link>
				</div>
			)}

			{tally.total > 0 && (
				<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
					<div className="flex flex-wrap items-baseline justify-between gap-2">
						<h2 className="font-bold text-ink text-lg">
							Your expressions of interest
						</h2>
						<span className="text-[13px] text-muted-foreground tabular-nums">
							{tally.total} total
						</span>
					</div>

					<div className="mt-4 grid gap-3 sm:grid-cols-3">
						<Tally
							label="Awaiting a decision"
							value={tally.awaiting}
							sub="the plaintiff decides in their own time"
						/>
						<Tally
							label="Taken forward"
							value={tally.accepted}
							sub="plaintiffs who came back to you"
							tone="green"
						/>
						<Tally
							label="Passed on"
							value={tally.declined}
							sub="not a fit for that plaintiff"
						/>
					</div>

					{/* Named, not just counted. A case leaves the queue the moment it's
					    matched, so without this list an attorney's interest would simply
					    vanish and they'd never learn what came of it. */}
					{interests.length > 0 && (
						<ul className="mt-4 flex flex-col divide-y divide-border border-border border-t">
							{interests.map((interest) => (
								<li
									key={interest.id}
									className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3"
								>
									<div className="min-w-0 flex-1">
										<p className="truncate font-semibold text-[13.5px] text-ink">
											{interest.case.title || "Untitled case"}
										</p>
										<p className="truncate text-[12px] text-muted-foreground">
											{[interest.case.category, interest.case.state]
												.filter(Boolean)
												.join(" · ") || "—"}
										</p>
									</div>
									<OutcomeBadge status={interest.status} />
								</li>
							))}
						</ul>
					)}
				</section>
			)}

			<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)] sm:p-6">
				<QueueControls categories={categories} states={states} />

				<div className="mt-5 flex items-center justify-between border-border border-t pt-4">
					<span className="font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.1em]">
						{filtered ? "Results" : "Seeking representation"}
					</span>
					<span className="text-[13px] text-muted-foreground tabular-nums">
						{cases.length} {cases.length === 1 ? "case" : "cases"}
					</span>
				</div>

				{cases.length === 0 ? (
					<div className="mt-5 flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-border border-dashed bg-paper-alt px-6 py-14 text-center">
						<span className="flex size-11 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
							<Inbox className="size-5" aria-hidden="true" />
						</span>
						<p className="font-bold text-[15px] text-ink">
							{nowhereAdmitted
								? "No states added yet"
								: filtered
									? "No cases match those filters"
									: "No cases seeking representation"}
						</p>
						<p className="max-w-[46ch] text-[13.5px] text-muted-foreground leading-relaxed">
							{nowhereAdmitted
								? "The queue is scoped to the states you're admitted in. Add yours on your directory profile and the cases from them appear here."
								: filtered
									? "Try a broader category or another state — the queue turns over as plaintiffs publish."
									: `Cases appear here the moment a plaintiff in ${admittedStates.length === 1 ? admittedStates[0] : "one of your states"} publishes one out to attorneys.`}
						</p>
					</div>
				) : (
					<div className="mt-5 flex flex-col gap-4">
						{cases.map((item) => (
							<QueueCard
								key={item.id}
								item={item}
								disabledReason={reasonFor(item.state)}
							/>
						))}
					</div>
				)}
			</section>

			<p className="rounded-[var(--radius-card)] border border-border bg-paper-alt px-5 py-3.5 text-[12.5px] text-muted-foreground leading-relaxed">
				Cases are listed by the sort you choose — never ranked for you, and
				never assigned. Open a case to read the plaintiff's full account and the
				evidence they've filed; their contact details are never shared.
				Expressing interest tells them you're available — it doesn't open a
				conversation, and the plaintiff is the one who makes contact.
			</p>
		</div>
	);
}

/**
 * Where one of the attorney's expressions of interest stands.
 *
 * `pending` and `viewed` read the same here. The plaintiff having opened their
 * inbox is not the attorney's business — a read receipt would turn a plaintiff's
 * decision into something they can be seen to be delaying, and the queue is not
 * a place to apply that pressure.
 */
function OutcomeBadge({ status }: { status: MyInterest["status"] }) {
	const { label, cls } =
		status === "accepted"
			? { label: "Taken forward", cls: "bg-green-soft text-green-deep" }
			: status === "declined"
				? { label: "Passed on", cls: "bg-surface-2 text-muted-foreground" }
				: { label: "Awaiting", cls: "bg-brass-wash text-brass-deep" };
	return (
		<span
			className={cn(
				"shrink-0 rounded-[var(--radius-pill)] px-2.5 py-0.5 font-semibold text-[11.5px]",
				cls,
			)}
		>
			{label}
		</span>
	);
}

function Tally({
	label,
	value,
	sub,
	tone = "cream",
}: {
	label: string;
	value: number;
	sub: string;
	tone?: "cream" | "green";
}) {
	return (
		<div
			className={cn(
				"rounded-[var(--radius-card)] border border-transparent p-4",
				tone === "green" ? "bg-green-soft" : "bg-surface-2",
			)}
		>
			<p
				className={cn(
					"font-mono font-semibold text-[11px] uppercase tracking-[0.08em]",
					tone === "green" ? "text-green-deep/80" : "text-muted-foreground",
				)}
			>
				{label}
			</p>
			<p className="mt-2 font-extrabold text-[24px] text-ink tabular-nums leading-none tracking-[-0.02em]">
				{value}
			</p>
			<p
				className={cn(
					"mt-1.5 text-[12px]",
					tone === "green" ? "text-green-deep/70" : "text-muted-foreground",
				)}
			>
				{sub}
			</p>
		</div>
	);
}

function QueueCard({
	item,
	disabledReason,
}: {
	item: QueueCase;
	disabledReason?: string;
}) {
	return (
		<article className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-rest)] transition-colors hover:border-brass-deep hover:shadow-[var(--shadow-hover)]">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
						{item.category && (
							<span className="rounded-[var(--radius-chip)] border border-border bg-paper-alt px-2 py-0.5 font-semibold text-[11.5px] text-ink-soft">
								{item.category}
							</span>
						)}
						{item.state && (
							<span className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground">
								<MapPin className="size-3.5" aria-hidden="true" />
								{item.state}
							</span>
						)}
						<span className="text-[12.5px] text-muted-foreground">
							· {waitingFor(item.publishedAt, item.createdAt)}
						</span>
					</div>

					{/* The whole title is the link into the case, rather than a separate
					    "view" affordance competing with Express interest for attention. */}
					<h3 className="mt-2 font-bold text-[15px] text-ink">
						<Link
							href={`/queue/${item.id}` as Route}
							className="rounded-sm outline-none hover:text-brass-deep hover:underline focus-visible:ring-2 focus-visible:ring-ring"
						>
							{item.title || "Untitled case"}
						</Link>
					</h3>
					<p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
						<UserRound className="size-3.5 shrink-0" aria-hidden="true" />
						{item.plaintiffName}
					</p>
					{item.summary && (
						<p className="mt-1.5 text-[13.5px] text-ink-soft leading-relaxed">
							{item.summary}
						</p>
					)}
				</div>

				<div className="flex shrink-0 flex-col gap-1.5 sm:w-[168px]">
					<ExpressInterestButton
						caseId={item.id}
						expressed={!!item.myInterest}
						disabledReason={disabledReason}
						fullWidth
					/>
					<Link
						href={`/queue/${item.id}` as Route}
						className={cn(
							buttonVariants({ variant: "outline", size: "sm" }),
							"h-9 w-full justify-center",
						)}
					>
						<Eye data-icon="inline-start" aria-hidden="true" />
						View case
					</Link>
				</div>
			</div>
		</article>
	);
}
