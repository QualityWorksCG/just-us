import { cn } from "@just-us/ui/lib/utils";
import Image from "next/image";

export function Brandmark({
	className,
	size = 36,
}: {
	className?: string;
	size?: number;
}) {
	return (
		<Image
			src="/images/brandmark.png"
			alt=""
			width={size}
			height={size}
			priority
			className={cn("shrink-0 object-contain", className)}
			style={{ width: size, height: size }}
		/>
	);
}
