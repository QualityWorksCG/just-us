import { checkLimits, type LimitVerdict } from "@just-us/ai/enforcement";
import { STATIC_HELP_TEXT } from "@just-us/ai/knowledge";
import {
	MAX_TOOL_STEPS,
	MAX_TURN_OUTPUT_TOKENS,
	PRICE_MAP,
} from "@just-us/ai/limits";
import { systemPrompt } from "@just-us/ai/prompts";
import { chatModel, chatModelId, isAiConfigured } from "@just-us/ai/provider";
import { buildTools, toolNamesForRole } from "@just-us/ai/tools";
import type { Role } from "@just-us/auth";
import { type AiUsageEntry, recordAiUsage } from "@just-us/db/ai-usage";
import {
	type ChatMessageInput,
	getOrCreateActiveChat,
	getOwnedChat,
	listChatMessages,
	saveChatMessages,
	setChatTitle,
} from "@just-us/db/chat";
import {
	convertToModelMessages,
	createIdGenerator,
	createUIMessageStream,
	createUIMessageStreamResponse,
	isStepCount,
	type LanguageModelUsage,
	type ProviderMetadata,
	streamText,
	type ToolSet,
	toUIMessageStream,
	type UIMessage,
	validateUIMessages,
} from "ai";
import {
	type AIMetadata,
	createAILogger,
	createEvlogIntegration,
} from "evlog/ai";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
// Aliased: evlog's `useLogger` reads async context, so calling it after an early
// return is fine — the name is all that makes it look like a React hook.
import { useLogger as requestLogger, withEvlog } from "@/lib/evlog";
import { isEnabled } from "@/lib/flags-server";

/**
 * The assistant's transport: `GET` rehydrates a thread, `POST` takes one new user
 * message and streams the answer back.
 *
 * Three things here are load-bearing rather than incidental.
 *
 * The client sends only its newest message. History is read from the database on
 * every turn, so a caller cannot rewrite what was said earlier, forge an
 * assistant turn that the model then treats as its own, or graft another
 * thread's context onto this one. `chatId` is checked through `getOwnedChat`,
 * which returns null for both a missing thread and someone else's — so a guessed
 * id gets the same 404 either way and reveals nothing.
 *
 * The user's message is persisted before generation starts. A turn that is
 * stopped, refused, or lost to a disconnect therefore still leaves a thread that
 * reads the way the user experienced it.
 *
 * Running out of budget is not an error. Over a spend ceiling — or with no model
 * configured at all — the endpoint still answers 200 with a normal-looking
 * assistant turn carrying the static help text, so the panel degrades into a
 * pointer to the documentation rather than a failure the user has to interpret.
 */

/** How many stored turns are replayed to the model. */
const HISTORY_LIMIT = 30;

/** Ids are ours, not the client's — a caller-supplied id could overwrite a turn. */
const nextMessageId = createIdGenerator({ prefix: "msg", size: 16 });

const GENERIC_ERROR = "Something went wrong.";

type Gate =
	| { ok: true; userId: string; role: Role }
	| { ok: false; response: NextResponse };

/**
 * Session, flag, and onboarding in that order.
 *
 * The flag check sits above onboarding on purpose: with the assistant switched
 * off the endpoint must look like it was never built, which means a 404 before
 * any answer that implies otherwise.
 */
async function gate(): Promise<Gate> {
	const session = await getSession();
	if (!session?.user) {
		return {
			ok: false,
			response: NextResponse.json(
				{ error: "Sign in to use the assistant." },
				{ status: 401 },
			),
		};
	}

	if (!(await isEnabled("aiAssistant"))) {
		return {
			ok: false,
			response: NextResponse.json({ error: "Not found." }, { status: 404 }),
		};
	}

	const user = session.user as {
		role?: Role;
		onboarded?: boolean;
		emailVerified?: boolean;
	};
	if (!user.emailVerified || !user.onboarded) {
		return {
			ok: false,
			response: NextResponse.json(
				{ error: "Finish setting up your account to use the assistant." },
				{ status: 403 },
			),
		};
	}

	return {
		ok: true,
		userId: session.user.id,
		role: (user.role ?? "donor") as Role,
	};
}

/** Stored rows and `UIMessage` line up field for field; the cast is the only seam. */
function toStored(message: UIMessage): ChatMessageInput {
	return {
		id: message.id,
		role: message.role,
		parts: message.parts as unknown as ChatMessageInput["parts"],
	};
}

/**
 * Per-1M-token prices for a model id, falling back to the dearest rates we know.
 *
 * An unpriced model must not read as free: it would spend past the monthly
 * ceiling unnoticed, because the ceiling is a sum of these estimates.
 */
function priceFor(modelId: string): { input: number; output: number } {
	const known = PRICE_MAP[modelId] ?? PRICE_MAP[`openai/${modelId}`];
	if (known) return known;
	return Object.values(PRICE_MAP).reduce(
		(worst, price) => ({
			input: Math.max(worst.input, price.input),
			output: Math.max(worst.output, price.output),
		}),
		{ input: 0, output: 0 },
	);
}

/**
 * Integer micro-USD for a turn.
 *
 * `PRICE_MAP` is dollars per 1M tokens, so `tokens × price` already lands in
 * millionths of a dollar. Cached input tokens are billed at the full input rate
 * and the result is rounded up — the number gates spending, so it should err
 * high. Where evlog's own estimate is higher still, that one wins.
 */
function costMicroUsd(
	usage: { inputTokens: number; outputTokens: number },
	evlogEstimateDollars: number | undefined,
): number {
	const price = priceFor(chatModelId());
	const own = Math.ceil(
		usage.inputTokens * price.input + usage.outputTokens * price.output,
	);
	const fromEvlog = evlogEstimateDollars
		? Math.ceil(evlogEstimateDollars * 1_000_000)
		: 0;
	return Math.max(own, fromEvlog);
}

/** Tool names from evlog's accumulator, which records them with or without inputs. */
function toolNamesFrom(calls: AIMetadata["toolCalls"]): string[] {
	if (!calls) return [];
	return [
		...new Set(
			calls.map((call) => (typeof call === "string" ? call : call.name)),
		),
	];
}

/**
 * The gateway's own id for a generation, when it sent one. Read defensively:
 * this is passthrough provider metadata, not a shape the SDK guarantees.
 */
function gatewayGenerationId(
	metadata: ProviderMetadata | undefined,
): string | undefined {
	const gateway = metadata?.gateway as
		| { generationId?: unknown; id?: unknown }
		| undefined;
	for (const candidate of [gateway?.generationId, gateway?.id]) {
		if (typeof candidate === "string" && candidate.length > 0) return candidate;
	}
	return undefined;
}

function roundMs(value: number | undefined): number | undefined {
	return typeof value === "number" ? Math.round(value) : undefined;
}

/** The ledger is never on the critical path — a failed write must not fail a delivered answer. */
async function record(entry: AiUsageEntry): Promise<void> {
	try {
		await recordAiUsage(entry);
	} catch {}
}

/** How long a thread's derived title may run before it is cut. */
const TITLE_MAX = 48;

/**
 * A thread's name, taken from the question that opened it.
 *
 * Only text parts, whitespace collapsed, because this ends up on one line in a
 * list. Returns "" for a message with nothing readable in it — a file-only or
 * tool-only opener names nothing rather than naming a thread badly.
 */
function titleFrom(message: UIMessage): string {
	const text = message.parts
		.map((part) =>
			part.type === "text" ? ((part as { text?: string }).text ?? "") : "",
		)
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();
	if (!text) return "";
	if (text.length <= TITLE_MAX) return text;
	return `${text.slice(0, TITLE_MAX - 1).trimEnd()}…`;
}

/** Naming a thread is a convenience for the history list, never a reason for the
 *  turn the user is waiting on to fail. */
async function nameThread(chatId: string, message: UIMessage): Promise<void> {
	const title = titleFrom(message);
	if (!title) return;
	try {
		await setChatTitle(chatId, title);
	} catch {}
}

/**
 * A thread and its turns. Without `chatId` this is the active thread, created if
 * the user has none; with one it is that thread, through the same ownership gate
 * `POST` uses — so a guessed or borrowed id 404s exactly like a deleted one.
 */
export const GET = withEvlog(
	async (request: Request): Promise<NextResponse> => {
		const gated = await gate();
		if (!gated.ok) return gated.response;

		const log = requestLogger();
		log.set({ user: { id: gated.userId, role: gated.role } });

		try {
			const asked = new URL(request.url).searchParams.get("chatId");
			const chat = asked
				? await getOwnedChat(asked, gated.userId)
				: await getOrCreateActiveChat(gated.userId, gated.role);
			if (!chat) {
				return NextResponse.json({ error: "Not found." }, { status: 404 });
			}
			log.set({ chat: { id: chat.id } });
			const messages = await listChatMessages(chat.id);
			return NextResponse.json({ chatId: chat.id, messages });
		} catch (error) {
			log.error(error instanceof Error ? error : new Error(String(error)));
			return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
		}
	},
);

/** The sentence that goes in front of the static help text, per reason. */
const DEGRADED_PREFACE = {
	"user-ceiling":
		"You've used up your assistant allowance for this month — it resets when the new month starts.",
	"global-ceiling":
		"The assistant has reached the platform's monthly budget, so it's paused for everyone until next month.",
	unconfigured: "The assistant isn't connected to a model in this environment.",
} as const;

type DegradedReason = keyof typeof DEGRADED_PREFACE;

export const POST = withEvlog(async (request: Request): Promise<Response> => {
	const gated = await gate();
	if (!gated.ok) return gated.response;
	const { userId, role } = gated;

	const log = requestLogger();
	log.set({ user: { id: userId, role } });

	try {
		const body = (await request.json()) as {
			chatId?: unknown;
			message?: unknown;
		};
		const chatId = typeof body.chatId === "string" ? body.chatId : "";
		const incoming = body.message as { role?: unknown } | null | undefined;
		if (
			!chatId ||
			!incoming ||
			typeof incoming !== "object" ||
			incoming.role !== "user"
		) {
			return NextResponse.json(
				{ error: "That message couldn't be read." },
				{ status: 400 },
			);
		}
		log.set({ chat: { id: chatId } });

		// Ownership before anything else, and null for both "gone" and "not yours".
		const chat = await getOwnedChat(chatId, userId);
		if (!chat) {
			return NextResponse.json({ error: "Not found." }, { status: 404 });
		}

		const verdict: LimitVerdict = await checkLimits(userId, role);
		if (!verdict.ok && verdict.kind === "rate") {
			log.set({ assistant: { refused: verdict.kind } });
			return NextResponse.json({ error: verdict.message }, { status: 429 });
		}

		const tools: ToolSet = buildTools({ userId, role });

		// Server-held history plus the one new message, validated as a unit.
		const stored = await listChatMessages(chatId);
		const validated = await validateUIMessages({
			messages: [...stored.slice(-HISTORY_LIMIT), body.message],
			// Same object, keyed by UI tool type rather than by tool definition.
			tools: tools as Parameters<typeof validateUIMessages>[0]["tools"],
		});
		const userMessage = validated.at(-1);
		if (!userMessage) {
			return NextResponse.json(
				{ error: "That message couldn't be read." },
				{ status: 400 },
			);
		}

		// Persisted now, so a stopped or degraded turn still leaves the question behind.
		await saveChatMessages(chatId, [toStored(userMessage)]);

		// An unnamed thread takes its name from the question that opened it, so the
		// history list reads as what was asked rather than as a row of timestamps.
		if (!chat.title) await nameThread(chatId, userMessage);

		const degraded: DegradedReason | null = !verdict.ok
			? verdict.kind === "user-ceiling"
				? "user-ceiling"
				: "global-ceiling"
			: isAiConfigured()
				? null
				: "unconfigured";

		if (degraded) {
			return degradedTurn({ chatId, userId, role, reason: degraded });
		}

		return liveTurn({
			chatId,
			userId,
			role,
			tools,
			validated,
			signal: request.signal,
		});
	} catch (error) {
		log.error(error instanceof Error ? error : new Error(String(error)));
		return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
	}
});

/**
 * A turn the model never sees: the static help text, persisted and streamed as a
 * normal assistant message so the panel renders it like any other answer, plus a
 * zero-cost ledger row that records why.
 */
async function degradedTurn({
	chatId,
	userId,
	role,
	reason,
}: {
	chatId: string;
	userId: string;
	role: Role;
	reason: DegradedReason;
}): Promise<Response> {
	const messageId = nextMessageId();
	const text = `${DEGRADED_PREFACE[reason]}\n\n${STATIC_HELP_TEXT}`;
	const finishReason = `degraded:${reason}`;

	requestLogger().set({ assistant: { degraded: reason } });

	await saveChatMessages(chatId, [
		{
			id: messageId,
			role: "assistant",
			parts: [{ type: "text", text, state: "done" }],
		},
	]);

	void record({
		userId,
		role,
		chatId,
		model: chatModelId(),
		finishReason,
		steps: 0,
		costMicroUsd: 0,
	});

	const stream = createUIMessageStream({
		execute: ({ writer }) => {
			writer.write({ type: "start", messageId });
			writer.write({ type: "text-start", id: "0" });
			writer.write({ type: "text-delta", id: "0", delta: text });
			writer.write({ type: "text-end", id: "0" });
			writer.write({ type: "finish" });
		},
	});

	return createUIMessageStreamResponse({ stream });
}

/**
 * The real turn.
 *
 * Two callbacks write the ledger and neither is the same event: `streamText`'s
 * `onEnd` carries usage aggregated across every step but no messages, while the
 * UI stream's `onEnd` carries the finished messages but no usage. Persistence
 * belongs to the second, accounting to the first.
 *
 * `consumeStream()` is deliberately not awaited, and `consumeSseStream` drains a
 * tee of the wire copy: together they keep generation and both callbacks running
 * when the browser walks away mid-answer, so a disconnect still gets billed and
 * still leaves the partial reply on the thread.
 */
async function liveTurn({
	chatId,
	userId,
	role,
	tools,
	validated,
	signal,
}: {
	chatId: string;
	userId: string;
	role: Role;
	tools: ToolSet;
	validated: UIMessage[];
	signal: AbortSignal;
}): Promise<Response> {
	const log = requestLogger();
	const ai = createAILogger(log, { cost: PRICE_MAP });
	const startedAt = Date.now();

	const base = { userId, role, chatId, model: chatModelId() };

	const result = streamText({
		model: ai.wrap(chatModel()),
		instructions: systemPrompt(role),
		messages: await convertToModelMessages(validated),
		tools,
		activeTools: toolNamesForRole(role),
		stopWhen: isStepCount(MAX_TOOL_STEPS),
		maxOutputTokens: MAX_TURN_OUTPUT_TOKENS,
		abortSignal: signal,
		telemetry: { integrations: [createEvlogIntegration(ai)] },
		onEnd: ({ usage, finishReason, steps, finalStep }) => {
			const metadata = ai.getMetadata();
			const tokens = normalizeUsage(usage);
			void record({
				...base,
				provider: metadata.provider,
				finishReason,
				...tokens,
				costMicroUsd: costMicroUsd(tokens, metadata.estimatedCost),
				generationId:
					gatewayGenerationId(finalStep.providerMetadata) ??
					finalStep.response.id,
				steps: steps.length,
				toolNames: toolNamesFrom(metadata.toolCalls),
				latencyMs: roundMs(metadata.totalDurationMs) ?? Date.now() - startedAt,
				ttftMs:
					roundMs(metadata.msToFirstChunk) ??
					roundMs(finalStep.performance.timeToFirstOutputMs),
			});
		},
		onAbort: () => {
			// Whatever was generated before the client left still cost money.
			const metadata = ai.getMetadata();
			const tokens = {
				inputTokens: metadata.inputTokens,
				outputTokens: metadata.outputTokens,
				cacheReadTokens: metadata.cacheReadTokens ?? 0,
				reasoningTokens: metadata.reasoningTokens ?? 0,
			};
			void record({
				...base,
				provider: metadata.provider,
				finishReason: "abort",
				...tokens,
				costMicroUsd: costMicroUsd(tokens, metadata.estimatedCost),
				generationId: metadata.responseId,
				steps: metadata.steps,
				toolNames: toolNamesFrom(metadata.toolCalls),
				latencyMs: roundMs(metadata.totalDurationMs) ?? Date.now() - startedAt,
				ttftMs: roundMs(metadata.msToFirstChunk),
			});
		},
	});

	void result.consumeStream({ onError: () => {} });

	const stream = toUIMessageStream({
		stream: result.stream,
		originalMessages: validated,
		generateMessageId: nextMessageId,
		onEnd: async ({ messages, responseMessage }) => {
			// Only what this turn added: everything after the last user message.
			const lastUser = messages.findLastIndex(
				(message) => message.role === "user",
			);
			const fresh = lastUser >= 0 ? messages.slice(lastUser + 1) : [];
			// A turn that failed before its first token arrives here as a message
			// with no parts. Persisting it would leave a row that renders as
			// nothing and is dropped again on the way back to the model, so the
			// question is left standing on its own instead.
			const toSave = (fresh.length > 0 ? fresh : [responseMessage]).filter(
				(message) => message.parts.length > 0,
			);
			try {
				await saveChatMessages(chatId, toSave.map(toStored));
			} catch (error) {
				// The answer already reached the user; losing it from history is worth
				// an event, not a broken stream.
				log.error(error instanceof Error ? error : new Error(String(error)));
			}
		},
		onError: (error) => {
			log.error(error instanceof Error ? error : new Error(String(error)));
			return "Something went wrong answering that. Please try again.";
		},
	});

	return createUIMessageStreamResponse({
		stream,
		consumeSseStream: ({ stream: sse }) => {
			void sse.pipeTo(new WritableStream()).catch(() => {});
		},
	});
}

/** Ledger columns are non-null integers; the SDK reports every token count as optional. */
function normalizeUsage(usage: LanguageModelUsage) {
	return {
		inputTokens: usage.inputTokens ?? 0,
		outputTokens: usage.outputTokens ?? 0,
		cacheReadTokens: usage.inputTokenDetails.cacheReadTokens ?? 0,
		reasoningTokens: usage.outputTokenDetails.reasoningTokens ?? 0,
	};
}
