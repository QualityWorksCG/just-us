/**
 * Seed the Seeking Representation queue with sample cases, so the attorney-side
 * queue and the plaintiff-side interest inbox can be developed and reviewed
 * against something realistic (JUS-25).
 *
 *   bun seed-seeking.ts            # add or update the sample cases
 *   bun seed-seeking.ts --remove   # take them back out
 *
 * All fictional. Each gets a plaintiff User row (no credentials, so none of them
 * can sign in) owning one `seeking` case — the state a case is in after the "no
 * attorney yet" publish path.
 *
 * The data is deliberately varied rather than uniform: several categories and
 * states so the queue's filters visibly do something, published dates spread over
 * weeks so "Longest waiting" reorders, and one case whose summary is a single
 * short line — the edge case that shows whether a card holds its shape when
 * there's barely anything to render.
 *
 * The stories are longer than the summaries on purpose. An attorney browsing the
 * queue must not be able to see them (see `queueSelect`), so seeding a case with
 * a story worth hiding is what makes that testable rather than merely asserted.
 *
 * Idempotent: re-running updates in place rather than duplicating. Contact
 * addresses use the reserved `.invalid` TLD, which can never resolve or receive
 * mail, so a stray send can't reach a real person.
 */
import prisma from "./src/index";

type Seed = {
	/** Plaintiff's display name. */
	owner: string;
	title: string;
	category: string;
	/** US state, matched against the attorney's licensing jurisdiction. */
	state: string;
	/** The one-line public summary — all an attorney sees of the case body. */
	summary: string;
	/** The private long-form account. Never shown in the queue. */
	story: string;
	/** How many days ago it was published out to attorneys. */
	publishedDaysAgo: number;
};

const SEEDS: Seed[] = [
	{
		owner: "Dana Whitfield",
		title: "Fired the week after reporting unpaid overtime",
		category: "Employment",
		state: "Georgia",
		summary:
			"Terminated six days after raising unpaid overtime with HR, following two years of clean reviews.",
		story:
			"I worked as a shift supervisor for two years with no write-ups and two positive reviews. In March I raised with HR that the closing shift was routinely running ninety minutes past clock-out and that none of it appeared on our pay stubs. I put it in writing and named four other staff it affected. Six days later I was called in and told the role was being eliminated. The same role was posted publicly eleven days after that. I have the HR email, both reviews, and the job posting.",
		publishedDaysAgo: 2,
	},
	{
		owner: "Marisol Reyes",
		title: "Landlord withheld deposit and ignored repeated repair notices",
		category: "Housing",
		state: "California",
		summary:
			"Nine months of unaddressed heating and mould complaints, then the full deposit withheld at move-out.",
		story:
			"The heating failed in the second month of the tenancy and the bathroom developed mould that spread to the bedroom wall. I sent written notice five times over nine months and photographed the wall each month. Two contractors visited and both told me they had not been authorised to do the work. At move-out the full deposit was withheld against 'cleaning and damage', itemised as the same mould I had been reporting. I have every notice, the photographs with dates, and the contractors' names.",
		publishedDaysAgo: 6,
	},
	{
		owner: "Arthur Boone",
		title: "Care home billed for services my mother never received",
		category: "Elder care",
		state: "Florida",
		summary:
			"Fourteen months of invoices for physiotherapy and supervised meals that visit logs show never happened.",
		story:
			"My mother was a resident for fourteen months. The invoices bill weekly physiotherapy and twice-daily supervised meals throughout. When I requested the care logs after she was hospitalised for dehydration, the logs recorded physiotherapy on nine occasions total and no supervised meals at all after the third month. The hospital's admission notes describe her as significantly underweight. I have every invoice, the logs the home provided in response to my written request, and the hospital notes.",
		publishedDaysAgo: 13,
	},
	{
		owner: "Priya Anand",
		title: "Dealership added a warranty I declined in writing",
		category: "Consumer fraud",
		state: "Texas",
		summary:
			"A $3,400 service contract I declined in writing appeared in the financed total at signing.",
		story:
			"I declined the extended service contract twice, once verbally and once by initialling the decline box on the worksheet, which I photographed before signing. The financing paperwork I signed forty minutes later included the contract at $3,400 rolled into the amount financed, changing the monthly payment. When I called the following week I was told the contract was non-refundable after seven days and that the worksheet was 'not part of the contract'. I have the photographed worksheet, the signed financing agreement, and a recording of that call, which is one-party consent in this state.",
		publishedDaysAgo: 21,
	},
	{
		owner: "Devon Mackay",
		title: "Denied a disability accommodation, then written up for it",
		category: "Civil rights",
		state: "New York",
		summary: "Accommodation request denied without discussion.",
		story:
			"I requested a seated workstation with supporting documentation from my consultant. The request was denied in a two-line email that gave no reason and offered no alternative. I continued standing because I was told I would be sent home otherwise, and was written up twice over the following month for time away from the station, both times for breaks I took to manage the pain. I have the consultant's letter, my request, the denial, and both write-ups.",
		publishedDaysAgo: 34,
	},
	{
		owner: "Helen Osei",
		title: "Surgical instrument left in place, found four months later",
		category: "Medical malpractice",
		state: "Illinois",
		summary:
			"A retained surgical item found on imaging four months post-operation, after repeated dismissed complaints.",
		story:
			"I reported abdominal pain at the two-week, six-week, and three-month follow-ups and was told each time that recovery varies. At four months I went to a different hospital, where imaging identified a retained surgical item from the original procedure. A second operation was required to remove it. I have the operative notes from both procedures, the imaging, and the follow-up records where the pain was recorded and dismissed.",
		publishedDaysAgo: 48,
	},
];

/** Deterministic ids so re-running updates the same rows rather than stacking. */
const ownerId = (seed: Seed) =>
	`seed-plaintiff-${seed.owner.toLowerCase().replace(/[^a-z]+/g, "-")}`;
const caseId = (seed: Seed) =>
	`seed-seeking-${seed.owner.toLowerCase().replace(/[^a-z]+/g, "-")}`;
const email = (seed: Seed) =>
	`${seed.owner.toLowerCase().replace(/[^a-z]+/g, ".")}@example.invalid`;

const daysAgo = (days: number) =>
	new Date(Date.now() - days * 24 * 60 * 60 * 1000);

if (process.argv.includes("--remove")) {
	// Cases — and any expressions of interest on them — cascade from the user.
	const { count } = await prisma.user.deleteMany({
		where: { id: { in: SEEDS.map(ownerId) } },
	});
	console.log(`removed ${count} sample plaintiffs and their cases`);
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
			jurisdiction: seed.state,
		},
		update: { jurisdiction: seed.state },
	});

	const published = daysAgo(seed.publishedDaysAgo);
	const caseData = {
		title: seed.title,
		category: seed.category,
		location: seed.state,
		summary: seed.summary,
		story: seed.story,
		// A seeking case has no attorney and no fee yet — the fee is agreed once the
		// plaintiff chooses someone, which is what sets the funding goal (JUS-26).
		goalCents: 0,
		status: "seeking" as const,
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
		`${seed.owner.padEnd(16)} ${seed.category.padEnd(19)} ${seed.state.padEnd(11)} ` +
			`published ${String(seed.publishedDaysAgo).padStart(2)}d ago`,
	);
}

console.log(`\nseeded ${SEEDS.length} cases seeking representation`);
