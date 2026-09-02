"use client";

import { Button } from "@just-us/ui/components/button";
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
}: {
	email?: string;
	signedIn: boolean;
}) {
	const router = useRouter();
	const [pending, setPending] = useState(false);

	async function resend() {
		if (!email) return;
		setPending(true);
		await authClient.sendVerificationEmail(
			{ email, callbackURL: "/dashboard" },
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
					? `We sent a verification link to ${email}. Click it to activate your account — you can't use role features until your email is confirmed.`
					: "We sent you a verification link. Click it to activate your account. If you haven't received it, sign in to resend."
			}
		>
			<div className="flex flex-col gap-2.5">
				{signedIn && email ? (
					<>
						<Button
							type="button"
							size="lg"
							className="w-full"
							onClick={resend}
							disabled={pending}
						>
							{pending ? "Sending…" : "Resend verification email"}
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="lg"
							className="w-full"
							onClick={signOut}
						>
							Sign out
						</Button>
					</>
				) : (
					<Link
						href="/login?mode=signin"
						className="inline-flex h-11 w-full items-center justify-center rounded-[var(--radius-control)] bg-primary font-medium text-[14px] text-primary-foreground hover:bg-primary/90"
					>
						Go to sign in
					</Link>
				)}
			</div>
		</AuthMiniShell>
	);
}
