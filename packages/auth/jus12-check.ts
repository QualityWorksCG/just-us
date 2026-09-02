/**
 * JUS-12 verification: a licensing jurisdiction is captured for attorneys and
 * NOT stored for anyone else — including plaintiffs, whose jurisdiction belongs
 * to each case (`Case.location`) rather than to them. Creates throwaway users,
 * runs the real onboarding persistence path for each self-signup role, asserts
 * what landed, then cleans up.
 *
 * Run from packages/auth:  bun jus12-check.ts
 */
import prisma from "@just-us/db";

import { isValidJurisdiction, US_STATES } from "./src/jurisdiction";
import { JURISDICTION_ROLES, requiresJurisdiction } from "./src/rbac";
import { completeUserOnboarding } from "./src/signup";

const ROLES = ["plaintiff", "donor", "attorney"] as const;
const TAG = "jus12-check";

let failures = 0;

function check(label: string, pass: boolean, detail = "") {
	if (!pass) failures++;
	console.log(
		`${pass ? "PASS" : "FAIL"}  ${label}${pass ? "" : ` — ${detail}`}`,
	);
}

console.log("--- role policy ---");
check("attorney requires jurisdiction", requiresJurisdiction("attorney"));
// The plaintiff is the point of this policy: theirs is per-case, so the profile
// must not ask for one.
check("plaintiff does not", !requiresJurisdiction("plaintiff"));
check("donor does not", !requiresJurisdiction("donor"));
check("administrator does not", !requiresJurisdiction("administrator"));
check(
	"only one role collects it",
	JURISDICTION_ROLES.length === 1,
	`got ${JURISDICTION_ROLES.length}`,
);

console.log(
	"\n--- persistence: stored for attorney, dropped for plaintiff and donor ---",
);

for (const role of ROLES) {
	const user = await prisma.user.create({
		data: {
			id: `${TAG}-${role}`,
			name: `Check ${role}`,
			email: `${TAG}+${role}@example.com`,
			emailVerified: true,
		},
	});

	await completeUserOnboarding(user.id, {
		role,
		jurisdictions: ["Georgia"],
		firmName: role === "attorney" ? "Bell & Associates" : undefined,
		barNumber: role === "attorney" ? "GA #338114" : undefined,
	});

	const saved = await prisma.user.findUniqueOrThrow({
		where: { id: user.id },
		select: { role: true, jurisdiction: true, firmName: true, onboarded: true },
	});

	// "Georgia" is submitted for every role above, so plaintiff and donor prove
	// the server drops it rather than merely that the UI never asked.
	const expected = requiresJurisdiction(role) ? "Georgia" : null;
	check(
		`${role}: jurisdiction ${expected === null ? "dropped" : "persisted"}`,
		saved.jurisdiction === expected,
		`expected ${JSON.stringify(expected)}, got ${JSON.stringify(saved.jurisdiction)}`,
	);
	// The primary label is only half of it: admissions are what every matching gate
	// reads, so a role that carries no jurisdiction must carry no admission either.
	const admissions = await prisma.attorneyAdmission.findMany({
		where: { userId: user.id },
		select: { state: true, verificationStatus: true },
	});
	check(
		`${role}: admissions ${expected === null ? "dropped" : "written"}`,
		expected === null
			? admissions.length === 0
			: admissions.length === 1 && admissions[0]?.state === "Georgia",
		`got ${JSON.stringify(admissions.map((a) => a.state))}`,
	);
	if (expected !== null) {
		check(
			`${role}: admission starts unverified`,
			admissions[0]?.verificationStatus === "unverified",
			`got ${admissions[0]?.verificationStatus}`,
		);
	}
	check(`${role}: role persisted`, saved.role === role, `got ${saved.role}`);
	check(`${role}: onboarded set`, saved.onboarded, "still false");
	// Firm stays attorney-only — widening jurisdiction must not widen these.
	check(
		`${role}: firmName scoped to attorney`,
		role === "attorney"
			? saved.firmName === "Bell & Associates"
			: saved.firmName === null,
		`got ${JSON.stringify(saved.firmName)}`,
	);
}

// Administrator is not self-selectable, so onboarding must never grant it.
const sneaky = await prisma.user.create({
	data: {
		id: `${TAG}-sneaky`,
		name: "Check escalation",
		email: `${TAG}+admin@example.com`,
		emailVerified: true,
	},
});
await completeUserOnboarding(sneaky.id, {
	role: "administrator",
	jurisdictions: ["Georgia"],
});
const escalated = await prisma.user.findUniqueOrThrow({
	where: { id: sneaky.id },
	select: { role: true, jurisdiction: true },
});
check(
	"administrator not self-grantable",
	escalated.role !== "administrator",
	`got ${escalated.role}`,
);
// Falls back to donor, which doesn't collect a jurisdiction — so the submitted
// value must not survive the downgrade.
check(
	"jurisdiction dropped on role fallback",
	escalated.jurisdiction === null,
	`got ${JSON.stringify(escalated.jurisdiction)}`,
);

console.log("\n--- a case carries its own jurisdiction ---");

// Two cases in different states under one plaintiff whose own jurisdiction is
// null. This is what the profile field could not express, and the reason it
// moved: the state has to be per case.
const owner = await prisma.user.create({
	data: {
		id: `${TAG}-multi`,
		name: "Check multi-state",
		email: `${TAG}+multi@example.com`,
		emailVerified: true,
		onboarded: true,
		role: "plaintiff",
	},
});
for (const [suffix, state] of [
	["ga", "Georgia"],
	["tx", "Texas"],
] as const) {
	await prisma.case.create({
		data: {
			id: `${TAG}-case-${suffix}`,
			ownerId: owner.id,
			title: `Check case ${state}`,
			category: "Employment",
			location: state,
			summary: "Fixture case.",
			story: "Fixture story.",
			goalCents: 0,
		},
	});
}
const cases = await prisma.case.findMany({
	where: { ownerId: owner.id },
	select: { location: true },
	orderBy: { id: "asc" },
});
const ownerRow = await prisma.user.findUniqueOrThrow({
	where: { id: owner.id },
	select: { jurisdiction: true },
});
check(
	"owner holds no jurisdiction",
	ownerRow.jurisdiction === null,
	`got ${JSON.stringify(ownerRow.jurisdiction)}`,
);
check(
	"one plaintiff can hold cases in two states",
	cases.map((c) => c.location).join(",") === "Georgia,Texas",
	`got ${JSON.stringify(cases.map((c) => c.location))}`,
);
check(
	"every case state is on the allowlist",
	cases.every((c) => isValidJurisdiction(c.location)),
	`got ${JSON.stringify(cases.map((c) => c.location))}`,
);

// The attorney half of the same problem: a licence is per state, and one attorney
// can hold several. This is what the single `User.jurisdiction` could not express
// — and while it could not, nothing on the platform could enforce it either.
console.log("\n--- an attorney can be admitted in several states ---");

const multiAttorney = await prisma.user.create({
	data: {
		id: `${TAG}-multi-attorney`,
		name: "Check multi-admitted",
		email: `${TAG}+multi-attorney@example.com`,
		emailVerified: true,
	},
});
await completeUserOnboarding(multiAttorney.id, {
	role: "attorney",
	jurisdictions: ["Georgia", "Texas"],
	firmName: "Bell & Associates",
	barNumber: "GA #338114",
});
const multiRow = await prisma.user.findUniqueOrThrow({
	where: { id: multiAttorney.id },
	select: { jurisdiction: true },
});
const multiAdmissions = await prisma.attorneyAdmission.findMany({
	where: { userId: multiAttorney.id },
	select: { state: true, verificationStatus: true },
	orderBy: { state: "asc" },
});
check(
	"both states are recorded as admissions",
	multiAdmissions.map((a) => a.state).join(",") === "Georgia,Texas",
	`got ${JSON.stringify(multiAdmissions.map((a) => a.state))}`,
);
check(
	"the first state picked becomes the primary",
	multiRow.jurisdiction === "Georgia",
	`got ${JSON.stringify(multiRow.jurisdiction)}`,
);
check(
	"neither admission is verified by declaring it",
	multiAdmissions.every((a) => a.verificationStatus === "unverified"),
	`got ${JSON.stringify(multiAdmissions.map((a) => a.verificationStatus))}`,
);

// Re-running onboarding with one state dropped must take the admission with it,
// or a state given up would keep letting its cases through.
await completeUserOnboarding(multiAttorney.id, {
	role: "attorney",
	jurisdictions: ["Texas"],
	firmName: "Bell & Associates",
});
const afterDrop = await prisma.attorneyAdmission.findMany({
	where: { userId: multiAttorney.id },
	select: { state: true },
});
const afterDropRow = await prisma.user.findUniqueOrThrow({
	where: { id: multiAttorney.id },
	select: { jurisdiction: true },
});
check(
	"a dropped state loses its admission",
	afterDrop.length === 1 && afterDrop[0]?.state === "Texas",
	`got ${JSON.stringify(afterDrop.map((a) => a.state))}`,
);
check(
	"the primary follows the surviving admission",
	afterDropRow.jurisdiction === "Texas",
	`got ${JSON.stringify(afterDropRow.jurisdiction)}`,
);

await prisma.case.deleteMany({ where: { id: { startsWith: `${TAG}-case-` } } });
await prisma.user.deleteMany({ where: { id: { startsWith: `${TAG}-` } } });

console.log("\n--- allowlist: server rejects anything off the state list ---");
check("valid state accepted", isValidJurisdiction("Georgia"));
check("empty string rejected", !isValidJurisdiction(""));
check("unknown value rejected", !isValidJurisdiction("Atlantis"));
check("wrong case rejected", !isValidJurisdiction("georgia"));
check("abbreviation rejected", !isValidJurisdiction("GA"));
check("50 states listed", US_STATES.length === 50, `got ${US_STATES.length}`);

console.log(
	failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
