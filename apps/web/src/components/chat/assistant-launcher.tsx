"use client";

import { Button } from "@just-us/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@just-us/ui/components/tooltip";
import { cn } from "@just-us/ui/lib/utils";
import { MessagesSquare } from "lucide-react";
import { useEffect, useRef } from "react";

import {
	ASSISTANT_PANEL_ID,
	PANEL_SELECTOR,
} from "@/components/chat/assistant-sidebar";

/**
 * The assistant's entry point in the app header. Rendered only when the
 * `aiAssistant` flag is on — with the flag off there is no control here at all —
 * and only while the panel is closed: with the column open this button and the
 * panel's own header would say the same thing twice, side by side.
 *
 * A disclosure toggle, not a dialog trigger: the shell owns the open state
 * because the panel it reveals is a column beside the page, not an overlay.
 */
export function AssistantLauncher({
	onOpen,
	/**
	 * This mount is the panel closing again, not a fresh page. Hiding the column
	 * strands whatever inside it held focus, and the launcher is not there to take
	 * it back until now — so the handover happens on the way in instead.
	 */
	restoreFocus = false,
}: {
	onOpen: () => void;
	restoreFocus?: boolean;
}) {
	const buttonRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!restoreFocus) return;
		// Only from the column, or from nothing at all — never off something the user
		// moved to on the page themselves.
		const active = document.activeElement as HTMLElement | null;
		if (!active || active === document.body || active.closest(PANEL_SELECTOR)) {
			buttonRef.current?.focus();
		}
	}, [restoreFocus]);

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						ref={buttonRef}
						variant="outline"
						size="icon-lg"
						aria-label="Assistant"
						aria-expanded={false}
						aria-controls={ASSISTANT_PANEL_ID}
						onClick={onOpen}
						className={cn(
							"shrink-0 rounded-full border-border bg-surface text-ink-soft hover:text-brass-deep",
							// Coming back as the column collapses, it fades in over the same
							// beat instead of appearing in the gap the panel is still leaving.
							// Only then — on a fresh page there is nothing to fade in from.
							restoreFocus &&
								"fade-in-0 animate-in duration-[var(--dur-pop)] ease-[var(--ease-progress)] motion-reduce:animate-none",
						)}
					/>
				}
			>
				<MessagesSquare className="size-[17px]" aria-hidden="true" />
			</TooltipTrigger>
			<TooltipContent side="bottom">Assistant</TooltipContent>
		</Tooltip>
	);
}
