import type { IReplyTaskRepository } from "../data/repositories/IReplyTaskRepository";
import type { ExecutionError, ExecutionRequest } from "../domain/executionRequest";
import {
	appendReplyTaskEvent,
	markReplyTaskStatus,
	type ReplyTask,
	type ReplyTaskStatus,
} from "../domain/replyTask";

export interface HandleExecutionFailureParams {
	taskId: string;
	request: ExecutionRequest;
	error: ExecutionError;
	actorId: string;
}

export interface HandleExecutionFailureResult {
	taskUpdated: boolean;
	requiresManualIntervention: boolean;
	retryable: boolean;
}

function hasFailureEventForRequest(task: ReplyTask, requestId: string): boolean {
	return task.events.some(
		(event) =>
			event.type === "task_failed" &&
			event.payload?.executionRequestId === requestId,
	);
}

function resolveTargetStatus(error: ExecutionError): ReplyTaskStatus {
	if (
		["NOT_LOGGED_IN", "RATE_LIMITED", "CONTENT_VIOLATION", "ACCOUNT_SUSPENDED", "PERMISSION_DENIED"].includes(
			error.code,
		)
	) {
		return "in_takeover";
	}

	return error.retryable ? "ready_for_execution" : "rejected";
}

export class ExecutionFailureHandler {
	constructor(
		private readonly taskRepository: Pick<IReplyTaskRepository, "findById" | "save">,
	) {}

	async handle(
		params: HandleExecutionFailureParams,
	): Promise<HandleExecutionFailureResult> {
		const task = await this.taskRepository.findById(params.taskId);
		if (!task) {
			throw new Error(`ReplyTask ${params.taskId} not found`);
		}

		const targetStatus = resolveTargetStatus(params.error);
		const requiresManualIntervention = targetStatus === "in_takeover";

		let updatedTask = task;
		let changed = false;

		if (updatedTask.status !== targetStatus) {
			updatedTask = markReplyTaskStatus(updatedTask, targetStatus);
			changed = true;
		}

		if (!hasFailureEventForRequest(updatedTask, params.request.id)) {
			updatedTask = appendReplyTaskEvent(updatedTask, {
				type: "task_failed",
				actorId: params.actorId,
				payload: {
					executionRequestId: params.request.id,
					errorCode: params.error.code,
					errorMessage: params.error.message,
					retryable: params.error.retryable,
					requiresManualIntervention,
				},
			});
			changed = true;
		}

		if (changed) {
			await this.taskRepository.save(updatedTask);
		}

		return {
			taskUpdated: changed,
			requiresManualIntervention,
			retryable: params.error.retryable,
		};
	}
}
