import { getResumableDraft } from "@just-us/db/cases";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import {
	ArrowRight,
	CircleCheck,
	Handshake,
	type LucideIcon,
	Pencil,
	Rocket,
	Scale,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { requireRole } from "@/lib/auth-server";

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
	{
		icon: Pencil,
		title: "Your case",
		body: "Title, story, and any evidence.",
	},
	{
		icon: Scale,
		title: "Choose your attorney",
		body: "Accept an interested one, or pick from the directory.",
	},
	{
		icon: Handshake,
		title: "Agree the fee",
		body: "Set the fee together. It becomes your goal.",
	},
	{
		icon: Rocket,
		title: "Go live",
		body: "Publish and start raising right away.",
	},
];

const ASSURANCES = [
	"Free to start",
	"You choose your attorney",
	"Funds land in your account",
];

export default async function StartNewCasePage() {
	const { session } = await requireRole("plaintiff");
	const draft = await getResumableDraft(session.user.id);

	let draftReadiness = 0;
	if (draft) {
		const evidenceCount = Array.isArray(draft.evidence)
			? draft.evidence.length
			: 0;
		draftReadiness =
			(draft.story.trim().length >= 120 ? 25 : 0) +
			(draft.attorneyName ? 25 : 0) +
			(draft.goalCents > 0 ? 25 : 0) +
			(draft.coverImageUrl ? 15 : 0) +
			(evidenceCount > 0 ? 10 : 0);
	}

	return (
		<div className="flex max-w-[1120px] flex-col gap-8">
			<div>
				<BackLink
					href={"/my-cases" as Route}
					label="Back to my cases"
					className="mb-3"
				/>
				<h2 className="font-extrabold text-[clamp(1.875rem,3vw,2.5rem)] text-ink tracking-[-0.03em]">
					Start a new case
				</h2>
				<p className="mt-2.5 max-w-[620px] text-[15px] text-ink-soft leading-relaxed">
					Tell your story, choose your own attorney, and let the public fund
					your day in court. Free to start. Nothing goes public until you
					publish.
				</p>
			</div>

			{draft && (
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-brass bg-surface px-5 py-3.5 shadow-[var(--shadow-rest)]">
					<p className="flex items-center gap-2 text-[13.5px] text-ink">
						<Pencil className="size-4 text-brass-deep" aria-hidden="true" />
						You have a draft in progress:{" "}
						<span className="font-bold">
							“{draft.title || "Untitled case"}”
						</span>{" "}
						({draftReadiness}%)
					</p>
					<Link
						href={`/cases/new?draft=${draft.id}` as Route}
						className="inline-flex items-center gap-1.5 font-semibold text-[13px] text-brass-deep hover:underline"
					>
						Continue draft
						<ArrowRight className="size-3.5" aria-hidden="true" />
					</Link>
				</div>
			)}

			<div>
				<p className="mb-4 font-mono font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.1em]">
					How it works · 4 steps
				</p>
				<div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-4">
					{STEPS.map((s, i) => {
						// Icon tiles alternate warm gold / sage green across the row.
						const tint =
							i % 2 === 0
								? "bg-brass-wash text-brass-deep"
								: "bg-green-soft text-green-deep";
						return (
							<div
								key={s.title}
								className="flex h-full flex-col rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]"
							>
								<div className="mb-5 flex items-center justify-between">
									<span
										className={cn(
											"flex size-10 items-center justify-center rounded-xl",
											tint,
										)}
									>
										<s.icon className="size-5" aria-hidden="true" />
									</span>
									<span className="font-display font-extrabold text-[28px] text-brass/25 leading-none">
										{i + 1}
									</span>
								</div>
								<p className="font-bold text-[15px] text-ink">{s.title}</p>
								<p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">
									{s.body}
								</p>
							</div>
						);
					})}
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
				{ASSURANCES.map((a) => (
					<span
						key={a}
						className="inline-flex items-center gap-2 text-[13px] text-ink-soft"
					>
						<CircleCheck className="size-4 text-success" aria-hidden="true" />
						{a}
					</span>
				))}
			</div>

			<div className="flex flex-wrap items-center gap-4">
				<Link
					href={"/cases/new" as Route}
					className={cn(buttonVariants({ size: "lg" }), "px-6")}
				>
					<ArrowRight data-icon="inline-start" aria-hidden="true" />
					Start my case
				</Link>
				<span className="text-[13px] text-muted-foreground">
					Takes about 10 minutes · saved as you go
				</span>
			</div>
		</div>
	);
}
