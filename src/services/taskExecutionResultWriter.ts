import type { IExecutionRequestRepository } from "../data/executionRequestRepository";
import type { IReplyTaskRepository } from "../data/repositories/IReplyTaskRepository";
import { appendReplyTaskEvent } from "../domain/replyTask";

export interface WriteExecutionResultParams {
	taskId: string;
	requestId: string;
	actorId: string;
}

export class TaskExecutionResultWriter {
	constructor(
		private readonly taskRepository: Pick<IReplyTaskRepository, "findById" | "save">,
		private readonly requestRepository: IExecutionRequestRepository,
	) {}

	async writeResult(params: WriteExecutionResultParams): Promise<void> {
		const { taskId, requestId, actorId } = params;
		const task = await this.taskRepository.findById(taskId);
		if (!task) {
			throw new Error(`ReplyTask ${taskId} not found`);
		}

		const request = await this.requestRepository.findById(requestId);
		if (!request) {
			throw new Error(`ExecutionRequest ${requestId} not found`);
		}

		if (request.taskId !== task.id) {
			throw new Error(
				`ExecutionRequest ${requestId} does not belong to task ${taskId}`,
			);
		}

		let updatedTask = task;

		if (request.status === "completed" && request.result?.success) {
			updatedTask = appendReplyTaskEvent(updatedTask, {
				type: "task_completed",
				actorId,
				payload: {
					executionRequestId: request.id,
					tweetId: request.result.tweetId,
					channelType: request.channelType,
				},
			});
		} else {
			return;
		}

		await this.taskRepository.save(updatedTask);
	}
}
