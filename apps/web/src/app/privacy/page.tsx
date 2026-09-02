import Link from "next/link";

import { LegalPage } from "@/components/legal/legal-page";

export const metadata = {
	title: "Privacy Policy",
	description: "How JustUs collects, uses, and protects your information.",
};

export default function PrivacyPage() {
	return (
		<LegalPage
			title="Privacy Policy"
			updated="July 22, 2026"
			intro="This Privacy Policy explains what information JustUs Financial collects, how we use it, and the choices you have. It applies to the JustUs platform and works alongside our Terms of Service."
		>
			<section>
				<h2>1. Information we collect</h2>
				<p>
					We collect information you give us and information created as you use
					the platform:
				</p>
				<ul>
					<li>
						<strong>Account details:</strong> your name and email address, and a
						securely hashed password. We never store your password in plain
						text.
					</li>
					<li>
						<strong>Role and profile:</strong> the role you choose (plaintiff,
						donor, or attorney) and, for attorneys, professional details such as
						firm, bar number, and jurisdiction.
					</li>
					<li>
						<strong>Case content:</strong> for plaintiffs, the case information,
						story, and evidence you submit.
					</li>
					<li>
						<strong>Technical and usage data:</strong> IP address, browser/user
						agent, session information, and activity logs used to operate and
						secure the service.
					</li>
					<li>
						<strong>Communications:</strong> messages you send us, such as
						support requests.
					</li>
				</ul>
				<p>
					Payment and identity-verification details are handled by our payment
					processor. JustUs does not store your full card numbers or raw
					identity-verification documents.
				</p>
			</section>

			<section>
				<h2>2. How we use your information</h2>
				<ul>
					<li>To create and operate your account and verify your email.</li>
					<li>
						To run core features: submitting, vetting, funding, and following
						cases.
					</li>
					<li>
						To route donations to the correct attorney case account via our
						processor.
					</li>
					<li>
						To keep the platform secure — including rate limiting, lockout after
						repeated failed sign-ins, and fraud and abuse prevention.
					</li>
					<li>
						To send transactional email (verification, password reset, sign-in
						links, and case updates).
					</li>
					<li>To comply with legal obligations and enforce our Terms.</li>
				</ul>
			</section>

			<section>
				<h2>3. When we share information</h2>
				<p>
					We do not sell your personal information. We share it only as needed:
				</p>
				<ul>
					<li>
						<strong>Between platform participants,</strong> as the service
						requires — for example, a case a plaintiff publishes is visible to
						donors, and a matched attorney can see the case detail relevant to
						their work.
					</li>
					<li>
						<strong>Service providers</strong> who work on our behalf under
						contract — such as hosting, our email provider, and our payment
						processor — limited to what they need to perform their service.
					</li>
					<li>
						<strong>Legal and safety:</strong> when required by law, to respond
						to valid legal process, or to protect the rights, safety, and
						security of users and the platform.
					</li>
					<li>
						<strong>Business transfers:</strong> in connection with a merger,
						acquisition, or sale of assets, subject to this Policy.
					</li>
				</ul>
			</section>

			<section>
				<h2>4. Payments and funds</h2>
				<p>
					Donations are processed by a third-party payment processor and route
					directly to a case-specific account held by the retained attorney.
					JustUs never takes custody of donated funds and does not receive or
					store your payment credentials.
				</p>
			</section>

			<section>
				<h2>5. Cookies and sessions</h2>
				<p>
					We use secure, HTTP-only cookies to keep you signed in and to protect
					your session. We do not store authentication tokens or personal
					information in your browser's local storage. We use only the cookies
					necessary to run the service.
				</p>
			</section>

			<section>
				<h2>6. How we protect your information</h2>
				<p>
					We use industry-standard safeguards: passwords are hashed, sessions
					are carried in secure cookies, access is scoped by role, and we apply
					rate limiting and account lockout to resist attacks. No system is
					perfectly secure, but we work to protect your data and to respond
					promptly to incidents.
				</p>
			</section>

			<section>
				<h2>7. Data retention</h2>
				<p>
					We keep your information for as long as your account is active and as
					needed to provide the service, comply with our legal obligations,
					resolve disputes, and enforce our agreements. When information is no
					longer needed, we delete or de-identify it.
				</p>
			</section>

			<section>
				<h2>8. Your choices and rights</h2>
				<p>
					Depending on where you live, you may have rights to access, correct,
					export, or delete your personal information, and to object to or
					restrict certain processing. You can update your account details or
					close your account at any time, or contact us to exercise these
					rights.
				</p>
			</section>

			<section>
				<h2>9. Children</h2>
				<p>
					JustUs is not intended for anyone under 18, and we do not knowingly
					collect information from children. If you believe a child has provided
					us information, contact us and we will delete it.
				</p>
			</section>

			<section>
				<h2>10. International users</h2>
				<p>
					We may process and store information in countries other than your own.
					Where we transfer information, we take steps to protect it consistent
					with this Policy and applicable law.
				</p>
			</section>

			<section>
				<h2>11. Changes to this Policy</h2>
				<p>
					We may update this Policy from time to time. If we make material
					changes, we will take reasonable steps to notify you and will update
					the "last updated" date above.
				</p>
			</section>

			<section>
				<h2>12. Contact</h2>
				<p>
					Questions about your privacy? Email{" "}
					<a href="mailto:privacy@justusfinancial.com">
						privacy@justusfinancial.com
					</a>
					. See also our <Link href="/terms">Terms of Service</Link>.
				</p>
			</section>
		</LegalPage>
	);
}
