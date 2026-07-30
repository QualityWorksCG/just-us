// biome-ignore-all lint/performance/noImgElement: user-uploaded Blob images aren't static assets next/image can optimize
"use client";

import { US_STATES } from "@just-us/auth/jurisdiction";
import { Button } from "@just-us/ui/components/button";
import { Input } from "@just-us/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@just-us/ui/components/select";
import { Switch } from "@just-us/ui/components/switch";
import { Textarea } from "@just-us/ui/components/textarea";
import { cn } from "@just-us/ui/lib/utils";
import { upload } from "@vercel/blob/client";
import {
	ArrowRight,
	BadgeCheck,
	Building2,
	Check,
	CircleAlert,
	Clock3,
	Globe,
	Languages as LanguagesIcon,
	Mail,
	MapPin,
	Phone,
	Save,
	Scale,
	Sparkles,
	Upload,
	User as UserIcon,
	Wallet,
	X,
} from "lucide-react";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";

import {
	type SaveAttorneyProfileInput,
	saveAttorneyProfileAction,
} from "@/app/dashboard/profile/actions";
import {
	BACKGROUND_MAX,
	BIO_MAX,
	FEE_APPROACHES,
	type FeeApproach,
	feeRangeApplies,
	LANGUAGES,
	PRACTICE_AREAS,
} from "@/lib/attorney-profile";
import {
	formatPhone,
	isValidPhone,
	PHONE_MESSAGE,
	reformatPhone,
} from "@/lib/validation";

/**
 * The saved profile, or null when the attorney hasn't started one.
 *
 * Every field is nullable: the form autosaves as a draft, so a stored profile is
 * routinely incomplete. "Required" fields are required to be directory-ready,
 * not to be stored.
 */
export type AttorneyProfileData = {
	legalName: string | null;
	firmName: string | null;
	officeCity: string | null;
	officeState: string | null;
	contactEmail: string | null;
	contactPhone: string | null;
	websiteUrl: string | null;
	headshotUrl: string | null;
	practiceAreas: string[];
	languages: string[];
	acceptingNewCases: boolean;
	virtualConsultation: boolean;
	feeApproach: FeeApproach | null;
	feeRangeMinCents: number | null;
	feeRangeMaxCents: number | null;
	bio: string | null;
	background: string | null;
	bioStatus: "pending" | "approved" | "rejected";
};

/** Account details used to prefill a first-time profile, so the attorney isn't
 *  retyping what they gave us at sign-up. */
export type AttorneyAccount = {
	name: string;
	email: string;
	firmName: string | null;
	jurisdiction: string | null;
};

const MAX_AREAS = 8;

/**
 * The form is split across tabs so no single view scrolls far. One save covers
 * all of them — the state lives here in the parent, so switching tabs never
 * loses an edit.
 *
 * `fields` is what makes that safe: a validation error on a tab you aren't
 * looking at would otherwise be invisible, so each tab knows its own fields and
 * can show an error count, and a failed save jumps to the first tab at fault.
 */
const TABS = [
	{
		key: "photo",
		label: "Photo & name",
		fields: ["legalName", "firmName", "headshotUrl"],
	},
	{
		key: "office",
		label: "Office & contact",
		fields: [
			"officeCity",
			"officeState",
			"contactEmail",
			"contactPhone",
			"websiteUrl",
		],
	},
	{ key: "areas", label: "Practice areas", fields: ["practiceAreas"] },
	{ key: "languages", label: "Languages", fields: ["languages"] },
	// Two switches, both always set — nothing here can be invalid or missing.
	{ key: "availability", label: "Availability", fields: [] },
	{
		key: "fees",
		label: "Fees",
		fields: ["feeApproach", "feeRangeMinCents", "feeRangeMaxCents"],
	},
	{ key: "about", label: "About you", fields: ["bio", "background"] },
] as const;

type Tab = (typeof TABS)[number]["key"];

/** How many of a tab's fields are currently in error. */
function errorCount(
	tab: (typeof TABS)[number],
	errors: Record<string, string>,
): number {
	return tab.fields.filter((f) => errors[f]).length;
}

function centsToDollars(cents: number | null): string {
	return cents === null ? "" : String(Math.round(cents / 100));
}

/** Whole dollars -> cents. Returns null for blank/unparseable input so the field
 *  reads as "not stated" rather than $0. */
function dollarsToCents(value: string): number | null {
	const digits = value.replace(/[^0-9]/g, "");
	if (!digits) return null;
	return Number(digits) * 100;
}

async function uploadHeadshot(file: File): Promise<string> {
	const blob = await upload(file.name, file, {
		access: "public",
		handleUploadUrl: "/api/attorneys/headshot",
	});
	return blob.url;
}

const INPUT_CLASS =
	"h-11 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[14px]";

// The shared Textarea is square and text-xs by default; match the inputs above
// so the two don't read as different control families side by side.
const TEXTAREA_CLASS =
	"rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 py-2.5 text-[14px] leading-relaxed";

/**
 * The form's starting values: the saved profile, or — before one exists — what
 * the account already told us at sign-up.
 *
 * The account fallback applies only when there's no profile at all. Once one
 * exists, a field the attorney cleared stays cleared rather than being quietly
 * refilled from their sign-up details.
 */
function buildInitial(
	profile: AttorneyProfileData | null,
	account: AttorneyAccount,
) {
	const practiceAreas = profile?.practiceAreas ?? [];
	return {
		legalName: profile ? (profile.legalName ?? "") : account.name,
		firmName: profile ? (profile.firmName ?? "") : (account.firmName ?? ""),
		officeCity: profile?.officeCity ?? "",
		officeState: profile
			? (profile.officeState ?? "")
			: (account.jurisdiction ?? ""),
		contactEmail: profile ? (profile.contactEmail ?? "") : account.email,
		contactPhone: formatPhone(profile?.contactPhone ?? ""),
		websiteUrl: profile?.websiteUrl ?? "",
		headshotUrl: profile?.headshotUrl ?? null,
		practiceAreas,
		languages: profile?.languages ?? [],
		acceptingNewCases: profile?.acceptingNewCases ?? true,
		virtualConsultation: profile?.virtualConsultation ?? false,
		feeApproach: (profile?.feeApproach ?? "") as FeeApproach | "",
		feeMin: centsToDollars(profile?.feeRangeMinCents ?? null),
		feeMax: centsToDollars(profile?.feeRangeMaxCents ?? null),
		bio: profile?.bio ?? "",
		background: profile?.background ?? "",
	};
}

/** The full set of form values, as `buildInitial` shapes them. */
type FormValues = ReturnType<typeof buildInitial>;

/**
 * Comparable string for a set of values, independent of key order.
 *
 * The values are assembled in two places — `buildInitial` and the live `current`
 * object — and a plain `JSON.stringify` would call them different the moment the
 * two literals were written in a different order. That would read as an unsaved
 * change on first paint and autosave a row nobody touched, so the key order is
 * normalised rather than trusted.
 */
function fingerprint(values: FormValues): string {
	return JSON.stringify(values, Object.keys(values).sort());
}

/** Loose enough to catch a typo, not so strict it argues with real addresses.
 *  The action re-checks with Zod before anything is stored. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PATTERN = /^https?:\/\/\S+\.\S+/;

/**
 * The fields a listing needs before it can appear in the directory — the
 * "Required" ones from the spec.
 *
 * These no longer gate saving: the profile autosaves as a draft whatever state
 * it's in. They gate *readiness*, and are mirrored by `directoryReadySchema` in
 * the action, which is the authority. Keep the two in step.
 */
function requiredChecks(v: FormValues) {
	return {
		legalName: v.legalName.trim().length >= 2,
		officeCity: !!v.officeCity.trim(),
		officeState: !!v.officeState,
		contactEmail: EMAIL_PATTERN.test(v.contactEmail.trim()),
		practiceAreas: v.practiceAreas.length > 0,
		feeApproach: !!v.feeApproach,
	};
}

function isDirectoryReady(v: FormValues): boolean {
	return Object.values(requiredChecks(v)).every(Boolean);
}

/**
 * Form values → action input. Module-level and pure so an autosave queued behind
 * an in-flight request can build its payload from the latest values rather than
 * whatever was captured when it was scheduled.
 *
 * Trimming and validity are the action's job — it drops anything not yet valid
 * instead of storing it, which is what makes a mid-keystroke autosave safe.
 */
function toPayload(v: FormValues): SaveAttorneyProfileInput {
	return {
		legalName: v.legalName,
		firmName: v.firmName,
		officeCity: v.officeCity,
		officeState: v.officeState,
		contactEmail: v.contactEmail,
		contactPhone: v.contactPhone,
		websiteUrl: v.websiteUrl,
		headshotUrl: v.headshotUrl,
		practiceAreas: v.practiceAreas,
		languages: v.languages,
		acceptingNewCases: v.acceptingNewCases,
		virtualConsultation: v.virtualConsultation,
		feeApproach: v.feeApproach,
		feeRangeMinCents: dollarsToCents(v.feeMin),
		feeRangeMaxCents: dollarsToCents(v.feeMax),
		bio: v.bio,
		background: v.background,
	};
}

/** How long after the last keystroke an autosave fires. */
const AUTOSAVE_DELAY_MS = 1200;

function Section({
	icon: Icon,
	title,
	sub,
	children,
}: {
	icon: typeof UserIcon;
	title: string;
	sub: string;
	children: React.ReactNode;
}) {
	return (
		<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
			<div className="mb-5 flex items-start gap-3">
				<span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
					<Icon className="size-5" aria-hidden="true" />
				</span>
				<div>
					<h2 className="font-bold text-[16px] text-ink">{title}</h2>
					<p className="mt-0.5 text-[13px] text-muted-foreground leading-relaxed">
						{sub}
					</p>
				</div>
			</div>
			{children}
		</section>
	);
}

function Field({
	label,
	htmlFor,
	hint,
	error,
	required,
	children,
}: {
	label: string;
	htmlFor?: string;
	hint?: string;
	error?: string;
	required?: boolean;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={htmlFor} className="font-semibold text-[13px] text-ink">
				{label}
				{required ? (
					<span className="ml-1 text-brass-deep" aria-hidden="true">
						*
					</span>
				) : (
					<span className="ml-1.5 font-normal text-[12px] text-muted-foreground">
						optional
					</span>
				)}
			</label>
			{children}
			{error ? (
				<p className="text-[12px] text-danger">{error}</p>
			) : hint ? (
				<p className="text-[12px] text-muted-foreground">{hint}</p>
			) : null}
		</div>
	);
}

/** Toggle chip used for both multi-selects. */
function Chip({
	label,
	selected,
	disabled,
	onToggle,
}: {
	label: string;
	selected: boolean;
	disabled?: boolean;
	onToggle: () => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			disabled={disabled && !selected}
			onClick={onToggle}
			className={cn(
				"inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-3.5 py-2 font-semibold text-[13px] transition-colors",
				selected
					? "border-brass bg-brass-wash text-brass-deep ring-1 ring-brass"
					: "border-border bg-surface text-ink-soft hover:border-brass-deep hover:text-ink",
				disabled &&
					!selected &&
					"cursor-not-allowed opacity-45 hover:border-border hover:text-ink-soft",
			)}
		>
			{selected && <Check className="size-3.5" aria-hidden="true" />}
			{label}
		</button>
	);
}

function ToggleRow({
	icon: Icon,
	title,
	sub,
	checked,
	onChange,
	id,
}: {
	icon: typeof UserIcon;
	title: string;
	sub: string;
	checked: boolean;
	onChange: (next: boolean) => void;
	id: string;
}) {
	return (
		<div className="flex items-center justify-between gap-4 rounded-[var(--radius-card)] border border-border bg-paper-alt px-4 py-3.5">
			<div className="flex items-start gap-3">
				<span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface text-brass-deep">
					<Icon className="size-4" aria-hidden="true" />
				</span>
				<div>
					{/* A span, not a <label> — the Switch renders a button, which
					    `htmlFor` can't target; aria-labelledby is what associates them. */}
					<span id={id} className="font-semibold text-[13.5px] text-ink">
						{title}
					</span>
					<p className="mt-0.5 text-[12.5px] text-muted-foreground leading-relaxed">
						{sub}
					</p>
				</div>
			</div>
			<Switch
				aria-labelledby={id}
				checked={checked}
				onCheckedChange={onChange}
			/>
		</div>
	);
}

function CharCount({ value, max }: { value: string; max: number }) {
	const over = value.length > max;
	return (
		<span
			className={cn(
				"font-mono text-[11.5px] tabular-nums",
				over ? "font-semibold text-danger" : "text-muted-foreground",
			)}
		>
			{value.length}/{max}
		</span>
	);
}

export function AttorneyProfileForm({
	profile,
	account,
}: {
	profile: AttorneyProfileData | null;
	account: AttorneyAccount;
}) {
	const ids = {
		legalName: useId(),
		firmName: useId(),
		officeCity: useId(),
		officeState: useId(),
		contactEmail: useId(),
		contactPhone: useId(),
		websiteUrl: useId(),
		feeMin: useId(),
		feeMax: useId(),
		bio: useId(),
		background: useId(),
		accepting: useId(),
		virtual: useId(),
	};

	const initial = useMemo(
		() => buildInitial(profile, account),
		[profile, account],
	);

	// What's currently stored, for the unsaved-changes indicator. Advances on a
	// successful save so the form settles without a page reload.
	const [baseline, setBaseline] = useState(initial);

	const [legalName, setLegalName] = useState(initial.legalName);
	const [firmName, setFirmName] = useState(initial.firmName);
	const [officeCity, setOfficeCity] = useState(initial.officeCity);
	const [officeState, setOfficeState] = useState(initial.officeState);
	const [contactEmail, setContactEmail] = useState(initial.contactEmail);
	const [contactPhone, setContactPhone] = useState(initial.contactPhone);
	const [websiteUrl, setWebsiteUrl] = useState(initial.websiteUrl);
	const [headshotUrl, setHeadshotUrl] = useState(initial.headshotUrl);
	const [practiceAreas, setPracticeAreas] = useState<string[]>(
		initial.practiceAreas,
	);
	const [languages, setLanguages] = useState<string[]>(initial.languages);
	const [acceptingNewCases, setAcceptingNewCases] = useState(
		initial.acceptingNewCases,
	);
	const [virtualConsultation, setVirtualConsultation] = useState(
		initial.virtualConsultation,
	);
	const [feeApproach, setFeeApproach] = useState<FeeApproach | "">(
		initial.feeApproach,
	);
	const [feeMin, setFeeMin] = useState(initial.feeMin);
	const [feeMax, setFeeMax] = useState(initial.feeMax);
	const [bio, setBio] = useState(initial.bio);
	const [background, setBackground] = useState(initial.background);

	const [tab, setTab] = useState<Tab>("photo");
	// Fields the attorney has finished with. Format errors stay hidden until then,
	// so a half-typed email isn't flagged on the second keystroke.
	const [touched, setTouched] = useState<Record<string, boolean>>({});
	const [uploading, setUploading] = useState(false);
	const headshotInput = useRef<HTMLInputElement>(null);

	const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
		"idle",
	);

	const showFeeRange = feeRangeApplies(feeApproach);
	const current: FormValues = {
		legalName,
		firmName,
		officeCity,
		officeState,
		contactEmail,
		contactPhone,
		websiteUrl,
		headshotUrl,
		practiceAreas,
		languages,
		acceptingNewCases,
		virtualConsultation,
		feeApproach,
		feeMin: showFeeRange ? feeMin : "",
		feeMax: showFeeRange ? feeMax : "",
		bio,
		background,
	};
	const snapshot = fingerprint(current);
	const dirty = snapshot !== fingerprint(baseline);

	// Latest values, readable by a save that was queued behind another one — it
	// must send what's on screen now, not what was there when it was scheduled.
	const latest = useRef(current);
	latest.current = current;

	// The snapshot last written to the server, so an unchanged form never
	// re-saves. Starts at the stored values.
	const savedSnapshot = useRef(fingerprint(initial));
	const inFlight = useRef(false);
	const queued = useRef(false);

	const [savedAt, setSavedAt] = useState<number | null>(null);
	// Bio moderation state, kept locally so the badge reacts to a save without a
	// round-trip to the server component.
	const [bioPending, setBioPending] = useState(
		profile?.bioStatus === "pending",
	);
	// Last-known flags, so the one-off toasts fire on the transition rather than
	// on every save. Seeded from what's already stored — an already-complete
	// profile shouldn't announce itself the first time an unrelated field changes.
	const readyRef = useRef(isDirectoryReady(initial));
	const bioPendingRef = useRef(profile?.bioStatus === "pending");

	const persist = useCallback(async function persist(): Promise<void> {
		// One request at a time; a change arriving mid-flight re-runs after, so
		// nothing is dropped and responses can't land out of order.
		if (inFlight.current) {
			queued.current = true;
			return;
		}
		const values = latest.current;
		const sending = fingerprint(values);
		if (sending === savedSnapshot.current) return;

		inFlight.current = true;
		setStatus("saving");
		try {
			const res = await saveAttorneyProfileAction(toPayload(values));
			if (res.ok) {
				savedSnapshot.current = sending;
				setBaseline(values);
				setStatus("saved");
				setSavedAt(res.savedAt);
				// Announce the moment the listing first has everything it needs.
				if (res.directoryReady && !readyRef.current) {
					toast.success("Your listing now has everything the directory needs.");
				}
				readyRef.current = res.directoryReady;
				if (res.bioPending && !bioPendingRef.current) {
					toast.info("Your bio will be reviewed before it appears publicly.");
				}
				bioPendingRef.current = res.bioPending;
				setBioPending(res.bioPending);
			} else {
				setStatus("error");
			}
		} catch {
			setStatus("error");
		} finally {
			inFlight.current = false;
			if (queued.current) {
				queued.current = false;
				void persist();
			}
		}
	}, []);

	// Autosave: fire once the form has been quiet for a moment. Rescheduled on
	// every change, so it never interrupts typing.
	useEffect(() => {
		if (snapshot === savedSnapshot.current) return;
		const timer = setTimeout(() => void persist(), AUTOSAVE_DELAY_MS);
		return () => clearTimeout(timer);
	}, [snapshot, persist]);

	// Leaving inside the debounce window would lose the last thing typed — the one
	// case autosave exists to prevent. Flush on the way out: `pagehide` covers
	// closing the tab and back/forward, the cleanup covers navigating within the
	// app. Deps are stable, so the cleanup only runs on unmount.
	useEffect(() => {
		const flush = () => {
			if (fingerprint(latest.current) !== savedSnapshot.current) void persist();
		};
		window.addEventListener("pagehide", flush);
		return () => {
			window.removeEventListener("pagehide", flush);
			flush();
		};
	}, [persist]);

	/**
	 * What "a complete listing" means, item by item, for the progress readout.
	 *
	 * Deliberately more than the fields a listing strictly needs: a profile with
	 * no photo and no bio would otherwise report 100% while being a weak listing.
	 * Equally deliberately, it leaves out fields plenty of attorneys will never
	 * have — firm name (solos), phone, website, a fee range — because an indicator
	 * nobody can ever finish just nags.
	 *
	 * The `required: true` rows come from `requiredChecks`, so "100% of the
	 * required items" and "directory-ready" can't disagree.
	 */
	const req = requiredChecks(current);
	const completion: {
		tab: Tab;
		label: string;
		done: boolean;
		required: boolean;
	}[] = [
		{ tab: "photo", label: "Legal name", done: req.legalName, required: true },
		{
			tab: "office",
			label: "Office city",
			done: req.officeCity,
			required: true,
		},
		{
			tab: "office",
			label: "Office state",
			done: req.officeState,
			required: true,
		},
		{
			tab: "office",
			label: "Contact email",
			done: req.contactEmail,
			required: true,
		},
		{ tab: "photo", label: "Photo", done: !!headshotUrl, required: false },
		{
			tab: "areas",
			label: "Practice area",
			done: req.practiceAreas,
			required: true,
		},
		{
			tab: "languages",
			label: "Languages",
			done: languages.length > 0,
			required: false,
		},
		{
			tab: "fees",
			label: "Fee approach",
			done: req.feeApproach,
			required: true,
		},
		{ tab: "about", label: "Bio", done: !!bio.trim(), required: false },
		{
			tab: "about",
			label: "Background",
			done: !!background.trim(),
			required: false,
		},
	];

	// Directory-ready is the required fields only — a lower bar than 100%, which
	// also counts the recommended ones.
	const ready = isDirectoryReady(current);
	const doneCount = completion.filter((c) => c.done).length;
	const pct = Math.round((doneCount / completion.length) * 100);
	const missing = completion.filter((c) => !c.done);
	// Required gaps first — they're what actually blocks the listing.
	const missingRanked = [
		...missing.filter((m) => m.required),
		...missing.filter((m) => !m.required),
	];

	const tabIsComplete = (key: Tab) =>
		completion.every((c) => c.tab !== key || c.done);

	function toggleArea(area: string) {
		setPracticeAreas((prev) =>
			prev.includes(area)
				? prev.filter((a) => a !== area)
				: prev.length >= MAX_AREAS
					? prev
					: [...prev, area],
		);
	}

	function toggleLanguage(lang: string) {
		setLanguages((prev) =>
			prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
		);
	}

	async function onPickHeadshot(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setUploading(true);
		try {
			setHeadshotUrl(await uploadHeadshot(file));
		} catch {
			toast.error("Couldn't upload that photo. Please try again.");
		} finally {
			setUploading(false);
			// Let the same file be picked again after a failure.
			e.target.value = "";
		}
	}

	/**
	 * Values that can't be stored as typed.
	 *
	 * Autosave silently skips anything invalid rather than overwriting a good
	 * value with a broken one — which means these have to be visible, or the
	 * attorney would believe a malformed email had saved. Shown only once the
	 * field has been left, and only for the formats that can actually be wrong;
	 * missing required fields are the progress card's job, not an error.
	 */
	const formatErrors: Record<string, string> = {};
	if (contactEmail.trim() && !EMAIL_PATTERN.test(contactEmail.trim())) {
		formatErrors.contactEmail = "Enter a valid email — this isn't saved yet.";
	}
	if (contactPhone.trim() && !isValidPhone(contactPhone)) {
		formatErrors.contactPhone = `${PHONE_MESSAGE} — this isn't saved yet.`;
	}
	if (websiteUrl.trim() && !URL_PATTERN.test(websiteUrl.trim())) {
		formatErrors.websiteUrl = "Include https:// — this isn't saved yet.";
	}
	if (showFeeRange) {
		const min = dollarsToCents(feeMin);
		const max = dollarsToCents(feeMax);
		if (min !== null && max !== null && min > max) {
			formatErrors.feeRangeMaxCents =
				"The top of your range must be at least the bottom.";
		}
	}
	const errors = Object.fromEntries(
		Object.entries(formatErrors).filter(([field]) => touched[field]),
	);

	function markTouched(field: string) {
		setTouched((t) => (t[field] ? t : { ...t, [field]: true }));
	}

	// Reflects the bio actually stored, not what's being typed — an unsaved edit
	// hasn't been submitted for review yet. `bioPending` comes from the last save,
	// so editing an approved bio flips the badge without a page reload.
	const savedBio = baseline.bio.trim();
	const bioBadge = !savedBio
		? null
		: bioPending
			? {
					icon: Clock3,
					text: "Bio in review",
					className: "bg-brass-wash text-brass-deep",
				}
			: profile?.bioStatus === "rejected"
				? {
						icon: CircleAlert,
						text: "Bio needs changes",
						className: "bg-danger/10 text-danger",
					}
				: {
						icon: BadgeCheck,
						text: "Bio approved",
						className: "bg-green-soft text-green-deep",
					};

	return (
		// Full-bleed, matching the shell's CONTENT_COLUMN: the cards fill whatever
		// width the sidebar leaves rather than sitting in a fixed centre column.
		<div className="flex w-full flex-col gap-6">
			{/* Listing status: how far along the profile is, plus the note about what
			    still gates it going public. One block, because they're one thought. */}
			<section className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<div>
						<div className="flex flex-wrap items-center gap-2.5">
							<h2 className="font-bold text-[16px] text-ink">
								{pct === 100
									? "Your listing is complete"
									: "Your listing so far"}
							</h2>
							{/* Readiness is a lower bar than 100%: the required fields only.
							    Worth calling out separately, because it's the line between a
							    listing that can appear in the directory and one that can't. */}
							{ready && (
								<span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-green-soft px-2.5 py-1 font-semibold text-[12px] text-green-deep">
									<BadgeCheck className="size-3.5" aria-hidden="true" />
									Ready for the directory
								</span>
							)}
						</div>
						<p className="mt-0.5 text-[13px] text-muted-foreground leading-relaxed">
							{pct === 100
								? "Everything a plaintiff looks for is filled in."
								: "Still to add — pick one to jump straight to it:"}
						</p>
					</div>
					<p
						className={cn(
							"font-extrabold text-[26px] tabular-nums leading-none tracking-[-0.02em]",
							pct === 100 ? "text-green-deep" : "text-ink",
						)}
					>
						{pct}%
					</p>
				</div>

				<div
					className="mt-4 h-2.5 overflow-hidden rounded-full bg-brass-wash"
					role="progressbar"
					aria-valuenow={pct}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-label="Profile completeness"
				>
					<div
						className={cn(
							"h-full rounded-full transition-all duration-300",
							pct === 100
								? "bg-success"
								: "bg-gradient-to-r from-brass to-brass-deep",
						)}
						// A sliver of bar at 0% reads as "started", not broken.
						style={{ width: `${Math.max(2, pct)}%` }}
					/>
				</div>

				{/* Quick links: every gap is a button to the tab that fixes it, so the
				    readout is actionable instead of just telling you what's wrong.
				    Required gaps come first and carry the same * as the field labels. */}
				{missingRanked.length > 0 && (
					<div className="mt-4 flex flex-wrap gap-2">
						{missingRanked.map((m) => {
							const target = TABS.find((t) => t.key === m.tab);
							return (
								<button
									key={m.label}
									type="button"
									onClick={() => setTab(m.tab)}
									aria-label={`Add ${m.label} — go to ${target?.label}`}
									className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-line-strong bg-surface px-3 py-1.5 font-semibold text-[12.5px] text-ink-soft transition-colors hover:border-brass hover:bg-brass-wash hover:text-brass-deep"
								>
									{m.label}
									{m.required && (
										<span className="text-brass-deep" aria-hidden="true">
											*
										</span>
									)}
									<ArrowRight
										className="size-3 text-muted-foreground"
										aria-hidden="true"
									/>
								</button>
							);
						})}
					</div>
				)}
				{missingRanked.some((m) => m.required) && (
					<p className="mt-2.5 text-[12px] text-muted-foreground">
						<span className="text-brass-deep">*</span> needed before you can
						save.
					</p>
				)}

				<p className="mt-4 flex items-start gap-2.5 text-[12.5px] text-brass-deep leading-relaxed">
					<Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					<span>
						This is what plaintiffs see when they're choosing an attorney. Your
						bar standing is verified separately — your listing goes public once
						that's confirmed.
					</span>
				</p>
			</section>

			{/* Tab bar. Errors are counted per tab so a problem on a tab you're not
			    looking at still announces itself. */}
			<div className="flex flex-wrap gap-2">
				{TABS.map((t) => {
					const active = t.key === tab;
					const bad = errorCount(t, errors);
					return (
						<button
							key={t.key}
							type="button"
							onClick={() => setTab(t.key)}
							aria-current={active ? "true" : undefined}
							className={cn(
								"inline-flex items-center gap-2 rounded-[var(--radius-pill)] border px-4 py-2 font-semibold text-[13px] transition-colors",
								active
									? "border-ink bg-ink text-paper"
									: "border-border bg-surface text-ink-soft hover:border-brass-deep hover:text-ink",
							)}
						>
							{t.label}
							{/* An error badge outranks the completion tick — a tab can be
							    "filled in" and still hold an invalid value. */}
							{bad > 0 ? (
								<span
									className={cn(
										"flex size-[18px] items-center justify-center rounded-full font-bold text-[11px] tabular-nums",
										active ? "bg-paper text-danger" : "bg-danger text-white",
									)}
								>
									{bad}
									<span className="sr-only">
										{bad === 1
											? " field needs attention"
											: " fields need attention"}
									</span>
								</span>
							) : (
								tabIsComplete(t.key) && (
									<span
										className={cn(
											"flex size-[18px] items-center justify-center rounded-full",
											active
												? "bg-paper/20 text-paper"
												: "bg-green-soft text-green-deep",
										)}
									>
										<Check className="size-3" aria-hidden="true" />
										<span className="sr-only"> complete</span>
									</span>
								)
							)}
						</button>
					);
				})}
			</div>

			{tab === "photo" && (
				<Section
					icon={UserIcon}
					title="Photo & name"
					sub="Your legal name must match your bar record — it's what we verify against."
				>
					<div className="flex flex-col gap-6 sm:flex-row sm:items-start">
						<div className="flex flex-col items-center gap-2.5">
							{headshotUrl ? (
								<div className="relative">
									<img
										src={headshotUrl}
										alt="Your headshot"
										className="size-[124px] rounded-full border border-border object-cover"
									/>
									<button
										type="button"
										onClick={() => setHeadshotUrl(null)}
										className="absolute -top-1 -right-1 flex size-7 items-center justify-center rounded-full border border-border bg-surface text-danger shadow-[var(--shadow-rest)] transition-colors hover:bg-danger/10"
										aria-label="Remove headshot"
									>
										<X className="size-3.5" aria-hidden="true" />
									</button>
								</div>
							) : (
								<button
									type="button"
									onClick={() => headshotInput.current?.click()}
									disabled={uploading}
									className="flex size-[124px] flex-col items-center justify-center gap-1.5 rounded-full border border-line-strong border-dashed bg-paper-alt text-muted-foreground transition-colors hover:border-brass hover:border-solid hover:text-ink disabled:opacity-70"
								>
									{uploading ? (
										<Upload
											className="size-5 animate-pulse"
											aria-hidden="true"
										/>
									) : (
										<UserIcon className="size-6" aria-hidden="true" />
									)}
									<span className="text-[11.5px]">
										{uploading ? "Uploading…" : "Add photo"}
									</span>
								</button>
							)}
							{headshotUrl && (
								<button
									type="button"
									onClick={() => headshotInput.current?.click()}
									disabled={uploading}
									className="font-semibold text-[12.5px] text-brass-deep underline-offset-2 hover:underline disabled:opacity-70"
								>
									{uploading ? "Uploading…" : "Replace photo"}
								</button>
							)}
							<input
								ref={headshotInput}
								type="file"
								accept="image/jpeg,image/png,image/webp"
								className="hidden"
								onChange={onPickHeadshot}
							/>
						</div>

						<div className="flex flex-1 flex-col gap-5">
							<Field
								label="Legal name"
								htmlFor={ids.legalName}
								required
								error={errors.legalName}
								hint="As it appears on the bar record."
							>
								<Input
									id={ids.legalName}
									className={INPUT_CLASS}
									value={legalName}
									onChange={(e) => setLegalName(e.target.value)}
									placeholder="Marcus A. Bell"
									aria-invalid={!!errors.legalName}
								/>
							</Field>
							<Field
								label="Firm"
								htmlFor={ids.firmName}
								error={errors.firmName}
								hint="Leave blank if you practise solo."
							>
								<Input
									id={ids.firmName}
									className={INPUT_CLASS}
									value={firmName}
									onChange={(e) => setFirmName(e.target.value)}
									placeholder="Bell & Associates"
									aria-invalid={!!errors.firmName}
								/>
							</Field>
						</div>
					</div>
				</Section>
			)}

			{tab === "office" && (
				<Section
					icon={MapPin}
					title="Office & contact"
					sub="Your primary office and how a plaintiff reaches you."
				>
					<div className="flex flex-col gap-5">
						<div className="grid gap-4 sm:grid-cols-2">
							<Field
								label="Office city"
								htmlFor={ids.officeCity}
								required
								error={errors.officeCity}
							>
								<Input
									id={ids.officeCity}
									className={INPUT_CLASS}
									value={officeCity}
									onChange={(e) => setOfficeCity(e.target.value)}
									placeholder="Atlanta"
									aria-invalid={!!errors.officeCity}
								/>
							</Field>
							<Field
								label="Office state"
								htmlFor={ids.officeState}
								required
								error={errors.officeState}
								hint="Your single primary office."
							>
								<Select
									value={officeState}
									onValueChange={(v: string | null) => setOfficeState(v ?? "")}
								>
									<SelectTrigger
										id={ids.officeState}
										className="h-11 bg-surface text-[14px]"
										aria-invalid={!!errors.officeState}
									>
										<SelectValue placeholder="Select a state…" />
									</SelectTrigger>
									<SelectContent className="max-h-[300px]">
										{US_STATES.map((s) => (
											<SelectItem key={s} value={s} className="text-[14px]">
												{s}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
						</div>

						{/* Three-up once there's room — the full-width card has space for
							    the whole contact block on one line. */}
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							<Field
								label="Contact email"
								htmlFor={ids.contactEmail}
								required
								error={errors.contactEmail}
							>
								<div className="relative">
									<Mail
										className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
										aria-hidden="true"
									/>
									<Input
										id={ids.contactEmail}
										onBlur={() => markTouched("contactEmail")}
										type="email"
										className={cn(INPUT_CLASS, "pl-9")}
										value={contactEmail}
										onChange={(e) => setContactEmail(e.target.value)}
										placeholder="marcus@bellassociates.com"
										aria-invalid={!!errors.contactEmail}
									/>
								</div>
							</Field>
							<Field
								label="Contact phone"
								htmlFor={ids.contactPhone}
								error={errors.contactPhone}
							>
								<div className="relative">
									<Phone
										className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
										aria-hidden="true"
									/>
									<Input
										id={ids.contactPhone}
										onBlur={() => markTouched("contactPhone")}
										type="tel"
										inputMode="tel"
										className={cn(INPUT_CLASS, "pl-9")}
										value={contactPhone}
										onChange={(e) =>
											setContactPhone(
												reformatPhone(e.target.value, contactPhone),
											)
										}
										placeholder="(404) 555-0142"
										aria-invalid={!!errors.contactPhone}
									/>
								</div>
							</Field>
							<Field
								label="Website"
								htmlFor={ids.websiteUrl}
								error={errors.websiteUrl}
							>
								<div className="relative">
									<Globe
										className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
										aria-hidden="true"
									/>
									<Input
										id={ids.websiteUrl}
										onBlur={() => markTouched("websiteUrl")}
										type="url"
										className={cn(INPUT_CLASS, "pl-9")}
										value={websiteUrl}
										onChange={(e) => setWebsiteUrl(e.target.value)}
										placeholder="https://bellassociates.com"
										aria-invalid={!!errors.websiteUrl}
									/>
								</div>
							</Field>
						</div>
					</div>
				</Section>
			)}

			{tab === "areas" && (
				<Section
					icon={Scale}
					title="Practice areas"
					sub={`Pick the areas you take cases in — up to ${MAX_AREAS}. Plaintiffs are matched to you on these.`}
				>
					<div className="flex flex-wrap gap-2">
						{PRACTICE_AREAS.map((area) => (
							<Chip
								key={area}
								label={area}
								selected={practiceAreas.includes(area)}
								disabled={practiceAreas.length >= MAX_AREAS}
								onToggle={() => toggleArea(area)}
							/>
						))}
					</div>
					{errors.practiceAreas && (
						<p className="mt-2.5 text-[12px] text-danger">
							{errors.practiceAreas}
						</p>
					)}
					<p className="mt-2.5 text-[12px] text-muted-foreground">
						{practiceAreas.length}/{MAX_AREAS} selected
						{practiceAreas.length >= MAX_AREAS &&
							" — deselect one to choose another."}
					</p>
				</Section>
			)}

			{tab === "languages" && (
				<Section
					icon={LanguagesIcon}
					title="Languages"
					sub="Languages you can work a case in, beyond your own notes."
				>
					<div className="flex flex-wrap gap-2">
						{LANGUAGES.map((lang) => (
							<Chip
								key={lang}
								label={lang}
								selected={languages.includes(lang)}
								onToggle={() => toggleLanguage(lang)}
							/>
						))}
					</div>
					{errors.languages && (
						<p className="mt-2.5 text-[12px] text-danger">{errors.languages}</p>
					)}
				</Section>
			)}

			{tab === "availability" && (
				<Section
					icon={Building2}
					title="Availability"
					sub="Whether you're taking work right now, and how you'll meet."
				>
					<div className="flex flex-col gap-3">
						<ToggleRow
							id={ids.accepting}
							icon={BadgeCheck}
							title="Accepting new cases"
							sub="Turn this off and you stay listed, but new cases won't be routed to you."
							checked={acceptingNewCases}
							onChange={setAcceptingNewCases}
						/>
						<ToggleRow
							id={ids.virtual}
							icon={Globe}
							title="Offers virtual consultations"
							sub="You'll meet a prospective client by video or phone."
							checked={virtualConsultation}
							onChange={setVirtualConsultation}
						/>
					</div>
				</Section>
			)}

			{tab === "fees" && (
				<Section
					icon={Wallet}
					title="Fees"
					sub="How you charge. Plaintiffs raise the fee before you file, so being clear here matters."
				>
					<div className="flex flex-col gap-5">
						<div>
							<span className="mb-2 block font-semibold text-[13px] text-ink">
								Fee approach
								<span className="ml-1 text-brass-deep" aria-hidden="true">
									*
								</span>
							</span>
							<div className="grid gap-2.5 sm:grid-cols-2">
								{FEE_APPROACHES.map((f) => {
									const active = feeApproach === f.value;
									return (
										<button
											key={f.value}
											type="button"
											aria-pressed={active}
											onClick={() => {
												setFeeApproach(f.value);
											}}
											className={cn(
												"flex items-start gap-3 rounded-[var(--radius-card)] border p-4 text-left transition-all",
												active
													? "border-brass bg-brass-wash ring-1 ring-brass"
													: "border-border bg-surface hover:border-brass-deep",
											)}
										>
											<span
												className={cn(
													"mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
													active
														? "border-brass bg-brass text-white"
														: "border-line-strong",
												)}
											>
												{active && (
													<Check className="size-3" aria-hidden="true" />
												)}
											</span>
											<span>
												<span className="block font-bold text-[14px] text-ink">
													{f.label}
												</span>
												<span className="mt-0.5 block text-[12.5px] text-muted-foreground leading-relaxed">
													{f.blurb}
												</span>
											</span>
										</button>
									);
								})}
							</div>
							{errors.feeApproach && (
								<p className="mt-2 text-[12px] text-danger">
									{errors.feeApproach}
								</p>
							)}
						</div>

						{showFeeRange ? (
							<div className="grid gap-4 sm:grid-cols-2">
								<Field
									label="Typical fee from"
									htmlFor={ids.feeMin}
									error={errors.feeRangeMinCents}
									hint={feeApproach === "hourly" ? "Per hour." : undefined}
								>
									<div className="relative">
										<span
											className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-muted-foreground"
											aria-hidden="true"
										>
											$
										</span>
										<Input
											id={ids.feeMin}
											onBlur={() => markTouched("feeRangeMaxCents")}
											className={cn(INPUT_CLASS, "pl-7 tabular-nums")}
											inputMode="numeric"
											value={feeMin}
											onChange={(e) =>
												setFeeMin(e.target.value.replace(/[^0-9]/g, ""))
											}
											placeholder="2,500"
											aria-invalid={!!errors.feeRangeMinCents}
										/>
									</div>
								</Field>
								<Field
									label="Typical fee to"
									htmlFor={ids.feeMax}
									error={errors.feeRangeMaxCents}
									hint={
										feeApproach === "hourly"
											? "Per hour."
											: "Leave blank if it varies too much."
									}
								>
									<div className="relative">
										<span
											className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-muted-foreground"
											aria-hidden="true"
										>
											$
										</span>
										<Input
											id={ids.feeMax}
											onBlur={() => markTouched("feeRangeMaxCents")}
											className={cn(INPUT_CLASS, "pl-7 tabular-nums")}
											inputMode="numeric"
											value={feeMax}
											onChange={(e) =>
												setFeeMax(e.target.value.replace(/[^0-9]/g, ""))
											}
											placeholder="9,000"
											aria-invalid={!!errors.feeRangeMaxCents}
										/>
									</div>
								</Field>
							</div>
						) : feeApproach === "contingency" ? (
							<p className="rounded-[var(--radius-card-sm)] bg-green-soft px-4 py-3 text-[13px] text-green-deep leading-relaxed">
								Contingency work is a share of the recovery, so there's no fee
								range to state. You'll agree the share with the plaintiff
								directly.
							</p>
						) : null}
					</div>
				</Section>
			)}

			{tab === "about" && (
				<Section
					icon={Sparkles}
					title="About you"
					sub="Your bio is reviewed before it first appears publicly. Everything else saves immediately."
				>
					<div className="flex flex-col gap-5">
						<Field label="Bio" htmlFor={ids.bio} error={errors.bio}>
							<Textarea
								id={ids.bio}
								className={TEXTAREA_CLASS}
								value={bio}
								onChange={(e) => setBio(e.target.value)}
								rows={5}
								maxLength={BIO_MAX}
								placeholder="How you work with clients, and the kind of cases you take on."
								aria-invalid={!!errors.bio}
							/>
							<div className="flex items-center justify-between">
								<span className="text-[12px] text-muted-foreground">
									Shown on your directory listing once reviewed.
								</span>
								<CharCount value={bio} max={BIO_MAX} />
							</div>
						</Field>

						{bioBadge && (
							<span
								className={cn(
									"inline-flex w-fit items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 font-semibold text-[12px]",
									bioBadge.className,
								)}
							>
								<bioBadge.icon className="size-3.5" aria-hidden="true" />
								{bioBadge.text}
							</span>
						)}

						<Field
							label="Background"
							htmlFor={ids.background}
							error={errors.background}
						>
							<Textarea
								id={ids.background}
								className={TEXTAREA_CLASS}
								value={background}
								onChange={(e) => setBackground(e.target.value)}
								rows={4}
								maxLength={BACKGROUND_MAX}
								placeholder="Education and prior roles — where you studied and where you've practised."
								aria-invalid={!!errors.background}
							/>
							<div className="flex items-center justify-between">
								<span className="text-[12px] text-muted-foreground">
									Education and prior roles.
								</span>
								<CharCount value={background} max={BACKGROUND_MAX} />
							</div>
						</Field>
					</div>
				</Section>
			)}

			{/* Autosave bar — outside the tabs, because one save covers all of them.
			    The button is a manual nudge, not the only way to persist: it just
			    skips the debounce for anyone who wants to see it land. */}
			<div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-[var(--radius-card)] border border-border bg-surface/95 px-4 py-3 shadow-[var(--shadow-float)] backdrop-blur-sm">
				<span
					className={cn(
						"mr-auto flex items-center gap-2 text-[13px]",
						status === "error" ? "text-danger" : "text-muted-foreground",
					)}
					// Announced politely so a screen reader hears saves without being
					// interrupted mid-field.
					aria-live="polite"
				>
					{status === "saving" ? (
						<>
							<Upload className="size-3.5 animate-pulse" aria-hidden="true" />
							Saving…
						</>
					) : status === "error" ? (
						<>
							<CircleAlert className="size-3.5" aria-hidden="true" />
							Couldn't save — your changes are still here. Retrying on the next
							edit.
						</>
					) : dirty ? (
						"Unsaved changes — saving shortly…"
					) : savedAt ? (
						<>
							<Check className="size-3.5 text-success" aria-hidden="true" />
							Saved automatically
						</>
					) : profile ? (
						"Changes save automatically."
					) : (
						"Your profile saves automatically as you fill it in."
					)}
				</span>
				<Button
					onClick={() => void persist()}
					disabled={!dirty || status === "saving"}
					variant="outline"
					className="px-5"
				>
					<Save data-icon="inline-start" aria-hidden="true" />
					Save now
				</Button>
			</div>
		</div>
	);
}
