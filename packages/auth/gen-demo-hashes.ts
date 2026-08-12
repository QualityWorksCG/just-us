/**
 * Generate Better Auth password hashes for the demo accounts.
 *
 * Run from `packages/auth` so `better-auth/crypto` resolves. Uses Better Auth's
 * own `hashPassword` rather than reimplementing scrypt, so the stored hash is
 * correct by construction for whatever version is installed — a hand-rolled
 * format that drifts would fail only at sign-in, which is the worst place to
 * find out.
 *
 * Writes {email: hash} JSON to the path given as argv[2]. The plaintext is
 * printed nowhere and the file holds only hashes.
 */
import { hashPassword, verifyPassword } from "better-auth/crypto";

const outPath = process.argv[2];
const password = process.env.DEMO_PASSWORD;
if (!outPath) throw new Error("usage: bun gen-demo-hashes.ts <out.json>");
if (!password) throw new Error("DEMO_PASSWORD must be set");

const emails = [
	"admin@justusdemo.com",
	"plaintiff@justusdemo.com",
	"plaintiff2@justusdemo.com",
	"attorney@justusdemo.com",
	"attorney2@justusdemo.com",
	"attorney3@justusdemo.com",
	"donor@justusdemo.com",
	"donor2@justusdemo.com",
];

const hashes: Record<string, string> = {};
for (const email of emails) {
	// A fresh salt per account: reusing one hash across accounts would make every
	// demo row share a salt, which is exactly what per-account salting prevents.
	const hash = await hashPassword(password);
	if (!(await verifyPassword({ hash, password }))) {
		throw new Error(`hash failed to verify for ${email}`);
	}
	hashes[email] = hash;
}

await Bun.write(outPath, JSON.stringify(hashes, null, 2));
console.log(`wrote ${Object.keys(hashes).length} verified hashes to ${outPath}`);
