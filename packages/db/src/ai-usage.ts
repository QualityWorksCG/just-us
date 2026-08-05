import prisma from "./index";

/**
 * The model-spend ledger.
 *
 * Append-only: rows are written once per generation and never updated, which is
 * what lets a budget be a sum rather than a counter someone has to keep right.
 * Costs are integer millionths of a dollar (microUSD) — per-token prices are far
 * below a cent, and summing floats to compare against a cap drifts.
 */

export type AiUsageEntry = {
	userId: string;
	/** Role the request was made under, so spend reads per audience. */
	role: string;
	model: string;
	chatId?: string;
	feature?: string;
	provider?: string;
	finishReason?: string;
	inputTokens?: number;
	outputTokens?: number;
	cacheReadTokens?: number;
	reasoningTokens?: number;
	costMicroUsd?: number;
	/** The provider's own id for the generation, for reconciling their billing. */
	generationId?: string;
	steps?: number;
	toolNames?: string[];
	latencyMs?: number;
	ttftMs?: number;
};

/** Record one generation. Never on the request's critical path — a failed write
 *  must not fail the answer the user already received. */
export async function recordAiUsage(entry: AiUsageEntry) {
	return prisma.aiUsage.create({ data: entry });
}

/** What one user has spent since the start of the month, in microUSD. */
export async function monthlyUserSpendMicroUsd(
	userId: string,
	monthStart: Date,
): Promise<number> {
	const agg = await prisma.aiUsage.aggregate({
		where: { userId, createdAt: { gte: monthStart } },
		_sum: { costMicroUsd: true },
	});
	return agg._sum.costMicroUsd ?? 0;
}

/** What the platform has spent since the start of the month, in microUSD. */
export async function monthlyGlobalSpendMicroUsd(
	monthStart: Date,
): Promise<number> {
	const agg = await prisma.aiUsage.aggregate({
		where: { createdAt: { gte: monthStart } },
		_sum: { costMicroUsd: true },
	});
	return agg._sum.costMicroUsd ?? 0;
}
