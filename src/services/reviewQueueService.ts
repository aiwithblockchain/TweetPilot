import type { ICandidateReplyRepository } from "../data/repositories/ICandidateReplyRepository";
import type { ICommentInputRepository } from "../data/commentInputRepository";
import type { IReplyTaskRepository } from "../data/repositories/IReplyTaskRepository";
import {
	appendReplyTaskEvent,
	markReplyTaskStatus,
	type ReplyTask,
} from "../domain/replyTask";
import {
	ReplyTaskDomainError,
	ReplyTaskDomainErrorCode,
} from "../domain/errors";
import type {
	ReviewDecision,
	ReviewQueueItem,
	ReviewQueueQuery,
	ReviewQueueRiskLevel,
	ReviewQueueSortBy,
	ReviewQueueSortOrder,
} from "../domain/reviewQueue";

export enum ReviewQueueErrorCode {
	REVIEW_PERMISSION_DENIED = "REVIEW_PERMISSION_DENIED",
	REVIEW_TASK_NOT_FOUND = "REVIEW_TASK_NOT_FOUND",
	REVIEW_QUEUE_INVALID_QUERY = "REVIEW_QUEUE_INVALID_QUERY",
}

export class ReviewQueueError extends Error {
	public readonly code: ReviewQueueErrorCode;
	public readonly cause?: unknown;

	constructor(code: ReviewQueueErrorCode, message: string, cause?: unknown) {
		super(message);
		this.name = "ReviewQueueError";
		this.code = code;
		this.cause = cause;
	}
}

export interface ReviewQueueService {
	listPending(
		workspaceId: string,
		query?: ReviewQueueQuery,
	): Promise<{ items: ReviewQueueItem[]; total: number }>;
	decide(decision: ReviewDecision): Promise<ReplyTask>;
}

interface ReviewQueueServiceDependencies {
	replyTaskRepository: Pick<IReplyTaskRepository, "findById" | "findPendingReview" | "save">;
	candidateReplyRepository: Pick<ICandidateReplyRepository, "findById">;
	commentInputRepository: Pick<ICommentInputRepository, "findById">;
}

const DEFAULT_LIMIT = Number.POSITIVE_INFINITY;
const REVIEWER_ROLES = new Set(["reviewer", "admin"]);
const RISK_LEVEL_ORDER: Record<ReviewQueueRiskLevel, number> = {
	medium: 1,
	high: 2,
};

function isReviewQueueRiskLevel(value: string): value is ReviewQueueRiskLevel {
	return value === "medium" || value === "high";
}

function isPositiveInteger(value: number): boolean {
	return Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: number): boolean {
	return Number.isInteger(value) && value >= 0;
}

function normalizeQuery(query?: ReviewQueueQuery): Required<ReviewQueueQuery> {
	const normalized = {
		limit: query?.limit ?? DEFAULT_LIMIT,
		offset: query?.offset ?? 0,
		riskLevel: query?.riskLevel,
		sortBy: query?.sortBy ?? "createdAt",
		sortOrder: query?.sortOrder ?? "desc",
	};

	if (
		normalized.limit !== DEFAULT_LIMIT &&
		!isPositiveInteger(normalized.limit)
	) {
		throw new ReviewQueueError(
			ReviewQueueErrorCode.REVIEW_QUEUE_INVALID_QUERY,
			`Review queue limit must be a positive integer, received "${normalized.limit}".`,
		);
	}

	if (!isNonNegativeInteger(normalized.offset)) {
		throw new ReviewQueueError(
			ReviewQueueErrorCode.REVIEW_QUEUE_INVALID_QUERY,
			`Review queue offset must be a non-negative integer, received "${normalized.offset}".`,
		);
	}

	if (
		normalized.riskLevel &&
		normalized.riskLevel !== "medium" &&
		normalized.riskLevel !== "high"
	) {
		throw new ReviewQueueError(
			ReviewQueueErrorCode.REVIEW_QUEUE_INVALID_QUERY,
			`Unsupported review queue risk level "${normalized.riskLevel}".`,
		);
	}

	if (
		normalized.sortBy !== "createdAt" &&
		normalized.sortBy !== "riskLevel"
	) {
		throw new ReviewQueueError(
			ReviewQueueErrorCode.REVIEW_QUEUE_INVALID_QUERY,
			`Unsupported review queue sortBy value "${normalized.sortBy}".`,
		);
	}

	if (
		normalized.sortOrder !== "asc" &&
		normalized.sortOrder !== "desc"
	) {
		throw new ReviewQueueError(
			ReviewQueueErrorCode.REVIEW_QUEUE_INVALID_QUERY,
			`Unsupported review queue sortOrder value "${normalized.sortOrder}".`,
		);
	}

	return normalized as Required<ReviewQueueQuery>;
}

function sortReviewQueueItems(
	items: ReviewQueueItem[],
	sortBy: ReviewQueueSortBy,
	sortOrder: ReviewQueueSortOrder,
): ReviewQueueItem[] {
	const multiplier = sortOrder === "asc" ? 1 : -1;

	return [...items].sort((left, right) => {
		if (sortBy === "riskLevel") {
			const riskDiff =
				RISK_LEVEL_ORDER[left.riskLevel] - RISK_LEVEL_ORDER[right.riskLevel];
			if (riskDiff !== 0) {
				return riskDiff * multiplier;
			}
		}

		const createdAtDiff =
			left.createdAt.getTime() - right.createdAt.getTime();
		return createdAtDiff * multiplier;
	});
}

function isAuthorizedReviewer(task: ReplyTask, decision: ReviewDecision): boolean {
	if (task.assigneeId && task.assigneeId === decision.actorId) {
		return true;
	}

	if (task.takenOverBy && task.takenOverBy === decision.actorId) {
		return true;
	}

	return (
		decision.actorRoles?.some((role) => REVIEWER_ROLES.has(role)) ?? false
	);
}

export function createReviewQueueService(
	dependencies: ReviewQueueServiceDependencies,
): ReviewQueueService {
	return {
		async listPending(
			workspaceId: string,
			query?: ReviewQueueQuery,
		): Promise<{ items: ReviewQueueItem[]; total: number }> {
			const normalizedQuery = normalizeQuery(query);
			const pendingTasks = await dependencies.replyTaskRepository.findPendingReview();
			const filteredTasks = pendingTasks.filter((task) => {
				if (task.workspaceId !== workspaceId) {
					return false;
				}

				if (
					normalizedQuery.riskLevel &&
					task.riskLevel !== normalizedQuery.riskLevel
				) {
					return false;
				}

				return isReviewQueueRiskLevel(task.riskLevel);
			});
			const assembledItems = (
				await Promise.all(
					filteredTasks.map(async (task) => {
						const [candidateReply, commentInput] = await Promise.all([
							dependencies.candidateReplyRepository.findById(
								task.candidateReplyId,
							),
							dependencies.commentInputRepository.findById(task.commentInputId),
						]);

						if (!candidateReply || !commentInput) {
							console.warn(
								`[reviewQueueService] skipped task "${task.id}" because review context is incomplete.`,
								{
									missingCandidateReply: !candidateReply,
									missingCommentInput: !commentInput,
								},
							);
							return null;
						}

						return {
							taskId: task.id,
							candidateReplyId: task.candidateReplyId,
							commentInputId: task.commentInputId,
							accountId: task.accountId,
							workspaceId: task.workspaceId,
							riskLevel: task.riskLevel as ReviewQueueRiskLevel,
							assigneeId: task.assigneeId,
							takenOverBy: task.takenOverBy,
							createdAt: task.createdAt,
							candidateReply: {
								id: candidateReply.id,
								content: candidateReply.content,
								confidence: candidateReply.confidence,
								modelSource: candidateReply.modelSource,
								generatedAt: candidateReply.generatedAt,
							},
							commentInput: {
								id: commentInput.id,
								content: commentInput.content,
								targetTweetId: commentInput.targetTweetId,
								targetTweetUrl: commentInput.targetTweetUrl,
								createdAt: commentInput.createdAt,
							},
						} as ReviewQueueItem;
					}),
				)
			).filter((item): item is NonNullable<typeof item> => item !== null);
			const sortedItems = sortReviewQueueItems(
				assembledItems,
				normalizedQuery.sortBy,
				normalizedQuery.sortOrder,
			);

			return {
				items: sortedItems.slice(
					normalizedQuery.offset,
					normalizedQuery.offset + normalizedQuery.limit,
				),
				total: sortedItems.length,
			};
		},

		async decide(decision: ReviewDecision): Promise<ReplyTask> {
			const task = await dependencies.replyTaskRepository.findById(decision.taskId);

			if (!task) {
				throw new ReviewQueueError(
					ReviewQueueErrorCode.REVIEW_TASK_NOT_FOUND,
					`Reply task "${decision.taskId}" was not found.`,
				);
			}

			if (task.status !== "pending_review") {
				throw new ReplyTaskDomainError(
					ReplyTaskDomainErrorCode.INVALID_TASK_STATUS_TRANSITION,
					`Review actions can only be applied to pending_review tasks, received "${task.status}".`,
				);
			}

			if (!isAuthorizedReviewer(task, decision)) {
				throw new ReviewQueueError(
					ReviewQueueErrorCode.REVIEW_PERMISSION_DENIED,
					`Actor "${decision.actorId}" is not allowed to review task "${decision.taskId}".`,
				);
			}

			const nextTask =
				decision.action === "approve"
					? markReplyTaskStatus(task, "ready_for_execution")
					: decision.action === "reject"
						? markReplyTaskStatus(task, "rejected")
						: task;
			const reviewedTask = appendReplyTaskEvent(nextTask, {
				type: "review_decided",
				actorId: decision.actorId,
				payload: {
					action: decision.action,
					note: decision.note,
				},
			});

			await dependencies.replyTaskRepository.save(reviewedTask);

			return (await dependencies.replyTaskRepository.findById(reviewedTask.id)) ?? reviewedTask;
		},
	};
}
