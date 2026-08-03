import { getOwnProfile } from "@just-us/db/profile";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { getPrivateAvatar } from "@/lib/private-avatar";

/**
 * Private avatar delivery. Today this is owner-only; the authorization check can
 * be extended for verified conversation participants when messaging lands.
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ userId: string }> },
) {
	const [{ userId }, session] = await Promise.all([params, getSession()]);
	const user = session?.user as
		| { id?: string; emailVerified?: boolean; onboarded?: boolean }
		| undefined;

	// Use a not-found response for every denied request so this endpoint does not
	// reveal whether another user's avatar exists.
	if (
		!user?.id ||
		!user.emailVerified ||
		!user.onboarded ||
		user.id !== userId
	) {
		return new NextResponse(null, { status: 404 });
	}

	try {
		const profile = await getOwnProfile(user.id);
		const avatar = await getPrivateAvatar(profile?.image);
		if (avatar?.statusCode !== 200) {
			return new NextResponse(null, { status: 404 });
		}

		return new NextResponse(avatar.stream, {
			headers: {
				"Content-Type": avatar.blob.contentType,
				"Content-Length": String(avatar.blob.size),
				"Content-Disposition": "inline",
				"Cache-Control": "private, no-store",
				"X-Content-Type-Options": "nosniff",
				Vary: "Cookie",
			},
		});
	} catch {
		return new NextResponse(null, { status: 404 });
	}
}
