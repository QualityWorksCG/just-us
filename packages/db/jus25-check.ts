/**
 * JUS-25 acceptance check — the Seeking Representation queue and attorney
 * expression of interest, exercised against Postgres.
 *
 *   bun jus25-check.ts
 *
 * Every assertion here maps to something the story promises. The three that
 * matter most are the acceptance criteria, and they are checked structurally
 * rather than by reading the UI:
 *
 *   1. The queue contains only cases genuinely seeking representation — a matched
 *      or funding case is absent, not merely hidden.
 *   2. An attorney reads the matter — story, evidence, plaintiff name — but never
 *      a means of contact. Asserted by exact key set on both projections *and* by
 *      searching the serialised payloads for the contact strings, so a future
 *      `include` that widens either one fails here rather than in production.
 *   3. An attorney cannot reach the plaintiff. Asserted at the level of the
 *      schema — there is no column an attorney can write text into — and by
 *      confirming an expression of interest changes nothing on the case.
 *
 * Fixtures use a `jus25-` id prefix and are torn down at both ends, so the script
 * is rerunnable and leaves the database as it found it.
 */

import prisma from "./src/index";
import {
	expressInterest,
	getQueueCase,
	interestCounts,
	listMyInterests,
	listSeekingQueue,
} from "./src/representation";
import {
	acceptInterest,
	countCaseInterests,
	declineInterest,
	interestCountsByCase,
	listCaseInterests,
	markCaseInterestsViewed,
} from "./src/requests";

let passed = 0;
const failures: string[] = [];

function ok(label: string, condition: boolean, detail?: unknown) {
	if (condition) {
		passed++;
		return;
	}
	failures.push(
		detail === undefined ? label : `${label} — got ${JSON.stringify(detail)}`,
	);
}

function eq(label: string, actual: unknown, expected: unknown) {
	ok(
		label,
		JSON.stringify(actual) === JSON.stringify(expected),
		`${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
	);
}

const PREFIX = "jus25-";
const PLAINTIFF = `${PREFIX}plaintiff`;
const OTHER_PLAINTIFF = `${PREFIX}other-plaintiff`;
const VERIFIED = `${PREFIX}attorney-verified`;
const SECOND = `${PREFIX}attorney-second`;
const UNVERIFIED = `${PREFIX}attorney-unverified`;
const LAPSING = `${PREFIX}attorney-lapsing`;

const USERS = [
	PLAINTIFF,
	OTHER_PLAINTIFF,
	VERIFIED,
	SECOND,
	UNVERIFIED,
	LAPSING,
];

/** The private story text. If this string ever reaches an attorney, the privacy
 *  criterion is broken — so it is searched for rather than assumed absent. */
const SECRET_STORY =
	"PRIVATE-STORY-DO-NOT-LEAK: my employer's HR director is named in the complaint.";

/**
 * The database this runs against also holds seeded and real cases, so every
 * assertion about queue contents is scoped to this script's own fixtures. What is
 * being checked is which of *these* cases the queue admits — a case that must be
 * excluded is asserted absent by id, which is unaffected by whatever else is in
 * the table.
 */
const fixtures = <T extends { id: string }>(rows: T[]) =>
	rows.filter((row) => row.id.startsWith(PREFIX));
const fixtureTitles = <T extends { id: string; title: string }>(rows: T[]) =>
	fixtures(rows).map((row) => row.title);

async function teardown() {
	// Cases, interests, matches, and profiles all cascade from the user.
	await prisma.user.deleteMany({ where: { id: { in: USERS } } });
}

async function makeAttorney(
	id: string,
	name: string,
	state: string,
	status: "verified" | "unverified",
) {
	await prisma.user.create({
		data: {
			id,
			name,
			email: `${id}@example.invalid`,
			emailVerified: true,
			onboarded: true,
			role: "attorney",
			jurisdiction: state,
			barNumber: `${state.slice(0, 2).toUpperCase()} #${id.length}00`,
		},
	});
	await prisma.attorneyProfile.create({
		data: {
			userId: id,
			legalName: name,
			firmName: `${name.split(" ")[1]} Law`,
			officeState: state,
			officeCity: "Somewhere",
			practiceAreas: ["Employment", "Civil rights"],
			admittedYear: 2015,
			verificationStatus: status,
			verifiedAt: status === "verified" ? new Date() : null,
			reviews: {
				create: [
					{ rating: 5, quote: "Clear and direct.", byline: "former client" },
					{ rating: 4, quote: "Kept me informed.", byline: "former client" },
				],
			},
		},
	});
}

/** A case owned by PLAINTIFF, in whatever state the test needs. */
async function makeCase(
	id: string,
	fields: {
		status: "draft" | "seeking" | "live" | "closed";
		title: string;
		category?: string;
		location?: string;
		attorneyName?: string;
		deletedAt?: Date;
		ownerId?: string;
		publishedDaysAgo?: number;
	},
) {
	const published = new Date(
		Date.now() - (fields.publishedDaysAgo ?? 1) * 86_400_000,
	);
	return prisma.case.create({
		data: {
			id: `${PREFIX}${id}`,
			ownerId: fields.ownerId ?? PLAINTIFF,
			title: fields.title,
			category: fields.category ?? "Employment",
			location: fields.location ?? "Georgia",
			summary: "One-line public summary an attorney may read.",
			story: SECRET_STORY,
			evidence: [{ name: "hr-email.pdf", size: 12_345 }],
			coverImageUrl: "https://example.invalid/cover.jpg",
			images: ["https://example.invalid/1.jpg"],
			attorneyEmail: "private-attorney@example.invalid",
			attorneyPhone: "+1 555 0100",
			payoutType: "bank_transfer",
			goalCents: fields.status === "live" ? 500_000 : 0,
			attorneyName: fields.attorneyName ?? null,
			status: fields.status,
			publishedAt: published,
			createdAt: published,
			deletedAt: fields.deletedAt ?? null,
		},
	});
}

await teardown();

// ── Fixtures ────────────────────────────────────────────────────────────────
await prisma.user.createMany({
	data: [
		{
			id: PLAINTIFF,
			name: "Test Plaintiff",
			email: `${PLAINTIFF}@example.invalid`,
			emailVerified: true,
			onboarded: true,
			role: "plaintiff",
			jurisdiction: "Georgia",
		},
		{
			id: OTHER_PLAINTIFF,
			name: "Other Plaintiff",
			email: `${OTHER_PLAINTIFF}@example.invalid`,
			emailVerified: true,
			onboarded: true,
			role: "plaintiff",
			jurisdiction: "Texas",
		},
	],
});

await makeAttorney(VERIFIED, "Ada Verified", "Georgia", "verified");
await makeAttorney(SECOND, "Bo Second", "Georgia", "verified");
await makeAttorney(UNVERIFIED, "Cy Unverified", "Georgia", "unverified");
await makeAttorney(LAPSING, "Di Lapsing", "Georgia", "verified");

// One case per state the queue has to reason about.
await makeCase("open-a", {
	status: "seeking",
	title: "Open A",
	publishedDaysAgo: 2,
});
await makeCase("open-b", {
	status: "seeking",
	title: "Open B",
	category: "Housing",
	location: "California",
	publishedDaysAgo: 9,
});
await makeCase("draft", { status: "draft", title: "Draft" });
await makeCase("live", {
	status: "live",
	title: "Live",
	attorneyName: "Someone",
});
await makeCase("closed", { status: "closed", title: "Closed" });
await makeCase("deleted", {
	status: "seeking",
	title: "Deleted",
	deletedAt: new Date(),
});
// Seeking but already spoken for via bring-your-own (JUS-23) — no Match row, an
// attorney name set directly on the case.
await makeCase("byo", {
	status: "seeking",
	title: "Bring your own",
	attorneyName: "Existing Counsel",
});
// Seeking and matched — the Match row is what excludes it.
await makeCase("matched", { status: "seeking", title: "Already matched" });
await prisma.match.create({
	data: {
		caseId: `${PREFIX}matched`,
		attorneyId: SECOND,
		origin: "expressed_interest",
	},
});

// ── AC1: the queue contains only cases genuinely seeking representation ─────
{
	const queue = await listSeekingQueue(VERIFIED);
	eq(
		"AC1 queue holds only unmatched seeking cases",
		fixtureTitles(queue).sort(),
		["Open A", "Open B"],
	);

	const ids = new Set(queue.map((c) => c.id));
	ok("AC1 draft case absent", !ids.has(`${PREFIX}draft`));
	ok("AC1 live/fundraising case absent", !ids.has(`${PREFIX}live`));
	ok("AC1 closed case absent", !ids.has(`${PREFIX}closed`));
	ok("AC1 soft-deleted case absent", !ids.has(`${PREFIX}deleted`));
	ok("AC1 matched case absent", !ids.has(`${PREFIX}matched`));
	ok("AC1 bring-your-own case absent", !ids.has(`${PREFIX}byo`));
}

// ── AC2: the queue card's shape, and what it must never carry ──────────────
{
	const queue = fixtures(await listSeekingQueue(VERIFIED));
	const item = queue.find((c) => c.title === "Open A");
	ok("a card is present to inspect", !!item);
	if (item) {
		eq("card key set is exactly the list shape", Object.keys(item).sort(), [
			"category",
			"createdAt",
			"id",
			"myInterest",
			"plaintiffName",
			"publishedAt",
			"state",
			"summary",
			"title",
		]);
		eq("card names the plaintiff", item.plaintiffName, "Test Plaintiff");

		// The list stays lean: the long-form account and the attachments belong to
		// the one-case view, not to every row of a listing.
		const serialised = JSON.stringify(queue);
		ok("story not carried by the list", !serialised.includes("PRIVATE-STORY"));
		ok(
			"evidence not carried by the list",
			!serialised.includes("hr-email.pdf"),
		);
		ok(
			"cover image not carried by the list",
			!serialised.includes("cover.jpg"),
		);

		// These must never reach an attorney from any query — a name is not a means
		// of contact, and the plaintiff has to be the one to make contact.
		ok("payout details absent", !serialised.includes("bank_transfer"));
		ok(
			"plaintiff contact details absent",
			!serialised.includes("private-attorney@example.invalid") &&
				!serialised.includes("555 0100"),
		);
		ok("plaintiff account id absent", !serialised.includes(PLAINTIFF));
		ok(
			"plaintiff email absent",
			!serialised.includes(`${PLAINTIFF}@example.invalid`),
		);
	}
}

// ── The case view: the matter in full, but no way to reach the plaintiff ────
{
	const detail = await getQueueCase(`${PREFIX}open-a`, VERIFIED);
	ok("a queued case can be opened", !!detail);
	if (detail) {
		eq("detail key set", Object.keys(detail).sort(), [
			"category",
			"coverImageUrl",
			"createdAt",
			"evidence",
			"id",
			"images",
			"myInterest",
			"plaintiffName",
			"publishedAt",
			"state",
			"story",
			"summary",
			"title",
		]);
		// What the attorney is here to read.
		ok("story is readable", detail.story.includes("PRIVATE-STORY"));
		eq("evidence is listed", detail.evidence.length, 1);
		eq("evidence names the file", detail.evidence[0]?.name, "hr-email.pdf");
		eq("evidence carries its size", detail.evidence[0]?.size, 12_345);
		eq(
			"cover image present",
			detail.coverImageUrl,
			"https://example.invalid/cover.jpg",
		);
		eq("gallery present", detail.images.length, 1);
		eq("plaintiff named", detail.plaintiffName, "Test Plaintiff");

		// What must still not be there, even in the full view.
		const serialised = JSON.stringify(detail);
		ok(
			"plaintiff contact details still absent",
			!serialised.includes("private-attorney@example.invalid") &&
				!serialised.includes("555 0100"),
		);
		ok("payout details still absent", !serialised.includes("bank_transfer"));
		ok("plaintiff account id still absent", !serialised.includes(PLAINTIFF));
		ok(
			"plaintiff email still absent",
			!serialised.includes(`${PLAINTIFF}@example.invalid`),
		);
		ok("funding figures absent", !serialised.includes("goalCents"));
	}
}

// The case view is gated on the queue predicate, not on the id — a case that has
// left the queue stops being readable even for an attorney holding the link.
{
	for (const [label, id] of [
		["live", `${PREFIX}live`],
		["draft", `${PREFIX}draft`],
		["closed", `${PREFIX}closed`],
		["matched", `${PREFIX}matched`],
		["soft-deleted", `${PREFIX}deleted`],
		["bring-your-own", `${PREFIX}byo`],
	] as const) {
		eq(
			`a ${label} case cannot be opened`,
			await getQueueCase(id, VERIFIED),
			null,
		);
	}
	eq(
		"an unknown id cannot be opened",
		await getQueueCase("no-such-case", VERIFIED),
		null,
	);
}

// ── AC3: no channel to the plaintiff exists, at the schema level ────────────
{
	const columns = await prisma.$queryRaw<{ column_name: string }[]>`
		select column_name from information_schema.columns
		where table_name = 'attorney_request'`;
	const names = columns.map((c) => c.column_name).sort();
	eq(
		"AC3 interest row has no field an attorney could write a message into",
		names,
		["attorneyId", "caseId", "createdAt", "id", "status", "viewedAt"],
	);
}

// ── The interest lifecycle: open → viewed → responded / declined ────────────
{
	const values = await prisma.$queryRaw<{ enumlabel: string }[]>`
		select enumlabel from pg_enum e
		join pg_type t on t.oid = e.enumtypid
		where t.typname = 'RequestStatus' order by e.enumsortorder`;
	// Compared as a set: `ALTER TYPE ... ADD VALUE` appends, so an existing
	// database orders `viewed` last while a fresh one follows the schema. Nothing
	// orders by this enum, so only membership matters.
	eq(
		"statuses cover JUS-25's open/viewed/responded/declined",
		values.map((v) => v.enumlabel).sort(),
		["accepted", "declined", "pending", "viewed"],
	);
}

// Unverified attorneys cannot put themselves forward (JUS-24 for this path).
{
	const res = await expressInterest(`${PREFIX}open-a`, UNVERIFIED);
	eq("unverified attorney refused", res, {
		ok: false,
		reason: "not_verified",
	});
	const count = await prisma.attorneyRequest.count({
		where: { attorneyId: UNVERIFIED },
	});
	eq("unverified attorney wrote no row", count, 0);
}

// A case that isn't in the queue can't be reached by id.
{
	for (const [label, id] of [
		["live", `${PREFIX}live`],
		["draft", `${PREFIX}draft`],
		["matched", `${PREFIX}matched`],
		["deleted", `${PREFIX}deleted`],
	] as const) {
		const res = await expressInterest(id, VERIFIED);
		eq(`stale id for a ${label} case refused`, res, {
			ok: false,
			reason: "unavailable",
		});
	}
}

// The happy path.
let interestId = "";
{
	const before = await prisma.case.findUniqueOrThrow({
		where: { id: `${PREFIX}open-a` },
	});
	const res = await expressInterest(`${PREFIX}open-a`, VERIFIED);
	ok("verified attorney can express interest", res.ok, res);
	if (res.ok) interestId = res.interestId;

	const row = await prisma.attorneyRequest.findUniqueOrThrow({
		where: { id: interestId },
	});
	eq("new interest starts open (pending)", row.status, "pending");
	eq("new interest is unviewed", row.viewedAt, null);

	// AC3, behaviourally: expressing interest touches nothing the plaintiff owns.
	const after = await prisma.case.findUniqueOrThrow({
		where: { id: `${PREFIX}open-a` },
	});
	eq(
		"case status unchanged by an expression of interest",
		after.status,
		before.status,
	);
	eq("no attorney set on the case", after.attorneyName, null);
	const match = await prisma.match.findUnique({
		where: { caseId: `${PREFIX}open-a` },
	});
	eq("no match created by an expression of interest", match, null);
}

// Once expressed, the queue tells that attorney — and only that attorney.
{
	const mine = await listSeekingQueue(VERIFIED);
	const item = mine.find((c) => c.id === `${PREFIX}open-a`);
	eq(
		"own interest visible to the attorney who made it",
		item?.myInterest?.status,
		"pending",
	);

	const theirs = await listSeekingQueue(SECOND);
	const same = theirs.find((c) => c.id === `${PREFIX}open-a`);
	eq(
		"another attorney sees no interest of anyone else's",
		same?.myInterest,
		null,
	);
	ok("case stays in the queue for other attorneys", !!same);
}

// One expression of interest per attorney per case.
{
	const again = await expressInterest(`${PREFIX}open-a`, VERIFIED);
	eq("second expression of interest refused", again, {
		ok: false,
		reason: "already_expressed",
	});
	const count = await prisma.attorneyRequest.count({
		where: { caseId: `${PREFIX}open-a`, attorneyId: VERIFIED },
	});
	eq("still exactly one interest row", count, 1);
}

// ── The plaintiff's side: it surfaces, and only to the owner ────────────────
{
	await expressInterest(`${PREFIX}open-a`, SECOND);
	await expressInterest(`${PREFIX}open-a`, LAPSING);

	const counts = await countCaseInterests(`${PREFIX}open-a`, PLAINTIFF);
	eq("three open interests on the case", counts, { open: 3, unseen: 3 });

	const byCase = await interestCountsByCase(PLAINTIFF);
	eq("dashboard count for the case", byCase[`${PREFIX}open-a`], {
		open: 3,
		unseen: 3,
	});

	const foreign = await interestCountsByCase(OTHER_PLAINTIFF);
	eq("another plaintiff sees no counts", Object.keys(foreign).length, 0);

	const notMine = await listCaseInterests(`${PREFIX}open-a`, OTHER_PLAINTIFF);
	eq("another plaintiff cannot read the inbox", notMine.length, 0);

	const list = await listCaseInterests(`${PREFIX}open-a`, PLAINTIFF);
	eq("owner reads all three", list.length, 3);
	const first = list.find((i) => i.id === interestId);
	eq(
		"attorney name comes from the bar record",
		first?.attorneyName,
		"Ada Verified",
	);
	eq("rating averaged from published reviews", first?.rating, 4.5);
	eq("review count", first?.reviewCount, 2);
	eq(
		"verification status is live, not snapshotted",
		first?.verificationStatus,
		"verified",
	);
	ok(
		"profile id present so the card can link to the profile",
		!!first?.profileId,
	);
	eq("unseen interest is flagged new", first?.isNew, true);
	ok(
		"inbox carries no message field",
		first !== undefined && !("message" in first),
	);
}

// Opening the inbox is what marks them viewed.
{
	const marked = await markCaseInterestsViewed(`${PREFIX}open-a`, PLAINTIFF);
	eq("all three newly marked viewed", marked, 3);

	const rows = await prisma.attorneyRequest.findMany({
		where: { caseId: `${PREFIX}open-a` },
	});
	ok(
		"every row is now viewed",
		rows.every((r) => r.status === "viewed"),
	);
	ok(
		"every row has a viewedAt",
		rows.every((r) => r.viewedAt !== null),
	);

	const again = await markCaseInterestsViewed(`${PREFIX}open-a`, PLAINTIFF);
	eq("re-opening marks nothing further", again, 0);

	const counts = await countCaseInterests(`${PREFIX}open-a`, PLAINTIFF);
	eq("viewed interests are still open", counts, { open: 3, unseen: 0 });

	const list = await listCaseInterests(`${PREFIX}open-a`, PLAINTIFF);
	eq("viewed interests still listed", list.length, 3);
	ok(
		"none flagged new any more",
		list.every((i) => !i.isNew),
	);

	const foreign = await markCaseInterestsViewed(
		`${PREFIX}open-a`,
		OTHER_PLAINTIFF,
	);
	eq("a non-owner cannot mark anything viewed", foreign, 0);
}

// Declining is final.
{
	const target = (await listCaseInterests(`${PREFIX}open-a`, PLAINTIFF)).find(
		(i) => i.attorneyName === "Bo Second",
	);
	const count = await declineInterest(target?.id ?? "", PLAINTIFF);
	eq("decline applied", count, 1);

	const row = await prisma.attorneyRequest.findUniqueOrThrow({
		where: { id: target?.id ?? "" },
	});
	eq("status is declined", row.status, "declined");

	const retry = await expressInterest(`${PREFIX}open-a`, SECOND);
	eq("a declined attorney cannot ask again", retry, {
		ok: false,
		reason: "already_expressed",
	});

	const open = await countCaseInterests(`${PREFIX}open-a`, PLAINTIFF);
	eq("declined interest drops out of the open count", open.open, 2);
}

// A non-owner cannot accept or decline.
{
	const stolen = await acceptInterest(interestId, OTHER_PLAINTIFF);
	eq("a non-owner cannot accept", stolen, { ok: false, reason: "not_found" });
	const declined = await declineInterest(interestId, OTHER_PLAINTIFF);
	eq("a non-owner cannot decline", declined, 0);
}

// Bar standing is re-checked at the point of matching (JUS-24), because it can
// lapse between expressing interest and the plaintiff deciding.
{
	const lapsed = (await listCaseInterests(`${PREFIX}open-a`, PLAINTIFF)).find(
		(i) => i.attorneyName === "Di Lapsing",
	);
	await prisma.attorneyProfile.update({
		where: { userId: LAPSING },
		data: { verificationStatus: "needs_review" },
	});
	const res = await acceptInterest(lapsed?.id ?? "", PLAINTIFF);
	eq("an attorney whose standing lapsed cannot be matched", res, {
		ok: false,
		reason: "not_verified",
	});
	const match = await prisma.match.findUnique({
		where: { caseId: `${PREFIX}open-a` },
	});
	eq("no match written on a refused accept", match, null);
	const list = await listCaseInterests(`${PREFIX}open-a`, PLAINTIFF);
	eq(
		"the lapsed attorney's badge reflects it",
		list.find((i) => i.id === lapsed?.id)?.verificationStatus,
		"needs_review",
	);
}

// ── Match.origin is recorded when the path resolves ─────────────────────────
{
	const res = await acceptInterest(interestId, PLAINTIFF);
	eq("plaintiff takes the attorney forward", res, {
		ok: true,
		caseId: `${PREFIX}open-a`,
	});

	const match = await prisma.match.findUniqueOrThrow({
		where: { caseId: `${PREFIX}open-a` },
	});
	eq("Match.origin is expressed_interest", match.origin, "expressed_interest");
	eq("match points at the chosen attorney", match.attorneyId, VERIFIED);
	eq(
		"match links back to the expression of interest",
		match.requestId,
		interestId,
	);

	const row = await prisma.attorneyRequest.findUniqueOrThrow({
		where: { id: interestId },
	});
	eq("interest is now responded (accepted)", row.status, "accepted");

	const c = await prisma.case.findUniqueOrThrow({
		where: { id: `${PREFIX}open-a` },
	});
	eq(
		"attorney copied onto the case from the live profile",
		c.attorneyName,
		"Ada Verified",
	);
	eq("firm copied", c.attorneyFirm, "Verified Law");
	eq("practice area copied", c.attorneyArea, "Employment");
	eq("jurisdiction copied", c.attorneyLocation, "Georgia");
}

// A matched case leaves the queue and cannot be matched twice.
{
	const queue = await listSeekingQueue(SECOND);
	ok(
		"matched case has left the queue for everyone",
		!queue.some((c) => c.id === `${PREFIX}open-a`),
	);

	const remaining = (await listCaseInterests(`${PREFIX}open-a`, PLAINTIFF)).at(
		0,
	);
	const second = await acceptInterest(remaining?.id ?? "", PLAINTIFF);
	eq("a case cannot be matched twice", second, {
		ok: false,
		reason: "already_matched",
	});
	const matches = await prisma.match.count({
		where: { caseId: `${PREFIX}open-a` },
	});
	eq("still exactly one match", matches, 1);
}

// ── The attorney's own view of what they've done ────────────────────────────
{
	const tally = await interestCounts(VERIFIED);
	eq("verified attorney's tally", tally, {
		total: 1,
		awaiting: 0,
		accepted: 1,
		declined: 0,
	});
	eq("second attorney's tally", await interestCounts(SECOND), {
		total: 1,
		awaiting: 0,
		accepted: 0,
		declined: 1,
	});

	const mine = await listMyInterests(VERIFIED);
	eq(
		"accepted interest still visible after the case left the queue",
		mine.length,
		1,
	);
	eq("with its status", mine[0]?.status, "accepted");
	eq("and the card shape only", Object.keys(mine[0]?.case ?? {}).sort(), [
		"category",
		"id",
		"plaintiffName",
		"state",
		"summary",
		"title",
	]);
	ok(
		"no contact details in the attorney's own history",
		!JSON.stringify(mine).includes("private-attorney@example.invalid") &&
			!JSON.stringify(mine).includes(PLAINTIFF),
	);
}

// ── Filters and ordering ───────────────────────────────────────────────────
{
	const housing = await listSeekingQueue(VERIFIED, { category: "Housing" });
	eq("category filter", fixtureTitles(housing), ["Open B"]);

	const california = await listSeekingQueue(VERIFIED, { state: "California" });
	eq("state filter", fixtureTitles(california), ["Open B"]);

	const none = await listSeekingQueue(VERIFIED, {
		category: "Housing",
		state: "Georgia",
	});
	eq("filters combine (and can return nothing)", fixtures(none).length, 0);

	// Ordering needs more than one row, so add a second. Both are
	// Housing/California, so filtering to that pair isolates them from the seeded
	// cases and makes the ordering assertion exact.
	await makeCase("open-c", {
		status: "seeking",
		title: "Open C",
		category: "Housing",
		location: "California",
		publishedDaysAgo: 40,
	});
	const newest = await listSeekingQueue(VERIFIED, {
		category: "Housing",
		state: "California",
		sort: "newest",
	});
	eq("newest first", fixtureTitles(newest), ["Open B", "Open C"]);
	const oldest = await listSeekingQueue(VERIFIED, {
		category: "Housing",
		state: "California",
		sort: "oldest",
	});
	eq("longest waiting first", fixtureTitles(oldest), ["Open C", "Open B"]);
}

await teardown();

console.log(`\n${passed} assertions passed`);
if (failures.length) {
	console.log(`${failures.length} FAILED:`);
	for (const failure of failures) console.log(`  ✗ ${failure}`);
	process.exit(1);
}
console.log("JUS-25 acceptance criteria hold.");
process.exit(0);
