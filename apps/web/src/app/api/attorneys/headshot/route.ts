import type { HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { getRole } from "@/lib/auth-server";

// Authorizes browser -> Vercel Blob uploads for attorney headshots, mirroring
// the case-image route: the browser calls `upload()` (from @vercel/blob/client)
// pointing here and we mint a short-lived, scoped token only for signed-in
// attorneys. BLOB_READ_WRITE_TOKEN never leaves the server.
export async function POST(request: Request): Promise<NextResponse> {
	const body = (await request.json()) as HandleUploadBody;
	try {
		// Loading the Blob server helper at request time avoids evaluating its
		// Vercel CLI/OIDC dependency while Next is collecting build metadata.
		const { handleUpload } = await import("@vercel/blob/client");
		const result = await handleUpload({
			body,
			request,
			onBeforeGenerateToken: async () => {
				const role = await getRole();
				if (role !== "attorney") {
					throw new Error("Only attorneys can upload a headshot.");
				}
				return {
					// A headshot is a photo, not a graphic — no GIF.
					allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
					maximumSizeInBytes: 4 * 1024 * 1024,
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
