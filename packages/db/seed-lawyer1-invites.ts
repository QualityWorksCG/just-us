/**
 * Seed directed intake invitations for jmorris+lawyer1@qualityworkscg.com — the
 * "New" tab (Intake requests → New), where a plaintiff has named this attorney
 * specifically. One federal case carries real evidence files so the evidence
 * viewing gate can be exercised as the invited attorney.
 *
 *   bun seed-lawyer1-invites.ts            # add or update
 *   bun seed-lawyer1-invites.ts --remove   # take them out
 *
 * A named case is held OUT of the open queue while the invitation is pending, so
 * these appear only under "New", not "Browse open". All fictional; plaintiff
 * owners are login-less `.invalid` rows. Idempotent.
 *
 * The evidence URLs are real Vercel Blob objects already in this environment, so
 * the invited attorney can actually open them (tests the RFC-6266 header fix and
 * the reviewing-attorney authorization).
 */
import { randomBytes } from "node:crypto";

import prisma from "./src/index";

const LAWYER1_EMAIL = "jmorris+lawyer1@qualityworkscg.com";

// lawyer1's snapshot, recorded on each case as the named attorney.
const ATTORNEY = {
	name: "Gerald Ainsworth",
	firm: "Ainsworth Federal Litigation",
	area: "Civil rights",
	location: "New York",
};

// Real, fetchable evidence already stored in this environment.
const EVIDENCE = [
	{
		url: "https://yblqvqxgxhdxxnvd.public.blob.vercel-storage.com/Screenshot%202026-08-27%20at%207.17.36%E2%80%AFPM-9UYPZX6kWS7JMrRfRFGYDmwQ54bUZR.png",
		name: "Screenshot 2026-08-27 at 7.17.36 PM.png",
		size: 3318469,
		kind: "file",
	},
	{
		url: "https://yblqvqxgxhdxxnvd.public.blob.vercel-storage.com/Screenshot%202026-08-28%20at%204.13.03%E2%80%AFPM-ItIxOCJ5oU99NyckZJNRGr8U6t088I.png",
		name: "Screenshot 2026-08-28 at 4.13.03 PM.png",
		size: 61540,
		kind: "file",
	},
];

type Seed = {
	owner: string;
	title: string;
	category: string;
	state: string;
	jurisdiction: "state" | "federal";
	summary: string;
	story: string;
	withEvidence?: boolean;
	publishedDaysAgo: number;
};

const SEEDS: Seed[] = [
	{
		owner: "Gregory Hahn",
		title: "Federal whistleblower retaliation — direct request",
		category: "Employment",
		state: "New York",
		jurisdiction: "federal",
		summary:
			"Named you to represent a federal whistleblower-retaliation claim after reporting contract fraud.",
		story:
			"I reported over-billing on a federal contract through the internal hotline in February. In March I was removed from the program and placed on 'administrative review'. I have the hotline confirmation, the reassignment memo, and emails praising my work up to the week I reported.",
		withEvidence: true,
		publishedDaysAgo: 1,
	},
	{
		owner: "Lucille Barnes",
		title: "Wage theft at a Bronx care facility — direct request",
		category: "Wage & hours",
		state: "New York",
		jurisdiction: "state",
		summary:
			"Named you directly to pursue unpaid overtime for a crew of home-care aides.",
		story:
			"Eleven of us were paid straight time for hours well past forty, and travel time between clients was never paid at all. We kept our own schedules against the agency's dispatch records, which don't match the checks.",
		publishedDaysAgo: 2,
	},
];

const ownerId = (s: Seed) =>
	`seed-l1inv-plaintiff-${s.owner.toLowerCase().replace(/[^a-z]+/g, "-")}`;
const email = (s: Seed) =>
	`${s.owner.toLowerCase().replace(/[^a-z]+/g, ".")}@example.invalid`;
const caseId = (s: Seed) =>
	`seed-l1inv-case-${s.title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.slice(0, 44)}`;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

if (process.argv.includes("--remove")) {
	// Invitations cascade from the case.
	const { count } = await prisma.case.deleteMany({
		where: { id: { in: SEEDS.map(caseId) } },
	});
	await prisma.user.deleteMany({ where: { id: { in: SEEDS.map(ownerId) } } });
	console.log(`removed ${count} directed-invitation cases`);
	process.exit(0);
}

for (const seed of SEEDS) {
	const owner = ownerId(seed);
	await prisma.user.upsert({
		where: { id: owner },
		create: {
			id: owner,
			name: seed.owner,
			email: email(seed),
			emailVerified: true,
			onboarded: true,
			role: "plaintiff",
		},
		update: {},
	});

	const published = daysAgo(seed.publishedDaysAgo);
	const cid = caseId(seed);
	const caseData = {
		title: seed.title,
		category: seed.category,
		location: seed.state,
		jurisdiction: seed.jurisdiction,
		summary: seed.summary,
		story: seed.story,
		goalCents: 0,
		status: "seeking" as const,
		moderationStatus: "ok" as const,
		publishedAt: published,
		createdAt: published,
		deletedAt: null,
		// The named attorney, recorded on the case as `setCaseInvitedAttorney` does.
		attorneyName: ATTORNEY.name,
		attorneyFirm: ATTORNEY.firm,
		attorneyArea: ATTORNEY.area,
		attorneyLocation: ATTORNEY.location,
		attorneyEmail: LAWYER1_EMAIL,
		evidence: seed.withEvidence ? EVIDENCE : [],
	};
	await prisma.case.upsert({
		where: { id: cid },
		create: { id: cid, ownerId: owner, ...caseData },
		update: caseData,
	});

	// A pending invitation to lawyer1. Replaced wholesale so re-running keeps one
	// live invite rather than stacking expired rows.
	await prisma.caseInvitation.deleteMany({ where: { caseId: cid } });
	await prisma.caseInvitation.create({
		data: {
			caseId: cid,
			email: LAWYER1_EMAIL,
			tokenHash: randomBytes(32).toString("hex"),
			expiresAt: daysAgo(-7), // 7 days out
			createdAt: published,
		},
	});

	console.log(
		`${seed.jurisdiction.padEnd(7)} ${seed.withEvidence ? "＋evidence" : "         "} “${seed.title}”`,
	);
}

console.log(
	`\nseeded ${SEEDS.length} directed invitations for ${LAWYER1_EMAIL} (New tab)`,
);
