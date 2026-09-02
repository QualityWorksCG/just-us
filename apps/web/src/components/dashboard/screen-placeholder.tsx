import { Sparkles } from "lucide-react";

/** Empty sample screen — the shell is real; per-screen content lands later. */
export function ScreenPlaceholder({
	title,
	sub,
}: {
	title: string;
	sub: string;
}) {
	return (
		<div>
			<h1 className="font-extrabold text-[30px] text-ink tracking-[-0.02em]">
				{title}
			</h1>
			<p className="mt-2 max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				{sub}
			</p>

			<div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-border border-dashed bg-card px-6 py-16 text-center">
				<span className="flex size-11 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
					<Sparkles className="size-5" aria-hidden="true" />
				</span>
				<p className="font-bold text-[15px] text-ink">
					This screen is coming soon
				</p>
				<p className="max-w-[420px] text-[13.5px] text-muted-foreground leading-relaxed">
					The layout and navigation are wired up. Content for this screen will
					be built out next.
				</p>
			</div>
		</div>
	);
}
