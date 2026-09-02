/**
 * Seed the directory with sample attorneys, so the listing and profile pages can
 * be developed and reviewed against something realistic.
 *
 *   bun seed-attorneys.ts            # add or update the sample attorneys
 *   bun seed-attorneys.ts --remove   # take them back out
 *
 * All fictional. Each gets a User row (role=attorney, no credentials, so none of
 * them can sign in) and a *verified* AttorneyProfile — the directory only lists
 * verified profiles, so a seed that skipped that would render an empty page.
 *
 * The data is deliberately varied rather than uniform: ratings spread from 4.0 to
 * 5.0 so "Highest rated" visibly reorders, every fee approach appears, two are on
 * a waitlist so "Availability" sorts differently, and one has no reviews or case
 * record at all — that last one is the edge case that shows whether the profile
 * hides those sections cleanly instead of rendering empty cards.
 *
 * Idempotent: re-running updates in place rather than duplicating. Contact
 * addresses use the reserved `.invalid` and `.example` TLDs, which can never
 * resolve or receive mail, so a stray send or fetch can't reach a real person.
 */
import prisma from "./src/index";

type Seed = {
	name: string;
	firm: string;
	state: string;
	city: string;
	barNumber: string;
	admittedYear: number;
	practiceAreas: string[];
	languages: string[];
	accepting: boolean;
	virtual: boolean;
	feeApproach: "flat" | "hourly" | "contingency" | "quoted_per_case";
	/** Whole dollars; stored as cents. Omitted for contingency work. */
	feeMin?: number;
	feeMax?: number;
	education: string;
	bio: string;
	background: string;
	phone: string;
	website: string;
	reviews: { rating: number; quote: string; byline: string }[];
	cases: {
		year: number;
		title: string;
		amount: string;
		outcome: "won" | "settled" | "ongoing" | "other";
	}[];
};

const SEEDS: Seed[] = [
	{
		name: "Marcus Bell",
		firm: "Bell & Associates",
		state: "Georgia",
		city: "Atlanta",
		barNumber: "GA #338114",
		admittedYear: 2010,
		practiceAreas: ["Employment"],
		languages: ["English"],
		accepting: true,
		virtual: true,
		feeApproach: "contingency",
		education: "J.D., Emory University School of Law · 2010",
		background:
			"Started at the Georgia Department of Labor before moving to plaintiff-side work in 2014. Adjunct lecturer in employment law at Georgia State.",
		bio: "Sixteen years representing Georgia workers in termination, safety-retaliation, and wage disputes.",
		phone: "(404) 555-0142",
		website: "https://bellassociates.example",
		reviews: [
			{
				rating: 5,
				quote: "Marcus kept every promise and every deadline.",
				byline: "former client, wrongful termination",
			},
			{
				rating: 5,
				quote: "He explained the process without a single billable surprise.",
				byline: "former client, safety retaliation",
			},
			{
				rating: 5,
				quote: "Took my case when two other firms had already passed on it.",
				byline: "former client, unpaid wages",
			},
			{
				rating: 4,
				quote: "Excellent outcome, though it took longer than I expected.",
				byline: "former client, wrongful termination",
			},
		],
		cases: [
			{
				year: 2025,
				title: "Fired after reporting unsafe machinery",
				amount: "$210,000 settlement",
				outcome: "settled",
			},
			{
				year: 2024,
				title: "Unpaid overtime across three warehouse shifts",
				amount: "$96,000 recovered",
				outcome: "won",
			},
		],
	},
	{
		name: "Anita Rowe",
		firm: "Rowe Workplace Law",
		state: "New Jersey",
		city: "Newark",
		barNumber: "NJ #221904",
		admittedYear: 2012,
		practiceAreas: ["Wage & hours", "Employment"],
		languages: ["English", "Spanish"],
		accepting: true,
		virtual: true,
		feeApproach: "contingency",
		education: "J.D., Rutgers Law School · 2012",
		background:
			"Six years with a union-side firm in Trenton, then opened her own practice in 2018. Volunteers with a workers' rights clinic twice a month.",
		bio: "Represents workers in unpaid-wage and overtime disputes across New Jersey — from single plaintiffs to small crews.",
		phone: "(973) 555-0118",
		website: "https://roweworkplace.example",
		reviews: [
			{
				rating: 5,
				quote:
					"Anita explained every step in plain language and got my back pay in four months.",
				byline: "former client, wage claim",
			},
			{
				rating: 5,
				quote: "She organised nineteen of us and never lost track of a detail.",
				byline: "former client, class wage claim",
			},
		],
		cases: [
			{
				year: 2025,
				title: "Off-the-clock prep time at a distribution centre",
				amount: "$148,000, 19 workers",
				outcome: "won",
			},
			{
				year: 2023,
				title: "Misclassified delivery drivers",
				amount: "$74,000 settlement",
				outcome: "settled",
			},
		],
	},
	{
		name: "Miriam Soto",
		firm: "Soto Elder Law",
		state: "Florida",
		city: "Tampa",
		barNumber: "FL #402118",
		admittedYear: 2005,
		practiceAreas: ["Elder care", "Estate & probate"],
		languages: ["English", "Spanish"],
		accepting: true,
		virtual: false,
		feeApproach: "contingency",
		education: "J.D., University of Florida Levin College of Law · 2005",
		background:
			"Former state long-term care ombudsman. Certified elder law attorney since 2013.",
		bio: "Advocates for elderly clients and their families in neglect and financial-abuse cases across Florida.",
		phone: "(813) 555-0173",
		website: "https://sotoelderlaw.example",
		reviews: [
			{
				rating: 5,
				quote: "Miriam treated my mother's case like it was her own family.",
				byline: "former client, elder neglect",
			},
			{
				rating: 5,
				quote: "She drove to the facility herself to see the conditions.",
				byline: "former client, care home neglect",
			},
			{
				rating: 4,
				quote: "Compassionate and thorough. Hard to reach some weeks.",
				byline: "former client, financial abuse",
			},
		],
		cases: [
			{
				year: 2024,
				title: "Understaffing at a residential care home",
				amount: "$430,000 settlement",
				outcome: "settled",
			},
			{
				year: 2022,
				title: "Financial exploitation by a paid caregiver",
				amount: "$115,000 restored",
				outcome: "won",
			},
		],
	},
	{
		name: "Daniel Osei",
		firm: "Osei Legal Group",
		state: "Illinois",
		city: "Chicago",
		barNumber: "IL #6301882",
		admittedYear: 2015,
		practiceAreas: ["Employment"],
		languages: ["English"],
		accepting: true,
		virtual: true,
		feeApproach: "hourly",
		feeMin: 275,
		feeMax: 400,
		education: "J.D., Northwestern Pritzker School of Law · 2015",
		background:
			"Four years defending employers at a national firm before switching sides, which he says taught him exactly how these cases get valued.",
		bio: "Employment litigator focused on wrongful termination and retaliation claims against mid-size employers.",
		phone: "(312) 555-0190",
		website: "https://oseilegal.example",
		reviews: [
			{
				rating: 5,
				quote:
					"Daniel took my call the same week and never made me feel like a small case.",
				byline: "former client, retaliation suit",
			},
			{
				rating: 4,
				quote:
					"Sharp litigator. The hourly billing added up faster than I planned.",
				byline: "former client, wrongful termination",
			},
		],
		cases: [
			{
				year: 2025,
				title: "Retaliation after an internal harassment report",
				amount: "$185,000 verdict",
				outcome: "won",
			},
		],
	},
	{
		name: "Elena Vasquez",
		firm: "Vasquez Legal",
		state: "Texas",
		city: "Austin",
		barNumber: "TX #24088412",
		admittedYear: 2016,
		practiceAreas: ["Housing"],
		languages: ["English", "Spanish"],
		accepting: true,
		virtual: true,
		feeApproach: "flat",
		feeMin: 1500,
		feeMax: 4500,
		education: "J.D., University of Texas School of Law · 2016",
		background:
			"Began at a legal aid eviction-defence project handling same-day hearings; brought the flat-fee model with her when she opened her own practice.",
		bio: "Tenant-side housing litigator: illegal evictions, uninhabitable conditions, and deposit theft.",
		phone: "(512) 555-0164",
		website: "https://vasquezlegal.example",
		reviews: [
			{
				rating: 5,
				quote: "Elena had us back in our home in eleven days.",
				byline: "former client, illegal eviction",
			},
			{
				rating: 5,
				quote: "She quoted a flat fee up front and it never moved.",
				byline: "former client, deposit dispute",
			},
			{
				rating: 5,
				quote: "Got repairs ordered for the whole building, not just our unit.",
				byline: "former client, habitability",
			},
			{
				rating: 5,
				quote: "Answered my questions on a Sunday without being asked to.",
				byline: "former client, illegal eviction",
			},
		],
		cases: [
			{
				year: 2025,
				title: "Lock-out without notice",
				amount: "Possession restored plus $18,000",
				outcome: "won",
			},
			{
				year: 2024,
				title: "Mould and no heat across a twelve-unit building",
				amount: "$96,000 and repairs ordered",
				outcome: "settled",
			},
		],
	},
	{
		name: "Dana Kim",
		firm: "Kim Civil Rights Law",
		state: "California",
		city: "Oakland",
		barNumber: "CA #291477",
		admittedYear: 2014,
		practiceAreas: ["Civil rights"],
		languages: ["English", "Korean"],
		accepting: true,
		virtual: true,
		feeApproach: "contingency",
		education: "J.D., UC Berkeley School of Law · 2014",
		background:
			"Clerked for a federal district judge, then five years with a civil-liberties non-profit before entering private practice.",
		bio: "Civil-rights litigation against public agencies and institutions, with a focus on due-process claims.",
		phone: "(510) 555-0155",
		website: "https://kimcivilrights.example",
		reviews: [
			{
				rating: 5,
				quote:
					"Dana fought for two years and never once asked us to settle cheap.",
				byline: "former client, civil rights",
			},
			{
				rating: 4,
				quote:
					"Formidable in a hearing. Communication was sparse between them.",
				byline: "former client, due process",
			},
			{
				rating: 4,
				quote: "We won, but be ready for how long this kind of case takes.",
				byline: "former client, civil rights",
			},
		],
		cases: [
			{
				year: 2024,
				title: "Due-process failure in a benefits termination",
				amount: "Policy changed, $62,000 awarded",
				outcome: "won",
			},
		],
	},
	{
		name: "Robert Achebe",
		firm: "Achebe & Partners",
		state: "Ohio",
		city: "Columbus",
		barNumber: "OH #0079215",
		admittedYear: 2008,
		practiceAreas: ["Consumer fraud", "Contract disputes"],
		languages: ["English"],
		accepting: false,
		virtual: false,
		feeApproach: "quoted_per_case",
		education: "J.D., Ohio State University Moritz College of Law · 2008",
		background:
			"Nine years as an assistant attorney general in the consumer protection section before founding the firm in 2017.",
		bio: "Consumer-protection veteran taking on lenders, contractors, and warranty mills in Ohio.",
		phone: "(614) 555-0129",
		website: "https://achebepartners.example",
		reviews: [
			{
				rating: 4,
				quote:
					"Robert got the judgment reversed when nobody else would look at it.",
				byline: "former client, consumer fraud",
			},
			{
				rating: 4,
				quote: "Knows this area cold. Took a while to get on his calendar.",
				byline: "former client, contractor dispute",
			},
		],
		cases: [
			{
				year: 2025,
				title: "Predatory add-ons on a used-car loan",
				amount: "Loan voided, $24,000 refunded",
				outcome: "won",
			},
		],
	},
	{
		name: "Priya Raghunathan",
		firm: "Raghunathan Immigration",
		state: "New York",
		city: "Queens",
		barNumber: "NY #5218840",
		admittedYear: 2011,
		practiceAreas: ["Immigration", "Family"],
		languages: ["English", "Hindi", "Tamil"],
		accepting: true,
		virtual: true,
		feeApproach: "flat",
		feeMin: 2200,
		feeMax: 8500,
		education: "J.D., Fordham University School of Law · 2011",
		background:
			"Ran a community immigration clinic in Jackson Heights for six years. Fluent in three of the languages her clients speak at home.",
		bio: "Family-based and humanitarian immigration, with a focus on cases that have already been denied once.",
		phone: "(718) 555-0107",
		website: "https://raghunathanimmigration.example",
		reviews: [
			{
				rating: 5,
				quote:
					"Priya took over after another lawyer botched our filing and fixed it.",
				byline: "former client, family petition",
			},
			{
				rating: 5,
				quote: "She sat with my father for an hour explaining it in Tamil.",
				byline: "former client, adjustment of status",
			},
			{
				rating: 5,
				quote: "Every deadline met, every document checked twice.",
				byline: "former client, asylum",
			},
			{
				rating: 4,
				quote:
					"Wonderful lawyer, busy practice — expect to wait for an intake.",
				byline: "former client, family petition",
			},
			{
				rating: 4,
				quote: "Good result. The flat fee was higher than I first understood.",
				byline: "former client, humanitarian visa",
			},
		],
		cases: [
			{
				year: 2025,
				title: "Asylum granted after prior denial on appeal",
				amount: "Status granted",
				outcome: "won",
			},
			{
				year: 2024,
				title: "Family petition reopened after clerical refusal",
				amount: "Petition approved",
				outcome: "won",
			},
		],
	},
	{
		name: "Thomas Okonkwo",
		firm: "Okonkwo Injury Law",
		state: "Pennsylvania",
		city: "Philadelphia",
		barNumber: "PA #204471",
		admittedYear: 2007,
		practiceAreas: ["Personal injury"],
		languages: ["English"],
		accepting: true,
		virtual: true,
		feeApproach: "contingency",
		education: "J.D., Temple University Beasley School of Law · 2007",
		background:
			"Insurance-defence adjuster before law school, which he credits for knowing how the other side values a file.",
		bio: "Serious-injury and vehicle-collision claims, with most matters resolving before trial.",
		phone: "(215) 555-0186",
		website: "https://okonkwoinjury.example",
		reviews: [
			{
				rating: 5,
				quote: "Thomas doubled the offer the insurer swore was final.",
				byline: "former client, vehicle collision",
			},
			{
				rating: 5,
				quote: "Handled the medical liens so I never had to think about them.",
				byline: "former client, serious injury",
			},
			{
				rating: 4,
				quote: "Great settlement. Mostly dealt with his paralegal, not him.",
				byline: "former client, vehicle collision",
			},
		],
		cases: [
			{
				year: 2025,
				title: "Commercial truck collision with disputed liability",
				amount: "$740,000 settlement",
				outcome: "settled",
			},
			{
				year: 2023,
				title: "Fall at an unmaintained loading dock",
				amount: "$165,000 recovered",
				outcome: "won",
			},
		],
	},
	{
		name: "Sarah Lindqvist",
		firm: "Lindqvist Medical Law",
		state: "Washington",
		city: "Seattle",
		barNumber: "WA #41209",
		admittedYear: 2003,
		practiceAreas: ["Medical malpractice"],
		languages: ["English", "Swedish"],
		accepting: false,
		virtual: true,
		feeApproach: "contingency",
		education: "J.D., University of Washington School of Law · 2003",
		background:
			"Registered nurse for eight years before law school; reads the charts herself rather than waiting on an expert summary.",
		bio: "Medical-negligence claims, principally surgical error and delayed diagnosis.",
		phone: "(206) 555-0139",
		website: "https://lindqvistmedical.example",
		reviews: [
			{
				rating: 5,
				quote:
					"Sarah found the error in the chart that three experts had missed.",
				byline: "former client, surgical error",
			},
			{
				rating: 5,
				quote:
					"She understood the medicine as well as the hospital's own witnesses.",
				byline: "former client, delayed diagnosis",
			},
			{
				rating: 5,
				quote: "Honest that our case was hard, then won it anyway.",
				byline: "former client, surgical error",
			},
			{
				rating: 5,
				quote: "Treated my late husband's case with real care.",
				byline: "former client, wrongful death",
			},
			{
				rating: 4,
				quote: "Exceptional, but her waitlist is long for a reason.",
				byline: "former client, delayed diagnosis",
			},
		],
		cases: [
			{
				year: 2025,
				title: "Retained instrument after abdominal surgery",
				amount: "$1,100,000 settlement",
				outcome: "settled",
			},
			{
				year: 2024,
				title: "Sepsis missed across two emergency visits",
				amount: "$620,000 verdict",
				outcome: "won",
			},
			{
				year: 2022,
				title: "Anaesthesia monitoring failure",
				amount: "Confidential settlement",
				outcome: "settled",
			},
		],
	},
	{
		name: "Omar Haddad",
		firm: "Haddad Benefits Law",
		state: "Michigan",
		city: "Dearborn",
		barNumber: "MI #P71204",
		admittedYear: 2013,
		practiceAreas: ["Disability & benefits"],
		languages: ["English", "Arabic"],
		accepting: true,
		virtual: true,
		feeApproach: "hourly",
		feeMin: 180,
		feeMax: 260,
		education: "J.D., Wayne State University Law School · 2013",
		background:
			"Represented claimants at Social Security hearings as a non-attorney representative while studying, and has handled them ever since.",
		bio: "Disability and benefits appeals, from initial denial through administrative hearing.",
		phone: "(313) 555-0198",
		website: "https://haddadbenefits.example",
		reviews: [
			{
				rating: 5,
				quote: "Omar won the hearing after two denials I thought were final.",
				byline: "former client, disability appeal",
			},
			{
				rating: 4,
				quote: "Patient and clear. The process is slow no matter who you hire.",
				byline: "former client, benefits appeal",
			},
		],
		cases: [
			{
				year: 2025,
				title: "Disability award after second-level denial",
				amount: "Benefits granted with back pay",
				outcome: "won",
			},
			{
				year: 2024,
				title: "Long-term disability terminated mid-claim",
				amount: "Coverage reinstated",
				outcome: "settled",
			},
		],
	},
	{
		name: "Nia Caldwell",
		firm: "Caldwell Civil Rights Law",
		state: "Alabama",
		city: "Birmingham",
		barNumber: "AL #24581",
		admittedYear: 2012,
		practiceAreas: ["Civil rights", "Employment"],
		languages: ["English"],
		accepting: true,
		virtual: true,
		feeApproach: "contingency",
		education: "J.D., University of Alabama School of Law · 2012",
		background:
			"Former civil-rights investigator who now represents workers and families in discrimination and constitutional-rights matters.",
		bio: "Plaintiff-side civil-rights and workplace-discrimination representation across Alabama.",
		phone: "(205) 555-0176",
		website: "https://caldwellcivilrights.example",
		reviews: [
			{
				rating: 5,
				quote:
					"Nia listened carefully, then made a hard process feel manageable.",
				byline: "former client, workplace discrimination",
			},
			{
				rating: 4,
				quote: "Clear advice from day one and relentless in negotiations.",
				byline: "former client, retaliation claim",
			},
		],
		cases: [
			{
				year: 2025,
				title: "Retaliation after reporting workplace harassment",
				amount: "$185,000 settlement",
				outcome: "settled",
			},
			{
				year: 2023,
				title: "Discriminatory termination at a manufacturing plant",
				amount: "$92,000 verdict",
				outcome: "won",
			},
		],
	},
	{
		name: "Caleb Monroe",
		firm: "Monroe Injury Group",
		state: "Alabama",
		city: "Montgomery",
		barNumber: "AL #31742",
		admittedYear: 2018,
		practiceAreas: ["Personal injury", "Medical malpractice"],
		languages: ["English", "Spanish"],
		accepting: false,
		virtual: false,
		feeApproach: "contingency",
		education: "J.D., Cumberland School of Law · 2018",
		background:
			"Trial lawyer focused on serious-injury and medical-negligence claims, with a practice across central Alabama.",
		bio: "Serious injury and medical-negligence claims; currently accepting a limited number of new matters.",
		phone: "(334) 555-0128",
		website: "https://monroeinjury.example",
		reviews: [
			{
				rating: 5,
				quote:
					"Caleb never made me feel rushed and was prepared for every question.",
				byline: "former client, vehicle collision",
			},
		],
		cases: [
			{
				year: 2024,
				title: "Delayed diagnosis after emergency-room discharge",
				amount: "$410,000 settlement",
				outcome: "settled",
			},
		],
	},
	{
		// Deliberately bare: verified and listable, but with no reviews and no case
		// record. Shows whether the profile hides those sections rather than
		// rendering empty cards, and whether "Highest rated" sorts an unrated
		// attorney last instead of treating them as zero.
		name: "Jonah Reyes",
		firm: "Reyes Small Business Law",
		state: "Arizona",
		city: "Phoenix",
		barNumber: "AZ #036841",
		admittedYear: 2021,
		practiceAreas: ["Small business", "Contract disputes"],
		languages: ["English", "Spanish"],
		accepting: true,
		virtual: true,
		feeApproach: "quoted_per_case",
		education:
			"J.D., Arizona State University Sandra Day O'Connor College of Law · 2021",
		background:
			"Four years in-house at a family logistics company before qualifying, which is where most of his contract work still comes from.",
		bio: "Contract and vendor disputes for owner-operated businesses, newly taking on plaintiff-side matters.",
		phone: "(602) 555-0121",
		website: "https://reyessmallbusiness.example",
		reviews: [],
		cases: [],
	},
];

/** Deterministic id so re-running updates the same rows. */
const userId = (seed: Seed) =>
	`seed-attorney-${seed.name.toLowerCase().replace(/[^a-z]+/g, "-")}`;
const email = (seed: Seed) =>
	`${seed.name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.invalid`;

if (process.argv.includes("--remove")) {
	// Profiles, reviews, and case records cascade from the user.
	const { count } = await prisma.user.deleteMany({
		where: { id: { in: SEEDS.map(userId) } },
	});
	console.log(`removed ${count} sample attorneys`);
	process.exit(0);
}

for (const seed of SEEDS) {
	const id = userId(seed);

	await prisma.user.upsert({
		where: { id },
		create: {
			id,
			name: seed.name,
			email: email(seed),
			emailVerified: true,
			onboarded: true,
			role: "attorney",
			jurisdiction: seed.state,
			firmName: seed.firm,
			barNumber: seed.barNumber,
		},
		update: {
			jurisdiction: seed.state,
			firmName: seed.firm,
			barNumber: seed.barNumber,
		},
	});

	const profileData = {
		legalName: seed.name,
		firmName: seed.firm,
		officeCity: seed.city,
		officeState: seed.state,
		contactEmail: email(seed),
		contactPhone: seed.phone,
		websiteUrl: seed.website,
		practiceAreas: seed.practiceAreas,
		languages: seed.languages,
		acceptingNewCases: seed.accepting,
		virtualConsultation: seed.virtual,
		feeApproach: seed.feeApproach,
		// Stored in cents, like Case.goalCents.
		feeRangeMinCents: seed.feeMin ? seed.feeMin * 100 : null,
		feeRangeMaxCents: seed.feeMax ? seed.feeMax * 100 : null,
		admittedYear: seed.admittedYear,
		education: seed.education,
		bio: seed.bio,
		background: seed.background,
		// Approved, or the public profile withholds the bio.
		bioStatus: "approved" as const,
		// Verified, or the directory won't list them at all.
		verificationStatus: "verified" as const,
		verifiedAt: new Date(),
	};

	const profile = await prisma.attorneyProfile.upsert({
		where: { userId: id },
		create: { userId: id, ...profileData },
		update: profileData,
		select: { id: true },
	});

	// Replaced wholesale so re-running can't stack duplicates.
	await prisma.attorneyReview.deleteMany({ where: { profileId: profile.id } });
	if (seed.reviews.length) {
		await prisma.attorneyReview.createMany({
			data: seed.reviews.map((r) => ({ profileId: profile.id, ...r })),
		});
	}

	await prisma.attorneyCaseRecord.deleteMany({
		where: { profileId: profile.id },
	});
	if (seed.cases.length) {
		await prisma.attorneyCaseRecord.createMany({
			data: seed.cases.map((c) => ({ profileId: profile.id, ...c })),
		});
	}

	const average = seed.reviews.length
		? (
				seed.reviews.reduce((sum, r) => sum + r.rating, 0) / seed.reviews.length
			).toFixed(1)
		: "—";
	console.log(
		`${seed.name.padEnd(20)} ${seed.state.padEnd(13)} ${String(average).padStart(3)} ★  ` +
			`${String(seed.reviews.length).padStart(2)} reviews  ${seed.cases.length} matters  ` +
			`${seed.accepting ? "accepting" : "waitlist "}  ${seed.feeApproach}`,
	);
}

console.log(`\nseeded ${SEEDS.length} verified attorneys`);
