"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

const faqs = [
	{
		q: "Is my donation an investment?",
		a: "No. Donations on JustUs are gifts. They carry no financial return and no share of any settlement or judgment — you give because the case matters, and you follow it to the end.",
	},
	{
		q: "Where does my money actually go?",
		a: "Straight into a case-specific account the matched attorney opens through Stripe Connect. JustUs never takes custody — our own balance never receives a donated dollar. A 5% platform fee is deducted and shown to the cent before you confirm.",
	},
	{
		q: "What happens if a case doesn't reach its goal?",
		a: "The agreed fee is the goal, and the attorney and plaintiff decide together how to proceed if funding falls short — a revised scope, more time, or a wind-down. Whatever is raised stays in the case account and is used only for that case; backers are told either way.",
	},
	{
		q: "What happens if the case loses?",
		a: "Nothing changes for you financially — a donation is a gift either way. The attorney posts a final update explaining the outcome, and the case closes.",
	},
	{
		q: "How do I know a case is real?",
		a: "A person on our vetting team reviews every case — story, evidence, and identity — before it can be listed or funded. Every attorney verifies their bar standing per jurisdiction before their profile activates. AI helps flag gaps, but it never decides.",
	},
	{
		q: "What does JustUs earn?",
		a: "A transparent 5% fee on each donation, plus optional tips. That's the whole model — we take no share of legal fees, no cut of settlements, and nothing from plaintiffs or attorneys for matching.",
	},
	{
		q: "Can I donate anonymously?",
		a: "Yes. Your name is never shown publicly unless you choose to share it. The plaintiff and attorney see donation amounts, and you still receive every case update.",
	},
] as const;

export function LandingFaq() {
	const [open, setOpen] = useState(0);

	return (
		<div className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-card shadow-[var(--shadow-rest)]">
			{faqs.map((faq, i) => {
				const isOpen = open === i;
				return (
					<div key={faq.q}>
						<button
							type="button"
							aria-expanded={isOpen}
							onClick={() => setOpen(isOpen ? -1 : i)}
							className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50"
						>
							<span className="font-semibold text-[15px] text-ink">
								{faq.q}
							</span>
							<ChevronDown
								aria-hidden="true"
								className="size-4 shrink-0 text-muted-foreground transition-transform duration-200"
								style={{
									transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
								}}
							/>
						</button>
						{isOpen ? (
							<p className="px-5 pb-5 text-[13.5px] text-ink-soft leading-relaxed">
								{faq.a}
							</p>
						) : null}
					</div>
				);
			})}
		</div>
	);
}
