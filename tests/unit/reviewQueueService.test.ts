import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCandidateReply } from "../../src/domain/candidateReply";
import { createCommentInput } from "../../src/domain/commentInput";
import { createReplyTask } from "../../src/domain/replyTask";
import {
	ReplyTaskDomainError,
	ReplyTaskDomainErrorCode,
} from "../../src/domain/errors";
import { InMemoryCommentInputRepository } from "../../src/data/commentInputRepository";
import { InMemoryCandidateReplyRepository } from "../../src/data/repositories/InMemoryCandidateReplyRepository";
import { InMemoryReplyTaskRepository } from "../../src/data/repositories/InMemoryReplyTaskRepository";
import {
	ReviewQueueError,
	ReviewQueueErrorCode,
	createReviewQueueService,
} from "../../src/services/reviewQueueService";

describe("reviewQueueService", () => {
	let candidateReplyRepository: InMemoryCandidateReplyRepository;
	let commentInputRepository: InMemoryCommentInputRepository;
	let replyTaskRepository: InMemoryReplyTaskRepository;
	let service: ReturnType<typeof createReviewQueueService>;

	beforeEach(() => {
		candidateReplyRepository = new InMemoryCandidateReplyRepository();
		commentInputRepository = new InMemoryCommentInputRepository();
		replyTaskRepository = new InMemoryReplyTaskRepository();
		service = createReviewQueueService({
			candidateReplyRepository,
			commentInputRepository,
			replyTaskRepository,
		});
	});

	it("should assemble pending review tasks into review queue items", async () => {
		const commentInput = createCommentInput({
			workspaceId: "workspace-001",
			accountId: "account-001",
			content: "Can you share pricing details?",
		});
		const candidateReply = createCandidateReply({
			commentInputId: commentInput.id,
			accountId: "account-001",
			workspaceId: "workspace-001",
			content: "We can send pricing in DM.",
			riskLevel: "high",
			confidence: 0.8,
			modelSource: "claude",
			knowledgeHits: 1,
		});
		const task = {
			...createReplyTask({
				workspaceId: "workspace-001",
				accountId: "account-001",
				commentInputId: commentInput.id,
				candidateReplyId: candidateReply.id,
				riskLevel: "high",
				createdBy: "user-001",
			}),
			status: "pending_review" as const,
			route: "pending_review" as const,
		};
		await commentInputRepository.save(commentInput);
		await candidateReplyRepository.save(candidateReply);
		await replyTaskRepository.save(task);

		const result = await service.listPending("workspace-001");

		expect(result.total).toBe(1);
		expect(result.items[0]).toMatchObject({
			taskId: task.id,
			candidateReplyId: candidateReply.id,
			commentInputId: commentInput.id,
			accountId: "account-001",
			workspaceId: "workspace-001",
			riskLevel: "high",
			candidateReply: {
				id: candidateReply.id,
				content: candidateReply.content,
			},
			commentInput: {
				id: commentInput.id,
				content: commentInput.content,
			},
		});
	});

	it("should apply limit, offset, riskLevel and sorting options", async () => {
		const fixtures = [
			{
				id: "comment-a",
				content: "Need help A",
				reply: "Reply A",
				riskLevel: "medium" as const,
				createdAt: new Date("2026-04-11T08:00:00.000Z"),
			},
			{
				id: "comment-b",
				content: "Need help B",
				reply: "Reply B",
				riskLevel: "high" as const,
				createdAt: new Date("2026-04-11T09:00:00.000Z"),
			},
			{
				id: "comment-c",
				content: "Need help C",
				reply: "Reply C",
				riskLevel: "high" as const,
				createdAt: new Date("2026-04-11T10:00:00.000Z"),
			},
		];

		for (const fixture of fixtures) {
			const commentInput = createCommentInput({
				workspaceId: "workspace-001",
				accountId: "account-001",
				content: fixture.content,
			});
			const candidateReply = createCandidateReply({
				commentInputId: commentInput.id,
				accountId: "account-001",
				workspaceId: "workspace-001",
				content: fixture.reply,
				riskLevel: fixture.riskLevel,
				confidence: 0.8,
				modelSource: "claude",
				knowledgeHits: 1,
			});
			const task = {
				...createReplyTask({
					workspaceId: "workspace-001",
					accountId: "account-001",
					commentInputId: commentInput.id,
					candidateReplyId: candidateReply.id,
					riskLevel: fixture.riskLevel,
					createdBy: "user-001",
				}),
				status: "pending_review" as const,
				route: "pending_review" as const,
				createdAt: fixture.createdAt,
				updatedAt: fixture.createdAt,
			};
			await commentInputRepository.save(commentInput);
			await candidateReplyRepository.save(candidateReply);
			await replyTaskRepository.save(task);
		}

		const result = await service.listPending("workspace-001", {
			limit: 1,
			offset: 1,
			riskLevel: "high",
			sortBy: "createdAt",
			sortOrder: "desc",
		});

		expect(result.total).toBe(2);
		expect(result.items).toHaveLength(1);
		expect(result.items[0]?.riskLevel).toBe("high");
		expect(result.items[0]?.commentInput.content).toBe("Need help B");
	});

	it("should sort by risk level", async () => {
		const mediumComment = createCommentInput({
			workspaceId: "workspace-001",
			accountId: "account-001",
			content: "Need help medium",
		});
		const highComment = createCommentInput({
			workspaceId: "workspace-001",
			accountId: "account-001",
			content: "Need help high",
		});
		const mediumReply = createCandidateReply({
			commentInputId: mediumComment.id,
			accountId: "account-001",
			workspaceId: "workspace-001",
			content: "Medium reply",
			riskLevel: "medium",
			confidence: 0.8,
			modelSource: "claude",
			knowledgeHits: 1,
		});
		const highReply = createCandidateReply({
			commentInputId: highComment.id,
			accountId: "account-001",
			workspaceId: "workspace-001",
			content: "High reply",
			riskLevel: "high",
			confidence: 0.8,
			modelSource: "claude",
			knowledgeHits: 1,
		});
		await commentInputRepository.save(mediumComment);
		await commentInputRepository.save(highComment);
		await candidateReplyRepository.save(mediumReply);
		await candidateReplyRepository.save(highReply);
		await replyTaskRepository.save({
			...createReplyTask({
				workspaceId: "workspace-001",
				accountId: "account-001",
				commentInputId: mediumComment.id,
				candidateReplyId: mediumReply.id,
				riskLevel: "medium",
				createdBy: "user-001",
			}),
			status: "pending_review" as const,
			route: "pending_review" as const,
		});
		await replyTaskRepository.save({
			...createReplyTask({
				workspaceId: "workspace-001",
				accountId: "account-001",
				commentInputId: highComment.id,
				candidateReplyId: highReply.id,
				riskLevel: "high",
				createdBy: "user-001",
			}),
			status: "pending_review" as const,
			route: "pending_review" as const,
		});

		const result = await service.listPending("workspace-001", {
			sortBy: "riskLevel",
			sortOrder: "desc",
		});

		expect(result.items.map((item) => item.riskLevel)).toEqual([
			"high",
			"medium",
		]);
	});

	it("should approve pending review task into ready_for_execution", async () => {
		const task = await seedPendingReviewTask();

		const reviewedTask = await service.decide({
			taskId: task.id,
			action: "approve",
			actorId: "reviewer-001",
			actorRoles: ["reviewer"],
			note: "Looks safe",
		});

		expect(reviewedTask.status).toBe("ready_for_execution");
		expect(reviewedTask.events.at(-1)).toMatchObject({
			type: "review_decided",
			actorId: "reviewer-001",
			payload: {
				action: "approve",
				note: "Looks safe",
			},
		});
	});

	it("should reject pending review task", async () => {
		const task = await seedPendingReviewTask();

		const reviewedTask = await service.decide({
			taskId: task.id,
			action: "reject",
			actorId: "reviewer-001",
			actorRoles: ["admin"],
		});

		expect(reviewedTask.status).toBe("rejected");
	});

	it("should keep task pending_review when returning to queue", async () => {
		const task = await seedPendingReviewTask({
			assigneeId: "reviewer-001",
		});

		const reviewedTask = await service.decide({
			taskId: task.id,
			action: "return_to_queue",
			actorId: "reviewer-001",
		});

		expect(reviewedTask.status).toBe("pending_review");
		expect(reviewedTask.events.at(-1)).toMatchObject({
			type: "review_decided",
			payload: {
				action: "return_to_queue",
			},
		});
	});

	it("should reject unauthorized reviewer", async () => {
		const task = await seedPendingReviewTask();

		await expect(
			service.decide({
				taskId: task.id,
				action: "approve",
				actorId: "user-002",
			}),
		).rejects.toMatchObject({
			name: "ReviewQueueError",
			code: ReviewQueueErrorCode.REVIEW_PERMISSION_DENIED,
		} satisfies Partial<ReviewQueueError>);
	});

	it("should fail when reviewing a non pending task", async () => {
		const task = await seedPendingReviewTask();
		const storedTask = await replyTaskRepository.findById(task.id);

		if (!storedTask) {
			throw new Error("Expected stored task");
		}

		await replyTaskRepository.save({
			...storedTask,
			status: "ready_for_execution",
		});

		await expect(
			service.decide({
				taskId: task.id,
				action: "approve",
				actorId: "reviewer-001",
				actorRoles: ["reviewer"],
			}),
		).rejects.toMatchObject({
			name: "ReplyTaskDomainError",
			code: ReplyTaskDomainErrorCode.INVALID_TASK_STATUS_TRANSITION,
		} satisfies Partial<ReplyTaskDomainError>);
	});

	it("should reject invalid list query", async () => {
		await expect(
			service.listPending("workspace-001", {
				limit: 0,
			}),
		).rejects.toMatchObject({
			name: "ReviewQueueError",
			code: ReviewQueueErrorCode.REVIEW_QUEUE_INVALID_QUERY,
		} satisfies Partial<ReviewQueueError>);
	});

	it("should warn and skip tasks with missing review context", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const task = {
			...createReplyTask({
				workspaceId: "workspace-001",
				accountId: "account-001",
				commentInputId: "missing-comment",
				candidateReplyId: "missing-reply",
				riskLevel: "high",
				createdBy: "user-001",
			}),
			status: "pending_review" as const,
			route: "pending_review" as const,
		};
		await replyTaskRepository.save(task);

		const result = await service.listPending("workspace-001");

		expect(result).toEqual({
			items: [],
			total: 0,
		});
		expect(warnSpy).toHaveBeenCalledWith(
			`[reviewQueueService] skipped task "${task.id}" because review context is incomplete.`,
			{
				missingCandidateReply: true,
				missingCommentInput: true,
			},
		);
		warnSpy.mockRestore();
	});

	async function seedPendingReviewTask(
		overrides?: Partial<{
			assigneeId: string;
			takenOverBy: string;
			riskLevel: "medium" | "high";
		}>,
	) {
		const commentInput = createCommentInput({
			workspaceId: "workspace-001",
			accountId: "account-001",
			content: "Need review",
		});
		const candidateReply = createCandidateReply({
			commentInputId: commentInput.id,
			accountId: "account-001",
			workspaceId: "workspace-001",
			content: "Candidate reply",
			riskLevel: overrides?.riskLevel ?? "high",
			confidence: 0.8,
			modelSource: "claude",
			knowledgeHits: 1,
		});
		const task = {
			...createReplyTask({
				workspaceId: "workspace-001",
				accountId: "account-001",
				commentInputId: commentInput.id,
				candidateReplyId: candidateReply.id,
				riskLevel: overrides?.riskLevel ?? "high",
				createdBy: "user-001",
				assigneeId: overrides?.assigneeId,
				takenOverBy: overrides?.takenOverBy,
			}),
			status: "pending_review" as const,
			route: "pending_review" as const,
		};

		await commentInputRepository.save(commentInput);
		await candidateReplyRepository.save(candidateReply);
		await replyTaskRepository.save(task);

		return task;
	}
});
