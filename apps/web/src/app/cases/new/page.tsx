import { CaseWizard } from "@/components/cases/case-wizard";
import { requireOnboarded, requireRole } from "@/lib/auth-server";

// Full-page case-creation wizard. Plaintiffs land here straight after
// onboarding; other roles are bounced to their dashboard by requireRole.
export default async function NewCasePage() {
	await requireRole("plaintiff");
	const session = await requireOnboarded();
	return <CaseWizard name={session.user.name} />;
}
