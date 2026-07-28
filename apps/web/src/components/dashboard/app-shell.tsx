"use client";

import type { Role } from "@just-us/auth";
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
import { Bell, LogOut } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Brandmark } from "@/components/brandmark";
import { authClient } from "@/lib/auth-client";
import { getRoleNav } from "@/lib/dashboard-nav";

/**
 * Shared by the dashboard header and page body so the header title and the page
 * heading always sit on the same left edge, at any window width and in both
 * sidebar states.
 *
 * Full-bleed by design: the content fills whatever width the sidebar leaves, with
 * only gutter padding. No max-width and no centring — the page grows with the
 * viewport instead of stranding a fixed column in the middle of a wide screen.
 */
const CONTENT_COLUMN = "w-full px-5 sm:px-8";

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
	defaultOpen,
	children,
}: {
	role: Role;
	name: string;
	email: string;
	/** Restored from the `sidebar_state` cookie so SSR matches the last choice. */
	defaultOpen: boolean;
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const nav = getRoleNav(role);

	const activeSlug =
		pathname === "/dashboard"
			? ""
			: (pathname.replace(/^\/dashboard\/?/, "").split("/")[0] ?? "");
	const current = nav.items.find((i) => i.slug === activeSlug) ?? nav.items[0];

	async function signOut() {
		await authClient.signOut();
		window.location.assign("/");
	}

	return (
		<SidebarProvider defaultOpen={defaultOpen}>
			{/*
				`collapsible="icon"` keeps an icon rail when collapsed rather than hiding
				the nav outright; on mobile the same markup renders in a sheet, which is
				new — the old sidebar was `hidden md:flex` with no mobile nav at all.
			*/}
			<Sidebar collapsible="icon">
				<SidebarHeader className="p-0">
					<Link
						href="/"
						className="flex items-center gap-3 border-sidebar-border border-b px-[18px] py-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
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
							{nav.items.map((item) => {
								const href = (
									item.slug ? `/dashboard/${item.slug}` : "/dashboard"
								) as Route;
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
						<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brass font-bold text-[12.5px] text-brass-ink group-data-[collapsible=icon]:size-8">
							{initials(name)}
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

			<div className="flex min-w-0 flex-1 flex-col bg-paper">
				{/*
					The header bar spans full width (border + background reach the edges) but
					its contents share the same centred, max-width column as <main> below —
					otherwise the header title sits flush left while the page heading is
					centred, and the gap between them changes every time the sidebar
					collapses. Keep CONTENT_COLUMN identical in both places.
				*/}
				<header className="sticky top-0 z-30 h-[60px] border-border border-b bg-surface">
					<div className={cn(CONTENT_COLUMN, "flex h-full items-center gap-3")}>
						<SidebarTrigger className="-ml-1 text-ink-soft" />
						<span className="flex-1 truncate font-bold text-[14px] text-ink">
							{current?.title}
						</span>
						<span
							className="flex size-9 items-center justify-center rounded-full border border-border text-ink-soft"
							aria-hidden="true"
						>
							<Bell className="size-[17px]" />
						</span>
					</div>
				</header>

				<main className={cn(CONTENT_COLUMN, "py-8 sm:py-10")}>{children}</main>
			</div>
		</SidebarProvider>
	);
}
