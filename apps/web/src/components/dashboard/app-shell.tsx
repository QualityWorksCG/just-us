"use client";

import type { Role } from "@just-us/auth";
import { cn } from "@just-us/ui/lib/utils";
import { Bell, ExternalLink, LogOut } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Brandmark } from "@/components/brandmark";
import { authClient } from "@/lib/auth-client";
import { getRoleNav } from "@/lib/dashboard-nav";

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
	children,
}: {
	role: Role;
	name: string;
	email: string;
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
		<div className="grid min-h-svh grid-cols-1 md:grid-cols-[252px_1fr]">
			{/* Sidebar */}
			<aside className="sticky top-0 hidden h-svh flex-col bg-ink text-paper/72 md:flex">
				<Link
					href="/"
					className="flex items-center gap-3 border-paper/10 border-b px-[18px] py-4"
				>
					<Brandmark size={30} />
					<span className="leading-tight">
						<span className="block font-extrabold text-[14px] text-paper/95">
							JustUs Financial
						</span>
						<span className="block font-mono text-[9px] text-paper/50 tracking-[0.13em]">
							{nav.eyebrow}
						</span>
					</span>
				</Link>

				<nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
					{nav.items.map((item) => {
						const href = (
							item.slug ? `/dashboard/${item.slug}` : "/dashboard"
						) as Route;
						const active = item.slug === activeSlug;
						return (
							<Link
								key={item.slug || "home"}
								href={href}
								aria-current={active ? "page" : undefined}
								className={cn(
									"flex items-center gap-3 rounded-[9px] px-3 py-2.5 font-semibold text-[13.5px] transition-colors",
									active
										? "bg-paper/13 text-paper"
										: "text-paper/72 hover:bg-paper/10 hover:text-paper/90",
								)}
							>
								<item.icon
									className="size-[17px] shrink-0"
									aria-hidden="true"
								/>
								{item.label}
							</Link>
						);
					})}
				</nav>

				<div className="border-paper/10 border-t p-3">
					<div className="flex items-center gap-2.5 px-2.5 py-2">
						<span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brass font-bold text-[12.5px] text-brass-ink">
							{initials(name)}
						</span>
						<span className="min-w-0 leading-tight">
							<span className="block truncate font-bold text-[13px] text-paper/92">
								{name}
							</span>
							<span className="block truncate text-[11.5px] text-paper/48">
								{email}
							</span>
						</span>
					</div>
					<Link
						href="/"
						className="flex items-center gap-3 rounded-[9px] px-3 py-2 font-semibold text-[13px] text-paper/60 transition-colors hover:bg-paper/10 hover:text-paper/90"
					>
						<ExternalLink className="size-4 shrink-0" aria-hidden="true" />
						View public site
					</Link>
					<button
						type="button"
						onClick={signOut}
						className="flex w-full items-center gap-3 rounded-[9px] px-3 py-2 font-semibold text-[13px] text-paper/60 transition-colors hover:bg-paper/10 hover:text-paper/90"
					>
						<LogOut className="size-4 shrink-0" aria-hidden="true" />
						Sign out
					</button>
				</div>
			</aside>

			{/* Main */}
			<div className="flex min-w-0 flex-col bg-paper">
				<header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-border border-b bg-surface px-5 sm:px-7">
					{/* mobile brand */}
					<Link href="/dashboard" className="flex items-center gap-2 md:hidden">
						<Brandmark size={26} />
					</Link>
					<span className="flex-1 truncate font-bold text-[14px] text-ink">
						{current?.title}
					</span>
					<span className="hidden items-center gap-2 font-mono text-[11px] text-muted-foreground uppercase tracking-[0.07em] sm:flex">
						Viewing as
						<span className="rounded-[var(--radius-pill)] bg-brass-wash px-2.5 py-1 font-bold font-sans text-[11.5px] text-brass-deep normal-case tracking-normal">
							{nav.roleLabel}
						</span>
					</span>
					<span
						className="flex size-9 items-center justify-center rounded-full border border-border text-ink-soft"
						aria-hidden="true"
					>
						<Bell className="size-[17px]" />
					</span>
				</header>

				<main className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-8 sm:py-10">
					{children}
				</main>
			</div>
		</div>
	);
}
