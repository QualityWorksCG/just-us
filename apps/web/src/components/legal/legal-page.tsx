import Link from "next/link";

import { Brandmark } from "@/components/brandmark";

/**
 * Shared layout for long-form legal documents (Terms, Privacy). Server
 * component — no interactivity. Descendant elements are styled via the Prose
 * container so the document pages can be written as plain semantic HTML.
 */
export function LegalPage({
	title,
	updated,
	intro,
	children,
}: {
	title: string;
	updated: string;
	intro: string;
	children: React.ReactNode;
}) {
	return (
		<div className="min-h-svh bg-paper">
			<header className="border-border border-b bg-paper/90 backdrop-blur-md">
				<div className="mx-auto flex h-16 max-w-[760px] items-center justify-between px-6">
					<Link href="/" className="flex items-center gap-2.5">
						<Brandmark size={28} />
						<span className="font-bold text-[15px] tracking-tight">JustUs</span>
					</Link>
					<Link
						href="/"
						className="font-semibold text-[13px] text-ink-soft hover:text-foreground"
					>
						Back to home
					</Link>
				</div>
			</header>

			<main className="mx-auto max-w-[760px] px-6 py-12 sm:py-16">
				<p className="mb-3 font-mono font-semibold text-[12px] text-brass-deep uppercase tracking-[0.08em]">
					Legal
				</p>
				<h1 className="font-extrabold text-[clamp(1.875rem,4vw,2.5rem)] text-ink tracking-[-0.025em]">
					{title}
				</h1>
				<p className="mt-3 text-[13px] text-muted-foreground">
					Last updated {updated}
				</p>
				<p className="mt-6 rounded-[var(--radius-card)] border border-border bg-surface p-4 text-[13.5px] text-ink-soft leading-relaxed">
					{intro}
				</p>

				<div className="mt-10 flex flex-col gap-9 [&_a]:text-brass-deep [&_a]:underline [&_h2]:font-bold [&_h2]:text-[18px] [&_h2]:text-ink [&_h2]:tracking-[-0.01em] [&_li]:mt-1.5 [&_p]:text-[14.5px] [&_p]:text-ink-soft [&_p]:leading-relaxed [&_section]:flex [&_section]:flex-col [&_section]:gap-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-[14.5px] [&_ul]:text-ink-soft">
					{children}
				</div>

				<footer className="mt-14 flex flex-wrap items-center gap-x-5 gap-y-2 border-border border-t pt-6 text-[13px] text-muted-foreground">
					<Link href="/terms" className="hover:text-foreground">
						Terms of Service
					</Link>
					<Link href="/privacy" className="hover:text-foreground">
						Privacy Policy
					</Link>
					<Link href="/login" className="hover:text-foreground">
						Sign in
					</Link>
				</footer>
			</main>
		</div>
	);
}
