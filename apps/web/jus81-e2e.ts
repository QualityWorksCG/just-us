/**
 * Browser acceptance suite for bring-your-own-attorney invitations and case
 * linking. Seeds one plaintiff, one bar-verified attorney, and five published
 * cases with live invitations, drives the running dev server with Playwright
 * across five isolated browser contexts, then deletes every row it created.
 *
 * Prerequisites:
 *   Chromium, once per machine:
 *     bunx playwright install chromium
 *   A dev server on http://localhost:3001, started with email sending off:
 *     cd apps/web && RESEND_API_KEY="" bun run dev
 *   apps/web/.env is a symlink to the repo-root .env, so the rest of the
 *   environment still loads. The empty key is what keeps real mail from going
 *   out — the env package reads an empty string as undefined, and the email
 *   layer then logs instead of sending. It matters more here than elsewhere:
 *   a failed send revokes the invitation and reverts the publish, so a server
 *   holding a real key would both mail example.com and fail step 1.
 *
 * Run from apps/web:  bun run e2e:jus81
 *
 * Allow several minutes. Sign-in attempts are IP rate-limited; the suite
 * mirrors that budget so a 429 never masks the flow under test.
 */
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { auth, SIGN_IN_RATE_LIMIT_MAX } from "@just-us/auth";
import { generateInviteToken } from "@just-us/auth/invite-token";
import prisma from "@just-us/db";
import {
	CASE_INVITATION_TTL_DAYS,
	upsertCaseInvitationForPublish,
} from "@just-us/db/case-invitations";
import {
	type Browser,
	type BrowserContext,
	chromium,
	type Locator,
	type Page,
} from "playwright";

const BASE = "http://localhost:3001";
const PASSWORD = "E2ePass!234";
const TAG = "jus81e2e";
const DAY = 24 * 60 * 60 * 1000;
const SHOTS = join(tmpdir(), "jus81-e2e-failures");

/** Dev-server routes compile on first hit, so navigations get a long ceiling. */
const NAV = 60000;

const STATE = "New York";
const CATEGORY = "Employment";
/** The wizard refuses to publish without a cover, and uploading one would go to
 *  Vercel Blob. The draft this suite resumes carries the URL instead. */
const COVER = "https://example.com/jus81e2e-cover.png";

const STORY =
	"On 3 March my employer stopped paying the overtime hours I had already worked, then told me the timekeeping records were gone. I kept my own timesheets and the messages from my supervisor asking me to stay late.";

const PLAINTIFF_NAME = "Petra Vance";
const ATTORNEY_NAME = "Avery Cole";

const EMAILS = {
	plaintiff: `${TAG}-plaintiff@example.com`,
	attorney: `${TAG}-attorney@example.com`,
	invitee: `${TAG}-invitee@example.com`,
	lapsed: `${TAG}-lapsed@example.com`,
	nobody: `${TAG}-nobody@example.com`,
	newbie: `${TAG}-newbie@example.com`,
	elsewhere: `${TAG}-elsewhere@example.com`,
};

const CASES = {
	one: {
		id: `${TAG}-case-1`,
		title: `${TAG} Warehouse overtime withheld`,
		attorney: "Rosa Delgado",
	},
	two: {
		id: `${TAG}-case-2`,
		title: `${TAG} Lapsed link deposit claim`,
		attorney: "Lena Whitfield",
	},
	three: {
		id: `${TAG}-case-3`,
		title: `${TAG} Retaliation after reporting`,
		attorney: ATTORNEY_NAME,
	},
	four: {
		id: `${TAG}-case-4`,
		title: `${TAG} Eviction defence filing`,
		attorney: "Desmond Park",
	},
	five: {
		id: `${TAG}-case-5`,
		title: `${TAG} Unpaid commission claim`,
		attorney: "Marcus Ellery",
	},
	six: {
		id: `${TAG}-case-6`,
		title: `${TAG} Misaddressed invitation claim`,
		attorney: "Nadia Brooks",
	},
};

type Note = (line: string) => void;
type Seeded = { token: string; invitationId: string };
type Result = {
	n: number;
	title: string;
	pass: boolean;
	evidence: string[];
	error?: string;
	shot?: string;
};

const results: Result[] = [];
let currentPage: Page | null = null;

function log(line: string) {
	console.log(`[${new Date().toISOString().slice(11, 19)}] ${line}`);
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Screens use CSS uppercase on badges and eyebrows, and innerText reports the
 *  transformed text — so every copy check is case-insensitive. */
function has(haystack: string, needle: string) {
	return haystack.toLowerCase().includes(needle.toLowerCase());
}

function escapeRe(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function step(
	n: number,
	title: string,
	body: (note: Note) => Promise<void>,
) {
	log(`--- ${n}. ${title}`);
	const evidence: string[] = [];
	try {
		await body((line) => {
			log(`      · ${line}`);
			evidence.push(line);
		});
		results.push({ n, title, pass: true, evidence });
		log(`PASS ${n}`);
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		let shot: string | undefined;
		if (currentPage) {
			const path = join(
				SHOTS,
				`${n}-${title.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.png`,
			);
			try {
				await currentPage.screenshot({ path, fullPage: true });
				shot = path;
			} catch {}
		}
		results.push({ n, title, pass: false, evidence, error, shot });
		log(`FAIL ${n} — ${error}${shot ? ` (shot: ${shot})` : ""}`);
	}
}

/** Retries until the predicate returns anything other than false. */
async function poll<T>(
	label: string,
	predicate: () => Promise<T | false>,
	timeout = 15000,
	interval = 300,
): Promise<T> {
	const started = Date.now();
	let last = "";
	for (;;) {
		try {
			const out = await predicate();
			if (out !== false) return out;
			last = "predicate false";
		} catch (err) {
			last = err instanceof Error ? err.message : String(err);
		}
		if (Date.now() - started > timeout) {
			throw new Error(`timed out waiting for ${label} (${last})`);
		}
		await sleep(interval);
	}
}

/** The masking the invite hub applies to an address it will not hand over. Kept
 *  in step with `maskEmail` in app/case-invite/page.tsx. */
function maskEmail(email: string) {
	const [local = "", domain] = email.split("@");
	if (!domain) return "•••";
	const shown =
		local.length <= 2
			? "•".repeat(Math.max(local.length, 2))
			: `${local[0]}${"•".repeat(Math.max(local.length - 2, 1))}${local.at(-1)}`;
	return `${shown}@${domain}`;
}

// --------------------------------------------------------------- seed and purge

/**
 * Every row this suite can create. Audit entries go first — the actor relation
 * is Restrict, and an anonymous decline leaves a row with no actor at all, so
 * those are found by the invitation they point at rather than by who wrote them.
 */
async function purge() {
	const userIds = (
		await prisma.user.findMany({
			where: { email: { startsWith: TAG } },
			select: { id: true },
		})
	).map((row) => row.id);
	const caseIds = (
		await prisma.case.findMany({
			where: {
				OR: [{ id: { startsWith: TAG } }, { ownerId: { in: userIds } }],
			},
			select: { id: true },
		})
	).map((row) => row.id);
	const invitationIds = (
		await prisma.caseInvitation.findMany({
			where: {
				OR: [{ caseId: { in: caseIds } }, { email: { startsWith: TAG } }],
			},
			select: { id: true },
		})
	).map((row) => row.id);

	const audit = await prisma.auditLog.deleteMany({
		where: {
			OR: [
				{ actorId: { in: userIds } },
				{ actorId: { startsWith: TAG } },
				{ targetId: { in: [...userIds, ...caseIds, ...invitationIds] } },
				{ targetId: { startsWith: TAG } },
			],
		},
	});
	const matches = await prisma.match.deleteMany({
		where: {
			OR: [{ caseId: { in: caseIds } }, { attorneyId: { in: userIds } }],
		},
	});
	const requests = await prisma.attorneyRequest.deleteMany({
		where: {
			OR: [{ caseId: { in: caseIds } }, { attorneyId: { in: userIds } }],
		},
	});
	const invitations = await prisma.caseInvitation.deleteMany({
		where: { id: { in: invitationIds } },
	});
	const cases = await prisma.case.deleteMany({
		where: { id: { in: caseIds } },
	});
	const profiles = await prisma.attorneyProfile.deleteMany({
		where: { userId: { in: userIds } },
	});
	const sessions = await prisma.session.deleteMany({
		where: { userId: { in: userIds } },
	});
	const accounts = await prisma.account.deleteMany({
		where: { userId: { in: userIds } },
	});
	const users = await prisma.user.deleteMany({
		where: { email: { startsWith: TAG } },
	});
	log(
		`purged: audit=${audit.count} matches=${matches.count} requests=${requests.count} invitations=${invitations.count} cases=${cases.count} profiles=${profiles.count} sessions=${sessions.count} accounts=${accounts.count} users=${users.count}`,
	);
}

async function makeUser(
	key: string,
	name: string,
	role: string,
	hash: string,
	extra: { jurisdiction?: string; firmName?: string; barNumber?: string } = {},
) {
	const user = await prisma.user.create({
		data: {
			id: `${TAG}-${key}`,
			name,
			email: `${TAG}-${key}@example.com`,
			role,
			emailVerified: true,
			onboarded: true,
			banned: false,
			...extra,
		},
	});
	// Hashed with the auth layer's own KDF so the account is indistinguishable
	// from one created through sign-up.
	await prisma.account.create({
		data: {
			id: `${TAG}-acct-${key}`,
			userId: user.id,
			accountId: user.id,
			providerId: "credential",
			password: hash,
		},
	});
	log(`seeded ${user.email} (${role})`);
	return user;
}

/** A case already published out under the bring-your-own path, with the
 *  invitation that holds it out of the queue. Returns the raw token, which only
 *  ever exists in memory here. */
async function seedInvitedCase(input: {
	id: string;
	title: string;
	attorney: string;
	ownerId: string;
	email: string;
}): Promise<Seeded> {
	await prisma.case.create({
		data: {
			id: input.id,
			ownerId: input.ownerId,
			title: input.title,
			category: CATEGORY,
			location: STATE,
			summary: `${input.title} — seeded by the acceptance suite.`,
			story: STORY,
			goalCents: 950000,
			coverImageUrl: COVER,
			attorneyName: input.attorney,
			attorneyFirm: "Seeded Legal LLP",
			attorneyArea: CATEGORY,
			attorneyLocation: STATE,
			attorneyEmail: input.email,
			status: "seeking",
			publishedAt: new Date(),
		},
	});
	const { token, tokenHash } = generateInviteToken();
	const invitation = await upsertCaseInvitationForPublish({
		caseId: input.id,
		actorId: input.ownerId,
		email: input.email,
		tokenHash,
		expiresAt: new Date(Date.now() + CASE_INVITATION_TTL_DAYS * DAY),
	});
	log(`seeded ${input.title} → invitation for ${input.email}`);
	return { token, invitationId: invitation.id };
}

async function seed() {
	await purge();
	const hash = await (await auth.$context).password.hash(PASSWORD);

	const plaintiff = await makeUser(
		"plaintiff",
		PLAINTIFF_NAME,
		"plaintiff",
		hash,
		{ jurisdiction: STATE },
	);
	const attorney = await makeUser("attorney", ATTORNEY_NAME, "attorney", hash, {
		jurisdiction: STATE,
		firmName: "Cole & Associates",
		barNumber: "NY #338114",
	});
	// Bar standing is what the confirm gate turns on, so it is seeded rather than
	// walked through — the check itself belongs to the verification flow.
	await prisma.attorneyProfile.create({
		data: {
			id: `${TAG}-profile-attorney`,
			userId: attorney.id,
			legalName: ATTORNEY_NAME,
			firmName: "Cole & Associates",
			officeState: STATE,
			practiceAreas: [CATEGORY],
			verificationStatus: "verified",
			verifiedAt: new Date(),
		},
	});

	// The wizard is driven for real from here, but a cover image would mean a
	// live Blob upload — so the draft it resumes already has one.
	await prisma.case.create({
		data: {
			id: CASES.one.id,
			ownerId: plaintiff.id,
			title: "",
			category: "",
			location: "",
			summary: "",
			story: "",
			goalCents: 0,
			coverImageUrl: COVER,
			status: "draft",
		},
	});
	log(`seeded empty draft ${CASES.one.id} with a cover image`);

	const two = await seedInvitedCase({
		...CASES.two,
		ownerId: plaintiff.id,
		email: EMAILS.lapsed,
	});
	const three = await seedInvitedCase({
		...CASES.three,
		ownerId: plaintiff.id,
		email: EMAILS.attorney,
	});
	const four = await seedInvitedCase({
		...CASES.four,
		ownerId: plaintiff.id,
		email: EMAILS.nobody,
	});
	const five = await seedInvitedCase({
		...CASES.five,
		ownerId: plaintiff.id,
		email: EMAILS.newbie,
	});
	const six = await seedInvitedCase({
		...CASES.six,
		ownerId: plaintiff.id,
		email: EMAILS.elsewhere,
	});

	return { plaintiff, attorney, two, three, four, five, six };
}

// ------------------------------------------------------------------- preflight

async function requireServer() {
	let status = 0;
	try {
		status = (await fetch(`${BASE}/login`)).status;
	} catch {}
	if (status === 200) return;
	console.error(
		[
			`No dev server answering on ${BASE}/login (got ${status || "no response"}).`,
			"",
			"Start one in another shell, from apps/web:",
			"",
			'  RESEND_API_KEY="" bun run dev',
			"",
			"apps/web/.env is a symlink to the repo-root .env, so the rest of the",
			"environment loads on its own.",
		].join("\n"),
	);
	process.exit(1);
}

function warnAboutEmail() {
	console.log(
		[
			"",
			'!! This run assumes the dev server was started with RESEND_API_KEY="".',
			"!! That cannot be checked from out here. If the server holds a real key,",
			"!! the wizard's invitation goes to a live example.com address — and a",
			"!! send that fails revokes the invitation and reverts the publish, so",
			"!! step 1 would fail for a reason that has nothing to do with the code.",
			"",
		].join("\n"),
	);
}

async function launchBrowser() {
	try {
		return await chromium.launch();
	} catch (err) {
		console.error(
			"Could not launch Chromium. Install it once with:\n\n  bunx playwright install chromium\n",
		);
		throw err;
	}
}

// --------------------------------------------------------------- toast capture

/** Records every sonner toast that appears, so one that has already faded is still assertable. */
function installToastSpy(context: BrowserContext) {
	return context.addInitScript(() => {
		const store = window as unknown as { __toasts: string[] };
		store.__toasts = [];
		const grab = (el: Element) => {
			const text = ((el as HTMLElement).innerText || el.textContent || "")
				.replace(/\s+/g, " ")
				.trim();
			if (text && !store.__toasts.includes(text)) store.__toasts.push(text);
		};
		const scan = (node: Node) => {
			if (!(node instanceof Element)) return;
			if (node.matches("[data-sonner-toast]")) grab(node);
			for (const el of Array.from(
				node.querySelectorAll("[data-sonner-toast]"),
			)) {
				grab(el);
			}
		};
		const observer = new MutationObserver((records) => {
			for (const record of records) {
				for (const node of Array.from(record.addedNodes)) scan(node);
				const parent = record.target.parentElement;
				if (record.type === "characterData" && parent) {
					const host = parent.closest("[data-sonner-toast]");
					if (host) grab(host);
				}
			}
		});
		const start = () =>
			observer.observe(document.documentElement, {
				childList: true,
				subtree: true,
				characterData: true,
			});
		if (document.documentElement) start();
		else document.addEventListener("readystatechange", start, { once: true });
	});
}

async function toasts(page: Page): Promise<string[]> {
	return page.evaluate(() => {
		const store = window as unknown as { __toasts?: string[] };
		const seen = Array.isArray(store.__toasts) ? [...store.__toasts] : [];
		for (const el of Array.from(
			document.querySelectorAll<HTMLElement>("[data-sonner-toast]"),
		)) {
			const text = (el.innerText || el.textContent || "")
				.replace(/\s+/g, " ")
				.trim();
			if (text && !seen.includes(text)) seen.push(text);
		}
		return seen;
	});
}

async function clearToasts(page: Page) {
	await page.evaluate(() => {
		(window as unknown as { __toasts: string[] }).__toasts = [];
	});
}

async function expectToast(page: Page, needle: string, timeout = 20000) {
	return poll(
		`toast containing "${needle}"`,
		async () => {
			const all = await toasts(page);
			return all.find((t) => has(t, needle)) ?? false;
		},
		timeout,
	);
}

async function bodyText(page: Page) {
	const text = await page.evaluate(() => document.body.innerText);
	return text.replace(/\s+/g, " ");
}

/** Waits for a phrase to appear anywhere on the page. Generous by default: the
 *  first hit of each route compiles before it renders. */
async function expectText(page: Page, needle: string, timeout = 30000) {
	return poll(
		`"${needle}"`,
		async () => {
			const text = await bodyText(page);
			return has(text, needle) ? text : false;
		},
		timeout,
		400,
	);
}

// ------------------------------------------------------- sign-in rate limiting

/**
 * The auth layer allows SIGN_IN_RATE_LIMIT_MAX /sign-in/email requests per 60s,
 * keyed by IP, and the counter only resets once 60s have passed since the
 * *previous* request — so any request inside the window extends it. This
 * mirrors that counter rather than guessing, because blowing the budget would
 * come back 429 and the check under test would never run.
 */
const WINDOW_MS = 66000;
let rlCount = 0;
let rlLast = 0;

async function freshSignInWindow(note: Note) {
	if (rlLast === 0) return;
	const waitMs = WINDOW_MS - (Date.now() - rlLast);
	if (waitMs > 0) {
		note(
			`waiting ${Math.ceil(waitMs / 1000)}s for a fresh sign-in rate window`,
		);
		await sleep(waitMs);
	}
	rlCount = 0;
	rlLast = 0;
}

/** Records one sign-in request, waiting first if the window is already full. */
async function throttleSignIn(note: Note) {
	for (;;) {
		const now = Date.now();
		if (now - rlLast > WINDOW_MS) {
			rlCount = 1;
			rlLast = now;
			return;
		}
		if (rlCount < SIGN_IN_RATE_LIMIT_MAX) {
			rlCount += 1;
			rlLast = now;
			return;
		}
		const waitMs = WINDOW_MS - (now - rlLast) + 500;
		note(`sign-in rate window full, waiting ${Math.ceil(waitMs / 1000)}s`);
		await sleep(Math.max(waitMs, 1000));
	}
}

// --------------------------------------------------------------- page helpers

/** Fills and submits the sign-in form. Says nothing about the outcome. */
async function submitSignIn(
	page: Page,
	email: string,
	password: string,
	note: Note,
) {
	if (!page.url().includes("/login")) {
		await page.goto(`${BASE}/login?mode=signin`, {
			waitUntil: "networkidle",
			timeout: NAV,
		});
	}
	const emailBox = page.locator('input[type="email"]');
	await emailBox.waitFor({ state: "visible", timeout: 30000 });
	await emailBox.fill(email);
	await page.locator('input[type="password"]').fill(password);
	await clearToasts(page);
	await throttleSignIn(note);
	// The create/sign-in toggle is also named "Sign in", so target the submit.
	await page.locator('form button[type="submit"]').click();
}

async function signIn(page: Page, email: string, note: Note) {
	await page.goto(`${BASE}/login?mode=signin`, {
		waitUntil: "networkidle",
		timeout: NAV,
	});
	await submitSignIn(page, email, PASSWORD, note);
	await page.waitForURL(/\/home$/, { timeout: 60000 });
	await waitForShell(page);
	note(`${email} signed in → ${page.url()}`);
}

/** The dashboard shell paints after the client-side push resolves. */
async function waitForShell(page: Page) {
	await page
		.locator('[data-slot="sidebar-menu-button"]')
		.first()
		.waitFor({ state: "attached", timeout: 45000 });
}

async function clickButton(page: Page, name: string | RegExp, timeout = 25000) {
	// The wizard sidebar repeats action names as (sometimes disabled) step
	// buttons, so only an enabled match is the one meant here.
	const button = page
		.getByRole("button", {
			name,
			exact: typeof name === "string" ? true : undefined,
			disabled: false,
		})
		.first();
	await button.waitFor({ state: "visible", timeout });
	await button.click();
}

/** The base-ui select is a listbox in a portal, not a native <select>. */
async function pickOption(
	page: Page,
	trigger: Locator,
	label: string,
	note: Note,
) {
	await trigger.waitFor({ state: "visible", timeout: 25000 });
	await trigger.click();
	const option = page
		.locator('[data-slot="select-item"]')
		.filter({ hasText: new RegExp(`^\\s*${escapeRe(label)}\\s*$`) })
		.first();
	await option.waitFor({ state: "visible", timeout: 20000 });
	await option.scrollIntoViewIfNeeded();
	await option.click();
	await poll(
		`the select to settle on "${label}"`,
		async () => (await trigger.innerText()).includes(label),
		10000,
	);
	note(`selected "${label}"`);
}

/** The attorney's Seeking Representation queue is their /home. */
async function queueText(page: Page) {
	await page.goto(`${BASE}/home`, {
		waitUntil: "networkidle",
		timeout: NAV,
	});
	await waitForShell(page);
	return bodyText(page);
}

async function expectQueueLists(page: Page, title: string, note: Note) {
	await poll(
		`the queue to list "${title}"`,
		async () => has(await queueText(page), title),
		30000,
		1500,
	);
	note(`queue now lists "${title}"`);
}

// ==================================================================== the run

mkdirSync(SHOTS, { recursive: true });
await requireServer();
warnAboutEmail();

let browser: Browser | null = null;
let fatal: string | null = null;

try {
	const seeded = await seed();
	const chrome = await launchBrowser();
	browser = chrome;

	// One context per persona. Two of them must never have been signed in — the
	// decline and the account-creation paths are the ones a stranger walks.
	const persona = async () => {
		const context = await chrome.newContext({
			viewport: { width: 1440, height: 900 },
		});
		await installToastSpy(context);
		return context.newPage();
	};
	const plaintiff = await persona();
	const attorney = await persona();
	const anon = await persona();
	const stranger = await persona();
	const newbie = await persona();

	// The raw token for the case the wizard publishes. Only its hash is stored,
	// so it is re-minted onto the same row through the data layer once the wizard
	// is done — the resend path, which is what the plaintiff's own "Manage
	// invitation" does.
	let inviteOneToken = "";
	let inviteOneId = "";

	await step(
		1,
		"Plaintiff publishes via the wizard's I-have-an-attorney path",
		async (note) => {
			currentPage = plaintiff;
			await signIn(plaintiff, EMAILS.plaintiff, note);

			await plaintiff.goto(`${BASE}/cases/new?draft=${CASES.one.id}`, {
				waitUntil: "networkidle",
				timeout: NAV,
			});
			await expectText(plaintiff, "What happened?");
			await plaintiff.locator("textarea").first().fill(STORY);
			await clickButton(plaintiff, "Continue");

			await expectText(plaintiff, "Now, the basics.");
			const selects = plaintiff.locator('[data-slot="select-trigger"]');
			await pickOption(plaintiff, selects.nth(0), CATEGORY, note);
			await pickOption(plaintiff, selects.nth(1), STATE, note);
			await plaintiff.getByLabel("Case title").fill(CASES.one.title);
			note(`title "${CASES.one.title}"`);
			await clickButton(plaintiff, "Continue");

			await expectText(plaintiff, "Do you have an attorney?");
			await plaintiff
				.locator("button[aria-pressed]")
				.filter({ hasText: "Yes, I have an attorney" })
				.first()
				.click();
			await plaintiff.getByLabel(/full name/i).fill(CASES.one.attorney);

			// The email is required on the step that owns it — a case published
			// without one names somebody who can never confirm it.
			const emailBox = plaintiff.locator('input[type="email"]');
			await emailBox.fill("not-an-email");
			await clearToasts(plaintiff);
			await clickButton(plaintiff, /Send invite/);
			await expectText(plaintiff, "Enter a valid email address.", 20000);
			const blocked = await bodyText(plaintiff);
			note('inline error: "Enter a valid email address."');
			note(
				`toast: "${await expectToast(plaintiff, "where the invitation goes")}"`,
			);
			assert(
				has(blocked, "Do you have an attorney?"),
				"an invalid attorney email still advanced the wizard",
			);
			assert(
				(await emailBox.getAttribute("aria-invalid")) === "true",
				"the email field is not marked invalid",
			);

			await emailBox.fill(EMAILS.invitee);
			await clickButton(plaintiff, /Send invite/);
			await expectText(plaintiff, "Agree the fee");
			note(`valid email ${EMAILS.invitee} advanced to the fee step`);

			await plaintiff.getByLabel(/Agreed fee/).fill("12,500");
			await clickButton(plaintiff, "Continue");

			await expectText(plaintiff, `Invite ${CASES.one.attorney}`);
			const inviteStep = await bodyText(plaintiff);
			assert(
				has(inviteStep, EMAILS.invitee),
				`the invite step does not name ${EMAILS.invitee}`,
			);
			note(`step 5 reads "Invite ${CASES.one.attorney}" and names the address`);

			await clickButton(plaintiff, /Send invitation/);
			const sent = await expectText(plaintiff, "Invitation sent", 60000);
			assert(
				has(sent, EMAILS.invitee),
				`the success view does not name ${EMAILS.invitee}`,
			);
			note("success view: Invitation sent, naming the invited address");

			const row = await prisma.case.findUnique({
				where: { id: CASES.one.id },
				select: { status: true, attorneyEmail: true, attorneyName: true },
			});
			assert(row, "the published case row is gone");
			note(
				`case ${CASES.one.id}: status=${row.status} attorney=${row.attorneyName} <${row.attorneyEmail}>`,
			);
			assert(row.status === "seeking", `case status was ${row.status}`);

			const invitations = await prisma.caseInvitation.findMany({
				where: { caseId: CASES.one.id },
			});
			assert(
				invitations.length === 1,
				`expected 1 invitation, found ${invitations.length}`,
			);
			const invitation = invitations[0];
			assert(
				invitation.email === EMAILS.invitee,
				`the invitation went to ${invitation.email}`,
			);
			assert(
				!invitation.acceptedAt &&
					!invitation.declinedAt &&
					!invitation.revokedAt &&
					invitation.expiresAt > new Date(),
				"the new invitation is not pending",
			);
			note(
				`one pending invitation ${invitation.id}, expires ${invitation.expiresAt.toISOString()}`,
			);

			// The link itself only ever existed in the email, so the same row is
			// re-issued here to get a token this suite can follow in step 8.
			const reissued = generateInviteToken();
			await upsertCaseInvitationForPublish({
				caseId: CASES.one.id,
				actorId: seeded.plaintiff.id,
				email: EMAILS.invitee,
				tokenHash: reissued.tokenHash,
				expiresAt: new Date(Date.now() + CASE_INVITATION_TTL_DAYS * DAY),
			});
			inviteOneToken = reissued.token;
			inviteOneId = invitation.id;
			note("re-issued the same invitation row so its link is followable");
		},
	);

	await step(
		2,
		"The queue hides an invited case; the plaintiff sees it waiting",
		async (note) => {
			currentPage = attorney;
			await signIn(attorney, EMAILS.attorney, note);
			const queue = await queueText(attorney);
			for (const item of Object.values(CASES)) {
				assert(
					!has(queue, item.title),
					`the queue lists "${item.title}" while its invitation is pending`,
				);
			}
			note(
				`queue hides all ${Object.values(CASES).length} invited cases while pending`,
			);

			currentPage = plaintiff;
			await plaintiff.goto(`${BASE}/my-cases`, {
				waitUntil: "networkidle",
				timeout: NAV,
			});
			const mine = await expectText(plaintiff, "Invitation sent");
			assert(
				has(mine, "Waiting on"),
				"the card does not say who the plaintiff is waiting on",
			);
			assert(
				has(mine, EMAILS.invitee),
				`the card does not name ${EMAILS.invitee}`,
			);
			assert(
				has(mine, "Manage invitation"),
				'the card offers no "Manage invitation" route',
			);
			note(`/my-cases badge "Invitation sent", waiting on ${EMAILS.invitee}`);
		},
	);

	await step(
		3,
		"Dead tokens: unknown link, then a lapsed one",
		async (note) => {
			currentPage = anon;
			await anon.goto(`${BASE}/case-invite?token=${TAG}-not-a-real-token`, {
				waitUntil: "networkidle",
				timeout: NAV,
			});
			await expectText(anon, "This invitation link is invalid");
			note("unknown token → invalid screen");

			await prisma.caseInvitation.update({
				where: { id: seeded.two.invitationId },
				data: { expiresAt: new Date(Date.now() - DAY) },
			});
			note(`pushed invitation ${seeded.two.invitationId} past its expiry`);

			await anon.goto(`${BASE}/case-invite?token=${seeded.two.token}`, {
				waitUntil: "networkidle",
				timeout: NAV,
			});
			const expired = await expectText(anon, "This invitation has expired");
			assert(
				has(expired, "back in the Seeking Representation queue"),
				"the expired screen does not say the case went back to the queue",
			);
			assert(
				has(expired, CASES.two.title),
				"the expired screen does not name the case",
			);
			note("expired screen names the case and points at the queue");

			currentPage = attorney;
			await expectQueueLists(attorney, CASES.two.title, note);
			const queue = await bodyText(attorney);
			assert(
				!has(queue, CASES.one.title),
				"a still-pending invitation did not hold its case out of the queue",
			);
		},
	);

	await step(
		4,
		"A verified attorney confirms, and the link is spent",
		async (note) => {
			currentPage = attorney;
			await attorney.goto(`${BASE}/case-invite?token=${seeded.three.token}`, {
				waitUntil: "networkidle",
				timeout: NAV,
			});
			const offer = await expectText(
				attorney,
				`Confirm you represent ${PLAINTIFF_NAME}`,
			);
			assert(
				has(offer, CASES.three.title),
				"the case summary is missing from the confirm screen",
			);
			assert(
				await attorney
					.getByRole("button", { name: /Decline this case/ })
					.isVisible(),
				"the confirm screen offers no way to decline",
			);
			note("confirm screen shows the case summary, Confirm and Decline");

			await clickButton(attorney, /Confirm I represent this case/);
			await attorney.waitForURL(
				new RegExp(`/my-cases/${escapeRe(CASES.three.id)}$`),
				{ timeout: 60000 },
			);
			note(`confirmed → ${attorney.url()}`);

			const matches = await prisma.match.findMany({
				where: { caseId: CASES.three.id },
			});
			assert(matches.length === 1, `expected 1 match, found ${matches.length}`);
			note(
				`match ${matches[0].id}: origin=${matches[0].origin} attorney=${matches[0].attorneyId}`,
			);
			assert(
				matches[0].origin === "bring_your_own",
				`the match origin was ${matches[0].origin}`,
			);
			assert(
				matches[0].attorneyId === seeded.attorney.id,
				`the match names ${matches[0].attorneyId}`,
			);

			const row = await prisma.case.findUnique({
				where: { id: CASES.three.id },
				select: { status: true },
			});
			assert(
				row?.status === "pending_payout",
				`the case status was ${row?.status}`,
			);
			note("case moved to pending_payout");

			const invitation = await prisma.caseInvitation.findUnique({
				where: { id: seeded.three.invitationId },
			});
			assert(invitation?.acceptedAt, "acceptedAt was not stamped");
			note(`acceptedAt ${invitation.acceptedAt?.toISOString()}`);

			await attorney.goto(`${BASE}/case-invite?token=${seeded.three.token}`, {
				waitUntil: "networkidle",
				timeout: NAV,
			});
			await expectText(attorney, "This invitation has already been confirmed");
			note("re-visiting the link reads as already confirmed");
		},
	);

	await step(
		5,
		"A stranger with no account declines from the link alone",
		async (note) => {
			currentPage = stranger;
			await stranger.goto(`${BASE}/case-invite?token=${seeded.four.token}`, {
				waitUntil: "networkidle",
				timeout: NAV,
			});
			const landing = await expectText(
				stranger,
				`${PLAINTIFF_NAME} named you as their attorney`,
			);
			assert(
				has(landing, "Create attorney account"),
				"the no-account state does not offer to create an account",
			);
			note("account-creation state shown, with a decline alongside it");

			await clickButton(stranger, /I don't represent this case/);
			await expectText(stranger, "Decline for good?", 15000);
			note("declining asks twice");
			await clickButton(stranger, /Yes, decline/);

			await stranger.waitForURL(/declined=1/, { timeout: 60000 });
			await expectText(stranger, "declined this case");
			const done = await bodyText(stranger);
			assert(
				has(done, "gone back to the attorney queue"),
				"the decline screen does not say where the case went",
			);
			note(`decline landed on ${stranger.url()}`);

			const invitation = await prisma.caseInvitation.findUnique({
				where: { id: seeded.four.invitationId },
			});
			assert(invitation?.declinedAt, "declinedAt was not stamped");
			note(`declinedAt ${invitation.declinedAt?.toISOString()}`);

			const entry = await prisma.auditLog.findFirst({
				where: {
					action: "case_invite.declined",
					targetId: seeded.four.invitationId,
				},
			});
			assert(entry, "no case_invite.declined audit entry");
			note(`audit case_invite.declined actorId=${String(entry.actorId)}`);
			assert(
				entry.actorId === null,
				`an anonymous decline was attributed to ${entry.actorId}`,
			);

			currentPage = attorney;
			await expectQueueLists(attorney, CASES.four.title, note);
		},
	);

	await step(
		6,
		"No account to confirmation: sign-up, onboarding, verification, confirm",
		async (note) => {
			currentPage = newbie;
			// Creating the account signs them in server-side through the same
			// credential path, so the window has to have room for it.
			await freshSignInWindow(note);

			await newbie.goto(`${BASE}/case-invite?token=${seeded.five.token}`, {
				waitUntil: "networkidle",
				timeout: NAV,
			});
			const form = await expectText(newbie, "Create attorney account");
			assert(
				has(form, EMAILS.newbie),
				"the invited address is not shown on the account form",
			);
			assert(
				(await newbie.locator('input[type="email"]').count()) === 0,
				"the invited address is editable",
			);
			const nameBox = newbie.getByLabel("Full name");
			const prefilled = await nameBox.inputValue();
			note(`email fixed to ${EMAILS.newbie}; name prefilled "${prefilled}"`);
			assert(
				prefilled === CASES.five.attorney,
				`the name was prefilled as "${prefilled}"`,
			);

			const passwords = newbie.locator('input[autocomplete="new-password"]');
			assert(
				(await passwords.count()) === 2,
				"the account form does not ask twice for the password",
			);
			await passwords.nth(0).fill(PASSWORD);
			await passwords.nth(1).fill(PASSWORD);
			rlCount = 1;
			rlLast = Date.now();
			await clickButton(newbie, /Create attorney account/);

			await expectText(
				newbie,
				"Finish setting up your attorney account",
				60000,
			);
			note("back on the invitation, signed in, held at the onboarding gate");

			await newbie
				.getByRole("link", { name: /Finish attorney onboarding/ })
				.click();
			await newbie.waitForURL(/\/onboarding\?next=/, { timeout: 60000 });
			note(`onboarding carries the return path: ${newbie.url()}`);

			await expectText(newbie, "how are you joining?");
			await newbie
				.locator("button[aria-pressed]")
				.filter({ hasText: "Appear in the directory" })
				.first()
				.click();
			await clickButton(newbie, /^Continue as/);
			await expectText(newbie, "Tell us about your practice");
			await pickOption(
				newbie,
				newbie.locator('[data-slot="select-trigger"]').first(),
				STATE,
				note,
			);
			await newbie.getByLabel("Firm", { exact: true }).fill("Ellery Law LLC");
			await newbie.getByLabel("Bar number").fill("NY #448213");
			await clickButton(newbie, /Enter JustUs/);

			await newbie.waitForURL(/\/case-invite\?token=/, { timeout: 60000 });
			note(`onboarding returned to ${newbie.url()}`);

			await expectText(newbie, "Verify your bar standing to continue");
			assert(
				(await newbie
					.getByRole("button", { name: /Confirm I represent this case/ })
					.count()) === 0,
				"an unverified attorney was offered the Confirm button",
			);
			note("verification gate shown, with no Confirm button");

			const account = await prisma.user.findFirst({
				where: { email: EMAILS.newbie },
				select: { id: true, role: true, onboarded: true },
			});
			assert(account, "the invited attorney account was not created");
			note(
				`account ${account.id}: role=${account.role} onboarded=${account.onboarded}`,
			);
			assert(account.role === "attorney", `the role was ${account.role}`);
			assert(account.onboarded, "onboarding did not complete");

			// Standing in for the bar check, which belongs to the verification
			// flow — onboarding writes no profile row of its own.
			await prisma.attorneyProfile.upsert({
				where: { userId: account.id },
				create: {
					userId: account.id,
					legalName: CASES.five.attorney,
					firmName: "Ellery Law LLC",
					officeState: STATE,
					practiceAreas: [CATEGORY],
					verificationStatus: "verified",
					verifiedAt: new Date(),
				},
				update: { verificationStatus: "verified", verifiedAt: new Date() },
			});
			note("bar standing set to verified out of band");

			await newbie.reload({ waitUntil: "networkidle", timeout: NAV });
			await expectText(newbie, `Confirm you represent ${PLAINTIFF_NAME}`);
			await clickButton(newbie, /Confirm I represent this case/);
			await newbie.waitForURL(
				new RegExp(`/my-cases/${escapeRe(CASES.five.id)}$`),
				{ timeout: 60000 },
			);
			note(`confirmed → ${newbie.url()}`);

			const matches = await prisma.match.findMany({
				where: { caseId: CASES.five.id },
			});
			assert(matches.length === 1, `expected 1 match, found ${matches.length}`);
			assert(
				matches[0].origin === "bring_your_own" &&
					matches[0].attorneyId === account.id,
				`the match was ${matches[0].origin} for ${matches[0].attorneyId}`,
			);
			const row = await prisma.case.findUnique({
				where: { id: CASES.five.id },
				select: { status: true },
			});
			assert(
				row?.status === "pending_payout",
				`the case status was ${row?.status}`,
			);
			note(`match ${matches[0].id} (bring_your_own); case pending_payout`);
		},
	);

	await step(
		7,
		"An invitation for another address refuses the signed-in attorney",
		async (note) => {
			currentPage = attorney;
			await attorney.goto(`${BASE}/case-invite?token=${seeded.six.token}`, {
				waitUntil: "networkidle",
				timeout: NAV,
			});
			const screen = await expectText(
				attorney,
				"This invitation is for a different account",
			);
			const masked = maskEmail(EMAILS.elsewhere);
			assert(
				has(screen, masked),
				`the invited address is not masked as "${masked}"`,
			);
			assert(
				has(screen, EMAILS.attorney),
				"the screen does not say which account is signed in",
			);
			note(`masked as ${masked}, signed in as ${EMAILS.attorney}`);

			assert(
				(await attorney
					.getByRole("button", { name: /Confirm I represent this case/ })
					.count()) === 0,
				"the mismatch screen offers a Confirm button",
			);
			assert(
				(await attorney
					.getByRole("button", { name: /represent this case/ })
					.count()) === 0,
				"the mismatch screen offers a decline the wrong account could act on",
			);
			assert(
				await attorney
					.getByRole("button", { name: /Sign out and use another account/ })
					.isVisible(),
				"the mismatch screen offers no way out",
			);
			note("no Confirm, no Decline — only sign out and come back");

			const invitation = await prisma.caseInvitation.findUnique({
				where: { id: seeded.six.invitationId },
			});
			assert(
				invitation &&
					!invitation.acceptedAt &&
					!invitation.declinedAt &&
					!invitation.revokedAt,
				"the mismatched visit changed the invitation",
			);
			note("the invitation is untouched, still pending");
		},
	);

	await step(
		8,
		"Switching to the attorney queue withdraws the invitation",
		async (note) => {
			currentPage = plaintiff;
			await plaintiff.goto(`${BASE}/cases/new?draft=${CASES.one.id}`, {
				waitUntil: "networkidle",
				timeout: NAV,
			});
			await expectText(plaintiff, `Invite ${CASES.one.attorney}`);
			note("the wizard resumes on the invitation step");

			await clickButton(plaintiff, /Representation/);
			await expectText(plaintiff, "Do you have an attorney?");
			await plaintiff
				.locator("button[aria-pressed]")
				.filter({ hasText: "No, not yet" })
				.first()
				.click();
			await clickButton(plaintiff, /Publish for attorneys/);
			await expectText(plaintiff, "Your case is out to attorneys", 60000);
			note("published out to attorneys instead");

			const invitation = await prisma.caseInvitation.findUnique({
				where: { id: inviteOneId },
			});
			assert(invitation?.revokedAt, "revokedAt was not stamped");
			note(`revokedAt ${invitation.revokedAt?.toISOString()}`);
			const row = await prisma.case.findUnique({
				where: { id: CASES.one.id },
				select: { status: true, attorneyName: true },
			});
			assert(row?.status === "seeking", `the case status was ${row?.status}`);
			assert(
				row.attorneyName === null,
				`the case still names ${row.attorneyName}`,
			);
			note("case is seeking with no named attorney");

			currentPage = anon;
			await anon.goto(`${BASE}/case-invite?token=${inviteOneToken}`, {
				waitUntil: "networkidle",
				timeout: NAV,
			});
			await expectText(anon, "This invitation was withdrawn");
			note("the old link reads as withdrawn");

			currentPage = attorney;
			await expectQueueLists(attorney, CASES.one.title, note);
		},
	);
} catch (err) {
	fatal = err instanceof Error ? (err.stack ?? err.message) : String(err);
} finally {
	console.log("\n================ RESULT TABLE ================");
	const ordered = [...results].sort((a, b) => a.n - b.n);
	for (const result of ordered) {
		console.log(
			`${String(result.n).padStart(2)}. ${result.pass ? "PASS" : "FAIL"}  ${result.title}`,
		);
		for (const line of result.evidence) console.log(`        ${line}`);
		if (!result.pass) {
			console.log(`        ERROR: ${result.error}`);
			if (result.shot) console.log(`        SHOT: ${result.shot}`);
		}
	}
	const failed = ordered.filter((result) => !result.pass);
	console.log(
		`\n${ordered.length - failed.length}/${ordered.length} passed${failed.length ? `; failed: ${failed.map((f) => f.n).join(", ")}` : ""}`,
	);
	if (failed.length) console.log(`Screenshots: ${SHOTS}`);
	if (fatal) console.log(`\nFATAL: ${fatal}`);

	if (browser) await browser.close();
	await purge();
	await prisma.$disconnect();
	process.exit(failed.length || fatal ? 1 : 0);
}
