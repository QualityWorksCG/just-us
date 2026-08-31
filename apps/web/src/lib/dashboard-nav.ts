import type { Role } from "@just-us/auth";
// Registry entry point: this module is imported by the client sidebar, so it must
// not reach the Prisma-backed package root.
import type { FlagKey, FlagState } from "@just-us/flags/registry";
import {
	BadgeCheck,
	Bookmark,
	Briefcase,
	Compass,
	Folder,
	Gavel,
	HandCoins,
	Inbox,
	LayoutDashboard,
	type LucideIcon,
	Megaphone,
	MessageSquare,
	Receipt,
	Scale,
	ScrollText,
	Settings,
	ShieldAlert,
	SlidersHorizontal,
	TrendingUp,
	Users,
} from "lucide-react";

export type NavItem = {
	/** The screen's identity, used to look it up and to key the sidebar. "" is the
	 *  role home. Not the URL — see `path`. */
	slug: string;
	label: string;
	icon: LucideIcon;
	title: string;
	sub: string;
	/**
	 * URL for this screen, when it isn't simply `/<slug>`. App screens live at the
	 * top level rather than behind a shared prefix, which means a couple of them
	 * would otherwise claim a path the public site already owns — so those say
	 * where they really live instead. Read it through `navPath`, never directly.
	 */
	path?: string;
	/**
	 * Gate this screen behind a feature flag (JUS-13). Absent means always shown.
	 * The flag hides the nav entry AND the route rejects when off — see
	 * `visibleNavItems` and the screen route's `requireFeature` call.
	 */
	flag?: FlagKey;
};

export type RoleNav = {
	/** Mono eyebrow under the wordmark in the sidebar. */
	eyebrow: string;
	roleLabel: string;
	items: NavItem[];
};

export const DASHBOARD_NAV: Record<Role, RoleNav> = {
	donor: {
		eyebrow: "JustUs Member",
		roleLabel: "JustUs Member",
		items: [
			{
				slug: "",
				label: "Dashboard",
				icon: LayoutDashboard,
				title: "Your giving dashboard",
				sub: "Your giving at a glance. Here's the difference you're making.",
			},
			{
				slug: "discover",
				label: "Discover Profiles",
				icon: Compass,
				title: "Discover cases",
				sub: "Find a case that matters to you: save it, share it, or support it today.",
			},
			{
				slug: "saved",
				label: "Saved",
				icon: Bookmark,
				title: "Saved cases",
				sub: "",
			},
			{
				slug: "donations",
				label: "My donations",
				icon: HandCoins,
				title: "My donations",
				sub: "Every gift you've given, and the causes behind them.",
			},
			{
				slug: "updates",
				label: "Updates",
				icon: Megaphone,
				title: "Updates",
				sub: "Automated updates from independent representatives and system events.",
			},
			{
				slug: "settings",
				label: "Profile & settings",
				icon: Settings,
				title: "Profile & settings",
				sub: "Manage your account details and privacy.",
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
				slug: "cases",
				// `/cases` is the public browse-cases page, so the plaintiff's own
				// cases live at `/my-cases`.
				path: "/my-cases",
				label: "My cases",
				icon: Folder,
				title: "My cases",
				sub: "Every case you've started: draft, raising, or resolved.",
			},
			{
				slug: "attorneys",
				// `/attorneys` is the public directory. This is the same directory
				// inside the app shell, so it needs a path of its own.
				path: "/find-attorney",
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
				slug: "settings",
				label: "Profile & settings",
				icon: Settings,
				title: "Profile & settings",
				sub: "Manage your account details and privacy.",
			},
		],
	},
	attorney: {
		eyebrow: "ATTORNEY",
		roleLabel: "Attorney",
		items: [
			{
				slug: "",
				label: "Dashboard",
				icon: LayoutDashboard,
				title: "Dashboard",
				sub: "Your caseload at a glance: what's live, what needs you, and what's raised.",
			},
			{
				slug: "cases",
				// Shares `/my-cases` with the plaintiff screen of the same name; that
				// route serves each role its own view.
				path: "/my-cases",
				label: "My intakes",
				icon: Briefcase,
				title: "My intakes",
				sub: "Intakes matched to you: detail, evidence, and funding.",
			},
			{
				slug: "queue",
				label: "Intake requests",
				icon: Inbox,
				title: "Intake requests",
				// Says "browse and filter" rather than promising the queue is already
				// narrowed to this attorney: nothing is filtered unless they ask, so
				// they can see every intake that needs someone (JUS-25).
				sub: "Intakes matched to you, plus open cases seeking an attorney. You decide who to put yourself forward for.",
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
				sub: "Manage your account details and privacy.",
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
				slug: "revenue",
				label: "Revenue",
				icon: Receipt,
				title: "Revenue & donations",
				sub: "Platform-fee revenue and donation activity across the platform.",
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
				// Phase 2, gated on the `investorTrack` flag (JUS-13). Hidden here and
				// rejected by the route until an administrator turns the flag on.
				slug: "investors",
				label: "Investors",
				icon: TrendingUp,
				title: "Investors",
				sub: "Investor accounts and the cases they are supporting.",
				flag: "investorTrack",
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
				sub: "Manage your account details and privacy.",
			},
		],
	},
};

/** Where every signed-in user starts. Each role's home renders different
 *  content, but they share one URL — `/` belongs to the marketing site. */
export const HOME_PATH = "/home";

/**
 * The URL for a nav item. `/<slug>` for most screens, `HOME_PATH` for the role
 * home, or the item's own `path` where the obvious name is already taken by a
 * public page.
 *
 * Everything that links to a screen goes through this, so the sidebar and the
 * routes can't disagree about where a screen lives.
 */
export function navPath(item: NavItem): string {
	if (item.path) return item.path;
	return item.slug ? `/${item.slug}` : HOME_PATH;
}

/**
 * The nav item a URL belongs to, for highlighting the sidebar. Matches the
 * longest path first, so `/my-cases/abc/requests` resolves to the My cases entry
 * rather than to whichever item happens to be checked first.
 */
export function findScreenByPath(
	role: Role | string | null | undefined,
	pathname: string,
): NavItem | undefined {
	const items = [...getRoleNav(role).items].sort(
		(a, b) => navPath(b).length - navPath(a).length,
	);
	return items.find((item) => {
		const path = navPath(item);
		return pathname === path || pathname.startsWith(`${path}/`);
	});
}

/**
 * Every top-level path the app shell owns.
 *
 * The marketing header uses this to stay out of the way. It already hides itself
 * for a signed-in user, but the client session arrives a beat after the first
 * paint — without this the marketing header would flash across an app screen on
 * every hard load, which is what the old `/dashboard` prefix used to prevent for
 * free.
 */
export const APP_PATHS: string[] = [
	...new Set(
		Object.values(DASHBOARD_NAV).flatMap((nav) => nav.items.map(navPath)),
	),
	// Not a nav entry: the attorney's case view, reached from the queue (JUS-25).
	"/queue",
	// Not a nav entry: the full notification list, reached from the header bell.
	"/notifications",
];

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

/**
 * The nav items a role should actually see, with flagged-off screens removed.
 * (JUS-13)
 *
 * Pure and synchronous so the client sidebar can call it with flag state handed
 * down from the server. This only controls what is *rendered* — the screen route
 * enforces the same flag server-side, because hiding a link is not a permission.
 */
export function visibleNavItems(
	role: Role | string | null | undefined,
	flags: FlagState,
): NavItem[] {
	return getRoleNav(role).items.filter(
		(item) => !item.flag || flags[item.flag],
	);
}
