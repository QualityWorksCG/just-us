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
		jurisdiction: "Georgia",
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
	jurisdiction: "Georgia",
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
