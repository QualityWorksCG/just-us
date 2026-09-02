/**
 * Demo seed — a coherent, shareable dataset for client walkthroughs.
 *
 * Run from `packages/db`:
 *
 *   DEMO_DATABASE_URL='postgresql://…' \
 *   bun run seed-demo.ts <path-to-demo-hashes.json>
 *
 * Password hashes are produced separately by `packages/auth/gen-demo-hashes.ts`
 * using Better Auth's own `hashPassword`, so sign-in works without this file
 * knowing anything about scrypt. No plaintext password appears here.
 *
 * ## Safety
 *
 * The connection string comes from `DEMO_DATABASE_URL` — deliberately *not*
 * `DATABASE_URL`, because `apps/web/.env` sets that to a local database and Bun
 * auto-loads `.env` files. A seed that silently targeted the wrong database is
 * the failure worth engineering against, so the host is also asserted against
 * `EXPECT_DB_HOST` before a single row is written.
 *
 * ## Idempotency
 *
 * Re-running replaces the demo data rather than duplicating it: every demo
 * account lives at `@justusdemo.com`, and the cleanup deletes those users and
 * the rows that hang off them. Deletion order matters — `Case.payoutAccountId`
 * is `onDelete: Restrict`, so cases are removed before the payout accounts they
 * are bound to.
 *
 * Rows that carry a plain `userId`/`recipientId` instead of a foreign key
 * (Notification, CaseUpdate) do not cascade and are deleted explicitly.
 */
import { randomBytes, randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./prisma/generated/client";

// ── Wiring and guards ──────────────────────────────────────────────────────

const hashesPath = process.argv[2];
const connectionString = process.env.DEMO_DATABASE_URL;
const expectHost = process.env.EXPECT_DB_HOST;

if (!hashesPath) throw new Error("usage: bun run seed-demo.ts <hashes.json>");
if (!connectionString) throw new Error("DEMO_DATABASE_URL must be set");
if (!expectHost) {
	throw new Error(
		"EXPECT_DB_HOST must be set — it is the guard that keeps this off the wrong database",
	);
}

const targetHost = new URL(connectionString).hostname;
if (!targetHost.includes(expectHost)) {
	throw new Error(
		`ABORT: DEMO_DATABASE_URL host is "${targetHost}", which does not match EXPECT_DB_HOST "${expectHost}".`,
	);
}

const passwordHashes: Record<string, string> = await Bun.file(hashesPath).json();

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

console.log(`[seed] target ${targetHost}`);

// ── Helpers ────────────────────────────────────────────────────────────────

/** Fixed "now" so one run produces one coherent timeline. */
const NOW = new Date();
const daysAgo = (n: number, hour = 12) => {
	const d = new Date(NOW);
	d.setUTCDate(d.getUTCDate() - n);
	d.setUTCHours(hour, 0, 0, 0);
	return d;
};

/** 5% platform fee on the selected gift — matching `feeCentsAtBps` / fee-on-top. */
const FEE_BPS = 500;
const feeCents = (giftCents: number) =>
	Math.min(Math.round((giftCents * FEE_BPS) / 10_000), giftCents);

const token = () => randomBytes(24).toString("hex");
const serial = () =>
	`JU-${randomBytes(3).toString("hex").toUpperCase().slice(0, 5)}`;

type DemoUser = {
	key: string;
	email: string;
	name: string;
	role: "administrator" | "plaintiff" | "attorney" | "donor";
	jurisdiction?: string;
	firmName?: string;
	barNumber?: string;
	donationsAnonymous?: boolean;
	createdDaysAgo: number;
};

const USERS: DemoUser[] = [
	{
		key: "admin",
		email: "admin@justusdemo.com",
		name: "Alicia Grant",
		role: "administrator",
		createdDaysAgo: 96,
	},
	{
		key: "marcus",
		email: "plaintiff@justusdemo.com",
		name: "Marcus Reed",
		role: "plaintiff",
		createdDaysAgo: 52,
	},
	{
		key: "denise",
		email: "plaintiff2@justusdemo.com",
		name: "Denise Okafor",
		role: "plaintiff",
		createdDaysAgo: 74,
	},
	{
		key: "priya",
		email: "attorney@justusdemo.com",
		name: "Priya Raman",
		role: "attorney",
		jurisdiction: "California",
		firmName: "Raman Employment Law",
		barNumber: "CA-248901",
		createdDaysAgo: 88,
	},
	{
		key: "david",
		email: "attorney2@justusdemo.com",
		name: "David Whitfield",
		role: "attorney",
		jurisdiction: "Texas",
		firmName: "Whitfield Tenant Advocacy",
		barNumber: "TX-118455",
		createdDaysAgo: 81,
	},
	{
		key: "karen",
		email: "attorney3@justusdemo.com",
		name: "Karen Liu",
		role: "attorney",
		jurisdiction: "New York",
		firmName: "Liu & Associates",
		barNumber: "NY-772310",
		createdDaysAgo: 9,
	},
	{
		key: "samuel",
		email: "donor@justusdemo.com",
		name: "Samuel Boateng",
		role: "donor",
		createdDaysAgo: 44,
	},
	{
		key: "rebecca",
		email: "donor2@justusdemo.com",
		name: "Rebecca Lindqvist",
		role: "donor",
		// Gives the supporter list one "Anonymous" entry alongside named ones,
		// which is the only way to see that the privacy setting actually works.
		donationsAnonymous: true,
		createdDaysAgo: 30,
	},
];

// ── Cleanup ────────────────────────────────────────────────────────────────

async function cleanup() {
	const existing = await prisma.user.findMany({
		where: { email: { endsWith: "@justusdemo.com" } },
		select: { id: true },
	});
	if (existing.length === 0) {
		console.log("[seed] no previous demo data");
		return;
	}
	const ids = existing.map((u) => u.id);

	const cases = await prisma.case.findMany({
		where: { ownerId: { in: ids } },
		select: { id: true },
	});
	const caseIds = cases.map((c) => c.id);

	// Plain-id rows first: nothing cascades to them.
	await prisma.notification.deleteMany({ where: { recipientId: { in: ids } } });
	if (caseIds.length) {
		await prisma.caseUpdate.deleteMany({ where: { caseId: { in: caseIds } } });
		await prisma.caseFollow.deleteMany({ where: { caseId: { in: caseIds } } });
		await prisma.savedCase.deleteMany({ where: { caseId: { in: caseIds } } });
	}
	await prisma.notificationPreference.deleteMany({
		where: { userId: { in: ids } },
	});

	// Cases before payout accounts: Case.payoutAccountId is onDelete: Restrict,
	// so a bound case would block deleting the account it points at.
	await prisma.case.deleteMany({ where: { ownerId: { in: ids } } });
	await prisma.payoutAccount.deleteMany({ where: { userId: { in: ids } } });

	// Users cascade to sessions, accounts, attorney profiles (and their
	// verifications/reviews/records), conversations and messages.
	await prisma.user.deleteMany({ where: { id: { in: ids } } });
	console.log(
		`[seed] removed ${ids.length} previous demo users and ${caseIds.length} cases`,
	);
}

// ── Users ──────────────────────────────────────────────────────────────────

async function createUsers() {
	const byKey: Record<string, string> = {};
	for (const u of USERS) {
		const hash = passwordHashes[u.email];
		if (!hash) throw new Error(`no password hash for ${u.email}`);
		const id = randomUUID();
		byKey[u.key] = id;
		await prisma.user.create({
			data: {
				id,
				name: u.name,
				email: u.email,
				// Both are required for a usable demo account: sign-in is blocked by
				// `requireEmailVerification`, and the app gates every screen on
				// `onboarded` until the role-selection step is done.
				emailVerified: true,
				onboarded: true,
				role: u.role,
				jurisdiction: u.jurisdiction ?? null,
				// The admission is what decides which cases reach an attorney — the
				// column above is only the primary label — so a demo attorney seeded
				// without one would sign in to an empty queue. Verified here because
				// these accounts are meant to be walked through, and an unverified
				// admission can browse but not act.
				...(u.role === "attorney" && u.jurisdiction
					? {
							admissions: {
								create: {
									state: u.jurisdiction,
									barNumber: u.barNumber ?? null,
									verificationStatus: "verified" as const,
									verifiedAt: daysAgo(u.createdDaysAgo),
								},
							},
						}
					: {}),
				firmName: u.firmName ?? null,
				barNumber: u.barNumber ?? null,
				donationsAnonymous: u.donationsAnonymous ?? false,
				createdAt: daysAgo(u.createdDaysAgo),
				lastSignInAt: daysAgo(Math.max(1, Math.floor(u.createdDaysAgo / 10))),
				accounts: {
					create: {
						id: randomUUID(),
						// Better Auth's email/password provider. accountId is the user id.
						accountId: id,
						providerId: "credential",
						password: hash,
						createdAt: daysAgo(u.createdDaysAgo),
					},
				},
			},
		});
	}
	console.log(`[seed] ${USERS.length} users`);
	return byKey;
}

// ── Attorney profiles ──────────────────────────────────────────────────────

async function createAttorneyProfiles(u: Record<string, string>) {
	// Priya — the flagship verified profile.
	const priya = await prisma.attorneyProfile.create({
		data: {
			userId: u.priya,
			legalName: "Priya Raman",
			firmName: "Raman Employment Law",
			officeCity: "San Francisco",
			officeState: "California",
			contactEmail: "priya@ramanemploymentlaw.example",
			contactPhone: "(415) 555-0138",
			websiteUrl: "https://ramanemploymentlaw.example",
			practiceAreas: ["Employment", "Wage & hours", "Civil rights"],
			practiceAreaShares: {
				Employment: 60,
				"Wage & hours": 25,
				"Civil rights": 15,
			},
			admittedYear: 2011,
			education: "J.D., UC Berkeley School of Law · 2010",
			languages: ["English", "Tamil", "Spanish"],
			acceptingNewCases: true,
			virtualConsultation: true,
			feeApproach: "contingency",
			bio: "I represent workers against employers who thought nobody would push back. Fifteen years of retaliation, wrongful termination and unpaid-wage cases, most of them for people who were told they had no case.",
			background:
				"Previously staff attorney at the Legal Aid at Work wage clinic. Named to the Northern California Super Lawyers Rising Stars list, 2018–2021.",
			bioStatus: "approved",
			bioReviewedAt: daysAgo(80),
			verificationStatus: "verified",
			verifiedAt: daysAgo(86),
			createdAt: daysAgo(87),
		},
	});

	// David — second verified profile, a different practice and fee approach.
	const david = await prisma.attorneyProfile.create({
		data: {
			userId: u.david,
			legalName: "David Whitfield",
			firmName: "Whitfield Tenant Advocacy",
			officeCity: "Austin",
			officeState: "Texas",
			contactEmail: "david@whitfieldtenant.example",
			contactPhone: "(512) 555-0164",
			practiceAreas: ["Housing", "Consumer fraud", "Contract disputes"],
			admittedYear: 2015,
			education: "J.D., University of Texas School of Law · 2014",
			languages: ["English", "Spanish"],
			acceptingNewCases: true,
			virtualConsultation: false,
			feeApproach: "flat",
			feeRangeMinCents: 250_000,
			feeRangeMaxCents: 900_000,
			bio: "Tenant-side housing law in Central Texas. Illegal evictions, uninhabitable conditions, and deposit theft — the cases landlords expect to win by default.",
			background:
				"Six years with Texas RioGrande Legal Aid before opening the firm in 2021.",
			bioStatus: "approved",
			bioReviewedAt: daysAgo(76),
			verificationStatus: "verified",
			verifiedAt: daysAgo(79),
			createdAt: daysAgo(80),
		},
	});

	// Karen — deliberately NOT verified. Gives the administrator a real item in
	// the verification queue, and demonstrates that an unverified attorney is
	// absent from the public directory (`listableWhere` requires "verified").
	const karen = await prisma.attorneyProfile.create({
		data: {
			userId: u.karen,
			legalName: "Karen Liu",
			firmName: "Liu & Associates",
			officeCity: "Brooklyn",
			officeState: "New York",
			contactEmail: "karen@liuassociates.example",
			practiceAreas: ["Elder care", "Estate & probate"],
			admittedYear: 2008,
			languages: ["English", "Mandarin", "Cantonese"],
			acceptingNewCases: true,
			virtualConsultation: true,
			feeApproach: "hourly",
			feeRangeMinCents: 30_000,
			feeRangeMaxCents: 55_000,
			bio: "Elder law and probate practice serving Brooklyn and Queens families for over fifteen years.",
			bioStatus: "pending",
			verificationStatus: "needs_review",
			createdAt: daysAgo(8),
		},
	});

	// Evidence trails behind each badge.
	await prisma.attorneyVerification.createMany({
		data: [
			{
				profileId: priya.id,
				status: "verified",
				confidence: 94,
				isLicensedAttorney: true,
				inGoodStanding: true,
				licenseStatusText: "Active — in good standing",
				matchedName: "Priya Raman",
				matchedBarNumber: "248901",
				matchedJurisdiction: "California",
				summary:
					"Located the State Bar of California licensee record for Priya Raman, bar number 248901. Status reads Active with no public discipline. Admission year matches the profile.",
				officialRecordUrl:
					"https://apps.calbar.ca.gov/attorney/Licensee/Detail/248901",
				sources: [
					{
						url: "https://apps.calbar.ca.gov/attorney/Licensee/Detail/248901",
						title: "State Bar of California — Licensee Detail",
						official: true,
					},
				],
				checkedName: "Priya Raman",
				checkedJurisdiction: "California",
				model: "gpt-4o-search-preview",
				triggeredBy: u.priya,
				createdAt: daysAgo(86),
			},
			{
				profileId: david.id,
				status: "verified",
				confidence: 91,
				isLicensedAttorney: true,
				inGoodStanding: true,
				licenseStatusText: "Eligible to practice in Texas",
				matchedName: "David A. Whitfield",
				matchedBarNumber: "118455",
				matchedJurisdiction: "Texas",
				summary:
					"State Bar of Texas record confirms David A. Whitfield, bar number 118455, eligible to practice with no disciplinary history on file.",
				officialRecordUrl:
					"https://www.texasbar.com/AM/Template.cfm?Section=Find_A_Lawyer&id=118455",
				sources: [
					{
						url: "https://www.texasbar.com/AM/Template.cfm?Section=Find_A_Lawyer&id=118455",
						title: "State Bar of Texas — Find a Lawyer",
						official: true,
					},
				],
				checkedName: "David Whitfield",
				checkedJurisdiction: "Texas",
				model: "gpt-4o-search-preview",
				triggeredBy: u.david,
				createdAt: daysAgo(79),
			},
			{
				profileId: karen.id,
				status: "needs_review",
				confidence: 48,
				isLicensedAttorney: true,
				inGoodStanding: null,
				matchedName: "Karen M. Liu",
				matchedJurisdiction: "New York",
				disciplinaryNotes:
					"No discipline found, but the sources reached could not confirm current registration status.",
				summary:
					"Found a firm biography and a bar-association directory entry naming Karen M. Liu in New York, but could not reach an official licensee record confirming current standing. Evidence is unofficial — referred for administrator review rather than badged.",
				officialRecordUrl: null,
				sources: [
					{
						url: "https://liuassociates.example/about",
						title: "Liu & Associates — Attorneys",
						official: false,
					},
					{
						url: "https://www.brooklynbar.example/directory",
						title: "Brooklyn Bar Association directory",
						official: false,
					},
				],
				checkedName: "Karen Liu",
				checkedJurisdiction: "New York",
				model: "gpt-4o-search-preview",
				triggeredBy: u.karen,
				createdAt: daysAgo(7),
			},
		],
	});

	await prisma.attorneyReview.createMany({
		data: [
			{
				profileId: priya.id,
				rating: 5,
				quote:
					"She took my case when two other firms said the damages were too small to bother with. Settled in four months and explained every step.",
				byline: "former client, wrongful termination",
				createdAt: daysAgo(64),
			},
			{
				profileId: priya.id,
				rating: 5,
				quote:
					"Straight answers, never once made me feel like I was wasting her time.",
				byline: "former client, unpaid overtime",
				createdAt: daysAgo(41),
			},
			{
				profileId: priya.id,
				rating: 4,
				quote:
					"Excellent lawyer. Communication slowed during trial prep, but the outcome spoke for itself.",
				byline: "former client, retaliation claim",
				createdAt: daysAgo(22),
			},
			{
				profileId: david.id,
				rating: 5,
				quote:
					"My landlord had already changed the locks. David had us back in the apartment within a week.",
				byline: "former client, illegal eviction",
				createdAt: daysAgo(55),
			},
			{
				profileId: david.id,
				rating: 4,
				quote:
					"Recovered my full deposit plus penalties. Worth every dollar of the flat fee.",
				byline: "former client, deposit dispute",
				createdAt: daysAgo(18),
			},
		],
	});

	await prisma.attorneyCaseRecord.createMany({
		data: [
			{
				profileId: priya.id,
				year: 2025,
				title: "Retaliatory discharge — regional logistics employer",
				amount: "$410,000 settlement",
				outcome: "settled",
			},
			{
				profileId: priya.id,
				year: 2024,
				title: "Unpaid overtime class claim — 62 warehouse workers",
				amount: "$1.2M class recovery",
				outcome: "won",
			},
			{
				profileId: priya.id,
				year: 2023,
				title: "Disability accommodation refusal — county contractor",
				amount: "$185,000 settlement",
				outcome: "settled",
			},
			{
				profileId: david.id,
				year: 2025,
				title: "Habitability action — 34-unit building, Austin",
				amount: "$96,000 in repairs ordered",
				outcome: "won",
			},
			{
				profileId: david.id,
				year: 2024,
				title: "Deposit theft — multi-property landlord",
				amount: "$48,000 recovered",
				outcome: "settled",
			},
		],
	});

	console.log("[seed] 3 attorney profiles (2 verified, 1 needs_review)");
	return { priya, david, karen };
}

// ── Cases ──────────────────────────────────────────────────────────────────

async function createCases(u: Record<string, string>) {
	// 1. LIVE — the flagship public campaign, funding now.
	const live = await prisma.case.create({
		data: {
			ownerId: u.marcus,
			title: "Fired for reporting unpaid overtime",
			category: "Employment",
			location: "California",
			summary:
				"After I raised unpaid overtime with HR, I was written up twice in a week and terminated for “performance”. I need representation to bring a retaliation claim.",
			story:
				"I worked the loading dock at a distribution centre outside Sacramento for six years. In March I put in writing that the shift-differential hours were not showing up on our pay stubs — I had eleven colleagues who could say the same.\n\nEleven days later I received my first written warning in six years. A week after that I was terminated for “performance inconsistency”. My last review, dated seven weeks earlier, called me one of the most reliable people on the floor.\n\nI am not asking anyone to pay me. Every dollar raised here goes to the firm representing me, so I can afford counsel who does this for a living. If we win, my colleagues get paid too.",
			evidence: [
				{ name: "termination-letter.pdf", size: 184_320 },
				{ name: "performance-review-january.pdf", size: 249_856 },
				{ name: "hr-email-thread.pdf", size: 96_512 },
				{ name: "pay-stubs-march.pdf", size: 421_888 },
			],
			thankYouNote:
				"I still find it hard to believe strangers did this. Whatever happens in court, you made it possible for me to be in the room. Thank you. — Marcus",
			attorneyName: "Priya Raman",
			attorneyFirm: "Raman Employment Law",
			attorneyArea: "Employment",
			attorneyLocation: "California",
			goalCents: 1_200_000,
			payoutType: "bank_transfer",
			payoutRecipient: "attorney",
			status: "live",
			moderationStatus: "ok",
			viewsCount: 1_284,
			sharesCount: 37,
			createdAt: daysAgo(38),
			publishedAt: daysAgo(31),
			ownerUpdatesSeenAt: daysAgo(4),
		},
	});

	// 2. SEEKING — published to attorneys, no match yet, two requests waiting.
	const seeking = await prisma.case.create({
		data: {
			ownerId: u.denise,
			title: "Evicted three weeks after asking for repairs",
			category: "Housing",
			location: "Texas",
			summary:
				"I reported black mould and a failing water heater. My lease was terminated before the repairs were ever made.",
			story:
				"The water heater failed in January and the bathroom wall had visible mould by February. I reported both in writing twice, then to the city.\n\nThe inspector came on a Tuesday. On the Friday I was served a notice of non-renewal with no reason given. I have two children in school in this district and thirty days to be out.\n\nI need an attorney who does retaliatory-eviction work in Texas. I cannot pay a retainer up front, which is the only reason I am here.",
			evidence: [
				{ name: "repair-requests.pdf", size: 132_096 },
				{ name: "city-inspection-report.pdf", size: 305_152 },
				{ name: "non-renewal-notice.pdf", size: 88_064 },
				{ name: "bathroom-photos.zip", size: 2_458_624 },
			],
			goalCents: 850_000,
			payoutType: "bank_transfer",
			status: "seeking",
			moderationStatus: "ok",
			viewsCount: 96,
			createdAt: daysAgo(12),
			publishedAt: daysAgo(11),
		},
	});

	// 3. DRAFT — private to the owner; demonstrates resuming the wizard.
	const draft = await prisma.case.create({
		data: {
			ownerId: u.marcus,
			title: "Denied benefits without a medical review",
			category: "Other",
			location: "California",
			summary:
				"My claim was denied in nine days with no examination and no explanation of which records were considered.",
			story:
				"Still writing this. I have the denial letter and the appeal deadline is in six weeks.",
			goalCents: 0,
			status: "draft",
			moderationStatus: "ok",
			createdAt: daysAgo(3),
		},
	});

	// 4. PENDING_PAYOUT — the plaintiff finished; waiting on the firm's Stripe
	// account, which is exactly what this state exists for.
	const pendingPayout = await prisma.case.create({
		data: {
			ownerId: u.denise,
			title: "Two years of stolen overtime at a staffing agency",
			category: "Wage & hours",
			location: "Texas",
			summary:
				"The agency rounded every shift down to the half hour. Across two years and roughly forty of us, that is a substantial amount of unpaid time.",
			story:
				"Every shift was recorded to the minute on the client's system and rounded down on the agency's. I kept my own log for the last fourteen months, and I have colleagues who kept theirs.\n\nDavid has agreed to take the case. We are waiting on the firm's payout account to finish verification before this can go public.",
			evidence: [
				{ name: "personal-shift-log.xlsx", size: 74_752 },
				{ name: "agency-timesheets-2024.pdf", size: 1_216_512 },
			],
			attorneyName: "David Whitfield",
			attorneyFirm: "Whitfield Tenant Advocacy",
			attorneyArea: "Wage & hours",
			attorneyLocation: "Texas",
			goalCents: 900_000,
			payoutType: "bank_transfer",
			status: "pending_payout",
			moderationStatus: "ok",
			createdAt: daysAgo(9),
			publishedAt: daysAgo(2),
		},
	});

	// 5. CLOSED — fully funded and resolved; the source of the certificates.
	const closed = await prisma.case.create({
		data: {
			ownerId: u.denise,
			title: "Predatory auto loan at 29% APR",
			category: "Consumer fraud",
			location: "Texas",
			summary:
				"The financing paperwork I signed showed 11%. The contract filed with the lender said 29%.",
			story:
				"I bought a used car in 2024. The payment schedule the dealer walked me through was based on 11% APR. The executed contract, which I only obtained months later, was written at 29%.\n\nWith representation we recovered the difference and the contract was rescinded. This case is closed. Thank you to everyone who made it possible.",
			evidence: [{ name: "loan-contract-executed.pdf", size: 512_000 }],
			thankYouNote:
				"We won. I got the money back and the contract is gone. You did that. — Denise",
			attorneyName: "David Whitfield",
			attorneyFirm: "Whitfield Tenant Advocacy",
			attorneyArea: "Consumer fraud",
			attorneyLocation: "Texas",
			goalCents: 350_000,
			payoutType: "bank_transfer",
			payoutRecipient: "attorney",
			status: "closed",
			moderationStatus: "ok",
			viewsCount: 2_610,
			sharesCount: 64,
			createdAt: daysAgo(70),
			publishedAt: daysAgo(66),
			ownerUpdatesSeenAt: daysAgo(20),
		},
	});

	console.log("[seed] 5 cases (live, seeking, draft, pending_payout, closed)");
	return { live, seeking, draft, pendingPayout, closed };
}

// ── Payout accounts, matches and requests ──────────────────────────────────

async function createRepresentation(
	u: Record<string, string>,
	c: Awaited<ReturnType<typeof createCases>>,
) {
	// The live case: account opened for it, transfers enabled, and bound as the
	// destination. All three are required before a donation can be taken.
	const liveAccount = await prisma.payoutAccount.create({
		data: {
			caseId: c.live.id,
			userId: u.priya,
			stripeAccountId: "acct_demo_raman_live_01",
			detailsSubmitted: true,
			transfersEnabled: true,
			payoutsEnabled: true,
			syncedAt: daysAgo(1),
			createdAt: daysAgo(33),
		},
	});
	await prisma.case.update({
		where: { id: c.live.id },
		data: { payoutAccountId: liveAccount.id },
	});

	// The closed case: also bound — it took real donations before closing.
	const closedAccount = await prisma.payoutAccount.create({
		data: {
			caseId: c.closed.id,
			userId: u.david,
			stripeAccountId: "acct_demo_whitfield_closed_01",
			detailsSubmitted: true,
			transfersEnabled: true,
			payoutsEnabled: true,
			syncedAt: daysAgo(21),
			createdAt: daysAgo(67),
		},
	});
	await prisma.case.update({
		where: { id: c.closed.id },
		data: { payoutAccountId: closedAccount.id },
	});

	// The pending_payout case: onboarding started but transfers are NOT enabled,
	// and the case is deliberately left unbound. This is the state itself.
	await prisma.payoutAccount.create({
		data: {
			caseId: c.pendingPayout.id,
			userId: u.david,
			stripeAccountId: "acct_demo_whitfield_pending_01",
			detailsSubmitted: true,
			transfersEnabled: false,
			payoutsEnabled: false,
			syncedAt: daysAgo(2),
			createdAt: daysAgo(2),
		},
	});

	// Live case reached its attorney through the expressed-interest path, so the
	// request it came from is recorded alongside the match.
	const acceptedRequest = await prisma.attorneyRequest.create({
		data: {
			caseId: c.live.id,
			attorneyId: u.priya,
			status: "accepted",
			createdAt: daysAgo(35),
			viewedAt: daysAgo(34),
		},
	});
	await prisma.match.create({
		data: {
			caseId: c.live.id,
			attorneyId: u.priya,
			origin: "expressed_interest",
			requestId: acceptedRequest.id,
			createdAt: daysAgo(33),
		},
	});

	// The seeking case's inbox: one unread, one already seen. No match, which is
	// what keeps it in the attorney queue.
	await prisma.attorneyRequest.create({
		data: {
			caseId: c.seeking.id,
			attorneyId: u.david,
			status: "pending",
			createdAt: daysAgo(6),
		},
	});
	await prisma.attorneyRequest.create({
		data: {
			caseId: c.seeking.id,
			attorneyId: u.karen,
			status: "viewed",
			createdAt: daysAgo(8),
			viewedAt: daysAgo(7),
		},
	});

	// The plaintiff brought their own attorney to these two.
	await prisma.match.create({
		data: {
			caseId: c.pendingPayout.id,
			attorneyId: u.david,
			origin: "bring_your_own",
			createdAt: daysAgo(8),
		},
	});
	await prisma.match.create({
		data: {
			caseId: c.closed.id,
			attorneyId: u.david,
			origin: "directory",
			createdAt: daysAgo(67),
		},
	});

	console.log("[seed] 3 payout accounts, 3 matches, 3 attorney requests");
}

// ── Donations ──────────────────────────────────────────────────────────────

type DonationSpec = {
	caseId: string;
	donorId?: string;
	donorEmail: string;
	donorName: string;
	amountCents: number;
	daysAgo: number;
	status: "succeeded" | "pending";
	stripeAccountId: string;
};

async function createDonations(
	u: Record<string, string>,
	c: Awaited<ReturnType<typeof createCases>>,
) {
	const specs: DonationSpec[] = [
		// Live case — a mix of account donors and guests, which is what the
		// supporter list and donorsCount are designed around.
		{
			caseId: c.live.id,
			donorId: u.samuel,
			donorEmail: "donor@justusdemo.com",
			donorName: "Samuel Boateng",
			amountCents: 250_000,
			daysAgo: 28,
			status: "succeeded",
			stripeAccountId: "acct_demo_raman_live_01",
		},
		{
			caseId: c.live.id,
			donorId: u.rebecca,
			donorEmail: "donor2@justusdemo.com",
			donorName: "Rebecca Lindqvist",
			amountCents: 100_000,
			daysAgo: 24,
			status: "succeeded",
			stripeAccountId: "acct_demo_raman_live_01",
		},
		{
			caseId: c.live.id,
			donorEmail: "ben.okonkwo@example.com",
			donorName: "Ben Okonkwo",
			amountCents: 200_000,
			daysAgo: 22,
			status: "succeeded",
			stripeAccountId: "acct_demo_raman_live_01",
		},
		{
			caseId: c.live.id,
			donorEmail: "p.desai@example.com",
			donorName: "Priyanka Desai",
			amountCents: 150_000,
			daysAgo: 20,
			status: "succeeded",
			stripeAccountId: "acct_demo_raman_live_01",
		},
		{
			caseId: c.live.id,
			donorEmail: "tomas.herrera@example.com",
			donorName: "Tomás Herrera",
			amountCents: 50_000,
			daysAgo: 19,
			status: "succeeded",
			stripeAccountId: "acct_demo_raman_live_01",
		},
		{
			caseId: c.live.id,
			donorEmail: "j.whitmore@example.com",
			donorName: "Joan Whitmore",
			amountCents: 25_000,
			daysAgo: 11,
			status: "succeeded",
			stripeAccountId: "acct_demo_raman_live_01",
		},
		{
			caseId: c.live.id,
			donorEmail: "m.silva@example.com",
			donorName: "Marta Silva",
			amountCents: 10_000,
			daysAgo: 8,
			status: "succeeded",
			stripeAccountId: "acct_demo_raman_live_01",
		},
		// A repeat gift from an existing donor: raisedCents moves, donorsCount
		// does not — the distinction the ledger cache exists to get right.
		{
			caseId: c.live.id,
			donorId: u.samuel,
			donorEmail: "donor@justusdemo.com",
			donorName: "Samuel Boateng",
			amountCents: 75_000,
			daysAgo: 5,
			status: "succeeded",
			stripeAccountId: "acct_demo_raman_live_01",
		},
		// An abandoned checkout: contributes nothing to the totals.
		{
			caseId: c.live.id,
			donorEmail: "unfinished@example.com",
			donorName: "Alex Mercer",
			amountCents: 7_500,
			daysAgo: 2,
			status: "pending",
			stripeAccountId: "acct_demo_raman_live_01",
		},
		// Closed case — fully funded to its 350_000 goal.
		{
			caseId: c.closed.id,
			donorId: u.samuel,
			donorEmail: "donor@justusdemo.com",
			donorName: "Samuel Boateng",
			amountCents: 200_000,
			daysAgo: 60,
			status: "succeeded",
			stripeAccountId: "acct_demo_whitfield_closed_01",
		},
		{
			caseId: c.closed.id,
			donorEmail: "tomas.herrera@example.com",
			donorName: "Tomás Herrera",
			amountCents: 150_000,
			daysAgo: 52,
			status: "succeeded",
			stripeAccountId: "acct_demo_whitfield_closed_01",
		},
	];

	const created: { id: string; spec: DonationSpec }[] = [];
	for (const [i, s] of specs.entries()) {
		const fee = feeCents(s.amountCents);
		const at = daysAgo(s.daysAgo);
		const row = await prisma.donation.create({
			data: {
				caseId: s.caseId,
				donorId: s.donorId ?? null,
				donorEmail: s.donorEmail,
				donorName: s.donorName,
				// Spec amount is the gift to the case; charge = gift + fee.
				amountCents: s.amountCents + fee,
				feeCents: fee,
				netCents: s.amountCents,
				status: s.status,
				stripeCheckoutSessionId: `cs_demo_${i}_${token().slice(0, 16)}`,
				stripePaymentIntentId:
					s.status === "succeeded"
						? `pi_demo_${i}_${token().slice(0, 16)}`
						: null,
				stripeAccountId: s.status === "succeeded" ? s.stripeAccountId : null,
				createdAt: at,
				succeededAt: s.status === "succeeded" ? at : null,
			},
		});
		created.push({ id: row.id, spec: s });

		// Acknowledgement per succeeded gift — one row per donation, as the unique
		// constraint on donationId requires.
		if (s.status === "succeeded") {
			await prisma.donationAcknowledgement.create({
				data: {
					donationId: row.id,
					recipientEmail: s.donorEmail,
					status: "sent",
					createdAt: at,
					sentAt: at,
				},
			});
		}
	}

	// Refresh each case's cached totals from the rows just written, rather than
	// hardcoding them — donorsCount counts distinct donors (account id, or email
	// for guests), never donations.
	for (const c2 of [c.live, c.closed]) {
		const succeeded = created.filter(
			(d) => d.spec.caseId === c2.id && d.spec.status === "succeeded",
		);
		const raisedCents = succeeded.reduce(
			(sum, d) => sum + d.spec.amountCents,
			0,
		);
		const donors = new Set(
			succeeded.map((d) => d.spec.donorId ?? `guest:${d.spec.donorEmail}`),
		);
		await prisma.case.update({
			where: { id: c2.id },
			data: { raisedCents, donorsCount: donors.size },
		});
		console.log(
			`[seed]   ${c2.status} case: ${(raisedCents / 100).toFixed(2)} raised from ${donors.size} donors`,
		);
	}

	console.log(`[seed] ${specs.length} donations`);
	return created;
}

// ── Updates, follows, saves ────────────────────────────────────────────────

async function createEngagement(
	u: Record<string, string>,
	c: Awaited<ReturnType<typeof createCases>>,
) {
	await prisma.caseUpdate.createMany({
		data: [
			{
				caseId: c.live.id,
				authorId: u.priya,
				body: "Complaint filed this morning with the California Civil Rights Department. Marcus's retaliation claim is now formally on the record, and the employer has 30 days to respond.",
				tag: "filing",
				createdAt: daysAgo(26),
			},
			{
				caseId: c.live.id,
				authorId: u.priya,
				body: "The employer has responded and denies the sequence of events. We expected that. Their own written warning is dated eleven days after Marcus's HR email, and that document is not in dispute.",
				createdAt: daysAgo(17),
			},
			{
				caseId: c.live.id,
				authorId: u.marcus,
				body: "Four of my former colleagues have agreed to give statements. I did not expect that and I am grateful to every one of them.",
				tag: "milestone",
				createdAt: daysAgo(12),
			},
			{
				caseId: c.live.id,
				authorId: u.priya,
				body: "Mediation is scheduled for the 14th of next month. Nothing is settled and I am not predicting an outcome, but the fact they agreed to mediate this early is worth knowing.",
				tag: "court_date",
				createdAt: daysAgo(4),
			},
			{
				caseId: c.closed.id,
				authorId: u.david,
				body: "Settled. The contract is rescinded and the overcharged interest is being returned in full. Denise's case is closed.",
				tag: "settlement",
				createdAt: daysAgo(22),
			},
		],
	});

	await prisma.caseFollow.createMany({
		data: [
			{
				userId: u.samuel,
				caseId: c.live.id,
				createdAt: daysAgo(28),
				updatesSeenAt: daysAgo(6),
			},
			{
				userId: u.rebecca,
				caseId: c.live.id,
				createdAt: daysAgo(24),
				updatesSeenAt: daysAgo(13),
			},
			{ userId: u.rebecca, caseId: c.seeking.id, createdAt: daysAgo(5) },
		],
	});

	await prisma.savedCase.createMany({
		data: [
			{ userId: u.samuel, caseId: c.seeking.id, createdAt: daysAgo(4) },
			{ userId: u.rebecca, caseId: c.closed.id, createdAt: daysAgo(40) },
		],
	});

	console.log("[seed] 5 case updates, 3 follows, 2 saves");
}

// ── Messaging ──────────────────────────────────────────────────────────────

async function createMessaging(
	u: Record<string, string>,
	c: Awaited<ReturnType<typeof createCases>>,
) {
	const thread = await prisma.conversation.create({
		data: {
			plaintiffId: u.marcus,
			attorneyId: u.priya,
			caseId: c.live.id,
			createdAt: daysAgo(34),
		},
	});

	const messages = [
		{
			authorId: u.priya,
			body: "Marcus — I've read your case and I'd like to represent you. Before we go further: do you still have the original HR email with its timestamp?",
			daysAgo: 34,
			read: true,
		},
		{
			authorId: u.marcus,
			body: "Yes, I forwarded it to my personal address the same day I sent it. I have the write-ups too.",
			daysAgo: 34,
			read: true,
		},
		{
			authorId: u.priya,
			body: "That timestamp is the case. Eleven days between a written wage complaint and a first-ever warning is the pattern the statute was written for. I'll send an engagement letter today.",
			daysAgo: 33,
			read: true,
		},
		{
			authorId: u.marcus,
			body: "Signed and sent back. Thank you for taking this on.",
			daysAgo: 33,
			read: true,
		},
		{
			authorId: u.priya,
			body: "Mediation is confirmed for the 14th. I'll call you the day before to walk through what to expect — you won't be asked to speak first.",
			daysAgo: 4,
			read: false,
		},
	];

	for (const m of messages) {
		const at = daysAgo(m.daysAgo);
		await prisma.message.create({
			data: {
				conversationId: thread.id,
				authorId: m.authorId,
				body: m.body,
				createdAt: at,
				// Only an incoming message carries a read marker, so this is stamped
				// from the recipient's perspective, never the author's.
				readAt: m.read ? at : null,
			},
		});
	}

	console.log("[seed] 1 conversation, 5 messages (1 unread for the plaintiff)");
}

// ── Notifications ──────────────────────────────────────────────────────────

async function createNotifications(
	u: Record<string, string>,
	c: Awaited<ReturnType<typeof createCases>>,
) {
	await prisma.notification.createMany({
		data: [
			{
				recipientId: u.marcus,
				type: "donation",
				caseId: c.live.id,
				actorName: "Samuel Boateng",
				title: "Samuel Boateng backed your case",
				body: "A $750.00 donation to “Fired for reporting unpaid overtime”.",
				href: `/my-cases/${c.live.id}`,
				dedupeKey: `demo:donation:${c.live.id}:samuel:2`,
				createdAt: daysAgo(5),
			},
			{
				recipientId: u.marcus,
				type: "case_update",
				caseId: c.live.id,
				actorName: "Priya Raman",
				title: "Priya Raman posted an update",
				body: "Mediation is scheduled for the 14th of next month.",
				href: `/my-cases/${c.live.id}/updates`,
				dedupeKey: `demo:update:${c.live.id}:mediation`,
				createdAt: daysAgo(4),
			},
			{
				recipientId: u.samuel,
				type: "case_update",
				caseId: c.live.id,
				actorName: "Priya Raman",
				title: "New update on a case you back",
				body: "Mediation is scheduled for the 14th of next month.",
				href: `/discover/${c.live.id}/updates`,
				dedupeKey: `demo:update:${c.live.id}:samuel`,
				createdAt: daysAgo(4),
				readAt: daysAgo(3),
			},
			{
				recipientId: u.rebecca,
				type: "case_update",
				caseId: c.live.id,
				actorName: "Priya Raman",
				title: "New update on a case you back",
				body: "Mediation is scheduled for the 14th of next month.",
				href: `/discover/${c.live.id}/updates`,
				dedupeKey: `demo:update:${c.live.id}:rebecca`,
				createdAt: daysAgo(4),
			},
			{
				recipientId: u.denise,
				type: "expression_of_interest",
				caseId: c.seeking.id,
				actorName: "David Whitfield",
				title: "An attorney is interested in your case",
				body: "David Whitfield of Whitfield Tenant Advocacy wants to represent “Evicted three weeks after asking for repairs”.",
				href: `/my-cases/${c.seeking.id}/requests`,
				dedupeKey: `demo:interest:${c.seeking.id}:david`,
				createdAt: daysAgo(6),
			},
			{
				recipientId: u.denise,
				type: "case_status",
				caseId: c.pendingPayout.id,
				title: "Your case is waiting on your firm's payout account",
				body: "“Two years of stolen overtime at a staffing agency” goes public as soon as Stripe finishes verifying the firm's account.",
				href: `/my-cases/${c.pendingPayout.id}`,
				dedupeKey: `demo:status:${c.pendingPayout.id}:pending`,
				createdAt: daysAgo(2),
			},
		],
	});
	console.log("[seed] 6 notifications");
}

// ── Certificates ───────────────────────────────────────────────────────────

async function createCertificates(
	u: Record<string, string>,
	c: Awaited<ReturnType<typeof createCases>>,
) {
	const backers = [
		{
			donorId: u.samuel,
			donorEmail: "donor@justusdemo.com",
			recipientName: "Samuel Boateng",
			amountCents: 200_000,
		},
		{
			donorId: null,
			donorEmail: "tomas.herrera@example.com",
			recipientName: "Tomás Herrera",
			amountCents: 150_000,
		},
	];

	const tokens: string[] = [];
	for (const b of backers) {
		const accessToken = token();
		tokens.push(accessToken);
		await prisma.certificate.create({
			data: {
				caseId: c.closed.id,
				donorId: b.donorId,
				donorEmail: b.donorEmail,
				recipientName: b.recipientName,
				caseTitle: c.closed.title,
				amountCents: b.amountCents,
				serial: serial(),
				accessToken,
				dedupeKey: `${c.closed.id}:${b.donorId ?? b.donorEmail}`,
				issuedAt: daysAgo(21),
				createdAt: daysAgo(21),
				emailedAt: daysAgo(21),
			},
		});
	}
	console.log("[seed] 2 certificates for the closed case");
	return tokens;
}

// ── Moderation + flags ─────────────────────────────────────────────────────

async function createModeration(
	u: Record<string, string>,
	c: Awaited<ReturnType<typeof createCases>>,
) {
	// A public report, which does NOT hold content on its own — the live case
	// stays visible while the administrator has a real item to rule on.
	await prisma.moderationFlag.create({
		data: {
			targetType: "case",
			targetId: c.live.id,
			caseId: c.live.id,
			source: "report",
			aiGenerated: false,
			category: "report",
			detail:
				"Reporter states the employer is named unfairly and disputes the account of the termination.",
			reporterId: null,
			status: "open",
			createdAt: daysAgo(3),
		},
	});

	// An AI screening flag already ruled on, so the queue shows both states.
	await prisma.moderationFlag.create({
		data: {
			targetType: "case",
			targetId: c.closed.id,
			caseId: c.closed.id,
			source: "ai",
			aiGenerated: true,
			category: "sensitive",
			detail:
				"Mentions a named dealership and a specific financing figure. Low defamation risk — the claim is documented in the attached contract.",
			confidence: 31,
			status: "resolved",
			resolution: "cleared",
			resolutionNote:
				"Contract supports the figures quoted. No change required; campaign remains public.",
			resolvedById: u.admin,
			resolvedAt: daysAgo(64),
			createdAt: daysAgo(65),
		},
	});

	await prisma.featureFlag.upsert({
		where: { key: "aiAssistant" },
		create: { key: "aiAssistant", enabled: true, updatedBy: u.admin },
		update: { enabled: true, updatedBy: u.admin },
	});
	await prisma.featureFlag.upsert({
		where: { key: "investorTrack" },
		create: { key: "investorTrack", enabled: false, updatedBy: u.admin },
		update: { enabled: false, updatedBy: u.admin },
	});

	console.log("[seed] 2 moderation flags (1 open, 1 resolved), 2 feature flags");
}

// ── Run ────────────────────────────────────────────────────────────────────

try {
	await cleanup();
	const u = await createUsers();
	await createAttorneyProfiles(u);
	const c = await createCases(u);
	await createRepresentation(u, c);
	await createDonations(u, c);
	await createEngagement(u, c);
	await createMessaging(u, c);
	await createNotifications(u, c);
	const certTokens = await createCertificates(u, c);
	await createModeration(u, c);

	console.log("\n[seed] done.");
	console.log(`[seed] live case:        /discover/${c.live.id}`);
	console.log(`[seed] closed case:      /discover/${c.closed.id}`);
	console.log(`[seed] certificate:      /certificates/${certTokens[0]}`);
} finally {
	await prisma.$disconnect();
}
