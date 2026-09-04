"use client";

import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { APP_PATHS } from "@/lib/dashboard-nav";

import { Brandmark } from "./brandmark";

const links = [
	{ href: "/cases", label: "Donate" },
	{ href: "/login", label: "Get justice" },
	{ href: "/attorneys", label: "For attorneys" },
] as const;

// Full-bleed auth flows and legal pages render their own chrome — hide the site
// header there. The app's own screens are covered by APP_PATHS, which the nav
// registry derives, so adding a screen can't leave a stray marketing header on it.
const CHROME_LESS_ROUTES = [
	...APP_PATHS,
	"/login",
	"/reset-password",
	"/accept-invite",
	"/verify-email",
	"/onboarding",
	"/cases/new",
	"/terms",
	"/privacy",
	// The certificate of appreciation is its own full-bleed, printable page.
	"/certificates",
];

export default function Header() {
	const pathname = usePathname();
	const { data: session } = authClient.useSession();
	const [scrolled, setScrolled] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 8);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	// Close the mobile menu whenever the route changes — a tapped link should take
	// them there with the sheet already gone, not leave it hanging over the page.
	// biome-ignore lint/correctness/useExhaustiveDependencies: closing on navigation is the whole point
	useEffect(() => {
		setMenuOpen(false);
	}, [pathname]);

	// Lock the page behind the open mobile menu, and let Escape close it.
	useEffect(() => {
		if (!menuOpen) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setMenuOpen(false);
		};
		document.addEventListener("keydown", onKey);
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = previous;
		};
	}, [menuOpen]);

	if (CHROME_LESS_ROUTES.some((route) => pathname?.startsWith(route))) {
		return null;
	}

	// The public content pages (home, /cases, /cases/[id], /attorneys) render this
	// header for everyone — a signed-in visitor following a shared case link must
	// not land on a chrome-less page with no way to navigate. App screens are
	// already handled above by CHROME_LESS_ROUTES, so a signed-in user only ever
	// sees this header on genuinely public pages; there we just swap the sign-in
	// CTA for a link back into their dashboard.
	const signedIn = !!session;
	// "Get justice" is the start-a-case entry via /login — pointless for a
	// signed-in visitor, so drop it while keeping the public browse links.
	const visibleLinks = links.filter(
		(link) => !(signedIn && link.href === "/login"),
	);

	return (
		<header
			className={cn(
				"sticky top-0 z-50 border-b transition-[background,box-shadow,border-color] duration-200",
				scrolled || menuOpen
					? "border-border bg-paper/90 shadow-[var(--shadow-rest)] backdrop-blur-md"
					: "border-line/60 bg-transparent",
			)}
		>
			<div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-4 px-6">
				<Link href="/" className="flex items-center gap-3">
					<Brandmark size={32} />
					<span className="flex flex-col leading-none">
						<span className="font-bold text-[15px] tracking-tight">
							JustUs Financial
						</span>
						<span className="mt-0.5 hidden font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em] sm:block">
							Litigation intake sourcing
						</span>
					</span>
				</Link>

				<nav
					aria-label="Primary"
					className="hidden items-center gap-7 text-ink-soft text-sm md:flex"
				>
					{visibleLinks.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className="font-semibold transition-colors hover:text-foreground"
						>
							{link.label}
						</Link>
					))}
				</nav>

				{/* Desktop auth — inline from md up. */}
				<div className="hidden items-center gap-2 md:flex">
					{signedIn ? (
						<Link
							href="/home"
							className={cn(buttonVariants({ size: "sm" }), "h-9 px-4 text-sm")}
						>
							Go to dashboard
						</Link>
					) : (
						<>
							<Link
								href="/login"
								className={cn(
									buttonVariants({ variant: "outline", size: "sm" }),
									"h-9 px-4 text-sm",
								)}
							>
								Sign in
							</Link>
							<Link
								href="/login?mode=create"
								className={cn(
									buttonVariants({ size: "sm" }),
									"h-9 px-4 text-sm",
								)}
							>
								Start your case
							</Link>
						</>
					)}
				</div>

				{/* Mobile menu toggle — below md, the inline nav and auth are hidden, so
				    this is the only way in for a signed-out visitor on a phone. */}
				<button
					type="button"
					aria-label={menuOpen ? "Close menu" : "Open menu"}
					aria-expanded={menuOpen}
					onClick={() => setMenuOpen((open) => !open)}
					className="flex size-10 items-center justify-center rounded-[var(--radius-control)] border border-line-strong bg-surface text-ink-soft transition-colors hover:text-ink md:hidden"
				>
					{menuOpen ? (
						<X className="size-5" aria-hidden="true" />
					) : (
						<Menu className="size-5" aria-hidden="true" />
					)}
				</button>
			</div>

			{/* Mobile menu panel */}
			{menuOpen && (
				<>
					<button
						type="button"
						aria-label="Close menu"
						className="fixed inset-0 top-16 z-40 cursor-default bg-ink/20 md:hidden"
						onClick={() => setMenuOpen(false)}
					/>
					<div className="relative z-50 border-line border-t bg-paper px-6 pt-2 pb-5 md:hidden">
						<nav aria-label="Primary" className="flex flex-col">
							{visibleLinks.map((link) => (
								<Link
									key={link.href}
									href={link.href}
									className="border-line/60 border-b py-3 font-semibold text-[15px] text-ink-soft transition-colors last:border-0 hover:text-ink"
								>
									{link.label}
								</Link>
							))}
						</nav>
						<div className="mt-4 flex flex-col gap-2.5">
							{signedIn ? (
								<Link
									href="/home"
									className={cn(
										buttonVariants({ size: "lg" }),
										"w-full justify-center",
									)}
								>
									Go to dashboard
								</Link>
							) : (
								<>
									<Link
										href="/login?mode=create"
										className={cn(
											buttonVariants({ size: "lg" }),
											"w-full justify-center",
										)}
									>
										Start your case
									</Link>
									<Link
										href="/login"
										className={cn(
											buttonVariants({ variant: "outline", size: "lg" }),
											"w-full justify-center",
										)}
									>
										Sign in
									</Link>
								</>
							)}
						</div>
					</div>
				</>
			)}
		</header>
	);
}
