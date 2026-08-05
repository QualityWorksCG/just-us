import "server-only";

import { env } from "@just-us/env/server";
import { del, put } from "@vercel/blob";
import sharp from "sharp";

import { isManagedAvatarUrl, profileAvatarBlobPath } from "@/lib/avatar-policy";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_ACCEPTED_TYPES = [
	"image/jpeg",
	"image/png",
	"image/webp",
] as const;

const AVATAR_SOURCE_FORMATS = new Set(["jpeg", "png", "webp"]);

export class AvatarValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AvatarValidationError";
	}
}

/**
 * Profile photos live in the same public Blob store as case images, so a photo
 * is served straight from its Blob URL — no authenticated proxy, no second
 * store, no OIDC. `BLOB_READ_WRITE_TOKEN` is the only credential involved.
 */
function avatarBlobAuth() {
	if (!env.BLOB_READ_WRITE_TOKEN) {
		throw new AvatarValidationError(
			"Profile photo uploads are not configured yet. Please try again later.",
		);
	}
	return { token: env.BLOB_READ_WRITE_TOKEN };
}

/**
 * Normalizes an uploaded image to a small WebP square. Re-encoding verifies the
 * actual bytes rather than trusting the browser-provided MIME type, and strips
 * EXIF and other embedded metadata — which matters more now these are public,
 * since camera EXIF can carry GPS coordinates.
 */
export async function storeAvatar(userId: string, file: File) {
	const blobAuth = avatarBlobAuth();

	if (
		!AVATAR_ACCEPTED_TYPES.includes(
			file.type as (typeof AVATAR_ACCEPTED_TYPES)[number],
		)
	) {
		throw new AvatarValidationError(
			"Choose a JPG, PNG, or WebP image for your profile photo.",
		);
	}

	if (file.size > AVATAR_MAX_BYTES) {
		throw new AvatarValidationError(
			"That image is too large. Choose a JPG, PNG, or WebP under 2 MB.",
		);
	}

	const input = Buffer.from(await file.arrayBuffer());
	let normalized: Buffer;
	try {
		const image = sharp(input, {
			failOn: "error",
			limitInputPixels: 16_000_000,
		});
		const metadata = await image.metadata();
		if (!metadata.format || !AVATAR_SOURCE_FORMATS.has(metadata.format)) {
			throw new AvatarValidationError(
				"Choose a JPG, PNG, or WebP image for your profile photo.",
			);
		}

		normalized = await image
			.rotate()
			.resize(512, 512, { fit: "cover", position: "attention" })
			.webp({ quality: 82 })
			.toBuffer();
	} catch (error) {
		if (error instanceof AvatarValidationError) throw error;
		throw new AvatarValidationError(
			"We could not process that image. Choose a JPG, PNG, or WebP and try again.",
		);
	}

	// `addRandomSuffix` gives every upload its own URL, so a replaced photo is
	// never served from a stale CDN cache and no cache-busting query is needed.
	return put(profileAvatarBlobPath(userId), normalized, {
		access: "public",
		addRandomSuffix: true,
		contentType: "image/webp",
	});
}

/** Blob cleanup is deliberately best-effort; the database remains authoritative. */
export async function deleteAvatar(imageUrl: string | null | undefined) {
	if (!isManagedAvatarUrl(imageUrl)) return;
	await del(imageUrl, avatarBlobAuth());
}
