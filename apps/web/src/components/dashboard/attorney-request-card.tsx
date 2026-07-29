"use client";

import { cn } from "@just-us/ui/lib/utils";
import { MessageCircle, Star, X } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { acceptRequestAction, declineRequestAction } from "@/app/cases/actions";

export type RequestView = {
	id: string;
	caseId: string;
	attorneyName: string;
	area: string | null;
	location: string | null;
	rating: number | null;
	casesCount: number | null;
	message: string;
	createdAgo: string;
	bestMatch: boolean;
};

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

export function AttorneyRequestCard({ request }: { request: RequestView }) {
	const router = useRouter();
	const [accepting, startAccept] = useTransition();
	const [declining, startDecline] = useTransition();

	const meta = [request.area, request.location].filter(Boolean).join(" · ");

	function accept() {
		startAccept(async () => {
			const res = await acceptRequestAction(request.id);
			if (res.ok) {
				toast.success(`${request.attorneyName} accepted — now agree the fee.`);
				router.push(`/cases/new?draft=${res.caseId}` as Route);
			} else {
				toast.error(res.error);
			}
		});
	}

	function decline() {
		startDecline(async () => {
			const res = await declineRequestAction(request.id, request.caseId);
			if (res.ok) {
				toast.success("Request declined.");
				router.refresh();
			} else {
				toast.error(res.error);
			}
		});
	}

	return (
		<div
			className={cn(
				"rounded-[var(--radius-card-lg)] border bg-surface p-5 shadow-[var(--shadow-rest)]",
				request.bestMatch ? "border-brass" : "border-border",
			)}
		>
			<div className="flex items-start gap-3">
				<span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brass font-bold text-[13px] text-white">
					{initials(request.attorneyName)}
				</span>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<p className="font-bold text-[15px] text-ink">
							{request.attorneyName}
						</p>
						{request.bestMatch && (
							<span className="rounded-[var(--radius-pill)] bg-brass-wash px-2 py-0.5 font-mono font-semibold text-[10px] text-brass-deep uppercase tracking-[0.06em]">
								Best match
							</span>
						)}
						<span className="ml-auto shrink-0 text-[12px] text-muted-foreground">
							{request.createdAgo}
						</span>
					</div>
					<p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground">
						{meta}
						{request.rating != null && (
							<>
								{meta ? "·" : null}
								<span className="inline-flex items-center gap-1">
									{request.rating.toFixed(1)}
									<Star
										className="size-3 fill-brass text-brass"
										aria-hidden="true"
									/>
								</span>
								{request.casesCount != null
									? `(${request.casesCount} cases)`
									: null}
							</>
						)}
					</p>
				</div>
			</div>

			<p className="mt-3 text-[14px] text-ink-soft leading-relaxed">
				{request.message}
			</p>

			<div className="mt-4 flex flex-wrap items-center gap-3">
				<button
					type="button"
					onClick={accept}
					disabled={accepting || declining}
					className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-control)] bg-brass px-4 font-semibold text-[13.5px] text-white transition-colors hover:bg-brass-deep disabled:opacity-70"
				>
					<MessageCircle className="size-4" aria-hidden="true" />
					{accepting ? "Accepting…" : "Accept & set fee"}
				</button>
				<button
					type="button"
					onClick={() => toast("Attorney profiles are coming soon.")}
					className="inline-flex h-10 items-center rounded-[var(--radius-control)] border border-border bg-surface px-4 font-semibold text-[13.5px] text-ink transition-colors hover:border-brass-deep"
				>
					View profile
				</button>
				<button
					type="button"
					onClick={decline}
					disabled={accepting || declining}
					className="ml-auto inline-flex items-center gap-1.5 font-semibold text-[13px] text-muted-foreground transition-colors hover:text-danger disabled:opacity-70"
				>
					<X className="size-4" aria-hidden="true" />
					{declining ? "Declining…" : "Decline"}
				</button>
			</div>
		</div>
	);
}
