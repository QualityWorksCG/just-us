"use client";

import { Button } from "@just-us/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@just-us/ui/components/tooltip";
import { cn } from "@just-us/ui/lib/utils";
import {
	ArrowLeft,
	History,
	MessagesSquare,
	Plus,
	Scale,
	X,
} from "lucide-react";
import { useEffect } from "react";

import { DISCLAIMER } from "@/components/chat/chat-copy";

/** Referenced by the header launcher's `aria-controls`. */
export const ASSISTANT_PANEL_ID = "assistant-panel";

/** How anything outside the column finds it in the DOM. */
export const PANEL_SELECTOR = '[data-slot="assistant-sidebar"]';

const TITLE_ID = "assistant-panel-title";

/**
 * One header control. Icon-only, so the tooltip and the label carry the same
 * words — the tooltip is what a sighted user reads, the label what everyone else
 * gets, and they must not drift apart.
 */
function HeaderAction({
	icon: Icon,
	label,
	onClick,
	disabled = false,
}: {
	icon: typeof X;
	label: string;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onClick}
						disabled={disabled}
						aria-label={label}
						className="shrink-0 text-ink-soft"
					/>
				}
			>
				<Icon className="size-4" aria-hidden="true" />
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}

/**
 * The panel chrome: the column itself, its header, and the standing disclaimer.
 *
 * A flex sibling of the app's content column, not a dialog — no backdrop, no
 * focus trap, and the page behind it keeps its own scroll and clicks. From `lg`
 * up it is a full-height column pinned beside the app; below that there is no
 * room to sit next to anything, so it takes the viewport instead.
 *
 * Opening is a width animation, not an appearance: the column is always in the
 * document and goes from `0` to its full width, which is what makes the page
 * beside it reflow in step rather than jump. `display: none` cannot be
 * transitioned, so the closed column is collapsed, clipped, `inert`, and — once
 * the motion has finished — `visibility: hidden`. The duration and easing are the
 * app's own tokens, shared with the nav rail's collapse so the two read as one
 * movement.
 *
 * Lives apart from the conversation so the loading, unavailable and live states
 * all render inside the same frame. Everything below the disclaimer comes in as
 * children and owns the rest of the column.
 */
export function AssistantSidebar({
	open,
	/**
	 * The column has been in the document for at least a frame, so `open` has a
	 * closed state to animate away from. Held by the panel above, which is not
	 * remounted when the thread changes — the column is, and a remount that
	 * started closed would collapse and reopen on every thread switch.
	 */
	entered = true,
	onOpenChange,
	/** Start a fresh thread. Absent when there is nothing to start one from — a
	 *  thread with no turns in it is already the new conversation. */
	onNewChat,
	/** Toggles the history list. In history the same control is the way back, so
	 *  there is one place to press rather than two that swap. */
	onHistory,
	historyOpen = false,
	/** A thread switch is in flight; the controls that would start another wait. */
	pending = false,
	/**
	 * Focus target when the panel opens — the composer, so a user can start
	 * typing without a tab stop through the header controls first.
	 */
	initialFocus,
	children,
}: {
	open: boolean;
	entered?: boolean;
	onOpenChange: (open: boolean) => void;
	onNewChat?: () => void;
	onHistory?: () => void;
	historyOpen?: boolean;
	pending?: boolean;
	initialFocus?: React.RefObject<HTMLElement | null>;
	children: React.ReactNode;
}) {
	useEffect(() => {
		// `preventScroll` because the column is still growing when this runs: a
		// browser scrolling the composer into view inside a clipped box would shove
		// the whole conversation sideways mid-animation.
		if (open) initialFocus?.current?.focus({ preventScroll: true });
	}, [open, initialFocus]);

	const shown = open && entered;

	return (
		// Collapsed rather than unmounted: the conversation lives in a hook above
		// this and has to survive a close, and a width can be animated where
		// `display` cannot.
		<aside
			id={ASSISTANT_PANEL_ID}
			data-slot="assistant-sidebar"
			data-state={shown ? "open" : "closed"}
			aria-labelledby={TITLE_ID}
			// Closed, the column is not just invisible: nothing in it can be clicked,
			// tabbed into, or read out, and focus inside it is dropped on the way out.
			inert={!open}
			className={cn(
				"group/panel flex flex-col overflow-hidden bg-surface text-ink",
				"transition-[width,visibility] duration-[var(--dur-pop)] ease-[var(--ease-progress)] motion-reduce:transition-none",
				// Last thing the motion does on the way out, first on the way in:
				// `visibility` steps rather than interpolates, so it waits for the rest.
				"data-[state=closed]:invisible",
				// Below lg there is nothing to sit beside, so it comes in over the page
				// rather than making room. The box stays put and its contents slide
				// inside it — a fixed layer parked off to the right of the viewport is
				// still part of the document's width, and would leave the page scrolling
				// sideways while the panel is shut.
				"max-lg:fixed max-lg:inset-0 max-lg:z-50",
				// From lg up it is an in-flow column that opens from nothing, so the
				// header and page beside it give up their room over the same 220ms.
				"lg:sticky lg:top-0 lg:h-svh lg:w-[25rem] lg:shrink-0",
				"lg:data-[state=closed]:w-0",
			)}
			// Escape only closes while focus is inside the column; the page keeps its
			// own key handling otherwise.
			onKeyDown={(event) => {
				if (event.key !== "Escape") return;
				event.stopPropagation();
				onOpenChange(false);
			}}
		>
			{/*
				Full width from the start, inside a box that is still growing: the
				column's contents are revealed by the clip, never reflowed by it, so no
				heading re-wraps or button hops while the panel opens.

				This is also what slides below lg. `translate` rather than `transform`
				because that is the property Tailwind sets, and transitioning the wrong
				one leaves the panel teleporting with only its opacity animating.
			*/}
			<div
				className={cn(
					"flex min-h-0 w-full flex-1 flex-col border-border lg:w-[25rem] lg:border-l",
					"transition-[translate,opacity] duration-[var(--dur-pop)] ease-[var(--ease-progress)] motion-reduce:transition-none",
					"max-lg:group-data-[state=closed]/panel:translate-x-full max-lg:group-data-[state=closed]/panel:opacity-0",
				)}
			>
				{/* h-16 matches the app's chrome bar so the two bottom borders line up. */}
				<header className="flex h-16 shrink-0 flex-row items-center gap-1 border-border border-b bg-surface px-4">
					<span className="mr-1.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brass text-white">
						<MessagesSquare className="size-4" aria-hidden="true" />
					</span>
					<div className="min-w-0 flex-1 leading-tight">
						<h2 id={TITLE_ID} className="font-bold text-[15px] text-ink">
							JustUs Assistant
						</h2>
						<p className="truncate text-[11.5px] text-muted-foreground">
							{historyOpen
								? "Your past conversations"
								: "Answers about your account and how JustUs works"}
						</p>
					</div>
					{onNewChat && !historyOpen && (
						<HeaderAction
							icon={Plus}
							label="New conversation"
							onClick={onNewChat}
							disabled={pending}
						/>
					)}
					{onHistory && (
						<HeaderAction
							icon={historyOpen ? ArrowLeft : History}
							label={historyOpen ? "Back to conversation" : "Chat history"}
							onClick={onHistory}
						/>
					)}
					<HeaderAction
						icon={X}
						label="Close assistant"
						onClick={() => onOpenChange(false)}
					/>
				</header>

				{/* Permanent, not a dismissible banner. */}
				<p className="flex shrink-0 items-start gap-2 border-border border-b bg-brass-wash/60 px-4 py-2.5 text-[11.5px] text-ink-soft leading-snug">
					<Scale
						className="mt-px size-3.5 shrink-0 text-brass-deep"
						aria-hidden="true"
					/>
					{DISCLAIMER}
				</p>

				{children}
			</div>
		</aside>
	);
}
