import type { IExecutionRequestRepository } from "../data/executionRequestRepository";
import type { IReplyTaskRepository } from "../data/repositories/IReplyTaskRepository";
import type { IPlatformState } from "../domain/platformState";
import { ExecutionService } from "./executionService";
import { ExecutionPreparationService } from "./executionPreparationService";
import { TaskExecutionResultWriter } from "./taskExecutionResultWriter";

export interface ExecuteTaskParams {
	taskId: string;
	actorId: string;
}

export interface ExecuteTaskResult {
	success: boolean;
	executionRequestId?: string;
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
		private readonly requestRepository: IExecutionRequestRepository,
		private readonly preparationService: ExecutionPreparationService,
		private readonly executionService: ExecutionService,
		private readonly resultWriter: TaskExecutionResultWriter,
		private readonly platformState: IPlatformState,
	) {}

	async executeTask(params: ExecuteTaskParams): Promise<ExecuteTaskResult> {
		const { taskId, actorId } = params;
		const task = await this.taskRepository.findById(taskId);
		if (!task) {
			throw new Error(`ReplyTask ${taskId} not found`);
		}

		const preparationResult = await this.preparationService.prepare({
			task,
			availableChannels: this.platformState.getChannels(task.accountId),
		});

		if (!preparationResult.ready || !preparationResult.request) {
			return {
				success: false,
				error: {
					code: preparationResult.error?.code ?? "EXECUTION_NOT_READY",
					message:
						preparationResult.error?.message ??
						"Task is not ready for execution",
					retryable: false,
				},
			};
		}

		const executionRequest = preparationResult.request;
		await this.requestRepository.save(executionRequest);

		const executeResult = await this.executionService.execute({
			requestId: executionRequest.id,
		});

		if (executeResult.success) {
			await this.resultWriter.writeResult({
				taskId: task.id,
				requestId: executionRequest.id,
				actorId,
			});
		}

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
