import type { ICandidateReplyRepository } from "../data/repositories/ICandidateReplyRepository";
import type { ExecutionChannel } from "../domain/executionChannel";
import type { ExecutionRequest } from "../domain/executionRequest";
import type { ReplyTask } from "../domain/replyTask";
import { ExecutionEligibilityService } from "./executionEligibilityService";
import { ExecutionRequestBuilder } from "./executionRequestBuilder";

export interface PrepareExecutionParams {
	task: ReplyTask;
	availableChannels: ExecutionChannel[];
}

export interface PrepareExecutionResult {
	ready: boolean;
	request?: ExecutionRequest;
	error?: {
		code: string;
		message: string;
	};
}

export class ExecutionPreparationService {
	constructor(
		private readonly candidateReplyRepository: ICandidateReplyRepository,
		private readonly eligibilityService: ExecutionEligibilityService,
		private readonly requestBuilder: ExecutionRequestBuilder,
	) {}

	async prepare(
		params: PrepareExecutionParams,
	): Promise<PrepareExecutionResult> {
		const eligibilityResult = this.eligibilityService.checkEligibility(params);

		if (!eligibilityResult.eligible) {
			return {
				ready: false,
				error: {
					code: eligibilityResult.code ?? "ELIGIBILITY_CHECK_FAILED",
					message:
						eligibilityResult.reason ??
						"Task is not eligible for execution",
				},
			};
		}

		const candidateReply = await this.candidateReplyRepository.findById(
			params.task.candidateReplyId,
		);
		if (!candidateReply) {
			return {
				ready: false,
				error: {
					code: "CANDIDATE_REPLY_NOT_FOUND",
					message: `CandidateReply ${params.task.candidateReplyId} not found`,
				},
			};
		}

		const selectedChannel = params.availableChannels.find(
			(channel) => channel.id === eligibilityResult.routing?.channelId,
		);
		if (!selectedChannel) {
			return {
				ready: false,
				error: {
					code: "CHANNEL_NOT_FOUND",
					message: `ExecutionChannel ${eligibilityResult.routing?.channelId} not found`,
				},
			};
		}

		try {
			const request = await this.requestBuilder.build({
				task: params.task,
				candidateReply,
				channel: selectedChannel,
			});

			return {
				ready: true,
				request,
			};
		} catch (error) {
			return {
				ready: false,
				error: {
					code: "REQUEST_BUILD_FAILED",
					message: error instanceof Error ? error.message : String(error),
				},
			};
		}
	}
}
