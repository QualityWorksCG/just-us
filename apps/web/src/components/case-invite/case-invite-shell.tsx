import { cn } from "@just-us/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Brandmark } from "@/components/brandmark";
import { CaseInviteModalFrame } from "@/components/case-invite/case-invite-modal-frame";

/**
 * The single card every state of the invitation renders inside.
 *
 * It appears two ways, driven by `asModal`. Signed out, it is a full-page card on
 * the site — the same signed-out auth card as everywhere else, opened by someone
 * who may have no account. Signed in, the email link is routed into the app and
 * the same card is shown as a modal over the attorney's own dashboard, so a
 * decision that arrived by email is made without leaving where they were.
 *
 * The states that actually ask a question show the case the question is about, so
 * the standalone card can widen; the modal keeps one width.
 */
export function CaseInviteShell({
	icon: Icon,
	title,
	description,
	tone = "brass",
	width = "narrow",
	asModal = false,
	children,
}: {
	icon: LucideIcon;
	title: string;
	description: string;
	tone?: "brass" | "danger" | "success";
	width?: "narrow" | "wide";
	/** Render over the dashboard as a modal (signed-in) rather than as a full
	 *  page on the site (signed-out). */
	asModal?: boolean;
	children?: React.ReactNode;
}) {
	const card = (
		<div className="rounded-[var(--radius-modal)] border border-border bg-surface p-7 shadow-[var(--shadow-rest)] sm:p-8">
			<span
				className={cn(
					"mb-5 flex size-12 items-center justify-center rounded-[13px] border",
					tone === "danger" && "border-danger/25 bg-danger/10 text-danger",
					tone === "success" &&
						"border-success/25 bg-green-soft text-green-deep",
					tone === "brass" && "border-brass/30 bg-brass-wash text-brass-deep",
				)}
			>
				<Icon className="size-5" aria-hidden="true" />
			</span>
			<h1 className="mb-2 font-extrabold text-[22px] text-ink tracking-[-0.02em]">
				{title}
			</h1>
			<p className="mb-6 text-[14px] text-ink-soft leading-relaxed">
				{description}
			</p>
			{children}
		</div>
	);

	if (asModal) {
		return <CaseInviteModalFrame>{card}</CaseInviteModalFrame>;
	}

	return (
		<div className="flex min-h-svh items-center justify-center bg-paper px-5 py-10">
			<div
				className={cn(
					"w-full",
					width === "wide" ? "max-w-[640px]" : "max-w-[440px]",
				)}
			>
				<Link
					href="/"
					className="mb-8 flex items-center justify-center gap-2.5"
				>
					<Brandmark size={30} />
					<span className="font-bold text-[16px] tracking-tight">JustUs</span>
				</Link>
				{card}
			</div>
		</div>
	);
}
