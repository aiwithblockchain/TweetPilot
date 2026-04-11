import type { ExecutionChannelType } from "./executionChannel";

export type ExecutionRequestId = string;
export type ExecutionRequestStatus =
	| "pending"
	| "in_progress"
	| "completed"
	| "failed"
	| "cancelled";

export type ExecutionActionType = "reply";

export interface ExecutionPayload {
	commentInputId: string;
	candidateReplyId: string;
	targetTweetId: string;
	replyContent: string;
	accountId: string;
	workspaceId: string;
	roleId?: string;
}

export interface ExecutionResult {
	success: boolean;
	tweetId?: string;
	platformResponse?: Record<string, unknown>;
	executedAt: Date;
}

export interface ExecutionError {
	code: string;
	message: string;
	retryable: boolean;
	details?: Record<string, unknown>;
}

export interface ExecutionRequest {
	id: ExecutionRequestId;
	taskId: string;
	channelId: string;
	channelType: ExecutionChannelType;
	actionType: ExecutionActionType;
	status: ExecutionRequestStatus;
	payload: ExecutionPayload;
	result?: ExecutionResult;
	error?: ExecutionError;
	createdAt: Date;
	updatedAt: Date;
	executedAt?: Date;
}

export interface CreateExecutionRequestParams {
	taskId: string;
	channelId: string;
	channelType: ExecutionChannelType;
	actionType: ExecutionActionType;
	payload: ExecutionPayload;
}

export function generateExecutionRequestId(): ExecutionRequestId {
	return `exec-req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createExecutionRequest(
	params: CreateExecutionRequestParams,
): ExecutionRequest {
	const now = new Date();

	return {
		id: generateExecutionRequestId(),
		taskId: params.taskId,
		channelId: params.channelId,
		channelType: params.channelType,
		actionType: params.actionType,
		status: "pending",
		payload: params.payload,
		createdAt: now,
		updatedAt: now,
	};
}
