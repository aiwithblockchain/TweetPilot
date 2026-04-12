import type { IExecutionRequestRepository } from "../data/executionRequestRepository";
import type { ICandidateReplyRepository } from "../data/repositories/ICandidateReplyRepository";
import type { IReplyTaskRepository } from "../data/repositories/IReplyTaskRepository";
import type { IPlatformState } from "../domain/platformState";
import { ExecutionRequestBuilder } from "./executionRequestBuilder";
import { ExecutionService } from "./executionService";
import { TaskExecutionResultWriter } from "./taskExecutionResultWriter";

export interface ExecuteTaskParams {
	taskId: string;
	channelId: string;
	actorId: string;
}

export interface ExecuteTaskResult {
	success: boolean;
	executionRequestId: string;
	tweetId?: string;
	error?: {
		code: string;
		message: string;
		retryable: boolean;
	};
}

export class TaskExecutionOrchestrator {
	constructor(
		private readonly taskRepository: Pick<IReplyTaskRepository, "findById">,
		private readonly candidateReplyRepository: Pick<ICandidateReplyRepository, "findById">,
		private readonly requestRepository: IExecutionRequestRepository,
		private readonly requestBuilder: ExecutionRequestBuilder,
		private readonly executionService: ExecutionService,
		private readonly resultWriter: TaskExecutionResultWriter,
		private readonly platformState: IPlatformState,
	) {}

	async executeTask(params: ExecuteTaskParams): Promise<ExecuteTaskResult> {
		const { taskId, channelId, actorId } = params;
		const task = await this.taskRepository.findById(taskId);
		if (!task) {
			throw new Error(`ReplyTask ${taskId} not found`);
		}

		const candidateReply = await this.candidateReplyRepository.findById(
			task.candidateReplyId,
		);
		if (!candidateReply) {
			throw new Error(`CandidateReply ${task.candidateReplyId} not found`);
		}

		const channel = this.platformState.getChannel(channelId);
		if (!channel) {
			throw new Error(`ExecutionChannel ${channelId} not found`);
		}

		if (channel.accountId !== task.accountId) {
			throw new Error(
				`Channel ${channelId} does not belong to account ${task.accountId}`,
			);
		}

		const executionRequest = await this.requestBuilder.build({
			task,
			candidateReply,
			channel,
		});
		await this.requestRepository.save(executionRequest);

		const executeResult = await this.executionService.execute({
			requestId: executionRequest.id,
		});

		await this.resultWriter.writeResult({
			taskId: task.id,
			requestId: executionRequest.id,
			actorId,
		});

		return {
			success: executeResult.success,
			executionRequestId: executionRequest.id,
			tweetId: executeResult.result?.tweetId,
			error: executeResult.error
				? {
						code: executeResult.error.code,
						message: executeResult.error.message,
						retryable: executeResult.error.retryable,
					}
				: undefined,
		};
	}
}
