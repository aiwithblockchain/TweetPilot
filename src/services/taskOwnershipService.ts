import type { IReplyTaskRepository } from "../data/repositories/IReplyTaskRepository";
import {
	appendReplyTaskEvent,
	markReplyTaskStatus,
	type ReplyTask,
	type ReplyTaskStatus,
} from "../domain/replyTask";
import {
	ReplyTaskDomainError,
	ReplyTaskDomainErrorCode,
} from "../domain/errors";
import type {
	TaskOwnershipActorRole,
	TaskTakeoverCompletionResult,
} from "../domain/taskOwnership";

export enum TaskOwnershipErrorCode {
	TASK_ASSIGNMENT_PERMISSION_DENIED = "TASK_ASSIGNMENT_PERMISSION_DENIED",
	TASK_TAKEOVER_PERMISSION_DENIED = "TASK_TAKEOVER_PERMISSION_DENIED",
	TASK_TAKEOVER_CONFLICT = "TASK_TAKEOVER_CONFLICT",
	TASK_TAKEOVER_RESULT_INVALID = "TASK_TAKEOVER_RESULT_INVALID",
}

export class TaskOwnershipError extends Error {
	public readonly code: TaskOwnershipErrorCode;
	public readonly cause?: unknown;

	constructor(
		code: TaskOwnershipErrorCode,
		message: string,
		cause?: unknown,
	) {
		super(message);
		this.name = "TaskOwnershipError";
		this.code = code;
		this.cause = cause;
	}
}

export interface TaskOwnershipService {
	assignTask(
		taskId: string,
		assigneeId: string,
		actorId: string,
		options?: { force?: boolean; actorRoles?: TaskOwnershipActorRole[] },
	): Promise<ReplyTask>;
	takeOverTask(
		taskId: string,
		actorId: string,
		note?: string,
		options?: {
			checkPermission?: boolean;
			expectedVersion?: number;
			actorRoles?: TaskOwnershipActorRole[];
		},
	): Promise<ReplyTask>;
	completeTakeover(
		taskId: string,
		actorId: string,
		result: TaskTakeoverCompletionResult,
		note?: string,
		options?: { actorRoles?: TaskOwnershipActorRole[] },
	): Promise<ReplyTask>;
}

interface TaskOwnershipServiceDependencies {
	replyTaskRepository: Pick<IReplyTaskRepository, "findById" | "save" | "findEvents">;
}

const ADMIN_ROLE = "admin";
const TAKEOVER_COMPLETION_RESULTS = new Set<TaskTakeoverCompletionResult>([
	"ready_for_execution",
	"rejected",
	"completed",
]);
const ASSIGNABLE_STATUSES: ReplyTaskStatus[] = [
	"pending_review",
	"ready_for_execution",
	"assigned",
];
const TAKEOVER_START_STATUSES: ReplyTaskStatus[] = [
	"pending_review",
	"ready_for_execution",
	"assigned",
];

function isAdmin(actorRoles?: TaskOwnershipActorRole[]): boolean {
	return actorRoles?.includes(ADMIN_ROLE) ?? false;
}

function isAssignmentAuthorized(
	task: ReplyTask,
	actorId: string,
	targetAssigneeId: string,
	options?: { actorRoles?: TaskOwnershipActorRole[] },
): boolean {
	if (isAdmin(options?.actorRoles)) {
		return true;
	}

	if (!task.assigneeId && !task.takenOverBy) {
		return actorId === targetAssigneeId;
	}

	return task.assigneeId === actorId || task.takenOverBy === actorId;
}

function isTakeoverAuthorized(
	task: ReplyTask,
	actorId: string,
	options?: { actorRoles?: TaskOwnershipActorRole[] },
): boolean {
	if (isAdmin(options?.actorRoles)) {
		return true;
	}

	return task.assigneeId === actorId || task.takenOverBy === actorId;
}

function ensureTaskExists(task: ReplyTask | null, taskId: string): ReplyTask {
	if (task) {
		return task;
	}

	throw new ReplyTaskDomainError(
		ReplyTaskDomainErrorCode.TASK_NOT_FOUND,
		`Reply task "${taskId}" was not found.`,
	);
}

function ensureAssignable(task: ReplyTask): void {
	if (ASSIGNABLE_STATUSES.includes(task.status)) {
		return;
	}

	throw new ReplyTaskDomainError(
		ReplyTaskDomainErrorCode.INVALID_TASK_STATUS_TRANSITION,
		`Reply task "${task.id}" in status "${task.status}" cannot be assigned.`,
	);
}

function ensureTakeoverStartAllowed(task: ReplyTask): void {
	if (TAKEOVER_START_STATUSES.includes(task.status)) {
		return;
	}

	throw new ReplyTaskDomainError(
		ReplyTaskDomainErrorCode.INVALID_TASK_STATUS_TRANSITION,
		`Reply task "${task.id}" in status "${task.status}" cannot enter takeover.`,
	);
}

async function persistTask(
	repository: Pick<IReplyTaskRepository, "save" | "findById">,
	task: ReplyTask,
	conflictMessage: string,
): Promise<ReplyTask> {
	try {
		await repository.save(task);
		return (await repository.findById(task.id)) ?? task;
	} catch (error) {
		if (
			error instanceof ReplyTaskDomainError &&
			error.code === ReplyTaskDomainErrorCode.OPTIMISTIC_LOCK_FAILED
		) {
			throw new TaskOwnershipError(
				TaskOwnershipErrorCode.TASK_TAKEOVER_CONFLICT,
				conflictMessage,
				error,
			);
		}

		throw error;
	}
}

export function createTaskOwnershipService(
	dependencies: TaskOwnershipServiceDependencies,
): TaskOwnershipService {
	return {
		async assignTask(
			taskId,
			assigneeId,
			actorId,
			options,
		): Promise<ReplyTask> {
			const task = ensureTaskExists(
				await dependencies.replyTaskRepository.findById(taskId),
				taskId,
			);

			ensureAssignable(task);

			if (!isAssignmentAuthorized(task, actorId, assigneeId, options)) {
				throw new TaskOwnershipError(
					TaskOwnershipErrorCode.TASK_ASSIGNMENT_PERMISSION_DENIED,
					`Actor "${actorId}" is not allowed to assign task "${taskId}" to "${assigneeId}".`,
				);
			}

			if (
				task.assigneeId &&
				task.assigneeId !== assigneeId &&
				!options?.force &&
				!isAdmin(options?.actorRoles)
			) {
				throw new TaskOwnershipError(
					TaskOwnershipErrorCode.TASK_ASSIGNMENT_PERMISSION_DENIED,
					`Task "${taskId}" is already assigned to "${task.assigneeId}". Re-assignment requires force.`,
				);
			}

			if (task.status === "assigned" && task.assigneeId === assigneeId) {
				return task;
			}

			const baseTask =
				task.status === "ready_for_execution"
					? markReplyTaskStatus(task, "assigned")
					: task;
			const assignedTask = appendReplyTaskEvent(
				{
					...baseTask,
					assigneeId,
					updatedAt: new Date(),
				},
				{
					type: "task_assigned",
					actorId,
					payload: {
						assigneeId,
						previousAssigneeId: task.assigneeId,
						force: options?.force ?? false,
					},
				},
			);

			return persistTask(
				dependencies.replyTaskRepository,
				assignedTask,
				`Failed to assign task "${taskId}" due to a concurrent update.`,
			);
		},

		async takeOverTask(
			taskId,
			actorId,
			note,
			options,
		): Promise<ReplyTask> {
			const task = ensureTaskExists(
				await dependencies.replyTaskRepository.findById(taskId),
				taskId,
			);

			if (
				typeof options?.expectedVersion === "number" &&
				task.version !== options.expectedVersion
			) {
				throw new TaskOwnershipError(
					TaskOwnershipErrorCode.TASK_TAKEOVER_CONFLICT,
					`Task "${taskId}" version mismatch: expected ${options.expectedVersion}, received ${task.version}.`,
				);
			}

			if (options?.checkPermission !== false) {
				if (!isTakeoverAuthorized(task, actorId, options)) {
					throw new TaskOwnershipError(
						TaskOwnershipErrorCode.TASK_TAKEOVER_PERMISSION_DENIED,
						`Actor "${actorId}" is not allowed to take over task "${taskId}".`,
					);
				}
			}

			if (task.status === "in_takeover") {
				if (task.takenOverBy === actorId) {
					return task;
				}

				throw new TaskOwnershipError(
					TaskOwnershipErrorCode.TASK_TAKEOVER_CONFLICT,
					`Task "${taskId}" is already being taken over by "${task.takenOverBy}".`,
				);
			}

			ensureTakeoverStartAllowed(task);

			const takenOverTask = appendReplyTaskEvent(
				{
					...markReplyTaskStatus(task, "in_takeover"),
					takenOverBy: actorId,
					updatedAt: new Date(),
				},
				{
					type: "task_taken_over",
					actorId,
					payload: {
						action: "take_over",
						note,
						expectedVersion: options?.expectedVersion,
					},
				},
			);

			return persistTask(
				dependencies.replyTaskRepository,
				takenOverTask,
				`Failed to take over task "${taskId}" due to a concurrent update.`,
			);
		},

		async completeTakeover(
			taskId,
			actorId,
			result,
			note,
			options,
		): Promise<ReplyTask> {
			if (!TAKEOVER_COMPLETION_RESULTS.has(result)) {
				throw new TaskOwnershipError(
					TaskOwnershipErrorCode.TASK_TAKEOVER_RESULT_INVALID,
					`Unsupported takeover completion result "${result}".`,
				);
			}

			const task = ensureTaskExists(
				await dependencies.replyTaskRepository.findById(taskId),
				taskId,
			);

			if (!isTakeoverAuthorized(task, actorId, options)) {
				throw new TaskOwnershipError(
					TaskOwnershipErrorCode.TASK_TAKEOVER_PERMISSION_DENIED,
					`Actor "${actorId}" is not allowed to complete takeover for task "${taskId}".`,
				);
			}

			if (task.status !== "in_takeover") {
				throw new ReplyTaskDomainError(
					ReplyTaskDomainErrorCode.INVALID_TASK_STATUS_TRANSITION,
					`Reply task "${task.id}" in status "${task.status}" cannot complete takeover.`,
				);
			}

			const completedTask = appendReplyTaskEvent(
				{
					...markReplyTaskStatus(task, result),
					takenOverBy: actorId,
					updatedAt: new Date(),
				},
				{
					type: "task_taken_over",
					actorId,
					payload: {
						action: "complete_takeover",
						result,
						note,
					},
				},
			);

			return persistTask(
				dependencies.replyTaskRepository,
				completedTask,
				`Failed to complete takeover for task "${taskId}" due to a concurrent update.`,
			);
		},
	};
}
