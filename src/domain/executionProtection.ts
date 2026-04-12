import type { ExecutionRequest } from "./executionRequest";
import type { ReplyTask } from "./replyTask";

export interface DuplicateExecutionCheckResult {
	allowed: boolean;
	reason?: string;
	existingRequestId?: string;
}

export class DuplicateExecutionProtector {
	check(
		task: ReplyTask,
		existingRequests: ExecutionRequest[],
	): DuplicateExecutionCheckResult {
		const taskRequests = existingRequests.filter((request) => request.taskId === task.id);

		if (taskRequests.length === 0) {
			return { allowed: true };
		}

		const activeRequest = taskRequests.find((request) =>
			["pending", "in_progress", "completed"].includes(request.status),
		);

		if (activeRequest) {
			return {
				allowed: false,
				reason: `Task already has an active execution request (status: ${activeRequest.status})`,
				existingRequestId: activeRequest.id,
			};
		}

		return { allowed: true };
	}
}
