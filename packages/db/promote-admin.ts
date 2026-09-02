/**
 * Bootstrap the first administrator (JUS-13).
 *
 * `administrator` is deliberately not self-selectable at sign-up, and the
 * invite-code flow (JUS-11) is not built yet, so there is no in-app way to create
 * the first one. Feature-flag administration needs an admin to exist, hence this
 * script. It promotes an already-registered, verified user.
 *
 *   bun promote-admin.ts someone@example.com
 *   bun promote-admin.ts someone@example.com --demote
 *
 * Run from packages/db. Whichever database DATABASE_URL points at is the one
 * affected, so check your environment before running.
 */
import prisma from "./src/index";

const email = process.argv[2];
const demote = process.argv.includes("--demote");

if (!email) {
	console.error(
		"Usage: bun promote-admin.ts <email> [--demote]\n" +
			"The user must already exist — this promotes an account, it doesn't create one.",
	);
	process.exit(1);
}

const user = await prisma.user.findUnique({
	where: { email },
	select: { id: true, email: true, role: true, emailVerified: true },
});

if (!user) {
	console.error(`No user with email ${email}. Sign up first, then promote.`);
	process.exit(1);
}

if (!user.emailVerified) {
	console.error(
		`${email} has not verified their email. Verify first — unverified accounts can't sign in.`,
	);
	process.exit(1);
}

// Demotion falls back to donor, the same default the onboarding path uses.
const nextRole = demote ? "donor" : "administrator";

if (user.role === nextRole) {
	console.log(`${email} is already ${nextRole}. Nothing to do.`);
	process.exit(0);
}

await prisma.user.update({
	where: { id: user.id },
	data: { role: nextRole },
});

console.log(`${email}: ${user.role} -> ${nextRole}`);
