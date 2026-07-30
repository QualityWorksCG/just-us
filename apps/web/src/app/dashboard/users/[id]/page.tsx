import { isBlocked, isLocked } from "@just-us/auth/user-status";
import { getUserWithCases } from "@just-us/db/users";
import { cn } from "@just-us/ui/lib/utils";
import { ArrowRight, FolderOpen, HeartHandshake } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { BackLink } from "@/components/dashboard/back-link";
import { BlockUserDialog } from "@/components/dashboard/block-user-dialog";
import { UnblockUserButton } from "@/components/dashboard/unblock-user-button";
import { requireAdministrator } from "@/lib/auth-server";

const dayFmt = new Intl.DateTimeFormat("en-GB", {
	day: "2-digit",
	month: "short",
	year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
	hour: "2-digit",
	minute: "2-digit",
	hour12: false,
});

function stamp(date: Date) {
	return `${dayFmt.format(date)}, ${timeFmt.format(date)}`;
}

function money(n: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(n);
}

const PILL =
	"inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-0.5 font-mono font-semibold text-[10px] uppercase tracking-[0.06em]";
const HEAD =
	"font-mono font-semibold text-[10.5px] text-muted-foreground uppercase tracking-[0.06em]";

/**
 * Verification is always shown; a block or a lock is shown alongside it. Blocked
 * (administrator-initiated) and locked (failed sign-ins) are separate states, so
 * they get separate pills and a blocked account never reads as merely locked.
 */
function statusPills(u: {
	emailVerified: boolean;
	banned: boolean | null;
	banExpires: Date | null;
	lockedUntil: Date | null;
}) {
	const pills = [
		u.emailVerified
			? {
					text: "Verified",
					cls: "bg-green-soft text-green-deep",
					dot: "bg-success",
				}
			: {
					text: "Unverified",
					cls: "bg-surface-2 text-ink-soft",
					dot: "bg-ink-soft",
				},
	];
	if (isBlocked(u)) {
		pills.push({
			text: "Blocked",
			cls: "bg-danger/10 text-danger",
			dot: "bg-danger",
		});
	} else if (isLocked(u)) {
		pills.push({
			text: "Locked",
			cls: "bg-warn/10 text-warn-deep",
			dot: "bg-warn-deep",
		});
	}
	return pills;
}

const CASE_BADGES: Record<string, { text: string; dot: string }> = {
	live: { text: "Live", dot: "bg-success" },
	seeking: { text: "Seeking", dot: "bg-brass-deep" },
	closed: { text: "Closed", dot: "bg-ink-muted" },
	draft: { text: "Draft", dot: "bg-ink-soft" },
};

function Fact({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="min-w-0">
			<p className={cn(HEAD, "mb-1")}>{label}</p>
			{children}
		</div>
	);
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const { id } = await params;
	const u = await getUserWithCases(id);
	if (!u) return { title: "Account not found" };
	return { title: `${u.name} · Users · JustUs Financial` };
}

export default async function UserDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { session } = await requireAdministrator();
	const { id } = await params;
	const u = await getUserWithCases(id);
	if (!u) notFound();

	const blocked = isBlocked(u);
	const locked = isLocked(u);
	const isSelf = u.id === session.user.id;

	return (
		<div className="flex flex-col gap-6">
			<div>
				<BackLink
					href={"/dashboard/users" as Route}
					label="Back to users"
					className="mb-3"
				/>
				<div className="flex flex-wrap items-center gap-3">
					<h1 className="font-extrabold text-[30px] text-ink tracking-[-0.02em]">
						{u.name}
					</h1>
					{statusPills(u).map((p) => (
						<span key={p.text} className={cn(PILL, p.cls)}>
							<span className={cn("size-1.5 rounded-full", p.dot)} />
							{p.text}
						</span>
					))}
				</div>
				<p className="mt-1.5 text-[14.5px] text-ink-soft">{u.email}</p>
				<div className="mt-3 flex flex-wrap gap-1.5">
					<span className="rounded-[var(--radius-chip)] bg-brass-wash px-2.5 py-0.5 font-semibold text-[12px] text-brass-deep capitalize">
						{u.role}
					</span>
					<span className="rounded-[var(--radius-chip)] border border-border px-2.5 py-0.5 text-[12px] text-ink-soft">
						{u.jurisdiction || "No jurisdiction"}
					</span>
				</div>
			</div>

			{/* Account facts */}
			<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
				<div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
					<Fact label="Role">
						<p className="text-[13.5px] text-ink capitalize">{u.role}</p>
					</Fact>
					<Fact label="Jurisdiction">
						<p className="text-[13.5px] text-ink">{u.jurisdiction || "—"}</p>
					</Fact>
					<Fact label="Verification">
						<p className="text-[13.5px] text-ink">
							{u.emailVerified ? "Email verified" : "Not verified"}
						</p>
					</Fact>
					<Fact label="Joined">
						<p className="text-[13.5px] text-ink tabular-nums">
							{stamp(u.createdAt)}
						</p>
					</Fact>
					<Fact label="Last sign-in">
						<p
							className={cn(
								"text-[13.5px] tabular-nums",
								u.lastSignInAt ? "text-ink" : "text-muted-foreground",
							)}
						>
							{u.lastSignInAt ? stamp(u.lastSignInAt) : "Never"}
						</p>
					</Fact>
				</div>

				{blocked && (
					<div className="mt-5 rounded-[var(--radius-card-sm)] border border-danger/30 bg-danger/5 px-4 py-3">
						<p className={cn(HEAD, "mb-1 text-danger")}>Blocked</p>
						<p className="text-[13.5px] text-ink leading-relaxed">
							{u.banReason || "No reason recorded."}
						</p>
						<p className="mt-1 text-[12.5px] text-muted-foreground">
							{u.banExpires ? `Until ${stamp(u.banExpires)}` : "Indefinite"}
						</p>
					</div>
				)}

				{locked && (
					<div className="mt-5 rounded-[var(--radius-card-sm)] border border-warn/50 bg-warn/10 px-4 py-3">
						<p className={cn(HEAD, "mb-1 text-warn-deep")}>Locked</p>
						<p className="text-[13.5px] text-ink leading-relaxed">
							Locked until {u.lockedUntil ? stamp(u.lockedUntil) : "—"} after
							failed sign-in attempts.
						</p>
					</div>
				)}

				<div className="mt-5 border-border border-t pt-4">
					{isSelf ? (
						<p className="text-[13px] text-muted-foreground">
							This is your account.
						</p>
					) : blocked ? (
						<UnblockUserButton userId={u.id} />
					) : (
						<BlockUserDialog userId={u.id} userName={u.name} />
					)}
				</div>
			</div>

			{/* Cases */}
			<div className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
				<div className="border-border border-b px-5 py-3.5">
					<h2 className="font-bold text-[15px] text-ink">Cases</h2>
					<p className="mt-0.5 text-[12.5px] text-muted-foreground">
						The most recent cases raised by this account.
					</p>
				</div>

				{u.cases.length === 0 ? (
					<div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
						<span className="flex size-10 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
							<FolderOpen className="size-5" aria-hidden="true" />
						</span>
						<p className="text-[13.5px] text-muted-foreground">No cases.</p>
					</div>
				) : (
					u.cases.map((c) => {
						const badge = CASE_BADGES[c.status] ?? {
							text: c.status,
							dot: "bg-ink-soft",
						};
						return (
							<div
								key={c.id}
								className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-border border-t px-5 py-4"
							>
								<div className="min-w-0 flex-1">
									<Link
										href={`/cases/${c.id}` as Route}
										className="inline-flex max-w-full items-center gap-1.5 font-semibold text-[14px] text-ink hover:text-brass-deep"
									>
										<span className="truncate">
											{c.title || "Untitled case"}
										</span>
										<ArrowRight
											className="size-3.5 shrink-0"
											aria-hidden="true"
										/>
									</Link>
									<p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
										<span
											className={cn("size-1.5 rounded-full", badge.dot)}
											aria-hidden="true"
										/>
										<span className="capitalize">{badge.text}</span>
										<span>· {dayFmt.format(c.createdAt)}</span>
									</p>
								</div>
								<p className="text-[13px] text-ink tabular-nums">
									{money(c.raisedCents / 100)} raised · {c.donorsCount} donors
								</p>
							</div>
						);
					})
				)}
			</div>

			{/* Donations */}
			<div className="rounded-[var(--radius-card-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-rest)]">
				<h2 className="flex items-center gap-2 font-bold text-[15px] text-ink">
					<HeartHandshake
						className="size-4 text-brass-deep"
						aria-hidden="true"
					/>
					Donations
				</h2>
				<p className="mt-1 text-[13.5px] text-muted-foreground">
					Donation history isn't tracked yet.
				</p>
			</div>
		</div>
	);
}
