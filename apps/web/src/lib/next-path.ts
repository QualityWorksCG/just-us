/**
 * Where to send someone once they have finished the detour they were sent on.
 *
 * Sign-in, email verification and onboarding all end in a fixed redirect to
 * /home, which is right when someone arrived under their own steam and wrong
 * when they were mid-way through something else. An attorney following a case
 * invitation is the case in point: without a way back, the only route to the
 * Confirm button is finding the email again.
 *
 * The value arrives in a query string, so it is attacker-supplied and is treated
 * that way. Only a path on this site survives: it must start with a single "/"
 * and carry no scheme, no host, and no backslash (which some parsers fold into a
 * forward slash). Anything else is discarded rather than corrected — a login
 * screen that can be talked into redirecting off-site is a phishing primitive.
 */
export function safeNextPath(value: unknown): string | null {
	if (typeof value !== "string" || value.length === 0) return null;
	if (value.length > 512) return null;
	if (!value.startsWith("/")) return null;
	// "//evil.com" and "/\evil.com" are both protocol-relative in practice.
	if (value.startsWith("//") || value.startsWith("/\\")) return null;
	if (value.includes("\\")) return null;
	if (/^\/[^/]*:/.test(value)) return null;
	return value;
}

/** Append `next` to a destination, when there is one worth carrying. */
export function withNext(href: string, next: string | null): string {
	if (!next) return href;
	const sep = href.includes("?") ? "&" : "?";
	return `${href}${sep}next=${encodeURIComponent(next)}`;
}
