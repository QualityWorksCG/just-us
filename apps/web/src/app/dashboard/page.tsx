import type { Role } from "@just-us/auth";

import { requireOnboarded } from "@/lib/auth-server";

import Dashboard from "./dashboard";

export const metadata = { title: "Dashboard" };

const ROLE_LABEL: Record<Role, string> = {
	plaintiff: "Plaintiff",
	donor: "Donor",
	attorney: "Attorney",
	administrator: "Administrator",
};

export default async function DashboardPage() {
	// Requires a verified, onboarded session (JUS-11); unverified users go to
	// /verify-email and not-yet-onboarded users go to /onboarding, server-side.
	const session = await requireOnboarded();
	const role = (session.user as { role?: Role }).role ?? "donor";

	return (
		<main className="mx-auto h-full w-full max-w-[1180px] overflow-y-auto px-6 py-12">
			<p className="mb-2 font-mono font-semibold text-[12px] text-brass-deep uppercase tracking-[0.08em]">
				{ROLE_LABEL[role]}
			</p>
			<h1 className="font-extrabold text-[30px] text-ink tracking-[-0.02em]">
				Welcome, {session.user.name}
			</h1>
			<p className="mt-2 text-[14.5px] text-ink-soft">
				You're signed in as a {ROLE_LABEL[role].toLowerCase()}. Your dashboard
				for this role is coming next.
			</p>
			<Dashboard session={session} />
		</main>
	);
}
