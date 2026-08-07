// biome-ignore-all lint/performance/noImgElement: user-uploaded Blob covers aren't static assets
import { listMatchedCases } from "@just-us/db/representation";
import { cn } from "@just-us/ui/lib/utils";
import { ArrowRight, Briefcase, ImageIcon, Megaphone } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

function money(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

/**
 * The attorney's matched cases — the cases they represent and post updates from
 * (JUS-33). Each card links to the case detail, where the update composer and
 * the running list of posts live.
 */
export async function AttorneyCases({ attorneyId }: { attorneyId: string }) {
	const cases = await listMatchedCases(attorneyId);

	return (
		<div className="flex flex-col gap-6">
			<p className="text-[14.5px] text-ink-soft">
				Cases matched to you — post progress updates your backers can follow.
			</p>

			{cases.length === 0 ? (
				<div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border bg-surface px-6 py-16 text-center shadow-[var(--shadow-rest)]">
					<span className="flex size-12 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
						<Briefcase className="size-6" aria-hidden="true" />
					</span>
					<p className="font-bold text-[16px] text-ink">No matched cases yet</p>
					<p className="max-w-[42ch] text-[13.5px] text-muted-foreground leading-relaxed">
						When a plaintiff takes you forward from the representation queue,
						their case shows up here.
					</p>
				</div>
			) : (
				<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{cases.map((c) => {
						const goal = c.goalCents / 100;
						const raised = c.raisedCents / 100;
						const isLive = c.status === "live";
						const meta = [c.category, c.location].filter(Boolean).join(" · ");

						return (
							<Link
								key={c.id}
								href={`/my-cases/${c.id}` as Route}
								className="group flex flex-col overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)] transition-[transform,box-shadow,border-color] duration-[var(--dur-base)] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-hover)]"
							>
								<div className="relative aspect-[16/9] bg-surface-2">
									{c.coverImageUrl ? (
										<img
											src={c.coverImageUrl}
											alt=""
											className="size-full object-cover"
										/>
									) : (
										<div className="flex size-full items-center justify-center text-muted-foreground">
											<ImageIcon className="size-8" aria-hidden="true" />
										</div>
									)}
									<span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-surface/85 px-2.5 py-1 font-mono font-semibold text-[10px] text-ink uppercase tracking-[0.06em] backdrop-blur-sm">
										<span
											className={cn(
												"size-1.5 rounded-full",
												isLive ? "bg-success" : "bg-brass-deep",
											)}
										/>
										{isLive ? "Live" : "Matched"}
									</span>
								</div>

								<div className="flex flex-1 flex-col p-5">
									<h2 className="line-clamp-2 font-bold text-[17px] text-ink leading-snug">
										{c.title || "Untitled case"}
									</h2>
									<p className="mt-1 text-[12.5px] text-muted-foreground">
										{c.plaintiffName}
										{meta ? ` · ${meta}` : ""}
									</p>

									<div className="mt-3 flex-1">
										{isLive && (
											<p className="font-medium text-[13px] text-ink tabular-nums">
												{money(raised)} of {money(goal)} · {c.donorsCount}{" "}
												{c.donorsCount === 1 ? "donor" : "donors"}
											</p>
										)}
									</div>

									<div className="mt-4 flex items-center justify-between gap-3 border-border border-t pt-4">
										<span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-soft">
											<Megaphone
												className="size-4 text-brass-deep"
												aria-hidden="true"
											/>
											{c.updatesCount}{" "}
											{c.updatesCount === 1 ? "update" : "updates"}
										</span>
										<span className="inline-flex items-center gap-1.5 font-semibold text-[13px] text-brass-deep group-hover:underline">
											Post an update
											<ArrowRight className="size-3.5" aria-hidden="true" />
										</span>
									</div>
								</div>
							</Link>
						);
					})}
				</div>
			)}
		</div>
	);
}
