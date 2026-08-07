"use client";

import { Bubble, BubbleContent } from "@just-us/ui/components/bubble";
import {
	Marker,
	MarkerContent,
	MarkerIcon,
} from "@just-us/ui/components/marker";
import { Message, MessageContent } from "@just-us/ui/components/message";
import { cn } from "@just-us/ui/lib/utils";
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { Streamdown } from "streamdown";

import { toolLabel } from "@/components/chat/chat-copy";

const BUBBLE = "rounded-[var(--radius-card)] px-3.5 py-2.5 text-[13.5px]";

/**
 * Markdown inside a bubble.
 *
 * Streamdown ships its own Tailwind classes, but Tailwind only scans this repo —
 * so the package's defaults never make it into the stylesheet. Descendant
 * selectors written here do, which also keeps the prose on the app's own scale
 * and palette rather than a generic one. Controls are off for the same reason:
 * the copy/download buttons would render unstyled.
 */
const PROSE = cn(
	"[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
	"[&_p+p]:mt-2.5 [&_p]:my-0",
	"[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
	"[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
	"[&_li]:my-1 [&_li]:pl-0.5",
	"[&_a]:font-semibold [&_a]:text-brass-deep [&_a]:underline [&_a]:underline-offset-2",
	"[&_strong]:font-bold [&_strong]:text-ink",
	"[&_h1]:mt-3 [&_h1]:mb-1 [&_h1]:font-bold [&_h1]:text-[14.5px]",
	"[&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:font-bold [&_h2]:text-[14px]",
	"[&_h3]:mt-2.5 [&_h3]:mb-1 [&_h3]:font-bold [&_h3]:text-[13.5px]",
	"[&_code]:rounded-[var(--radius-chip)] [&_code]:bg-ink/8 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px]",
	"[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-[var(--radius-card-sm)] [&_pre]:bg-ink/6 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
	"[&_blockquote]:my-2 [&_blockquote]:border-brass/40 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-ink-soft",
	"[&_hr]:my-3 [&_hr]:border-border",
	"[&_table]:my-2 [&_table]:w-full [&_table]:text-left",
	"[&_th]:border-border [&_th]:border-b [&_th]:py-1 [&_th]:pr-3 [&_th]:font-semibold",
	"[&_td]:border-border/60 [&_td]:border-b [&_td]:py-1 [&_td]:pr-3",
);

function Markdown({ text, streaming }: { text: string; streaming: boolean }) {
	return (
		<Streamdown
			mode={streaming ? "streaming" : "static"}
			controls={false}
			className={PROSE}
		>
			{text}
		</Streamdown>
	);
}

/**
 * One compact line per tool call — what the assistant did, not what it sent.
 * Inputs and outputs stay out of the thread: they are the user's own data read
 * back to them, and printing raw JSON reads as a malfunction.
 */
function ToolRow({
	name,
	running,
	failed,
}: {
	name: string;
	running: boolean;
	failed: boolean;
}) {
	return (
		<Marker className="px-1 py-0.5 text-[11.5px] text-muted-foreground">
			<MarkerIcon className={failed ? "text-danger" : "text-brass-deep"}>
				{failed ? (
					<CircleAlert />
				) : running ? (
					<LoaderCircle className="animate-spin" />
				) : (
					<Check />
				)}
			</MarkerIcon>
			<MarkerContent className={cn(running && "shimmer")}>
				{failed
					? `Couldn't ${toolLabel(name, true).toLowerCase()}`
					: toolLabel(name, running)}
			</MarkerContent>
		</Marker>
	);
}

/** The assistant's pending turn, before the first token lands. */
export function PendingMessage() {
	return (
		<Message align="start">
			<MessageContent>
				<Bubble variant="secondary" align="start">
					{/* The shimmer clips its background to the text, so it goes on a span
					    of its own — on the bubble it would eat the bubble's own fill. */}
					<BubbleContent className={cn(BUBBLE, "text-ink-soft")}>
						<span className="shimmer">Thinking…</span>
					</BubbleContent>
				</Bubble>
			</MessageContent>
		</Message>
	);
}

export function ChatMessage({ message }: { message: UIMessage }) {
	if (message.role === "user") {
		const text = message.parts
			.map((part) => (part.type === "text" ? part.text : ""))
			.join("")
			.trim();
		if (!text) return null;
		return (
			<Message align="end">
				<MessageContent>
					<Bubble align="end">
						<BubbleContent className={BUBBLE}>{text}</BubbleContent>
					</Bubble>
				</MessageContent>
			</Message>
		);
	}

	// Reasoning and step boundaries are deliberately dropped: neither is
	// something a user asked for, and both make the thread harder to read.
	const rendered = message.parts.flatMap((part, index) => {
		const key = `${message.id}-${index}`;
		if (part.type === "text") {
			if (!part.text) return [];
			return [
				<Bubble key={key} variant="secondary" align="start">
					<BubbleContent className={BUBBLE}>
						<Markdown text={part.text} streaming={part.state !== "done"} />
					</BubbleContent>
				</Bubble>,
			];
		}
		if (isToolUIPart(part)) {
			const running =
				part.state === "input-streaming" || part.state === "input-available";
			return [
				<ToolRow
					key={key}
					name={getToolName(part)}
					running={running}
					failed={part.state === "output-error"}
				/>,
			];
		}
		return [];
	});

	if (rendered.length === 0) return null;

	return (
		<Message align="start">
			<MessageContent>{rendered}</MessageContent>
		</Message>
	);
}
