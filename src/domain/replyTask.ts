import type { RiskLevel } from "./candidateReply";
import {
	ReplyTaskDomainError,
	ReplyTaskDomainErrorCode,
} from "./errors";
import type { RoleId } from "./role";
import type { AccountId, WorkspaceId } from "./types";

export type ReplyTaskId = string;
export type ReplyTaskEventId = string;
export type ReplyTaskRoute = "pending_review" | "ready_for_execution";
export type ReplyTaskStatus =
	| "created"
	| "pending_route"
	| "pending_review"
	| "ready_for_execution"
	| "assigned"
	| "in_takeover"
	| "rejected"
	| "completed";
export type ReplyTaskEventType =
	| "task_created"
	| "risk_routed"
	| "review_requested"
	| "review_decided"
	| "task_assigned"
	| "task_taken_over"
	| "task_completed"
	| "task_failed";

export interface ReplyTaskEvent {
	id: ReplyTaskEventId;
	taskId: ReplyTaskId;
	type: ReplyTaskEventType;
	actorId: string;
	createdAt: Date;
	payload?: Record<string, unknown>;
}

export interface ReplyTask {
	id: ReplyTaskId;
	workspaceId: WorkspaceId;
	accountId: AccountId;
	commentInputId: string;
	candidateReplyId: string;
	roleId?: RoleId;
	riskLevel: RiskLevel;
	route: ReplyTaskRoute;
	status: ReplyTaskStatus;
	assigneeId?: string;
	takenOverBy?: string;
	version: number;
	events: ReplyTaskEvent[];
	createdAt: Date;
	updatedAt: Date;
}

export interface CreateReplyTaskParams {
	workspaceId: WorkspaceId;
	accountId: AccountId;
	commentInputId: string;
	candidateReplyId: string;
	riskLevel: RiskLevel;
	createdBy: string;
	roleId?: RoleId;
	route?: ReplyTaskRoute;
	status?: ReplyTaskStatus;
	assigneeId?: string;
	takenOverBy?: string;
	payload?: Record<string, unknown>;
}

export interface AppendReplyTaskEventParams {
	type: ReplyTaskEventType;
	actorId: string;
	payload?: Record<string, unknown>;
	createdAt?: Date;
}

export const VALID_STATUS_TRANSITIONS: Record<
	ReplyTaskStatus,
	ReplyTaskStatus[]
> = {
	created: ["pending_route"],
	pending_route: ["pending_review", "ready_for_execution", "rejected"],
	pending_review: ["assigned", "in_takeover", "ready_for_execution", "rejected"],
	ready_for_execution: ["assigned", "in_takeover", "completed", "rejected"],
	assigned: [
		"pending_review",
		"in_takeover",
		"ready_for_execution",
		"completed",
		"rejected",
	],
	in_takeover: ["ready_for_execution", "completed", "rejected"],
	rejected: [],
	completed: [],
};

export function generateReplyTaskId(): ReplyTaskId {
	return crypto.randomUUID();
}

export function generateReplyTaskEventId(): ReplyTaskEventId {
	return crypto.randomUUID();
}

function buildReplyTaskEvent(
	taskId: ReplyTaskId,
	params: AppendReplyTaskEventParams,
): ReplyTaskEvent {
	return {
		id: generateReplyTaskEventId(),
		taskId,
		type: params.type,
		actorId: params.actorId,
		createdAt: params.createdAt ?? new Date(),
		payload: params.payload,
	};
}

export function createReplyTask(params: CreateReplyTaskParams): ReplyTask {
	const createdAt = new Date();
	const taskId = generateReplyTaskId();
	const initialStatus = params.status ?? "created";
	const initialRoute = params.route ?? "pending_review";

	return {
		id: taskId,
		workspaceId: params.workspaceId,
		accountId: params.accountId,
		commentInputId: params.commentInputId,
		candidateReplyId: params.candidateReplyId,
		roleId: params.roleId,
		riskLevel: params.riskLevel,
		route: initialRoute,
		status: initialStatus,
		assigneeId: params.assigneeId,
		takenOverBy: params.takenOverBy,
		version: 1,
		events: [
			buildReplyTaskEvent(taskId, {
				type: "task_created",
				actorId: params.createdBy,
				payload: params.payload,
				createdAt,
			}),
		],
		createdAt,
		updatedAt: createdAt,
	};
}

export function appendReplyTaskEvent(
	task: ReplyTask,
	params: AppendReplyTaskEventParams,
): ReplyTask {
	try {
		const event = buildReplyTaskEvent(task.id, params);

		return {
			...task,
			events: [...task.events, event],
			updatedAt: event.createdAt,
		};
	} catch (cause) {
		throw new ReplyTaskDomainError(
			ReplyTaskDomainErrorCode.TASK_EVENT_APPEND_FAILED,
			`Failed to append event "${params.type}" to task "${task.id}"`,
			cause,
		);
	}
}

export function assertCanTransition(
	currentStatus: ReplyTaskStatus,
	nextStatus: ReplyTaskStatus,
): void {
	const validNextStatuses = VALID_STATUS_TRANSITIONS[currentStatus];

	if (!validNextStatuses.includes(nextStatus)) {
		throw new ReplyTaskDomainError(
			ReplyTaskDomainErrorCode.INVALID_TASK_STATUS_TRANSITION,
			`Cannot transition reply task from "${currentStatus}" to "${nextStatus}"`,
		);
	}
}

export function markReplyTaskStatus(
	task: ReplyTask,
	nextStatus: ReplyTaskStatus,
	options?: {
		route?: ReplyTaskRoute;
		updatedAt?: Date;
	},
): ReplyTask {
	assertCanTransition(task.status, nextStatus);

	return {
		...task,
		status: nextStatus,
		route: options?.route ?? task.route,
		updatedAt: options?.updatedAt ?? new Date(),
	};
}
