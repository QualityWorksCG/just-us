/**
 * Seed five *federal* attorneys with working logins, for testing the federal
 * jurisdiction flow end to end (JUS-100).
 *
 *   # 1. hash the shared password (run in packages/auth, where better-auth resolves)
 *   cd packages/auth && DEMO_PASSWORD='...' bun gen-federal-hashes.ts /tmp/fed-hashes.json
 *   # 2. seed (run in packages/db)
 *   cd packages/db && bun seed-federal-attorneys.ts /tmp/fed-hashes.json
 *   bun seed-federal-attorneys.ts /tmp/fed-hashes.json --remove   # take them back out
 *
 * Each attorney gets:
 *   - a User row (role=attorney) with an email/password credential, so they can
 *     actually sign in — unlike `seed-attorneys.ts`, whose rows are login-less;
 *   - a *federally* verified AttorneyProfile: `practicesFederal` declared and
 *     `federalVerificationStatus = verified`, which is exactly what lets them see
 *     and take federal cases and carries the "Federal court" tag. Deliberately no
 *     state admissions and `verificationStatus = unverified` — these are federal
 *     practitioners, and the directory lists them on the federal standing alone.
 *
 * All fictional. Names, firms and bar numbers are invented so nothing here
 * impersonates a real US Attorney or public official. Contact emails are the
 * caller's own +tagged addresses so mail (verification, invites) lands in one
 * inbox. Idempotent: re-running updates in place rather than duplicating.
 */
import { randomUUID } from "node:crypto";

import prisma from "./src/index";

type FederalSeed = {
	/** 1..5 — drives the deterministic id and the `jmorris+lawyerN` email. */
	n: number;
	name: string;
	firm: string;
	state: string;
	city: string;
	barNumber: string;
	admittedYear: number;
	practiceAreas: string[];
	languages: string[];
	feeApproach: "flat" | "hourly" | "contingency" | "quoted_per_case";
	feeMin?: number;
	feeMax?: number;
	phone: string;
	website: string;
	education: string;
	bio: string;
	background: string;
};

const SEEDS: FederalSeed[] = [
	{
		n: 1,
		name: "Gerald Ainsworth",
		firm: "Ainsworth Federal Litigation",
		state: "New York",
		city: "New York",
		barNumber: "Fed. #NY-338114",
		admittedYear: 2006,
		practiceAreas: ["Civil rights", "Employment"],
		languages: ["English"],
		feeApproach: "contingency",
		phone: "(212) 555-0142",
		website: "https://ainsworthfederal.example",
		education: "J.D., Columbia Law School · 2006",
		bio: "Constitutional and civil-rights litigation in the federal district and appellate courts, with a focus on §1983 and due-process claims.",
		background:
			"Clerked for a federal district judge in the Southern District of New York, then eight years with a civil-liberties non-profit before entering private practice.",
	},
	{
		n: 2,
		name: "Patricia Nwosu",
		firm: "Nwosu Federal Advocacy",
		state: "California",
		city: "Los Angeles",
		barNumber: "Fed. #CA-291477",
		admittedYear: 2009,
		practiceAreas: ["Civil rights", "Consumer fraud"],
		languages: ["English", "French"],
		feeApproach: "contingency",
		phone: "(213) 555-0155",
		website: "https://nwosufederal.example",
		education: "J.D., Stanford Law School · 2009",
		bio: "Federal class actions and civil-rights matters, principally against public agencies and national institutions.",
		background:
			"Former assistant US attorney in the civil division, now representing plaintiffs in federal court across the Ninth Circuit.",
	},
	{
		n: 3,
		name: "David Reinhardt",
		firm: "Reinhardt & Cole Federal Practice",
		state: "Illinois",
		city: "Chicago",
		barNumber: "Fed. #IL-6301882",
		admittedYear: 2011,
		practiceAreas: ["Employment", "Wage & hours"],
		languages: ["English"],
		feeApproach: "hourly",
		feeMin: 320,
		feeMax: 480,
		phone: "(312) 555-0190",
		website: "https://reinhardtcole.example",
		education: "J.D., University of Chicago Law School · 2011",
		bio: "Federal employment litigation — Title VII, FLSA collective actions, and whistleblower-retaliation claims.",
		background:
			"Six years defending employers at a national firm before switching sides, which he credits for knowing exactly how these cases get valued.",
	},
	{
		n: 4,
		name: "Sofia Mendez",
		firm: "Mendez Federal Litigation",
		state: "Texas",
		city: "Houston",
		barNumber: "Fed. #TX-24088412",
		admittedYear: 2013,
		practiceAreas: ["Consumer fraud", "Civil rights"],
		languages: ["English", "Spanish"],
		feeApproach: "contingency",
		phone: "(713) 555-0164",
		website: "https://mendezfederal.example",
		education: "J.D., University of Texas School of Law · 2013",
		bio: "Federal consumer-protection and civil-rights litigation, from single plaintiffs to multi-district cases.",
		background:
			"Began at a legal-aid federal-practice clinic, then built a plaintiff-side federal practice across the Fifth Circuit.",
	},
	{
		n: 5,
		name: "Marcus Whitfield",
		firm: "Whitfield Federal Trial Group",
		state: "Virginia",
		city: "Alexandria",
		barNumber: "Fed. #VA-204471",
		admittedYear: 2004,
		practiceAreas: ["Personal injury", "Civil rights"],
		languages: ["English"],
		feeApproach: "contingency",
		phone: "(703) 555-0186",
		website: "https://whitfieldfederal.example",
		education: "J.D., Georgetown University Law Center · 2004",
		bio: "Federal trial lawyer handling constitutional-tort and serious-injury claims against federal agencies and interstate defendants.",
		background:
			"Two decades of federal trial work in the Eastern District of Virginia, with most matters resolving before verdict.",
	},
];

const userId = (n: number) => `seed-federal-lawyer-${n}`;
const email = (n: number) => `jmorris+lawyer${n}@qualityworkscg.com`;

if (process.argv.includes("--remove")) {
	// Profile cascades from the user.
	const { count } = await prisma.user.deleteMany({
		where: { id: { in: SEEDS.map((s) => userId(s.n)) } },
	});
	console.log(`removed ${count} federal attorneys`);
	process.exit(0);
}

const hashesPath = process.argv[2];
if (!hashesPath) {
	throw new Error("usage: bun seed-federal-attorneys.ts <hashes.json>");
}
const passwordHashes: Record<string, string> =
	await Bun.file(hashesPath).json();

const now = new Date();

for (const seed of SEEDS) {
	const id = userId(seed.n);
	const addr = email(seed.n);
	const hash = passwordHashes[addr];
	if (!hash) throw new Error(`no password hash for ${addr}`);

	// User + credential account. Upserted so re-running refreshes the login rather
	// than stacking a second credential row.
	await prisma.user.upsert({
		where: { id },
		update: {
			name: seed.name,
			email: addr,
			role: "attorney",
			jurisdiction: seed.state,
			firmName: seed.firm,
			barNumber: seed.barNumber,
			emailVerified: true,
			onboarded: true,
		},
		create: {
			id,
			name: seed.name,
			email: addr,
			emailVerified: true,
			onboarded: true,
			role: "attorney",
			jurisdiction: seed.state,
			firmName: seed.firm,
			barNumber: seed.barNumber,
		},
	});
	// The credential account, keyed by (providerId, accountId). Replaced wholesale
	// so the password hash is always the current one.
	await prisma.account.deleteMany({
		where: { accountId: id, providerId: "credential" },
	});
	await prisma.account.create({
		data: {
			id: randomUUID(),
			userId: id,
			accountId: id,
			providerId: "credential",
			password: hash,
		},
	});

	const profileData = {
		legalName: seed.name,
		firmName: seed.firm,
		officeCity: seed.city,
		officeState: seed.state,
		contactEmail: addr,
		contactPhone: seed.phone,
		websiteUrl: seed.website,
		practiceAreas: seed.practiceAreas,
		languages: seed.languages,
		acceptingNewCases: true,
		virtualConsultation: true,
		feeApproach: seed.feeApproach,
		feeRangeMinCents: seed.feeMin ? seed.feeMin * 100 : null,
		feeRangeMaxCents: seed.feeMax ? seed.feeMax * 100 : null,
		admittedYear: seed.admittedYear,
		education: seed.education,
		bio: seed.bio,
		background: seed.background,
		// Approved, or the public profile withholds the bio.
		bioStatus: "approved" as const,
		// Federal practitioners: the federal standing is what lists them and lets
		// them act on federal cases. No state admission, so the state badge stays
		// unverified by design.
		verificationStatus: "unverified" as const,
		practicesFederal: true,
		federalVerificationStatus: "verified" as const,
		federalVerifiedAt: now,
	};

	await prisma.attorneyProfile.upsert({
		where: { userId: id },
		create: { userId: id, ...profileData },
		update: profileData,
	});

	console.log(
		`${seed.name.padEnd(20)} ${seed.state.padEnd(12)} federal ✓  ${addr}`,
	);
}

console.log(`\nseeded ${SEEDS.length} federal attorneys with logins`);
