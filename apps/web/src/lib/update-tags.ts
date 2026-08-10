import {
	CalendarClock,
	FileText,
	Flag,
	Gavel,
	Handshake,
	type LucideIcon,
} from "lucide-react";

/**
 * The categories an author can tag a case update with — a small controlled set,
 * shown as a labelled pill on the update and offered as chips in the composer.
 * The stored value is the slug; label/icon/tone are display-only.
 */
export type UpdateTagTone = "green" | "brass";
export type UpdateTag = {
	value: string;
	label: string;
	icon: LucideIcon;
	tone: UpdateTagTone;
};

export const UPDATE_TAGS: UpdateTag[] = [
	{ value: "filing", label: "Filed", icon: FileText, tone: "green" },
	{
		value: "court_date",
		label: "Court date",
		icon: CalendarClock,
		tone: "green",
	},
	{ value: "hearing", label: "Hearing", icon: Gavel, tone: "green" },
	{
		value: "settlement",
		label: "Settlement talks",
		icon: Handshake,
		tone: "brass",
	},
	{ value: "milestone", label: "Milestone", icon: Flag, tone: "brass" },
];

/** The pill classes for a tag tone. */
export const TAG_TONE_CLASS: Record<UpdateTagTone, string> = {
	green: "bg-green-soft text-green-deep",
	brass: "bg-brass-wash text-brass-deep",
};

/** Look up a tag's display config by its stored slug, or null if unknown/absent. */
export function tagConfig(value: string | null | undefined): UpdateTag | null {
	if (!value) return null;
	return UPDATE_TAGS.find((t) => t.value === value) ?? null;
}
