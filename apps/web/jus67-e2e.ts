/**
 * Browser acceptance suite for administrator invitations and user blocking.
 * Seeds tagged accounts plus one invitation, drives the running dev server with
 * Playwright across four isolated browser contexts, then deletes every row it
 * created.
 *
 * Prerequisites:
 *   Chromium, once per machine:
 *     bunx playwright install chromium
 *   A dev server on http://localhost:3001, started with email sending off:
 *     cd apps/web && RESEND_API_KEY="" bun run dev
 *   apps/web/.env is a symlink to the repo-root .env, so the rest of the
 *   environment still loads. The empty key is what keeps real mail from going
 *   out — the env package reads an empty string as undefined, and the email
 *   layer then logs instead of sending.
 *
 * Run from apps/web:  bun run e2e:jus67
 *
 * Allow 4-5 minutes. Two checks have to sit out the sign-in rate-limit window
 * before the account-lockout message can surface at all.
 */
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { auth } from "@just-us/auth";
import { generateInviteToken } from "@just-us/auth/invite-token";
import prisma from "@just-us/db";
import { createInvitation } from "@just-us/db/invitations";
import {
	type Browser,
	type BrowserContext,
	chromium,
	type Page,
} from "playwright";

const BASE = "http://localhost:3001";
const PASSWORD = "E2ePass!234";
const TAG = "jus67e2e";
const DAY = 24 * 60 * 60 * 1000;
const SHOTS = join(tmpdir(), "jus67-e2e-failures");

const EMAILS = {
	admin: `${TAG}-admin@example.com`,
	donor: `${TAG}-donor@example.com`,
	locky: `${TAG}-locky@example.com`,
	invitee: `${TAG}-invitee@example.com`,
	accepted: `${TAG}-accepted@example.com`,
};

type Note = (line: string) => void;
type Pill = { text: string; raw: string; cls: string };
type UserRow = { href: string; id: string; text: string; pills: Pill[] };
type NavItem = { text: string; href: string | null };
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

// --------------------------------------------------------------- seed and purge

/** Every row this suite can create. Audit entries go first — the actor relation does not cascade. */
async function purge() {
	const userIds = (
		await prisma.user.findMany({
			where: { email: { startsWith: TAG } },
			select: { id: true },
		})
	).map((row) => row.id);
	const invitationIds = (
		await prisma.adminInvitation.findMany({
			where: { email: { startsWith: TAG } },
			select: { id: true },
		})
	).map((row) => row.id);

	const audit = await prisma.auditLog.deleteMany({
		where: {
			OR: [
				{ actorId: { in: userIds } },
				{ actorId: { startsWith: TAG } },
				{ targetId: { in: [...userIds, ...invitationIds] } },
				{ targetId: { startsWith: TAG } },
			],
		},
	});
	const invitations = await prisma.adminInvitation.deleteMany({
		where: { email: { startsWith: TAG } },
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
		`purged: audit=${audit.count} invitations=${invitations.count} sessions=${sessions.count} accounts=${accounts.count} users=${users.count}`,
	);
}

async function makeUser(key: string, name: string, role: string, hash: string) {
	const user = await prisma.user.create({
		data: {
			id: `${TAG}-${key}`,
			name,
			email: `${TAG}-${key}@example.com`,
			role,
			emailVerified: true,
			onboarded: true,
			banned: false,
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

/** Returns the raw invite token, which only ever exists in memory here. */
async function seed() {
	await purge();
	const hash = await (await auth.$context).password.hash(PASSWORD);
	const admin = await makeUser("admin", "E2E Admin", "administrator", hash);
	await makeUser("donor", "E2E Donor", "donor", hash);
	await makeUser("locky", "E2E Locky", "donor", hash);

	const { token, tokenHash } = generateInviteToken();
	const created = await createInvitation({
		email: EMAILS.accepted,
		invitedById: admin.id,
		tokenHash,
		expiresAt: new Date(Date.now() + 7 * DAY),
	});
	assert(
		created.ok,
		`could not mint the invitation: ${JSON.stringify(created)}`,
	);
	log(`seeded invitation for ${EMAILS.accepted}`);
	return token;
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
			"!! the invitation checks will send live mail to example.com addresses.",
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
			return (
				all.find((t) => t.toLowerCase().includes(needle.toLowerCase())) ?? false
			);
		},
		timeout,
	);
}

async function bodyText(page: Page) {
	const text = await page.evaluate(() => document.body.innerText);
	return text.replace(/\s+/g, " ");
}

// ------------------------------------------------------- sign-in rate limiting

/**
 * The auth layer allows three /sign-in/email requests per 60s, keyed by IP, and
 * the counter only resets once 60s have passed since the *previous* request — so
 * any request inside the window extends it. This mirrors that counter rather
 * than guessing, because a 4th request would come back 429 and the check under
 * test would never run.
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

function resetSignInWindow() {
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
		if (rlCount < 3) {
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
		await page.goto(`${BASE}/login?mode=signin`, { waitUntil: "networkidle" });
	}
	const emailBox = page.locator('input[type="email"]');
	await emailBox.waitFor({ state: "visible", timeout: 20000 });
	await emailBox.fill(email);
	await page.locator('input[type="password"]').fill(password);
	await clearToasts(page);
	await throttleSignIn(note);
	// The create/sign-in toggle is also named "Sign in", so target the submit.
	await page.locator('form button[type="submit"]').click();
}

/** The status pills are CSS uppercase, so innerText reads "VERIFIED". */
async function pillTexts(page: Page): Promise<Pill[]> {
	return page.evaluate(() => {
		const pills: Pill[] = [];
		for (const span of Array.from(
			document.querySelectorAll<HTMLElement>("span"),
		)) {
			const raw = (span.innerText || "").trim();
			if (!/^(verified|unverified|blocked|locked)$/i.test(raw)) continue;
			pills.push({
				text: raw[0].toUpperCase() + raw.slice(1).toLowerCase(),
				raw,
				cls: span.className,
			});
		}
		return pills;
	});
}

/** The dashboard shell paints after the client-side push resolves. */
async function waitForShell(page: Page) {
	await page
		.locator('[data-slot="sidebar-menu-button"]')
		.first()
		.waitFor({ state: "attached", timeout: 30000 });
}

async function navItems(page: Page): Promise<NavItem[]> {
	return page.evaluate(() =>
		Array.from(
			document.querySelectorAll<HTMLElement>(
				'[data-slot="sidebar-menu-button"]',
			),
		).map((item) => ({
			text: (item.innerText || "").trim(),
			href: item.getAttribute("href"),
		})),
	);
}

async function userRows(page: Page): Promise<UserRow[]> {
	return page.evaluate(() => {
		const rows: UserRow[] = [];
		for (const link of Array.from(
			document.querySelectorAll<HTMLAnchorElement>(
				'a[href^="/dashboard/users/"]',
			),
		)) {
			const row = link.closest<HTMLElement>("div.grid");
			if (!row) continue;
			const href = link.getAttribute("href") ?? "";
			const pills: Pill[] = [];
			for (const span of Array.from(
				row.querySelectorAll<HTMLElement>("span"),
			)) {
				const raw = (span.innerText || "").trim();
				if (!/^(verified|unverified|blocked|locked)$/i.test(raw)) continue;
				pills.push({
					text: raw[0].toUpperCase() + raw.slice(1).toLowerCase(),
					raw,
					cls: span.className,
				});
			}
			rows.push({
				href,
				id: href.split("/").pop() ?? "",
				text: (row.innerText || "").replace(/\s+/g, " ").trim(),
				pills,
			});
		}
		return rows;
	});
}

async function setSearch(page: Page, value: string, note: Note) {
	const box = page.getByLabel("Search by name or email");
	await box.waitFor({ state: "visible", timeout: 20000 });
	await box.fill(value);
	// The filter input debounces for 350ms before it pushes the query.
	await sleep(700);
	await page.waitForLoadState("networkidle");
	note(`search "${value}" → ${page.url()}`);
}

// ==================================================================== the run

mkdirSync(SHOTS, { recursive: true });
await requireServer();
warnAboutEmail();

let browser: Browser | null = null;
let fatal: string | null = null;

try {
	const token = await seed();
	const chrome = await launchBrowser();
	browser = chrome;

	// One context per persona: the block has to be observable from a session the
	// administrator never touches.
	const persona = async () => {
		const context = await chrome.newContext({
			viewport: { width: 1440, height: 900 },
		});
		await installToastSpy(context);
		return context.newPage();
	};
	const admin = await persona();
	const donor = await persona();
	const locky = await persona();
	const invitee = await persona();

	let donorId = "";

	await step(
		1,
		"Admin signs in and lands on /dashboard with admin nav",
		async (note) => {
			currentPage = admin;
			await admin.goto(`${BASE}/login?mode=signin`, {
				waitUntil: "networkidle",
			});
			await submitSignIn(admin, EMAILS.admin, PASSWORD, note);
			await admin.waitForURL(/\/dashboard$/, { timeout: 30000 });
			note(`final URL ${admin.url()}`);
			await waitForShell(admin);
			const nav = await poll(
				"admin nav items",
				async () => {
					const items = await navItems(admin);
					return items.some((i) => i.text === "Users") ? items : false;
				},
				20000,
			);
			note(`nav: ${nav.map((i) => i.text).join(" | ")}`);
			const users = nav.find((i) => i.text === "Users");
			const audit = nav.find((i) => i.text === "Audit log");
			assert(users, "nav has no Users item");
			assert(audit, "nav has no Audit log item");
			note(`Users → ${users.href}; Audit log → ${audit.href}`);
			assert(users.href === "/dashboard/users", `Users href was ${users.href}`);
			assert(
				audit.href === "/dashboard/audit",
				`Audit log href was ${audit.href}`,
			);
		},
	);

	await step(
		2,
		"Users list: search, role filter, blocked filter",
		async (note) => {
			currentPage = admin;
			await admin.goto(`${BASE}/dashboard/users`, { waitUntil: "networkidle" });

			await setSearch(admin, `${TAG}-donor`, note);
			const rows = await poll(
				"donor row after the debounced search",
				async () => {
					const found = await userRows(admin);
					return found.length === 1 && found[0]?.id === `${TAG}-donor`
						? found
						: false;
				},
			);
			const donorRow = rows[0];
			donorId = donorRow.id;
			note(`1 row, id=${donorId}, text="${donorRow.text}"`);
			assert(donorRow.text.includes("E2E Donor"), "the row is not E2E Donor");
			const pills = donorRow.pills.map((p) => p.text);
			note(`pills: ${JSON.stringify(pills)}`);
			assert(
				pills.includes("Verified"),
				`expected a Verified pill, got ${JSON.stringify(pills)}`,
			);

			await admin.goto(`${BASE}/dashboard/users?q=${TAG}`, {
				waitUntil: "networkidle",
			});
			const all = await poll("all three seeded rows", async () => {
				const found = await userRows(admin);
				return found.length === 3 ? found : false;
			});
			note(`q=${TAG} → ${all.map((r) => r.id).join(", ")}`);

			await admin.selectOption('select[aria-label="Role"]', "donor");
			await admin.waitForURL(/role=donor/, { timeout: 20000 });
			const donors = await poll("role-filtered rows", async () => {
				const found = await userRows(admin);
				return found.length === 2 ? found : false;
			});
			const donorIds = donors.map((r) => r.id).sort();
			note(`role=Donor → ${donorIds.join(", ")}`);
			assert(
				donorIds.join(",") === `${TAG}-donor,${TAG}-locky`,
				`the role filter returned ${donorIds.join(", ")}`,
			);

			await admin.goto(`${BASE}/dashboard/users?q=${TAG}&blocked=yes`, {
				waitUntil: "networkidle",
			});
			const blockedRows = await userRows(admin);
			const text = await bodyText(admin);
			note(
				`blocked=yes → ${blockedRows.length} rows; empty state=${text.includes("No accounts match.")}`,
			);
			assert(
				blockedRows.length === 0,
				`the blocked filter listed ${blockedRows.map((r) => r.id).join(", ")}`,
			);
			const status = await admin.inputValue('select[aria-label="Status"]');
			note(`Status select value="${status}" (Blocked)`);
			assert(status === "yes", "the Status select did not reflect blocked=yes");
		},
	);

	await step(
		3,
		"Donor signs in; admin routes redirect to /dashboard",
		async (note) => {
			currentPage = donor;
			await donor.goto(`${BASE}/login?mode=signin`, {
				waitUntil: "networkidle",
			});
			await submitSignIn(donor, EMAILS.donor, PASSWORD, note);
			await donor.waitForURL(/\/dashboard$/, { timeout: 30000 });
			await waitForShell(donor);
			note(`donor landed on ${donor.url()}`);

			await donor.goto(`${BASE}/dashboard/users`, { waitUntil: "networkidle" });
			note(`/dashboard/users → ${donor.url()}`);
			assert(
				new URL(donor.url()).pathname === "/dashboard",
				`expected /dashboard, got ${donor.url()}`,
			);
			await donor.goto(`${BASE}/dashboard/audit`, { waitUntil: "networkidle" });
			note(`/dashboard/audit → ${donor.url()}`);
			assert(
				new URL(donor.url()).pathname === "/dashboard",
				`expected /dashboard, got ${donor.url()}`,
			);

			await waitForShell(donor);
			const nav = await navItems(donor);
			note(`donor nav: ${nav.map((i) => i.text).join(" | ")}`);
			assert(nav.length > 1, "the donor sidebar rendered no nav items");
			assert(
				!nav.some((i) => i.text === "Users" || i.href === "/dashboard/users"),
				"the donor nav exposes a Users item",
			);
			assert(
				!nav.some(
					(i) => i.text === "Audit log" || i.href === "/dashboard/audit",
				),
				"the donor nav exposes an Audit log item",
			);
		},
	);

	await step(4, "Admin blocks the donor from the detail page", async (note) => {
		currentPage = admin;
		await admin.goto(`${BASE}/dashboard/users/${donorId}`, {
			waitUntil: "networkidle",
		});
		note(`detail page for ${donorId}`);
		await clearToasts(admin);
		await admin.getByRole("button", { name: /^Block$/ }).click();
		await admin
			.getByRole("dialog")
			.waitFor({ state: "visible", timeout: 10000 });
		await admin.locator('div[role="dialog"] textarea').fill("e2e block test");
		await admin.getByRole("button", { name: /Block account/ }).click();
		note(`toast: "${await expectToast(admin, "Account blocked")}"`);

		const pills = await poll(
			"a Blocked pill on the refreshed detail page",
			async () => {
				await admin.reload({ waitUntil: "networkidle" });
				const found = await pillTexts(admin);
				return found.some((p) => p.text === "Blocked") ? found : false;
			},
			25000,
			1200,
		);
		note(
			`detail pills after refresh: ${JSON.stringify(pills.map((p) => p.text))}`,
		);
		assert(
			(await bodyText(admin)).includes("e2e block test"),
			"the block reason is not shown on the detail page",
		);
		note('block reason "e2e block test" shown on the detail page');
	});

	await step(
		5,
		"Blocked donor's live session is revoked server-side",
		async (note) => {
			currentPage = donor;
			await donor.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
			await poll(
				"/login after the block",
				async () => new URL(donor.url()).pathname === "/login",
				20000,
			);
			note(`donor reload of /dashboard → ${donor.url()}`);
		},
	);

	await step(6, "Blocked donor cannot sign in", async (note) => {
		currentPage = donor;
		await donor.goto(`${BASE}/login?mode=signin`, { waitUntil: "networkidle" });
		await submitSignIn(donor, EMAILS.donor, PASSWORD, note);
		note(
			`toast: "${await expectToast(donor, "This account has been blocked")}"`,
		);
		await sleep(1500);
		note(`final URL ${donor.url()}`);
		assert(
			!donor.url().includes("/verify-email"),
			`the blocked sign-in landed on ${donor.url()}`,
		);
	});

	await step(
		9,
		"Invite lifecycle through the UI (send, resend, revoke)",
		async (note) => {
			currentPage = admin;
			await admin.goto(`${BASE}/dashboard/users`, { waitUntil: "networkidle" });
			await clearToasts(admin);
			await admin.getByRole("button", { name: /Invite administrator/ }).click();
			const dialog = admin.getByRole("dialog");
			await dialog.waitFor({ state: "visible", timeout: 10000 });
			await dialog.locator('input[type="email"]').fill(EMAILS.invitee);
			await admin.getByRole("button", { name: /Send invitation/ }).click();
			note(`toast: "${await expectToast(admin, "Invitation sent")}"`);

			const row = await poll(
				"the pending invitation row for the invitee",
				async () => {
					const found = await admin.evaluate((email) => {
						for (const div of Array.from(
							document.querySelectorAll<HTMLElement>("div.grid"),
						)) {
							const text = (div.innerText || "").replace(/\s+/g, " ").trim();
							if (text.includes(email)) return text;
						}
						return null;
					}, EMAILS.invitee);
					if (found) return found;
					await admin.reload({ waitUntil: "networkidle" });
					return false;
				},
				25000,
				1200,
			);
			note(`invitation row: "${row}"`);
			assert(
				(await bodyText(admin)).includes("Pending invitations"),
				'there is no "Pending invitations" card',
			);
			assert(
				row.includes("E2E Admin"),
				`the inviter is not rendered in the row: "${row}"`,
			);

			await clearToasts(admin);
			await admin
				.locator("div.grid")
				.filter({ hasText: EMAILS.invitee })
				.last()
				.getByRole("button", { name: /Resend/ })
				.click();
			note(`toast: "${await expectToast(admin, "Invitation resent")}"`);

			await clearToasts(admin);
			await admin
				.locator("div.grid")
				.filter({ hasText: EMAILS.invitee })
				.last()
				.getByRole("button", { name: /Revoke/ })
				.click();
			note(`toast: "${await expectToast(admin, "Invitation revoked")}"`);
			await poll(
				"the invitee row to disappear",
				async () => {
					if (!(await bodyText(admin)).includes(EMAILS.invitee)) return true;
					await admin.reload({ waitUntil: "networkidle" });
					return false;
				},
				25000,
				1200,
			);
			note("invitee no longer listed; the card remains for the seeded invite");
		},
	);

	await step(
		10,
		"Inviting an address that already has an account is rejected",
		async (note) => {
			currentPage = admin;
			await admin.goto(`${BASE}/dashboard/users`, { waitUntil: "networkidle" });
			await clearToasts(admin);
			await admin.getByRole("button", { name: /Invite administrator/ }).click();
			const dialog = admin.getByRole("dialog");
			await dialog.waitFor({ state: "visible", timeout: 10000 });
			await dialog.locator('input[type="email"]').fill(EMAILS.donor);
			await admin.getByRole("button", { name: /Send invitation/ }).click();
			note(`toast: "${await expectToast(admin, "already has an account")}"`);
			await admin.keyboard.press("Escape");
		},
	);

	await step(
		12,
		"Administrator cannot block their own account",
		async (note) => {
			currentPage = admin;
			await admin.goto(`${BASE}/dashboard/users/${TAG}-admin`, {
				waitUntil: "networkidle",
			});
			const text = await bodyText(admin);
			note(
				`own detail page contains "This is your account.": ${text.includes("This is your account.")}`,
			);
			assert(
				text.includes("This is your account."),
				'"This is your account." is missing',
			);
			const blockButtons = await admin
				.getByRole("button", { name: /^Block$/ })
				.count();
			const unblockButtons = await admin
				.getByRole("button", { name: /^Unblock$/ })
				.count();
			note(`Block buttons=${blockButtons} Unblock buttons=${unblockButtons}`);
			assert(
				blockButtons === 0,
				"a Block button is rendered on the own account",
			);
			assert(
				unblockButtons === 0,
				"an Unblock button is rendered on the own account",
			);
		},
	);

	await step(14, "Admin-plugin HTTP surface is closed (404)", async (note) => {
		currentPage = null;
		const res = await fetch(`${BASE}/api/auth/admin/ban-user`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "{}",
		});
		note(`POST /api/auth/admin/ban-user → HTTP ${res.status}`);
		assert(res.status === 404, `expected 404, got ${res.status}`);
	});

	await step(7, "Unblock restores sign-in for the donor", async (note) => {
		currentPage = admin;
		await admin.goto(`${BASE}/dashboard/users/${donorId}`, {
			waitUntil: "networkidle",
		});
		await clearToasts(admin);
		await admin.getByRole("button", { name: /^Unblock$/ }).click();
		note(`toast: "${await expectToast(admin, "Account unblocked")}"`);
		await poll(
			"the Blocked pill to disappear",
			async () => {
				await admin.reload({ waitUntil: "networkidle" });
				const found = await pillTexts(admin);
				return !found.some((p) => p.text === "Blocked");
			},
			25000,
			1200,
		);
		note("the detail page no longer shows a Blocked pill");

		currentPage = donor;
		await donor.goto(`${BASE}/login?mode=signin`, { waitUntil: "networkidle" });
		await submitSignIn(donor, EMAILS.donor, PASSWORD, note);
		await donor.waitForURL(/\/dashboard$/, { timeout: 45000 });
		await waitForShell(donor);
		note(`donor signed in again → ${donor.url()}`);
	});

	await step(8, "Lockout after 3 failed sign-ins", async (note) => {
		currentPage = locky;
		await freshSignInWindow(note);
		await locky.goto(`${BASE}/login?mode=signin`, { waitUntil: "networkidle" });
		for (let attempt = 1; attempt <= 3; attempt++) {
			await submitSignIn(locky, EMAILS.locky, "WrongPass!000", note);
			const seen = await poll(
				`a toast for failed attempt ${attempt}`,
				async () => {
					const all = await toasts(locky);
					return all.length ? all : false;
				},
			);
			note(`attempt ${attempt} toast: ${JSON.stringify(seen)}`);
			await sleep(500);
		}

		note("waiting 66s for the sign-in rate window to reset");
		await sleep(WINDOW_MS);
		resetSignInWindow();

		await locky.goto(`${BASE}/login?mode=signin`, { waitUntil: "networkidle" });
		await submitSignIn(locky, EMAILS.locky, "WrongPass!000", note);
		const locked = await poll(
			'text containing "temporarily locked"',
			async () => {
				const haystack = `${(await toasts(locky)).join(" | ")} ${await bodyText(locky)}`;
				return haystack.includes("temporarily locked") ? haystack : false;
			},
			25000,
		);
		note(
			`4th attempt surfaced: "${locked.match(/[^|]*temporarily locked[^|]*/)?.[0]?.trim()}"`,
		);
		note(`final URL ${locky.url()}`);
		assert(
			!locky.url().includes("/verify-email"),
			`the locked sign-in landed on ${locky.url()}`,
		);

		currentPage = admin;
		await admin.goto(`${BASE}/dashboard/users?q=${TAG}-locky`, {
			waitUntil: "networkidle",
		});
		const rows = await poll("the locky row", async () => {
			const found = await userRows(admin);
			return found.length === 1 ? found : false;
		});
		const pills = rows[0].pills;
		note(`locky pills: ${JSON.stringify(pills.map((p) => p.text))}`);
		const lockedPill = pills.find((p) => p.text === "Locked");
		assert(
			lockedPill,
			`no Locked pill (pills: ${pills.map((p) => p.text).join(", ")})`,
		);
		note(`Locked pill class: ${lockedPill.cls}`);
		assert(
			/warn/.test(lockedPill.cls),
			`the Locked pill is not amber: ${lockedPill.cls}`,
		);
		assert(
			!pills.some((p) => p.text === "Blocked"),
			"a locked account also reads as Blocked",
		);
	});

	await step(
		11,
		"Accept-invite: the link works once, then reads as used",
		async (note) => {
			currentPage = invitee;
			// Accepting signs the new administrator in server-side, through the same
			// rate-limited path, so the window has to be clear first.
			await freshSignInWindow(note);
			const url = `${BASE}/accept-invite?token=${token}`;
			await invitee.goto(url, { waitUntil: "networkidle" });
			const text = await bodyText(invitee);
			note(
				`page contains "Accept your invitation": ${text.includes("Accept your invitation")}`,
			);
			assert(
				text.includes("Accept your invitation"),
				`the accept page showed: "${text.slice(0, 200)}"`,
			);
			assert(
				text.includes(EMAILS.accepted),
				"the invitee email is not rendered",
			);
			note(`invitee email rendered: ${EMAILS.accepted}`);

			await invitee.getByLabel("Full name").fill("E2E Invited");
			const password = invitee.locator('input[autocomplete="new-password"]');
			const boxes = await password.count();
			assert(boxes === 2, `expected 2 password inputs, got ${boxes}`);
			await password.nth(0).fill(PASSWORD);
			await password.nth(1).fill(PASSWORD);

			rlCount = 1;
			rlLast = Date.now();
			await invitee.getByRole("button", { name: /Accept invitation/ }).click();
			await invitee.waitForURL(/\/dashboard$/, { timeout: 40000 });
			note(`accepted → ${invitee.url()}`);
			await waitForShell(invitee);
			const nav = await navItems(invitee);
			note(`new admin nav: ${nav.map((i) => i.text).join(" | ")}`);
			assert(
				nav.some((i) => i.text === "Users") &&
					nav.some((i) => i.text === "Audit log"),
				"the new administrator lacks the admin nav",
			);

			await invitee.goto(url, { waitUntil: "networkidle" });
			const again = await bodyText(invitee);
			note(`re-visiting the link shows: "${again.slice(0, 120)}"`);
			assert(
				again.includes("This invitation was already used"),
				`expected "already used", got "${again.slice(0, 200)}"`,
			);
		},
	);

	await step(
		13,
		"Audit log records every administrative action",
		async (note) => {
			currentPage = admin;
			await admin.goto(`${BASE}/dashboard/audit`, { waitUntil: "networkidle" });
			const text = await bodyText(admin);
			const expected = [
				"User blocked",
				"e2e block test",
				"User unblocked",
				"Invitation sent",
				"Invitation revoked",
				"Invitation accepted",
				"E2E Admin",
				"E2E Invited",
			];
			const missing = expected.filter((entry) => !text.includes(entry));
			note(
				`present: ${expected.filter((entry) => text.includes(entry)).join(", ")}`,
			);
			assert(
				missing.length === 0,
				`missing from the audit log: ${missing.join(", ")}`,
			);
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
