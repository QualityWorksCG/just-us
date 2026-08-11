import type { Role } from "@just-us/auth";
import { hashInviteToken } from "@just-us/auth/invite-token";
import { isBlocked } from "@just-us/auth/user-status";
import { getAttorneyProfile } from "@just-us/db/attorney-profile";
import {
	caseInvitationStatus,
	findCaseInvitationByTokenHash,
	invitedEmailHasAccount,
} from "@just-us/db/case-invitations";
import {
	BadgeCheck,
	CircleCheck,
	FileSignature,
	Handshake,
	LogIn,
	MailCheck,
	Scale,
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
import { getSession } from "@/lib/auth-server";
import { withNext } from "@/lib/next-path";

/**
 * The one screen behind every bring-your-own-attorney invitation link.
 *
 * A plaintiff named an attorney by email when they published; this is where
 * that attorney answers. It is deliberately a single hub rather than a set of
 * routes, because the link in the email is fixed and the state behind it is
 * not: by the time it is opened the invitation may have lapsed, the plaintiff
 * may have withdrawn it, the case may already have an attorney, and the person
 * opening it may have no account, the wrong account, or the right account with
 * unfinished onboarding. Each of those needs its own words and its own next
 * step, and all of them arrive at the same URL.
 *
 * Nothing here is a permission check. Every gate the page draws is re-applied
 * inside `confirmCaseInvitation`'s transaction — this screen only decides what
 * to say.
 */

export const metadata = { title: "Case invitation" };

const primaryLinkClass =
	"inline-flex h-10 w-full items-center justify-center rounded-[var(--radius-control)] bg-primary font-medium text-[14px] text-primary-foreground hover:bg-primary/90";

const secondaryLinkClass =
	"inline-flex h-10 w-full items-center justify-center rounded-[var(--radius-control)] border border-line-strong bg-surface font-medium text-[14px] text-ink hover:bg-paper";

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

export default async function CaseInvitePage({
	searchParams,
}: {
	searchParams: Promise<{ token?: string; declined?: string }>;
}) {
	const { token, declined } = await searchParams;
	// Only the hash is stored, so an unknown link and a tampered one are
	// indistinguishable here — both land on "invalid".
	const invitation = token
		? await findCaseInvitationByTokenHash(hashInviteToken(token))
		: null;

	if (!token || !invitation) {
		return (
			<CaseInviteShell
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

	// The decline that just happened, told as an outcome rather than as an error.
	// The `declined` flag comes from our own redirect; the status is what makes it
	// true, so a hand-typed flag can't fake it.
	if (status === "declined" && declined === "1") {
		return (
			<CaseInviteShell
				icon={CircleCheck}
				tone="success"
				title="You've declined this case"
				description={`Thanks for answering. "${c.title}" has gone back to the attorney queue, where other attorneys can put themselves forward.`}
			>
				<p className="mb-5 text-[13px] text-muted-foreground leading-relaxed">
					Nothing else is needed from you, and this link won't work again.
				</p>
				<Link href={"/" as Route} className={secondaryLinkClass}>
					Go to JustUs
				</Link>
			</CaseInviteShell>
		);
	}

	if (status !== "pending") {
		return (
			<SettledInvitation
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

	const session = await getSession();

	// Every gate below sends them somewhere else to fix something, and each of
	// those destinations ends in a fixed redirect to /home. Carrying this back
	// means the round trip ends on the decision they came here to make, instead of
	// on a dashboard where the only route back is finding the email again.
	const returnHere = `/case-invite?token=${encodeURIComponent(token)}`;

	// ── Nobody signed in ────────────────────────────────────────────────────────
	if (!session?.user) {
		const hasAccount = await invitedEmailHasAccount(invitation.email);

		if (hasAccount) {
			return (
				<CaseInviteShell
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
							token={token}
							label="I don't represent this case"
						/>
					</div>
				</CaseInviteShell>
			);
		}

		return (
			<CaseInviteShell
				icon={Handshake}
				width="wide"
				title={`${c.owner.name} named you as their attorney`}
				description="JustUs is where supporters fund the legal costs of cases like this one. Create your attorney account to review the case and confirm you represent it."
			>
				<div className="flex flex-col gap-5">
					{summary}
					<CaseInviteAccountForm
						token={token}
						email={invitation.email}
						suggestedName={c.attorneyName}
					/>
					<div className="border-line-strong border-t pt-4">
						<DeclineInviteButton
							token={token}
							label="I don't represent this case"
						/>
					</div>
				</div>
			</CaseInviteShell>
		);
	}

	// ── Signed in as somebody else ──────────────────────────────────────────────
	const user = session.user;
	if (
		user.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase()
	) {
		return (
			<CaseInviteShell
				icon={UserRoundX}
				tone="danger"
				title="This invitation is for a different account"
				description={`It was sent to ${maskEmail(invitation.email)}, and you're signed in as ${user.email}. Only the invited address can confirm — receiving the link isn't proof of who you are.`}
			>
				<div className="flex flex-col gap-4">
					<p className="text-[13px] text-muted-foreground leading-relaxed">
						Sign out and come back in as the invited address. If that address is
						yours and you can't get into it, ask the plaintiff to re-send the
						invitation to one you can.
					</p>
					<SignOutAndReturnButton token={token} />
				</div>
			</CaseInviteShell>
		);
	}

	// ── The right person, not yet in a position to answer ───────────────────────
	const role = (user as { role?: Role }).role;
	const onboarded = (user as { onboarded?: boolean }).onboarded === true;

	// Blocking clears an account's sessions, so this only catches a cookie session
	// that outlived the block. Said here as well as enforced in the action, because
	// drawing a Confirm button for an account that cannot use it is a worse answer
	// than the truth.
	if (
		isBlocked(
			user as { banned?: boolean | null; banExpires?: Date | string | null },
		)
	) {
		return (
			<CaseInviteShell
				icon={UserRoundX}
				tone="danger"
				title="This account has been blocked"
				description="A blocked account can't take on a case. Contact support if you believe this is a mistake."
			>
				<div className="flex flex-col gap-4">
					<p className="text-[13px] text-muted-foreground leading-relaxed">
						The invitation itself is untouched — the plaintiff can send it to
						another address, or you can decline it so their case goes back in
						front of other attorneys straight away.
					</p>
					<DeclineInviteButton
						token={token}
						label="I don't represent this case"
					/>
				</div>
			</CaseInviteShell>
		);
	}

	if (!user.emailVerified) {
		return (
			<CaseInviteShell
				icon={MailCheck}
				width="wide"
				title="Verify your email first"
				description="Your JustUs account still needs its email address confirmed before you can act on a case."
			>
				<div className="flex flex-col gap-4">
					{summary}
					<Link href={"/verify-email" as Route} className={primaryLinkClass}>
						Verify my email
					</Link>
					<p className="text-[12px] text-muted-foreground">
						Then come back to this link to confirm.
					</p>
				</div>
			</CaseInviteShell>
		);
	}

	if (!onboarded) {
		return (
			<CaseInviteShell
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
						when asked — we'll bring you back here as soon as you're done.
					</p>
					<DeclineInviteButton
						token={token}
						label="I don't represent this case"
					/>
				</div>
			</CaseInviteShell>
		);
	}

	if (role !== "attorney") {
		return (
			<CaseInviteShell
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
					<SignOutAndReturnButton token={token} />
					<DeclineInviteButton
						token={token}
						label="I don't represent this case"
					/>
				</div>
			</CaseInviteShell>
		);
	}

	const profile = await getAttorneyProfile(user.id);
	const verification = profile?.verificationStatus ?? "unverified";

	if (verification !== "verified") {
		return (
			<CaseInviteShell
				icon={BadgeCheck}
				width="wide"
				title="Verify your bar standing to continue"
				description={
					verification === "pending" || verification === "needs_review"
						? "Your bar check is still being reviewed. Once it clears, come back to this link and you'll be able to confirm."
						: "Every attorney on JustUs is checked against their state bar before they can take on a case — including one they were invited to."
				}
			>
				<div className="flex flex-col gap-4">
					{summary}
					<Link href={"/profile" as Route} className={primaryLinkClass}>
						{verification === "pending" || verification === "needs_review"
							? "Check my verification"
							: "Verify my bar standing"}
					</Link>
					<p className="text-[12px] text-muted-foreground leading-relaxed">
						This invitation is held open for you in the meantime — the case
						stays off the attorney queue until you answer or the link expires.
					</p>
					<DeclineInviteButton
						token={token}
						label="I don't represent this case"
					/>
				</div>
			</CaseInviteShell>
		);
	}

	// ── Everything checks out ───────────────────────────────────────────────────
	return (
		<CaseInviteShell
			icon={FileSignature}
			width="wide"
			title={`Confirm you represent ${c.owner.name}`}
			description={`${c.owner.name} named you${c.attorneyFirm ? ` of ${c.attorneyFirm}` : ""} as their attorney on JustUs. Confirming links you to this case; declining sends it back to the attorney queue.`}
		>
			<div className="flex flex-col gap-5">
				{summary}
				<CaseInviteDecision token={token} />
			</div>
		</CaseInviteShell>
	);
}

/**
 * A link that has already been answered, withdrawn, or run out. Kept apart from
 * the live states because none of them can be recovered from this page — the
 * only useful thing left to say is which one happened and where the case went.
 */
function SettledInvitation({
	status,
	caseTitle,
	backInQueue,
}: {
	status: "accepted" | "declined" | "revoked" | "expired";
	caseTitle: string;
	backInQueue: boolean;
}) {
	const whereItWent = (
		<p className="text-[13px] text-muted-foreground leading-relaxed">
			{backInQueue
				? `"${caseTitle}" is back in the Seeking Representation queue, so any verified attorney can put themselves forward. If you'd still like to act on it, ask the plaintiff for a new invitation.`
				: `"${caseTitle}" has moved on since — ask the plaintiff directly if you'd still like to act on it.`}
		</p>
	);

	switch (status) {
		case "expired":
			return (
				<CaseInviteShell
					icon={TriangleAlert}
					tone="danger"
					title="This invitation has expired"
					description="Invitations are only good for 7 days, and this one has run out."
				>
					{whereItWent}
				</CaseInviteShell>
			);
		case "declined":
			return (
				<CaseInviteShell
					icon={TriangleAlert}
					tone="danger"
					title="This invitation was declined"
					description="Someone already answered this link, and the answer was no."
				>
					{whereItWent}
				</CaseInviteShell>
			);
		case "revoked":
			return (
				<CaseInviteShell
					icon={TriangleAlert}
					tone="danger"
					title="This invitation was withdrawn"
					description="The plaintiff cancelled it — usually because they invited a different attorney — so the link no longer works."
				>
					<p className="text-[13px] text-muted-foreground">
						Contact them directly if you think that's a mistake.
					</p>
				</CaseInviteShell>
			);
		default:
			return (
				<CaseInviteShell
					icon={CircleCheck}
					tone="success"
					title="This invitation has already been confirmed"
					description={`"${caseTitle}" already has its attorney of record, so there's nothing left to answer here.`}
				>
					<Link href={"/my-cases" as Route} className={secondaryLinkClass}>
						Go to my cases
					</Link>
				</CaseInviteShell>
			);
	}
}
