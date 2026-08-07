/**
 * Verification for the in-app assistant's role scoping, platform knowledge
 * search, spend/rate enforcement, and system prompt. Drives the real functions
 * in ./src, asserts against the real dev database for the enforcement checks,
 * then deletes every row it created.
 *
 * Run from packages/ai:  bun --env-file=../../.env jus68-check.ts
 */
import type { Role } from "@just-us/auth/rbac";
import prisma from "@just-us/db";
import { checkLimits } from "./src/enforcement";
import { searchPlatformHelp } from "./src/knowledge";
import {
	ENTITLEMENTS,
	MONTHLY_GLOBAL_CEILING_MICRO_USD,
	MONTHLY_USER_CEILING_MICRO_USD,
} from "./src/limits";
import { systemPrompt } from "./src/prompts";
import { buildTools, toolNamesForRole } from "./src/tools";

const TAG = "jus68-check";
const ROLES: Role[] = ["plaintiff", "donor", "attorney", "administrator"];

let passes = 0;
let failures = 0;

function check(label: string, pass: boolean, detail = "") {
	if (pass) passes++;
	else failures++;
	console.log(
		`${pass ? "PASS" : "FAIL"}  ${label}${pass ? "" : ` — ${detail}`}`,
	);
}

function same(a: readonly string[], b: readonly string[]) {
	return [...a].sort().join(",") === [...b].sort().join(",");
}

// ------------------------------------------------------------- 1. tool scoping

/**
 * Every property name a tool's input schema exposes, nested wrappers included.
 * Read off the zod internals rather than a JSON Schema conversion so a field
 * hidden behind `.optional()` or `.default()` still shows up.
 */
function schemaKeys(schema: unknown, seen = new Set<unknown>()): string[] {
	if (!schema || typeof schema !== "object" || seen.has(schema)) return [];
	seen.add(schema);
	const node = schema as {
		shape?: Record<string, unknown>;
		def?: Record<string, unknown>;
		_zod?: { def?: Record<string, unknown> };
	};
	const keys: string[] = [];
	const shape = node.shape ?? (node.def?.shape as Record<string, unknown>);
	if (shape) {
		for (const [key, value] of Object.entries(shape)) {
			keys.push(key);
			keys.push(...schemaKeys(value, seen));
		}
	}
	const def = node.def ?? node._zod?.def;
	for (const key of ["innerType", "element", "valueType", "in", "out"]) {
		const inner = def?.[key];
		if (inner) keys.push(...schemaKeys(inner, seen));
	}
	for (const option of (def?.options as unknown[]) ?? []) {
		keys.push(...schemaKeys(option, seen));
	}
	return keys;
}

/** Anything that could name a person, an owner, or a record someone else owns. */
const IDENTITY_KEY =
	/^(user|owner|donor|attorney|plaintiff|admin|account|case|chat|tenant|org|organisation|organization|session|actor|target|match|request|donation|save)_?id$/i;

function toolScoping() {
	const roleNames: Record<Role, string[]> = {
		plaintiff: [],
		donor: [],
		attorney: [],
		administrator: [],
	};

	for (const role of ROLES) {
		const expected = toolNamesForRole(role);
		const built = Object.keys(buildTools({ userId: `${TAG}-user`, role }));
		roleNames[role] = built;
		check(
			`buildTools(${role}) is exactly toolNamesForRole(${role})`,
			same(built, expected),
			`built ${JSON.stringify(built)} vs ${JSON.stringify(expected)}`,
		);
	}

	const plaintiffOnly = roleNames.plaintiff.filter(
		(name) => name !== "searchPlatformHelp",
	);
	const leaked = roleNames.donor.filter((name) => plaintiffOnly.includes(name));
	check(
		"donor tools carry none of the plaintiff tools",
		leaked.length === 0,
		`donor also has ${JSON.stringify(leaked)}`,
	);
	check(
		"administrator has searchPlatformHelp and nothing else",
		same(roleNames.administrator, ["searchPlatformHelp"]),
		`administrator has ${JSON.stringify(roleNames.administrator)}`,
	);

	const offenders: string[] = [];
	const allKeys = new Set<string>();
	for (const role of ROLES) {
		for (const [name, def] of Object.entries(
			buildTools({ userId: `${TAG}-user`, role }),
		)) {
			for (const key of schemaKeys(
				(def as { inputSchema?: unknown }).inputSchema,
			)) {
				allKeys.add(key);
				if (IDENTITY_KEY.test(key) || /^(id|ids)$/i.test(key)) {
					offenders.push(`${role}.${name}.${key}`);
				}
			}
		}
	}
	check(
		"no tool input names an identity or an owned record",
		offenders.length === 0,
		`identity-like inputs: ${JSON.stringify(offenders)}`,
	);
	check(
		"tool inputs were actually introspected",
		allKeys.size > 0,
		"no schema keys were read, so the previous check proves nothing",
	);
	console.log(`      tool inputs seen: ${[...allKeys].sort().join(", ")}`);
}

// -------------------------------------------------------- 2. knowledge search

function knowledgeSearch() {
	const cases: { query: string; expect: string[] }[] = [
		{ query: "fees", expect: ["fee"] },
		{ query: "donation", expect: ["donation"] },
		{ query: "attorney", expect: ["attorney"] },
	];
	for (const { query, expect } of cases) {
		const sections = searchPlatformHelp(query);
		const hay = sections
			.map((section) => `${section.title} ${section.body}`)
			.join(" ")
			.toLowerCase();
		const missing = expect.filter((word) => !hay.includes(word));
		check(
			`searchPlatformHelp("${query}") returns relevant sections`,
			sections.length > 0 && sections.length <= 3 && missing.length === 0,
			`${sections.length} sections${missing.length ? `, none mentioning ${missing.join(", ")}` : ""}`,
		);
		console.log(
			`      "${query}" → ${sections.map((section) => section.title).join(" | ")}`,
		);
	}

	const gibberish = searchPlatformHelp("qwzzlfrmp xyzzyquux");
	check(
		"searchPlatformHelp(gibberish) returns nothing",
		gibberish.length === 0,
		`returned ${gibberish.length} sections`,
	);
}

// ------------------------------------------------------------- 3. enforcement

async function makeUser() {
	return prisma.user.create({
		data: {
			id: `${TAG}-user`,
			name: "Check Assistant",
			email: `${TAG}@example.com`,
			role: "plaintiff",
			emailVerified: true,
			onboarded: true,
		},
	});
}

async function purge() {
	const messages = await prisma.chatMessage.deleteMany({
		where: { chat: { userId: `${TAG}-user` } },
	});
	const chats = await prisma.chat.deleteMany({
		where: { userId: `${TAG}-user` },
	});
	const usage = await prisma.aiUsage.deleteMany({
		where: {
			OR: [{ userId: { startsWith: TAG } }, { id: { startsWith: TAG } }],
		},
	});
	const users = await prisma.user.deleteMany({
		where: { email: `${TAG}@example.com` },
	});
	console.log(
		`      purged: messages=${messages.count} chats=${chats.count} usage=${usage.count} users=${users.count}`,
	);
}

async function enforcement() {
	const user = await makeUser();
	const chat = await prisma.chat.create({
		data: { id: `${TAG}-chat`, userId: user.id, role: "plaintiff" },
	});

	const fresh = await checkLimits(user.id, "plaintiff");
	check(
		"a fresh user may take a turn",
		fresh.ok,
		`verdict ${JSON.stringify(fresh)}`,
	);

	const quota = ENTITLEMENTS.plaintiff.maxMessagesPerHour;
	await prisma.chatMessage.createMany({
		data: Array.from({ length: quota }, (_, index) => ({
			id: `${TAG}-msg-${index}`,
			chatId: chat.id,
			role: "user" as const,
			parts: [{ type: "text", text: `check ${index}` }],
			createdAt: new Date(),
		})),
	});
	const rated = await checkLimits(user.id, "plaintiff");
	check(
		`${quota} messages inside the hour is a rate refusal`,
		!rated.ok && rated.kind === "rate",
		`verdict ${JSON.stringify(rated)}`,
	);
	if (!rated.ok) console.log(`      message: "${rated.message}"`);

	await prisma.chatMessage.deleteMany({ where: { chatId: chat.id } });
	const cleared = await checkLimits(user.id, "plaintiff");
	check(
		"clearing the messages clears the rate refusal",
		cleared.ok,
		`verdict ${JSON.stringify(cleared)}`,
	);

	await prisma.aiUsage.create({
		data: {
			id: `${TAG}-usage`,
			userId: user.id,
			role: "plaintiff",
			chatId: chat.id,
			model: "check",
			costMicroUsd: MONTHLY_USER_CEILING_MICRO_USD,
		},
	});
	const ceiling = await checkLimits(user.id, "plaintiff");
	check(
		"spend at the monthly user ceiling is a user-ceiling refusal",
		!ceiling.ok && ceiling.kind === "user-ceiling",
		`verdict ${JSON.stringify(ceiling)}`,
	);
	if (!ceiling.ok) console.log(`      message: "${ceiling.message}"`);

	// The platform cap sums every user's spend, so this row gates the assistant
	// for everyone while it exists. It is written last and removed by the same
	// purge that clears the rest, and both are tagged rather than broad deletes.
	await prisma.aiUsage.create({
		data: {
			id: `${TAG}-usage-global`,
			userId: user.id,
			role: "plaintiff",
			chatId: chat.id,
			model: "check",
			costMicroUsd: MONTHLY_GLOBAL_CEILING_MICRO_USD,
		},
	});
	const platform = await checkLimits(user.id, "plaintiff");
	// The user ceiling is checked first and this user is over it too, so what is
	// being asserted is that the global sum is read at all, not its precedence.
	check(
		"spend at the platform ceiling still refuses on a budget ground",
		!platform.ok && platform.kind !== "rate",
		`verdict ${JSON.stringify(platform)}`,
	);
	await prisma.aiUsage.deleteMany({ where: { id: `${TAG}-usage-global` } });
	const globalOnly = await prisma.aiUsage.create({
		data: {
			id: `${TAG}-usage-global`,
			userId: `${TAG}-nobody`,
			role: "donor",
			model: "check",
			costMicroUsd: MONTHLY_GLOBAL_CEILING_MICRO_USD,
		},
	});
	const other = await checkLimits(`${TAG}-someone-else`, "donor");
	check(
		"another user's spend over the platform ceiling is a global-ceiling refusal",
		!other.ok && other.kind === "global-ceiling",
		`verdict ${JSON.stringify(other)}`,
	);
	if (!other.ok) console.log(`      message: "${other.message}"`);
	await prisma.aiUsage.delete({ where: { id: globalOnly.id } });
}

// ---------------------------------------------------------- 4. system prompt

function prompts() {
	const required: { label: string; needles: string[] }[] = [
		{ label: "not-a-lawyer line", needles: ["not a lawyer"] },
		{ label: "no legal advice", needles: ["legal advice"] },
		{ label: "no case outcomes", needles: ["case outcomes"] },
		{ label: "nothing about other users", needles: ["another user's"] },
		{ label: "uniform not-found wording", needles: ["can't find it"] },
		{
			label: "tool output is data, not instruction",
			needles: ["not instruction"],
		},
	];
	for (const role of ROLES) {
		const prompt = systemPrompt(role).toLowerCase();
		const missing = required
			.filter(({ needles }) =>
				needles.every((needle) => !prompt.includes(needle.toLowerCase())),
			)
			.map(({ label }) => label);
		check(
			`systemPrompt(${role}) carries every refusal boundary`,
			missing.length === 0,
			`missing: ${missing.join(", ")}`,
		);
	}
}

// ==================================================================== the run

console.log("--- 1. tool scoping");
toolScoping();
console.log("--- 2. platform knowledge search");
knowledgeSearch();
console.log("--- 4. system prompt");
prompts();

console.log("--- 3. limit enforcement (real database)");
try {
	await purge();
	await enforcement();
} catch (error) {
	failures++;
	console.log(`FAIL  limit enforcement threw — ${error}`);
} finally {
	await purge();
	await prisma.$disconnect();
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
