import type { IExecutionRequestRepository } from "../data/executionRequestRepository";
import { ExecutionCooldownChecker } from "../domain/executionCooldown";
import { DuplicateExecutionProtector } from "../domain/executionProtection";
import type { ReplyTask } from "../domain/replyTask";

export interface CheckExecutionProtectionParams {
	task: ReplyTask;
	channelId: string;
}

export interface CheckExecutionProtectionResult {
	allowed: boolean;
	reason?: string;
	violations: string[];
}

export class ExecutionProtectionService {
	constructor(
		private readonly requestRepository: IExecutionRequestRepository,
		private readonly duplicateProtector: DuplicateExecutionProtector = new DuplicateExecutionProtector(),
		private readonly cooldownChecker: ExecutionCooldownChecker = new ExecutionCooldownChecker(),
	) {}

	async checkProtection(
		params: CheckExecutionProtectionParams,
	): Promise<CheckExecutionProtectionResult> {
		const violations: string[] = [];
		const taskRequests = await this.requestRepository.findByTaskId(params.task.id);

		const duplicateCheck = this.duplicateProtector.check(params.task, taskRequests);
		if (!duplicateCheck.allowed && duplicateCheck.reason) {
			violations.push(duplicateCheck.reason);
		}

		const [recentAccountRequests, recentChannelRequests] = await Promise.all([
			this.requestRepository.findRecentByAccountId(
				params.task.accountId,
				this.cooldownChecker.config.minIntervalMs,
			),
			this.requestRepository.findRecentByChannelId(
				params.channelId,
				this.cooldownChecker.config.minIntervalMs,
			),
		]);

		const recentRequests = Array.from(
			new Map(
				[...recentAccountRequests, ...recentChannelRequests].map((request) => [
					request.id,
					request,
				]),
			).values(),
		);

		const cooldownCheck = this.cooldownChecker.check(
			params.task.accountId,
			params.channelId,
			recentRequests,
		);
		if (!cooldownCheck.allowed && cooldownCheck.reason) {
			violations.push(cooldownCheck.reason);
		}

		if (violations.length > 0) {
			return {
				allowed: false,
				reason: violations.join("; "),
				violations,
			};
		}

		return {
			allowed: true,
			violations: [],
		};
	}
}
