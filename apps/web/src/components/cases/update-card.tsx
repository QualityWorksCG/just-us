// biome-ignore-all lint/performance/noImgElement: attachment thumbnails are user-uploaded Blob URLs, not static assets
"use client";

import { cn } from "@just-us/ui/lib/utils";
import { FileText, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { editCaseUpdateAction } from "@/app/(app)/update-actions";
import { TimeAgo } from "@/components/time-ago";
import { TAG_TONE_CLASS, tagConfig, UPDATE_TAGS } from "@/lib/update-tags";

export type CaseUpdateAuthorRole = "attorney" | "plaintiff";
export type UpdateViewerRole = "attorney" | "plaintiff" | "donor";
export type UpdateAttachmentItem = {
	url: string;
	name: string;
	contentType: string;
};

export type CaseUpdateItem = {
	id: string;
	body: string;
	createdAt: Date | string;
	editedAt: Date | string | null;
	authorId: string;
	authorRole: CaseUpdateAuthorRole;
	authorName: string;
	tag: string | null;
	attachments: UpdateAttachmentItem[];
};

const MAX = 4000;

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

function badgeFor(
	u: CaseUpdateItem,
	viewerId: string,
	viewerRole: UpdateViewerRole,
): { text: string; cls: string } {
	if (u.authorId === viewerId) {
		return { text: "You", cls: "bg-green-soft text-green-deep" };
	}
	if (u.authorRole === "attorney") {
		return { text: "Attorney", cls: "bg-brass-wash text-brass-deep" };
	}
	return {
		text: viewerRole === "attorney" ? "Client" : "Plaintiff",
		cls: "bg-brass-wash text-brass-deep",
	};
}

function Attachments({ items }: { items: UpdateAttachmentItem[] }) {
	if (items.length === 0) return null;
	const images = items.filter((a) => a.contentType.startsWith("image/"));
	const files = items.filter((a) => !a.contentType.startsWith("image/"));
	return (
		<div className="mt-3 flex flex-col gap-2.5">
			{images.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{images.map((a) => (
						<a
							key={a.url}
							href={a.url}
							target="_blank"
							rel="noopener noreferrer"
							className="size-20 overflow-hidden rounded-[var(--radius-card-sm)] border border-border transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]"
						>
							<img
								src={a.url}
								alt={a.name}
								className="size-full object-cover"
							/>
						</a>
					))}
				</div>
			)}
			{files.map((a) => (
				<a
					key={a.url}
					href={a.url}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex w-fit items-center gap-2 rounded-[var(--radius-control)] border border-border bg-surface-2/40 px-3 py-2 font-medium text-[13px] text-ink transition-colors hover:border-brass-deep"
				>
					<FileText
						className="size-4 shrink-0 text-brass-deep"
						aria-hidden="true"
					/>
					{a.name}
				</a>
			))}
		</div>
	);
}

export function UpdateCard({
	u,
	viewerId,
	viewerRole,
	isNew,
	caseId,
}: {
	u: CaseUpdateItem;
	viewerId: string;
	viewerRole: UpdateViewerRole;
	isNew: boolean;
	caseId: string;
}) {
	const router = useRouter();
	const canEdit = u.authorId === viewerId;
	const [editing, setEditing] = useState(false);
	const [body, setBody] = useState(u.body);
	const [tag, setTag] = useState<string | null>(u.tag);
	const [pending, startTransition] = useTransition();

	const badge = badgeFor(u, viewerId, viewerRole);
	const tagCfg = tagConfig(u.tag);
	const TagIcon = tagCfg?.icon;
	const avatarTone =
		u.authorRole === "plaintiff" ? "bg-green-deep" : "bg-brass";

	function save() {
		const trimmed = body.trim();
		if (!trimmed) return;
		startTransition(async () => {
			const res = await editCaseUpdateAction({
				updateId: u.id,
				caseId,
				body: trimmed,
				...(tag ? { tag } : {}),
			});
			if (res.ok) {
				setEditing(false);
				toast.success("Update saved.");
				router.refresh();
			} else {
				toast.error(res.error);
			}
		});
	}

	function cancel() {
		setBody(u.body);
		setTag(u.tag);
		setEditing(false);
	}

	return (
		<article
			className={cn(
				"rounded-[var(--radius-card-lg)] border bg-surface p-5 shadow-[var(--shadow-rest)]",
				isNew
					? "border-gold-bright/70 ring-1 ring-gold-bright/40"
					: "border-border",
			)}
		>
			<div className="flex items-start gap-3">
				<span
					className={cn(
						"flex size-9 shrink-0 items-center justify-center rounded-full font-bold text-[12px] text-white",
						avatarTone,
					)}
				>
					{initials(u.authorName)}
				</span>
				<div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
					<span className="font-bold text-[14px] text-ink">{u.authorName}</span>
					<span
						className={cn(
							"rounded-full px-1.5 py-0.5 font-mono font-semibold text-[9.5px] uppercase tracking-[0.06em]",
							badge.cls,
						)}
					>
						{badge.text}
					</span>
					<span className="text-[12.5px] text-muted-foreground">
						<TimeAgo date={u.createdAt} />
						{u.editedAt ? " · edited" : ""}
					</span>
					{canEdit && !editing && (
						<button
							type="button"
							onClick={() => setEditing(true)}
							className="font-semibold text-[12.5px] text-brass-deep transition-colors hover:text-brass"
						>
							· Edit
						</button>
					)}
					{isNew && (
						<span className="rounded-full bg-gold-bright px-1.5 py-0.5 font-bold text-[9.5px] text-gold-bright-ink uppercase tracking-wide">
							New
						</span>
					)}
				</div>
				{tagCfg && TagIcon && !editing && (
					<span
						className={cn(
							"inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 font-semibold text-[11.5px]",
							TAG_TONE_CLASS[tagCfg.tone],
						)}
					>
						<TagIcon className="size-3.5" aria-hidden="true" />
						{tagCfg.label}
					</span>
				)}
			</div>

			{editing ? (
				<div className="mt-3">
					<textarea
						value={body}
						onChange={(e) => setBody(e.target.value.slice(0, MAX))}
						rows={3}
						aria-label="Edit update"
						className="w-full resize-y rounded-[var(--radius-control)] border border-border bg-surface-2/40 px-3.5 py-2.5 text-[14.5px] text-ink outline-none transition-colors focus:border-brass-deep"
					/>
					<div className="mt-2.5 flex flex-wrap gap-1.5">
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
					<div className="mt-3 flex items-center justify-end gap-2.5">
						<button
							type="button"
							onClick={cancel}
							disabled={pending}
							className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] px-3 font-semibold text-[13px] text-ink-soft transition-colors hover:text-ink disabled:opacity-60"
						>
							<X className="size-4" aria-hidden="true" />
							Cancel
						</button>
						<button
							type="button"
							onClick={save}
							disabled={pending || body.trim().length === 0}
							className="inline-flex h-9 items-center rounded-[var(--radius-control)] bg-brass px-4 font-bold text-[13px] text-white transition-colors hover:bg-brass-deep disabled:cursor-not-allowed disabled:opacity-50"
						>
							{pending ? "Saving…" : "Save changes"}
						</button>
					</div>
				</div>
			) : (
				<>
					<p className="mt-3 whitespace-pre-wrap text-[14.5px] text-ink-soft leading-relaxed">
						{u.body}
					</p>
					<Attachments items={u.attachments} />
				</>
			)}
		</article>
	);
}
