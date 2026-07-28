/**
 * Jurisdictions a user can sign up under (JUS-12).
 *
 * Framework-agnostic and safe to import from client components. Lives beside
 * `JURISDICTION_ROLES` in `rbac` because the two are one policy: which roles must
 * supply a jurisdiction, and which values count as one. Downstream consumers
 * (attorney availability, charitable-solicitation flags) match the stored string
 * exactly, so the allowlist is the contract.
 */

export const JURISDICTION_MESSAGE = "Select your state";

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
