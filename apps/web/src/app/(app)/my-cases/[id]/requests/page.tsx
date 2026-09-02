import { getPendingInvitationForCase } from "@just-us/db/case-invitations";
import { getOwnedCase } from "@just-us/db/cases";
import {
	getCaseMatch,
	listCaseInterests,
	markCaseInterestsViewed,
} from "@just-us/db/requests";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import {
	ArrowRight,
	Check,
	Clock,
	Handshake,
	Search,
	ShieldCheck,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Fragment } from "react";

import { AttorneyInterestCard } from "@/components/dashboard/attorney-interest-card";
import { BackLink } from "@/components/dashboard/back-link";
import { WithdrawRequestButton } from "@/components/dashboard/withdraw-request-button";
import { requireRole } from "@/lib/auth-server";

const STEPS = [
	"Published",
	"Interest received",
	"You connect",
	"Live",
] as const;

function initials(name: string) {
	return (
		name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? "")
			.join("") || "—"
	);
}

export default async function CaseRequestsPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { session } = await requireRole("plaintiff");
	const { id } = await params;
	const c = await getOwnedCase(id, session.user.id);
	if (!c || c.deletedAt) notFound();
	// The inbox only makes sense while the case is out to attorneys.
	if (c.status !== "seeking") redirect(`/my-cases/${id}` as Route);

	// An attorney was already chosen (the match exists) but the case isn't live
	// yet — the plaintiff accepted, then left the publish wizard, often because
	// something errored. The accepted request is no longer "open", so the inbox
	// below would fall back to "choose an attorney" and read as if the choice were
	// undone. Instead, show who they picked and a direct way to finish — the
	// accept is never lost to an error partway through going live.
	const match = await getCaseMatch(id, session.user.id);
	if (match) {
		const attorneyName = c.attorneyName?.trim() || "your attorney";
		return (
			<div className="flex w-full flex-col gap-6">
				<div>
					<BackLink
						href={"/my-cases" as Route}
						label="Back to my cases"
						className="mb-3"
					/>
					<span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-green-soft px-3 py-1 font-mono font-semibold text-[11px] text-green-deep uppercase tracking-[0.06em]">
						<span className="size-1.5 rounded-full bg-success" />
						Attorney connected
					</span>
					<h2 className="mt-3 font-extrabold text-[clamp(1.75rem,3.4vw,2.375rem)] text-ink tracking-[-0.03em]">
						You've connected with {attorneyName}
					</h2>
					<p className="mt-2 text-[14.5px] text-ink-soft leading-relaxed">
						Your attorney is set for “{c.title || "your case"}”. Finish agreeing
						the fee and publish to take your campaign live. This choice is
						saved. If something went wrong while publishing, you won't have to
						do this again.
					</p>
				</div>

				{/* Progress stepper — the choice is made; publishing is what's left. */}
				<ol className="flex items-center gap-2 overflow-x-auto pb-1">
					{STEPS.map((label, i) => {
						const done = i < 3;
						const active = i === 3;
						return (
							<Fragment key={label}>
								<li className="inline-flex shrink-0 items-center gap-2">
									<span
										className={cn(
											"flex size-5 shrink-0 items-center justify-center rounded-full text-[11px]",
											done && "bg-success text-white",
											active && "border-2 border-brass text-brass-deep",
											!done &&
												!active &&
												"border border-line-strong text-muted-foreground",
										)}
									>
										{done ? (
											<Check className="size-3" aria-hidden="true" />
										) : null}
									</span>
									<span
										className={cn(
											"whitespace-nowrap text-[12.5px]",
											done || active
												? "font-semibold text-ink"
												: "text-muted-foreground",
										)}
									>
										{label}
									</span>
								</li>
								{i < STEPS.length - 1 && (
									<span className="h-px flex-1 bg-border" aria-hidden="true" />
								)}
							</Fragment>
						);
					})}
				</ol>

				<div className="flex flex-col gap-5 rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
					<div className="flex items-center gap-3">
						<span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brass font-bold text-[14px] text-white">
							{initials(attorneyName)}
						</span>
						<div className="min-w-0">
							<p className="font-bold text-[15px] text-ink">{attorneyName}</p>
							<p className="font-mono text-[10.5px] text-muted-foreground uppercase tracking-[0.07em]">
								Your attorney
							</p>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-3 border-border border-t pt-5">
						<Link
							href={`/cases/new?draft=${id}` as Route}
							className={cn(buttonVariants({ size: "lg" }), "px-5")}
						>
							<Handshake data-icon="inline-start" aria-hidden="true" />
							Continue: agree the fee & publish
							<ArrowRight data-icon="inline-end" aria-hidden="true" />
						</Link>
						<Link
							href={"/my-cases" as Route}
							className={cn(
								buttonVariants({ variant: "outline", size: "lg" }),
								"px-5",
							)}
						>
							Back to my cases
						</Link>
					</div>
				</div>

				<div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-border bg-surface/60 px-5 py-3.5 text-[12.5px] text-ink-soft leading-relaxed">
					<ShieldCheck
						className="mt-0.5 size-4 shrink-0 text-brass-deep"
						aria-hidden="true"
					/>
					Nothing is final until you publish. Your case only goes live, and
					starts raising, once you've agreed the fee and hit publish.
				</div>
			</div>
		);
	}

	// A pending invitation means the plaintiff asked one named attorney (from the
	// directory or the wizard), and the case is held just for them — it is NOT in
	// the open queue, so no expressions of interest can arrive. This screen has to
	// say that, rather than the "any bar-verified attorney can put themselves
	// forward" copy the open-queue state uses.
	const pendingInvite = await getPendingInvitationForCase(id);
	if (pendingInvite) {
		const attorneyName = c.attorneyName?.trim() || "the attorney you asked";
		const firstName = attorneyName.split(/\s+/)[0] || attorneyName;
		const daysLeft = Math.max(
			0,
			Math.ceil((pendingInvite.expiresAt.getTime() - Date.now()) / 86_400_000),
		);
		// A stepper true to a direct request: the request is sent and awaiting the
		// attorney's answer, not sitting in an open queue for interest to arrive.
		const requestedSteps = [
			"Published",
			"Request sent",
			"They respond",
			"Live",
		] as const;
		return (
			<div className="flex w-full flex-col gap-6">
				<div>
					<BackLink
						href={"/my-cases" as Route}
						label="Back to my cases"
						className="mb-3"
					/>
					<span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-brass-wash px-3 py-1 font-mono font-semibold text-[11px] text-brass-deep uppercase tracking-[0.06em]">
						<Clock className="size-3" aria-hidden="true" />
						Awaiting {firstName}'s reply
					</span>
					<h2 className="mt-3 font-extrabold text-[clamp(1.75rem,3.4vw,2.375rem)] text-ink tracking-[-0.03em]">
						You asked {firstName} to represent you
					</h2>
					<p className="mt-2 max-w-[68ch] text-[14.5px] text-ink-soft leading-relaxed">
						{attorneyName} has “{c.title || "your case"}” to review and will
						accept or decline
						{daysLeft > 0
							? ` within about ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`
							: " soon"}
						. While your request is open, your case is held just for them — no
						other attorney can see it.
					</p>
				</div>

				<ol className="flex items-center gap-2 overflow-x-auto pb-1">
					{requestedSteps.map((label, i) => {
						const done = i < 2;
						const active = i === 2;
						return (
							<Fragment key={label}>
								<li className="inline-flex shrink-0 items-center gap-2">
									<span
										className={cn(
											"flex size-5 shrink-0 items-center justify-center rounded-full text-[11px]",
											done && "bg-success text-white",
											active && "border-2 border-brass text-brass-deep",
											!done &&
												!active &&
												"border border-line-strong text-muted-foreground",
										)}
									>
										{done ? (
											<Check className="size-3" aria-hidden="true" />
										) : null}
									</span>
									<span
										className={cn(
											"whitespace-nowrap text-[12.5px]",
											done || active
												? "font-semibold text-ink"
												: "text-muted-foreground",
										)}
									>
										{label}
									</span>
								</li>
								{i < requestedSteps.length - 1 && (
									<span className="h-px flex-1 bg-border" aria-hidden="true" />
								)}
							</Fragment>
						);
					})}
				</ol>

				<div className="flex flex-col gap-5 rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
					<div className="flex items-center gap-3">
						<span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brass font-bold text-[14px] text-white">
							{initials(attorneyName)}
						</span>
						<div className="min-w-0">
							<p className="truncate font-bold text-[15px] text-ink">
								{attorneyName}
							</p>
							<p className="font-mono text-[10.5px] text-muted-foreground uppercase tracking-[0.07em]">
								Reviewing your request
							</p>
						</div>
					</div>
					<p className="text-[13.5px] text-ink-soft leading-relaxed">
						You'll be notified the moment they answer. If they confirm, you'll
						move on to agree the fee and publish. Changed your mind, or don't
						want to wait? You can take the request back and choose someone else.
					</p>
					<div className="border-border border-t pt-5">
						<WithdrawRequestButton caseId={id} attorneyFirstName={firstName} />
					</div>
				</div>

				<div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-border bg-surface/60 px-5 py-3.5 text-[12.5px] text-ink-soft leading-relaxed">
					<ShieldCheck
						className="mt-0.5 size-4 shrink-0 text-brass-deep"
						aria-hidden="true"
					/>
					If {firstName} declines or doesn't answer in time, your case goes to
					every bar-verified attorney, who can then read it and put themselves
					forward — and you choose from whoever does. Your contact details are
					never shared, and nothing reaches you until you reach out.
				</div>
			</div>
		);
	}

	// Opening the inbox is the moment the plaintiff has genuinely seen what's in
	// it, so it's where `pending` becomes `viewed` (JUS-25). The count comes back
	// from the flip, so the "N new" badge reflects what was true on arrival rather
	// than resetting to zero as the page renders.
	const [newCount, interests] = await Promise.all([
		markCaseInterestsViewed(id, session.user.id),
		listCaseInterests(id, session.user.id),
	]);

	const hasInterest = interests.length > 0;
	// Stepper: Published always done; Interest received once any arrive.
	const activeStep = hasInterest ? 2 : 1;

	return (
		<div className="flex w-full flex-col gap-6">
			<div>
				<BackLink
					href={"/my-cases" as Route}
					label="Back to my cases"
					className="mb-3"
				/>
				{hasInterest && (
					<span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-green-soft px-3 py-1 font-mono font-semibold text-[11px] text-green-deep uppercase tracking-[0.06em]">
						<span className="size-1.5 rounded-full bg-success" />
						{newCount > 0
							? `${newCount} new`
							: `${interests.length} ${interests.length === 1 ? "attorney" : "attorneys"} interested`}
					</span>
				)}
				<h2 className="mt-3 font-extrabold text-[clamp(1.75rem,3.4vw,2.375rem)] text-ink tracking-[-0.03em]">
					{hasInterest
						? "Attorneys interested in representing you"
						: "Your case is out to attorneys"}
				</h2>
				<p className="mt-2 text-[14.5px] text-ink-soft leading-relaxed">
					{hasInterest
						? "These attorneys have put themselves forward. None of them can contact you. You reach out by choosing one, which sets your attorney and moves you to agree the fee. Nothing's final until you publish."
						: `Bar-verified attorneys can put themselves forward to represent “${c.title || "your case"}”. You'll see them here, or connect with an attorney yourself anytime.`}
				</p>
			</div>

			{/* Progress stepper. Labels take their own width and the connector lines
			    flex between them, so the row spans the container evenly rather than
			    leaving dead space after the last step. */}
			<ol className="flex items-center gap-2 overflow-x-auto pb-1">
				{STEPS.map((label, i) => {
					const done = i < activeStep;
					const active = i === activeStep;
					return (
						<Fragment key={label}>
							<li className="inline-flex shrink-0 items-center gap-2">
								<span
									className={cn(
										"flex size-5 shrink-0 items-center justify-center rounded-full text-[11px]",
										done && "bg-success text-white",
										active && "border-2 border-brass text-brass-deep",
										!done &&
											!active &&
											"border border-line-strong text-muted-foreground",
									)}
								>
									{done ? (
										<Check className="size-3" aria-hidden="true" />
									) : null}
								</span>
								<span
									className={cn(
										"whitespace-nowrap text-[12.5px]",
										done || active
											? "font-semibold text-ink"
											: "text-muted-foreground",
									)}
								>
									{label}
								</span>
							</li>
							{i < STEPS.length - 1 && (
								<span className="h-px flex-1 bg-border" aria-hidden="true" />
							)}
						</Fragment>
					);
				})}
			</ol>

			{/* Expressions of interest, or an empty state */}
			{hasInterest ? (
				<div className="flex flex-col gap-4">
					{interests.map((interest) => (
						<AttorneyInterestCard key={interest.id} interest={interest} />
					))}
				</div>
			) : (
				<div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border border-dashed bg-surface px-6 py-12 text-center">
					<span className="flex size-12 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
						<Clock className="size-6" aria-hidden="true" />
					</span>
					<p className="font-bold text-[16px] text-ink">Waiting on attorneys</p>
					<p className="max-w-[46ch] text-[13.5px] text-muted-foreground leading-relaxed">
						Attorneys browsing cases that need representation can put themselves
						forward here. But you don't have to wait.
					</p>
					<Link
						href={`/cases/new?draft=${id}` as Route}
						className={cn(buttonVariants({ size: "lg" }), "mt-1 px-5")}
					>
						<Search data-icon="inline-start" aria-hidden="true" />
						Connect with an attorney yourself
					</Link>
				</div>
			)}

			{/* Footer note — the promise this screen rests on. */}
			<div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-border bg-surface/60 px-5 py-3.5 text-[12.5px] text-ink-soft leading-relaxed">
				<ShieldCheck
					className="mt-0.5 size-4 shrink-0 text-brass-deep"
					aria-hidden="true"
				/>
				Bar-verified attorneys can read your case (your account of what
				happened, the evidence you filed, and your name), which is how they
				decide whether they can help. Your contact details are never shared, and
				they can't message you: nothing reaches you until you reach out. Passing
				on one is final; you can keep waiting, and more may still come forward.
			</div>
		</div>
	);
}
