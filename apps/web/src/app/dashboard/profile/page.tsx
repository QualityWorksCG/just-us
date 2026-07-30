import { getAttorneyProfile } from "@just-us/db/attorney-profile";

import {
	type AttorneyProfileData,
	AttorneyProfileForm,
} from "@/components/dashboard/attorney-profile-form";
import { requireRole } from "@/lib/auth-server";
import { findScreen } from "@/lib/dashboard-nav";

/**
 * The attorney's own directory profile ("Group A" — attorney-entered, public,
 * editable). This static segment takes precedence over the `[...slug]`
 * placeholder route, which still serves the attorney's other screens.
 */
export default async function AttorneyProfilePage() {
	// Only attorneys have a directory profile; everyone else lands on their own
	// dashboard home rather than seeing this route exists.
	const { session } = await requireRole("attorney");
	const user = session.user as typeof session.user & {
		firmName?: string | null;
		jurisdiction?: string | null;
	};

	const screen = findScreen("attorney", "profile");
	const saved = await getAttorneyProfile(user.id);

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
				feeApproach: saved.feeApproach,
				feeRangeMinCents: saved.feeRangeMinCents,
				feeRangeMaxCents: saved.feeRangeMaxCents,
				bio: saved.bio,
				background: saved.background,
				bioStatus: saved.bioStatus,
			}
		: null;

	return (
		<div>
			<h1 className="font-extrabold text-[30px] text-ink tracking-[-0.02em]">
				{screen?.title ?? "Directory profile"}
			</h1>
			<p className="mt-2 max-w-[640px] text-[14.5px] text-ink-soft leading-relaxed">
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
				/>
			</div>
		</div>
	);
}
