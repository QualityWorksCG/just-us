/**
 * Curated platform knowledge for the assistant, plus the keyword search that
 * serves it.
 *
 * Every claim below is taken from copy the platform actually publishes — the
 * landing page and its FAQ, the Terms and Privacy pages, the onboarding flow,
 * the case wizard, and the in-app navigation. That constraint is the point: an
 * assistant that paraphrases a policy nobody wrote is worse than one that says
 * it doesn't know. Where the product is silent (payout mechanics, tax
 * treatment), the section says so and points at the JustUs team instead of
 * filling the gap.
 *
 * Anything added here should be traceable to a page in this repo. If it isn't,
 * it belongs in `unanswered` rather than as a fact.
 */

export type HelpSection = {
	slug: string;
	title: string;
	body: string;
};

export const HELP_SECTIONS: HelpSection[] = [
	{
		slug: "what-is-justus",
		title: "What JustUs is",
		body: "JustUs is a litigation crowdfunding platform. It connects people who have been wronged (plaintiffs) with bar-verified attorneys, and lets the public (donors) fund the legal fee the plaintiff and attorney agree on. The plaintiff chooses their own attorney — nobody is ever assigned to them — and the agreed fee becomes the funding goal, so nothing more than that fee is ever raised. JustUs is not a law firm, does not provide legal advice, and does not represent anyone. It is also not a lender, an investment platform, or an escrow agent.",
	},
	{
		slug: "roles",
		title: "The four roles",
		body: "Plaintiffs submit a case, choose an attorney, agree the fee, and raise it. Donors browse live cases, give any amount, and follow the cases they back to the outcome. Attorneys list in the public directory, browse cases seeking representation, and put themselves forward for the ones they want. Administrators run the platform — moderation, users, configuration, and the audit log. Plaintiff, donor, and attorney can be chosen at sign-up; administrator accounts are provisioned by JustUs and cannot be self-registered. The role picked at onboarding sets the home base and can be changed later in settings.",
	},
	{
		slug: "submitting-a-case",
		title: "How submitting a case works",
		body: "The case wizard has six steps: Your story (what happened, plus evidence files or links), The basics (category, state, title, cover image and photos), Representation (add an attorney you already have, or publish out to attorneys), Attorney & fee (the fee agreed together, which becomes the funding goal), Payout setup (the case is sent to the attorney, who opens the Stripe account this case's donations are paid into), and Review & publish. It is free to start, saves as you go, and takes around ten minutes. Nothing is public until the plaintiff publishes, and the publish button stays closed until the attorney's payout account can actually receive a donation — so a case never goes public unable to take money. AI helpers can refine the story wording and suggest titles, and can flag what a story is missing — they never block publishing and never decide anything.",
	},
	{
		slug: "case-statuses",
		title: "Case statuses and what each means",
		body: "A case is a draft while it is in progress and private to its owner. It is seeking once it has been published out to attorneys with no attorney attached yet — attorneys can read it and request it, and the plaintiff chooses who takes it on. It is awaiting firm (pending payout) once the plaintiff has finished it and sent it to their attorney: everything is settled and it is still private, waiting only on that attorney opening the Stripe account this case's donations are paid into. The plaintiff can do nothing but chase them; the attorney sees it on their own case list and their home screen counts it. It is live once that account can receive and the plaintiff presses publish — from then it is funding publicly. It is closed once it is resolved and no longer funding. A removed case is soft-deleted: it moves to the plaintiff's Deleted list and can be restored, so nothing is lost.",
	},
	{
		slug: "donations-and-funding",
		title: "How donations and funding work",
		body: "Donations on JustUs are gifts. They carry no financial return and no share of any settlement or judgment. The funding goal is the fee the plaintiff and attorney agreed, and nothing beyond that is raised. JustUs charges a single 5% platform fee on donations, added on top of the gift you select and shown to the cent before you confirm (so $100 to the case means you pay $105), and takes no share of legal fees or settlements; tips, where offered, are voluntary. JustUs never takes custody of donated funds — they route through a third-party payment processor into a case-specific account outside JustUs. Donors can give anonymously: a donor's name is never shown publicly unless they choose to share it, and they still receive every case update.",
	},
	{
		slug: "when-funding-falls-short",
		title: "If a case misses its goal, or the case is lost",
		body: "The agreed fee is the goal, and if funding falls short the attorney and plaintiff decide together how to proceed — a revised scope, more time, or a wind-down. Whatever has been raised stays with that case and is used only for that case, and backers are told either way. If the case is lost, nothing changes financially for a donor: a donation is a gift either way. The attorney posts a final update explaining the outcome and the case closes. Because donated funds move quickly toward a live legal matter, donations are generally non-refundable except where required by law or expressly stated at the time of giving.",
	},
	{
		slug: "finding-an-attorney",
		title: "Choosing an attorney",
		body: "The attorney directory is open to browse and compare — search by practice area and state, and read profiles and reviews from former clients. It is a directory, not a referral service: attorneys are listed by whichever sort the reader chooses, never ranked for a particular case, and the plaintiff decides who to approach. To actually reach an attorney about representation the plaintiff submits their case first, because that case is what the attorney needs in order to say yes. There is no message box before that.",
	},
	{
		slug: "attorney-matching",
		title: "How attorneys and cases get matched",
		body: "Cases published out to attorneys appear in the representation queue, where bar-verified attorneys can read the plaintiff's full account and the evidence they filed. The plaintiff's contact details are never shared. An attorney with verified bar standing can express interest, which records that they are available — it sends no message and opens no conversation. The plaintiff sees the expressions of interest on their dashboard and decides: choosing one sets their attorney and moves them on to agree the fee; passing on one is final. The plaintiff is always the party who makes contact.",
	},
	{
		slug: "attorney-verification",
		title: "Attorney bar verification",
		body: "An attorney's profile is listed once their bar standing is verified for their jurisdiction, and verification is also required before they can express interest in a case. A check searches public bar records, court registries, and legal directories using the attorney's legal name and state, and reports what it found with its sources — a bar number is not required, and one found in a record is read back as evidence. Results reflect a web search rather than a confirmation from the licensing authority, and an administrator can override any of them. A check that cannot reach a clear answer goes to an administrator for review with no action needed from the attorney. Changing licensing details clears any existing badge.",
	},
	{
		slug: "account-basics",
		title: "Accounts, sign-in, and settings",
		body: "Accounts need a name, email, and a password of at least eight characters with a number or symbol, and JustUs is only for people 18 or over. Every new account must confirm its email before role features work; a verification email can be resent from the prompt. Sign-in also supports a one-time email link, but only for accounts that already exist — a new account has to be created first. There is a forgot-password flow. After sign-up, onboarding asks which role you are joining as, and plaintiffs and attorneys give a jurisdiction (plaintiffs so their case can be matched with attorneys licensed in that state; attorneys because it is where they are licensed). Profile, notification, and privacy settings live under Profile & settings.",
	},
	{
		slug: "where-things-live",
		title: "Where to find things in the app",
		body: "Every signed-in user lands on their dashboard. Plaintiffs have My cases, Find an attorney, My representation, Case updates, Messages, and Verification. Donors have Discover cases, Saved, My donations, and Updates. Attorneys have the representation queue as their dashboard, plus My cases and their Directory profile. Administrators have Moderation, Campaigns, Users, Configuration, and the Audit log. Some screens are still being built and say so when opened. Backing a case takes you to that case's page, where you pick an amount, see the 5% fee to the cent, and pay through Stripe — no account needed. A case that isn't live, or hasn't finished setting up where its donations go, says so in place of the amount picker.",
	},
	{
		slug: "unanswered",
		title: "Details the JustUs team has to answer",
		body: "Some things are deliberately not documented on the platform, and guessing at them would be worse than not answering. Payout mechanics — exactly which account raised funds land in, by what method, and on what timing — are not published, and the copy is not consistent enough to summarise. Nor is tax treatment: donations are described as gifts, not charitable contributions, and JustUs makes no claim about deductibility. Anything about a specific legal matter, a fee negotiation, or an account that is not the user's own is out of scope too. For all of these the answer is the JustUs team. There is no support chat or support phone number; the only published addresses are legal@justusfinancial.com for terms, fees, and refunds, and privacy@justusfinancial.com for data and privacy questions.",
	},
];

/** Words too common to carry signal in a query about this platform. */
const STOP_WORDS = new Set([
	"a",
	"about",
	"an",
	"and",
	"are",
	"as",
	"at",
	"be",
	"can",
	"do",
	"does",
	"for",
	"from",
	"how",
	"i",
	"in",
	"is",
	"it",
	"me",
	"my",
	"of",
	"on",
	"or",
	"the",
	"to",
	"what",
	"when",
	"where",
	"who",
	"why",
	"with",
	"you",
	"your",
]);

function terms(query: string): string[] {
	return query
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((term) => term.length > 2 && !STOP_WORDS.has(term));
}

function occurrences(haystack: string, needle: string): number {
	let count = 0;
	let from = 0;
	for (;;) {
		const at = haystack.indexOf(needle, from);
		if (at === -1) return count;
		count += 1;
		from = at + needle.length;
	}
}

/**
 * The three sections most likely to answer a question, by keyword overlap.
 *
 * Title hits weigh more than body hits, and body hits are capped per term so a
 * long section can't win on repetition alone. Deliberately dumb: the corpus is
 * a dozen short sections, and a model reading three of them beats an embedding
 * index we would then have to keep in step with the copy.
 */
export function searchPlatformHelp(
	query: string,
): { title: string; body: string }[] {
	const wanted = terms(query);
	if (wanted.length === 0) {
		return HELP_SECTIONS.slice(0, 3).map(({ title, body }) => ({
			title,
			body,
		}));
	}

	return HELP_SECTIONS.map((section) => {
		const title =
			`${section.title} ${section.slug.replace(/-/g, " ")}`.toLowerCase();
		const body = section.body.toLowerCase();
		let score = 0;
		for (const term of wanted) {
			if (title.includes(term)) score += 5;
			score += Math.min(occurrences(body, term), 3);
		}
		return { section, score };
	})
		.filter((scored) => scored.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, 3)
		.map(({ section }) => ({ title: section.title, body: section.body }));
}

/**
 * What the user sees instead of the assistant when it can't run — over the
 * hourly message limit, over budget, or not configured at all. Says what the
 * assistant would have been able to help with, and where a person is.
 */
export const STATIC_HELP_TEXT = [
	"The assistant isn't available right now.",
	"",
	"It can normally explain how JustUs works — submitting a case, choosing and verifying an attorney, how the 5% fee and donations work, what each case status means — and answer questions about your own cases, donations, saved cases, or representation queue.",
	"",
	"In the meantime: How it works and the FAQ on the JustUs home page cover most of the above, and the Terms and Privacy pages cover fees, refunds, and data. For anything else, the JustUs team can help — legal@justusfinancial.com for terms, fees, and refunds, privacy@justusfinancial.com for data and privacy.",
].join("\n");
