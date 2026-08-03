"use client";

import { Button } from "@just-us/ui/components/button";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { resolveConversationReportAction } from "@/app/(app)/message-actions";

export function ResolveConversationReportButton({
	reportId,
}: {
	reportId: string;
}) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();

	return (
		<Button
			type="button"
			size="lg"
			onClick={() =>
				startTransition(async () => {
					const result = await resolveConversationReportAction(reportId);
					if (!result.ok) {
						toast.error(result.error);
						return;
					}
					toast.success("Report marked resolved.");
					router.refresh();
				})
			}
			disabled={pending}
		>
			<Check data-icon="inline-start" />
			{pending ? "Resolving…" : "Mark resolved"}
		</Button>
	);
}
