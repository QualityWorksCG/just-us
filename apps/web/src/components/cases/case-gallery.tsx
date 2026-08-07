// biome-ignore-all lint/performance/noImgElement: case photos are user-uploaded Blob URLs, not static assets
"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

/**
 * The case's supporting photos as small thumbnails, with a click-to-enlarge
 * lightbox. Thumbnails stay compact so the gallery doesn't dominate the page;
 * anyone who wants a closer look clicks through to a full-size view with
 * keyboard (←/→/Esc) and on-screen navigation.
 */
export function CaseGallery({ images }: { images: string[] }) {
	// Index of the photo shown in the lightbox, or null when it's closed.
	const [active, setActive] = useState<number | null>(null);
	const count = images.length;

	const close = useCallback(() => setActive(null), []);
	const step = useCallback(
		(delta: number) =>
			setActive((i) => (i === null ? i : (i + delta + count) % count)),
		[count],
	);

	// Keyboard control while the lightbox is open.
	useEffect(() => {
		if (active === null) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") close();
			else if (e.key === "ArrowRight") step(1);
			else if (e.key === "ArrowLeft") step(-1);
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [active, close, step]);

	if (count === 0) return null;

	return (
		<>
			<div className="flex flex-wrap gap-2.5">
				{images.map((url, i) => (
					<button
						key={url}
						type="button"
						onClick={() => setActive(i)}
						aria-label={`View photo ${i + 1} of ${count}`}
						className="size-20 overflow-hidden rounded-[var(--radius-card-sm)] border border-border transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)] focus-visible:outline-2 focus-visible:outline-brass-deep focus-visible:outline-offset-2 sm:size-24"
					>
						<img
							src={url}
							alt=""
							className="size-full object-cover transition-transform duration-[var(--dur-base)] hover:scale-[1.05]"
						/>
					</button>
				))}
			</div>

			{active !== null && (
				<div
					className="fixed inset-0 z-[100] flex items-center justify-center p-4"
					role="dialog"
					aria-modal="true"
					aria-label={`Photo ${active + 1} of ${count}`}
				>
					{/* The backdrop is a real button, so closing works by click and by
					    keyboard. The image and controls are siblings painted above it, so
					    clicking them never falls through to a close. */}
					<button
						type="button"
						onClick={close}
						aria-label="Close photo viewer"
						className="absolute inset-0 bg-ink/85 backdrop-blur-sm"
					/>

					<button
						type="button"
						onClick={close}
						aria-label="Close"
						className="absolute top-4 right-4 z-10 flex size-10 items-center justify-center rounded-full bg-surface/15 text-white transition-colors hover:bg-surface/25"
					>
						<X className="size-5" aria-hidden="true" />
					</button>

					{count > 1 && (
						<button
							type="button"
							onClick={() => step(-1)}
							aria-label="Previous photo"
							className="absolute left-4 z-10 flex size-11 items-center justify-center rounded-full bg-surface/15 text-white transition-colors hover:bg-surface/25"
						>
							<ChevronLeft className="size-6" aria-hidden="true" />
						</button>
					)}

					<img
						src={images[active]}
						alt=""
						className="relative max-h-[85vh] max-w-[90vw] rounded-[var(--radius-card)] object-contain shadow-[var(--shadow-modal)]"
					/>

					{count > 1 && (
						<>
							<button
								type="button"
								onClick={() => step(1)}
								aria-label="Next photo"
								className="absolute right-4 z-10 flex size-11 items-center justify-center rounded-full bg-surface/15 text-white transition-colors hover:bg-surface/25"
							>
								<ChevronRight className="size-6" aria-hidden="true" />
							</button>
							<span className="absolute bottom-5 z-10 rounded-full bg-ink/60 px-3 py-1 font-semibold text-[12px] text-white tabular-nums">
								{active + 1} / {count}
							</span>
						</>
					)}
				</div>
			)}
		</>
	);
}
