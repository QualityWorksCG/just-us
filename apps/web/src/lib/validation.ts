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

export const PHONE_MESSAGE = "Enter a 10-digit phone number";

/** Digits only, capped at 10 — US numbers, matching the platform's US-only
 *  scope (see @just-us/auth/jurisdiction). */
export function phoneDigits(value: string): string {
	const digits = value.replace(/\D/g, "");
	// Drop a US country code before capping. Pasting "+1 (404) 555-0142" would
	// otherwise read the 1 as the first digit of the area code and shift the
	// whole number along. Safe to assume: no US area code starts with 1, so an
	// 11-digit value leading with 1 is always country-code-prefixed.
	const national =
		digits.length > 10 && digits.startsWith("1") ? digits.slice(1) : digits;
	return national.slice(0, 10);
}

/**
 * Progressive display mask: 404 → (404) 555 → (404) 555-0142.
 *
 * Brackets only appear from the fourth digit, so a three-digit number never
 * renders as "(404) " with a trailing separator the user then can't backspace
 * past.
 */
export function formatPhone(value: string): string {
	const d = phoneDigits(value);
	if (d.length <= 3) return d;
	if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
	return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/**
 * Re-mask after an edit, keeping deletion workable: if the text got shorter but
 * the digits didn't change, the user backspaced over a separator — so drop a
 * digit with it, otherwise the mask reinstates the separator and the caret is
 * stuck.
 */
export function reformatPhone(next: string, previous: string): string {
	const nextDigits = phoneDigits(next);
	const deletedSeparator =
		next.length < previous.length && nextDigits === phoneDigits(previous);
	return formatPhone(deletedSeparator ? nextDigits.slice(0, -1) : nextDigits);
}

/** A complete 10-digit number. Blank is handled by the caller — the field is
 *  optional, so "empty" and "invalid" are different answers. */
export function isValidPhone(value: string): boolean {
	return phoneDigits(value).length === 10;
}
