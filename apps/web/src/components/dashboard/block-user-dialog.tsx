"use client";

import { Button } from "@just-us/ui/components/button";
import { Textarea } from "@just-us/ui/components/textarea";
import { cn } from "@just-us/ui/lib/utils";
import { Ban } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { blockUserAction } from "@/app/(app)/users/actions";

/** Earliest selectable expiry — a block that lapses today is a block that never was. */
function tomorrow() {
	const date = new Date();
	date.setDate(date.getDate() + 1);
	return date.toISOString().slice(0, 10);
}

export function BlockUserDialog({
	userId,
	userName,
}: {
	userId: string;
	userName: string;
}) {
	const router = useRouter();
	const ids = { title: useId(), reason: useId(), expires: useId() };
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState("");
	const [expiresAt, setExpiresAt] = useState("");
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [pending, startTransition] = useTransition();

	// Close on Escape (unless the block is in flight).
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !pending) setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, pending]);

	function close() {
		setOpen(false);
		setFieldErrors({});
	}

	function confirmBlock() {
		setFieldErrors({});
		startTransition(async () => {
			const res = await blockUserAction({
				userId,
				reason,
				expiresAt: expiresAt || undefined,
			});
			if (res.ok) {
				toast.success("Account blocked.");
				setOpen(false);
				setReason("");
				setExpiresAt("");
				router.refresh();
			} else {
				if (res.fieldErrors) setFieldErrors(res.fieldErrors);
				toast.error(res.error);
			}
		});
	}

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="inline-flex items-center gap-1.5 font-semibold text-[13px] text-danger transition-colors hover:text-danger/80"
			>
				<Ban className="size-4" aria-hidden="true" />
				Block
			</button>

			{open && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<button
						type="button"
						aria-label="Cancel"
						disabled={pending}
						onClick={close}
						className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
					/>
					<div
						role="dialog"
						aria-modal="true"
						aria-labelledby={ids.title}
						className="relative w-full max-w-[440px] rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-modal)]"
					>
						<div className="mb-3 flex size-11 items-center justify-center rounded-full bg-danger/10 text-danger">
							<Ban className="size-5" aria-hidden="true" />
						</div>
						<h2 id={ids.title} className="font-bold text-[17px] text-ink">
							Block this account?
						</h2>
						<p className="mt-1.5 text-[13.5px] text-ink-soft leading-relaxed">
							{userName} will be signed out everywhere and won't be able to sign
							in again until the block is lifted.
						</p>

						<div className="mt-5 flex flex-col gap-4">
							<div className="flex flex-col gap-1.5">
								<label
									htmlFor={ids.reason}
									className="font-semibold text-[13px] text-ink"
								>
									Reason
									<span className="ml-0.5 text-danger">*</span>
								</label>
								<Textarea
									id={ids.reason}
									value={reason}
									onChange={(e) => setReason(e.target.value)}
									rows={3}
									placeholder="Why is this account being blocked?"
									aria-invalid={!!fieldErrors.reason}
									className="rounded-[var(--radius-control)] border-line-strong px-3 py-2.5 text-[14px]"
								/>
								{fieldErrors.reason ? (
									<p className="text-[12px] text-danger">
										{fieldErrors.reason}
									</p>
								) : (
									<p className="text-[12px] text-muted-foreground leading-snug">
										Recorded in the audit log alongside your name.
									</p>
								)}
							</div>

							<div className="flex flex-col gap-1.5">
								<label
									htmlFor={ids.expires}
									className="font-semibold text-[13px] text-ink"
								>
									Blocked until
								</label>
								<input
									id={ids.expires}
									type="date"
									value={expiresAt}
									min={tomorrow()}
									onChange={(e) => setExpiresAt(e.target.value)}
									aria-invalid={!!fieldErrors.expiresAt}
									className="h-10 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-[14px]"
								/>
								{fieldErrors.expiresAt ? (
									<p className="text-[12px] text-danger">
										{fieldErrors.expiresAt}
									</p>
								) : (
									<p className="text-[12px] text-muted-foreground leading-snug">
										Leave empty to block indefinitely.
									</p>
								)}
							</div>
						</div>

						<div className="mt-5 flex justify-end gap-2.5">
							<Button variant="outline" disabled={pending} onClick={close}>
								Cancel
							</Button>
							<Button
								disabled={pending}
								onClick={confirmBlock}
								className={cn("bg-danger text-white hover:bg-danger/90")}
							>
								<Ban data-icon="inline-start" aria-hidden="true" />
								{pending ? "Blocking…" : "Block account"}
							</Button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
