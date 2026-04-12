import {
	ChannelRoutingError,
	DefaultChannelRoutingStrategy,
	type ChannelRoutingResult,
	type ChannelRoutingStrategy,
} from "../domain/channelRouting";
import type { ExecutionChannel } from "../domain/executionChannel";
import {
	DefaultExecutionEligibilityChecker,
	type ExecutionEligibilityChecker,
} from "../domain/executionEligibility";
import type { ReplyTask } from "../domain/replyTask";

export interface CheckExecutionEligibilityParams {
	task: ReplyTask;
	availableChannels: ExecutionChannel[];
}

export interface CheckExecutionEligibilityResult {
	eligible: boolean;
	reason?: string;
	code?: string;
	routing?: ChannelRoutingResult;
}

export class ExecutionEligibilityService {
	constructor(
		private readonly eligibilityChecker: ExecutionEligibilityChecker = new DefaultExecutionEligibilityChecker(),
		private readonly routingStrategy: ChannelRoutingStrategy = new DefaultChannelRoutingStrategy(),
	) {}

	checkEligibility(
		params: CheckExecutionEligibilityParams,
	): CheckExecutionEligibilityResult {
		const eligibilityResult = this.eligibilityChecker.check(params.task);

		if (!eligibilityResult.eligible) {
			return {
				eligible: false,
				reason: eligibilityResult.reason,
				code: eligibilityResult.code,
			};
		}

		try {
			const routing = this.routingStrategy.route(
				params.task,
				params.availableChannels,
			);

			return {
				eligible: true,
				routing,
			};
		} catch (error) {
			if (error instanceof ChannelRoutingError) {
				return {
					eligible: false,
					reason: error.message,
					code: error.code,
				};
			}

			return {
				eligible: false,
				reason: error instanceof Error ? error.message : String(error),
				code: "ROUTING_FAILED",
			};
		}
	}
}
