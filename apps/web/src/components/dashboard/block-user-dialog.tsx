"use client";

import { Button } from "@just-us/ui/components/button";
import { Calendar } from "@just-us/ui/components/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@just-us/ui/components/popover";
import { Textarea } from "@just-us/ui/components/textarea";
import { cn } from "@just-us/ui/lib/utils";
import { Ban, CalendarIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { blockUserAction } from "@/app/(app)/users/actions";

/** Earliest selectable expiry — a block that lapses today is a block that never was. */
function tomorrow() {
	const date = new Date();
	date.setHours(0, 0, 0, 0);
	date.setDate(date.getDate() + 1);
	return date;
}

/** Same shape the users table prints dates in, so the two never disagree. */
const dayFmt = new Intl.DateTimeFormat("en-GB", {
	day: "2-digit",
	month: "short",
	year: "numeric",
});

/**
 * The wire format the block action parses: a plain calendar day. Built from the
 * local parts rather than toISOString(), which would hand back the previous day
 * for any administrator west of UTC.
 */
function toISODate(date: Date) {
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
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
	const [expiresAt, setExpiresAt] = useState<Date>();
	const [pickerOpen, setPickerOpen] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
	const [pending, startTransition] = useTransition();

	// Close on Escape (unless the block is in flight).
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			// Escape belongs to the calendar while it's open. Without this the first
			// Escape would tear down the whole dialog — and the typed reason with it —
			// when all the administrator meant was to back out of the date.
			if (e.key === "Escape" && !pending && !pickerOpen) setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, pending, pickerOpen]);

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
				expiresAt: expiresAt ? toISODate(expiresAt) : undefined,
			});
			if (res.ok) {
				toast.success("Account blocked.");
				setOpen(false);
				setReason("");
				setExpiresAt(undefined);
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
								<Popover open={pickerOpen} onOpenChange={setPickerOpen}>
									<PopoverTrigger
										render={
											<button
												id={ids.expires}
												type="button"
												aria-invalid={!!fieldErrors.expiresAt}
												className={cn(
													"flex h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-left text-[14px] transition-colors hover:border-brass-deep aria-invalid:border-danger",
													!expiresAt && "text-muted-foreground",
												)}
											>
												{expiresAt ? dayFmt.format(expiresAt) : "Indefinitely"}
												<CalendarIcon
													className="size-4 shrink-0 text-muted-foreground"
													aria-hidden="true"
												/>
											</button>
										}
									/>
									<PopoverContent align="start" className="w-auto gap-0 p-0">
										<Calendar
											mode="single"
											selected={expiresAt}
											onSelect={(date) => {
												setExpiresAt(date);
												setPickerOpen(false);
											}}
											// A block has to outlast today to mean anything, so
											// today and everything before it isn't selectable — and
											// the calendar opens on the first month that is.
											disabled={{ before: tomorrow() }}
											defaultMonth={expiresAt ?? tomorrow()}
											startMonth={tomorrow()}
											captionLayout="dropdown"
											autoFocus
										/>
										{expiresAt && (
											<div className="border-border border-t p-2">
												<button
													type="button"
													onClick={() => {
														setExpiresAt(undefined);
														setPickerOpen(false);
													}}
													className="font-semibold text-[12.5px] text-ink-soft transition-colors hover:text-brass-deep"
												>
													Clear (block indefinitely)
												</button>
											</div>
										)}
									</PopoverContent>
								</Popover>
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
