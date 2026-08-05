"use client";

import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupTextarea,
} from "@just-us/ui/components/input-group";
import { ArrowUp, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ChatComposer({
	textareaRef,
	busy,
	onSend,
	onStop,
}: {
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	/** Submitted or streaming — the turn is the assistant's. */
	busy: boolean;
	onSend: (text: string) => void;
	onStop: () => void;
}) {
	const [value, setValue] = useState("");

	// Disabling the field takes focus with it, so hand it back when the turn ends.
	const wasBusy = useRef(busy);
	useEffect(() => {
		if (wasBusy.current && !busy) textareaRef.current?.focus();
		wasBusy.current = busy;
	}, [busy, textareaRef]);

	function send() {
		const text = value.trim();
		if (!text || busy) return;
		setValue("");
		onSend(text);
	}

	return (
		<form
			className="shrink-0 border-border border-t bg-surface p-3"
			onSubmit={(event) => {
				event.preventDefault();
				send();
			}}
		>
			<InputGroup className="rounded-[var(--radius-card)] border-line-strong bg-paper-alt">
				<InputGroupTextarea
					ref={textareaRef}
					value={value}
					onChange={(event) => setValue(event.target.value)}
					onKeyDown={(event) => {
						// Enter sends; Shift+Enter is a newline. `isComposing` keeps an IME
						// candidate selection from being read as a send.
						if (
							event.key === "Enter" &&
							!event.shiftKey &&
							!event.nativeEvent.isComposing
						) {
							event.preventDefault();
							send();
						}
					}}
					disabled={busy}
					rows={2}
					placeholder="Ask about your account or how JustUs works…"
					aria-label="Message the assistant"
					className="min-h-[3.25rem] px-3 py-2.5 text-[13.5px] md:text-[13.5px]"
				/>
				<InputGroupAddon
					align="block-end"
					className="justify-between px-3 pb-2"
				>
					<span className="text-[11px] text-muted-foreground">
						Enter to send · Shift + Enter for a new line
					</span>
					{busy ? (
						<InputGroupButton
							size="icon-sm"
							variant="outline"
							onClick={onStop}
							aria-label="Stop generating"
							className="rounded-full border-line-strong"
						>
							<Square className="size-3 fill-current" aria-hidden="true" />
						</InputGroupButton>
					) : (
						<InputGroupButton
							type="submit"
							size="icon-sm"
							variant="default"
							disabled={!value.trim()}
							aria-label="Send message"
							className="rounded-full"
						>
							<ArrowUp className="size-4" aria-hidden="true" />
						</InputGroupButton>
					)}
				</InputGroupAddon>
			</InputGroup>
		</form>
	);
}
