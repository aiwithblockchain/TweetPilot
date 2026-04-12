import type { IExecutionRequestRepository } from "../data/executionRequestRepository";
import type {
	ExecutionError,
	ExecutionRequest,
	ExecutionResult,
} from "../domain/executionRequest";
import type {
	ITwitterReplyExecutor,
	PostReplyInput,
} from "../domain/twitterReplyExecutor";

export interface ExecuteRequestParams {
	requestId: string;
}

export interface ExecuteRequestResult {
	success: boolean;
	result?: ExecutionResult;
	error?: ExecutionError;
}

function buildResultFromRequest(request: ExecutionRequest): ExecuteRequestResult {
	return {
		success: request.status === "completed" && Boolean(request.result?.success),
		result: request.result,
		error: request.error,
	};
}

export class ExecutionService {
	constructor(
		private readonly repository: IExecutionRequestRepository,
		private readonly replyExecutor: ITwitterReplyExecutor,
	) {}

	async execute(params: ExecuteRequestParams): Promise<ExecuteRequestResult> {
		const request = await this.repository.findById(params.requestId);

		if (!request) {
			throw new Error(`ExecutionRequest ${params.requestId} not found`);
		}

		if (request.status === "completed" || request.status === "failed") {
			return buildResultFromRequest(request);
		}

		if (request.status !== "pending") {
			throw new Error(
				`ExecutionRequest ${params.requestId} is not in pending status (current: ${request.status})`,
			);
		}

		if (request.actionType !== "reply") {
			throw new Error(
				`ExecutionRequest ${params.requestId} has unsupported action type: ${request.actionType}`,
			);
		}

		request.status = "in_progress";
		request.updatedAt = new Date();
		await this.repository.update(request);

		const input: PostReplyInput = {
			tweetId: request.payload.targetTweetId,
			text: request.payload.replyContent,
			accountId: request.payload.accountId,
			workspaceId: request.payload.workspaceId,
			roleId: request.payload.roleId,
		};

		try {
			const executorResult = await this.replyExecutor.postReply(input);
			const now = new Date();
			request.status = executorResult.success ? "completed" : "failed";
			request.updatedAt = now;
			request.executedAt = now;

			if (executorResult.success) {
				request.result = {
					success: true,
					tweetId: executorResult.replyTweetId,
					platformResponse: executorResult.rawResponse,
					executedAt: now,
				};
				request.error = undefined;
			} else {
				request.error = {
					code: executorResult.code,
					message: executorResult.message,
					retryable: executorResult.retryable,
					details: executorResult.rawResponse,
				};
				request.result = undefined;
			}

			await this.repository.update(request);

			return buildResultFromRequest(request);
		} catch (error) {
			const now = new Date();
			request.status = "failed";
			request.updatedAt = now;
			request.executedAt = now;
			request.result = undefined;
			request.error = {
				code: "EXECUTION_EXCEPTION",
				message:
					error instanceof Error ? error.message : "Unknown execution error",
				retryable: false,
				details:
					error instanceof Error ? { name: error.name } : undefined,
			};
			await this.repository.update(request);

			return buildResultFromRequest(request);
		}
	}
}
