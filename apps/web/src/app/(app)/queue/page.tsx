import { listAdmissions } from "@just-us/db/admissions";
import { getAttorneyProfile } from "@just-us/db/attorney-profile";
import {
	listAttorneyCases,
	listMyInterests,
	listSeekingQueue,
	queueCategories,
	queueStates,
} from "@just-us/db/representation";
import { cn } from "@just-us/ui/lib/utils";
import type { Route } from "next";
import Link from "next/link";

import {
	readQueueParams,
	SeekingQueue,
	toQueueSort,
} from "@/components/dashboard/seeking-queue";
import {
	type ExpressionIntake,
	type MatchedIntake,
	YourIntakes,
} from "@/components/dashboard/your-intakes";
import { requireRole } from "@/lib/auth-server";

/**
 * Intake requests — the attorney's expressions of interest and the open queue, in
 * one place (JUS-25). Two tabs:
 *   - Your intakes — what became of everything they've put themselves forward for.
 *   - Browse open  — the open queue, scoped to the states they're admitted in.
 *
 * The heading is the shell's (the nav title); this renders the sub and the tabs.
 */
export default async function IntakeRequestsPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { session } = await requireRole("attorney");
	const params = await searchParams;
	const tab = params.tab === "open" ? "open" : "yours";
	const filters = readQueueParams(params);

	const [cases, categories, states, interests, matched, profile, admissions] =
		await Promise.all([
			listSeekingQueue(session.user.id, {
				category: filters.category,
				state: filters.state,
				sort: toQueueSort(filters.sort),
			}),
			queueCategories(session.user.id),
			queueStates(session.user.id),
			listMyInterests(session.user.id),
			listAttorneyCases({ userId: session.user.id, email: session.user.email }),
			getAttorneyProfile(session.user.id),
			listAdmissions(session.user.id),
		]);

	// Matched intakes are the cases they're actually acting on — those carry
	// funding, so they come from the caseload read, not the bare interest rows.
	// Accepted interests are the same cases, so the interest list here is only the
	// still-open and the passed-on, to avoid showing a matched case twice.
	const matchedIntakes: MatchedIntake[] = matched.map((c) => ({
		id: c.id,
		title: c.title,
		status: c.status,
		category: c.category,
		state: c.state,
		raisedCents: c.raisedCents,
		goalCents: c.goalCents,
		donorsCount: c.donorsCount,
	}));
	const toExpression = (i: (typeof interests)[number]): ExpressionIntake => ({
		id: i.id,
		caseId: i.case.id,
		title: i.case.title,
		category: i.case.category,
		state: i.case.state,
	});
	const interested = interests
		.filter((i) => i.status === "pending" || i.status === "viewed")
		.map(toExpression);
	const passed = interests
		.filter((i) => i.status === "declined")
		.map(toExpression);

	const expressionsOut = matchedIntakes.length + interested.length;

	return (
		<div className="flex flex-col gap-6">
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				{tab === "open"
					? "Open intakes seeking an attorney. Express interest and the plaintiff decides whether to take it further."
					: "Intakes matched to you, plus open cases seeking an attorney. You decide who to put yourself forward for."}
			</p>

			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-surface-2 p-1">
					<TabLink
						href={"/queue" as Route}
						label="Your intakes"
						active={tab === "yours"}
					/>
					<TabLink
						href={"/queue?tab=open" as Route}
						label="Browse open"
						active={tab === "open"}
					/>
				</div>
				<span className="text-[13px] text-muted-foreground">
					{tab === "open"
						? "Open intakes in your states · never ranked, never assigned"
						: `${expressionsOut + passed.length} ${
								expressionsOut + passed.length === 1
									? "expression"
									: "expressions"
							} · ${interested.length} awaiting · ${matchedIntakes.length} taken forward`}
				</span>
			</div>

			{tab === "open" ? (
				<SeekingQueue
					cases={cases}
					categories={categories}
					states={states}
					admittedStates={admissions.map((row) => row.state)}
					verifiedStates={admissions
						.filter((row) => row.verificationStatus === "verified")
						.map((row) => row.state)}
					filtered={filters.filtered}
					canExpressInterest={profile?.verificationStatus === "verified"}
				/>
			) : (
				<YourIntakes
					matched={matchedIntakes}
					interested={interested}
					passed={passed}
				/>
			)}
		</div>
	);
}

/** A pill tab in the segmented Your intakes / Browse open control. */
function TabLink({
	href,
	label,
	active,
}: {
	href: Route;
	label: string;
	active: boolean;
}) {
	return (
		<Link
			href={href}
			aria-current={active ? "page" : undefined}
			className={cn(
				"rounded-[var(--radius-pill)] px-4 py-1.5 font-semibold text-[13px] transition-colors",
				active
					? "bg-ink text-paper shadow-[var(--shadow-rest)]"
					: "text-ink-soft hover:text-ink",
			)}
		>
			{label}
		</Link>
	);
}
