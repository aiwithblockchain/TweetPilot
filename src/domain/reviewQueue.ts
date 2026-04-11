import type { CandidateReply, RiskLevel } from "./candidateReply";
import type { CommentInput } from "./commentInput";

export type ReviewQueueRiskLevel = Exclude<RiskLevel, "low">;
export type ReviewQueueSortBy = "createdAt" | "riskLevel";
export type ReviewQueueSortOrder = "asc" | "desc";
export type ReviewDecisionAction =
	| "approve"
	| "reject"
	| "return_to_queue";
export type ReviewActorRole = "reviewer" | "admin";

export interface ReviewQueueItem {
	taskId: string;
	candidateReplyId: string;
	commentInputId: string;
	accountId: string;
	workspaceId: string;
	riskLevel: ReviewQueueRiskLevel;
	assigneeId?: string;
	takenOverBy?: string;
	createdAt: Date;
	candidateReply: Pick<
		CandidateReply,
		"id" | "content" | "confidence" | "modelSource" | "generatedAt"
	>;
	commentInput: Pick<
		CommentInput,
		"id" | "content" | "targetTweetId" | "targetTweetUrl" | "createdAt"
	>;
}

export interface ReviewQueueQuery {
	limit?: number;
	offset?: number;
	riskLevel?: ReviewQueueRiskLevel;
	sortBy?: ReviewQueueSortBy;
	sortOrder?: ReviewQueueSortOrder;
}

export interface ReviewDecision {
	taskId: string;
	action: ReviewDecisionAction;
	actorId: string;
	actorRoles?: ReviewActorRole[];
	note?: string;
}
