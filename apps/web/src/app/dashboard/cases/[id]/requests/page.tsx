import { getOwnedCase } from "@just-us/db/cases";
import { listCaseRequests } from "@just-us/db/requests";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { ArrowRight, Check, Clock, Search } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
	AttorneyRequestCard,
	type RequestView,
} from "@/components/dashboard/attorney-request-card";
import { BackLink } from "@/components/dashboard/back-link";
import { requireRole } from "@/lib/auth-server";

function ago(date: Date) {
	const s = Math.floor((Date.now() - date.getTime()) / 1000);
	if (s < 60) return "just now";
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	return `${Math.floor(h / 24)}d ago`;
}

const STEPS = ["Published", "Request received", "You choose", "Live"] as const;

export default async function CaseRequestsPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { session } = await requireRole("plaintiff");
	const { id } = await params;
	const c = await getOwnedCase(id, session.user.id);
	if (!c || c.deletedAt) notFound();
	// The requests inbox only makes sense while the case is out to attorneys.
	if (c.status !== "seeking") redirect(`/dashboard/cases/${id}` as Route);

	const rows = await listCaseRequests(id, session.user.id);
	const requests: RequestView[] = rows.map((r, i) => ({
		id: r.id,
		caseId: r.caseId,
		attorneyName: r.attorneyName,
		area: r.area,
		location: r.location,
		rating: r.rating,
		casesCount: r.casesCount,
		message: r.message,
		createdAgo: ago(r.createdAt),
		bestMatch: rows.length > 1 && i === 0,
	}));

	const hasRequests = requests.length > 0;
	// Stepper: Published always done; Request received once any arrive.
	const activeStep = hasRequests ? 2 : 1;

	return (
		<div className="mx-auto flex max-w-[760px] flex-col gap-6">
			<div>
				<BackLink
					href={"/dashboard/cases" as Route}
					label="Back to my cases"
					className="mb-3"
				/>
				{hasRequests && (
					<span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-green-soft px-3 py-1 font-mono font-semibold text-[11px] text-green-deep uppercase tracking-[0.06em]">
						<span className="size-1.5 rounded-full bg-success" />
						{requests.length} new{" "}
						{requests.length === 1 ? "request" : "requests"}
					</span>
				)}
				<h1 className="mt-3 font-extrabold text-[clamp(1.75rem,3.4vw,2.375rem)] text-ink tracking-[-0.03em]">
					{hasRequests
						? "Attorneys want to represent you"
						: "Your case is out to attorneys"}
				</h1>
				<p className="mt-2 max-w-[58ch] text-[14.5px] text-ink-soft leading-relaxed">
					{hasRequests
						? "Review each request and accept the one that fits. Accepting sets your attorney and moves you to agree the fee — nothing's final until you publish."
						: "Bar-listed attorneys can request to represent “" +
							(c.title || "your case") +
							"”. You'll see their requests here — or choose an attorney yourself anytime."}
				</p>
			</div>

			{/* Progress stepper */}
			<ol className="flex items-center gap-2 overflow-x-auto pb-1">
				{STEPS.map((label, i) => {
					const done = i < activeStep;
					const active = i === activeStep;
					return (
						<li key={label} className="flex flex-1 items-center gap-2">
							<span
								className={cn(
									"flex size-5 shrink-0 items-center justify-center rounded-full text-[11px]",
									done && "bg-success text-white",
									active && "border-2 border-brass text-brass-deep",
									!done &&
										!active &&
										"border border-line-strong text-muted-foreground",
								)}
							>
								{done ? <Check className="size-3" aria-hidden="true" /> : null}
							</span>
							<span
								className={cn(
									"whitespace-nowrap text-[12.5px]",
									done || active
										? "font-semibold text-ink"
										: "text-muted-foreground",
								)}
							>
								{label}
							</span>
							{i < STEPS.length - 1 && (
								<span className="h-px flex-1 bg-border" />
							)}
						</li>
					);
				})}
			</ol>

			{/* Requests, or an empty state */}
			{hasRequests ? (
				<div className="flex flex-col gap-4">
					{requests.map((r) => (
						<AttorneyRequestCard key={r.id} request={r} />
					))}
				</div>
			) : (
				<div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border border-dashed bg-surface px-6 py-12 text-center">
					<span className="flex size-12 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
						<Clock className="size-6" aria-hidden="true" />
					</span>
					<p className="font-bold text-[16px] text-ink">
						Waiting on attorney requests
					</p>
					<p className="max-w-[46ch] text-[13.5px] text-muted-foreground leading-relaxed">
						Bar-listed attorneys can request to represent your case. They'll
						appear here — but you don't have to wait.
					</p>
					<Link
						href={`/cases/new?draft=${id}` as Route}
						className={cn(buttonVariants({ size: "lg" }), "mt-1 px-5")}
					>
						<Search data-icon="inline-start" aria-hidden="true" />
						Choose an attorney yourself
					</Link>
				</div>
			)}

			{/* Footer note */}
			<div className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-border bg-surface/60 px-5 py-3.5 text-[12.5px] text-ink-soft leading-relaxed">
				<ArrowRight
					className="mt-0.5 size-4 shrink-0 text-brass-deep"
					aria-hidden="true"
				/>
				Accepting sets your attorney and moves you to agree the fee. You can
				decline and keep waiting — more attorneys may still request your case.
			</div>
		</div>
	);
}
