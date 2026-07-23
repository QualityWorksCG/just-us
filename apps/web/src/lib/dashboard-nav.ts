import type { Role } from "@just-us/auth";
import {
	BadgeCheck,
	Bookmark,
	Briefcase,
	Compass,
	FilePlus2,
	Gavel,
	HeartHandshake,
	Inbox,
	LayoutDashboard,
	type LucideIcon,
	Megaphone,
	MessageSquare,
	Scale,
	ScrollText,
	Settings,
	ShieldAlert,
	ShieldCheck,
	SlidersHorizontal,
	Users,
} from "lucide-react";

export type NavItem = {
	/** Path segment after /dashboard; "" is the role home. */
	slug: string;
	label: string;
	icon: LucideIcon;
	title: string;
	sub: string;
};

export type RoleNav = {
	/** Mono eyebrow under the wordmark in the sidebar. */
	eyebrow: string;
	roleLabel: string;
	items: NavItem[];
};

export const DASHBOARD_NAV: Record<Role, RoleNav> = {
	donor: {
		eyebrow: "DONOR",
		roleLabel: "Donor",
		items: [
			{
				slug: "",
				label: "Browse cases",
				icon: Compass,
				title: "Browse cases",
				sub: "Every case here has a bar-verified attorney the plaintiff chose, and an agreed fee. Donations are gifts.",
			},
			{
				slug: "saved",
				label: "Saved cases",
				icon: Bookmark,
				title: "Saved cases",
				sub: "Cases you've saved to come back to.",
			},
			{
				slug: "donations",
				label: "My donations",
				icon: HeartHandshake,
				title: "My donations",
				sub: "Every case you've backed, with its latest status.",
			},
			{
				slug: "settings",
				label: "Profile & settings",
				icon: Settings,
				title: "Profile & settings",
				sub: "Manage your account, notifications, and privacy.",
			},
		],
	},
	plaintiff: {
		eyebrow: "PLAINTIFF",
		roleLabel: "Plaintiff",
		items: [
			{
				slug: "",
				label: "Dashboard",
				icon: LayoutDashboard,
				title: "Your case dashboard",
				sub: "One flow from start to finish: submit, choose your attorney, agree the fee, and raise it.",
			},
			{
				slug: "submit",
				label: "Submit a case",
				icon: FilePlus2,
				title: "Submit a case",
				sub: "Tell us what happened. A person reviews every case before it can go public.",
			},
			{
				slug: "attorneys",
				label: "Find an attorney",
				icon: Gavel,
				title: "Find an attorney",
				sub: "Browse bar-verified attorneys and choose who represents you.",
			},
			{
				slug: "representation",
				label: "My representation",
				icon: Scale,
				title: "My representation",
				sub: "Your attorney, the agreed fee, and where funding stands.",
			},
			{
				slug: "updates",
				label: "Case updates",
				icon: Megaphone,
				title: "Case updates",
				sub: "Every update your attorney posts, through to the outcome.",
			},
			{
				slug: "messages",
				label: "Messages",
				icon: MessageSquare,
				title: "Messages",
				sub: "Your conversation with your attorney.",
			},
			{
				slug: "verification",
				label: "Verification",
				icon: ShieldCheck,
				title: "Verification",
				sub: "Verify your identity so your case can be listed and funded.",
			},
			{
				slug: "settings",
				label: "Profile & settings",
				icon: Settings,
				title: "Profile & settings",
				sub: "Manage your account, notifications, and privacy.",
			},
		],
	},
	attorney: {
		eyebrow: "ATTORNEY",
		roleLabel: "Attorney",
		items: [
			{
				slug: "",
				label: "Representation queue",
				icon: Inbox,
				title: "Representation queue",
				sub: "Plaintiffs seeking representation in your jurisdiction and practice areas.",
			},
			{
				slug: "cases",
				label: "My cases",
				icon: Briefcase,
				title: "My cases",
				sub: "Cases matched to you — detail, evidence, and funding.",
			},
			{
				slug: "messages",
				label: "Messages",
				icon: MessageSquare,
				title: "Messages",
				sub: "Your conversations with plaintiffs and clients.",
			},
			{
				slug: "profile",
				label: "Directory profile",
				icon: BadgeCheck,
				title: "Directory profile",
				sub: "How you appear in the attorney directory. Shown once your bar standing is verified.",
			},
			{
				slug: "settings",
				label: "Profile & settings",
				icon: Settings,
				title: "Profile & settings",
				sub: "Manage your account, notifications, and privacy.",
			},
		],
	},
	administrator: {
		eyebrow: "ADMINISTRATOR",
		roleLabel: "Administrator",
		items: [
			{
				slug: "",
				label: "Overview",
				icon: LayoutDashboard,
				title: "Platform overview",
				sub: "Health of the platform at a glance.",
			},
			{
				slug: "moderation",
				label: "Moderation",
				icon: ShieldAlert,
				title: "Moderation",
				sub: "Review flagged and pending cases. Nothing publishes without a person's ruling.",
			},
			{
				slug: "campaigns",
				label: "Campaigns",
				icon: Megaphone,
				title: "All campaigns",
				sub: "Every case on the platform and its funding status.",
			},
			{
				slug: "users",
				label: "Users",
				icon: Users,
				title: "Users",
				sub: "Plaintiffs, donors, attorneys, and administrators.",
			},
			{
				slug: "configuration",
				label: "Configuration",
				icon: SlidersHorizontal,
				title: "Configuration",
				sub: "Where the platform is permitted to operate, and platform settings.",
			},
			{
				slug: "audit",
				label: "Audit log",
				icon: ScrollText,
				title: "Audit log",
				sub: "A record of administrative actions.",
			},
			{
				slug: "settings",
				label: "Profile & settings",
				icon: Settings,
				title: "Profile & settings",
				sub: "Manage your account, notifications, and privacy.",
			},
		],
	},
};

const FALLBACK_ROLE: Role = "donor";

export function getRoleNav(role: Role | string | null | undefined): RoleNav {
	return DASHBOARD_NAV[
		(role as Role) in DASHBOARD_NAV ? (role as Role) : FALLBACK_ROLE
	];
}

/** Find a screen by slug for a role; slug "" resolves to the role home. */
export function findScreen(
	role: Role | string | null | undefined,
	slug: string,
): NavItem | undefined {
	return getRoleNav(role).items.find((item) => item.slug === slug);
}
