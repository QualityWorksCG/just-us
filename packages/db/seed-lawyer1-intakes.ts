/**
 * Seed intake requests (seeking cases) that reach the attorney
 * jmorris+lawyer1@qualityworkscg.com — a mix of federal and state matters so the
 * attorney queue, filters, and jurisdiction badges can be exercised as that user.
 *
 *   bun seed-lawyer1-intakes.ts            # add or update
 *   bun seed-lawyer1-intakes.ts --remove   # take them (and the added admission) out
 *
 * lawyer1 is seeded federally-verified with NO state admissions, so state cases
 * would never reach their queue. To make "both federal and state" visible here we
 * also give lawyer1 a *verified* New York admission (their seeded office state) and
 * mark the profile verified, so state intakes in NY appear and Express interest is
 * offered. NOTE: this turns lawyer1 into a state+federal attorney — if you rely on
 * lawyer1 being federal-only for the exclusion QA checks, run --remove afterwards.
 *
 * All fictional. Plaintiff owners are login-less rows with `.invalid` emails. Each
 * case is `seeking` (published to attorneys, no attorney/fee yet). Idempotent.
 */
import prisma from "./src/index";

const LAWYER1_EMAIL = "jmorris+lawyer1@qualityworkscg.com";
const ADMISSION_STATE = "New York";

type Seed = {
	owner: string;
	title: string;
	category: string;
	/** Plaintiff's US state — for state cases this is what gates visibility. */
	state: string;
	jurisdiction: "state" | "federal";
	summary: string;
	story: string;
	publishedDaysAgo: number;
};

// Every case sits in New York so lawyer1's NY admission also satisfies the queue
// list's per-state Express-interest gate; federal cases still carry
// jurisdiction:"federal" and reach the queue on the federal branch, not the state.
const SEEDS: Seed[] = [
	// ── Federal ──────────────────────────────────────────────────────────────
	{
		owner: "Renata Alvarez",
		title: "Civil-rights claim after wrongful detention",
		category: "Civil rights",
		state: "New York",
		jurisdiction: "federal",
		summary:
			"Held for eleven hours without charge or a phone call; seeking a §1983 claim against the arresting agency.",
		story:
			"I was stopped leaving work, held for eleven hours in a federal facility, and released with no charge and no explanation. I was never allowed a phone call. I have the release paperwork, the timestamps from the building's own log, and two coworkers who saw the stop.",
		publishedDaysAgo: 1,
	},
	{
		owner: "Marcus Boone",
		title: "Title VII retaliation after a federal complaint",
		category: "Employment",
		state: "New York",
		jurisdiction: "federal",
		summary:
			"Demoted two weeks after filing an EEOC charge over discriminatory promotion practices.",
		story:
			"I filed an EEOC charge in April after being passed over three times for a promotion that went to less-tenured colleagues. Two weeks after the charge was served, I was moved to a night shift with a pay cut. I have the charge, the receipt of service, and my prior performance reviews.",
		publishedDaysAgo: 3,
	},
	{
		owner: "Priscilla Nkemdirim",
		title: "Federal consumer-protection class claim over hidden fees",
		category: "Consumer fraud",
		state: "New York",
		jurisdiction: "federal",
		summary:
			"National lender added undisclosed servicing fees across thousands of accounts; seeking a federal class action.",
		story:
			"My loan statements began carrying a monthly servicing fee that was never in the agreement. When I asked, three different reps gave three different answers. I have twelve statements, the original agreement showing no such fee, and a forum thread of hundreds reporting the same charge.",
		publishedDaysAgo: 6,
	},
	// ── State (New York) ─────────────────────────────────────────────────────
	{
		owner: "Dana Whitfield",
		title: "Unpaid overtime at a Brooklyn distribution center",
		category: "Wage & hours",
		state: "New York",
		jurisdiction: "state",
		summary:
			"Off-the-clock prep and closing time, unpaid across a full year of shifts.",
		story:
			"For a year I was told to clock out and then finish the closing count, routinely forty to sixty minutes a night. It was the same for the whole crew. I kept my own log against the door-badge times, which don't match the pay stubs.",
		publishedDaysAgo: 2,
	},
	{
		owner: "Tomas Ferreira",
		title: "Illegal lock-out from a Queens apartment",
		category: "Housing",
		state: "New York",
		jurisdiction: "state",
		summary:
			"Landlord changed the locks without a court order while rent was current.",
		story:
			"I came home to a new lock and my things in the hallway. Rent was paid through the month — I have the receipts. There was no court order and no notice. A neighbor recorded the super changing the lock.",
		publishedDaysAgo: 4,
	},
	{
		owner: "Aisha Rahman",
		title: "Discriminatory termination in Manhattan",
		category: "Employment",
		state: "New York",
		jurisdiction: "state",
		summary:
			"Fired within a week of disclosing a pregnancy, after two years of strong reviews.",
		story:
			"I told my manager I was pregnant on a Monday and was let go that Friday, told it was 'a restructuring.' My role was reposted the next week. I have two years of positive reviews, the termination letter, and the job posting.",
		publishedDaysAgo: 8,
	},
];

const ownerId = (s: Seed) =>
	`seed-l1-plaintiff-${s.owner.toLowerCase().replace(/[^a-z]+/g, "-")}`;
const email = (s: Seed) =>
	`${s.owner.toLowerCase().replace(/[^a-z]+/g, ".")}@example.invalid`;
const caseId = (s: Seed) =>
	`seed-l1-case-${s.title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.slice(0, 48)}`;

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

const lawyer1 = await prisma.user.findUnique({
	where: { email: LAWYER1_EMAIL },
	select: { id: true },
});
if (!lawyer1) {
	throw new Error(
		`${LAWYER1_EMAIL} not found — run seed-federal-attorneys.ts first.`,
	);
}

if (process.argv.includes("--remove")) {
	const { count } = await prisma.case.deleteMany({
		where: { id: { in: SEEDS.map(caseId) } },
	});
	await prisma.user.deleteMany({
		where: { id: { in: SEEDS.map(ownerId) } },
	});
	// Remove the NY admission we added (leave the profile status as-is).
	await prisma.attorneyAdmission.deleteMany({
		where: { userId: lawyer1.id, state: ADMISSION_STATE },
	});
	console.log(`removed ${count} intakes + the added NY admission`);
	process.exit(0);
}

// 1) Make NY state cases reachable + actionable for lawyer1.
const existingAdmission = await prisma.attorneyAdmission.findFirst({
	where: { userId: lawyer1.id, state: ADMISSION_STATE },
	select: { id: true },
});
if (existingAdmission) {
	await prisma.attorneyAdmission.update({
		where: { id: existingAdmission.id },
		data: { verificationStatus: "verified", verifiedAt: new Date() },
	});
} else {
	await prisma.attorneyAdmission.create({
		data: {
			userId: lawyer1.id,
			state: ADMISSION_STATE,
			verificationStatus: "verified",
			verifiedAt: new Date(),
		},
	});
}
// Express interest is gated on the profile-wide badge too — mark it verified.
await prisma.attorneyProfile.update({
	where: { userId: lawyer1.id },
	data: { verificationStatus: "verified", verifiedAt: new Date() },
});
console.log(
	`lawyer1: verified ${ADMISSION_STATE} admission + profile verified`,
);

// 2) The intakes.
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
	};
	await prisma.case.upsert({
		where: { id: caseId(seed) },
		create: { id: caseId(seed), ownerId: owner, ...caseData },
		update: caseData,
	});

	console.log(
		`${seed.jurisdiction.padEnd(7)} ${seed.category.padEnd(14)} ${seed.owner.padEnd(20)} “${seed.title}”`,
	);
}

console.log(
	`\nseeded ${SEEDS.length} intakes (${SEEDS.filter((s) => s.jurisdiction === "federal").length} federal, ${SEEDS.filter((s) => s.jurisdiction === "state").length} state) for ${LAWYER1_EMAIL}`,
);
