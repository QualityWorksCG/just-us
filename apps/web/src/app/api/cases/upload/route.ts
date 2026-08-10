import type { HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { getRole } from "@/lib/auth-server";

// Authorizes browser -> Vercel Blob uploads for case images and evidence. The
// browser calls `upload()` (from @vercel/blob/client) pointing here; we mint a
// short-lived, scoped token only for signed-in plaintiffs. The token itself
// (BLOB_READ_WRITE_TOKEN) never leaves the server.
//
// Two kinds of upload, told apart by the `clientPayload` the wizard sends, because
// they have different limits and different content types — a 25MB PDF has no
// business being accepted as a cover image, and an 8MB cap would refuse the
// filings evidence is mostly made of.
//
// **Evidence blobs are public-by-URL.** Vercel Blob has no private access on the
// stable SDK, so the unguessable URL is the only thing protecting a document. That
// is why the URL is stored server-side and never sent to a browser: evidence is
// read through `/api/cases/[id]/evidence/[index]`, which checks who is asking. A
// random suffix is what keeps the URL unguessable, so it is not optional here.
const EVIDENCE_TYPES = [
	"application/pdf",
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/heic",
];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: Request): Promise<NextResponse> {
	const body = (await request.json()) as HandleUploadBody;
	try {
		// Loading the Blob server helper at request time avoids evaluating its
		// Vercel CLI/OIDC dependency while Next is collecting build metadata.
		const { handleUpload } = await import("@vercel/blob/client");
		const result = await handleUpload({
			body,
			request,
			onBeforeGenerateToken: async (_pathname, clientPayload) => {
				const role = await getRole();
				if (role !== "plaintiff") {
					throw new Error("Only plaintiffs can upload to a case.");
				}
				const isEvidence = clientPayload === "evidence";
				return {
					allowedContentTypes: isEvidence ? EVIDENCE_TYPES : IMAGE_TYPES,
					maximumSizeInBytes: (isEvidence ? 25 : 8) * 1024 * 1024,
					addRandomSuffix: true,
				};
			},
			// Fires on Vercel after upload; a no-op here since the browser already
			// has the URL. (Won't fire on localhost, which is fine.)
			onUploadCompleted: async () => {},
		});
		return NextResponse.json(result);
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Upload failed." },
			{ status: 400 },
		);
	}
}
