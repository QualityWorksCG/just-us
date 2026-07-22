import { cn } from "@just-us/ui/lib/utils";

export function Brandmark({
	className,
	size = 36,
}: {
	className?: string;
	size?: number;
}) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"inline-flex shrink-0 items-center justify-center rounded-[calc(var(--radius-control)+2px)] bg-brass text-brass-ink",
				className,
			)}
			style={{ width: size, height: size }}
		>
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="size-[55%]"
				aria-hidden="true"
				focusable="false"
			>
				<path d="M12 3v10" />
				<path d="M8 5h8" />
				<path d="M8 5 5.5 10a2.5 2.5 0 0 0 5 0Z" />
				<path d="M16 5 13.5 10a2.5 2.5 0 0 0 5 0Z" />
				<path d="M9 17h6" />
				<path d="M10 21h4" />
			</svg>
		</span>
	);
}
