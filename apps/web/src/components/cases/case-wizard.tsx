// biome-ignore-all lint/performance/noImgElement: previews are object-URL blobs of user uploads, not static assets next/image can optimize
"use client";

import { US_STATES } from "@just-us/auth/jurisdiction";
import { Button, buttonVariants } from "@just-us/ui/components/button";
import { Input } from "@just-us/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@just-us/ui/components/select";
import { Textarea } from "@just-us/ui/components/textarea";
import { cn } from "@just-us/ui/lib/utils";
import { upload } from "@vercel/blob/client";
import {
	ArrowLeft,
	ArrowRight,
	Check,
	CircleCheck,
	Clock,
	Eye,
	FileText,
	Handshake,
	ImageIcon,
	Landmark,
	Link2,
	Lock,
	Mail,
	Megaphone,
	Pencil,
	Plus,
	RefreshCw,
	Rocket,
	Scale,
	Search,
	Send,
	Sparkles,
	Upload,
	UserPlus,
	Users,
	X,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Fragment, useId, useRef, useState } from "react";
import { toast } from "sonner";

import {
	goLiveAction,
	refreshCasePayoutAction,
} from "@/app/(app)/my-cases/[id]/payout-actions";
import {
	type CasePayoutReadiness,
	commitCaseAction,
	commitCaseWithInviteAction,
	deleteCaseAction,
	publishForAttorneysAction,
	saveCaseDraftAction,
	withdrawInviteAction,
} from "@/app/cases/actions";
import { refineStoryAction, suggestTitlesAction } from "@/app/cases/ai-actions";
import { Brandmark } from "@/components/brandmark";
import { CASE_CATEGORIES } from "@/lib/case-categories";
import { CASE_TITLE_MAX } from "@/lib/case-title";
import { THANK_YOU_MAX } from "@/lib/thank-you-note";

/** A piece of evidence: a document the plaintiff uploaded, or a link they pasted.
 *  Both carry a `url` — a file's is where it is stored, a link's is the address
 *  itself — so `kind` is what tells them apart rather than the shape. */
export type EvidenceItem = {
	name: string;
	size?: number;
	url?: string;
	kind?: "file" | "link";
};

export type WizardInitial = {
	id: string;
	title: string;
	category: string;
	location: string;
	story: string;
	goalCents: number;
	payoutType: string | null;
	attorney: {
		name: string;
		firm: string;
		area: string;
		location: string;
		email: string;
		phone: string;
	} | null;
	evidence: EvidenceItem[];
	coverImageUrl: string | null;
	images: string[];
	/** The plaintiff's thank-you to their donors. Seeded so a resumed case — which
	 *  may have had its note written on the Manage page since — edits the note it
	 *  actually has rather than saving an empty box over it. */
	thankYouNote: string | null;
	/** True when an attorney has already been matched to this case through the
	 *  request/accept flow. The attorney is settled — the representation step shows
	 *  them as confirmed rather than asking to invite one again. */
	attorneyConfirmed?: boolean;
	/** The case's status, so a resumed case knows whether it is still a private
	 *  draft or already committed and waiting on its firm. */
	status?: string;
	/** How far the firm's payout setup has got, when the case is far enough along
	 *  to have one. Seeded from the server so the payout step is right on first
	 *  paint rather than after a round-trip. */
	payout?: CasePayoutReadiness | null;
	/** The address a still-pending invitation went to, when the case is seeking a
	 *  named attorney. Its presence resumes the wizard on the invitation-sent
	 *  "waiting on your attorney" screen rather than the editor — so "Manage
	 *  invitation" shows who was asked and where things stand. */
	invitedEmail?: string | null;
};

type View =
	| "wizard"
	| "preview"
	| "success"
	| "published-attorneys"
	| "invited";
type Attorney = {
	name: string;
	firm: string;
	area: string;
	location: string;
	email?: string;
	phone?: string;
	quote?: string;
};

const STEPS = [
	{ n: 1, label: "Your story" },
	{ n: 2, label: "The basics" },
	{ n: 3, label: "Representation" },
	{ n: 4, label: "Attorney & fee" },
	{ n: 5, label: "Payout setup" },
	{ n: 6, label: "Review & publish" },
] as const;

const LAST_STEP = 6;

const CATEGORIES = CASE_CATEGORIES;

const PAYOUT_TYPES = [
	"Bank transfer (ACH)",
	"Debit card",
	"PayPal",
	"Wire transfer",
];

function money(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

function formatSize(bytes: number) {
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Shape only. The address is proved by the invitation actually arriving, and the
// server re-validates it anyway — this is here so the plaintiff finds a typo on
// the step that owns the field rather than at the point of sending.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmail(value: string) {
	return EMAIL_PATTERN.test(value.trim());
}

function ThinBar({ pct = 0 }: { pct?: number }) {
	return (
		<div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
			<div
				className="h-full rounded-full bg-brass"
				style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
			/>
		</div>
	);
}

export function CaseWizard({
	name,
	initial = null,
}: {
	name: string;
	initial?: WizardInitial | null;
}) {
	const ids = {
		title: useId(),
		story: useId(),
		thankYouNote: useId(),
		fee: useId(),
		manual: useId(),
		manualFirm: useId(),
		manualState: useId(),
		attorneyEmail: useId(),
		attorneyEmailError: useId(),
		attorneyPhone: useId(),
	};
	const firstName = name.trim().split(" ")[0] || "there";

	const knownState = (s: string | undefined | null): s is string =>
		!!s && (US_STATES as readonly string[]).includes(s);
	// Only a saved draft seeds the state. It is deliberately not prefilled from
	// the plaintiff's profile: the state belongs to this case, and a plaintiff
	// running cases in more than one state would get a wrong answer prefilled as
	// if it were confirmed.
	const draftState = initial?.location;
	const seedState = knownState(draftState) ? draftState : "";

	// Resume the furthest step the saved draft supports. A case already committed
	// to its attorney skips to the review — the payout step behind it is a wait,
	// not an input, and it is summarised there anyway.
	const seedStep = (() => {
		if (!initial?.story) return 1;
		if (!initial.title || !initial.location) return 2;
		if (!initial.attorney) return 3;
		if (!initial.goalCents) return 4;
		if (initial.status === "pending_payout") return 6;
		return 5;
	})();
	// A resumed case that is seeking a named attorney (a pending invitation to a
	// specific address) opens on the invitation-sent waiting screen rather than the
	// editor — that is what "Manage invitation" is for. Everything else starts in
	// the wizard proper.
	const seedView: View =
		initial?.status === "seeking" && initial?.invitedEmail
			? "invited"
			: "wizard";
	const [view, setView] = useState<View>(seedView);
	const [step, setStep] = useState(seedStep);

	// The draft row this wizard is bound to (created on first save / publish).
	const [caseId, setCaseId] = useState<string | null>(initial?.id ?? null);
	const [saving, setSaving] = useState(false);
	const [discardOpen, setDiscardOpen] = useState(false);
	const [discarding, setDiscarding] = useState(false);

	// Step 1 — the story
	const [story, setStory] = useState(initial?.story ?? "");
	const [aiRefine, setAiRefine] = useState<
		| { kind: "refined"; text: string }
		| { kind: "need_more"; message: string }
		| null
	>(null);
	const [refining, setRefining] = useState(false);
	const [evidence, setEvidence] = useState<EvidenceItem[]>(
		initial?.evidence ?? [],
	);
	const [linkUrl, setLinkUrl] = useState("");
	// Sent to every donor with their acknowledgement, and editable afterwards from
	// Manage → Edit & settings. Written here so a case that never returns to that
	// page still thanks its donors in the plaintiff's own words.
	const [thankYouNote, setThankYouNote] = useState(initial?.thankYouNote ?? "");

	// Step 2 — the basics
	const [category, setCategory] = useState(initial?.category || "Employment");
	// State (US jurisdiction) prefilled from the draft or from onboarding.
	const [state, setState] = useState(seedState);
	const [title, setTitle] = useState(initial?.title ?? "");
	const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
	const [suggestingTitles, setSuggestingTitles] = useState(false);
	const [coverUrl, setCoverUrl] = useState<string | null>(
		initial?.coverImageUrl ?? null,
	);
	const [moreImages, setMoreImages] = useState<string[]>(initial?.images ?? []);
	const [uploadingCover, setUploadingCover] = useState(false);
	const [uploadingMore, setUploadingMore] = useState(false);
	const [uploadingEvidence, setUploadingEvidence] = useState(false);

	// Step 3 — representation (do you have an attorney?)
	// A matched attorney (accepted from a request) is already settled: the step
	// shows them as confirmed instead of the invite form, unless the plaintiff
	// chooses to change attorney, which drops back into the normal selection.
	const [attorneyConfirmed, setAttorneyConfirmed] = useState(
		initial?.attorneyConfirmed ?? false,
	);
	const [repChoice, setRepChoice] = useState<"have" | "find" | null>(
		initial?.attorney ? "have" : null,
	);
	const [attorney, setAttorney] = useState<Attorney | null>(
		initial?.attorney ?? null,
	);
	const [atName, setAtName] = useState(initial?.attorney?.name ?? "");
	const [atFirm, setAtFirm] = useState(initial?.attorney?.firm ?? "");
	const [atEmail, setAtEmail] = useState(initial?.attorney?.email ?? "");
	// The email error only appears once the plaintiff has been near the field or
	// tried to move on — a required-field error on an untouched form is noise.
	const [atEmailTouched, setAtEmailTouched] = useState(false);
	const [atPhone, setAtPhone] = useState(initial?.attorney?.phone ?? "");

	// Step 4 — the agreed fee
	const [fee, setFee] = useState(
		initial?.goalCents ? (initial.goalCents / 100).toLocaleString("en-US") : "",
	);
	// Payout type isn't captured in the wizard UI (yet); keep the draft's value
	// or default so it still persists on publish.
	const payoutType =
		initial?.payoutType &&
		(PAYOUT_TYPES as readonly string[]).includes(initial.payoutType)
			? initial.payoutType
			: PAYOUT_TYPES[0];
	const [publishing, setPublishing] = useState(false);

	// Step 5 — the firm's payout account for this case.
	//
	// The only step whose outcome the plaintiff does not control. Donations are
	// paid to an account their *attorney* opens per case through Stripe, and the
	// case cannot go public until it can receive — so this step commits the case
	// to the attorney and then reports on someone else's progress.
	const [payout, setPayout] = useState<CasePayoutReadiness | null>(
		initial?.payout ?? null,
	);
	const [committed, setCommitted] = useState(
		initial?.status === "pending_payout",
	);
	const [committing, setCommitting] = useState(false);
	const [checking, setChecking] = useState(false);
	const payoutReady = !!payout?.attorney?.transfersEnabled;

	// The address the invitation went to, for the confirmation screen. Seeded when
	// resuming a case that already has a pending invitation, so "Manage invitation"
	// shows who was asked rather than a blank.
	const [invitedEmail, setInvitedEmail] = useState<string | null>(
		initial?.invitedEmail ?? null,
	);
	// The plaintiff changing their mind on the "waiting" screen: whether the
	// confirm prompt is showing, and whether the withdraw is in flight.
	const [confirmWithdraw, setConfirmWithdraw] = useState(false);
	const [withdrawing, setWithdrawing] = useState(false);

	const coverInput = useRef<HTMLInputElement>(null);
	const moreInput = useRef<HTMLInputElement>(null);
	const evidenceInput = useRef<HTMLInputElement>(null);

	const goal = Number(fee.replace(/[^0-9.]/g, "")) || 0;
	const displayTitle = title.trim() || "Your case title";
	const attorneyName = attorney?.name ?? "your attorney";

	/**
	 * The plaintiff brought this attorney themselves, so nobody has agreed to
	 * anything yet: the case is published as `seeking` and the attorney is emailed
	 * a link to confirm. An attorney who accepted a request is already matched
	 * (`attorneyConfirmed`) and goes straight to payout setup instead.
	 */
	const bringYourOwn = !attorneyConfirmed;
	const atEmailValid = isEmail(atEmail);
	const atEmailError =
		atEmailTouched && !atEmailValid
			? atEmail.trim()
				? "Enter a valid email address."
				: "We need their email. It's where the invitation goes."
			: null;
	// The address as recorded on the case, which is what actually gets invited.
	const inviteEmail = attorney?.email?.trim() ?? "";
	const canSendInvite = isEmail(inviteEmail);
	// One-line hook for cards, derived from the story's first sentence.
	const summary =
		story
			.trim()
			.split(/(?<=[.!?])\s/)[0]
			?.trim() ?? "";

	function next() {
		if (step === 1) {
			if (story.trim().length < 20)
				return toast.error("Tell us what happened to continue.");
		}
		if (step === 2) {
			if (!title.trim()) return toast.error("Add a title for your case.");
			if (!state) return toast.error("Select the state your case is in.");
		}
		if (step === 4) {
			if (!attorney) return toast.error("Add your attorney first.");
			if (!goal) return toast.error("Enter the agreed fee.");
		}
		if (step === 5 && !committed) {
			return toast.error("Send the case to your attorney first.");
		}
		setStep((s) => Math.min(LAST_STEP, s + 1));
		window.scrollTo({ top: 0 });
	}

	function back() {
		if (step === 1) {
			window.location.assign("/home");
			return;
		}
		setStep((s) => Math.max(1, s - 1));
		window.scrollTo({ top: 0 });
	}

	// Drop a confirmed (matched) attorney back into the normal selection so the
	// plaintiff can pick a different one. The existing details stay pre-filled in
	// case they only meant to tweak them.
	function changeAttorney() {
		setAttorneyConfirmed(false);
		setRepChoice("have");
	}

	// Step 3, "Yes, I have an attorney" → record them and move to the fee.
	//
	// The email is required here rather than at the point of sending: it is the
	// only way this attorney can be reached, and a case published without one names
	// somebody who can never confirm it.
	function sendInviteAndContinue() {
		if (!atName.trim()) return toast.error("Add your attorney's full name.");
		if (!atEmailValid) {
			setAtEmailTouched(true);
			return toast.error(
				"Add your attorney's email. That's where the invitation goes.",
			);
		}
		setAttorney({
			name: atName.trim(),
			firm: atFirm.trim() || "Independent",
			area: category,
			// The case's own state, always: representation is gated on the attorney
			// being admitted where the case is, and `commitCaseWithInviteAction`
			// refuses anything else.
			location: state,
			email: atEmail.trim().toLowerCase(),
			phone: atPhone.trim() || undefined,
		});
		toast.success(`We'll invite ${atName.trim().split(" ")[0]} to your case.`);
		setStep(4);
		window.scrollTo({ top: 0 });
	}

	// Step 3, "No, not yet" → publish the case out to attorneys (no fee yet).
	async function publishForAttorneysFlow() {
		if (story.trim().length < 20) {
			toast.error("Add your story before publishing.");
			setStep(1);
			return;
		}
		if (!title.trim() || !state) {
			toast.error("Add a title and state before publishing.");
			setStep(2);
			return;
		}
		setPublishing(true);
		const res = await publishForAttorneysAction({
			id: caseId ?? undefined,
			title: title.trim(),
			category,
			location: state,
			summary: summary || story.trim().slice(0, 140),
			story: story.trim(),
			evidence,
			thankYouNote: thankYouNote.trim() || null,
			coverImageUrl: coverUrl,
			images: moreImages,
		});
		if (res.ok) {
			setCaseId(res.caseId);
			setView("published-attorneys");
			window.scrollTo({ top: 0 });
		} else {
			toast.error(res.error);
			setPublishing(false);
		}
	}

	/**
	 * Everything that must be true before the case leaves the plaintiff's hands.
	 * Sends them back to the step that owns whatever is missing rather than
	 * reporting it where they are standing.
	 */
	function missingEssential(): boolean {
		if (story.trim().length < 20) {
			toast.error("Add your story before publishing.");
			setView("wizard");
			setStep(1);
			return true;
		}
		if (!title.trim() || !state || !coverUrl) {
			toast.error("Add a title, state, and cover image before publishing.");
			setView("wizard");
			setStep(2);
			return true;
		}
		if (!attorney) {
			toast.error("Add your attorney first.");
			setView("wizard");
			setStep(3);
			return true;
		}
		if (!goal) {
			toast.error("Set the agreed fee first.");
			setView("wizard");
			setStep(4);
			return true;
		}
		return false;
	}

	/**
	 * Step 5 — hand the finished case to the attorney so they can open its payout
	 * account. Saves it as `pending_payout`: private, and for the first time
	 * visible to them (drafts are not, which is why this is a distinct act rather
	 * than another autosave).
	 *
	 * Re-run every time the plaintiff leaves this step forward, not just the
	 * first. Once a case is committed the wizard is editing a row that already
	 * exists, so a trip back to change the fee or the story would otherwise be
	 * reviewed and published from stale data. `publishCase` updates in place, so
	 * repeating it is a save, not a second case.
	 */
	async function commitToAttorney() {
		if (missingEssential()) return;

		const advance = committed;
		setCommitting(true);
		const result = await commitCaseAction({
			id: caseId ?? undefined,
			title: title.trim(),
			category,
			location: state,
			summary: summary || story.trim().slice(0, 140),
			story: story.trim(),
			goalCents: Math.round(goal * 100),
			payoutType,
			// biome-ignore lint/style/noNonNullAssertion: missingEssential returned false
			attorney: attorney!,
			evidence,
			thankYouNote: thankYouNote.trim() || null,
			coverImageUrl: coverUrl,
			images: moreImages,
		});
		setCommitting(false);
		if (!result.ok) {
			toast.error(result.error);
			return;
		}
		setCaseId(result.caseId);
		setPayout(result.payout);
		setCommitted(true);
		if (advance) {
			setStep(6);
			window.scrollTo({ top: 0 });
			return;
		}
		if (result.payout.attorney?.transfersEnabled) {
			toast.success(
				`${result.payout.attorney.firmName ?? result.payout.attorney.name} is ready to receive. You can publish.`,
			);
		} else {
			toast.success(
				`Sent to ${attorneyName}. We'll email you when they're set.`,
			);
		}
	}

	/**
	 * Step 5 on the bring-your-own path — publish the case and email the attorney
	 * the plaintiff named.
	 *
	 * The case becomes `seeking`, not `pending_payout`. There is no payout account
	 * to wait on because there is not yet an attorney: the invitation is what turns
	 * a typed name into representation, and only when it is confirmed does the case
	 * move on to the payout step. If it is declined or lapses, the case goes in
	 * front of every other attorney on JustUs without the plaintiff doing anything.
	 */
	async function sendInvitation() {
		if (missingEssential()) return;
		if (!canSendInvite) {
			toast.error("Add your attorney's email so we can send the invitation.");
			setAtEmailTouched(true);
			setRepChoice("have");
			setStep(3);
			window.scrollTo({ top: 0 });
			return;
		}

		setCommitting(true);
		const result = await commitCaseWithInviteAction({
			id: caseId ?? undefined,
			title: title.trim(),
			category,
			location: state,
			summary: summary || story.trim().slice(0, 140),
			story: story.trim(),
			goalCents: Math.round(goal * 100),
			payoutType,
			attorney: {
				name: attorney?.name ?? "",
				firm: attorney?.firm,
				area: attorney?.area,
				location: attorney?.location,
				email: inviteEmail,
				phone: attorney?.phone,
			},
			evidence,
			thankYouNote: thankYouNote.trim() || null,
			coverImageUrl: coverUrl,
			images: moreImages,
		});
		setCommitting(false);

		if (!result.ok) {
			// The case may already exist even though the send failed — keep its id so
			// trying again resends rather than filing the case a second time.
			if (result.caseId) setCaseId(result.caseId);
			toast.error(result.error);
			return;
		}

		setCaseId(result.caseId);
		if (result.kind === "matched") {
			// This case already had an attorney of its own, so it went down the payout
			// path instead and there is nothing to invite. Say so — the step behind
			// this button is the payout account now, not an invitation.
			setAttorneyConfirmed(true);
			setPayout(result.payout);
			setCommitted(true);
			toast.success(
				`Sent to ${attorneyName}. We'll email you when they're set.`,
			);
			return;
		}
		setInvitedEmail(result.email);
		setView("invited");
		window.scrollTo({ top: 0 });
	}

	/** Step 5 — re-check the firm's Stripe progress. It finishes elsewhere (and may
	 *  land without a webhook), so this pulls the account's status straight from
	 *  Stripe rather than re-reading a cache nothing in this browser would update. */
	async function checkPayout() {
		if (!caseId) return;
		setChecking(true);
		const result = await refreshCasePayoutAction({ caseId });
		setChecking(false);
		if (!result.ok) {
			toast.error(result.error);
			return;
		}
		setPayout(result.payout);
		if (result.payout.attorney?.transfersEnabled) {
			toast.success("Your attorney is set up. You can publish now.");
		} else if (!result.payout.attorney) {
			toast.info(
				"No attorney is linked to this case yet. Add one to set up donations.",
			);
		} else {
			toast.info("Checked with Stripe. Their account still can't receive yet.");
		}
	}

	/**
	 * Step 6 — take the case public.
	 *
	 * The case is already saved; this is the `pending_payout` → `live` transition,
	 * which binds the destination and publishes in one server-side act. The button
	 * is disabled unless the firm can receive, and `goLiveCase` re-checks that from
	 * the case row regardless — the disabled button is a courtesy, not the rule.
	 */
	async function publish() {
		if (!caseId) {
			toast.error("Save your case first.");
			setStep(5);
			return;
		}
		setPublishing(true);
		const result = await goLiveAction({ caseId });
		if (result.ok) {
			setView("success");
			window.scrollTo({ top: 0 });
		} else {
			toast.error(result.error);
			setPublishing(false);
			// `goLiveAction` already re-checked Stripe, so refresh the payout state from
			// that same read (silently — the error toast above is the message) and send
			// them to step 5, the only screen that spells out what's outstanding and
			// lets them re-check.
			const refreshed = await refreshCasePayoutAction({ caseId });
			if (refreshed.ok) setPayout(refreshed.payout);
			setStep(5);
		}
	}

	/** Whatever is filled in so far, in the shape the draft action takes. Shared by
	 *  every path that leaves the wizard, so none of them can persist less than
	 *  another. */
	function draftPayload() {
		return {
			id: caseId ?? undefined,
			title: title.trim() || undefined,
			category,
			location: state || undefined,
			summary: summary || undefined,
			story: story.trim() || undefined,
			goalCents: goal ? Math.round(goal * 100) : undefined,
			payoutType,
			attorney,
			evidence,
			// `null` rather than `undefined` when empty: clearing the box has to clear
			// the note, and absent would mean "leave it as it is".
			thankYouNote: thankYouNote.trim() || null,
			coverImageUrl: coverUrl,
			images: moreImages,
		};
	}

	// Persist whatever's filled in as a draft, then head to the dashboard.
	async function saveAndExit() {
		setSaving(true);
		const res = await saveCaseDraftAction(draftPayload());
		if (res.ok) {
			toast.success("Progress saved. Pick up where you left off anytime.");
			window.location.assign("/home");
		} else {
			toast.error(res.error);
			setSaving(false);
		}
	}

	/**
	 * Step 3, "Search and reach out yourself" — leave the wizard for the attorney
	 * directory.
	 *
	 * Saves first, and that is the whole reason this is not a plain link.
	 * Everything typed so far lives in component state, so navigating away
	 * unsaved would lose the story they just wrote — and this is the one branch of
	 * the wizard that deliberately sends them somewhere else. The draft id rides
	 * along in the URL so the directory can offer a way back into it.
	 */
	async function browseDirectory() {
		setSaving(true);
		const res = await saveCaseDraftAction(draftPayload());
		if (!res.ok) {
			toast.error(res.error);
			setSaving(false);
			return;
		}
		window.location.assign(`/find-attorney?draft=${res.caseId}`);
	}

	// Abandon the wizard without saving. If a draft was already persisted (a fresh
	// draft or a resumed one), remove it — deleteCaseAction is draft-only, so a
	// resumed live/seeking case is never deleted, only left as-is.
	async function discard() {
		setDiscarding(true);
		if (caseId) {
			try {
				await deleteCaseAction(caseId);
			} catch {
				// best effort — leave anyway
			}
		}
		window.location.assign("/dashboard/cases");
	}

	// Change of mind on the "waiting" screen: take the invitation back and drop
	// straight onto the attorney step to invite or pick someone else, rather than
	// waiting out the week's expiry. The case returns to a private draft.
	async function chooseDifferentAttorney() {
		if (!caseId) {
			setConfirmWithdraw(false);
			setView("wizard");
			setStep(3);
			return;
		}
		setWithdrawing(true);
		const res = await withdrawInviteAction(caseId);
		setWithdrawing(false);
		if (!res.ok) {
			toast.error(res.error);
			return;
		}
		// Clear the previous choice so the attorney step starts fresh.
		setInvitedEmail(null);
		setAttorney(null);
		setAtName("");
		setAtFirm("");
		setAtEmail("");
		setAtPhone("");
		setAttorneyConfirmed(false);
		setCommitted(false);
		setRepChoice(null);
		setConfirmWithdraw(false);
		setView("wizard");
		setStep(3);
		toast.success("Invitation withdrawn. Choose a different attorney.");
	}

	// Polish the story with OpenAI — facts and voice preserved, clarity improved.
	async function refineWithAI() {
		if (story.trim().length < 20)
			return toast.error("Write a little of your story first.");
		setRefining(true);
		const result = await refineStoryAction(story);
		setRefining(false);
		if (!result.ok) {
			toast.error(result.error);
			return;
		}
		if (result.kind === "need_more") {
			setAiRefine({ kind: "need_more", message: result.message });
			return;
		}
		setAiRefine({ kind: "refined", text: result.text });
	}

	// Ask OpenAI for a few title options drawn from the story.
	async function suggestTitles() {
		if (story.trim().length < 20)
			return toast.error("Add your story first so AI can draft titles.");
		setSuggestingTitles(true);
		const result = await suggestTitlesAction(story);
		setSuggestingTitles(false);
		if (result.ok) setTitleSuggestions(result.titles);
		else toast.error(result.error);
	}

	async function uploadImage(file: File): Promise<string> {
		const blob = await upload(file.name, file, {
			access: "public",
			handleUploadUrl: "/api/cases/upload",
		});
		return blob.url;
	}

	async function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
		const f = e.target.files?.[0];
		if (!f) return;
		setUploadingCover(true);
		try {
			setCoverUrl(await uploadImage(f));
		} catch {
			toast.error("Couldn't upload that image. Please try again.");
		} finally {
			setUploadingCover(false);
		}
	}
	async function onPickMore(e: React.ChangeEvent<HTMLInputElement>) {
		const files = Array.from(e.target.files ?? []).slice(
			0,
			6 - moreImages.length,
		);
		if (!files.length) return;
		setUploadingMore(true);
		try {
			const urls = await Promise.all(files.map(uploadImage));
			setMoreImages((p) => [...p, ...urls].slice(0, 6));
		} catch {
			toast.error("Couldn't upload one of those images. Please try again.");
		} finally {
			setUploadingMore(false);
		}
	}
	/**
	 * Evidence is uploaded, not just noted.
	 *
	 * It used to record a name and a byte count and drop the file on the floor,
	 * which produced a case whose evidence nobody — not the plaintiff, not their
	 * attorney — could ever open. The upload goes to the same Blob route as the
	 * images, tagged so the server applies the document limits rather than the
	 * image ones.
	 *
	 * Each file is added on its own as it lands, so one refusal (too big, wrong
	 * type) doesn't discard the others that succeeded.
	 */
	async function onPickEvidence(e: React.ChangeEvent<HTMLInputElement>) {
		const files = Array.from(e.target.files ?? []);
		if (!files.length) return;
		// Clear the input so re-picking the same file after a failure still fires.
		e.target.value = "";
		setUploadingEvidence(true);
		try {
			await Promise.all(
				files.map(async (file) => {
					try {
						const blob = await upload(file.name, file, {
							access: "public",
							handleUploadUrl: "/api/cases/upload",
							clientPayload: "evidence",
						});
						setEvidence((p) => [
							...p,
							{
								name: file.name,
								size: file.size,
								url: blob.url,
								kind: "file",
							},
						]);
					} catch {
						toast.error(`Couldn't upload ${file.name}. Please try again.`);
					}
				}),
			);
		} finally {
			setUploadingEvidence(false);
		}
	}

	function addLink() {
		let url = linkUrl.trim();
		if (!url) return;
		// Be forgiving — prefix a scheme so "example.com/doc" is accepted.
		if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
		try {
			const parsed = new URL(url);
			if (evidence.some((e) => e.url === parsed.href)) {
				toast.error("That link is already added.");
				return;
			}
			setEvidence((p) => [
				...p,
				{ name: parsed.hostname, url: parsed.href, kind: "link" },
			]);
			setLinkUrl("");
		} catch {
			toast.error("Enter a valid link (e.g. https://…).");
		}
	}

	// The public page for the case just published. `/cases` (the directory) was
	// being copied instead — a link to the browse page, not the campaign, so
	// backers landed on a list rather than the case they were sent.
	function caseShareUrl() {
		if (typeof window === "undefined" || !caseId) return "";
		return `${window.location.origin}/cases/${caseId}`;
	}

	function copyLink() {
		const url = caseShareUrl();
		if (!url) return;
		navigator.clipboard?.writeText(url);
		toast.success("Link copied to clipboard.");
	}

	// ─────────────────────────── Invitation-sent confirmation
	//
	// The end of the bring-your-own path. The case is saved and private, and the
	// only outstanding question is one the plaintiff cannot answer — so this screen
	// says who was asked, and what happens on either answer.
	if (view === "invited") {
		return (
			<div className="h-svh overflow-y-auto bg-surface px-6 py-16">
				<div className="mx-auto max-w-[620px] text-center">
					<div className="relative mx-auto mb-6 flex size-[92px] items-center justify-center">
						<span
							aria-hidden="true"
							className="absolute inset-0 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--brass)_28%,transparent),transparent_70%)]"
						/>
						<span className="relative flex size-16 items-center justify-center rounded-full bg-brass text-white">
							<Mail className="size-7" aria-hidden="true" />
						</span>
					</div>
					<p className="mb-3 font-mono font-semibold text-[12px] text-brass-deep uppercase tracking-[0.14em]">
						Invitation sent
					</p>
					<h1 className="font-extrabold text-[clamp(1.875rem,3.6vw,2.75rem)] text-ink tracking-[-0.03em]">
						We've emailed {attorneyName}
					</h1>
					<p className="mx-auto mt-3 max-w-[460px] text-[15px] text-ink-soft leading-relaxed">
						{invitedEmail} has a link to confirm they represent you on this
						case. Nothing is attached to your case until they do.
					</p>

					<div className="mt-8 flex items-center justify-between gap-3 rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 text-left shadow-[var(--shadow-rest)]">
						<div className="min-w-0">
							<p className="truncate font-bold text-[15px] text-ink">
								{displayTitle}
							</p>
							<p className="mt-0.5 text-[12.5px] text-muted-foreground">
								{category} · {state || "—"} · goal {money(goal)}
							</p>
						</div>
						<span className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] bg-brass-wash px-3 py-1 font-mono font-semibold text-[11px] text-brass-deep uppercase tracking-[0.06em]">
							<Clock className="size-3" aria-hidden="true" />
							Awaiting reply
						</span>
					</div>

					<div className="mt-6 flex flex-col gap-3 rounded-[var(--radius-card-lg)] bg-surface-2 p-5 text-left">
						<p className="font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.1em]">
							What happens next
						</p>
						<p className="flex gap-2.5 text-[13.5px] text-ink-soft leading-relaxed">
							<CircleCheck
								className="mt-0.5 size-4 shrink-0 text-success"
								aria-hidden="true"
							/>
							<span>
								<span className="font-semibold text-ink">If they confirm</span>:{" "}
								they're attached to your case and open its payout account. You
								publish once it can receive.
							</span>
						</p>
						<p className="flex gap-2.5 text-[13.5px] text-ink-soft leading-relaxed">
							<Users
								className="mt-0.5 size-4 shrink-0 text-brass-deep"
								aria-hidden="true"
							/>
							<span>
								<span className="font-semibold text-ink">
									If they decline, or don't answer
								</span>
								: your case goes in front of bar-verified attorneys on JustUs,
								who can request to represent you. Nothing to do on your side.
							</span>
						</p>
					</div>

					<div className="mt-6 flex items-center justify-center gap-2.5">
						<Link
							href={(caseId ? `/my-cases/${caseId}` : "/my-cases") as Route}
							className={cn(buttonVariants({ size: "lg" }), "px-5")}
						>
							Go to my case
							<ArrowRight data-icon="inline-end" aria-hidden="true" />
						</Link>
						<Link
							href="/home"
							className={cn(
								buttonVariants({ variant: "outline", size: "lg" }),
								"px-5",
							)}
						>
							Back to dashboard
						</Link>
					</div>

					{/* Change of mind: the plaintiff doesn't have to wait out the week if
					    the invitee is slow or they'd rather approach someone else. */}
					{confirmWithdraw ? (
						<div className="mx-auto mt-6 max-w-[440px] rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 text-left shadow-[var(--shadow-rest)]">
							<p className="text-[13.5px] text-ink leading-relaxed">
								Withdraw this invitation and choose someone else?{" "}
								<span className="font-semibold">{attorneyName}</span>'s link
								will stop working, and your case goes back to a private draft
								you can send to a new attorney.
							</p>
							<div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
								<Button
									variant="outline"
									onClick={() => setConfirmWithdraw(false)}
									disabled={withdrawing}
								>
									Keep waiting
								</Button>
								<Button
									className="bg-green-deep text-white hover:bg-green-deep/90"
									onClick={chooseDifferentAttorney}
									disabled={withdrawing}
								>
									{withdrawing ? "Withdrawing…" : "Withdraw & choose another"}
								</Button>
							</div>
						</div>
					) : (
						<button
							type="button"
							onClick={() => setConfirmWithdraw(true)}
							className="mt-5 font-semibold text-[13px] text-brass-deep underline underline-offset-2 transition-colors hover:text-brass"
						>
							Changed your mind? Choose a different attorney
						</button>
					)}

					<p className="mt-5 flex items-center justify-center gap-1.5 text-[12.5px] text-muted-foreground">
						<Lock className="size-3.5" aria-hidden="true" />
						Your case stays private while you wait. Nobody can see it or give to
						it yet.
					</p>
				</div>
			</div>
		);
	}

	// ─────────────────────────── Published-to-attorneys confirmation
	if (view === "published-attorneys") {
		return (
			<div className="h-svh overflow-y-auto bg-surface px-6 py-16">
				<div className="mx-auto max-w-[620px] text-center">
					<div className="relative mx-auto mb-6 flex size-[92px] items-center justify-center">
						<span
							aria-hidden="true"
							className="absolute inset-0 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--brass)_28%,transparent),transparent_70%)]"
						/>
						<span className="relative flex size-16 items-center justify-center rounded-full bg-brass text-white">
							<Megaphone className="size-7" aria-hidden="true" />
						</span>
					</div>
					<p className="mb-3 font-mono font-semibold text-[12px] text-brass-deep uppercase tracking-[0.14em]">
						Published to attorneys
					</p>
					<h1 className="font-extrabold text-[clamp(1.875rem,3.6vw,2.75rem)] text-ink tracking-[-0.03em]">
						Your case is out to attorneys
					</h1>
					<p className="mx-auto mt-3 max-w-[460px] text-[15px] text-ink-soft leading-relaxed">
						Bar-listed attorneys on JustUs can now review your case and request
						to represent you. You decide who takes it on.
					</p>

					<div className="mt-8 flex items-center justify-between gap-3 rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 text-left shadow-[var(--shadow-rest)]">
						<div className="min-w-0">
							<p className="truncate font-bold text-[15px] text-ink">
								{displayTitle}
							</p>
							<p className="mt-0.5 text-[12.5px] text-muted-foreground">
								{category} · {state || "—"} · 0 requests yet · published just
								now
							</p>
						</div>
						<span className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] bg-green-soft px-3 py-1 font-mono font-semibold text-[11px] text-green-deep uppercase tracking-[0.06em]">
							<span className="size-1.5 rounded-full bg-success" />
							Visible to attorneys only
						</span>
					</div>

					<ol className="mt-6 flex items-center gap-2 text-[12.5px]">
						{[
							{ label: "Published", done: true },
							{ label: "Requests", done: false },
							{ label: "You choose", done: false },
							{ label: "Live", done: false },
						].map((s, i, arr) => (
							<Fragment key={s.label}>
								<li className="inline-flex shrink-0 items-center gap-1.5">
									{s.done ? (
										<CircleCheck
											className="size-4 text-success"
											aria-hidden="true"
										/>
									) : (
										<span className="size-3.5 rounded-full border border-line-strong" />
									)}
									<span
										className={
											s.done
												? "font-semibold text-ink"
												: "text-muted-foreground"
										}
									>
										{s.label}
									</span>
								</li>
								{i < arr.length - 1 && (
									<span className="h-px flex-1 bg-border" aria-hidden="true" />
								)}
							</Fragment>
						))}
					</ol>

					<div className="mt-6 flex items-center justify-between gap-3 rounded-[var(--radius-card-sm)] bg-brass-wash/50 px-4 py-3 text-left text-[13px] text-ink-soft">
						<span className="inline-flex items-center gap-2">
							<Search className="size-4 text-brass-deep" aria-hidden="true" />
							Don't want to wait? Reach out to attorneys yourself.
						</span>
						<Link
							href={
								(caseId
									? `/find-attorney?draft=${caseId}`
									: "/find-attorney") as Route
							}
							className="shrink-0 font-semibold text-brass-deep hover:underline"
						>
							Search →
						</Link>
					</div>

					<div className="mt-6 flex items-center justify-center gap-2.5">
						<Link
							href={
								(caseId ? `/my-cases/${caseId}/requests` : "/my-cases") as Route
							}
							className={cn(buttonVariants({ size: "lg" }), "px-5")}
						>
							Go to my case
							<ArrowRight data-icon="inline-end" aria-hidden="true" />
						</Link>
						<Link
							href="/home"
							className={cn(
								buttonVariants({ variant: "outline", size: "lg" }),
								"px-5",
							)}
						>
							Back to dashboard
						</Link>
					</div>

					<p className="mt-5 flex items-start justify-center gap-1.5 text-[12.5px] text-muted-foreground">
						<Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
						<span>
							Attorneys reply on their own time, usually a few days. We'll email
							you the moment someone requests your case.
						</span>
					</p>
				</div>
			</div>
		);
	}

	// ─────────────────────────────────────────── Success view
	if (view === "success") {
		return (
			<div className="h-svh overflow-y-auto bg-surface px-6 py-16">
				<div className="mx-auto max-w-[620px] text-center">
					<div className="relative mx-auto mb-6 flex size-[92px] items-center justify-center">
						<span
							aria-hidden="true"
							className="absolute inset-0 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--brass)_28%,transparent),transparent_70%)]"
						/>
						<span className="relative flex size-16 items-center justify-center rounded-full bg-brass text-white">
							<Rocket className="size-7" aria-hidden="true" />
						</span>
					</div>
					<p className="mb-3 font-mono font-semibold text-[12px] text-brass-deep uppercase tracking-[0.14em]">
						Your campaign is live
					</p>
					<h1 className="font-extrabold text-[clamp(1.875rem,3.6vw,2.75rem)] text-ink tracking-[-0.03em]">
						You're one step closer to justice.
					</h1>
					<p className="mx-auto mt-3 max-w-[460px] text-[15px] text-ink-soft leading-relaxed">
						Your case is live and ready for backers, {firstName}. Share it far
						and wide. Every gift brings your day in court closer.
					</p>

					<div className="mt-8 rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 text-left shadow-[var(--shadow-rest)]">
						<div className="mb-2 flex items-center justify-between">
							<span className="inline-flex items-center gap-1.5 font-mono font-semibold text-[11px] text-success uppercase tracking-[0.08em]">
								<span className="size-1.5 rounded-full bg-success" />
								Live now
							</span>
							<span className="font-semibold text-[13px] text-ink tabular-nums">
								{money(0)} of {money(goal)}
							</span>
						</div>
						<p className="mb-2.5 font-bold text-[15px] text-ink">
							{displayTitle}
						</p>
						<ThinBar pct={0} />
						<p className="mt-2.5 text-[12.5px] text-muted-foreground">
							with {attorneyName} · 0 donors
						</p>
					</div>

					<p className="mt-8 mb-3 text-[13px] text-muted-foreground">
						Share to get your first backers
					</p>
					<div className="flex items-center justify-center gap-2.5">
						<button
							type="button"
							onClick={copyLink}
							className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-surface px-4 font-semibold text-[13.5px] text-ink transition-colors hover:border-line-strong"
						>
							<Link2 className="size-4" aria-hidden="true" />
							Copy link
						</button>
					</div>

					<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
						<Link
							href={(caseId ? `/my-cases/${caseId}` : "/my-cases") as Route}
							className={cn(buttonVariants({ size: "lg" }), "px-6")}
						>
							<ArrowRight data-icon="inline-start" aria-hidden="true" />
							Manage your case
						</Link>
						<Link
							href={"/my-cases" as Route}
							className={cn(
								buttonVariants({ variant: "outline", size: "lg" }),
								"px-6",
							)}
						>
							Back to my cases
						</Link>
					</div>
				</div>
			</div>
		);
	}

	// ─────────────────────────────────────────── Preview view
	if (view === "preview") {
		return (
			<div className="h-svh overflow-y-auto bg-surface">
				{/* Preview chrome */}
				<div className="sticky top-0 z-20 flex items-center justify-between gap-4 bg-dark px-6 py-3 text-dark-fg sm:px-10">
					<div className="flex items-center gap-2.5">
						<Eye className="size-4 text-brass-on-dark" aria-hidden="true" />
						<div className="leading-tight">
							<p className="font-mono font-semibold text-[11px] text-brass-on-dark uppercase tracking-[0.12em]">
								Preview mode
							</p>
							<p className="text-[12px] text-dark-fg-soft">
								Only you can see this. Your case isn't live yet.
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2.5">
						<Button
							variant="outline"
							size="sm"
							className="h-9 border-dark-fg/20 bg-transparent px-3.5 text-dark-fg hover:bg-dark-fg/10 hover:text-dark-fg"
							onClick={() => {
								setView("wizard");
								setStep(4);
							}}
						>
							<Pencil data-icon="inline-start" aria-hidden="true" />
							Back to editing
						</Button>
						<Button
							size="sm"
							className="h-9 px-3.5"
							onClick={publish}
							// Same behaviour as the review step's button — the preview is a
							// second door onto the same act: pressing it re-checks Stripe and
							// publishes if the firm can now receive.
							disabled={publishing}
							title={
								payoutReady
									? undefined
									: "Re-check the firm's payout account and publish if it's ready"
							}
						>
							<Rocket data-icon="inline-start" aria-hidden="true" />
							{publishing
								? "Publishing…"
								: payoutReady
									? "Publish case"
									: "Check & publish"}
						</Button>
					</div>
				</div>

				<div className="mx-auto grid max-w-[1100px] gap-10 px-6 py-10 sm:px-10 lg:grid-cols-[1.5fr_0.9fr]">
					<div>
						<div className="mb-3 flex flex-wrap gap-2">
							<span className="rounded-[var(--radius-chip)] bg-brass-wash px-2.5 py-1 font-semibold text-[12px] text-brass-deep">
								{category}
							</span>
							<span className="rounded-[var(--radius-chip)] border border-border px-2.5 py-1 text-[12px] text-ink-soft">
								{state}
							</span>
						</div>
						<h1 className="font-extrabold text-[clamp(1.75rem,3.4vw,2.5rem)] text-ink leading-[1.05] tracking-[-0.03em]">
							{displayTitle}
						</h1>
						<div className="mt-3 flex items-center gap-2.5 text-[14px]">
							<span className="flex size-7 items-center justify-center rounded-full bg-success font-bold text-[11px] text-white">
								{firstName.slice(0, 2).toUpperCase()}
							</span>
							<span className="font-semibold text-ink">{firstName} M.</span>
							{attorney && (
								<span className="text-muted-foreground">
									· with {attorney.name}, Esq.
								</span>
							)}
						</div>

						<div className="mt-6 aspect-[16/9] overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface-2">
							{coverUrl ? (
								<img
									src={coverUrl}
									alt={displayTitle}
									className="size-full object-cover"
								/>
							) : (
								<div className="flex size-full items-center justify-center text-muted-foreground">
									<ImageIcon className="size-8" aria-hidden="true" />
								</div>
							)}
						</div>

						<h2 className="mt-8 mb-2 font-bold text-ink text-lg">The story</h2>
						<div className="space-y-3 text-[14.5px] text-ink-soft leading-relaxed">
							{(story.trim() || "Your story will appear here.")
								.split("\n")
								.filter(Boolean)
								.map((para: string) => (
									<p key={para.slice(0, 24)}>{para}</p>
								))}
						</div>

						<h2 className="mt-8 mb-3 font-bold text-ink text-lg">
							Case updates
						</h2>
						<div className="flex flex-col items-center gap-1.5 rounded-[var(--radius-card-lg)] border border-border border-dashed bg-surface/50 px-6 py-10 text-center">
							<Megaphone
								className="size-6 text-muted-foreground"
								aria-hidden="true"
							/>
							<p className="font-bold text-[14px] text-ink">No updates yet</p>
							<p className="max-w-[42ch] text-[13px] text-muted-foreground leading-relaxed">
								Your attorney posts updates here as the case moves. Every backer
								gets notified.
							</p>
						</div>

						<h2 className="mt-8 mb-3 font-bold text-ink text-lg">
							Represented by
						</h2>
						<div className="flex items-center gap-3.5 rounded-[var(--radius-card-lg)] border border-border bg-surface p-5">
							<span className="flex size-11 items-center justify-center rounded-full bg-brass font-bold text-[13px] text-white">
								{(attorney?.name ?? "N A")
									.split(" ")
									.map((w) => w[0])
									.join("")
									.slice(0, 2)}
							</span>
							<div>
								<p className="font-bold text-[15px] text-ink">
									{attorney ? `${attorney.name}, Esq.` : "No attorney yet"}
								</p>
								<p className="text-[13px] text-muted-foreground">
									{attorney
										? `${attorney.firm} · ${attorney.area} · ${attorney.location}`
										: "Connect with your attorney in the previous step."}
								</p>
							</div>
						</div>
					</div>

					{/* Sidebar */}
					<aside className="lg:sticky lg:top-24 lg:self-start">
						<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
							<p className="font-extrabold text-[32px] text-ink tracking-[-0.02em]">
								{money(0)}
							</p>
							<p className="mb-3 text-[13px] text-muted-foreground">
								raised of {money(goal)} goal
							</p>
							<ThinBar pct={0} />
							<p className="mt-3 mb-4 text-[13px] text-ink-soft">
								0 donors · just launched
							</p>
							<Button size="lg" className="w-full">
								<Handshake data-icon="inline-start" aria-hidden="true" />
								Support this case
							</Button>
							<Button variant="outline" size="lg" className="mt-2.5 w-full">
								<Link2 data-icon="inline-start" aria-hidden="true" />
								Share
							</Button>
						</div>
						<ul className="mt-4 flex flex-col gap-3 rounded-[var(--radius-card-lg)] border border-border bg-surface/60 p-5">
							<li className="flex items-center gap-2.5 text-[13px] text-ink-soft">
								<Handshake
									className="size-4 shrink-0 text-brass-deep"
									aria-hidden="true"
								/>
								You chose your own attorney
							</li>
							<li className="flex items-center gap-2.5 text-[13px] text-ink-soft">
								<Lock
									className="size-4 shrink-0 text-brass-deep"
									aria-hidden="true"
								/>
								Funds go straight to your attorney's firm
							</li>
							<li className="flex items-center gap-2.5 text-[13px] text-ink-soft">
								<Eye
									className="size-4 shrink-0 text-brass-deep"
									aria-hidden="true"
								/>
								One 5% fee, shown upfront
							</li>
						</ul>
					</aside>
				</div>
			</div>
		);
	}

	// ─────────────────────────────────────────── Wizard view
	const inputClass =
		"h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[14px]";

	return (
		<div className="flex h-svh overflow-hidden bg-surface">
			{/* Sidebar — fixed full height, never scrolls */}
			<aside className="hidden h-full w-[320px] shrink-0 flex-col justify-between overflow-hidden border-border border-r bg-surface px-7 py-6 lg:flex">
				<div>
					<div className="mb-8 flex items-center gap-2.5">
						<Brandmark size={30} />
						<span className="font-bold text-[15px] tracking-tight">JustUs</span>
					</div>
					<p className="mb-4 font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.12em]">
						Create your case
					</p>
					<ol className="flex flex-col gap-1">
						{STEPS.map((s) => {
							const state =
								step === s.n ? "active" : step > s.n ? "done" : "todo";
							// Completed steps are clickable to jump back; you can't skip
							// ahead (that would bypass each step's validation).
							const clickable = state === "done";
							return (
								<li key={s.n}>
									<button
										type="button"
										onClick={() => clickable && setStep(s.n)}
										disabled={!clickable}
										aria-current={state === "active" ? "step" : undefined}
										className={cn(
											"flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-left text-[14px] transition-colors",
											state === "active"
												? "bg-brass-wash font-bold text-ink"
												: "font-medium text-ink-soft",
											clickable && "cursor-pointer hover:bg-surface-2",
										)}
									>
										<span
											className={cn(
												"flex size-6 shrink-0 items-center justify-center rounded-full text-[12px]",
												state === "done" && "bg-success text-white",
												state === "active" && "bg-brass font-bold text-white",
												state === "todo" &&
													"border border-line-strong text-muted-foreground",
											)}
										>
											{state === "done" ? (
												<Check className="size-3.5" aria-hidden="true" />
											) : (
												s.n
											)}
										</span>
										{s.n === 5 && bringYourOwn ? "Send invitation" : s.label}
									</button>
								</li>
							);
						})}
					</ol>
				</div>
				<div className="flex flex-col gap-3">
					<button
						type="button"
						onClick={saveAndExit}
						disabled={saving || discarding}
						className="flex items-center gap-2 font-medium text-[13px] text-muted-foreground transition-colors hover:text-ink disabled:opacity-60"
					>
						<ArrowLeft className="size-4" aria-hidden="true" />
						{saving ? "Saving…" : "Save & exit"}
					</button>
					<button
						type="button"
						onClick={() => setDiscardOpen(true)}
						disabled={saving || discarding}
						className="flex items-center gap-2 font-medium text-[13px] text-danger/80 transition-colors hover:text-danger disabled:opacity-60"
					>
						<X className="size-4" aria-hidden="true" />
						Discard case
					</button>
				</div>
			</aside>

			{/* Main — only this column scrolls */}
			<div className="flex min-h-0 min-w-0 flex-1 flex-col bg-paper">
				<main className="min-h-0 flex-1 overflow-y-auto px-6 py-10 sm:px-12">
					<div className="mx-auto max-w-[720px]">
						{/* The step sidebar (Save & exit / Discard) is hidden below lg, so
						    surface those actions here on mobile — otherwise there's no way
						    out of the wizard but Back. */}
						<div className="mb-6 flex items-center justify-between gap-3 lg:hidden">
							<button
								type="button"
								onClick={saveAndExit}
								disabled={saving || discarding}
								className="flex items-center gap-1.5 font-semibold text-[13px] text-ink-soft transition-colors hover:text-ink disabled:opacity-60"
							>
								<ArrowLeft className="size-4" aria-hidden="true" />
								{saving ? "Saving…" : "Save & exit"}
							</button>
							<button
								type="button"
								onClick={() => setDiscardOpen(true)}
								disabled={saving || discarding}
								className="flex items-center gap-1.5 font-semibold text-[13px] text-danger/80 transition-colors hover:text-danger disabled:opacity-60"
							>
								<X className="size-4" aria-hidden="true" />
								Discard
							</button>
						</div>
						<p className="mb-2 font-mono font-semibold text-[12px] text-brass-deep uppercase tracking-[0.1em]">
							Step {step} of {LAST_STEP}
						</p>

						{step === 2 && (
							<>
								<h1 className="font-extrabold text-[clamp(1.75rem,3vw,2.375rem)] text-ink tracking-[-0.03em]">
									Now, the basics.
								</h1>
								<p className="mt-2.5 max-w-[560px] text-[15px] text-ink-soft leading-relaxed">
									A category, the state your case is in, a title, and photos. AI
									can draft a title from your story. Pick one or write your own.
								</p>

								<div className="mt-8 flex flex-col gap-6">
									<div className="grid gap-5 sm:grid-cols-2">
										<Field label="Category">
											<Select
												value={category}
												onValueChange={(v: string | null) =>
													setCategory(v ?? "Employment")
												}
											>
												<SelectTrigger className="h-11 bg-surface text-[14px]">
													<SelectValue placeholder="Select a category" />
												</SelectTrigger>
												<SelectContent>
													{CATEGORIES.map((c) => (
														<SelectItem
															key={c}
															value={c}
															className="text-[14px]"
														>
															{c}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</Field>
										<Field label="State" hint="Prefilled from your onboarding">
											<Select
												value={state}
												onValueChange={(v: string | null) => setState(v ?? "")}
											>
												<SelectTrigger className="h-11 bg-surface text-[14px]">
													<SelectValue placeholder="Select your state" />
												</SelectTrigger>
												<SelectContent className="max-h-[300px]">
													{US_STATES.map((s) => (
														<SelectItem
															key={s}
															value={s}
															className="text-[14px]"
														>
															{s}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</Field>
									</div>

									<div className="flex flex-col gap-1.5">
										<div className="flex items-center justify-between gap-2">
											<label
												htmlFor={ids.title}
												className="font-semibold text-[13px] text-ink"
											>
												Case title
											</label>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-7"
												onClick={suggestTitles}
												disabled={suggestingTitles}
											>
												<Sparkles data-icon="inline-start" aria-hidden="true" />
												{suggestingTitles ? "Thinking…" : "Suggest titles"}
											</Button>
										</div>
										<Input
											id={ids.title}
											className={inputClass}
											value={title}
											onChange={(e) => setTitle(e.target.value)}
											maxLength={CASE_TITLE_MAX}
											placeholder="Write your own, or use an AI suggestion below"
										/>
										<p className="mt-1 text-right text-[12px] text-muted-foreground">
											{title.length}/{CASE_TITLE_MAX}
										</p>
										{titleSuggestions.length > 0 && (
											<div className="mt-1.5 flex flex-col gap-1.5">
												{titleSuggestions.map((t) => (
													<button
														key={t}
														type="button"
														onClick={() => setTitle(t)}
														className={cn(
															"flex items-center gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-left text-[13.5px] transition-colors",
															title === t
																? "border-brass bg-brass-wash text-ink"
																: "border-border bg-surface text-ink-soft hover:border-brass-deep",
														)}
													>
														<Sparkles
															className="size-3.5 shrink-0 text-brass-deep"
															aria-hidden="true"
														/>
														{t}
													</button>
												))}
											</div>
										)}
									</div>

									<div>
										<p className="mb-1.5 font-semibold text-[13px] text-ink">
											Cover image<span className="ml-0.5 text-danger">*</span>
										</p>
										<button
											type="button"
											onClick={() => coverInput.current?.click()}
											disabled={uploadingCover}
											className="flex w-full flex-col items-center gap-2 rounded-[var(--radius-card-lg)] border border-line-strong border-dashed bg-surface px-6 py-10 text-center transition-colors hover:border-brass hover:border-solid hover:ring-1 hover:ring-brass disabled:opacity-70"
										>
											{uploadingCover ? (
												<>
													<span className="flex size-11 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
														<Upload
															className="size-5 animate-pulse"
															aria-hidden="true"
														/>
													</span>
													<span className="font-bold text-[14px] text-ink">
														Uploading…
													</span>
												</>
											) : coverUrl ? (
												<img
													src={coverUrl}
													alt="Cover preview"
													className="max-h-40 rounded-[var(--radius-card-sm)] object-contain"
												/>
											) : (
												<>
													<span className="flex size-11 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
														<ImageIcon className="size-5" aria-hidden="true" />
													</span>
													<span className="font-bold text-[14px] text-ink">
														Add a cover image
													</span>
													<span className="text-[12.5px] text-muted-foreground">
														Drag &amp; drop or browse · JPG or PNG · 1600×900
														recommended
													</span>
												</>
											)}
										</button>
										<input
											ref={coverInput}
											type="file"
											accept="image/*"
											hidden
											onChange={onPickCover}
										/>
									</div>

									<div>
										<p className="font-semibold text-[13px] text-ink">
											More images{" "}
											<span className="font-normal text-muted-foreground">
												· optional
											</span>
										</p>
										<p className="mt-0.5 mb-3 text-[12.5px] text-muted-foreground">
											Add up to 6 photos or scans that help tell your story.
										</p>
										<div className="flex flex-wrap gap-3">
											{moreImages.map((url) => (
												<div
													key={url}
													className="relative size-[92px] overflow-hidden rounded-[var(--radius-card-sm)] border border-border"
												>
													<img
														src={url}
														alt="Case attachment"
														className="size-full object-cover"
													/>
													<button
														type="button"
														aria-label="Remove image"
														onClick={() =>
															setMoreImages((p) => p.filter((u) => u !== url))
														}
														className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-ink/70 text-white"
													>
														<X className="size-3" aria-hidden="true" />
													</button>
												</div>
											))}
											{uploadingMore && (
												<div className="flex size-[92px] flex-col items-center justify-center gap-1 rounded-[var(--radius-card-sm)] border border-line-strong border-dashed bg-surface text-muted-foreground">
													<Upload
														className="size-5 animate-pulse"
														aria-hidden="true"
													/>
													<span className="text-[11px]">Uploading…</span>
												</div>
											)}
											{moreImages.length < 6 && !uploadingMore && (
												<button
													type="button"
													onClick={() => moreInput.current?.click()}
													className="flex size-[92px] flex-col items-center justify-center gap-1 rounded-[var(--radius-card-sm)] border border-line-strong border-dashed bg-surface text-muted-foreground transition-colors hover:border-brass hover:border-solid hover:text-ink hover:ring-1 hover:ring-brass"
												>
													<Plus className="size-5" aria-hidden="true" />
													<span className="text-[12px]">Add</span>
												</button>
											)}
										</div>
										<input
											ref={moreInput}
											type="file"
											accept="image/*"
											multiple
											hidden
											onChange={onPickMore}
										/>
										<p className="mt-4 text-[12.5px] text-muted-foreground">
											<span className="text-danger">*</span> Required to publish
											your case
										</p>
									</div>
								</div>
							</>
						)}

						{step === 1 && (
							<>
								<h1 className="font-extrabold text-[clamp(1.75rem,3vw,2.375rem)] text-ink tracking-[-0.03em]">
									What happened?
								</h1>
								<p className="mt-2.5 max-w-[560px] text-[15px] text-ink-soft leading-relaxed">
									Tell it in your own words. This is the heart of your case. Be
									specific about who, what, and when. You can edit it anytime
									before publishing.
								</p>

								<div className="mt-8 flex flex-col gap-6">
									<div>
										<p className="mb-1.5 font-semibold text-[13px] text-ink">
											Your story
										</p>
										<div className="rounded-[var(--radius-card-lg)] border border-line-strong bg-surface p-1.5">
											<Textarea
												id={ids.story}
												value={story}
												onChange={(e) => setStory(e.target.value)}
												placeholder="Start with what happened and how it affected you. Include dates, names, and anything you can back up with evidence…"
												className="min-h-[130px] rounded-[var(--radius-card-sm)] border-0 bg-transparent px-3 py-2.5 text-[14px] focus-visible:ring-0"
											/>
											<div className="flex items-center justify-between px-2 pt-1 pb-1.5">
												<span className="text-[12px] text-muted-foreground">
													AI keeps your facts &amp; your voice
												</span>
												<Button
													type="button"
													variant="secondary"
													size="sm"
													className="h-8"
													onClick={refineWithAI}
													disabled={refining}
												>
													<Sparkles
														data-icon="inline-start"
														aria-hidden="true"
													/>
													{refining ? "Refining…" : "Refine with AI"}
												</Button>
											</div>
										</div>
									</div>

									{aiRefine?.kind === "need_more" && (
										<div className="rounded-[var(--radius-card-lg)] border border-line-strong bg-surface p-5">
											<div className="mb-3 flex items-center gap-2.5">
												<span className="flex size-8 items-center justify-center rounded-lg bg-brass text-white">
													<Sparkles className="size-4" aria-hidden="true" />
												</span>
												<span className="font-bold text-[14px] text-ink">
													Need a bit more detail
												</span>
											</div>
											<p className="text-[14px] text-ink leading-relaxed">
												{aiRefine.message}
											</p>
											<div className="mt-4 flex flex-wrap gap-2.5">
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="h-9"
													onClick={() => setAiRefine(null)}
												>
													Got it
												</Button>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="h-9"
													onClick={refineWithAI}
													disabled={refining}
												>
													Try again
												</Button>
											</div>
											<p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">
												Add more of what happened in your own words, then refine
												again. AI won&apos;t invent details for you.
											</p>
										</div>
									)}

									{aiRefine?.kind === "refined" && (
										<div className="rounded-[var(--radius-card-lg)] border border-brass bg-brass-wash/40 p-5">
											<div className="mb-3 flex items-center gap-2.5">
												<span className="flex size-8 items-center justify-center rounded-lg bg-brass text-white">
													<Sparkles className="size-4" aria-hidden="true" />
												</span>
												<span className="font-bold text-[14px] text-ink">
													AI suggestion
												</span>
												<span className="rounded-[var(--radius-chip)] border border-brass-deep/40 px-2 py-0.5 font-mono font-semibold text-[10px] text-brass-deep uppercase tracking-[0.08em]">
													AI-generated
												</span>
											</div>
											<p className="text-[14px] text-ink leading-relaxed">
												“{aiRefine.text}”
											</p>
											<div className="mt-4 flex flex-wrap gap-2.5">
												<Button
													type="button"
													size="sm"
													className="h-9"
													onClick={() => {
														setStory(aiRefine.text);
														setAiRefine(null);
														toast.success("Applied the refined version.");
													}}
												>
													<Check data-icon="inline-start" aria-hidden="true" />
													Use this version
												</Button>
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="h-9"
													onClick={() => setAiRefine(null)}
												>
													Keep mine
												</Button>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="h-9"
													onClick={refineWithAI}
													disabled={refining}
												>
													Try again
												</Button>
											</div>
											<p className="mt-3 text-[12px] text-muted-foreground leading-relaxed">
												AI only tightens clarity and structure. Your facts and
												voice stay yours. Nothing changes until you accept.
											</p>
										</div>
									)}

									<div>
										<p className="mb-1.5 font-semibold text-[13px] text-ink">
											Evidence{" "}
											<span className="font-normal text-muted-foreground">
												(optional)
											</span>
										</p>
										<button
											type="button"
											onClick={() => evidenceInput.current?.click()}
											disabled={uploadingEvidence}
											className="flex w-full flex-col items-center gap-1.5 rounded-[var(--radius-card-lg)] border border-line-strong border-dashed bg-surface px-6 py-8 text-center transition-colors hover:border-brass hover:border-solid hover:ring-1 hover:ring-brass disabled:opacity-60"
										>
											<Upload
												className="size-5 text-brass-deep"
												aria-hidden="true"
											/>
											<span className="font-bold text-[14px] text-ink">
												{uploadingEvidence
													? "Uploading…"
													: "Drag files here, or browse"}
											</span>
											<span className="text-[12.5px] text-muted-foreground">
												PDF, JPG, PNG · up to 25MB each
											</span>
										</button>
										<input
											ref={evidenceInput}
											type="file"
											accept=".pdf,image/*"
											multiple
											hidden
											onChange={onPickEvidence}
										/>

										{/* Or add a link as evidence */}
										<div className="mt-2.5 flex gap-2">
											<Input
												value={linkUrl}
												onChange={(e) => setLinkUrl(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === "Enter") {
														e.preventDefault();
														addLink();
													}
												}}
												placeholder="Or paste a link: article, record, video…"
												className="h-10 flex-1 bg-surface"
											/>
											<Button
												type="button"
												onClick={addLink}
												className="h-10 shrink-0"
											>
												<Link2 data-icon="inline-start" aria-hidden="true" />
												Add link
											</Button>
										</div>

										{evidence.map((f, i) => {
											// A pasted address opens where it points; an uploaded
											// document opens from where it was stored. Both are the
											// plaintiff's own, on the plaintiff's own screen — the
											// authorized route is for the people who read the case
											// later, and there is no case id to address here yet.
											const isLink = f.kind === "link" || (!!f.url && !f.size);
											return (
												<div
													key={`${f.url ?? f.name}-${i}`}
													className="mt-2.5 flex items-center gap-2.5 rounded-[var(--radius-control)] border border-border bg-surface px-3.5 py-2.5"
												>
													{isLink ? (
														<>
															<Link2
																className="size-4 shrink-0 text-brass-deep"
																aria-hidden="true"
															/>
															<a
																href={f.url}
																target="_blank"
																rel="noopener noreferrer"
																className="flex-1 truncate text-[13.5px] text-brass-deep hover:underline"
															>
																{f.name}
															</a>
															<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.06em]">
																Link
															</span>
														</>
													) : (
														<>
															<FileText
																className="size-4 shrink-0 text-brass-deep"
																aria-hidden="true"
															/>
															{f.url ? (
																<a
																	href={f.url}
																	target="_blank"
																	rel="noopener noreferrer"
																	className="flex-1 truncate text-[13.5px] text-brass-deep hover:underline"
																>
																	{f.name}
																</a>
															) : (
																<span className="flex-1 truncate text-[13.5px] text-ink">
																	{f.name}
																</span>
															)}
															<span className="text-[12px] text-muted-foreground tabular-nums">
																{f.size != null ? formatSize(f.size) : ""}
															</span>
														</>
													)}
													<button
														type="button"
														aria-label="Remove evidence"
														onClick={() =>
															setEvidence((p) =>
																p.filter((_, idx) => idx !== i),
															)
														}
														className="text-muted-foreground hover:text-ink"
													>
														<X className="size-4" aria-hidden="true" />
													</button>
												</div>
											);
										})}
									</div>

									{/* Written here, sent much later — with the acknowledgement
									    every donor gets once the case is live. Asked for on this
									    step because it is the one place the plaintiff is already
									    writing in their own voice, and kept optional: a case with
									    no note still sends a complete confirmation, and the note
									    can be added or changed anytime from Manage. The cap is the
									    server's, so a note that would be rejected can't be typed
									    past here. */}
									<div>
										<label
											htmlFor={ids.thankYouNote}
											className="mb-1.5 block font-semibold text-[13px] text-ink"
										>
											Thank-you note to your donors{" "}
											<span className="font-normal text-muted-foreground">
												(optional)
											</span>
										</label>
										<Textarea
											id={ids.thankYouNote}
											value={thankYouNote}
											onChange={(e) =>
												setThankYouNote(e.target.value.slice(0, THANK_YOU_MAX))
											}
											rows={4}
											maxLength={THANK_YOU_MAX}
											placeholder="Say thank you in your own words. Every donor gets this with their confirmation."
											className="bg-surface"
										/>
										<p className="mt-1.5 text-[12.5px] text-muted-foreground leading-relaxed">
											{thankYouNote.trim()
												? `Sent to every donor with their confirmation. ${THANK_YOU_MAX - thankYouNote.length} characters left.`
												: "Skip it for now if you'd rather. Donors still get a confirmation, and you can add this later from Manage."}
										</p>
									</div>

									<p className="flex gap-2.5 rounded-[var(--radius-card-sm)] bg-green-soft px-4 py-3 text-[13px] text-green-deep leading-relaxed">
										<Sparkles
											className="mt-0.5 size-4 shrink-0 text-success"
											aria-hidden="true"
										/>
										AI checks your story for completeness and flags what's
										missing. It never blocks you. You decide what to publish.
									</p>
								</div>
							</>
						)}

						{step === 3 && attorneyConfirmed && attorney ? (
							<>
								<h1 className="font-extrabold text-[clamp(1.75rem,3vw,2.375rem)] text-ink tracking-[-0.03em]">
									Your attorney
								</h1>
								<p className="mt-2.5 max-w-[600px] text-[15px] text-ink-soft leading-relaxed">
									You've already chosen {attorney.name} and they accepted your
									case. There's nothing to invite or send again. Continue to
									review the rest, or change your attorney.
								</p>

								<div className="mt-8 flex items-center gap-4 rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
									<span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brass font-bold text-[14px] text-white">
										{attorney.name
											.split(/\s+/)
											.slice(0, 2)
											.map((p) => p[0]?.toUpperCase() ?? "")
											.join("")}
									</span>
									<div className="min-w-0 flex-1">
										<p className="font-bold text-[16px] text-ink">
											{attorney.name}
										</p>
										<p className="text-[13px] text-muted-foreground">
											{[attorney.area, attorney.location, attorney.firm]
												.filter(Boolean)
												.join(" · ") || "Representing you"}
										</p>
									</div>
									<span className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] bg-green-soft px-3 py-1.5 font-semibold text-[12px] text-green-deep">
										<CircleCheck className="size-3.5" aria-hidden="true" />
										Representing you
									</span>
								</div>

								<button
									type="button"
									onClick={changeAttorney}
									className="mt-4 inline-flex items-center gap-1.5 font-semibold text-[13.5px] text-brass-deep transition-colors hover:text-brass"
								>
									<Search className="size-4" aria-hidden="true" />
									Connect with a different attorney
								</button>
							</>
						) : step === 3 ? (
							<>
								<h1 className="font-extrabold text-[clamp(1.75rem,3vw,2.375rem)] text-ink tracking-[-0.03em]">
									Do you have an attorney?
								</h1>
								<p className="mt-2.5 max-w-[600px] text-[15px] text-ink-soft leading-relaxed">
									You connect with your own attorney directly. Already found
									someone? Add them. If not, we'll help you get in front of
									attorneys.
								</p>

								<div className="mt-8 grid gap-4 sm:grid-cols-2">
									{[
										{
											value: "have" as const,
											icon: UserPlus,
											title: "Yes, I have an attorney",
											body: "Enter their details and we'll invite them to your case.",
										},
										{
											value: "find" as const,
											icon: Users,
											title: "No, not yet",
											body: "Let attorneys come to you, or reach out yourself.",
										},
									].map((opt) => {
										const active = repChoice === opt.value;
										return (
											<button
												key={opt.value}
												type="button"
												onClick={() => setRepChoice(opt.value)}
												aria-pressed={active}
												className={cn(
													"flex flex-col rounded-[var(--radius-card-lg)] border p-5 text-left transition-all",
													active
														? "border-brass bg-brass-wash/50 ring-1 ring-brass"
														: "border-border bg-surface hover:border-brass-deep",
												)}
											>
												<div className="mb-4 flex items-start justify-between">
													<span
														className={cn(
															"flex size-11 items-center justify-center rounded-xl",
															active
																? "bg-brass text-white"
																: "bg-brass-wash text-brass-deep",
														)}
													>
														<opt.icon className="size-5" aria-hidden="true" />
													</span>
													<span
														className={cn(
															"flex size-6 items-center justify-center rounded-full border-2 transition-colors",
															active
																? "border-brass bg-brass text-white"
																: "border-line-strong",
														)}
													>
														{active && (
															<Check className="size-3.5" aria-hidden="true" />
														)}
													</span>
												</div>
												<span className="font-bold text-[16px] text-ink">
													{opt.title}
												</span>
												<span className="mt-1 text-[13px] text-ink-soft leading-relaxed">
													{opt.body}
												</span>
											</button>
										);
									})}
								</div>

								{repChoice === "have" && (
									<div className="mt-6 flex flex-col gap-5">
										<p className="font-mono font-semibold text-[11px] text-brass-deep uppercase tracking-[0.1em]">
											Your attorney's details
										</p>
										<div className="flex flex-col gap-1.5">
											<label
												htmlFor={ids.manual}
												className="font-semibold text-[13px] text-ink"
											>
												Attorney's full name
												<span className="ml-0.5 text-danger">*</span>
											</label>
											<Input
												id={ids.manual}
												className={inputClass}
												value={atName}
												onChange={(e) => setAtName(e.target.value)}
												placeholder="e.g. Daniel Osei"
											/>
										</div>
										<div className="grid gap-4 sm:grid-cols-2">
											<div className="flex flex-col gap-1.5">
												<label
													htmlFor={ids.manualFirm}
													className="font-semibold text-[13px] text-ink"
												>
													Law firm
												</label>
												<Input
													id={ids.manualFirm}
													className={inputClass}
													value={atFirm}
													onChange={(e) => setAtFirm(e.target.value)}
													placeholder="e.g. Osei Legal Group"
												/>
											</div>
											<div className="flex flex-col gap-1.5">
												<label
													htmlFor={ids.attorneyEmail}
													className="font-semibold text-[13px] text-ink"
												>
													Email
													<span className="ml-0.5 text-danger">*</span>
												</label>
												<Input
													id={ids.attorneyEmail}
													type="email"
													className={cn(
														inputClass,
														atEmailError && "border-danger",
													)}
													value={atEmail}
													onChange={(e) => setAtEmail(e.target.value)}
													onBlur={() => setAtEmailTouched(true)}
													aria-invalid={atEmailError ? true : undefined}
													aria-describedby={
														atEmailError ? ids.attorneyEmailError : undefined
													}
													placeholder="attorney@email.com"
												/>
												{atEmailError ? (
													<p
														id={ids.attorneyEmailError}
														className="text-[12.5px] text-danger"
													>
														{atEmailError}
													</p>
												) : (
													<p className="text-[12.5px] text-muted-foreground">
														Where we send their invitation.
													</p>
												)}
											</div>
										</div>
										<div className="grid gap-4 sm:grid-cols-2">
											{/* Not a choice. Your attorney has to be admitted where the
											    case is, so this states the case's own jurisdiction rather
											    than asking — a mismatch here used to be collectable and
											    then refused at the point the attorney tried to confirm,
											    a week later. */}
											<div className="flex flex-col gap-1.5">
												<span
													id={ids.manualState}
													className="font-semibold text-[13px] text-ink"
												>
													Jurisdiction
												</span>
												<p className="flex h-11 items-center rounded-[var(--radius-control)] border border-line-strong bg-paper px-3 text-[14px] text-ink-soft">
													{state || "Set your case's state first"}
												</p>
												<p className="text-[12.5px] text-muted-foreground">
													{state
														? `Your attorney must be admitted in ${state} to take this case.`
														: "Taken from your case. Go back and choose its state."}
												</p>
											</div>
											<div className="flex flex-col gap-1.5">
												<label
													htmlFor={ids.attorneyPhone}
													className="font-semibold text-[13px] text-ink"
												>
													Phone{" "}
													<span className="font-normal text-muted-foreground">
														(optional)
													</span>
												</label>
												<Input
													id={ids.attorneyPhone}
													type="tel"
													className={inputClass}
													value={atPhone}
													onChange={(e) => setAtPhone(e.target.value)}
													placeholder="(555) 000-0000"
												/>
											</div>
										</div>
										<p className="flex gap-2.5 rounded-[var(--radius-card-sm)] bg-green-soft px-4 py-3 text-[13px] text-green-deep leading-relaxed">
											<Send
												className="mt-0.5 size-4 shrink-0 text-success"
												aria-hidden="true"
											/>
											We'll email them an invite to represent you. They confirm
											before they're attached. If they decline or don't answer,
											your case goes to attorneys on JustUs instead.
										</p>
									</div>
								)}

								{repChoice === "find" && (
									<>
										<p className="mt-6 mb-3 font-mono font-semibold text-[11px] text-brass-deep uppercase tracking-[0.1em]">
											No attorney yet? Two ways to find one
										</p>
										<div className="grid gap-4 sm:grid-cols-2">
											<div className="flex flex-col rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
												<div className="mb-3 flex items-center justify-between">
													<span className="flex size-10 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
														<Megaphone className="size-5" aria-hidden="true" />
													</span>
													<span className="rounded-[var(--radius-pill)] bg-brass-wash px-2.5 py-1 font-mono font-semibold text-[10px] text-brass-deep uppercase tracking-[0.06em]">
														Recommended
													</span>
												</div>
												<h3 className="font-bold text-[15px] text-ink">
													Let attorneys request your case
												</h3>
												<p className="mt-1 mb-4 flex-1 text-[13px] text-ink-soft leading-relaxed">
													Publish your case on JustUs. Attorneys can review it
													and ask to represent you. No searching needed.
												</p>
												<Button
													type="button"
													className="w-full"
													onClick={publishForAttorneysFlow}
													disabled={publishing}
												>
													{publishing ? "Publishing…" : "Publish for attorneys"}
													<ArrowRight
														data-icon="inline-end"
														aria-hidden="true"
													/>
												</Button>
											</div>
											<div className="flex flex-col rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
												<span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
													<Search className="size-5" aria-hidden="true" />
												</span>
												<h3 className="font-bold text-[15px] text-ink">
													Search and reach out yourself
												</h3>
												<p className="mt-1 mb-4 flex-1 text-[13px] text-ink-soft leading-relaxed">
													Don't want to wait? Browse the directory and message
													attorneys who fit. You decide who to talk to.
												</p>
												<Button
													type="button"
													variant="outline"
													className="w-full"
													onClick={browseDirectory}
													disabled={saving}
												>
													{saving ? "Saving…" : "Search the directory"}
													<ArrowRight
														data-icon="inline-end"
														aria-hidden="true"
													/>
												</Button>
											</div>
										</div>
										<div className="mt-4 flex gap-2.5 rounded-[var(--radius-card-sm)] border border-warn/50 bg-warn/10 px-4 py-3 text-[13px] text-ink leading-relaxed">
											<Clock
												className="mt-0.5 size-4 shrink-0 text-warn-deep"
												aria-hidden="true"
											/>
											Heads up: attorneys reply on their own time, so it can
											take a few days to hear back. You can do both, and your
											campaign can still go live while you wait.
										</div>
									</>
								)}
							</>
						) : null}

						{step === 4 && (
							<>
								<h1 className="font-extrabold text-[clamp(1.75rem,3vw,2.375rem)] text-ink tracking-[-0.03em]">
									Agree the fee
								</h1>
								<p className="mt-2.5 max-w-[600px] text-[15px] text-ink-soft leading-relaxed">
									{bringYourOwn
										? `Set the fee you agreed with ${attorneyName}. It becomes your funding goal, and nothing more is ever raised. They'll see it when they confirm.`
										: `You're working with ${attorneyName}. Set the fee you agreed together. It becomes your funding goal, and nothing more is ever raised.`}
								</p>

								<p className="mt-7 mb-2.5 font-mono font-semibold text-[11px] text-brass-deep uppercase tracking-[0.1em]">
									Your attorney
								</p>
								{attorney ? (
									<div className="flex items-center gap-4 rounded-[var(--radius-card-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-rest)]">
										<span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brass font-bold text-[13px] text-white">
											{attorney.name
												.split(/\s+/)
												.slice(0, 2)
												.map((p) => p[0]?.toUpperCase() ?? "")
												.join("")}
										</span>
										<div className="min-w-0 flex-1">
											<p className="font-bold text-[15px] text-ink">
												{attorney.name}
											</p>
											<p className="text-[12.5px] text-muted-foreground">
												{[attorney.area, attorney.location, attorney.firm]
													.filter(Boolean)
													.join(" · ")}
											</p>
										</div>
										{/* A plaintiff-named attorney has confirmed nothing. Calling
										    them "representing you" here would be the wizard asserting
										    the very thing the invitation exists to establish. */}
										{bringYourOwn ? (
											<span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-brass-wash px-3 py-1.5 font-semibold text-[12px] text-brass-deep">
												<Clock className="size-3.5" aria-hidden="true" />
												Not confirmed yet
											</span>
										) : (
											<span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-green-soft px-3 py-1.5 font-semibold text-[12px] text-green-deep">
												<CircleCheck className="size-3.5" aria-hidden="true" />
												Representing you
											</span>
										)}
									</div>
								) : (
									<div className="rounded-[var(--radius-card-lg)] border border-border border-dashed bg-surface px-4 py-4 text-[13.5px] text-muted-foreground">
										Add your attorney on the previous step first.
									</div>
								)}

								<div className="mt-6 max-w-[320px]">
									<label
										htmlFor={ids.fee}
										className="mb-1.5 block font-semibold text-[13px] text-ink"
									>
										Agreed fee (USD)
										<span className="ml-0.5 text-danger">*</span>
									</label>
									<div className="relative">
										<span className="absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-muted-foreground">
											$
										</span>
										<Input
											id={ids.fee}
											inputMode="numeric"
											className={cn(inputClass, "pl-7")}
											value={fee}
											onChange={(e) => setFee(e.target.value)}
											placeholder="18,500"
										/>
									</div>
								</div>

								<div className="mt-4 flex gap-2.5 rounded-[var(--radius-card-sm)] bg-brass-wash/60 px-4 py-3.5">
									<Scale
										className="mt-0.5 size-4 shrink-0 text-brass-deep"
										aria-hidden="true"
									/>
									<div className="text-[13px] leading-relaxed">
										<p className="font-bold text-ink">
											Your funding goal is {money(goal)}
										</p>
										<p className="text-ink-soft">
											The most that's ever raised. It's paid to your attorney's
											firm and applied to this fee.
										</p>
									</div>
								</div>
							</>
						)}

						{/* Step 5 asks two different questions depending on how the
						    attorney got here. A matched attorney is settled, so the only
						    thing left is their payout account. A plaintiff-named one has
						    agreed to nothing, so there is nothing to set up yet — the step
						    is the invitation itself. */}
						{step === 5 && bringYourOwn && (
							<>
								<h1 className="font-extrabold text-[clamp(1.75rem,3vw,2.375rem)] text-ink tracking-[-0.03em]">
									Invite {attorneyName}
								</h1>
								<p className="mt-2.5 max-w-[600px] text-[15px] text-ink-soft leading-relaxed">
									Nobody is attached to your case until they say so. We'll email
									them a link to confirm they represent you. Then they open the
									payout account this case is funded into, and you publish.
								</p>

								<p className="mt-7 mb-2.5 font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.1em]">
									Invitation
								</p>

								<div className="flex items-center gap-4 rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
									<span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
										<Mail className="size-5" aria-hidden="true" />
									</span>
									<div className="min-w-0 flex-1">
										<p className="truncate font-bold text-[15px] text-ink">
											{inviteEmail || "No email yet"}
										</p>
										<p className="text-[12.5px] text-muted-foreground">
											{canSendInvite
												? `${attorneyName} · the link expires 7 days after we send it`
												: `We need ${attorneyName}'s email before we can send this`}
										</p>
									</div>
									<button
										type="button"
										onClick={() => {
											setRepChoice("have");
											setStep(3);
											window.scrollTo({ top: 0 });
										}}
										className="shrink-0 font-semibold text-[13px] text-brass-deep underline underline-offset-2"
									>
										{canSendInvite ? "Change" : "Add their email"}
									</button>
								</div>

								<div className="mt-6 flex gap-2.5 rounded-[var(--radius-card-sm)] bg-brass-wash/60 px-4 py-3.5">
									<Lock
										className="mt-0.5 size-4 shrink-0 text-brass-deep"
										aria-hidden="true"
									/>
									<div className="text-[13px] leading-relaxed">
										<p className="font-bold text-ink">
											Your case stays private while they decide
										</p>
										<p className="text-ink-soft">
											Nobody can see it, share it or give to it yet. If they
											decline, or don't answer within 7 days, your case goes in
											front of bar-verified attorneys on JustUs, who can request
											to represent you.
										</p>
									</div>
								</div>
							</>
						)}

						{step === 5 && !bringYourOwn && (
							<>
								<h1 className="font-extrabold text-[clamp(1.75rem,3vw,2.375rem)] text-ink tracking-[-0.03em]">
									Where the money lands
								</h1>
								<p className="mt-2.5 max-w-[600px] text-[15px] text-ink-soft leading-relaxed">
									Donations are paid to {attorneyName}'s firm, into a Stripe
									account opened for this case alone, never into a JustUs
									balance, and never mixed with another client's funds. They
									open it; you publish once it can receive.
								</p>

								<p className="mt-7 mb-2.5 font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.1em]">
									Payout account
								</p>

								<PayoutStep
									committed={committed}
									payout={payout}
									attorneyName={attorneyName}
									attorneyFirm={attorney?.firm ?? null}
									attorneyEmail={attorney?.email ?? null}
									checking={checking}
									onCheck={checkPayout}
								/>

								{/* The one thing a plaintiff will not guess: nothing is public
								    yet, and that is deliberate rather than a delay. */}
								<div className="mt-6 flex gap-2.5 rounded-[var(--radius-card-sm)] bg-brass-wash/60 px-4 py-3.5">
									<Lock
										className="mt-0.5 size-4 shrink-0 text-brass-deep"
										aria-hidden="true"
									/>
									<div className="text-[13px] leading-relaxed">
										<p className="font-bold text-ink">
											Your case stays private until then
										</p>
										<p className="text-ink-soft">
											Nobody can see it, share it or give to it while this is
											outstanding. That's on purpose: a campaign that can't take
											a donation costs you the first people you tell.
										</p>
									</div>
								</div>
							</>
						)}

						{step === 6 && (
							<>
								<h1 className="font-extrabold text-[clamp(1.75rem,3vw,2.375rem)] text-ink tracking-[-0.03em]">
									Ready to go live?
								</h1>
								<p className="mt-2.5 max-w-[600px] text-[15px] text-ink-soft leading-relaxed">
									This is exactly what donors will see. Publish when you're
									ready. Your campaign goes live right away.
								</p>

								<p className="mt-7 mb-2.5 font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.1em]">
									Public preview
								</p>
								<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
									<div className="mb-2.5 flex flex-wrap gap-2">
										<span className="rounded-[var(--radius-chip)] bg-brass-wash px-2.5 py-1 font-semibold text-[12px] text-brass-deep">
											{category}
										</span>
										<span className="rounded-[var(--radius-chip)] border border-border px-2.5 py-1 text-[12px] text-ink-soft">
											{state}
										</span>
									</div>
									<h3 className="font-bold text-[18px] text-ink">
										{displayTitle}
									</h3>
									{summary.trim() && (
										<p className="mt-1.5 text-[13.5px] text-ink-soft leading-relaxed">
											{summary}
										</p>
									)}
									<p className="mt-2.5 text-[13px] text-muted-foreground">
										You{attorney ? ` · with ${attorney.name}` : ""}
									</p>
									<div className="mt-3">
										<ThinBar pct={0} />
										<div className="mt-2 flex items-center justify-between text-[12.5px]">
											<span className="font-bold text-ink tabular-nums">
												{money(0)} of {money(goal)}
											</span>
											<span className="text-muted-foreground">
												Goal set · 0 donors
											</span>
										</div>
									</div>
								</div>

								<Button
									type="button"
									variant="outline"
									className="mt-4"
									onClick={() => setView("preview")}
								>
									<Eye data-icon="inline-start" aria-hidden="true" />
									Preview full campaign
								</Button>

								{/* The checklist is honest about the one item that can still be
								    outstanding, rather than showing five green ticks next to a
								    button that refuses. */}
								<div
									className={cn(
										"mt-6 rounded-[var(--radius-card-lg)] p-5",
										payoutReady ? "bg-green-soft" : "bg-surface-2",
									)}
								>
									<p
										className={cn(
											"mb-3 font-mono font-semibold text-[11px] uppercase tracking-[0.1em]",
											payoutReady ? "text-green-deep" : "text-muted-foreground",
										)}
									>
										{payoutReady ? "Ready to publish" : "Almost ready"}
									</p>
									<ul className="flex flex-col gap-2.5">
										{[
											{ label: "Title & one-line summary", done: true },
											{ label: "Your story", done: true },
											{
												label: `Evidence attached (${evidence.length} item${evidence.length === 1 ? "" : "s"})`,
												done: true,
											},
											{ label: "Attorney connected · fee agreed", done: true },
											{
												label: payoutReady
													? `Payout account ready · ${payout?.attorney?.firmName ?? attorneyName}`
													: payout?.attorney
														? `Payout account: waiting on ${payout.attorney.firmName ?? attorneyName}`
														: "Payout account: no attorney linked to this case yet",
												done: payoutReady,
											},
										].map((item) => (
											<li
												key={item.label}
												className={cn(
													"flex items-center gap-2.5 text-[13.5px]",
													item.done ? "text-green-deep" : "text-ink-soft",
												)}
											>
												{item.done ? (
													<CircleCheck
														className="size-4 shrink-0 text-success"
														aria-hidden="true"
													/>
												) : (
													<Clock
														className="size-4 shrink-0 text-muted-foreground"
														aria-hidden="true"
													/>
												)}
												{item.label}
											</li>
										))}
									</ul>
									{!payoutReady && (
										<button
											type="button"
											onClick={() => setStep(5)}
											className="mt-3.5 font-semibold text-[13px] text-brass-deep underline underline-offset-2"
										>
											See what's outstanding
										</button>
									)}
								</div>
							</>
						)}
					</div>
				</main>

				{/* Rendered here, in the always-visible column, rather than in the
				    step sidebar — that sidebar is hidden below lg, and a modal nested
				    in a hidden ancestor never shows, so mobile's Discard did nothing. */}
				{discardOpen && (
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
						<button
							type="button"
							aria-label="Keep editing"
							disabled={discarding}
							onClick={() => setDiscardOpen(false)}
							className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
						/>
						<div
							role="dialog"
							aria-modal="true"
							className="relative w-full max-w-[400px] rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 text-left shadow-[var(--shadow-modal)]"
						>
							<div className="mb-3 flex size-11 items-center justify-center rounded-full bg-danger/10 text-danger">
								<X className="size-5" aria-hidden="true" />
							</div>
							<h2 className="font-bold text-[17px] text-ink">
								Discard this case?
							</h2>
							<p className="mt-1.5 text-[13.5px] text-ink-soft leading-relaxed">
								You'll lose anything you haven't saved
								{caseId ? ", and this draft will be removed" : ""}. This can't
								be undone.
							</p>
							<div className="mt-5 flex justify-end gap-2.5">
								<Button
									variant="outline"
									disabled={discarding}
									onClick={() => setDiscardOpen(false)}
								>
									Keep editing
								</Button>
								<Button
									disabled={discarding}
									onClick={discard}
									className={cn("bg-danger text-white hover:bg-danger/90")}
								>
									<X data-icon="inline-start" aria-hidden="true" />
									{discarding ? "Discarding…" : "Discard case"}
								</Button>
							</div>
						</div>
					</div>
				)}

				{/* Action bar — pinned below the scroll area */}
				<div className="shrink-0 border-border border-t bg-paper px-6 py-4 sm:px-12">
					<div className="mx-auto flex max-w-[720px] items-center justify-between gap-4">
						<Button type="button" variant="outline" size="lg" onClick={back}>
							<ArrowLeft data-icon="inline-start" aria-hidden="true" />
							Back
						</Button>
						{step === 6 ? (
							<Button
								type="button"
								size="lg"
								className="px-6"
								onClick={publish}
								// Never disabled on "not ready": pressing it re-checks the firm's
								// account with Stripe (`goLiveAction` refreshes first), which is
								// how the case unsticks when the attorney enabled payouts after
								// this page loaded. `goLiveCase` still enforces readiness
								// server-side, so a genuine not-ready case can't slip public.
								disabled={publishing}
								title={
									payoutReady
										? undefined
										: "Re-check the firm's payout account and publish if it's ready"
								}
							>
								<Rocket data-icon="inline-start" aria-hidden="true" />
								{publishing
									? "Publishing…"
									: payoutReady
										? "Publish & go live"
										: "Check & publish"}
							</Button>
						) : step === 5 && bringYourOwn ? (
							// The bring-your-own path ends here: the case is published as
							// seeking and the attorney is emailed. There is nothing to review
							// and publish until they confirm.
							<Button
								type="button"
								size="lg"
								className="px-6"
								onClick={sendInvitation}
								disabled={committing || !canSendInvite}
								title={
									canSendInvite
										? undefined
										: "Add your attorney's email address first"
								}
							>
								<Send data-icon="inline-start" aria-hidden="true" />
								{committing ? "Sending…" : "Send invitation"}
							</Button>
						) : step === 5 ? (
							// One control, whether or not the case has been sent yet: it
							// saves and then either reports back here or moves on. Advancing
							// without saving would review a stale copy of the case.
							<Button
								type="button"
								size="lg"
								className="px-6"
								onClick={commitToAttorney}
								disabled={committing}
							>
								{committed ? (
									<>
										{committing ? "Saving…" : "Continue"}
										<ArrowRight data-icon="inline-end" aria-hidden="true" />
									</>
								) : (
									<>
										<Send data-icon="inline-start" aria-hidden="true" />
										{committing ? "Sending…" : `Send to ${attorneyName}`}
									</>
								)}
							</Button>
						) : step === 3 && attorneyConfirmed ? (
							<Button type="button" size="lg" className="px-6" onClick={next}>
								Continue
								<ArrowRight data-icon="inline-end" aria-hidden="true" />
							</Button>
						) : step === 3 && repChoice === "have" ? (
							<Button
								type="button"
								size="lg"
								className="px-6"
								onClick={sendInviteAndContinue}
							>
								Send invite &amp; continue
								<ArrowRight data-icon="inline-end" aria-hidden="true" />
							</Button>
						) : step === 3 && repChoice === "find" ? (
							<Button
								type="button"
								size="lg"
								className="px-6"
								onClick={publishForAttorneysFlow}
								disabled={publishing}
							>
								{publishing ? "Publishing…" : "Continue"}
								<ArrowRight data-icon="inline-end" aria-hidden="true" />
							</Button>
						) : (
							<Button
								type="button"
								size="lg"
								className="px-6"
								onClick={next}
								disabled={step === 3 && !repChoice}
							>
								Continue
								<ArrowRight data-icon="inline-end" aria-hidden="true" />
							</Button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

/**
 * The wizard's payout step: one card reporting how far the firm's Stripe setup
 * for this case has got, and a way to re-ask.
 *
 * Four states, and each names the person the plaintiff is waiting on. That is the
 * whole design brief — this is the only step whose outcome someone else controls,
 * and a screen that says "pending" without saying *who* leaves them with nothing
 * to do. Chasing their attorney is the one action available, so the address is
 * always in reach.
 *
 * `transfersEnabled` is the only flag that counts as ready. A submitted form that
 * Stripe is still reviewing is shown as its own state rather than folded into
 * ready, because publishing on it would put up a campaign that cannot receive.
 */
function PayoutStep({
	committed,
	payout,
	attorneyName,
	attorneyFirm,
	attorneyEmail,
	checking,
	onCheck,
}: {
	committed: boolean;
	payout: CasePayoutReadiness | null;
	attorneyName: string;
	attorneyFirm: string | null;
	attorneyEmail: string | null;
	checking: boolean;
	onCheck: () => void;
}) {
	const linked = payout?.attorney ?? null;
	const recipient = linked
		? (linked.firmName ?? linked.name)
		: attorneyFirm || attorneyName;
	const email = linked?.email ?? attorneyEmail;

	// Before the case is sent, there is no account to report on — only what will
	// be asked of whom.
	if (!committed) {
		return (
			<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
				<div className="flex items-start gap-3">
					<span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
						<Landmark className="size-3" aria-hidden="true" />
					</span>
					<div className="min-w-0 flex-1">
						<p className="font-semibold text-[14px] text-ink">{recipient}</p>
						<p className="mt-1 text-[12.5px] text-ink-soft leading-relaxed">
							Sending your case hands it to {attorneyName} so they can open its
							payout account with Stripe: their firm's details, their bank
							account, a few minutes of their time. Nothing is asked of you.
						</p>
						{email && (
							<p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
								<Mail className="size-3.5 shrink-0" aria-hidden="true" />
								{email}
							</p>
						)}
					</div>
				</div>
			</div>
		);
	}

	// Sent, but the address on the case belongs to no attorney account. The one
	// state the plaintiff can actually fix, so it says how.
	if (!linked) {
		return (
			<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
				<div className="flex items-start gap-3">
					<span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
						<UserPlus className="size-3" aria-hidden="true" />
					</span>
					<div className="min-w-0 flex-1">
						<p className="font-semibold text-[14px] text-ink">
							No attorney account at that address yet
						</p>
						<p className="mt-1 text-[12.5px] text-ink-soft leading-relaxed">
							{payout?.designatedEmail
								? `Your case names ${payout.designatedEmail}, but nobody has signed up as an attorney on JustUs with it. Ask them to. That's what links your case to their firm's payout account.`
								: `Add ${attorneyName}'s email to your case so we can link it to their firm's payout account.`}
						</p>
					</div>
				</div>
				<CheckAgain checking={checking} onCheck={onCheck} />
			</div>
		);
	}

	const ready = linked.transfersEnabled;
	const stage = ready
		? "ready"
		: linked.detailsSubmitted
			? "in_review"
			: linked.hasAccount
				? "started"
				: "unstarted";

	const copy: Record<string, { title: string; body: string }> = {
		ready: {
			title: "Ready to receive",
			body: `${recipient} can accept this case's donations. Publish whenever you're ready.`,
		},
		in_review: {
			title: "Stripe is verifying their details",
			body: `${attorneyName} finished the form. Stripe reviews the firm's details before releasing the account, usually quick, occasionally a day or two. Nothing for either of you to do.`,
		},
		started: {
			title: "Setup started, not finished",
			body: `${attorneyName} opened the account for this case but hasn't completed it. They finish it on the case itself, in their own JustUs account.`,
		},
		unstarted: {
			title: "Waiting on your attorney",
			body: `${attorneyName} hasn't opened this case's payout account yet. Each case gets its own, so they may well be set up on their other matters and still owe this one.`,
		},
	};
	const { title, body } = copy[stage] ?? copy.unstarted;

	return (
		<div
			className={cn(
				"rounded-[var(--radius-card-lg)] p-5",
				ready
					? "bg-green-soft"
					: "border border-border bg-surface shadow-[var(--shadow-rest)]",
			)}
		>
			<div className="flex items-start gap-3">
				<span
					className={cn(
						"mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
						ready ? "bg-success text-white" : "bg-brass-wash text-brass-deep",
					)}
				>
					{ready ? (
						<Check className="size-3" aria-hidden="true" />
					) : (
						<Clock className="size-3" aria-hidden="true" />
					)}
				</span>
				<div className="min-w-0 flex-1">
					<p
						className={cn(
							"font-semibold text-[14px]",
							ready ? "text-green-deep" : "text-ink",
						)}
					>
						{title}
					</p>
					<p
						className={cn(
							"mt-1 text-[12.5px] leading-relaxed",
							ready ? "text-green-deep" : "text-ink-soft",
						)}
					>
						{body}
					</p>
					<p className="mt-2 text-[12.5px] text-muted-foreground leading-relaxed">
						{recipient}
						{linked.barNumber ? ` · Bar #${linked.barNumber}` : ""}
					</p>
					{!ready && email && (
						<p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
							<Mail className="size-3.5 shrink-0" aria-hidden="true" />
							{email}, the address to nudge
						</p>
					)}
				</div>
			</div>
			{!ready && <CheckAgain checking={checking} onCheck={onCheck} />}
		</div>
	);
}

/** Their Stripe onboarding finishes elsewhere, so nothing in this browser would
 *  otherwise tell the plaintiff it had. */
function CheckAgain({
	checking,
	onCheck,
}: {
	checking: boolean;
	onCheck: () => void;
}) {
	return (
		<div className="mt-4 flex flex-wrap items-center gap-3">
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={onCheck}
				disabled={checking}
			>
				<RefreshCw data-icon="inline-start" aria-hidden="true" />
				{checking ? "Checking…" : "Check again"}
			</Button>
			<span className="text-[12.5px] text-muted-foreground">
				We'll email you the moment they're set. You don't have to wait here.
			</span>
		</div>
	);
}

function Field({
	label,
	htmlFor,
	hint,
	children,
}: {
	label: string;
	htmlFor?: string;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={htmlFor} className="font-semibold text-[13px] text-ink">
				{label}
			</label>
			{children}
			{hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
		</div>
	);
}
