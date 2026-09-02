"use client";

import { Button } from "@just-us/ui/components/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@just-us/ui/components/card";
import { cn } from "@just-us/ui/lib/utils";
import { AlertCircle, Flag, Send, Trash2 } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
	markConversationActiveAction,
	removeMessageAction,
	reportConversationAction,
	sendMessageAction,
	setConversationEmailPreferenceAction,
} from "@/app/(app)/message-actions";
import { DetailBackLink } from "@/components/detail-back-link";

type ThreadMessage = {
	id: string;
	body: string;
	createdAt: string;
	deletedAt: string | null;
	authorId: string;
	authorName: string;
};

/** What a participant can report a conversation for. Values match the report
 *  action's schema; labels are display-only. */
const REPORT_CATEGORIES: { value: string; label: string }[] = [
	{ value: "spam", label: "Spam" },
	{ value: "fraud", label: "Fraud or scam" },
	{ value: "harassment", label: "Harassment or abuse" },
	{ value: "inappropriate", label: "Inappropriate content" },
	{ value: "other", label: "Something else" },
];

export function ConversationThread({
	conversationId,
	currentUserId,
	otherName,
	messages,
	emailEnabled,
}: {
	conversationId: string;
	currentUserId: string;
	otherName: string;
	messages: ThreadMessage[];
	emailEnabled: boolean;
}) {
	const [body, setBody] = useState("");
	const [conversationEmailEnabled, setConversationEmailEnabled] =
		useState(emailEnabled);
	const [reportOpen, setReportOpen] = useState(false);
	const [reportCategory, setReportCategory] = useState<string | null>(null);
	const [reportReason, setReportReason] = useState("");
	const [reportAttempted, setReportAttempted] = useState(false);
	const [pending, startTransition] = useTransition();
	const reportTextareaRef = useRef<HTMLTextAreaElement>(null);
	// The scrollable message list, pinned to the bottom whenever a message arrives.
	const scrollRef = useRef<HTMLDivElement>(null);
	const lastMessageId = messages.at(-1)?.id;
	const reportTitleId = useId();
	const reportDescriptionId = useId();
	const reportReasonId = useId();
	const reportErrorId = useId();
	// A category is all we require now — the free-text detail is optional.
	const hasReportCategory = reportCategory !== null;
	const reportError =
		reportAttempted && !hasReportCategory
			? "Pick the option that best describes the issue."
			: null;

	useEffect(() => setConversationEmailEnabled(emailEnabled), [emailEnabled]);
	useEffect(() => {
		void markConversationActiveAction({ conversationId });
		const timer = window.setInterval(
			() => void markConversationActiveAction({ conversationId }),
			30_000,
		);
		return () => window.clearInterval(timer);
	}, [conversationId]);
	// Keep the newest message in view. The server re-supplies `messages` after a
	// reply is sent (and when the thread first opens), so pinning the list to the
	// bottom whenever the last message changes means a sent reply is seen without
	// the sender having to scroll down to it.
	// biome-ignore lint/correctness/useExhaustiveDependencies: the id/length are the intended re-pin triggers; the effect body only reads the ref
	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [lastMessageId, messages.length]);
	useEffect(() => {
		if (!reportOpen) return;
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !pending) {
				setReportOpen(false);
				setReportCategory(null);
				setReportReason("");
				setReportAttempted(false);
			}
		};
		document.addEventListener("keydown", closeOnEscape);
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		reportTextareaRef.current?.focus();
		return () => {
			document.removeEventListener("keydown", closeOnEscape);
			document.body.style.overflow = previousOverflow;
		};
	}, [pending, reportOpen]);
	function reply() {
		startTransition(async () => {
			const result = await sendMessageAction({ conversationId, body });
			if (!result.ok) toast.error(result.error);
			else setBody("");
		});
	}
	function remove(id: string) {
		startTransition(async () => {
			const result = await removeMessageAction(id);
			if (!result.ok) toast.error(result.error);
		});
	}
	function closeReport() {
		if (pending) return;
		setReportOpen(false);
		setReportCategory(null);
		setReportReason("");
		setReportAttempted(false);
	}
	function submitReport() {
		setReportAttempted(true);
		if (!reportCategory) return;
		startTransition(async () => {
			const result = await reportConversationAction({
				conversationId,
				category: reportCategory,
				reason: reportReason,
			});
			if (!result.ok) {
				toast.error(result.error);
				return;
			}
			toast.success("Conversation reported for moderation.");
			setReportOpen(false);
			setReportCategory(null);
			setReportReason("");
			setReportAttempted(false);
		});
	}
	function setEmail(enabled: boolean) {
		setConversationEmailEnabled(enabled);
		startTransition(async () => {
			const result = await setConversationEmailPreferenceAction(
				conversationId,
				enabled,
			);
			if (!result.ok) {
				setConversationEmailEnabled(!enabled);
				toast.error(result.error);
			}
		});
	}
	return (
		<div className="flex min-h-0 flex-1 flex-col bg-paper px-6 py-5 sm:px-10 lg:px-12">
			<div className="shrink-0 pb-4">
				<DetailBackLink href="/messages" label="Back to messages" />
			</div>
			<Card className="flex min-h-0 flex-1 flex-col rounded-[var(--radius-card-lg)] border border-border bg-surface py-0 shadow-[var(--shadow-rest)] ring-0">
				<CardHeader className="flex shrink-0 flex-row flex-wrap items-center justify-between gap-3 border-border border-b px-5 pt-5 pb-4">
					<div className="min-w-0">
						<CardTitle className="font-bold text-[18px] text-ink">
							{otherName}
						</CardTitle>
						<p className="mt-1 text-[13px] text-muted-foreground">
							Private conversation
						</p>
					</div>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="lg"
							onClick={() => setEmail(!conversationEmailEnabled)}
							disabled={pending}
						>
							{conversationEmailEnabled ? "Mute email" : "Turn on email"}
						</Button>
						<Button
							variant="outline"
							size="lg"
							onClick={() => setReportOpen(true)}
							disabled={pending}
						>
							<Flag data-icon="inline-start" />
							Report
						</Button>
					</div>
				</CardHeader>
				<CardContent
					ref={scrollRef}
					className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5"
				>
					{messages.map((message) => {
						const own = message.authorId === currentUserId;
						return (
							<article
								key={message.id}
								className={own ? "ml-auto max-w-[75%]" : "mr-auto max-w-[75%]"}
							>
								<div
									className={
										own
											? "rounded-[var(--radius-card)] bg-brass-wash px-4 py-3"
											: "rounded-[var(--radius-card)] bg-paper-alt px-4 py-3"
									}
								>
									{message.deletedAt ? (
										<p className="text-[14px] text-muted-foreground italic">
											Message removed
										</p>
									) : (
										<p className="whitespace-pre-wrap text-[14px] text-ink leading-relaxed">
											{message.body}
										</p>
									)}
								</div>
								<div
									className={
										own
											? "mt-1 flex justify-end gap-2 text-[12px] text-muted-foreground"
											: "mt-1 flex gap-2 text-[12px] text-muted-foreground"
									}
								>
									<span>
										{message.authorName} ·{" "}
										{new Date(message.createdAt).toLocaleString()}
									</span>
									{own && !message.deletedAt && (
										<Button
											type="button"
											onClick={() => remove(message.id)}
											variant="ghost"
											size="lg"
											className="text-destructive hover:bg-destructive/10 hover:text-destructive"
										>
											<Trash2 data-icon="inline-start" aria-hidden="true" />
											Remove
										</Button>
									)}
								</div>
							</article>
						);
					})}
				</CardContent>
				<CardFooter className="shrink-0 flex-col items-stretch border-border px-5 py-5">
					<label htmlFor="reply" className="font-semibold text-[14px] text-ink">
						Reply
					</label>
					<textarea
						id="reply"
						value={body}
						onChange={(event) => setBody(event.target.value)}
						maxLength={4000}
						placeholder="Write a message…"
						className="mt-2 min-h-24 w-full rounded-[var(--radius-control)] border border-line-strong bg-surface p-3 text-[14px] outline-none focus:border-brass-deep"
					/>
					<div className="mt-2 flex flex-wrap items-center justify-between gap-3">
						<p className="text-[12px] text-muted-foreground">
							Do not share account numbers, documents, or sensitive personal
							information here.
						</p>
						<Button
							size="lg"
							onClick={reply}
							disabled={!body.trim() || pending}
						>
							<Send data-icon="inline-start" />
							{pending ? "Sending…" : "Send message"}
						</Button>
					</div>
				</CardFooter>
			</Card>
			{reportOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<button
						type="button"
						aria-label="Close report conversation dialog"
						className="absolute inset-0 cursor-default bg-ink/50"
						onClick={closeReport}
					/>
					<section
						role="dialog"
						aria-modal="true"
						aria-labelledby={reportTitleId}
						aria-describedby={reportDescriptionId}
						className="relative w-full max-w-[560px] rounded-[var(--radius-card-lg)] border border-border bg-surface p-8 shadow-[var(--shadow-modal)]"
					>
						<div className="flex size-12 items-center justify-center rounded-full bg-brass-wash text-brass-deep">
							<Flag className="size-5" aria-hidden="true" />
						</div>
						<p className="mt-4 font-mono font-semibold text-brass-deep text-xs uppercase tracking-[0.1em]">
							Help keep conversations safe
						</p>
						<h2
							id={reportTitleId}
							className="mt-2 font-extrabold text-2xl text-ink tracking-[-0.02em]"
						>
							Report this conversation
						</h2>
						<p
							id={reportDescriptionId}
							className="mt-4 max-w-[55ch] text-base text-ink-soft leading-relaxed"
						>
							Tell us what concerns you. Our moderation team will review the
							report.
						</p>

						<form
							className="mt-6 flex flex-col gap-6"
							onSubmit={(event) => {
								event.preventDefault();
								submitReport();
							}}
						>
							<div>
								<span className="block font-semibold text-base text-ink">
									What's the issue?
								</span>
								<div className="mt-3 flex flex-wrap gap-2">
									{REPORT_CATEGORIES.map((cat) => {
										const selected = reportCategory === cat.value;
										return (
											<button
												key={cat.value}
												type="button"
												aria-pressed={selected}
												onClick={() => {
													setReportCategory(cat.value);
													setReportAttempted(false);
												}}
												className={cn(
													"rounded-[var(--radius-pill)] border px-3.5 py-1.5 font-semibold text-sm transition-colors",
													selected
														? "border-ink bg-ink text-surface"
														: "border-line-strong bg-surface text-ink-soft hover:border-brass-deep hover:text-brass-deep",
												)}
											>
												{cat.label}
											</button>
										);
									})}
								</div>
								{reportError ? (
									<p
										id={reportErrorId}
										role="alert"
										className="mt-3 flex items-center gap-2 text-destructive text-sm"
									>
										<AlertCircle
											className="size-4 shrink-0"
											aria-hidden="true"
										/>
										{reportError}
									</p>
								) : null}
							</div>

							<div>
								<label
									htmlFor={reportReasonId}
									className="block font-semibold text-base text-ink"
								>
									Add more details{" "}
									<span className="font-normal text-muted-foreground">
										(optional)
									</span>
								</label>
								<textarea
									ref={reportTextareaRef}
									id={reportReasonId}
									value={reportReason}
									onChange={(event) => setReportReason(event.target.value)}
									maxLength={1000}
									placeholder="Anything that would help our team review: what happened, when, and where."
									className="mt-2 min-h-28 w-full resize-y rounded-[var(--radius-control)] border border-line-strong bg-surface p-3 text-base text-ink leading-relaxed outline-none focus:border-brass-deep focus:ring-1 focus:ring-brass-deep/30"
								/>
							</div>
							<p className="text-base text-muted-foreground leading-relaxed">
								Your report is visible only to JustUs moderators.
							</p>
							<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
								<Button
									type="button"
									variant="outline"
									size="lg"
									onClick={closeReport}
									disabled={pending}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									size="lg"
									disabled={!hasReportCategory || pending}
								>
									<Flag data-icon="inline-start" aria-hidden="true" />
									{pending ? "Sending report…" : "Send report"}
								</Button>
							</div>
						</form>
					</section>
				</div>
			)}
		</div>
	);
}
