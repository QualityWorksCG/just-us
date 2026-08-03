import { validateProfileFields } from "./src/lib/profile-validation";

let failed = 0;

function check(name: string, condition: boolean, detail = "") {
	if (condition) {
		console.log(`✓ ${name}`);
	} else {
		failed += 1;
		console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
	}
}

const plaintiff = validateProfileFields({
	role: "plaintiff",
	displayName: "  Orane Findley  ",
	jurisdiction: "Georgia",
});
check(
	"plaintiff accepts a canonical jurisdiction",
	plaintiff.ok &&
		plaintiff.data.displayName === "Orane Findley" &&
		plaintiff.data.jurisdiction === "Georgia",
);

const attorney = validateProfileFields({
	role: "attorney",
	displayName: "Counsel",
	jurisdiction: "Florida",
});
check(
	"attorney accepts a canonical jurisdiction",
	attorney.ok && attorney.data.jurisdiction === "Florida",
);

const legacy = validateProfileFields({
	role: "plaintiff",
	displayName: "Legacy account",
	jurisdiction: "",
});
check(
	"legacy plaintiff can save without a jurisdiction",
	legacy.ok && legacy.data.jurisdiction === undefined,
);

const invalidState = validateProfileFields({
	role: "plaintiff",
	displayName: "Orane Findley",
	jurisdiction: "Atlantis",
});
check(
	"unknown jurisdiction is rejected",
	!invalidState.ok && Boolean(invalidState.fieldErrors.jurisdiction),
);

const wrongRole = validateProfileFields({
	role: "donor",
	displayName: "A donor",
	jurisdiction: "Georgia",
});
check(
	"donor cannot submit a jurisdiction",
	!wrongRole.ok && Boolean(wrongRole.fieldErrors.jurisdiction),
);

const emptyName = validateProfileFields({
	role: "administrator",
	displayName: "   ",
	jurisdiction: "",
});
check(
	"empty display name is rejected",
	!emptyName.ok && Boolean(emptyName.fieldErrors.displayName),
);

if (failed > 0) {
	console.error(`\n${failed} JUS-65 check${failed === 1 ? "" : "s"} failed.`);
	process.exit(1);
}

console.log("\nAll JUS-65 profile policy checks passed.");
