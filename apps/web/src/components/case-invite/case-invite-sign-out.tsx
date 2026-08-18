"use client";

import { Button } from "@just-us/ui/components/button";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { type CaseInviteRef, caseInviteHref } from "@/lib/case-invite-ref";

/**
 * Sign out and come straight back to the invitation.
 *
 * The wrong-account dead end is otherwise a real one: the invited attorney is
 * looking at a link they can't use, and the fix — sign out, sign in as someone
 * else, find the email again — is three steps away from the page telling them
 * about it. Landing back here signed out turns it into one, because this page
 * signed out is the "sign in to confirm" screen.
 */
export function SignOutAndReturnButton({ invite }: { invite: CaseInviteRef }) {
	const router = useRouter();
	const [pending, setPending] = useState(false);

	async function signOut() {
		setPending(true);
		await authClient.signOut();
		router.replace(caseInviteHref(invite) as Route);
		router.refresh();
	}

	return (
		<Button
			type="button"
			variant="outline"
			size="lg"
			className="w-full"
			disabled={pending}
			onClick={signOut}
		>
			{pending ? "Signing out…" : "Sign out and use another account"}
		</Button>
	);
}
