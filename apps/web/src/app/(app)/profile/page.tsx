import { listAdmissions } from "@just-us/db/admissions";
import { getAttorneyProfile } from "@just-us/db/attorney-profile";
import type { Route } from "next";
import {
	type AttorneyProfileData,
	AttorneyProfileForm,
} from "@/components/dashboard/attorney-profile-form";
import type { VerificationView } from "@/components/dashboard/attorney-verification";
import { BackLink } from "@/components/dashboard/back-link";
import type { VerificationSource } from "@/lib/attorney-verification";
import { requireRole } from "@/lib/auth-server";
import { findScreen } from "@/lib/dashboard-nav";
import { safeNextPath } from "@/lib/next-path";

/**
 * A bar check measures ~11s. Headroom over that, because a verification killed
 * mid-flight looks identical to one that found nothing.
 */
export const maxDuration = 60;

/**
 * The attorney's own directory profile ("Group A" — attorney-entered, public,
 * editable). This static segment takes precedence over the `[...slug]`
 * placeholder route, which still serves the attorney's other screens.
 */
export default async function AttorneyProfilePage({
	searchParams,
}: {
	searchParams: Promise<{ next?: string }>;
}) {
	// Only attorneys have a directory profile; everyone else lands on their own
	// dashboard home rather than seeing this route exists.
	const { session } = await requireRole("attorney");
	const user = session.user as typeof session.user & {
		firmName?: string | null;
		jurisdiction?: string | null;
		barNumber?: string | null;
	};

	// Sent here from somewhere that needs a verified attorney — a case invitation,
	// typically. A bar check is not instant and may end in a human review, so this
	// is a way back rather than a redirect: they will often leave and return long
	// after. Same-site paths only; see `safeNextPath`.
	const { next } = await searchParams;
	const back = safeNextPath(next);

	const screen = findScreen("attorney", "profile");
	// Read alongside the profile: the states an attorney claims are the authority on
	// which cases can reach them, and the badge below is only a summary of them.
	const [saved, admissions] = await Promise.all([
		getAttorneyProfile(user.id),
		listAdmissions(user.id),
	]);

	const profile: AttorneyProfileData | null = saved
		? {
				legalName: saved.legalName,
				firmName: saved.firmName,
				officeCity: saved.officeCity,
				officeState: saved.officeState,
				contactEmail: saved.contactEmail,
				contactPhone: saved.contactPhone,
				websiteUrl: saved.websiteUrl,
				headshotUrl: saved.headshotUrl,
				practiceAreas: saved.practiceAreas,
				languages: saved.languages,
				acceptingNewCases: saved.acceptingNewCases,
				virtualConsultation: saved.virtualConsultation,
				practicesFederal: saved.practicesFederal,
				feeApproach: saved.feeApproach,
				feeRangeMinCents: saved.feeRangeMinCents,
				feeRangeMaxCents: saved.feeRangeMaxCents,
				bio: saved.bio,
				background: saved.background,
				bioStatus: saved.bioStatus,
			}
		: null;

	// The newest check drives the badge; `sources` is a Json column, only ever
	// written by the verification action as a validated array.
	const lastCheck = saved?.verifications[0];
	const verification: VerificationView = {
		status: saved?.verificationStatus ?? "unverified",
		verifiedAt: saved?.verifiedAt ?? null,
		barNumber: saved?.user.barNumber ?? user.barNumber ?? null,
		jurisdiction: saved?.user.jurisdiction ?? user.jurisdiction ?? null,
		latest: lastCheck
			? {
					createdAt: lastCheck.createdAt,
					confidence: lastCheck.confidence,
					isLicensedAttorney: lastCheck.isLicensedAttorney,
					inGoodStanding: lastCheck.inGoodStanding,
					licenseStatusText: lastCheck.licenseStatusText,
					officialRecordUrl: lastCheck.officialRecordUrl,
					matchedName: lastCheck.matchedName,
					matchedBarNumber: lastCheck.matchedBarNumber,
					matchedJurisdiction: lastCheck.matchedJurisdiction,
					disciplinaryNotes: lastCheck.disciplinaryNotes,
					summary: lastCheck.summary,
					sources: (lastCheck.sources ?? []) as VerificationSource[],
					checkedName: lastCheck.checkedName,
					checkedJurisdiction: lastCheck.checkedJurisdiction,
				}
			: null,
	};

	return (
		<div>
			{back ? (
				<BackLink
					href={back as Route}
					label="Back to the case invitation"
					className="mb-4"
				/>
			) : null}
			<p className="max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
				{screen?.sub ??
					"How you appear in the attorney directory. Shown once your bar standing is verified."}
			</p>
			<div className="mt-8">
				<AttorneyProfileForm
					profile={profile}
					account={{
						name: user.name,
						email: user.email,
						firmName: user.firmName ?? null,
						jurisdiction: user.jurisdiction ?? null,
					}}
					verification={verification}
					federalVerificationStatus={
						saved?.federalVerificationStatus ?? "unverified"
					}
					admissions={admissions}
				/>
			</div>
		</div>
	);
}
