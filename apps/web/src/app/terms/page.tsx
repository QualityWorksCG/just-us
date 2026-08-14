import Link from "next/link";

import { LegalPage } from "@/components/legal/legal-page";

export const metadata = {
	title: "Terms of Service",
	description: "The terms that govern your use of JustUs.",
};

export default function TermsPage() {
	return (
		<LegalPage
			title="Terms of Service"
			updated="August 5, 2026"
			intro="These Terms are a plain-language agreement between you and JustUs Financial. They explain what JustUs does, what it does not do, and the rules for using the platform. Please read them together with our Privacy Policy. If you do not agree, do not use JustUs."
		>
			<section>
				<h2>1. About JustUs</h2>
				<p>
					JustUs Financial ("JustUs", "we", "us") operates an online platform
					that connects people who have been wronged ("plaintiffs") with
					bar-verified attorneys, and lets the public ("donors") fund the legal
					fee a plaintiff and attorney agree on.
				</p>
				<p>
					<strong>
						JustUs is not a law firm, does not provide legal advice, and does
						not represent you.
					</strong>{" "}
					We are not a lender, investment platform, escrow agent, or party to
					any fee agreement between a plaintiff and an attorney. Using JustUs
					does not create an attorney–client relationship with JustUs.
				</p>
			</section>

			<section>
				<h2>2. Eligibility and your account</h2>
				<ul>
					<li>
						You must be at least 18 years old and able to enter a contract.
					</li>
					<li>
						You must provide accurate information and keep it up to date, and
						you must verify your email address before your account is active.
					</li>
					<li>
						You are responsible for keeping your password and account secure,
						and for all activity under your account. Tell us promptly of any
						unauthorized use.
					</li>
					<li>
						You choose a role during onboarding (plaintiff, donor, or attorney).
						Administrator accounts are provisioned by JustUs and are not
						self-registered.
					</li>
				</ul>
			</section>

			<section>
				<h2>3. Donations are gifts</h2>
				<p>
					Donations made through JustUs are <strong>gifts</strong>. They are not
					investments, loans, or purchases. A donation carries{" "}
					<strong>no financial return</strong> and grants{" "}
					<strong>no share of any settlement, judgment, or recovery</strong>.
					You give because the case matters to you, not to profit from it.
				</p>
				<p>
					Because donated funds move quickly toward a live legal matter,
					donations are generally non-refundable except where required by law or
					expressly stated at the time of giving. Where a refund is made, it is
					net of the payment processing fees on the original transaction — see
					section 4.
				</p>
			</section>

			<section>
				<h2>4. Fees and how money moves</h2>
				<ul>
					<li>
						JustUs charges a single, transparent{" "}
						<strong>5% platform fee</strong> on donations, added on top of the
						gift you select and shown to the cent before you confirm (so $100 to
						the case means you pay $105). Optional tips, if offered, are always
						voluntary.
					</li>
					<li>
						<strong>JustUs never takes custody of donated funds.</strong> Funds
						route directly, through our third-party payment processor, into an
						account held by the case's designated recipient. JustUs's own
						balance never receives a donated dollar.
					</li>
					<li>
						<strong>
							The law firm representing the case receives the funds.
						</strong>{" "}
						Donations are paid into the <strong>operating account</strong> of
						the firm whose attorney represents the case, opened and controlled
						by that firm. The recipient is stated on the case page before you
						give. Funds are <strong>not</strong> paid to the plaintiff, and
						JustUs does not direct how they are applied once received.
					</li>
					<li>
						<strong>Each case is funded through its own account.</strong> A firm
						representing more than one case on JustUs holds a separate connected
						account per case, so one case's donations, refunds, and balance are
						never combined with another's — a reversal on one case cannot be
						taken out of a different client's funds.
					</li>
					<li>
						Funds are received by the firm as an{" "}
						<strong>advance payment of fees from a third party</strong> for the
						client's matter. Handling them from that point — including any
						obligation to deposit them in a client trust or IOLTA account, to
						account for them, and to refund any unearned portion — is governed
						by the rules of professional conduct of the firm's jurisdiction and
						is the firm's responsibility alone. JustUs neither administers nor
						supervises trust accounting, and is not a party to the fee agreement
						between an attorney and their client.
					</li>
					<li>
						<strong>Refunds are net of processing fees.</strong> Where a
						donation is voluntarily refunded, it is refunded{" "}
						<strong>
							minus the non-refundable third-party payment processing fees
						</strong>{" "}
						charged on the original transaction (currently 2.9% + $0.30 per
						transaction). Those fees are retained by the payment processor and
						are not returned to JustUs on a refund, so they cannot be returned
						to the donor.
					</li>
					<li>
						<strong>Chargebacks are the receiving firm's liability.</strong> By
						connecting an account to receive donations, a law firm agrees that
						any chargeback, fraud reversal, or refund on a donation routed to it
						— including reversals forced by a card network or bank, and the
						associated processor fees — is the firm's liability and not
						JustUs's. JustUs may recover such amounts from the firm's connected
						balance, including by reversing transfers to it or withholding
						subsequent transfers, and any shortfall remains a debt owed to
						JustUs.
					</li>
					<li>
						We do not take any share of legal fees or settlements. Fees and
						settlements are strictly between the attorney and their client.
					</li>
				</ul>
			</section>

			<section>
				<h2>5. Case submissions and content</h2>
				<p>
					Plaintiffs may submit case information, stories, and evidence. You
					keep ownership of what you submit, but you grant JustUs a license to
					host, display, and distribute it on the platform for the purpose of
					running the service.
				</p>
				<p>
					Cases go live when the plaintiff publishes them; JustUs does not
					pre-screen or review cases before publication. We may decline, remove,
					or unpublish content at our discretion, but doing so is not guaranteed
					and no listing implies our endorsement. You are responsible for the
					accuracy of what you submit and must not post anything false,
					unlawful, or that violates someone else's rights or a court order.
				</p>
			</section>

			<section>
				<h2>6. Attorneys</h2>
				<ul>
					<li>
						Attorneys must verify their bar standing per jurisdiction before a
						profile is listed, and must keep that information current.
					</li>
					<li>
						Attorneys remain independently responsible for their professional
						conduct, their fee agreements with clients, and compliance with the
						rules of every jurisdiction in which they practice.
					</li>
					<li>
						An attorney who connects an account to receive donations does so on
						behalf of their firm, warrants that they are authorized to do so,
						and must use the firm's <strong>operating account</strong> — not a
						client trust or IOLTA account, which our payment processor cannot
						support. A separate account is connected for{" "}
						<strong>each case</strong> the firm represents, so completing setup
						for one matter does not enable another. Applying received funds to
						the client's matter in accordance with trust-accounting rules, and
						the liability for refunds and chargebacks on them, sit with the
						firm. See section 4.
					</li>
					<li>
						JustUs does not supervise legal work, guarantee attorney
						performance, or endorse any attorney. Listing is not a
						recommendation.
					</li>
				</ul>
			</section>

			<section>
				<h2>7. No legal advice</h2>
				<p>
					Nothing on JustUs — including AI-generated summaries, case-strength
					indicators, or completeness checks — is legal advice. AI output is
					labelled, advisory, and never decides an outcome; a person makes
					vetting and moderation rulings. Always rely on your own attorney for
					legal advice.
				</p>
			</section>

			<section>
				<h2>8. Acceptable use</h2>
				<p>You agree not to:</p>
				<ul>
					<li>
						Misrepresent yourself, a case, or your authority to act for someone
						else.
					</li>
					<li>
						Use the platform for fraud, money laundering, harassment, or any
						unlawful purpose.
					</li>
					<li>
						Attempt to access another user's account or data, probe or bypass
						our security, or scrape the platform.
					</li>
					<li>
						Upload malware, or interfere with the operation or integrity of the
						service.
					</li>
				</ul>
			</section>

			<section>
				<h2>9. Disclaimers and limitation of liability</h2>
				<p>
					The platform is provided "as is" and "as available", without
					warranties of any kind to the fullest extent permitted by law. We do
					not warrant any legal outcome, that a case will be funded, or that
					information on the platform is complete or error-free.
				</p>
				<p>
					To the maximum extent permitted by law, JustUs is not liable for
					indirect, incidental, or consequential damages, and our total
					liability relating to the service is limited to the platform fees you
					paid to us in the twelve months before the claim.
				</p>
			</section>

			<section>
				<h2>10. Indemnification</h2>
				<p>
					You agree to indemnify and hold JustUs harmless from claims arising
					out of your content, your use of the platform, or your breach of these
					Terms.
				</p>
			</section>

			<section>
				<h2>11. Suspension and termination</h2>
				<p>
					You may close your account at any time. We may suspend or terminate
					access if you breach these Terms, to protect users or the platform, or
					as required by law. Terms that by their nature should survive
					termination will do so.
				</p>
			</section>

			<section>
				<h2>12. Changes to these Terms</h2>
				<p>
					We may update these Terms from time to time. If we make material
					changes, we will take reasonable steps to notify you. Continuing to
					use JustUs after changes take effect means you accept the updated
					Terms.
				</p>
			</section>

			<section>
				<h2>13. Contact</h2>
				<p>
					Questions about these Terms? Email{" "}
					<a href="mailto:legal@justusfinancial.com">
						legal@justusfinancial.com
					</a>
					. See also our <Link href="/privacy">Privacy Policy</Link>.
				</p>
			</section>
		</LegalPage>
	);
}
