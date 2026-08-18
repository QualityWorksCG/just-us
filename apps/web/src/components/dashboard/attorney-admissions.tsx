"use client";

import { Button } from "@just-us/ui/components/button";
import { Landmark, Search, Star, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import {
	addAdmissionAction,
	removeAdmissionAction,
	setPrimaryAdmissionAction,
	verifyAttorneyAction,
} from "@/app/(app)/profile/verification-actions";
import { AdmittedStatesField } from "@/components/attorneys/admitted-states-field";
import type { VerificationStatus } from "@/lib/attorney-verification";

import { VerificationBadge } from "./attorney-verification";

export type AdmissionView = {
	state: string;
	verificationStatus: VerificationStatus;
	verifiedAt: Date | null;
	primary: boolean;
};

/**
 * The states this attorney practises in, and the standing of each.
 *
 * This is the control behind the platform's central rule about jurisdiction: a
 * case may only be taken by an attorney with a *verified* admission in the case's
 * own state. So the panel has to make two different things visible at once — the
 * states they claim, which decides what appears in their queue, and which of
 * those have cleared a bar check, which decides what they can act on. A single
 * badge could say neither, which is why this replaced the one-state Select that
 * used to live in the verification card.
 *
 * Each state carries its own check because each is its own licence. Removing one
 * only affects what they can take from here on; cases they already represent keep
 * their attorney, which the copy says outright rather than leaving to be
 * discovered.
 */
export function AttorneyAdmissions({
	admissions,
	canRunChecks,
}: {
	admissions: AdmissionView[];
	/** False until there's a legal name on the profile — a check searches on it. */
	canRunChecks: boolean;
}) {
	const router = useRouter();
	const addId = useId();
	const [busy, setBusy] = useState<string | null>(null);
	const [, startTransition] = useTransition();
	// Which state a check is running for, so only that row shows "Checking…".
	const [checking, setChecking] = useState<string | null>(null);

	function act(
		state: string,
		run: () => Promise<{ ok: boolean; error?: string }>,
		success: string,
	) {
		setBusy(state);
		startTransition(async () => {
			const res = await run();
			setBusy(null);
			if (res.ok) {
				toast.success(success);
				router.refresh();
			} else {
				toast.error(res.error ?? "That didn't work. Please try again.");
			}
		});
	}

	function runCheck(state: string) {
		setChecking(state);
		startTransition(async () => {
			const res = await verifyAttorneyAction({ state });
			setChecking(null);
			if (!res.ok) {
				toast.error(res.error);
				return;
			}
			const messages: Record<VerificationStatus, string> = {
				verified: `Verified in ${state} — you can now take cases there.`,
				needs_review: `${state} couldn't be verified automatically. An administrator will review it.`,
				rejected: `The check couldn't confirm an active licence in ${state}.`,
				unverified: `The check found nothing conclusive for ${state}.`,
				pending: "Check started.",
			};
			if (res.status === "verified") toast.success(messages[res.status]);
			else toast.info(messages[res.status]);
			router.refresh();
		});
	}

	const verifiedCount = admissions.filter(
		(row) => row.verificationStatus === "verified",
	).length;

	return (
		<div className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
			<h3 className="font-bold text-[14.5px] text-ink">
				Where you're admitted
			</h3>
			<p className="mt-0.5 max-w-[68ch] text-[13px] text-muted-foreground leading-relaxed">
				Add every state you hold a licence in. Your queue only shows cases from
				these states, and you can only take one on once that state's bar
				standing is verified — each state is checked separately, because each is
				its own licence.
			</p>

			{admissions.length === 0 ? (
				<p className="mt-4 rounded-[var(--radius-card-sm)] bg-danger/5 px-4 py-3 text-[13px] text-danger leading-relaxed">
					You haven't added any states yet, so no cases can reach you. Add the
					state you're admitted in to start seeing work.
				</p>
			) : (
				<ul className="mt-4 flex flex-col gap-2.5">
					{admissions.map((row) => (
						<li
							key={row.state}
							className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card-sm)] border border-border bg-paper-alt px-4 py-3"
						>
							<span className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
								<span className="font-semibold text-[14px] text-ink">
									{row.state}
								</span>
								{row.primary && (
									<span className="rounded-[var(--radius-pill)] bg-brass-deep px-2 py-0.5 font-semibold text-[11px] text-white">
										Primary
									</span>
								)}
								<VerificationBadge status={row.verificationStatus} />
							</span>

							<span className="flex items-center gap-1.5">
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={
										!canRunChecks || checking !== null || busy === row.state
									}
									onClick={() => runCheck(row.state)}
									title={
										canRunChecks
											? undefined
											: "Add your legal name before running a check"
									}
								>
									<Search data-icon="inline-start" aria-hidden="true" />
									{checking === row.state
										? "Checking…"
										: row.verificationStatus === "unverified"
											? "Verify"
											: "Re-check"}
								</Button>
								{!row.primary && (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										disabled={busy !== null || checking !== null}
										onClick={() =>
											act(
												row.state,
												() => setPrimaryAdmissionAction(row.state),
												`${row.state} is now your primary state.`,
											)
										}
										title="The state your directory listing leads with"
									>
										<Star data-icon="inline-start" aria-hidden="true" />
										Make primary
									</Button>
								)}
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={busy !== null || checking !== null}
									onClick={() =>
										act(
											row.state,
											() => removeAdmissionAction(row.state),
											`${row.state} removed. Cases you already represent there aren't affected.`,
										)
									}
									aria-label={`Remove ${row.state}`}
								>
									<Trash2 aria-hidden="true" />
								</Button>
							</span>
						</li>
					))}
				</ul>
			)}

			<div className="mt-4 border-line-strong border-t pt-4">
				<label htmlFor={addId} className="font-semibold text-[13px] text-ink">
					Add a state
				</label>
				<p className="mt-0.5 mb-2.5 text-[12.5px] text-muted-foreground">
					Adding a state is a claim, not a licence — run its check to take cases
					there.
				</p>
				{/* The field's own chips are suppressed here: the list above already
				    shows what has been added, with the standing this control cannot. */}
				<AdmittedStatesField
					addId={addId}
					value={admissions.map((row) => row.state)}
					disabled={busy !== null || checking !== null}
					onChange={(next) => {
						const added = next.find(
							(state) => !admissions.some((row) => row.state === state),
						);
						if (added) {
							act(added, () => addAdmissionAction(added), `${added} added.`);
						}
					}}
					hideChips
				/>
			</div>

			{admissions.length > 0 && (
				<p className="mt-4 flex items-start gap-2.5 text-[12.5px] text-muted-foreground leading-relaxed">
					<Landmark className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					<span>
						{verifiedCount === 0
							? "None of your states are verified yet, so you can browse cases but not take them on."
							: verifiedCount === admissions.length
								? "Every state you've added is verified."
								: `${verifiedCount} of ${admissions.length} verified. You can only take cases in the verified ones.`}
					</span>
				</p>
			)}
		</div>
	);
}
