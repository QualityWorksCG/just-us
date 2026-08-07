import type { HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { getRole } from "@/lib/auth-server";

// Authorizes browser -> Vercel Blob uploads for case-update attachments (JUS-33).
// The two people who can post updates — the plaintiff and the attorney — can
// attach images or a PDF. The scoped token is minted server-side; the case-level
// "is this your case" check happens when the update itself is posted.
export async function POST(request: Request): Promise<NextResponse> {
	const body = (await request.json()) as HandleUploadBody;
	try {
		const { handleUpload } = await import("@vercel/blob/client");
		const result = await handleUpload({
			body,
			request,
			onBeforeGenerateToken: async () => {
				const role = await getRole();
				if (role !== "plaintiff" && role !== "attorney") {
					throw new Error(
						"Only a case's plaintiff or attorney can attach files.",
					);
				}
				return {
					allowedContentTypes: [
						"image/jpeg",
						"image/png",
						"image/webp",
						"image/gif",
						"application/pdf",
					],
					maximumSizeInBytes: 10 * 1024 * 1024,
					addRandomSuffix: true,
				};
			},
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
