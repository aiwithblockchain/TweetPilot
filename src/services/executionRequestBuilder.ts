import type { ICommentInputRepository } from "../data/commentInputRepository";
import { createExecutionRequest } from "../domain/executionRequest";
import type { CandidateReply } from "../domain/candidateReply";
import type { ExecutionChannel } from "../domain/executionChannel";
import type {
	CreateExecutionRequestParams,
	ExecutionRequest,
} from "../domain/executionRequest";
import type { ReplyTask } from "../domain/replyTask";

export interface BuildExecutionRequestParams {
	task: ReplyTask;
	candidateReply: CandidateReply;
	channel: ExecutionChannel;
}

export class ExecutionRequestBuilder {
	constructor(
		private readonly commentInputRepository: ICommentInputRepository,
	) {}

	async build(
		params: BuildExecutionRequestParams,
	): Promise<ExecutionRequest> {
		const { task, candidateReply, channel } = params;

		if (channel.accountId !== task.accountId) {
			throw new Error(
				`Channel accountId mismatch: channel=${channel.accountId}, task=${task.accountId}`,
			);
		}

		if (!channel.capabilities.includes("reply")) {
			throw new Error(
				`Channel ${channel.id} does not support reply capability`,
			);
		}

		const commentInput = await this.commentInputRepository.findById(
			candidateReply.commentInputId,
		);

		if (!commentInput) {
			throw new Error(
				`CommentInput ${candidateReply.commentInputId} not found`,
			);
		}

		if (!commentInput.targetTweetId) {
			throw new Error(
				`CommentInput ${commentInput.id} has no targetTweetId`,
			);
		}

		const requestParams: CreateExecutionRequestParams = {
			taskId: task.id,
			channelId: channel.id,
			channelType: channel.type,
			actionType: "reply",
			payload: {
				commentInputId: commentInput.id,
				candidateReplyId: candidateReply.id,
				targetTweetId: commentInput.targetTweetId,
				replyContent: candidateReply.content,
				accountId: task.accountId,
				workspaceId: task.workspaceId,
				roleId: task.roleId,
			},
		};

		return createExecutionRequest(requestParams);
	}
}
