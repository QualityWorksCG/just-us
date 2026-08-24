"use server";

import {
	adminSetAdmissionVerification,
	adminSetVerification,
} from "@just-us/db/attorney-profile";
import { blockUser, unblockUser } from "@just-us/db/users";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { guardAdministrator } from "@/lib/auth-server";

export type BlockUserActionResult =
	| { ok: true }
	| { ok: false; error: string; fieldErrors?: Record<string, string> };

const blockSchema = z.object({
	userId: z.string().min(1, "Choose an account to block."),
	reason: z.string().trim().min(5, "Give a reason the audit log can carry."),
	expiresAt: z
		.string()
		.trim()
		.optional()
		.refine((value) => !value || !Number.isNaN(Date.parse(value)), {
			message: "Enter a valid date.",
		})
		.refine((value) => !value || Date.parse(value) > Date.now(), {
			message: "Pick a date in the future.",
		}),
});

export type BlockUserInput = z.infer<typeof blockSchema>;

const BLOCK_ERRORS = {
	not_found: "Couldn't find that account.",
	self_block: "You can't block your own account.",
	already_blocked: "That account is already blocked.",
	last_administrator:
		"This is the last active administrator. The platform can't be left without one.",
} as const;

const UNBLOCK_ERRORS = {
	not_found: "Couldn't find that account.",
	not_blocked: "That account isn't blocked.",
} as const;

/**
 * Block an account. The guard is the enforcement point — a server action is a
 * public endpoint, so administrator status is re-checked here rather than
 * trusted from the screen that rendered the dialog. Session revocation, the
 * audit entry and the last-administrator rule all live in the data layer.
 */
export async function blockUserAction(
	input: BlockUserInput,
): Promise<BlockUserActionResult> {
	const guard = await guardAdministrator();
	if (!guard.ok) return guard;

	const parsed = blockSchema.safeParse(input);
	if (!parsed.success) {
		const fieldErrors: Record<string, string> = {};
		for (const issue of parsed.error.issues) {
			const key = issue.path[0];
			if (typeof key === "string" && !fieldErrors[key])
				fieldErrors[key] = issue.message;
		}
		return {
			ok: false,
			error: "Please fix the highlighted fields.",
			fieldErrors,
		};
	}

	try {
		const res = await blockUser(
			guard.userId,
			parsed.data.userId,
			parsed.data.reason,
			parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
		);
		if (!res.ok) return { ok: false, error: BLOCK_ERRORS[res.code] };
	} catch {
		return {
			ok: false,
			error: "Couldn't block that account. Please try again.",
		};
	}

	revalidatePath("/users");
	return { ok: true };
}

const verifySchema = z
	.object({
		userId: z.string().min(1, "Choose an attorney to verify."),
		verified: z.boolean(),
		note: z.string().trim().max(300).optional(),
	})
	.strict();

export type SetVerificationInput = z.infer<typeof verifySchema>;

/**
 * Manually set an attorney's bar-standing badge (JUS-13). Administrator-only,
 * re-checked here because a server action is a public endpoint. The evidence
 * row, the badge, and the audit entry are written together in the data layer.
 */
export async function setAttorneyVerificationAction(
	input: SetVerificationInput,
): Promise<BlockUserActionResult> {
	const guard = await guardAdministrator();
	if (!guard.ok) return guard;

	const parsed = verifySchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "Couldn't update verification." };
	}

	try {
		const res = await adminSetVerification(
			parsed.data.userId,
			guard.userId,
			parsed.data.verified ? "verified" : "unverified",
			parsed.data.note,
		);
		if (!res.ok) {
			return { ok: false, error: "That account isn't an attorney." };
		}
	} catch {
		return {
			ok: false,
			error: "Couldn't update verification. Please try again.",
		};
	}

	revalidatePath(`/users/${parsed.data.userId}` as Route);
	revalidatePath("/users");
	return { ok: true };
}

const verifyAdmissionSchema = z
	.object({
		userId: z.string().min(1, "Choose an attorney."),
		state: z.string().trim().min(1, "Choose a state."),
		verified: z.boolean(),
		note: z.string().trim().max(300).optional(),
	})
	.strict();

export type SetAdmissionVerificationInput = z.infer<
	typeof verifyAdmissionSchema
>;

/**
 * Verify (or clear) one state an attorney claims. Attorneys practise across
 * jurisdictions, so when an automatic bar scan can't clear a state, an admin
 * rules on it here — per state, not for the whole account. The data layer records
 * the check against that admission and recomputes the account's overall badge.
 */
export async function setAdmissionVerificationAction(
	input: SetAdmissionVerificationInput,
): Promise<BlockUserActionResult> {
	const guard = await guardAdministrator();
	if (!guard.ok) return guard;

	const parsed = verifyAdmissionSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false, error: "Couldn't update that jurisdiction." };
	}

	try {
		const res = await adminSetAdmissionVerification(
			parsed.data.userId,
			guard.userId,
			parsed.data.state,
			parsed.data.verified ? "verified" : "unverified",
			parsed.data.note,
		);
		if (!res.ok) {
			return { ok: false, error: "That account isn't an attorney." };
		}
	} catch {
		return {
			ok: false,
			error: "Couldn't update that jurisdiction. Please try again.",
		};
	}

	revalidatePath(`/users/${parsed.data.userId}` as Route);
	revalidatePath("/users");
	return { ok: true };
}

export async function unblockUserAction(
	userId: string,
): Promise<BlockUserActionResult> {
	const guard = await guardAdministrator();
	if (!guard.ok) return guard;

	const parsed = z.string().min(1).safeParse(userId);
	if (!parsed.success) {
		return { ok: false, error: "Couldn't find that account." };
	}

	try {
		const res = await unblockUser(guard.userId, parsed.data);
		if (!res.ok) return { ok: false, error: UNBLOCK_ERRORS[res.code] };
	} catch {
		return {
			ok: false,
			error: "Couldn't unblock that account. Please try again.",
		};
	}

	revalidatePath("/users");
	return { ok: true };
}
