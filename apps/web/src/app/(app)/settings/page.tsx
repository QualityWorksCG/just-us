import { messageEmailPreferences } from "@just-us/db/messages";

import { MessageEmailSetting } from "@/components/messages/message-email-setting";
import { requireOnboarded } from "@/lib/auth-server";

export default async function SettingsPage() {
	const session = await requireOnboarded();
	const preferences = await messageEmailPreferences(
		session.user.id,
		"settings",
	);
	return (
		<div className="max-w-[760px]">
			<p className="text-[14.5px] text-ink-soft leading-relaxed">
				Manage your account, notifications, and privacy.
			</p>
			<section className="mt-8 rounded-[var(--radius-card-lg)] border border-border bg-surface p-6 shadow-[var(--shadow-rest)]">
				<h2 className="font-bold text-[18px] text-ink">
					Message notifications
				</h2>
				<p className="mt-2 text-[13.5px] text-muted-foreground leading-relaxed">
					Receive one email when someone sends a message while you are away from
					that conversation.
				</p>
				<MessageEmailSetting enabled={preferences.globalEmailEnabled} />
			</section>
		</div>
	);
}
