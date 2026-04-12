import type { IExecutionRequestRepository } from "../data/executionRequestRepository";
import type { IReplyTaskRepository } from "../data/repositories/IReplyTaskRepository";
import type { IPlatformState } from "../domain/platformState";
import { ExecutionEligibilityService } from "./executionEligibilityService";
import { ExecutionFailureHandler } from "./executionFailureHandler";
import { ExecutionProtectionService } from "./executionProtectionService";
import {
	TaskExecutionOrchestrator,
	type ExecuteTaskParams,
	type ExecuteTaskResult,
} from "./taskExecutionOrchestrator";

export interface ProtectedExecuteTaskParams extends ExecuteTaskParams {
	actorRoles?: string[];
}

export class ProtectedTaskExecutionOrchestrator {
	constructor(
		private readonly taskRepository: Pick<IReplyTaskRepository, "findById">,
		private readonly requestRepository: IExecutionRequestRepository,
		private readonly platformState: IPlatformState,
		private readonly eligibilityService: ExecutionEligibilityService,
		private readonly baseOrchestrator: TaskExecutionOrchestrator,
		private readonly protectionService: ExecutionProtectionService,
		private readonly failureHandler: ExecutionFailureHandler,
	) {}

	async executeTask(
		params: ProtectedExecuteTaskParams,
	): Promise<ExecuteTaskResult> {
		if (!this.hasExecutionPermission(params.actorRoles)) {
			return {
				success: false,
				error: {
					code: "PERMISSION_DENIED",
					message: "Execution permission denied",
					retryable: false,
				},
			};
		}

		const task = await this.taskRepository.findById(params.taskId);
		if (!task) {
			throw new Error(`ReplyTask ${params.taskId} not found`);
		}

		const availableChannels = this.platformState.getChannels(task.accountId);
		const eligibilityResult = this.eligibilityService.checkEligibility({
			task,
			availableChannels,
		});
		if (!eligibilityResult.eligible || !eligibilityResult.routing) {
			return {
				success: false,
				error: {
					code: eligibilityResult.code ?? "EXECUTION_NOT_READY",
					message:
						eligibilityResult.reason ??
						"Task is not eligible for execution",
					retryable: false,
				},
			};
		}

		const protectionCheck = await this.protectionService.checkProtection({
			task,
			channelId: eligibilityResult.routing.channelId,
		});
		if (!protectionCheck.allowed) {
			return {
				success: false,
				error: {
					code: "PROTECTION_VIOLATION",
					message: protectionCheck.reason ?? "Execution protection failed",
					retryable: false,
				},
			};
		}

		const result = await this.baseOrchestrator.executeTask({
			taskId: params.taskId,
			actorId: params.actorId,
		});

		if (!result.success && result.executionRequestId) {
			const request = await this.requestRepository.findById(result.executionRequestId);
			if (request?.error) {
				await this.failureHandler.handle({
					taskId: params.taskId,
					request,
					error: request.error,
					actorId: params.actorId,
				});
			}
		}

		return result;
	}

	private hasExecutionPermission(actorRoles?: string[]): boolean {
		return (
			actorRoles?.includes("executor") === true ||
			actorRoles?.includes("admin") === true
		);
	}
}
