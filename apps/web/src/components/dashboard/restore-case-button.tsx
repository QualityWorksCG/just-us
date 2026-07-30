"use client";

import { RotateCcw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { restoreCaseAction } from "@/app/cases/actions";

export function RestoreCaseButton({ id }: { id: string }) {
	const [pending, startTransition] = useTransition();

	function restore() {
		startTransition(async () => {
			const res = await restoreCaseAction(id);
			if (res.ok) {
				toast.success("Case restored.");
			} else {
				toast.error(res.error);
			}
		});
	}

	return (
		<button
			type="button"
			onClick={restore}
			disabled={pending}
			className="inline-flex items-center gap-1.5 font-semibold text-[13px] text-brass-deep transition-colors hover:text-brass disabled:opacity-60"
		>
			<RotateCcw className="size-4" aria-hidden="true" />
			{pending ? "Restoring…" : "Restore"}
		</button>
	);
}
