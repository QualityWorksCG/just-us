import type { Role } from "@just-us/auth";

/**
 * The assistant's standing disclaimer. Pinned in the panel, never dismissible —
 * a user asking a legal-sounding question has to see it every time.
 */
export const DISCLAIMER =
	"Not a lawyer, and not legal advice. The assistant explains how JustUs works and reads your own account. For advice about your case, talk to your attorney.";

/** Opening prompts, worded for what each role's own screens are called. */
export const STARTERS: Record<Role, string[]> = {
	plaintiff: [
		"Where is my case?",
		"How does funding work?",
		"What should I do next?",
	],
	donor: [
		"Where did my donations go?",
		"Show my saved cases",
		"How do fees work?",
	],
	attorney: [
		"What's in my representation queue?",
		"Show the cases matched to me",
		"How does matching work?",
	],
	administrator: [
		"How do feature flags work?",
		"How do I manage users?",
		"What does moderation review?",
	],
};

/** Fallback name for a thread nobody has asked anything in yet. */
export const UNTITLED_CHAT = "New conversation";

/**
 * How long ago something happened, in the same shortened wording the admin
 * screens use. Takes the ISO string a server action serializes dates to.
 */
export function ago(iso: string) {
	const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
	if (s < 60) return "just now";
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	return `${Math.floor(h / 24)}d ago`;
}

/**
 * What a tool call is called in front of a user. The assistant's tool names are
 * implementation detail; the thread shows the plain-English act instead.
 */
const TOOL_LABELS: Record<string, { running: string; done: string }> = {
	getMyCases: { running: "Checking your cases", done: "Checked your cases" },
	getMyDonations: {
		running: "Checking your donations",
		done: "Checked your donations",
	},
	getSavedCases: {
		running: "Checking your saved cases",
		done: "Checked your saved cases",
	},
	getMyQueue: {
		running: "Checking your queue",
		done: "Checked your queue",
	},
	getMyMatches: {
		running: "Checking your matched cases",
		done: "Checked your matched cases",
	},
	searchPlatformHelp: { running: "Searching help", done: "Searched help" },
};

/** Label for a tool part, falling back to something honest for a new tool. */
export function toolLabel(name: string, running: boolean) {
	const label = TOOL_LABELS[name];
	if (label) return running ? label.running : label.done;
	return running ? "Looking something up" : "Looked something up";
}
