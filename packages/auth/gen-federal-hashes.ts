/**
 * Generate Better Auth password hashes for the five seeded federal attorneys.
 *
 * Run from `packages/auth` so `better-auth/crypto` resolves. Uses Better Auth's
 * own `hashPassword`, so the stored hash is correct by construction for whatever
 * version is installed. The plaintext is printed nowhere; the output file holds
 * only {email: hash}.
 *
 *   DEMO_PASSWORD='...' bun gen-federal-hashes.ts /tmp/fed-hashes.json
 */
import { hashPassword, verifyPassword } from "better-auth/crypto";

const outPath = process.argv[2];
const password = process.env.DEMO_PASSWORD;
if (!outPath) throw new Error("usage: bun gen-federal-hashes.ts <out.json>");
if (!password) throw new Error("DEMO_PASSWORD must be set");

const emails = [1, 2, 3, 4, 5].map(
	(n) => `jmorris+lawyer${n}@qualityworkscg.com`,
);

const hashes: Record<string, string> = {};
for (const email of emails) {
	// A fresh salt per account, so no two rows share one.
	const hash = await hashPassword(password);
	if (!(await verifyPassword({ hash, password }))) {
		throw new Error(`hash failed to verify for ${email}`);
	}
	hashes[email] = hash;
}

await Bun.write(outPath, JSON.stringify(hashes, null, 2));
console.log(`wrote ${Object.keys(hashes).length} verified hashes to ${outPath}`);
