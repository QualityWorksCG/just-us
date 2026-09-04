import { listAdmissions } from "@just-us/db/admissions";
import { getAttorneyProfile } from "@just-us/db/attorney-profile";
import {
	declinedInvitationsForEmail,
	pendingInvitationsForEmail,
} from "@just-us/db/case-invitations";
import {
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
	type InvitationItem,
	YourRequests,
} from "@/components/dashboard/your-requests";
import { requireRole } from "@/lib/auth-server";

/**
 * Intake requests — an attorney's own expressions of interest and the open queue,
 * in one place (JUS-25). Two tabs:
 *   - Your requests — the intakes they've put themselves forward for that are
 *     still open questions (awaiting a decision, or declined). Intakes they were
 *     taken on for are live work and live on "My intakes", not here.
 *   - Browse open   — every open intake still seeking an attorney, scoped to the
 *     states they're admitted in.
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

	const [
		cases,
		categories,
		states,
		interests,
		profile,
		admissions,
		invites,
		declinedInvites,
	] = await Promise.all([
		listSeekingQueue(session.user.id, {
			category: filters.category,
			state: filters.state,
			jurisdiction: filters.jurisdiction,
			sort: toQueueSort(filters.sort),
		}),
		queueCategories(session.user.id),
		queueStates(session.user.id),
		listMyInterests(session.user.id),
		getAttorneyProfile(session.user.id),
		listAdmissions(session.user.id),
		// Plaintiffs who named this attorney and are waiting on their decision —
		// the "New" tab, incoming and actionable, the opposite direction from the
		// attorney's own expressions of interest below.
		pendingInvitationsForEmail(session.user.email),
		// Invitations this attorney has since declined — kept as a record on the
		// "Declined" tab, alongside interests a plaintiff turned down.
		declinedInvitationsForEmail(session.user.email),
	]);

	const invitations: InvitationItem[] = invites.map((inv) => ({
		id: inv.id,
		caseId: inv.caseId,
		title: inv.caseTitle,
		category: inv.category,
		state: inv.location,
		plaintiffName: inv.plaintiffName,
	}));

	const toExpression = (i: (typeof interests)[number]): ExpressionIntake => ({
		id: i.id,
		caseId: i.case.id,
		title: i.case.title,
		category: i.case.category,
		state: i.case.state,
	});
	// The attorney's own expressions of interest, split by what became of each:
	// still awaiting the plaintiff (Interest sent), Accepted, or Declined.
	const awaiting = interests
		.filter((i) => i.status === "pending" || i.status === "viewed")
		.map(toExpression);
	const accepted = interests
		.filter((i) => i.status === "accepted")
		.map(toExpression);
	// Two kinds of "declined" share this tab: an expression of interest a plaintiff
	// turned down, and an invitation this attorney declined themselves. Both are a
	// closed record of the same case, so they read as one list.
	const declined = [
		...interests.filter((i) => i.status === "declined").map(toExpression),
		...declinedInvites.map((d) => ({
			id: d.id,
			caseId: d.caseId,
			title: d.caseTitle,
			category: d.category,
			state: d.location,
		})),
	];

	return (
		<div className="flex flex-col gap-6">
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				{tab === "open"
					? "Open intakes still seeking an attorney. Express interest and the plaintiff decides whether to take it further."
					: "New requests from plaintiffs who named you, and the expressions of interest you've sent out. Intakes you now represent live under My intakes."}
			</p>

			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-surface-2 p-1">
					<TabLink
						href={"/queue" as Route}
						label="Your requests"
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
						: `${invitations.length} new · ${awaiting.length} sent · ${accepted.length} accepted · ${declined.length} declined`}
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
				<YourRequests
					invitations={invitations}
					awaiting={awaiting}
					accepted={accepted}
					declined={declined}
				/>
			)}
		</div>
	);
}

/** A pill tab in the segmented Your requests / Browse open control. */
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
