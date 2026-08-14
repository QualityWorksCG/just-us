import { listDonations } from "@just-us/db/donations";

import { requireRole } from "@/lib/auth-server";

/**
 * The donor's giving record as CSV.
 *
 * Reads through `listDonations` — the same function the screen renders from — so
 * the file and the table cannot disagree about what was given. Recomputing the
 * figures here, or querying donations a second way, is exactly how an export
 * starts quietly reporting different totals from the page above it.
 *
 * Gated by `requireRole("donor")`, matching the screen. The route returns only
 * the caller's own donations; there is no id parameter to tamper with.
 */
export const runtime = "nodejs";

/** Cents to a plain decimal string — no currency symbol, no thousands separator,
 *  so a spreadsheet reads the column as a number. */
function amount(cents: number): string {
	return (cents / 100).toFixed(2);
}

/**
 * One CSV field, quoted.
 *
 * Every field is quoted rather than only the ones that need it: case titles carry
 * commas, apostrophes and typographic quotes, and a rule that decides per value
 * is a rule that eventually decides wrong. Embedded quotes are doubled, per RFC
 * 4180.
 */
function field(value: string | number | null | undefined): string {
	if (value === null || value === undefined) return '""';
	return `"${String(value).replaceAll('"', '""')}"`;
}

const COLUMNS = [
	"Date",
	"Case",
	"Category",
	"Location",
	"To the case (USD)",
	"Platform fee (USD)",
	"You paid (USD)",
	"Transaction reference",
	"Receipt",
] as const;

export async function GET(): Promise<Response> {
	const { session } = await requireRole("donor");
	const rows = await listDonations(session.user.id);

	const lines = [
		COLUMNS.map(field).join(","),
		...rows.map((d) =>
			[
				// ISO date: sorts correctly as text and is unambiguous across locales,
				// which a spreadsheet's own rendering of "8/12/26" is not.
				field(d.createdAt.toISOString().slice(0, 10)),
				field(d.case.title),
				field(d.case.category),
				field(d.case.location),
				field(amount(d.netCents)),
				field(amount(d.feeCents)),
				field(amount(d.amountCents)),
				// The PaymentIntent id is the reference support can trace a gift by.
				field(d.stripePaymentIntentId),
				field(d.stripeReceiptUrl),
			].join(","),
		),
	];

	// A leading BOM so Excel opens UTF-8 correctly — without it, a donor name or
	// case title containing an accent arrives mojibake'd on Windows.
	const csv = `﻿${lines.join("\r\n")}\r\n`;
	const filename = `justus-donations-${new Date().toISOString().slice(0, 10)}.csv`;

	return new Response(csv, {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="${filename}"`,
			// A giving record is per-account and changes as gifts land; a shared cache
			// serving one donor's file to another would be the worst kind of bug here.
			"Cache-Control": "private, no-store",
		},
	});
}
