"use client";

import { Button, buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { ArrowRight, FileText, Lock, Send, Wallet } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useId, useState } from "react";

/**
 * "Contact" on an attorney card or profile.
 *
 * Contacting an attorney on JustUs means sending them a case — there is no
 * message channel, because an attorney decides from the matter itself. So this
 * button leads to the case form, and that used to happen as an unannounced jump:
 * you clicked "Contact" expecting a compose box and landed in a multi-step wizard
 * with no explanation.
 *
 * The modal is the explanation. It says what the next screen is, why contacting
 * runs through it, and what it does *not* do — nothing reaches the attorney until
 * the plaintiff sends it. Cancelling leaves them where they were.
 */
export function ContactAttorneyButton({
	attorneyName,
	size = "sm",
	className,
}: {
	/** Full name; only the first name is used, to keep the copy conversational. */
	attorneyName: string;
	size?: "sm" | "lg";
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const titleId = useId();
	const descId = useId();
	const firstName = attorneyName.trim().split(" ")[0] || "this attorney";

	// Escape closes it, and the page behind it doesn't scroll while it's up —
	// both things a native <dialog> would give and this pattern has to do itself.
	useEffect(() => {
		if (!open) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("keydown", onKey);
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = previous;
		};
	}, [open]);

	return (
		<>
			<Button size={size} onClick={() => setOpen(true)} className={className}>
				<Send data-icon="inline-start" aria-hidden="true" />
				Contact
			</Button>

			{open && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<button
						type="button"
						aria-label="Close"
						onClick={() => setOpen(false)}
						className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
					/>
					<div
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						aria-describedby={descId}
						className="relative w-full max-w-[460px] rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-modal)]"
					>
						<div className="mb-3 flex size-11 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
							<FileText className="size-5" aria-hidden="true" />
						</div>
						<h3 id={titleId} className="font-bold text-[17px] text-ink">
							Reaching {firstName} starts with your case
						</h3>
						<p
							id={descId}
							className="mt-1.5 text-[13.5px] text-ink-soft leading-relaxed"
						>
							There's no message box — {firstName} decides from the case itself:
							what happened, where, and what you're asking for. So the next screen
							is the case form.
						</p>

						<ul className="mt-4 flex flex-col gap-2.5">
							<Point icon={FileText}>
								Tell your story once. It's saved as you go, so you can stop and
								come back.
							</Point>
							<Point icon={Lock}>
								Nothing reaches {firstName} until you send it. You choose when.
							</Point>
							<Point icon={Wallet}>
								Free to start. A fee is only agreed if they take your case on.
							</Point>
						</ul>

						<div className="mt-5 flex flex-wrap justify-end gap-2.5">
							<Button variant="outline" onClick={() => setOpen(false)}>
								Not now
							</Button>
							<Link
								href={"/cases/new" as Route}
								className={cn(buttonVariants(), "px-4")}
							>
								Start my case
								<ArrowRight data-icon="inline-end" aria-hidden="true" />
							</Link>
						</div>
					</div>
				</div>
			)}
		</>
	);
}

function Point({
	icon: Icon,
	children,
}: {
	icon: typeof FileText;
	children: React.ReactNode;
}) {
	return (
		<li className="flex items-start gap-2.5 text-[13px] text-ink-soft leading-relaxed">
			<Icon
				className="mt-0.5 size-4 shrink-0 text-brass-deep"
				aria-hidden="true"
			/>
			<span>{children}</span>
		</li>
	);
}
