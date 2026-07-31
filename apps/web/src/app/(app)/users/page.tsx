import { isRole } from "@just-us/auth/rbac";
import { isBlocked, isLocked } from "@just-us/auth/user-status";
import { listPendingInvitations } from "@just-us/db/invitations";
import {
	countUsers,
	listUsers,
	type UserListFilter,
	userCounts,
} from "@just-us/db/users";
import { buttonVariants } from "@just-us/ui/components/button";
import { cn } from "@just-us/ui/lib/utils";
import { ArrowLeft, ArrowRight, Users } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { InvitationRowActions } from "@/components/dashboard/invitation-row-actions";
import { InviteAdminDialog } from "@/components/dashboard/invite-admin-dialog";
import { UserFilters } from "@/components/dashboard/user-filters";
import { requireAdministrator } from "@/lib/auth-server";

const PAGE_SIZE = 10;

// Formatted on the server so the rendered string is what every viewer sees.
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

function ago(date: Date) {
	const s = Math.floor((Date.now() - date.getTime()) / 1000);
	if (s < 60) return "just now";
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	return `${Math.floor(h / 24)}d ago`;
}

function expiresIn(date: Date) {
	const s = Math.floor((date.getTime() - Date.now()) / 1000);
	if (s <= 0) return "expiring now";
	const m = Math.floor(s / 60);
	if (m < 60) return `in ${m}m`;
	const h = Math.floor(m / 60);
	if (h < 24) return `in ${h}h`;
	return `in ${Math.floor(h / 24)}d`;
}

const PILL =
	"inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-0.5 font-mono font-semibold text-[10px] uppercase tracking-[0.06em]";

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

function tri(value: string | undefined) {
	if (value === "yes") return true;
	if (value === "no") return false;
	return undefined;
}

function pageHref(base: URLSearchParams, page: number) {
	const next = new URLSearchParams(base);
	if (page > 1) next.set("page", String(page));
	const qs = next.toString();
	return (qs ? `/users?${qs}` : "/users") as Route;
}

const COLUMNS = "lg:grid-cols-[2fr_100px_120px_1.4fr_100px_100px]";
const INVITE_COLUMNS = "sm:grid-cols-[1.6fr_1fr_1fr_auto]";
const HEAD =
	"font-mono font-semibold text-[10.5px] text-muted-foreground uppercase tracking-[0.06em]";

/** One grid cell, with the column name inlined on narrow screens. */
function Cell({
	label,
	at,
	children,
}: {
	label: string;
	at?: "sm" | "lg";
	children: ReactNode;
}) {
	return (
		<div className="min-w-0">
			<span
				className={cn(
					HEAD,
					"mb-0.5 block",
					at === "sm" ? "sm:hidden" : "lg:hidden",
				)}
			>
				{label}
			</span>
			{children}
		</div>
	);
}

export default async function UsersPage({
	searchParams,
}: {
	searchParams: Promise<{
		page?: string;
		q?: string;
		role?: string;
		verified?: string;
		blocked?: string;
	}>;
}) {
	await requireAdministrator();
	const sp = await searchParams;

	const filter: UserListFilter = {
		q: sp?.q?.trim() || undefined,
		role: isRole(sp?.role) ? sp.role : undefined,
		verified: tri(sp?.verified),
		blocked: tri(sp?.blocked),
	};
	const filtered =
		filter.q !== undefined ||
		filter.role !== undefined ||
		filter.verified !== undefined ||
		filter.blocked !== undefined;

	const [counts, invitations, total] = await Promise.all([
		userCounts(),
		listPendingInvitations(),
		countUsers(filter),
	]);

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const requested = Number(sp?.page) || 1;
	const page = Math.min(Math.max(1, requested), totalPages);
	const users = await listUsers(filter, {
		skip: (page - 1) * PAGE_SIZE,
		take: PAGE_SIZE,
	});

	// Pager links carry the active filters, so paging never silently widens the
	// result set the administrator is looking at.
	const base = new URLSearchParams();
	if (filter.q) base.set("q", filter.q);
	if (filter.role) base.set("role", filter.role);
	if (filter.verified !== undefined) {
		base.set("verified", filter.verified ? "yes" : "no");
	}
	if (filter.blocked !== undefined) {
		base.set("blocked", filter.blocked ? "yes" : "no");
	}

	const accounts = counts.total === 1 ? "account" : "accounts";

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="font-extrabold text-[30px] text-ink tracking-[-0.02em]">
					Users
				</h1>
				<p className="mt-1.5 text-[14.5px] text-ink-soft">
					Plaintiffs, donors, attorneys, and administrators.
				</p>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="font-semibold text-[13.5px] text-ink-soft tabular-nums">
					{filtered
						? `${total} of ${counts.total} ${accounts}`
						: `${counts.total} ${accounts}`}
				</p>
				<InviteAdminDialog />
			</div>

			{invitations.length > 0 && (
				<div className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
					<div className="border-border border-b px-5 py-3.5">
						<h2 className="font-bold text-[15px] text-ink">
							Pending invitations
						</h2>
						<p className="mt-0.5 text-[12.5px] text-muted-foreground">
							Administrator invitations that haven't been accepted yet.
						</p>
					</div>

					<div
						className={cn("hidden gap-x-4 px-5 py-3 sm:grid", INVITE_COLUMNS)}
					>
						<span className={HEAD}>Invitation</span>
						<span className={HEAD}>Invited by</span>
						<span className={HEAD}>Expires</span>
						<span className={HEAD}>Actions</span>
					</div>

					{invitations.map((inv) => (
						<div
							key={inv.id}
							className={cn(
								"grid grid-cols-1 items-center gap-x-4 gap-y-2.5 border-border border-t px-5 py-4 sm:gap-y-0",
								INVITE_COLUMNS,
							)}
						>
							<Cell label="Invitation" at="sm">
								<p className="truncate font-semibold text-[13.5px] text-ink">
									{inv.email}
								</p>
								<p className="mt-0.5 text-[11.5px] text-muted-foreground">
									Sent {stamp(inv.createdAt)} · {ago(inv.createdAt)}
								</p>
							</Cell>

							<Cell label="Invited by" at="sm">
								<p className="truncate text-[13px] text-ink-soft">
									{inv.invitedBy.name}
								</p>
							</Cell>

							<Cell label="Expires" at="sm">
								<p className="text-[13px] text-ink tabular-nums">
									{dayFmt.format(inv.expiresAt)}
								</p>
								<p className="mt-0.5 text-[11.5px] text-muted-foreground">
									{expiresIn(inv.expiresAt)}
								</p>
							</Cell>

							<Cell label="Actions" at="sm">
								<InvitationRowActions id={inv.id} />
							</Cell>
						</div>
					))}
				</div>
			)}

			<UserFilters />

			{users.length === 0 ? (
				<div className="flex flex-col items-center gap-3 rounded-[var(--radius-card-lg)] border border-border bg-surface px-6 py-16 text-center shadow-[var(--shadow-rest)]">
					<span className="flex size-12 items-center justify-center rounded-xl bg-brass-wash text-brass-deep">
						<Users className="size-6" aria-hidden="true" />
					</span>
					<p className="font-bold text-[16px] text-ink">No accounts match.</p>
					<p className="max-w-[42ch] text-[13.5px] text-muted-foreground leading-relaxed">
						Clear the search or the filters above to see every account.
					</p>
				</div>
			) : (
				<div className="overflow-hidden rounded-[var(--radius-card-lg)] border border-border bg-surface shadow-[var(--shadow-rest)]">
					<div className={cn("hidden gap-x-4 px-5 py-3 lg:grid", COLUMNS)}>
						<span className={HEAD}>Account</span>
						<span className={HEAD}>Role</span>
						<span className={HEAD}>Jurisdiction</span>
						<span className={HEAD}>Status</span>
						<span className={HEAD}>Joined</span>
						<span className={HEAD}>Last sign-in</span>
					</div>

					{users.map((u) => (
						<div
							key={u.id}
							className={cn(
								"grid grid-cols-1 gap-x-4 gap-y-2.5 border-border border-t px-5 py-4 lg:gap-y-0",
								COLUMNS,
							)}
						>
							<Cell label="Account">
								<Link
									href={`/users/${u.id}` as Route}
									className="block min-w-0"
								>
									<p className="truncate font-semibold text-[13.5px] text-ink hover:text-brass-deep">
										{u.name}
									</p>
									<p className="truncate text-[11.5px] text-muted-foreground">
										{u.email}
									</p>
								</Link>
							</Cell>

							<Cell label="Role">
								<p className="text-[13px] text-ink-soft capitalize">{u.role}</p>
							</Cell>

							<Cell label="Jurisdiction">
								<p className="truncate text-[13px] text-ink-soft">
									{u.jurisdiction || "—"}
								</p>
							</Cell>

							<Cell label="Status">
								<div className="flex flex-wrap gap-1.5">
									{statusPills(u).map((p) => (
										<span key={p.text} className={cn(PILL, p.cls)}>
											<span className={cn("size-1.5 rounded-full", p.dot)} />
											{p.text}
										</span>
									))}
								</div>
							</Cell>

							<Cell label="Joined">
								<p className="text-[12.5px] text-ink tabular-nums">
									{dayFmt.format(u.createdAt)}
								</p>
							</Cell>

							<Cell label="Last sign-in">
								<p
									className={cn(
										"text-[12.5px] tabular-nums",
										u.lastSignInAt ? "text-ink" : "text-muted-foreground",
									)}
								>
									{u.lastSignInAt ? dayFmt.format(u.lastSignInAt) : "Never"}
								</p>
							</Cell>
						</div>
					))}
				</div>
			)}

			{totalPages > 1 && (
				<div className="flex items-center justify-between border-border border-t pt-5">
					<Link
						href={pageHref(base, page - 1)}
						aria-disabled={page <= 1}
						className={cn(
							buttonVariants({ variant: "outline", size: "sm" }),
							"h-9",
							page <= 1 && "pointer-events-none opacity-40",
						)}
					>
						<ArrowLeft data-icon="inline-start" aria-hidden="true" />
						Previous
					</Link>
					<span className="text-[13px] text-muted-foreground">
						Page {page} of {totalPages}
					</span>
					<Link
						href={pageHref(base, page + 1)}
						aria-disabled={page >= totalPages}
						className={cn(
							buttonVariants({ variant: "outline", size: "sm" }),
							"h-9",
							page >= totalPages && "pointer-events-none opacity-40",
						)}
					>
						Next
						<ArrowRight data-icon="inline-end" aria-hidden="true" />
					</Link>
				</div>
			)}
		</div>
	);
}
