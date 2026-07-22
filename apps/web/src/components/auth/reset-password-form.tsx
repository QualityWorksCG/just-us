"use client";

import { Button } from "@just-us/ui/components/button";
import { Input } from "@just-us/ui/components/input";
import { cn } from "@just-us/ui/lib/utils";
import { KeyRound, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

import { AuthMiniShell } from "./auth-mini-shell";

const inputClass =
	"h-10 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[14px]";

export function ResetPasswordForm({
	token,
	error,
}: {
	token?: string;
	error?: string;
}) {
	const router = useRouter();
	const pwId = useId();
	const confirmId = useId();
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [fieldError, setFieldError] = useState<string>();
	const [pending, setPending] = useState(false);

	if (!token || error) {
		return (
			<AuthMiniShell
				icon={TriangleAlert}
				tone="danger"
				title="This reset link is invalid"
				description="The link is missing or has expired. Request a new password reset from the sign-in screen."
			>
				<Link
					href="/login?mode=signin"
					className="inline-flex h-10 w-full items-center justify-center rounded-[var(--radius-control)] bg-primary font-medium text-[14px] text-primary-foreground hover:bg-primary/90"
				>
					Back to sign in
				</Link>
			</AuthMiniShell>
		);
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setFieldError(undefined);
		if (password.length < 8) {
			setFieldError("Password must be at least 8 characters");
			return;
		}
		if (!/[0-9!@#$%^&*(),.?":{}|<>]/.test(password)) {
			setFieldError("Include at least one number or symbol");
			return;
		}
		if (password !== confirm) {
			setFieldError("Passwords do not match");
			return;
		}
		setPending(true);
		await authClient.resetPassword(
			{ newPassword: password, token },
			{
				onSuccess: () => {
					toast.success("Password updated. You can sign in now.");
					router.push("/login?mode=signin");
				},
				onError: (ctx) => {
					toast.error(ctx.error.message || "Could not reset your password.");
				},
			},
		);
		setPending(false);
	}

	return (
		<AuthMiniShell
			icon={KeyRound}
			title="Set a new password"
			description="Choose a new password for your account. You'll use it to sign in from now on."
		>
			<form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
				<div className="flex flex-col gap-1.5">
					<label htmlFor={pwId} className="font-semibold text-[13px] text-ink">
						New password
					</label>
					<Input
						id={pwId}
						className={cn(inputClass)}
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Create a password"
						autoComplete="new-password"
						aria-invalid={!!fieldError}
					/>
					<p className="text-[12px] text-muted-foreground">
						At least 8 characters, with one number or symbol.
					</p>
				</div>
				<div className="flex flex-col gap-1.5">
					<label
						htmlFor={confirmId}
						className="font-semibold text-[13px] text-ink"
					>
						Confirm password
					</label>
					<Input
						id={confirmId}
						className={cn(inputClass)}
						type="password"
						value={confirm}
						onChange={(e) => setConfirm(e.target.value)}
						placeholder="Re-enter your password"
						autoComplete="new-password"
						aria-invalid={!!fieldError}
					/>
				</div>
				{fieldError && <p className="text-[12px] text-danger">{fieldError}</p>}
				<Button type="submit" size="lg" className="w-full" disabled={pending}>
					{pending ? "Updating…" : "Update password"}
				</Button>
			</form>
		</AuthMiniShell>
	);
}
