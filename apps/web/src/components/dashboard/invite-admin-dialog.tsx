"use client";

import { Button } from "@just-us/ui/components/button";
import { Input } from "@just-us/ui/components/input";
import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { inviteAdminAction } from "@/app/(app)/users/invite-actions";

export function InviteAdminDialog() {
	const router = useRouter();
	const ids = { title: useId(), email: useId() };
	const [open, setOpen] = useState(false);
	const [email, setEmail] = useState("");
	const [pending, startTransition] = useTransition();

	// Close on Escape (unless the invitation is in flight).
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !pending) setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, pending]);

	function sendInvite() {
		startTransition(async () => {
			const res = await inviteAdminAction(email);
			if (res.ok) {
				toast.success("Invitation sent.");
				setOpen(false);
				setEmail("");
				router.refresh();
			} else {
				toast.error(res.error);
			}
		});
	}

	return (
		<>
			<Button size="lg" className="px-5" onClick={() => setOpen(true)}>
				<UserPlus data-icon="inline-start" aria-hidden="true" />
				Invite administrator
			</Button>

			{open && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<button
						type="button"
						aria-label="Cancel"
						disabled={pending}
						onClick={() => setOpen(false)}
						className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
					/>
					<div
						role="dialog"
						aria-modal="true"
						aria-labelledby={ids.title}
						className="relative w-full max-w-[440px] rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-modal)]"
					>
						<div className="mb-3 flex size-11 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
							<UserPlus className="size-5" aria-hidden="true" />
						</div>
						<h2 id={ids.title} className="font-bold text-[17px] text-ink">
							Invite an administrator
						</h2>
						<p className="mt-1.5 text-[13.5px] text-ink-soft leading-relaxed">
							They'll set their own name and password when they accept.
						</p>

						<form
							onSubmit={(e) => {
								e.preventDefault();
								sendInvite();
							}}
							className="mt-5 flex flex-col gap-1.5"
						>
							<label
								htmlFor={ids.email}
								className="font-semibold text-[13px] text-ink"
							>
								Email
								<span className="ml-0.5 text-danger">*</span>
							</label>
							<Input
								id={ids.email}
								type="email"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="name@example.com"
								className="h-10 rounded-[var(--radius-control)] border-line-strong px-3 text-[14px]"
							/>
							<p className="text-[12px] text-muted-foreground leading-snug">
								They'll get a link that expires in 7 days.
							</p>

							<div className="mt-4 flex justify-end gap-2.5">
								<Button
									type="button"
									variant="outline"
									disabled={pending}
									onClick={() => setOpen(false)}
								>
									Cancel
								</Button>
								<Button type="submit" disabled={pending}>
									<UserPlus data-icon="inline-start" aria-hidden="true" />
									{pending ? "Sending…" : "Send invitation"}
								</Button>
							</div>
						</form>
					</div>
				</div>
			)}
		</>
	);
}
