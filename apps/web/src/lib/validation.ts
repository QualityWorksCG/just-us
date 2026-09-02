/**
 * Shared validators used on both the client (fast feedback) and the server
 * (enforcement). Keep them framework-agnostic so both can import them.
 */

export const BAR_NUMBER_MESSAGE = "Enter a valid bar number (e.g. GA #338114)";

/**
 * Attorney bar numbers vary by jurisdiction, so this is a format sanity check
 * rather than a registry lookup: allow an optional state prefix, "#", spaces,
 * dots and dashes, and require 4–10 digits overall (the range real bar numbers
 * fall in). Registry verification happens later in the attorney review flow.
 */
export function isValidBarNumber(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) return false;
	if (!/^[A-Za-z0-9#\-.\s]+$/.test(trimmed)) return false;
	const digits = trimmed.replace(/\D/g, "");
	return digits.length >= 4 && digits.length <= 10;
}
