"use client";

import { Button } from "@just-us/ui/components/button";
import { Input } from "@just-us/ui/components/input";
import { cn } from "@just-us/ui/lib/utils";
import { ShieldCheck } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { acceptInviteAction } from "@/app/accept-invite/actions";

import { AuthMiniShell } from "./auth-mini-shell";

const inputClass =
	"h-10 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[14px]";

export function AcceptInviteForm({
	token,
	email,
}: {
	token: string;
	email: string;
}) {
	const nameId = useId();
	const pwId = useId();
	const confirmId = useId();
	const [name, setName] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [pending, setPending] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setErrors({});
		if (name.trim().length < 2) {
			setErrors({ name: "Please enter your full name" });
			return;
		}
		if (password.length < 8) {
			setErrors({ password: "Password must be at least 8 characters" });
			return;
		}
		if (!/[0-9!@#$%^&*(),.?":{}|<>]/.test(password)) {
			setErrors({ password: "Include at least one number or symbol" });
			return;
		}
		if (password !== confirm) {
			setErrors({ password: "Passwords do not match" });
			return;
		}

		setPending(true);
		// A successful accept redirects from the server action, so anything that
		// comes back is a failure.
		const result = await acceptInviteAction(token, {
			name: name.trim(),
			password,
		});
		if (!result.ok) {
			if (result.fieldErrors) setErrors(result.fieldErrors);
			toast.error(result.error);
			setPending(false);
		}
	}

	return (
		<AuthMiniShell
			icon={ShieldCheck}
			title="Accept your invitation"
			description="Set your name and a password to finish creating your administrator account."
		>
			<form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
				<div className="flex flex-col gap-1.5">
					<span className="font-semibold text-[13px] text-ink">Email</span>
					<p className="flex h-10 items-center rounded-[var(--radius-control)] border border-line-strong bg-paper px-3 text-[14px] text-ink-soft">
						{email}
					</p>
					<p className="text-[12px] text-muted-foreground">
						Your account is created for the address the invitation was sent to.
					</p>
				</div>
				<div className="flex flex-col gap-1.5">
					<label
						htmlFor={nameId}
						className="font-semibold text-[13px] text-ink"
					>
						Full name
					</label>
					<Input
						id={nameId}
						className={cn(inputClass)}
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Jane Rivera"
						autoComplete="name"
						aria-invalid={!!errors.name}
					/>
					{errors.name && (
						<p className="text-[12px] text-danger">{errors.name}</p>
					)}
				</div>
				<div className="flex flex-col gap-1.5">
					<label htmlFor={pwId} className="font-semibold text-[13px] text-ink">
						Password
					</label>
					<Input
						id={pwId}
						className={cn(inputClass)}
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Create a password"
						autoComplete="new-password"
						aria-invalid={!!errors.password}
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
						aria-invalid={!!errors.password}
					/>
				</div>
				{errors.password && (
					<p className="text-[12px] text-danger">{errors.password}</p>
				)}
				<Button type="submit" size="lg" className="w-full" disabled={pending}>
					{pending ? "Creating your account…" : "Accept invitation"}
				</Button>
			</form>
		</AuthMiniShell>
	);
}
