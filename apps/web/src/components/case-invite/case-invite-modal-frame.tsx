"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * The invite card, presented as a modal over a signed-in attorney's dashboard.
 *
 * The emailed link is a full page load, so there is no soft navigation for an
 * intercepting route to catch — the signed-in `/case-invite` redirects into the
 * app and this renders the same card on top of the real dashboard behind it.
 * Dismissing drops the invite query params and leaves them where they landed
 * (their dashboard), rather than anywhere new.
 */
export function CaseInviteModalFrame({
	children,
}: {
	children: React.ReactNode;
}) {
	const router = useRouter();

	function close() {
		// Strip the ci_* params by replacing with the bare dashboard, so a Back
		// press doesn't drop them straight back onto the invitation.
		router.replace("/home");
	}

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") router.replace("/home");
		};
		document.addEventListener("keydown", onKey);
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = previousOverflow;
		};
	}, [router]);

	return (
		<div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
			<button
				type="button"
				aria-label="Close"
				className="fixed inset-0 cursor-default bg-ink/50"
				onClick={close}
			/>
			<div className="relative my-auto w-full max-w-[560px]">
				<button
					type="button"
					aria-label="Close"
					onClick={close}
					className="absolute top-4 right-4 z-10 flex size-8 items-center justify-center rounded-full border border-border bg-surface text-ink-soft transition-colors hover:text-ink"
				>
					<X className="size-4" />
				</button>
				{children}
			</div>
		</div>
	);
}
