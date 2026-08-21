"use client";

import { ArrowLeft, Printer } from "lucide-react";
import { useRouter } from "next/navigation";

import { Brandmark } from "@/components/brandmark";

/**
 * The certificate of appreciation itself — a self-contained, printable page.
 *
 * "Download" is the browser's own print-to-PDF: it needs no server render and no
 * PDF dependency, and what the backer saves is exactly what they see. The action
 * bar is hidden in print via the scoped stylesheet below, so the saved page is
 * the certificate alone.
 */
export function CertificateView({
	recipientName,
	caseTitle,
	amountLabel,
	serial,
	issuedLabel,
}: {
	recipientName: string;
	caseTitle: string;
	amountLabel: string;
	serial: string;
	issuedLabel: string;
}) {
	const router = useRouter();
	// This page is reached same-tab (from an email link) and in a new tab (from the
	// in-app donations list). "Back" returns to wherever they came from when there's
	// history; otherwise — a fresh tab — it drops them on the JustUs home.
	function goBack() {
		if (typeof window !== "undefined" && window.history.length > 1) {
			router.back();
		} else {
			router.push("/");
		}
	}

	return (
		<div className="flex min-h-svh flex-col items-center gap-6 bg-surface-2 px-4 py-10">
			{/* Print rules: drop the page background and the top/action bars so a saved
			    PDF is the certificate and nothing else. */}
			<style>{`
				@media print {
					body { background: #fff !important; }
					.cert-actions, .cert-topbar { display: none !important; }
					.cert-sheet { box-shadow: none !important; border-color: #d8cdb8 !important; margin: 0 !important; }
				}
			`}</style>

			{/* Top bar — a clear way back, since this opens as its own page/tab. */}
			<div className="cert-topbar flex w-full max-w-[760px] items-center justify-between">
				<button
					type="button"
					onClick={goBack}
					className="inline-flex items-center gap-1.5 font-semibold text-[13.5px] text-ink-soft transition-colors hover:text-ink"
				>
					<ArrowLeft className="size-4" aria-hidden="true" />
					Back
				</button>
			</div>

			<div
				className="cert-sheet relative w-full max-w-[760px] overflow-hidden rounded-[var(--radius-card-lg)] border-2 border-brass/40 bg-surface px-8 py-12 shadow-[var(--shadow-modal)] sm:px-16 sm:py-16"
				role="document"
				aria-label="Certificate of appreciation"
			>
				{/* Inner rule frame */}
				<div className="pointer-events-none absolute inset-3 rounded-[calc(var(--radius-card-lg)-4px)] border border-brass/25" />

				<div className="relative flex flex-col items-center text-center">
					<Brandmark size={52} />
					<p className="mt-4 font-mono text-[11px] text-brass-deep uppercase tracking-[0.28em]">
						JustUs Financial
					</p>

					<h1 className="mt-8 font-extrabold text-[26px] text-ink uppercase tracking-[0.14em] sm:text-[30px]">
						Certificate of Appreciation
					</h1>
					<div className="mt-4 h-px w-24 bg-brass/50" />

					<p className="mt-8 text-[14px] text-ink-soft">Presented to</p>
					<p className="mt-2 font-extrabold text-[30px] text-ink tracking-[-0.01em] sm:text-[38px]">
						{recipientName}
					</p>

					<p className="mt-8 max-w-[52ch] text-[14.5px] text-ink-soft leading-relaxed">
						in heartfelt appreciation for backing the pursuit of justice in
					</p>
					<p className="mt-2 max-w-[52ch] font-semibold text-[18px] text-ink italic">
						“{caseTitle}”
					</p>

					<p className="mt-8 max-w-[54ch] text-[13.5px] text-ink-soft leading-relaxed">
						Your gift of {amountLabel} helped a wronged person stand before the
						law with counsel beside them. A gift on JustUs is never an
						investment and asks nothing in return. This is our thanks for the
						difference it made.
					</p>

					<div className="mt-12 flex w-full items-end justify-between gap-6 border-brass/20 border-t pt-5 text-left">
						<div>
							<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em]">
								Certificate No.
							</p>
							<p className="mt-1 font-semibold text-[13px] text-ink">
								{serial}
							</p>
						</div>
						<div className="text-right">
							<p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em]">
								Issued
							</p>
							<p className="mt-1 font-semibold text-[13px] text-ink">
								{issuedLabel}
							</p>
						</div>
					</div>
				</div>
			</div>

			<div className="cert-actions flex items-center gap-3">
				<button
					type="button"
					onClick={() => window.print()}
					className="inline-flex items-center gap-2 rounded-[var(--radius-control)] bg-brass px-5 py-2.5 font-semibold text-[13.5px] text-white transition-colors hover:bg-brass/90"
				>
					<Printer className="size-4" aria-hidden="true" />
					Download / Print
				</button>
			</div>
		</div>
	);
}
