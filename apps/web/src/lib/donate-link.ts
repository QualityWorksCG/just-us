import type { Route } from "next";

/**
 * Where a donation starts.
 *
 * Only one screen takes an amount — the case page's donate panel
 * (`PublicCaseActions`), because that panel is where the fee is shown to the cent
 * before confirming, which the landing page and terms §4 both promise. Every other
 * "Back this case" button in the app — the donor cards on Discover, Saved and the
 * dashboard, and the updates page's support card — links at that panel instead of
 * growing its own amount picker, so there is a single place the promise has to
 * hold and a single place the server action is called from.
 *
 * A plain module rather than an export from the client component, so server
 * components can build these links without crossing the client boundary.
 */
export const DONATE_ANCHOR = "back-this-case";

/** The case page's donate panel — `casePath` is `/cases/[id]` or `/discover/[id]`,
 *  query string and all. */
export function donateHref(casePath: string): Route {
	return `${casePath}#${DONATE_ANCHOR}` as Route;
}
