"use client";

import { Button } from "@just-us/ui/components/button";
import { Checkbox } from "@just-us/ui/components/checkbox";
import { Input } from "@just-us/ui/components/input";
import { cn } from "@just-us/ui/lib/utils";
import {
	ArrowRight,
	Check,
	ChevronLeft,
	Lock,
	Mail,
	TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { signUpAction } from "@/app/login/actions";
import { Brandmark } from "@/components/brandmark";
import { authClient } from "@/lib/auth-client";

type Mode = "create" | "signin";

const BULLETS = [
	"A person vets every case before it goes public",
	"You choose your own attorney",
	"One transparent 5% fee — we never hold the money",
];

function Field({
	label,
	htmlFor,
	required,
	hint,
	error,
	children,
}: {
	label: string;
	htmlFor: string;
	required?: boolean;
	hint?: string;
	error?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={htmlFor} className="font-semibold text-[13px] text-ink">
				{label}
				{required && <span className="ml-0.5 text-danger">*</span>}
			</label>
			{children}
			{error ? (
				<p className="text-[12px] text-danger">{error}</p>
			) : hint ? (
				<p className="text-[12px] text-muted-foreground leading-snug">{hint}</p>
			) : null}
		</div>
	);
}

const MAGIC_LINK_ERRORS: Record<string, string> = {
	new_user_signup_disabled:
		"No account found for that email. Create an account first, then use the magic link to sign in.",
	INVALID_TOKEN: "That sign-in link is invalid. Request a new one.",
	EXPIRED_TOKEN: "That sign-in link has expired. Request a new one.",
	ATTEMPTS_EXCEEDED: "That sign-in link was already used. Request a new one.",
};

export function AuthScreen({
	initialMode = "signin",
	initialError,
}: {
	initialMode?: Mode;
	initialError?: string;
}) {
	const router = useRouter();
	const ids = {
		name: useId(),
		email: useId(),
		password: useId(),
		confirm: useId(),
		agree: useId(),
		siEmail: useId(),
		siPassword: useId(),
	};

	const [mode, setMode] = useState<Mode>(initialMode);
	const [pending, setPending] = useState(false);

	// Surface a magic-link verification error redirected back to /login.
	useEffect(() => {
		if (initialError) {
			toast.error(
				MAGIC_LINK_ERRORS[initialError] ??
					"That sign-in link could not be used. Request a new one.",
			);
		}
	}, [initialError]);

	// Create-account form state
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [agree, setAgree] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Sign-in form state
	const [siEmail, setSiEmail] = useState("");
	const [siPassword, setSiPassword] = useState("");

	const inputClass =
		"h-10 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[14px]";

	function resetErrors() {
		setErrors({});
	}

	async function handleCreate(e: React.FormEvent) {
		e.preventDefault();
		resetErrors();

		// Client-side pre-validation for fast feedback (server re-validates).
		const next: Record<string, string> = {};
		if (name.trim().length < 2) next.name = "Please enter your full name";
		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
			next.email = "Enter a valid email address";
		if (password.length < 8)
			next.password = "Password must be at least 8 characters";
		else if (!/[0-9!@#$%^&*(),.?":{}|<>]/.test(password))
			next.password = "Include at least one number or symbol";
		if (confirm !== password) next.confirm = "Passwords do not match";
		if (!agree) next.agree = "Please accept the terms to continue";
		if (Object.keys(next).length) {
			setErrors(next);
			return;
		}

		setPending(true);
		try {
			const result = await signUpAction({
				name: name.trim(),
				email: email.trim(),
				password,
			});
			if (result.ok) {
				toast.success(
					"Account created. Check your email to verify your address.",
				);
				setMode("signin");
				setSiEmail(email.trim());
			} else {
				if (result.fieldErrors) setErrors(result.fieldErrors);
				toast.error(result.error);
			}
		} catch {
			toast.error("Something went wrong. Please try again.");
		} finally {
			setPending(false);
		}
	}

	async function handleSignIn(e: React.FormEvent) {
		e.preventDefault();
		setPending(true);
		await authClient.signIn.email(
			{
				email: siEmail.trim(),
				password: siPassword,
				callbackURL: "/dashboard",
			},
			{
				onSuccess: () => {
					toast.success("Signed in");
					router.push("/dashboard");
				},
				onError: (ctx) => {
					const msg = ctx.error.message || ctx.error.statusText;
					if (ctx.error.status === 403) {
						toast.error(msg || "Please verify your email to sign in.");
						router.push("/verify-email");
					} else {
						toast.error(msg || "Could not sign in.");
					}
				},
			},
		);
		setPending(false);
	}

	async function handleMagicLink() {
		const target = (mode === "signin" ? siEmail : email).trim();
		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) {
			toast.error("Enter your email above, then request a link.");
			return;
		}
		setPending(true);
		await authClient.signIn.magicLink(
			{
				email: target,
				callbackURL: "/dashboard",
				errorCallbackURL: "/login?mode=signin",
			},
			{
				onSuccess: () => {
					toast.success("Check your email for a one-time sign-in link.");
				},
				onError: (ctx) => {
					toast.error(ctx.error.message || "Could not send the link.");
				},
			},
		);
		setPending(false);
	}

	async function handleForgot() {
		const target = siEmail.trim();
		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) {
			toast.error("Enter your email above first.");
			return;
		}
		setPending(true);
		await authClient.requestPasswordReset(
			{ email: target, redirectTo: "/reset-password" },
			{
				onSuccess: () => {
					toast.success("If that email exists, a reset link is on its way.");
				},
				onError: (ctx) => {
					toast.error(ctx.error.message || "Could not send a reset link.");
				},
			},
		);
		setPending(false);
	}

	return (
		<div className="grid min-h-svh grid-cols-1 overflow-y-auto bg-paper lg:grid-cols-2">
			{/* Left — brand panel */}
			<aside className="relative hidden flex-col justify-center overflow-hidden bg-[radial-gradient(900px_600px_at_82%_-8%,color-mix(in_oklch,var(--brass)_30%,transparent),transparent_62%),radial-gradient(700px_520px_at_-8%_108%,color-mix(in_oklch,var(--brass)_16%,transparent),transparent_58%),linear-gradient(158deg,color-mix(in_oklch,var(--ink)_94%,var(--brass-deep)),color-mix(in_oklch,var(--ink)_62%,var(--brass-deep))_58%,color-mix(in_oklch,var(--ink)_42%,var(--brass-deep)))] px-8 py-12 text-paper lg:flex xl:px-14">
				<div className="mx-auto flex min-h-0 w-full max-w-[520px] flex-col">
					<Link
						href="/"
						className="mb-8 inline-flex items-center gap-1.5 self-start font-bold text-[13px] text-paper/60 transition-colors hover:text-paper/95"
					>
						<ChevronLeft className="size-4" aria-hidden="true" />
						Back to home
					</Link>
					<div className="mb-9 flex items-center gap-3">
						<Link href="/" className="flex items-center gap-3">
							<Brandmark size={32} />
							<span className="leading-none">
								<span className="block font-bold text-[15px] text-paper/95 tracking-tight">
									JustUs Financial
								</span>
								<span className="mt-1 block font-mono text-[10px] text-paper/50 uppercase tracking-[0.14em]">
									Justice, crowdfunded
								</span>
							</span>
						</Link>
					</div>

					<h1 className="mb-3 font-extrabold text-[clamp(1.875rem,2.6vw,2.375rem)] leading-[1.1] tracking-[-0.025em]">
						Justice shouldn't depend on what's in your pocket.
					</h1>
					<p className="mb-6 max-w-[440px] text-[15px] text-paper/70 leading-relaxed">
						Create your account to submit a case, fund one, or take one on. You
						choose how you're joining right after you sign in.
					</p>
					<ul className="flex flex-col gap-2.5">
						{BULLETS.map((b) => (
							<li
								key={b}
								className="flex items-center gap-2.5 font-semibold text-[14px]"
							>
								<Check
									className="size-4 shrink-0 text-brass"
									aria-hidden="true"
								/>
								{b}
							</li>
						))}
					</ul>

					<div className="mt-8 flex-1" />

					<figure className="rounded-[16px] border border-paper/15 bg-paper/[0.08] p-6 backdrop-blur-sm">
						<blockquote className="mb-3.5 font-semibold text-[15px] italic leading-relaxed">
							“I never thought I could afford to fight back. My fee was funded
							in three weeks.”
						</blockquote>
						<figcaption className="flex flex-wrap items-baseline gap-2.5">
							<span className="font-extrabold text-[13.5px]">
								Denise Okafor
							</span>
							<span className="text-[12px] text-paper/55">
								Plaintiff · Georgia
							</span>
						</figcaption>
						<p className="mt-3 flex items-center gap-2 font-bold text-[12.5px] text-brass">
							<TrendingUp className="size-3.5" aria-hidden="true" />
							$9,800 raised · 84 donors
						</p>
					</figure>

					<p className="mt-6 flex gap-2.5 text-[12px] text-paper/50 leading-relaxed">
						<Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
						<span>
							Your sign-in is protected — passwords are encrypted, sessions use
							secure cookies, and every account confirms its email before it
							goes active.
						</span>
					</p>
				</div>
			</aside>

			{/* Right — form card */}
			<main className="flex items-center justify-center px-5 py-10 sm:px-8">
				<div className="w-full max-w-[480px] rounded-[var(--radius-modal)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)] sm:p-8">
					{/* mobile brand */}
					<Link href="/" className="mb-6 flex items-center gap-2.5 lg:hidden">
						<Brandmark size={28} />
						<span className="font-bold text-[15px] tracking-tight">JustUs</span>
					</Link>

					{/* Create / Sign in toggle */}
					<div className="mb-6 grid grid-cols-2 gap-1 rounded-[11px] bg-surface-2 p-1">
						{(["signin", "create"] as const).map((m) => (
							<button
								key={m}
								type="button"
								onClick={() => {
									setMode(m);
									resetErrors();
								}}
								className={cn(
									"rounded-[8px] py-2 font-bold text-[13.5px] transition-all",
									mode === m
										? "bg-surface text-ink shadow-[var(--shadow-rest)]"
										: "text-muted-foreground hover:text-ink-soft",
								)}
								aria-pressed={mode === m}
							>
								{m === "create" ? "Create account" : "Sign in"}
							</button>
						))}
					</div>

					{mode === "create" ? (
						<form
							onSubmit={handleCreate}
							className="flex flex-col gap-4"
							noValidate
						>
							<Field
								label="Full name"
								htmlFor={ids.name}
								required
								error={errors.name}
							>
								<Input
									id={ids.name}
									className={inputClass}
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="Denise Okafor"
									autoComplete="name"
									aria-invalid={!!errors.name}
								/>
							</Field>
							<Field
								label="Email"
								htmlFor={ids.email}
								required
								error={errors.email}
							>
								<Input
									id={ids.email}
									className={inputClass}
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="you@example.com"
									autoComplete="email"
									aria-invalid={!!errors.email}
								/>
							</Field>
							<Field
								label="Password"
								htmlFor={ids.password}
								required
								hint="At least 8 characters, with one number or symbol."
								error={errors.password}
							>
								<Input
									id={ids.password}
									className={inputClass}
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									placeholder="Create a password"
									autoComplete="new-password"
									aria-invalid={!!errors.password}
								/>
							</Field>
							<Field
								label="Confirm password"
								htmlFor={ids.confirm}
								required
								error={errors.confirm}
							>
								<Input
									id={ids.confirm}
									className={inputClass}
									type="password"
									value={confirm}
									onChange={(e) => setConfirm(e.target.value)}
									placeholder="Re-enter your password"
									autoComplete="new-password"
									aria-invalid={!!errors.confirm}
								/>
							</Field>

							<label
								htmlFor={ids.agree}
								className="flex cursor-pointer select-none items-start gap-2.5"
							>
								<Checkbox
									id={ids.agree}
									checked={agree}
									onCheckedChange={(v) => setAgree(v === true)}
									className="mt-0.5"
									aria-invalid={!!errors.agree}
								/>
								<span className="text-[13px] text-ink-soft leading-snug">
									I agree to the{" "}
									<Link
										href="/terms"
										target="_blank"
										rel="noreferrer"
										onClick={(e) => e.stopPropagation()}
										className="font-semibold text-brass-deep hover:underline"
									>
										Terms of Service
									</Link>{" "}
									and{" "}
									<Link
										href="/privacy"
										target="_blank"
										rel="noreferrer"
										onClick={(e) => e.stopPropagation()}
										className="font-semibold text-brass-deep hover:underline"
									>
										Privacy Policy
									</Link>
									, and understand donations are gifts — they carry no financial
									return and no share of any settlement.
								</span>
							</label>
							{errors.agree && (
								<p className="-mt-2 text-[12px] text-danger">{errors.agree}</p>
							)}

							<Button
								type="submit"
								size="lg"
								className="mt-1 w-full"
								disabled={pending}
							>
								{pending ? "Creating account…" : "Create account"}
								{!pending && (
									<ArrowRight data-icon="inline-end" aria-hidden="true" />
								)}
							</Button>
						</form>
					) : (
						<form
							onSubmit={handleSignIn}
							className="flex flex-col gap-4"
							noValidate
						>
							<Field label="Email" htmlFor={ids.siEmail} required>
								<Input
									id={ids.siEmail}
									className={inputClass}
									type="email"
									value={siEmail}
									onChange={(e) => setSiEmail(e.target.value)}
									placeholder="you@example.com"
									autoComplete="email"
								/>
							</Field>
							<Field label="Password" htmlFor={ids.siPassword} required>
								<Input
									id={ids.siPassword}
									className={inputClass}
									type="password"
									value={siPassword}
									onChange={(e) => setSiPassword(e.target.value)}
									placeholder="••••••••"
									autoComplete="current-password"
								/>
							</Field>
							<button
								type="button"
								onClick={handleForgot}
								className="w-max font-semibold text-[12.5px] text-brass-deep hover:underline"
							>
								Forgot password?
							</button>
							<Button
								type="submit"
								size="lg"
								className="w-full"
								disabled={pending}
							>
								{pending ? "Signing in…" : "Sign in"}
								{!pending && (
									<ArrowRight data-icon="inline-end" aria-hidden="true" />
								)}
							</Button>
						</form>
					)}

					{/* Magic link is a returning-user convenience — sign-in only. On
						sign-up it would bypass the password and skip the name. */}
					{mode === "signin" && (
						<>
							<div className="my-6 flex items-center gap-3.5">
								<span className="h-px flex-1 bg-border" />
								<span className="text-[12px] text-muted-foreground">or</span>
								<span className="h-px flex-1 bg-border" />
							</div>

							<Button
								type="button"
								variant="outline"
								size="lg"
								className="w-full"
								onClick={handleMagicLink}
								disabled={pending}
							>
								<Mail data-icon="inline-start" aria-hidden="true" />
								Email me a one-time sign-in link
							</Button>
						</>
					)}

					<p className="mt-6 text-center text-[12px] text-muted-foreground leading-relaxed">
						By continuing you agree to our{" "}
						<Link
							href="/terms"
							target="_blank"
							rel="noreferrer"
							className="text-brass-deep hover:underline"
						>
							Terms of Service
						</Link>{" "}
						and{" "}
						<Link
							href="/privacy"
							target="_blank"
							rel="noreferrer"
							className="text-brass-deep hover:underline"
						>
							Privacy Policy
						</Link>
						.
					</p>
				</div>
			</main>
		</div>
	);
}
