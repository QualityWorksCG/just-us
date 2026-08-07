"use client";

import { cn } from "@just-us/ui/lib/utils";
import { upload } from "@vercel/blob/client";
import { FileText, Paperclip, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { postCaseUpdateAction } from "@/app/(app)/update-actions";
import { TAG_TONE_CLASS, UPDATE_TAGS } from "@/lib/update-tags";

const MAX = 4000;
const MAX_ATTACHMENTS = 10;

type Attachment = { url: string; name: string; contentType: string };

function initials(name: string) {
	return (
		name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? "")
			.join("") || "—"
	);
}

/**
 * The box for posting a case update (JUS-33) — used by the plaintiff and the
 * matched attorney. Supports an optional category tag and image/PDF attachments
 * (uploaded to Blob before the post is sent). On success it clears and calls
 * `router.refresh()`, and the server action's revalidation carries the post to
 * every backer's next reload.
 */
export function CaseUpdateComposer({
	caseId,
	authorName,
	authorTone = "brass",
	placeholder,
}: {
	caseId: string;
	authorName: string;
	/** Avatar colour — brass for the attorney, green for the plaintiff. */
	authorTone?: "brass" | "green";
	placeholder: string;
}) {
	const router = useRouter();
	const [body, setBody] = useState("");
	const [tag, setTag] = useState<string | null>(null);
	const [attachments, setAttachments] = useState<Attachment[]>([]);
	const [uploading, setUploading] = useState(false);
	const [pending, startTransition] = useTransition();
	const fileInput = useRef<HTMLInputElement>(null);

	const trimmed = body.trim();
	const disabled = pending || uploading || trimmed.length === 0;

	async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
		const files = Array.from(e.target.files ?? []).slice(
			0,
			MAX_ATTACHMENTS - attachments.length,
		);
		e.target.value = "";
		if (files.length === 0) return;
		setUploading(true);
		try {
			const added = await Promise.all(
				files.map(async (f) => {
					const blob = await upload(f.name, f, {
						access: "public",
						handleUploadUrl: "/api/case-updates/upload",
					});
					return { url: blob.url, name: f.name, contentType: f.type };
				}),
			);
			setAttachments((p) => [...p, ...added].slice(0, MAX_ATTACHMENTS));
		} catch {
			toast.error("Couldn't upload that file. Please try again.");
		} finally {
			setUploading(false);
		}
	}

	function submit() {
		if (trimmed.length === 0) return;
		startTransition(async () => {
			const res = await postCaseUpdateAction({
				caseId,
				body: trimmed,
				...(tag ? { tag } : {}),
				...(attachments.length ? { attachments } : {}),
			});
			if (res.ok) {
				setBody("");
				setTag(null);
				setAttachments([]);
				toast.success("Update posted — your backers can see it now.");
				router.refresh();
			} else {
				toast.error(res.error);
			}
		});
	}

	return (
		<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-4 shadow-[var(--shadow-rest)]">
			<div className="flex gap-3">
				<span
					className={cn(
						"mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full font-bold text-[12px] text-white",
						authorTone === "green" ? "bg-green-deep" : "bg-brass",
					)}
				>
					{initials(authorName)}
				</span>
				<textarea
					value={body}
					onChange={(e) => setBody(e.target.value.slice(0, MAX))}
					rows={2}
					placeholder={placeholder}
					aria-label="Write an update"
					className="min-h-[52px] flex-1 resize-y rounded-[var(--radius-control)] border border-border bg-surface-2/40 px-3.5 py-2.5 text-[14.5px] text-ink outline-none transition-colors placeholder:text-muted-foreground focus:border-brass-deep"
					onKeyDown={(e) => {
						if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
							e.preventDefault();
							submit();
						}
					}}
				/>
			</div>

			{/* Attached files */}
			{attachments.length > 0 && (
				<div className="mt-3 flex flex-wrap gap-2 pl-12">
					{attachments.map((a, i) => (
						<span
							key={a.url}
							className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-border bg-surface-2/40 py-1 pr-1.5 pl-2.5 font-medium text-[12px] text-ink"
						>
							<FileText
								className="size-3.5 shrink-0 text-brass-deep"
								aria-hidden="true"
							/>
							<span className="max-w-[160px] truncate">{a.name}</span>
							<button
								type="button"
								aria-label={`Remove ${a.name}`}
								onClick={() =>
									setAttachments((p) => p.filter((_, idx) => idx !== i))
								}
								className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:text-ink"
							>
								<X className="size-3" aria-hidden="true" />
							</button>
						</span>
					))}
				</div>
			)}

			{/* Optional category — one tag, toggled on/off. */}
			<div className="mt-3 flex flex-wrap gap-1.5 pl-12">
				{UPDATE_TAGS.map((t) => {
					const active = tag === t.value;
					const Icon = t.icon;
					return (
						<button
							key={t.value}
							type="button"
							onClick={() => setTag(active ? null : t.value)}
							aria-pressed={active}
							className={cn(
								"inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-1 font-semibold text-[11.5px] transition-colors",
								active
									? cn("border-transparent", TAG_TONE_CLASS[t.tone])
									: "border-border text-ink-soft hover:border-brass-deep",
							)}
						>
							<Icon className="size-3.5" aria-hidden="true" />
							{t.label}
						</button>
					);
				})}
			</div>

			<div className="mt-3 flex items-center justify-between gap-3 pl-12">
				<button
					type="button"
					onClick={() => fileInput.current?.click()}
					disabled={uploading || attachments.length >= MAX_ATTACHMENTS}
					className="inline-flex items-center gap-1.5 font-medium text-[12.5px] text-muted-foreground transition-colors hover:text-ink disabled:opacity-60"
				>
					<Paperclip className="size-3.5" aria-hidden="true" />
					{uploading ? "Uploading…" : "Attach a photo or file"}
				</button>
				<input
					ref={fileInput}
					type="file"
					accept="image/*,application/pdf"
					multiple
					hidden
					onChange={onPick}
				/>
				<button
					type="button"
					onClick={submit}
					disabled={disabled}
					className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-brass px-4 font-bold text-[14px] text-white transition-colors hover:bg-brass-deep disabled:cursor-not-allowed disabled:opacity-50"
				>
					<Send className="size-4" aria-hidden="true" />
					{pending ? "Posting…" : "Post update"}
				</button>
			</div>
		</div>
	);
}
