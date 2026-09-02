"use client";

import { Button } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

import { AuthMiniShell } from "./auth-mini-shell";

export function VerifyEmailPrompt({
	email,
	signedIn,
	next,
}: {
	email?: string;
	signedIn: boolean;
	/** Where the verification link should land them. Already validated as a
	 *  same-site path by the page. */
	next?: string | null;
}) {
	const router = useRouter();
	const [pending, setPending] = useState(false);

	async function resend() {
		if (!email) return;
		setPending(true);
		await authClient.sendVerificationEmail(
			{ email, callbackURL: next ?? "/home" },
			{
				onSuccess: () => {
					toast.success("Verification email sent.");
				},
				onError: (ctx) => {
					toast.error(ctx.error.message || "Could not send the email.");
				},
			},
		);
		setPending(false);
	}

	async function signOut() {
		await authClient.signOut();
		router.push("/login?mode=signin");
	}

	return (
		<AuthMiniShell
			icon={MailCheck}
			title="Verify your email"
			description={
				email
					? `We sent a verification link to ${email}. Click it to activate your account. You can't use role features until your email is confirmed.`
					: "We sent you a verification link. Click it to activate your account. If you haven't received it, sign in to resend."
			}
		>
			<div className="flex flex-col gap-2.5">
				{/* Resend needs the address, not a session — someone whose sign-in was
				    blocked on verification arrives here signed out and still has to be
				    able to ask for another link. */}
				{email ? (
					<Button
						type="button"
						size="lg"
						className="w-full"
						onClick={resend}
						disabled={pending}
					>
						{pending ? "Sending…" : "Resend verification email"}
					</Button>
				) : null}
				{signedIn ? (
					<Button
						type="button"
						variant="ghost"
						size="lg"
						className="w-full"
						onClick={signOut}
					>
						Sign out
					</Button>
				) : (
					<Link
						href="/login?mode=signin"
						className={cn(
							"inline-flex h-11 w-full items-center justify-center rounded-[var(--radius-control)] font-medium text-[14px]",
							// Secondary once resend is the primary action above it.
							email
								? "text-ink hover:bg-surface-2"
								: "bg-primary text-primary-foreground hover:bg-primary/90",
						)}
					>
						Back to sign in
					</Link>
				)}
			</div>
		</AuthMiniShell>
	);
}
