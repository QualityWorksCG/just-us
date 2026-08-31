"use client";

import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
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

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 8);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

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

	return (
		<header
			className={cn(
				"sticky top-0 z-50 border-b transition-[background,box-shadow,border-color] duration-200",
				scrolled
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
					{links
						// "Get justice" is the start-a-case entry via /login — pointless for a
						// signed-in visitor, so drop it while keeping the public browse links.
						.filter((link) => !(signedIn && link.href === "/login"))
						.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								className="font-semibold transition-colors hover:text-foreground"
							>
								{link.label}
							</Link>
						))}
				</nav>

				<div className="flex items-center gap-2">
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
									"hidden h-9 px-4 text-sm sm:inline-flex",
								)}
							>
								Sign in
							</Link>
							<Link
								href="/login?mode=create"
								className={cn(
									buttonVariants({ size: "sm" }),
									"hidden h-9 px-4 text-sm sm:inline-flex",
								)}
							>
								Start your case
							</Link>
						</>
					)}
				</div>
			</div>
		</header>
	);
}
