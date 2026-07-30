/**
 * Verification for administrator invitations and user blocking at the data
 * layer. Creates tagged users/invitations, drives the real functions in
 * ./src/users and ./src/invitations, asserts what landed in Postgres, then
 * deletes every tagged row.
 *
 * Run from packages/db:  bun --env-file=../../.env jus67-check.ts
 */
// packages/db has no dependency on @just-us/auth, so "@just-us/auth/user-status"
// does not resolve here; the shared status helpers are reached by path instead.
import { isBlocked, isLocked } from "../auth/src/user-status";
import prisma from "./src/index";
import {
	acceptInvitation,
	countRecentInvitationsBy,
	createInvitation,
	findInvitationByTokenHash,
	invitationStatus,
	listPendingInvitations,
	resendInvitation,
	revokeInvitation,
} from "./src/invitations";
import {
	activeBlockWhere,
	blockUser,
	notActiveBlockWhere,
	unblockUser,
} from "./src/users";

const TAG = "jus67-check";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let passes = 0;
let failures = 0;

function check(label: string, pass: boolean, detail = "") {
	if (pass) passes++;
	else failures++;
	console.log(
		`${pass ? "PASS" : "FAIL"}  ${label}${pass ? "" : ` — ${detail}`}`,
	);
}

function addr(local: string) {
	return `${TAG}+${local}@example.com`;
}

function future(ms: number) {
	return new Date(Date.now() + ms);
}

function past(ms: number) {
	return new Date(Date.now() - ms);
}

async function makeUser(key: string, role: string) {
	return prisma.user.create({
		data: {
			id: `${TAG}-${key}`,
			name: `Check ${key}`,
			email: addr(key.toLowerCase()),
			role,
			emailVerified: true,
			onboarded: true,
		},
	});
}

async function makeSession(userId: string, key: string) {
	return prisma.session.create({
		data: {
			id: `${TAG}-session-${key}`,
			token: `${TAG}-token-${key}`,
			expiresAt: future(DAY),
			userId,
		},
	});
}

async function readUser(id: string) {
	return prisma.user.findUniqueOrThrow({
		where: { id },
		select: {
			banned: true,
			banReason: true,
			banExpires: true,
			lockedUntil: true,
			role: true,
			email: true,
			emailVerified: true,
			onboarded: true,
		},
	});
}

/**
 * Removes every row this script can create. AuditLog.actor does not cascade, so
 * audit entries have to go before the users they point at.
 */
async function purge() {
	const userIds = (
		await prisma.user.findMany({
			where: { email: { startsWith: TAG } },
			select: { id: true },
		})
	).map((row) => row.id);
	const invitationIds = (
		await prisma.adminInvitation.findMany({
			where: { email: { startsWith: TAG } },
			select: { id: true },
		})
	).map((row) => row.id);

	await prisma.auditLog.deleteMany({
		where: {
			OR: [
				{ actorId: { in: userIds } },
				{ actorId: { startsWith: TAG } },
				{ targetId: { in: [...userIds, ...invitationIds] } },
				{ targetId: { startsWith: TAG } },
			],
		},
	});
	await prisma.adminInvitation.deleteMany({
		where: { email: { startsWith: TAG } },
	});
	await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
	await prisma.account.deleteMany({ where: { userId: { in: userIds } } });
	await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
}

async function rowCounts() {
	const [users, sessions, accounts, invitations, audit] = await Promise.all([
		prisma.user.count(),
		prisma.session.count(),
		prisma.account.count(),
		prisma.adminInvitation.count(),
		prisma.auditLog.count(),
	]);
	return { users, sessions, accounts, invitations, audit };
}

// Leftovers from an interrupted run would poison the assertions below.
await purge();
const baseline = await rowCounts();

const REASON_FLAT = `${TAG} flat block`;
const REASON_TIMED = `${TAG} timed block`;
const REASON_RELOCK = `${TAG} relock after lapse`;
const REASON_ADMIN = `${TAG} admin block`;

try {
	const adminA = await makeUser("adminA", "administrator");
	const adminB = await makeUser("adminB", "administrator");
	const donorC = await makeUser("donorC", "donor");
	// Left in the state every freshly created account is born in: banned is null.
	const donorD = await makeUser("donorD", "donor");
	await makeSession(adminA.id, "adminA");
	await makeSession(adminB.id, "adminB");
	await makeSession(donorC.id, "donorC-1");
	await makeSession(donorC.id, "donorC-2");

	console.log("--- block mechanics ---");

	const missing = await blockUser(adminA.id, `${TAG}-ghost`, REASON_FLAT);
	check(
		"unknown target rejected",
		!missing.ok && missing.code === "not_found",
		JSON.stringify(missing),
	);

	const self = await blockUser(adminA.id, adminA.id, REASON_FLAT);
	check(
		"self-block rejected",
		!self.ok && self.code === "self_block",
		JSON.stringify(self),
	);

	const blocked = await blockUser(adminA.id, donorC.id, REASON_FLAT);
	check("block accepted", blocked.ok, JSON.stringify(blocked));

	const donorBlocked = await readUser(donorC.id);
	check(
		"banned set",
		donorBlocked.banned === true,
		`got ${donorBlocked.banned}`,
	);
	check(
		"reason stored",
		donorBlocked.banReason === REASON_FLAT,
		JSON.stringify(donorBlocked.banReason),
	);
	check(
		"indefinite block has no expiry",
		donorBlocked.banExpires === null,
		JSON.stringify(donorBlocked.banExpires),
	);
	check(
		"sessions revoked",
		(await prisma.session.count({ where: { userId: donorC.id } })) === 0,
		"session rows survived the block",
	);
	check(
		"one audit entry for the block",
		(await prisma.auditLog.count({
			where: {
				action: "user.blocked",
				actorId: adminA.id,
				targetId: donorC.id,
				reason: REASON_FLAT,
			},
		})) === 1,
		"expected exactly one user.blocked row",
	);
	check(
		"actor's own sessions untouched",
		(await prisma.session.count({ where: { userId: adminA.id } })) === 1,
		"the actor lost a session",
	);

	const again = await blockUser(adminA.id, donorC.id, REASON_FLAT);
	check(
		"double block rejected",
		!again.ok && again.code === "already_blocked",
		JSON.stringify(again),
	);

	const unblocked = await unblockUser(adminA.id, donorC.id);
	check("unblock accepted", unblocked.ok, JSON.stringify(unblocked));

	const donorClear = await readUser(donorC.id);
	check(
		"block fields cleared",
		donorClear.banned === false &&
			donorClear.banReason === null &&
			donorClear.banExpires === null,
		JSON.stringify(donorClear),
	);
	check(
		"one audit entry for the unblock",
		(await prisma.auditLog.count({
			where: {
				action: "user.unblocked",
				actorId: adminA.id,
				targetId: donorC.id,
			},
		})) === 1,
		"expected exactly one user.unblocked row",
	);

	const unblockTwice = await unblockUser(adminA.id, donorC.id);
	check(
		"double unblock rejected",
		!unblockTwice.ok && unblockTwice.code === "not_blocked",
		JSON.stringify(unblockTwice),
	);

	console.log("\n--- timed blocks lapse and can be reapplied ---");

	const timed = await blockUser(
		adminA.id,
		donorC.id,
		REASON_TIMED,
		future(HOUR),
	);
	check("timed block accepted", timed.ok, JSON.stringify(timed));

	const live = await readUser(donorC.id);
	check("expiry stored", live.banExpires !== null, "banExpires is null");
	check("live timed block reads as blocked", isBlocked(live));
	check(
		"live timed block matches the active-block filter",
		(await prisma.user.count({
			where: { id: donorC.id, ...activeBlockWhere(new Date()) },
		})) === 1,
		"activeBlockWhere missed a live block",
	);

	await prisma.user.update({
		where: { id: donorC.id },
		data: { banExpires: past(HOUR) },
	});
	const lapsed = await readUser(donorC.id);
	check("lapsed block reads as unblocked", !isBlocked(lapsed));
	check(
		"lapsed block excluded from the active-block filter",
		(await prisma.user.count({
			where: { id: donorC.id, ...activeBlockWhere(new Date()) },
		})) === 0,
		"activeBlockWhere counted a lapsed block",
	);

	const relock = await blockUser(adminA.id, donorC.id, REASON_RELOCK);
	check("re-block after lapse accepted", relock.ok, JSON.stringify(relock));
	const relocked = await readUser(donorC.id);
	check(
		"re-block replaces the lapsed expiry",
		relocked.banned === true &&
			relocked.banReason === REASON_RELOCK &&
			relocked.banExpires === null,
		JSON.stringify(relocked),
	);

	const relockClear = await unblockUser(adminA.id, donorC.id);
	check(
		"timed-block state restored",
		relockClear.ok,
		JSON.stringify(relockClear),
	);

	console.log(
		"\n--- the active-block predicate against a never-blocked row ---",
	);

	const nullMatches = await prisma.user.count({
		where: { id: donorD.id, ...activeBlockWhere(new Date()) },
	});
	check(
		"never-blocked user is not an active block",
		nullMatches === 0,
		`matched ${nullMatches}`,
	);
	const nullNegated = await prisma.user.count({
		where: { id: donorD.id, AND: [notActiveBlockWhere(new Date())] },
	});
	check(
		"never-blocked user counts as not-blocked",
		nullNegated === 1,
		"banned is null on every account that was never blocked; the complement " +
			"must match those rows explicitly — a Prisma NOT never can under SQL " +
			"three-valued logic",
	);
	const falseNegated = await prisma.user.count({
		where: { id: donorC.id, AND: [notActiveBlockWhere(new Date())] },
	});
	check(
		"explicitly unblocked user counts as not-blocked",
		falseNegated === 1,
		`matched ${falseNegated}`,
	);

	console.log("\n--- last active administrator is protected ---");

	// The guard counts every administrator row in the database, so administrators
	// belonging to other data are parked as blocked for this section only and
	// restored with their original values right after.
	const outsiders = await prisma.user.findMany({
		where: {
			role: "administrator",
			email: { not: { startsWith: TAG } },
			AND: [notActiveBlockWhere(new Date())],
		},
		select: { id: true, banned: true, banReason: true, banExpires: true },
	});
	for (const outsider of outsiders) {
		await prisma.user.update({
			where: { id: outsider.id },
			data: { banned: true, banExpires: null },
		});
	}

	try {
		// Both administrators still carry banned = null here, which is exactly how
		// acceptInvitation mints them, so this is the state the guard meets in
		// production.
		const nullState = await blockUser(adminA.id, adminB.id, REASON_ADMIN);
		check(
			"administrator blockable while a second banned=null administrator is active",
			nullState.ok,
			`${JSON.stringify(nullState)} — two unblocked administrators exist, but the ` +
				"guard's active-admin count excludes rows with banned = null",
		);
		if (nullState.ok) await unblockUser(adminA.id, adminB.id);

		// Normalised to an explicitly unblocked state so the rule itself can be
		// exercised independently of the null-counting defect above.
		await prisma.user.updateMany({
			where: { id: { in: [adminA.id, adminB.id] } },
			data: { banned: false },
		});

		const blockB = await blockUser(adminA.id, adminB.id, REASON_ADMIN);
		check(
			"administrator blocked while a second one is active",
			blockB.ok,
			JSON.stringify(blockB),
		);

		const lastAdmin = await blockUser(adminB.id, adminA.id, REASON_ADMIN);
		check(
			"last active administrator rejected",
			!lastAdmin.ok && lastAdmin.code === "last_administrator",
			JSON.stringify(lastAdmin),
		);
		const survivor = await readUser(adminA.id);
		check(
			"rejected last-admin block changed nothing",
			survivor.banned !== true && survivor.banReason === null,
			JSON.stringify(survivor),
		);

		const restoreB = await unblockUser(adminA.id, adminB.id);
		check("administrator unblocked", restoreB.ok, JSON.stringify(restoreB));
		const restoredB = await readUser(adminB.id);
		check(
			"both administrators active again",
			restoredB.banned === false && survivor.banned !== true,
			JSON.stringify(restoredB),
		);
	} finally {
		for (const outsider of outsiders) {
			await prisma.user.update({
				where: { id: outsider.id },
				data: {
					banned: outsider.banned,
					banReason: outsider.banReason,
					banExpires: outsider.banExpires,
				},
			});
		}
		const stillParked = await prisma.user.count({
			where: {
				id: { in: outsiders.map((o) => o.id) },
				...activeBlockWhere(new Date()),
			},
		});
		check(
			"administrators outside this run restored",
			stillParked === 0,
			`${stillParked} left blocked`,
		);
	}

	console.log("\n--- lockout is separate from blocking ---");

	await prisma.user.update({
		where: { id: donorC.id },
		data: { lockedUntil: future(HOUR) },
	});
	check(
		"future lockedUntil reads as locked",
		isLocked(await readUser(donorC.id)),
	);
	await prisma.user.update({
		where: { id: donorC.id },
		data: { lockedUntil: past(HOUR) },
	});
	const lapsedLock = await readUser(donorC.id);
	check("past lockedUntil reads as unlocked", !isLocked(lapsedLock));
	check(
		"lockout does not imply a block",
		!isBlocked(lapsedLock),
		"a locked user was reported blocked",
	);
	await prisma.user.update({
		where: { id: donorC.id },
		data: { lockedUntil: null },
	});
	check(
		"null lockedUntil reads as unlocked",
		!isLocked(await readUser(donorC.id)),
	);

	console.log("\n--- invitation creation ---");

	const email1 = addr("invite1");
	const HASH_1 = `${TAG}-hash-1`;
	const HASH_2 = `${TAG}-hash-2`;
	const created = await createInvitation({
		email: email1,
		invitedById: adminA.id,
		tokenHash: HASH_1,
		expiresAt: future(7 * DAY),
	});
	check("invitation created", created.ok, JSON.stringify(created));
	if (!created.ok)
		throw new Error("invitation creation failed, cannot continue");
	const invite1 = created.id;

	const found1 = await findInvitationByTokenHash(HASH_1);
	check(
		"invitation found by token hash",
		found1?.id === invite1,
		`got ${found1?.id}`,
	);
	check(
		"fresh invitation is pending",
		found1 !== null && invitationStatus(found1) === "pending",
		found1 ? invitationStatus(found1) : "not found",
	);
	check(
		"invitation email lowercased and stored",
		found1?.email === email1,
		JSON.stringify(found1?.email),
	);
	check(
		"audit entry for the creation",
		(await prisma.auditLog.count({
			where: {
				action: "invite.created",
				actorId: adminA.id,
				targetId: invite1,
			},
		})) === 1,
		"expected exactly one invite.created row",
	);
	check(
		"pending invitation is listed",
		(await listPendingInvitations()).some((row) => row.id === invite1),
		"listPendingInvitations omitted a pending invitation",
	);

	const duplicate = await createInvitation({
		email: email1,
		invitedById: adminA.id,
		tokenHash: `${TAG}-hash-dup`,
		expiresAt: future(7 * DAY),
	});
	check(
		"second pending invitation for the same email rejected",
		!duplicate.ok && duplicate.code === "already_invited",
		JSON.stringify(duplicate),
	);

	const existing = await createInvitation({
		email: donorC.email,
		invitedById: adminA.id,
		tokenHash: `${TAG}-hash-existing`,
		expiresAt: future(7 * DAY),
	});
	check(
		"invitation to an existing account rejected",
		!existing.ok && existing.code === "existing_account",
		JSON.stringify(existing),
	);
	check(
		"rejected escalation attempt audited against the account",
		(await prisma.auditLog.count({
			where: {
				action: "invite.rejected_existing_account",
				actorId: adminA.id,
				targetId: donorC.id,
			},
		})) === 1,
		"expected exactly one invite.rejected_existing_account row",
	);
	check(
		"rejected attempt stored no invitation",
		(await prisma.adminInvitation.count({
			where: { email: donorC.email },
		})) === 0,
		"an invitation row was created for an existing account",
	);

	check(
		"recent invitations counted for the inviter",
		(await countRecentInvitationsBy(adminA.id, past(HOUR))) >= 1,
		"countRecentInvitationsBy returned 0",
	);
	check(
		"recent invitations not attributed to another admin",
		(await countRecentInvitationsBy(adminB.id, past(HOUR))) === 0,
		"invitations leaked across inviters",
	);

	console.log("\n--- resend rotates the token ---");

	const resent = await resendInvitation(
		invite1,
		adminA.id,
		HASH_2,
		future(7 * DAY),
	);
	check("resend accepted", resent?.id === invite1, JSON.stringify(resent));
	check(
		"old token hash no longer resolves",
		(await findInvitationByTokenHash(HASH_1)) === null,
		"the superseded hash still resolves",
	);
	check(
		"new token hash resolves to the same row",
		(await findInvitationByTokenHash(HASH_2))?.id === invite1,
		"the rotated hash does not resolve",
	);
	check(
		"audit entry for the resend",
		(await prisma.auditLog.count({
			where: { action: "invite.resent", actorId: adminA.id, targetId: invite1 },
		})) === 1,
		"expected exactly one invite.resent row",
	);

	console.log("\n--- revoke is terminal ---");

	const revoked = await revokeInvitation(invite1, adminA.id);
	check("revoke accepted", revoked?.id === invite1, JSON.stringify(revoked));
	const afterRevoke = await findInvitationByTokenHash(HASH_2);
	check(
		"revokedAt stamped",
		afterRevoke?.revokedAt != null,
		JSON.stringify(afterRevoke?.revokedAt),
	);
	check(
		"status reads as revoked",
		afterRevoke !== null && invitationStatus(afterRevoke) === "revoked",
		afterRevoke ? invitationStatus(afterRevoke) : "not found",
	);
	check(
		"audit entry for the revoke",
		(await prisma.auditLog.count({
			where: {
				action: "invite.revoked",
				actorId: adminA.id,
				targetId: invite1,
			},
		})) === 1,
		"expected exactly one invite.revoked row",
	);
	check(
		"revoked invitation dropped from the pending list",
		!(await listPendingInvitations()).some((row) => row.id === invite1),
		"listPendingInvitations kept a revoked invitation",
	);

	const revokeTwice = await revokeInvitation(invite1, adminA.id);
	check(
		"second revoke is a no-op",
		revokeTwice === null,
		JSON.stringify(revokeTwice),
	);

	const acceptRevoked = await acceptInvitation({
		tokenHash: HASH_2,
		name: "Check revoked",
		passwordHash: "x",
	});
	check(
		"revoked invitation cannot be accepted",
		!acceptRevoked.ok && acceptRevoked.code === "revoked",
		JSON.stringify(acceptRevoked),
	);

	console.log("\n--- expiry blocks acceptance ---");

	const HASH_3 = `${TAG}-hash-3`;
	const staleCreate = await createInvitation({
		email: addr("invite2"),
		invitedById: adminA.id,
		tokenHash: HASH_3,
		expiresAt: future(7 * DAY),
	});
	check(
		"second invitation created",
		staleCreate.ok,
		JSON.stringify(staleCreate),
	);
	if (!staleCreate.ok) throw new Error("second invitation failed");
	await prisma.adminInvitation.update({
		where: { id: staleCreate.id },
		data: { expiresAt: past(HOUR) },
	});
	const stale = await findInvitationByTokenHash(HASH_3);
	check(
		"status reads as expired",
		stale !== null && invitationStatus(stale) === "expired",
		stale ? invitationStatus(stale) : "not found",
	);
	const acceptExpired = await acceptInvitation({
		tokenHash: HASH_3,
		name: "Check expired",
		passwordHash: "x",
	});
	check(
		"expired invitation cannot be accepted",
		!acceptExpired.ok && acceptExpired.code === "expired",
		JSON.stringify(acceptExpired),
	);
	check(
		"expired invitation dropped from the pending list",
		!(await listPendingInvitations()).some((row) => row.id === staleCreate.id),
		"listPendingInvitations kept an expired invitation",
	);

	console.log("\n--- acceptance mints a verified administrator ---");

	const HASH_4 = `${TAG}-hash-4`;
	const email3 = addr("invite3");
	const goodCreate = await createInvitation({
		email: email3,
		invitedById: adminA.id,
		tokenHash: HASH_4,
		expiresAt: future(7 * DAY),
	});
	check("third invitation created", goodCreate.ok, JSON.stringify(goodCreate));
	if (!goodCreate.ok) throw new Error("third invitation failed");

	const accepted = await acceptInvitation({
		tokenHash: HASH_4,
		name: "Check accepted",
		passwordHash: "x",
	});
	check("invitation accepted", accepted.ok, JSON.stringify(accepted));
	if (!accepted.ok)
		throw new Error("acceptance failed, cannot inspect the account");

	const minted = await readUser(accepted.userId);
	check(
		"new account is an administrator",
		minted.role === "administrator",
		minted.role,
	);
	check("new account is email-verified", minted.emailVerified === true);
	check("new account skips onboarding", minted.onboarded === true);
	check(
		"new account uses the invited email",
		minted.email === email3,
		JSON.stringify(minted.email),
	);
	const credential = await prisma.account.findFirst({
		where: { userId: accepted.userId, providerId: "credential" },
		select: { password: true, accountId: true },
	});
	check(
		"credential account created with the password hash",
		credential?.password === "x",
		JSON.stringify(credential),
	);
	const acceptedRow = await findInvitationByTokenHash(HASH_4);
	check(
		"acceptedAt stamped",
		acceptedRow?.acceptedAt != null,
		JSON.stringify(acceptedRow?.acceptedAt),
	);
	check(
		"status reads as accepted",
		acceptedRow !== null && invitationStatus(acceptedRow) === "accepted",
		acceptedRow ? invitationStatus(acceptedRow) : "not found",
	);
	check(
		"acceptance audited as the new administrator",
		(await prisma.auditLog.count({
			where: {
				action: "invite.accepted",
				actorId: accepted.userId,
				targetId: goodCreate.id,
			},
		})) === 1,
		"expected exactly one invite.accepted row authored by the new user",
	);

	const reuse = await acceptInvitation({
		tokenHash: HASH_4,
		name: "Check reuse",
		passwordHash: "x",
	});
	check(
		"accepted invitation is single-use",
		!reuse.ok && reuse.code === "used",
		JSON.stringify(reuse),
	);

	console.log("\n--- acceptance loses the race for the email ---");

	const HASH_5 = `${TAG}-hash-5`;
	const email4 = addr("invite4");
	const raced = await createInvitation({
		email: email4,
		invitedById: adminA.id,
		tokenHash: HASH_5,
		expiresAt: future(7 * DAY),
	});
	check("fourth invitation created", raced.ok, JSON.stringify(raced));
	await prisma.user.create({
		data: {
			id: `${TAG}-squatter`,
			name: "Check squatter",
			email: email4,
			role: "donor",
		},
	});
	const takenAccept = await acceptInvitation({
		tokenHash: HASH_5,
		name: "Check taken",
		passwordHash: "x",
	});
	check(
		"acceptance rejected when the email was claimed first",
		!takenAccept.ok && takenAccept.code === "email_taken",
		JSON.stringify(takenAccept),
	);
	check(
		"no administrator minted for the claimed email",
		(
			await prisma.user.findUniqueOrThrow({
				where: { email: email4 },
				select: { role: true },
			})
		).role === "donor",
		"the squatter was escalated",
	);

	const bogus = await acceptInvitation({
		tokenHash: `${TAG}-hash-unknown`,
		name: "Check bogus",
		passwordHash: "x",
	});
	check(
		"unknown token hash rejected",
		!bogus.ok && bogus.code === "invalid",
		JSON.stringify(bogus),
	);
} catch (err) {
	failures++;
	console.log(
		`FAIL  unexpected error — ${err instanceof Error ? err.stack : String(err)}`,
	);
} finally {
	console.log("\n--- cleanup ---");
	await purge();
	const after = await rowCounts();
	for (const key of Object.keys(baseline) as (keyof typeof baseline)[]) {
		check(
			`${key} table back to its starting count`,
			after[key] === baseline[key],
			`expected ${baseline[key]}, got ${after[key]}`,
		);
	}
}

console.log(`\nJUS-67 db-layer check: ${passes} passed, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
