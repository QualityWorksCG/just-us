"use client";

import { useEffect, useRef, useState } from "react";

type CountUpProps = {
	/** Final numeric value to count to. */
	value: number;
	/** Text rendered before the number, e.g. "$". */
	prefix?: string;
	/** Text rendered after the number, e.g. "M" or "+". */
	suffix?: string;
	/** Decimal places to show (defaults to 0). */
	decimals?: number;
	/** Duration of the count in ms. */
	duration?: number;
	className?: string;
};

// easeOutCubic — fast start, gentle settle.
const ease = (t: number) => 1 - (1 - t) ** 3;

function format(n: number, decimals: number) {
	return n.toLocaleString("en-US", {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	});
}

/**
 * Counts from 0 up to `value` the first time it scrolls into view.
 * Respects prefers-reduced-motion by rendering the final value immediately.
 */
export function CountUp({
	value,
	prefix = "",
	suffix = "",
	decimals = 0,
	duration = 1400,
	className,
}: CountUpProps) {
	const ref = useRef<HTMLSpanElement | null>(null);
	const [display, setDisplay] = useState(0);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		const reduce = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (reduce) {
			setDisplay(value);
			return;
		}

		let raf = 0;
		let start = 0;
		const run = (now: number) => {
			if (!start) start = now;
			const t = Math.min(1, (now - start) / duration);
			setDisplay(value * ease(t));
			if (t < 1) raf = requestAnimationFrame(run);
		};

		const io = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					raf = requestAnimationFrame(run);
					io.disconnect();
				}
			},
			{ threshold: 0.4 },
		);
		io.observe(el);

		return () => {
			io.disconnect();
			cancelAnimationFrame(raf);
		};
	}, [value, duration]);

	return (
		<span ref={ref} className={className}>
			{prefix}
			{format(display, decimals)}
			{suffix}
		</span>
	);
}
