import type { ExecutionRequest } from "./executionRequest";

export interface CooldownCheckResult {
	allowed: boolean;
	reason?: string;
	cooldownUntil?: Date;
}

export interface CooldownConfig {
	minIntervalMs: number;
}

function sortByNewest(requests: ExecutionRequest[]): ExecutionRequest[] {
	return [...requests].sort(
		(left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
	);
}

export class ExecutionCooldownChecker {
	readonly config: CooldownConfig;

	constructor(config: CooldownConfig = { minIntervalMs: 5000 }) {
		this.config = config;
	}

	check(
		accountId: string,
		channelId: string,
		recentRequests: ExecutionRequest[],
	): CooldownCheckResult {
		const relevantRequests = sortByNewest(
			recentRequests.filter(
				(request) =>
					request.payload.accountId === accountId ||
					request.channelId === channelId,
			),
		);

		if (relevantRequests.length === 0) {
			return { allowed: true };
		}

		const lastRequest = relevantRequests[0];
		const elapsedMs = Date.now() - lastRequest.createdAt.getTime();

		if (elapsedMs < this.config.minIntervalMs) {
			return {
				allowed: false,
				reason: `Account ${accountId} or channel ${channelId} is in cooldown period (${this.config.minIntervalMs}ms)`,
				cooldownUntil: new Date(
					lastRequest.createdAt.getTime() + this.config.minIntervalMs,
				),
			};
		}

		return { allowed: true };
	}
}
