import { createHash, randomBytes } from "node:crypto";

/**
 * Administrator invitation tokens. Only the hash is ever persisted, so a leaked
 * database can't be replayed as a live invite link — the raw token exists only
 * in the email we send.
 */
export function generateInviteToken() {
	const token = randomBytes(32).toString("base64url");
	return { token, tokenHash: hashInviteToken(token) };
}

export function hashInviteToken(token: string) {
	return createHash("sha256").update(token).digest("hex");
}
