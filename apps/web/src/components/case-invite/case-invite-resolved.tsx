import { isBlocked } from "@just-us/auth/user-status";
import { getAdmission } from "@just-us/db/admissions";
import {
	caseInvitationStatus,
	type findCaseInvitation,
	invitedEmailHasAccount,
} from "@just-us/db/case-invitations";
import {
	ArrowUpRight,
	BadgeCheck,
	CircleCheck,
	Handshake,
	LogIn,
	MailCheck,
	MapPin,
	RotateCcw,
	Scale,
	Search,
	TriangleAlert,
	UserRoundCog,
	UserRoundX,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { CaseInviteAccountForm } from "@/components/case-invite/case-invite-account-form";
import {
	CaseInviteDecision,
	DeclineInviteButton,
} from "@/components/case-invite/case-invite-decision";
import { CaseInviteShell } from "@/components/case-invite/case-invite-shell";
import { SignOutAndReturnButton } from "@/components/case-invite/case-invite-sign-out";
import { CaseInviteSummary } from "@/components/case-invite/case-invite-summary";
import type { CaseInviteRef } from "@/lib/case-invite-ref";
import { caseInviteHref } from "@/lib/case-invite-ref";
import { withNext } from "@/lib/next-path";

/**
 * Every state of an invitation, drawn from a resolved ref + the person opening
 * it, for either surface: the signed-out card on the site, or the signed-in
 * modal over the dashboard. `asModal` only changes the frame — the words and the
 * gates are the same, and none of them is a permission check (every gate is
 * re-applied inside `confirmCaseInvitation`'s transaction).
 *
 * The two redirects the flow needs — a signed-out visitor on the id route, and a
 * missing token — belong to the page, not here: this component assumes it is past
 * them and only ever renders.
 */

type Invitation = NonNullable<Awaited<ReturnType<typeof findCaseInvitation>>>;

/** The fields this component reads off the signed-in user, or null when nobody
 *  is. Loose by design: the session's user is stamped with role/onboarded/ban
 *  flags that its base type doesn't carry. */
export type InviteUser = {
	id: string;
	email: string;
	name: string;
	emailVerified?: boolean;
	role?: string;
	onboarded?: boolean;
	banned?: boolean | null;
	banExpires?: Date | string | null;
} | null;

const primaryLinkClass =
	"inline-flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-primary font-medium text-[14px] text-primary-foreground hover:bg-primary/90";

const secondaryLinkClass =
	"inline-flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface font-medium text-[14px] text-ink hover:bg-paper";

/** Enough of the address to be recognised by the person who owns it, and not
 *  enough to hand it to whoever is holding the link. */
function maskEmail(email: string) {
	const [local = "", domain] = email.split("@");
	if (!domain) return "•••";
	const shown =
		local.length <= 2
			? "•".repeat(Math.max(local.length, 2))
			: `${local[0]}${"•".repeat(Math.max(local.length - 2, 1))}${local.at(-1)}`;
	return `${shown}@${domain}`;
}

export async function CaseInviteResolved({
	// Not named `ref`: React reserves that prop, and a server component that takes
	// a prop called `ref` fails to serialize ("Refs cannot be used in Server
	// Components"). Aliased back to `ref` for the body below.
	inviteRef: ref,
	invitation,
	user,
	declined,
	asModal,
}: {
	inviteRef: CaseInviteRef | null;
	invitation: Invitation | null;
	user: InviteUser;
	declined: boolean;
	asModal: boolean;
}) {
	// Only the hash is stored, so an unknown link and a tampered one are
	// indistinguishable — both land on "invalid".
	if (!ref || !invitation) {
		return (
			<CaseInviteShell
				asModal={asModal}
				icon={TriangleAlert}
				tone="danger"
				title="This invitation link is invalid"
				description="The link is missing or doesn't match an invitation we know about."
			>
				<p className="text-[13px] text-muted-foreground">
					Ask the person whose case this is to send you a new invitation.
				</p>
			</CaseInviteShell>
		);
	}

	const status = caseInvitationStatus(invitation);
	const c = invitation.case;
	const token = "token" in ref ? ref.token : null;

	// The decline that just happened, told as an outcome rather than as an error.
	// The `declined` flag comes from our own redirect; the status is what makes it
	// true, so a hand-typed flag can't fake it.
	if (status === "declined" && declined) {
		return (
			<CaseInviteShell
				asModal={asModal}
				icon={CircleCheck}
				tone="success"
				title="You've declined this case"
				description={`Thanks for answering. "${c.title}" has gone back to the attorney queue, where other attorneys can put themselves forward.`}
			>
				<p className="mb-5 text-[13px] text-muted-foreground leading-relaxed">
					Nothing else is needed from you, and this link won't work again.
				</p>
				<SettledActions asModal={asModal} />
			</CaseInviteShell>
		);
	}

	if (status !== "pending") {
		return (
			<SettledInvitation
				asModal={asModal}
				status={status}
				caseTitle={c.title}
				// Only true if the case actually went back — a lapsed invitation on a
				// case that has since been withdrawn or matched elsewhere shouldn't
				// point at a queue it isn't in.
				backInQueue={!c.deletedAt && c.status === "seeking"}
			/>
		);
	}

	// The invitation outlived the case it was about. Cheaper to say so here than
	// to let them read the whole thing and press a button that refuses.
	if (c.deletedAt || c.status !== "seeking") {
		return (
			<CaseInviteShell
				asModal={asModal}
				icon={TriangleAlert}
				tone="danger"
				title="This case is no longer open"
				description="The plaintiff has withdrawn it or already has an attorney, so there's nothing left to confirm."
			>
				<p className="text-[13px] text-muted-foreground">
					If you think that's wrong, contact the person who invited you.
				</p>
			</CaseInviteShell>
		);
	}

	const summary = (
		<CaseInviteSummary
			title={c.title}
			summary={c.summary}
			category={c.category}
			location={c.location}
			goalCents={c.goalCents}
			plaintiffName={c.owner.name}
		/>
	);

	// Every gate below sends them somewhere else to fix something, and each of
	// those destinations ends in a fixed redirect to /home. Carrying this back
	// means the round trip ends on the decision they came here to make.
	const returnHere = caseInviteHref(ref);

	// ── Nobody signed in ────────────────────────────────────────────────────────
	// Only reachable on the token route: the id route sends a signed-out visitor
	// to sign in before this component is rendered.
	if (!user) {
		const hasAccount = await invitedEmailHasAccount(invitation.email);

		if (hasAccount) {
			return (
				<CaseInviteShell
					asModal={asModal}
					icon={LogIn}
					width="wide"
					title={`${c.owner.name} named you as their attorney`}
					description="You already have a JustUs account for the address this was sent to. Sign in with it, then open this link again to confirm."
				>
					<div className="flex flex-col gap-4">
						{summary}
						<Link
							href={withNext("/login?mode=signin", returnHere) as Route}
							className={primaryLinkClass}
						>
							Sign in to JustUs
						</Link>
						<p className="text-[12px] text-muted-foreground leading-relaxed">
							Signing in brings you straight back here, with the Confirm button
							ready once we can see it's you.
						</p>
						<DeclineInviteButton
							invite={ref}
							label="I don't represent this case"
						/>
					</div>
				</CaseInviteShell>
			);
		}

		return (
			<CaseInviteShell
				asModal={asModal}
				icon={Handshake}
				width="wide"
				title={`${c.owner.name} named you as their attorney`}
				description="JustUs is where supporters fund the legal costs of cases like this one. Create your attorney account to review the case and confirm you represent it."
			>
				<div className="flex flex-col gap-5">
					{summary}
					<CaseInviteAccountForm
						token={token ?? ""}
						email={invitation.email}
						suggestedName={c.attorneyName}
					/>
					<div className="border-line-strong border-t pt-4">
						<DeclineInviteButton
							invite={ref}
							label="I don't represent this case"
						/>
					</div>
				</div>
			</CaseInviteShell>
		);
	}

	// ── Signed in as somebody else ──────────────────────────────────────────────
	if (
		user.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase()
	) {
		return (
			<CaseInviteShell
				asModal={asModal}
				icon={UserRoundX}
				tone="danger"
				title="This invitation is for a different account"
				description={`It was sent to ${maskEmail(invitation.email)}, and you're signed in as ${user.email}. Only the invited address can confirm. Receiving the link isn't proof of who you are.`}
			>
				<div className="flex flex-col gap-4">
					<p className="text-[13px] text-muted-foreground leading-relaxed">
						Sign out and come back in as the invited address. If that address is
						yours and you can't get into it, ask the plaintiff to re-send the
						invitation to one you can.
					</p>
					<SignOutAndReturnButton invite={ref} />
				</div>
			</CaseInviteShell>
		);
	}

	// ── The right person, not yet in a position to answer ───────────────────────
	const role = user.role;
	const onboarded = user.onboarded === true;

	// Blocking clears an account's sessions, so this only catches a cookie session
	// that outlived the block. Said here as well as enforced in the action, because
	// drawing a Confirm button for an account that cannot use it is a worse answer
	// than the truth.
	if (isBlocked(user)) {
		return (
			<CaseInviteShell
				asModal={asModal}
				icon={UserRoundX}
				tone="danger"
				title="This account has been blocked"
				description="A blocked account can't take on a case. Contact support if you believe this is a mistake."
			>
				<div className="flex flex-col gap-4">
					<p className="text-[13px] text-muted-foreground leading-relaxed">
						The invitation itself is untouched. The plaintiff can send it to
						another address, or you can decline it so their case goes back in
						front of other attorneys straight away.
					</p>
					<DeclineInviteButton
						invite={ref}
						label="I don't represent this case"
					/>
				</div>
			</CaseInviteShell>
		);
	}

	if (!user.emailVerified) {
		return (
			<CaseInviteShell
				asModal={asModal}
				icon={MailCheck}
				width="wide"
				title="Verify your email first"
				description="Your JustUs account still needs its email address confirmed before you can act on a case."
			>
				<div className="flex flex-col gap-4">
					{summary}
					<Link
						href={withNext("/verify-email", returnHere) as Route}
						className={primaryLinkClass}
					>
						Verify my email
					</Link>
					<p className="text-[12px] text-muted-foreground">
						The link in that email brings you back here to confirm.
					</p>
				</div>
			</CaseInviteShell>
		);
	}

	if (!onboarded) {
		return (
			<CaseInviteShell
				asModal={asModal}
				icon={UserRoundCog}
				width="wide"
				title="Finish setting up your attorney account"
				description="Before you can take on a case, we need your firm, your bar number, and the state you're admitted in. It takes a minute."
			>
				<div className="flex flex-col gap-4">
					{summary}
					<Link
						href={withNext("/onboarding", returnHere) as Route}
						className={primaryLinkClass}
					>
						Finish attorney onboarding
					</Link>
					<p className="text-[12px] text-muted-foreground leading-relaxed">
						Choose <strong className="font-semibold text-ink">Attorney</strong>{" "}
						when asked, and we'll bring you back here as soon as you're done.
					</p>
					<DeclineInviteButton
						invite={ref}
						label="I don't represent this case"
					/>
				</div>
			</CaseInviteShell>
		);
	}

	if (role !== "attorney") {
		return (
			<CaseInviteShell
				asModal={asModal}
				icon={Scale}
				tone="danger"
				title="This account isn't an attorney account"
				description={`You're signed in as ${user.email}, which is set up as a ${role ?? "member"} account. Only an attorney account can confirm representation on a case.`}
			>
				<div className="flex flex-col gap-4">
					<p className="text-[13px] text-muted-foreground leading-relaxed">
						If you practise under a different JustUs account, sign out and open
						this link again from that one. Otherwise, ask the plaintiff to
						invite the address you use as an attorney.
					</p>
					<SignOutAndReturnButton invite={ref} />
					<DeclineInviteButton
						invite={ref}
						label="I don't represent this case"
					/>
				</div>
			</CaseInviteShell>
		);
	}

	// Bar standing in *this case's* state, not the account's overall badge. An
	// attorney verified in New York is still not able to act on a California
	// matter, and telling them they are verified and then refusing the confirm
	// would be the worst of both.
	const admission = await getAdmission(user.id, c.location);

	// Never claimed the state at all: a different problem from an unverified claim,
	// and a different first step. Said before the bar check is mentioned, because
	// "verify your licence" is meaningless advice for a state they hold none in.
	if (!admission) {
		return (
			<CaseInviteShell
				asModal={asModal}
				icon={MapPin}
				width="wide"
				title={`You aren't admitted in ${c.location}`}
				description={`${c.owner.name}'s case falls under ${c.location} law, and your JustUs profile doesn't list ${c.location} among the states you practise in. A case can only be taken on by an attorney admitted where it is.`}
			>
				<div className="flex flex-col gap-4">
					{summary}
					<Link
						href={withNext("/profile", returnHere) as Route}
						className={primaryLinkClass}
					>
						Add {c.location} to my states
					</Link>
					<p className="text-[12px] text-muted-foreground leading-relaxed">
						If you are admitted there, add the state and run its bar check.
						We'll bring you back here. If you aren't, decline so {c.owner.name}
						's case goes in front of attorneys who are, rather than waiting out
						the week.
					</p>
					<DeclineInviteButton
						invite={ref}
						label="I don't represent this case"
					/>
				</div>
			</CaseInviteShell>
		);
	}

	const verification = admission.verificationStatus;

	if (verification !== "verified") {
		return (
			<CaseInviteShell
				asModal={asModal}
				icon={BadgeCheck}
				width="wide"
				title={`Verify your ${c.location} bar standing to continue`}
				description={
					verification === "pending" || verification === "needs_review"
						? `Your ${c.location} bar check is still being reviewed. Once it clears, come back to this link and you'll be able to confirm.`
						: `Every attorney on JustUs is checked against the bar of the state a case falls under, including one they were invited to. This case is in ${c.location}.`
				}
			>
				<div className="flex flex-col gap-4">
					{summary}
					<Link
						href={withNext("/profile", returnHere) as Route}
						className={primaryLinkClass}
					>
						{verification === "pending" || verification === "needs_review"
							? "Check my verification"
							: `Verify my ${c.location} licence`}
					</Link>
					<p className="text-[12px] text-muted-foreground leading-relaxed">
						This invitation is held open for you in the meantime. The case stays
						off the attorney queue until you answer or it expires. You can come
						back to it from your dashboard at any time.
					</p>
					<DeclineInviteButton
						invite={ref}
						label="I don't represent this case"
					/>
				</div>
			</CaseInviteShell>
		);
	}

	// ── Everything checks out ───────────────────────────────────────────────────
	// Framed as the request it is: the plaintiff asked for this attorney, so this
	// is them saying yes or no to the request — not confirming a representation
	// that already exists.
	return (
		<CaseInviteShell
			asModal={asModal}
			icon={Scale}
			width="wide"
			title={`${c.owner.name} requested you to represent them`}
			description={`${c.owner.name} named you${c.attorneyFirm ? ` of ${c.attorneyFirm}` : ""} as their attorney on JustUs. Confirm to take the case on, or decline to send it back to the queue for other attorneys.`}
		>
			<div className="flex flex-col gap-4">
				{summary}
				<Link
					href={
						(asModal
							? `/queue/${c.id}`
							: withNext("/login?mode=signin", `/queue/${c.id}`)) as Route
					}
					className="inline-flex items-center justify-center gap-1.5 font-semibold text-[13px] text-brass-deep hover:underline"
				>
					<ArrowUpRight className="size-4" aria-hidden="true" />
					{asModal
						? "View the full request"
						: "Sign in to view the full request"}
				</Link>
				<CaseInviteDecision
					invite={ref}
					confirmLabel="Yes, represent this case"
					declineLabel="Decline and send back to the queue"
					confirmIcon
				/>
			</div>
		</CaseInviteShell>
	);
}

/**
 * A link that has already been answered, withdrawn, or run out. None of these
 * can be recovered from here — the only useful thing left to say is which one
 * happened and where the case went, then a way onward.
 */
function SettledInvitation({
	status,
	caseTitle,
	backInQueue,
	asModal,
}: {
	status: "accepted" | "declined" | "revoked" | "expired";
	caseTitle: string;
	backInQueue: boolean;
	asModal: boolean;
}) {
	if (status === "accepted") {
		return (
			<CaseInviteShell
				asModal={asModal}
				icon={CircleCheck}
				tone="success"
				title="This invitation has already been confirmed"
				description={`"${caseTitle}" already has its attorney of record, so there's nothing left to answer here.`}
			>
				<Link
					href={(asModal ? "/my-cases" : "/login?mode=signin") as Route}
					className={secondaryLinkClass}
				>
					{asModal ? "Go to my cases" : "Sign in to JustUs"}
				</Link>
			</CaseInviteShell>
		);
	}

	if (status === "revoked") {
		return (
			<CaseInviteShell
				asModal={asModal}
				icon={TriangleAlert}
				tone="danger"
				title="This invitation was withdrawn"
				description="The plaintiff cancelled it (usually because they invited a different attorney), so the link no longer works."
			>
				<p className="text-[13px] text-muted-foreground">
					Contact them directly if you think that's a mistake.
				</p>
			</CaseInviteShell>
		);
	}

	// Expired or declined — both leave the case back in the queue (when it's still
	// open), which is the useful next step.
	const isExpired = status === "expired";
	return (
		<CaseInviteShell
			asModal={asModal}
			icon={TriangleAlert}
			tone="danger"
			title={
				isExpired
					? "This invitation has expired"
					: "This invitation has already been answered"
			}
			description={
				isExpired
					? "Invitations are only good for 7 days, and this one has run out."
					: "Someone answered this link and chose not to take the case on."
			}
		>
			<div className="flex flex-col gap-4">
				<div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-card)] border border-border bg-paper px-4 py-3">
					<Scale
						className="size-4 shrink-0 text-brass-deep"
						aria-hidden="true"
					/>
					<span className="min-w-0 flex-1 truncate font-semibold text-[13.5px] text-ink">
						{caseTitle || "Untitled case"}
					</span>
					{backInQueue && (
						<span className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] bg-green-soft px-2 py-0.5 font-semibold text-[11.5px] text-green-deep">
							<RotateCcw className="size-3" aria-hidden="true" />
							Back in queue
						</span>
					)}
				</div>
				<SettledActions asModal={asModal} />
				<p className="text-center text-[12.5px] text-muted-foreground leading-relaxed">
					{backInQueue
						? "Still need this case? "
						: `"${caseTitle}" has moved on since. `}
					<span className="font-semibold text-brass-deep">
						Ask the plaintiff for a fresh invite
					</span>
					.
				</p>
			</div>
		</CaseInviteShell>
	);
}

/** Where to go from a link that's over. Signed in, that's back into the app;
 *  signed out, it's the public site. */
function SettledActions({ asModal }: { asModal: boolean }) {
	if (asModal) {
		return (
			<div className="grid gap-2.5 sm:grid-cols-2">
				<Link href={"/queue?tab=open" as Route} className={primaryLinkClass}>
					<Search className="size-4" aria-hidden="true" />
					Browse open cases
				</Link>
				<Link href={"/home" as Route} className={secondaryLinkClass}>
					Go to your dashboard
				</Link>
			</div>
		);
	}
	return (
		<div className="grid gap-2.5 sm:grid-cols-2">
			<Link href={"/cases" as Route} className={primaryLinkClass}>
				<Search className="size-4" aria-hidden="true" />
				Browse cases
			</Link>
			<Link href={"/" as Route} className={secondaryLinkClass}>
				Go to JustUs
			</Link>
		</div>
	);
}
