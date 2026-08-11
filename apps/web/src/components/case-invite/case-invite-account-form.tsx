"use client";

import { Button } from "@just-us/ui/components/button";
import { Input } from "@just-us/ui/components/input";
import { cn } from "@just-us/ui/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { createCaseInviteAccountAction } from "@/app/case-invite/actions";

const inputClass =
	"h-10 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[14px]";

function VisibilityToggle({
	shown,
	onToggle,
}: {
	shown: boolean;
	onToggle: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onToggle}
			aria-label={shown ? "Hide password" : "Show password"}
			aria-pressed={shown}
			className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-ink"
		>
			{shown ? (
				<EyeOff className="size-4" aria-hidden="true" />
			) : (
				<Eye className="size-4" aria-hidden="true" />
			)}
		</button>
	);
}

/**
 * Sign-up for the invited attorney who has no account.
 *
 * The email is fixed to the invited address — that is the only address this
 * link belongs to — and creating the account is not the same as accepting.
 * After this they are signed in and back on the invitation, with onboarding and
 * bar verification still between them and the Confirm button.
 */
export function CaseInviteAccountForm({
	token,
	email,
	suggestedName,
}: {
	token: string;
	email: string;
	suggestedName?: string | null;
}) {
	const nameId = useId();
	const pwId = useId();
	const confirmId = useId();
	const [name, setName] = useState(suggestedName?.trim() ?? "");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
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
		// Success signs them in and redirects back here, so anything returned is a
		// failure.
		const result = await createCaseInviteAccountAction(token, {
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
				<label htmlFor={nameId} className="font-semibold text-[13px] text-ink">
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
				<div className="relative">
					<Input
						id={pwId}
						className={cn(inputClass, "w-full pr-10")}
						type={showPassword ? "text" : "password"}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="Create a password"
						autoComplete="new-password"
						aria-invalid={!!errors.password}
					/>
					<VisibilityToggle
						shown={showPassword}
						onToggle={() => setShowPassword((v) => !v)}
					/>
				</div>
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
				<div className="relative">
					<Input
						id={confirmId}
						className={cn(inputClass, "w-full pr-10")}
						type={showConfirm ? "text" : "password"}
						value={confirm}
						onChange={(e) => setConfirm(e.target.value)}
						placeholder="Re-enter your password"
						autoComplete="new-password"
						aria-invalid={!!errors.password}
					/>
					<VisibilityToggle
						shown={showConfirm}
						onToggle={() => setShowConfirm((v) => !v)}
					/>
				</div>
			</div>
			{errors.password && (
				<p className="text-[12px] text-danger">{errors.password}</p>
			)}
			<Button type="submit" size="lg" className="w-full" disabled={pending}>
				{pending ? "Creating your account…" : "Create attorney account"}
			</Button>
		</form>
	);
}
