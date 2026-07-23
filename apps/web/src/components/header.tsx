"use client";

import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Brandmark } from "./brandmark";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

const links = [
	{ href: "/cases", label: "Donate" },
	{ href: "/login", label: "Get justice" },
	{ href: "/attorneys", label: "For attorneys" },
] as const;

// Full-bleed auth flows render their own chrome — hide the site header there.
const CHROME_LESS_ROUTES = [
	"/login",
	"/reset-password",
	"/verify-email",
	"/onboarding",
	"/terms",
	"/privacy",
];

export default function Header() {
	const pathname = usePathname();
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

	return (
		<header
			className={cn(
				"sticky top-0 z-50 border-b transition-[background,box-shadow,border-color] duration-200",
				scrolled
					? "border-border bg-paper/90 shadow-[var(--shadow-rest)] backdrop-blur-md"
					: "border-transparent bg-transparent",
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
							Litigation crowdfunding
						</span>
					</span>
				</Link>

				<nav
					aria-label="Primary"
					className="hidden items-center gap-7 text-ink-soft text-sm md:flex"
				>
					{links.map((link) => (
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
					<ModeToggle />
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
						href="/login"
						className={cn(
							buttonVariants({ size: "sm" }),
							"hidden h-9 px-4 text-sm sm:inline-flex",
						)}
					>
						Start your case
					</Link>
					<UserMenu />
				</div>
			</div>
		</header>
	);
}
