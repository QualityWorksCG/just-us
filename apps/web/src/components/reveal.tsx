"use client";

import type { ElementType, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type RevealProps = {
	children: ReactNode;
	/** Element to render as (defaults to div). */
	as?: ElementType;
	/** Stagger delay in ms before the reveal transition starts. */
	delay?: number;
	/** Reveal style: slide up, or scale in from slightly small. */
	variant?: "rise" | "scale";
	className?: string;
};

/**
 * Fades + moves its children into place the first time they scroll into view.
 * Respects prefers-reduced-motion by rendering fully visible immediately.
 */
export function Reveal({
	children,
	as: Tag = "div",
	delay = 0,
	variant = "rise",
	className,
}: RevealProps) {
	const ref = useRef<HTMLElement | null>(null);
	const [shown, setShown] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		const reduce = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (reduce) {
			setShown(true);
			return;
		}

		const io = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setShown(true);
					io.disconnect();
				}
			},
			{ threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
		);
		io.observe(el);

		return () => io.disconnect();
	}, []);

	const hidden =
		variant === "scale" ? "translateY(12px) scale(0.96)" : "translateY(22px)";

	return (
		<Tag
			ref={ref}
			className={className}
			style={{
				opacity: shown ? 1 : 0,
				transform: shown ? "none" : hidden,
				transition:
					"opacity 0.7s var(--ease-rise), transform 0.7s var(--ease-rise)",
				transitionDelay: `${delay}ms`,
			}}
		>
			{children}
		</Tag>
	);
}
