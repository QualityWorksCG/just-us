"use client";

import type { Role } from "@just-us/auth";
import type { FlagState } from "@just-us/flags/registry";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
} from "@just-us/ui/components/sidebar";
import { cn } from "@just-us/ui/lib/utils";
import { LogOut } from "lucide-react";
import type { Route } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Brandmark } from "@/components/brandmark";
import { AssistantLauncher } from "@/components/chat/assistant-launcher";
import {
	type BellNotification,
	NotificationBell,
} from "@/components/dashboard/notification-bell";
import { authClient } from "@/lib/auth-client";
import {
	findScreenByPath,
	getRoleNav,
	HOME_PATH,
	navPath,
	visibleNavItems,
} from "@/lib/dashboard-nav";

/**
 * Shared by the dashboard header and page body so the bar's controls line up with
 * the page's own left edge, at any window width and in both sidebar states.
 *
 * Full-bleed by design: the content fills whatever width the sidebar leaves, with
 * only gutter padding. No max-width and no centring — the page grows with the
 * viewport instead of stranding a fixed column in the middle of a wide screen.
 */
const CONTENT_COLUMN = "w-full px-6 sm:px-10 lg:px-12";

/**
 * The sidebar's brand block and the content header bar are two separate
 * bars whose bottom borders read as one continuous line across the viewport, so
 * they have to be exactly the same height. Pinning both to a fixed height keeps
 * them locked together — deriving the height from padding lets the taller
 * contents (the size-9 bell vs. the 30px brandmark) pull the borders apart.
 */
const CHROME_BAR_HEIGHT = "h-16";

/**
 * The assistant column drags in the AI SDK and a markdown renderer, so it is
 * fetched on first open rather than shipped with every app screen.
 */
const AssistantPanel = dynamic(
	() =>
		import("@/components/chat/assistant-panel").then((m) => m.AssistantPanel),
	{ ssr: false },
);

function initials(name: string) {
	return (
		name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? "")
			.join("") || "JU"
	);
}

export function AppShell({
	role,
	name,
	email,
	avatarUrl,
	defaultOpen,
	flags,
	messageUnreadCount = 0,
	notifications = [],
	notificationUnreadCount = 0,
	children,
}: {
	role: Role;
	name: string;
	email: string;
	/** The private object URL never leaves the server; this only enables its route. */
	/** Public Blob URL of the profile photo, or null to fall back to initials. */
	avatarUrl: string | null;
	/** Restored from the `sidebar_state` cookie so SSR matches the last choice. */
	defaultOpen: boolean;
	/** Feature-flag state from the server; hides flagged-off screens. (JUS-13) */
	flags: FlagState;
	messageUnreadCount?: number;
	/** Recent notification rows for the header bell (any role). */
	notifications?: BellNotification[];
	/** Total unread notifications — the bell badge count. */
	notificationUnreadCount?: number;
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const nav = getRoleNav(role);
	const items = visibleNavItems(role, flags);

	// The assistant column is a sibling of the page, so its state lives here
	// rather than in the header button. Kept in plain client state: this shell is
	// the layout for every app screen, so the column — and the conversation
	// inside it — already survives navigation without a cookie.
	const [assistantOpen, setAssistantOpen] = useState(false);
	// Sticky: once loaded the column stays mounted so the thread outlives a close.
	const [assistantMounted, setAssistantMounted] = useState(false);
	// The launcher is gone while the column is open, so it cannot watch for the
	// close that should hand focus back to it. This is that signal, read on the
	// mount the close puts it through.
	const [restoreLauncherFocus, setRestoreLauncherFocus] = useState(false);

	function setAssistant(next: boolean) {
		setAssistantOpen(next);
		if (!next) setRestoreLauncherFocus(true);
	}

	// The nav drops to its icon rail for as long as the assistant is open: the
	// screens size their columns off the viewport, not off the space they actually
	// get, so the ~13rem the rail gives back is what keeps page content from
	// running under the assistant. The user's own choice is remembered rather than
	// overwritten — closing the assistant restores it, and the cookie only moves
	// when they use the trigger themselves.
	const [navOpen, setNavOpen] = useState(defaultOpen);
	const assistantShown = flags.aiAssistant && assistantOpen;

	// The screen this URL belongs to — its title is the page heading in the bar
	// below, and its slug marks the active nav entry. Resolved from the registry
	// rather than by parsing the URL: screens sit at the top level and a couple of
	// them don't match their slug, so the path is the only thing that identifies
	// them. Falls back to the unfiltered list so a screen still names itself during
	// the render right after its flag is switched off.
	const current = findScreenByPath(role, pathname ?? "") ?? items[0];
	const activeSlug = current?.slug;
	// Messages fills the content pane edge-to-edge (list + thread), so drop the
	// usual page gutters and pin the main column to the viewport height.
	const isMessages = (pathname ?? "").startsWith("/messages");

	async function signOut() {
		await authClient.signOut();
		window.location.assign("/");
	}

	return (
		// `min-w-0` is load-bearing: the shell is a grid item in the root layout, so
		// without it the track grows to the row's min-content and the whole app —
		// assistant column included — is pushed off the right edge instead of the
		// page reflowing into the space that's left.
		<SidebarProvider
			open={assistantShown ? false : navOpen}
			onOpenChange={setNavOpen}
			className="min-w-0"
		>
			{/*
				`collapsible="icon"` keeps an icon rail when collapsed rather than hiding
				the nav outright; on mobile the same markup renders in a sheet, which is
				new — the old sidebar was `hidden md:flex` with no mobile nav at all.
			*/}
			<Sidebar collapsible="icon">
				<SidebarHeader className="p-0">
					{/* The role home, not `/` — a signed-in user is redirected off the
					    marketing page anyway (see proxy.ts), so pointing the mark there
					    would only bounce them back via a round trip. */}
					<Link
						href={HOME_PATH as Route}
						className={cn(
							CHROME_BAR_HEIGHT,
							"flex items-center gap-3 border-sidebar-border border-b px-[18px] group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
						)}
					>
						<Brandmark size={30} />
						{/* Wordmark is dropped in the icon rail; the mark alone carries it. */}
						<span className="leading-tight group-data-[collapsible=icon]:hidden">
							<span className="block font-extrabold text-[14px] text-paper/95">
								JustUs Financial
							</span>
							<span className="block font-mono text-[9px] text-paper/50 tracking-[0.13em]">
								{nav.eyebrow}
							</span>
						</span>
					</Link>
				</SidebarHeader>

				<SidebarContent>
					{/*
						p-2 in the rail is not cosmetic: the rail is 3rem and icon mode forces
						buttons to size-8 (2rem), so 0.5rem of padding each side is exactly
						what fits. p-3 leaves 1.5rem for a 2rem button and shoves it off-centre.
					*/}
					<SidebarGroup className="p-3 group-data-[collapsible=icon]:p-2">
						<SidebarMenu className="gap-0.5">
							{items.map((item) => {
								const href = navPath(item) as Route;
								const active = item.slug === activeSlug;
								return (
									<SidebarMenuItem key={item.slug || "home"}>
										<SidebarMenuButton
											// Tooltip only surfaces while collapsed — that's the
											// label's only home once the text is hidden.
											tooltip={item.label}
											isActive={active}
											className="h-auto rounded-[9px] px-3 py-2.5 font-semibold text-[13.5px]"
											render={
												<Link
													href={href}
													aria-current={active ? "page" : undefined}
												/>
											}
										>
											<item.icon className="size-[17px] shrink-0" />
											<span>{item.label}</span>
											{item.slug === "messages" && messageUnreadCount > 0 && (
												<span className="ml-auto rounded-full bg-brass px-1.5 py-0.5 font-bold text-[11px] text-brass-ink">
													{messageUnreadCount}
												</span>
											)}
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroup>
				</SidebarContent>

				<SidebarFooter className="border-sidebar-border border-t p-3 group-data-[collapsible=icon]:p-2">
					<div className="flex items-center gap-2.5 px-2.5 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
						{/* size-9 overflows the 2rem rail slot, so drop to size-8 there. */}
						<span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brass font-bold text-[12.5px] text-brass-ink group-data-[collapsible=icon]:size-8">
							{avatarUrl ? (
								// biome-ignore lint/performance/noImgElement: user-uploaded Blob URL, not a static asset
								<img
									src={avatarUrl}
									alt=""
									className="size-full object-cover"
								/>
							) : (
								initials(name)
							)}
						</span>
						<span className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
							<span className="block truncate font-bold text-[13px] text-paper/92">
								{name}
							</span>
							<span className="block truncate text-[11.5px] text-paper/48">
								{email}
							</span>
						</span>
					</div>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip="Sign out"
								onClick={signOut}
								className="h-auto rounded-[9px] px-3 py-2 font-semibold text-[13px] text-sidebar-foreground/80"
							>
								<LogOut className="size-4 shrink-0" />
								<span>Sign out</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>

				{/* Drag/click edge to toggle, in addition to the header trigger. */}
				<SidebarRail />
			</Sidebar>

			<div
				className={cn(
					"flex min-w-0 flex-1 flex-col bg-paper",
					isMessages && "h-svh overflow-hidden",
				)}
			>
				{/*
					The header bar spans full width (border + background reach the edges) but
					its contents share the same column as <main> below, so the sidebar
					toggle sits on the same left edge as the page heading beneath it.
					Keep CONTENT_COLUMN identical in both places.
				*/}
				<header
					className={cn(
						"z-30 border-border border-b bg-surface",
						isMessages ? "shrink-0" : "sticky top-0",
					)}
				>
					<div
						className={cn(
							CONTENT_COLUMN,
							CHROME_BAR_HEIGHT,
							"flex items-center gap-3",
						)}
					>
						<SidebarTrigger className="-ml-1 text-ink-soft" />
						{/*
							The screen title lives here and only here — pages no longer repeat
							it. It's the page's <h1>, not a decorative label: the title comes
							from the route, so this is the real document heading and marking it
							up as one keeps a single, correct h1 per screen. Pages with a
							heading of their own (a greeting, a case title) use <h2> beneath it.
						*/}
						{/*
							Sized as a heading, not a label. It carries the weight the old
							on-page h1 had (extrabold, negative tracking) at a size that still
							clears the 64px bar — the bell is the tallest thing in here at 36px,
							so there's room to be assertive without pushing the bar's border out
							of line with the sidebar's.
						*/}
						<h1 className="flex-1 truncate font-extrabold text-[19px] text-ink tracking-[-0.02em]">
							{current?.title}
						</h1>
						<NotificationBell
							items={notifications}
							unreadCount={notificationUnreadCount}
							poll
							emptyHint={
								role === "plaintiff"
									? "Attorney requests and case updates will show up here."
									: role === "donor"
										? "Updates on cases you follow will show up here."
										: "New notifications will show up here."
							}
						/>
						{/* The assistant sits beside the bell when its flag is on; with the
						    flag off there is no entry point to the assistant anywhere in the
						    app. While the column is open the launcher is dropped entirely —
						    the panel's own header is right beside it, so the button would
						    only repeat it.

						    The flag-off branch used to hold this slot with a decorative,
						    aria-hidden bell. The NotificationBell above is the real thing, so
						    the placeholder is gone rather than sitting next to its own
						    replacement. */}
						{flags.aiAssistant && !assistantOpen && (
							<AssistantLauncher
								restoreFocus={restoreLauncherFocus}
								onOpen={() => {
									setAssistantMounted(true);
									setAssistant(true);
								}}
							/>
						)}
					</div>
				</header>

				<main
					className={
						isMessages
							? "flex min-h-0 flex-1 flex-col overflow-hidden"
							: cn(CONTENT_COLUMN, "pt-5 pb-10")
					}
				>
					{children}
				</main>
			</div>

			{/*
				Outside the column above, so the assistant is a third flex child of the
				shell rather than something floating over the page: opening it narrows
				the header and <main> together, which is the whole point of the column
				and also keeps CONTENT_COLUMN doing its job — the two stay aligned
				because they still share one shrinking parent.
			*/}
			{flags.aiAssistant && assistantMounted && (
				<AssistantPanel
					open={assistantOpen}
					onOpenChange={setAssistant}
					role={role}
				/>
			)}
		</SidebarProvider>
	);
}
