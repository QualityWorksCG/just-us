/**
 * JUS-13 verification for the feature-flag layer.
 *
 * Exercises the real database path: defaults, toggle round-trip, registry
 * guarding, and that rows for removed flags can't leak back in. Restores the
 * flags it touched.
 *
 * Run from packages/flags:  bun flags-check.ts
 */
import prisma from "@just-us/db";

import { isFeatureEnabled, readFlags, setFlag } from "./src/index";
import { FLAG_KEYS, isFlagKey } from "./src/registry";

let failures = 0;

function check(label: string, pass: boolean, detail = "") {
	if (!pass) failures++;
	console.log(
		`${pass ? "PASS" : "FAIL"}  ${label}${pass ? "" : ` — ${detail}`}`,
	);
}

const KEY = "investorTrack";
const STALE = "flagsCheckRemovedFlag";

// Capture existing state so a real toggle isn't clobbered by this run.
const original = await prisma.featureFlag.findUnique({ where: { key: KEY } });

console.log("--- registry ---");
check("declared keys present", FLAG_KEYS.length > 0, "registry is empty");
check("known key accepted", isFlagKey(KEY));
check("unknown key rejected", !isFlagKey("nope"));
check("empty key rejected", !isFlagKey(""));
// Guards against a prototype-key false positive, e.g. isFlagKey("toString").
check("prototype key rejected", !isFlagKey("toString"));

console.log("\n--- defaults: no row means off ---");
await prisma.featureFlag.deleteMany({ where: { key: KEY } });
check("unset flag reads false", (await readFlags())[KEY] === false);
check("unset flag via single read", (await isFeatureEnabled(KEY)) === false);

console.log("\n--- toggle round-trip ---");
await setFlag(KEY, true, "flags-check");
check("enabled persists", (await readFlags())[KEY] === true);
check("single read agrees", (await isFeatureEnabled(KEY)) === true);
const row = await prisma.featureFlag.findUniqueOrThrow({ where: { key: KEY } });
check(
	"updatedBy recorded",
	row.updatedBy === "flags-check",
	`got ${row.updatedBy}`,
);

await setFlag(KEY, false, "flags-check");
check("disabled persists", (await readFlags())[KEY] === false);

console.log("\n--- a row for a removed flag is ignored ---");
await prisma.featureFlag.create({ data: { key: STALE, enabled: true } });
const state = await readFlags();
check(
	"stale key absent from state",
	!Object.hasOwn(state, STALE),
	`state leaked ${STALE}`,
);
check(
	"state shape matches registry",
	Object.keys(state).sort().join() === [...FLAG_KEYS].sort().join(),
	`got ${Object.keys(state).join()}`,
);
await prisma.featureFlag.deleteMany({ where: { key: STALE } });

// Restore whatever was there before.
await prisma.featureFlag.deleteMany({ where: { key: KEY } });
if (original) {
	await prisma.featureFlag.create({ data: original });
	console.log(`\n(restored ${KEY} = ${original.enabled})`);
}

console.log(
	failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`,
);
process.exit(failures === 0 ? 0 : 1);
