/**
 * The US states the platform recognises (JUS-12).
 *
 * One allowlist, two callers with different notions of what a jurisdiction is:
 * the states an attorney is admitted in, held as `AttorneyAdmission` rows (with
 * the primary mirrored on `User.jurisdiction`), and the state a *case* falls
 * under, held on `Case.location` and chosen per case. Both match the stored
 * string exactly — the seeking queue, the browse filters, and every gate that
 * decides whether an attorney may take a case compare one against the other — so
 * the two must keep drawing from this same list.
 *
 * Framework-agnostic and safe to import from client components.
 */

export const JURISDICTION_MESSAGE = "Select at least one state";

export const US_STATES = [
	"Alabama",
	"Alaska",
	"Arizona",
	"Arkansas",
	"California",
	"Colorado",
	"Connecticut",
	"Delaware",
	"Florida",
	"Georgia",
	"Hawaii",
	"Idaho",
	"Illinois",
	"Indiana",
	"Iowa",
	"Kansas",
	"Kentucky",
	"Louisiana",
	"Maine",
	"Maryland",
	"Massachusetts",
	"Michigan",
	"Minnesota",
	"Mississippi",
	"Missouri",
	"Montana",
	"Nebraska",
	"Nevada",
	"New Hampshire",
	"New Jersey",
	"New Mexico",
	"New York",
	"North Carolina",
	"North Dakota",
	"Ohio",
	"Oklahoma",
	"Oregon",
	"Pennsylvania",
	"Rhode Island",
	"South Carolina",
	"South Dakota",
	"Tennessee",
	"Texas",
	"Utah",
	"Vermont",
	"Virginia",
	"Washington",
	"West Virginia",
	"Wisconsin",
	"Wyoming",
] as const;

export type Jurisdiction = (typeof US_STATES)[number];

/**
 * Server-side enforcement that a submitted jurisdiction is one we recognise —
 * the client `Select` constrains the choice, but the action can be called
 * directly.
 */
export function isValidJurisdiction(value: string): value is Jurisdiction {
	return (US_STATES as readonly string[]).includes(value);
}
