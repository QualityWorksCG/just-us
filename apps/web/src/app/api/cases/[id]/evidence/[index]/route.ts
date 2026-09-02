import { caseEvidenceFile } from "@just-us/db/cases";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";

/**
 * Serves one evidence document to someone entitled to read it.
 *
 * Evidence lives in Vercel Blob, which has no private access on the stable SDK —
 * its URL is readable by anyone who holds it, so the URL *is* the credential.
 * That is the whole reason this route exists: the storage URL stays in the
 * database and on the server, and the browser only ever sees this path. Handing
 * out the blob URL instead — even to the right person — would put a permanent,
 * unrevokable, un-authenticated link to a client's filings into a page's HTML.
 *
 * Who may read is decided by `caseEvidenceFile` against the case row: the
 * plaintiff who filed it, and the attorney representing that case. An attorney
 * browsing the representation queue is not included, which is what makes the
 * queue's "documents are shared once you're representing the case" true.
 *
 * Every refusal is a 404, so this says nothing about whether a case or a document
 * exists to someone who isn't entitled to it.
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string; index: string }> },
): Promise<Response> {
	const session = await getSession();
	if (!session?.user) return notFound();

	const { id, index } = await params;
	const at = Number(index);
	if (!Number.isInteger(at) || at < 0) return notFound();

	const file = await caseEvidenceFile({
		caseId: id,
		index: at,
		viewerId: session.user.id,
		viewerEmail: session.user.email,
	});
	if (!file) return notFound();

	const upstream = await fetch(file.url);
	if (!upstream.ok || !upstream.body) return notFound();

	// Streamed rather than buffered: evidence runs to 25MB, and holding one in
	// memory per concurrent reader is a cost with nothing to show for it.
	return new NextResponse(upstream.body, {
		headers: {
			"content-type":
				upstream.headers.get("content-type") ?? "application/octet-stream",
			// Opens in the browser rather than downloading, which is what "view" means
			// for the PDFs and photographs this is nearly always serving. The stored
			// name is quoted and stripped of quotes/newlines so a filename cannot break
			// out of the header.
			"content-disposition": `inline; filename="${file.name.replace(/[\r\n"]/g, "")}"`,
			// Private and unstored: a shared cache must never keep one client's
			// filings, and this response was authorized for exactly one viewer.
			"cache-control": "private, no-store",
			"x-content-type-options": "nosniff",
		},
	});
}

function notFound() {
	return new NextResponse("Not found", { status: 404 });
}
