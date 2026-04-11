import type { ICandidateReplyRepository } from "../data/repositories/ICandidateReplyRepository";
import type { IReplyTaskRepository } from "../data/repositories/IReplyTaskRepository";
import {
	createReplyTask,
	type ReplyTask,
} from "../domain/replyTask";
import type { TaskRoutingService } from "./taskRoutingService";

export enum ReplyTaskCreationErrorCode {
	CANDIDATE_REPLY_NOT_FOUND = "CANDIDATE_REPLY_NOT_FOUND",
	REPLY_TASK_ALREADY_EXISTS = "REPLY_TASK_ALREADY_EXISTS",
	REPLY_TASK_CREATION_SKIPPED = "REPLY_TASK_CREATION_SKIPPED",
}

export class ReplyTaskCreationError extends Error {
	public readonly code: ReplyTaskCreationErrorCode;
	public readonly cause?: unknown;

	constructor(
		code: ReplyTaskCreationErrorCode,
		message: string,
		cause?: unknown,
	) {
		super(message);
		this.name = "ReplyTaskCreationError";
		this.code = code;
		this.cause = cause;
	}
}

export interface CreateReplyTaskFromCandidateReplyParams {
	candidateReplyId: string;
	triggeredBy: string;
	requestedRoute?: "auto" | "force_review" | "skip";
	metadata?: Record<string, unknown>;
}

export type ReplyTaskCreationResult =
	| {
			status: "created";
			task: ReplyTask;
	  }
	| {
			status: "existing";
			code: ReplyTaskCreationErrorCode.REPLY_TASK_ALREADY_EXISTS;
			task: ReplyTask;
	  }
	| {
			status: "skipped";
			code: ReplyTaskCreationErrorCode.REPLY_TASK_CREATION_SKIPPED;
			candidateReplyId: string;
	  };

export interface ReplyTaskCreationService {
	createFromCandidateReply(
		params: CreateReplyTaskFromCandidateReplyParams,
	): Promise<ReplyTaskCreationResult>;
	createBatchFromCandidateReplies(
		params: CreateReplyTaskFromCandidateReplyParams[],
	): Promise<ReplyTaskCreationResult[]>;
}

interface ReplyTaskCreationDependencies {
	candidateReplyRepository: Pick<ICandidateReplyRepository, "findById">;
	replyTaskRepository: Pick<
		IReplyTaskRepository,
		"save" | "findByCandidateReplyId"
	>;
	taskRoutingService?: Pick<TaskRoutingService, "routeTask">;
}

export function createReplyTaskCreationService(
	dependencies: ReplyTaskCreationDependencies,
): ReplyTaskCreationService {
	return {
		async createFromCandidateReply(
			params: CreateReplyTaskFromCandidateReplyParams,
		): Promise<ReplyTaskCreationResult> {
			if (params.requestedRoute === "skip") {
				return {
					status: "skipped",
					code: ReplyTaskCreationErrorCode.REPLY_TASK_CREATION_SKIPPED,
					candidateReplyId: params.candidateReplyId,
				};
			}

			const candidateReply = await dependencies.candidateReplyRepository.findById(
				params.candidateReplyId,
			);

			if (!candidateReply) {
				throw new ReplyTaskCreationError(
					ReplyTaskCreationErrorCode.CANDIDATE_REPLY_NOT_FOUND,
					`Candidate reply "${params.candidateReplyId}" was not found.`,
				);
			}

			const existingTask =
				await dependencies.replyTaskRepository.findByCandidateReplyId(
					params.candidateReplyId,
				);

			if (existingTask) {
				return {
					status: "existing",
					code: ReplyTaskCreationErrorCode.REPLY_TASK_ALREADY_EXISTS,
					task: existingTask,
				};
			}

			const createdTask = createReplyTask({
				workspaceId: candidateReply.workspaceId,
				accountId: candidateReply.accountId,
				commentInputId: candidateReply.commentInputId,
				candidateReplyId: candidateReply.id,
				roleId: candidateReply.roleId,
				riskLevel: candidateReply.riskLevel,
				createdBy: params.triggeredBy,
				payload: {
					sourceCandidateReplyId: candidateReply.id,
					requestedRoute: params.requestedRoute ?? "auto",
					...(params.metadata ?? {}),
				},
			});
			const pendingRouteTask = {
				...createdTask,
				status: "pending_route" as const,
			};

			await dependencies.replyTaskRepository.save(pendingRouteTask);

			if (dependencies.taskRoutingService) {
				await dependencies.taskRoutingService.routeTask(
					pendingRouteTask.id,
					params.triggeredBy,
				);
				const routedTask =
					await dependencies.replyTaskRepository.findByCandidateReplyId(
						params.candidateReplyId,
					);

				if (routedTask) {
					return {
						status: "created",
						task: routedTask,
					};
				}
			}

			return {
				status: "created",
				task: pendingRouteTask,
			};
		},

		async createBatchFromCandidateReplies(
			params: CreateReplyTaskFromCandidateReplyParams[],
		): Promise<ReplyTaskCreationResult[]> {
			return Promise.all(
				params.map((item) => this.createFromCandidateReply(item)),
			);
		},
	};
}
