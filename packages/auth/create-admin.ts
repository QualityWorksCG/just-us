/**
 * Create a ready-to-use administrator account (bootstrap helper).
 *
 * Unlike promote-admin.ts (which promotes an *existing* verified user), this
 * creates the account outright: user + credential, email pre-verified and
 * onboarding pre-completed, role = administrator. The password is hashed with
 * Better Auth's own hasher so it verifies identically at sign-in; the plaintext
 * is only printed once, here.
 *
 *   bun create-admin.ts <email> [name] [password]
 *
 * Run from packages/auth. Affects whatever DATABASE_URL points at.
 */

import { randomBytes, randomUUID } from "node:crypto";
import prisma from "@just-us/db";

import { auth } from "./src/index";

const email = process.argv[2]?.toLowerCase();
const name = process.argv[3] ?? "Admin";
let password = process.argv[4];

if (!email) {
	console.error("Usage: bun create-admin.ts <email> [name] [password]");
	process.exit(1);
}

// A strong, readable password when the caller doesn't supply one.
function generatePassword() {
	const raw = randomBytes(15).toString("base64url").replace(/[-_]/g, "");
	return `Ju!${raw.slice(0, 16)}9`;
}
if (!password) password = generatePassword();

const existing = await prisma.user.findUnique({
	where: { email },
	select: { id: true, role: true },
});
if (existing) {
	console.error(
		`A user with ${email} already exists (role: ${existing.role}). ` +
			"Use promote-admin.ts to change its role, or delete it first.",
	);
	process.exit(1);
}

const ctx = await auth.$context;
const hash = await ctx.password.hash(password);

const userId = randomUUID();
await prisma.user.create({
	data: {
		id: userId,
		name,
		email,
		emailVerified: true,
		role: "administrator",
		onboarded: true,
	},
});
await prisma.account.create({
	data: {
		id: randomUUID(),
		accountId: userId,
		providerId: "credential",
		userId,
		password: hash,
	},
});

console.log("\n✅ Administrator created\n");
console.log(`  email:    ${email}`);
console.log(`  name:     ${name}`);
console.log(`  password: ${password}`);
console.log("  role:     administrator (verified + onboarded)\n");
console.log(
	"Sign in at /login, then change this password from Profile & settings.\n",
);

process.exit(0);
