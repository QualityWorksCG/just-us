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
 * plaintiff who filed it, the attorney representing that case, and the attorneys
 * reviewing it toward that decision — one the plaintiff named (while their
 * invitation is open) or one who has expressed interest. A plain browsing attorney
 * who has not engaged is still refused until they put themselves forward.
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

	let upstream: Response;
	try {
		upstream = await fetch(file.url);
	} catch {
		// Blob store unreachable, malformed stored URL, network blip — not the
		// viewer's fault and not a reason to leak a 500. Treated like a missing file.
		return notFound();
	}
	if (!upstream.ok || !upstream.body) return notFound();

	// Streamed rather than buffered: evidence runs to 25MB, and holding one in
	// memory per concurrent reader is a cost with nothing to show for it.
	return new NextResponse(upstream.body, {
		headers: {
			"content-type":
				upstream.headers.get("content-type") ?? "application/octet-stream",
			// Opens in the browser rather than downloading, which is what "view" means
			// for the PDFs and photographs this is nearly always serving.
			"content-disposition": contentDisposition(file.name),
			// Private and unstored: a shared cache must never keep one client's
			// filings, and this response was authorized for exactly one viewer.
			"cache-control": "private, no-store",
			"x-content-type-options": "nosniff",
		},
	});
}

/**
 * A `content-disposition` value that survives any filename (RFC 6266).
 *
 * HTTP header values are Latin-1, so a name with any character beyond it — a
 * macOS screenshot's narrow no-break space (U+202F) before "PM", an accent, CJK —
 * throws when set as a header, which was surfacing as a 500 the moment an attorney
 * opened one. Two params cover every client: a plain-ASCII `filename` fallback
 * (anything non-ASCII or structural replaced with `_`), and the real UTF-8 name in
 * `filename*`, which modern browsers prefer.
 */
function contentDisposition(name: string): string {
	const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
	const utf8 = encodeURIComponent(name).replace(
		/['()*]/g,
		(c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
	);
	return `inline; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

function notFound() {
	return new NextResponse("Not found", { status: 404 });
}
