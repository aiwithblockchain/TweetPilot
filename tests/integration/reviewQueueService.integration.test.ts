import { describe, expect, it } from "vitest";
import { createCandidateReply } from "../../src/domain/candidateReply";
import { createCommentInput } from "../../src/domain/commentInput";
import { InMemoryCommentInputRepository } from "../../src/data/commentInputRepository";
import { InMemoryCandidateReplyRepository } from "../../src/data/repositories/InMemoryCandidateReplyRepository";
import { InMemoryReplyTaskRepository } from "../../src/data/repositories/InMemoryReplyTaskRepository";
import { createReplyTaskCreationService } from "../../src/services/replyTaskCreationService";
import { createReviewQueueService } from "../../src/services/reviewQueueService";
import { createTaskRoutingService } from "../../src/services/taskRoutingService";

describe("reviewQueueService integration", () => {
	it("should list paginated pending review tasks with total and remove approved tasks from queue", async () => {
		const candidateReplyRepository = new InMemoryCandidateReplyRepository();
		const commentInputRepository = new InMemoryCommentInputRepository();
		const replyTaskRepository = new InMemoryReplyTaskRepository();
		const taskRoutingService = createTaskRoutingService({
			replyTaskRepository,
		});
		const taskCreationService = createReplyTaskCreationService({
			candidateReplyRepository,
			replyTaskRepository,
			taskRoutingService,
		});
		const reviewQueueService = createReviewQueueService({
			candidateReplyRepository,
			commentInputRepository,
			replyTaskRepository,
		});
		const commentA = createCommentInput({
			workspaceId: "workspace-001",
			accountId: "account-001",
			content: "Please review A",
		});
		const commentB = createCommentInput({
			workspaceId: "workspace-001",
			accountId: "account-001",
			content: "Please review B",
		});
		const highReplyA = createCandidateReply({
			commentInputId: commentA.id,
			accountId: "account-001",
			workspaceId: "workspace-001",
			content: "High risk reply A",
			riskLevel: "high",
			confidence: 0.7,
			modelSource: "claude",
			knowledgeHits: 1,
		});
		const highReplyB = createCandidateReply({
			commentInputId: commentB.id,
			accountId: "account-001",
			workspaceId: "workspace-001",
			content: "High risk reply B",
			riskLevel: "high",
			confidence: 0.8,
			modelSource: "claude",
			knowledgeHits: 1,
		});

		await commentInputRepository.save(commentA);
		await commentInputRepository.save(commentB);
		await candidateReplyRepository.save(highReplyA);
		await candidateReplyRepository.save(highReplyB);

		const createdA = await taskCreationService.createFromCandidateReply({
			candidateReplyId: highReplyA.id,
			triggeredBy: "router-001",
		});
		const createdB = await taskCreationService.createFromCandidateReply({
			candidateReplyId: highReplyB.id,
			triggeredBy: "router-001",
		});

		expect(createdA.status).toBe("created");
		expect(createdB.status).toBe("created");

		const firstPage = await reviewQueueService.listPending("workspace-001", {
			limit: 1,
			offset: 0,
			sortBy: "createdAt",
			sortOrder: "desc",
		});

		expect(firstPage.total).toBe(2);
		expect(firstPage.items).toHaveLength(1);

		await reviewQueueService.decide({
			taskId: firstPage.items[0].taskId,
			action: "approve",
			actorId: "reviewer-001",
			actorRoles: ["reviewer"],
		});

		const afterApprove = await reviewQueueService.listPending("workspace-001");

		expect(afterApprove.total).toBe(1);
		expect(afterApprove.items[0]?.taskId).not.toBe(firstPage.items[0].taskId);
	});

	it("should keep risk filters and persist rejected status", async () => {
		const candidateReplyRepository = new InMemoryCandidateReplyRepository();
		const commentInputRepository = new InMemoryCommentInputRepository();
		const replyTaskRepository = new InMemoryReplyTaskRepository();
		const taskRoutingService = createTaskRoutingService({
			replyTaskRepository,
		});
		const taskCreationService = createReplyTaskCreationService({
			candidateReplyRepository,
			replyTaskRepository,
			taskRoutingService,
		});
		const reviewQueueService = createReviewQueueService({
			candidateReplyRepository,
			commentInputRepository,
			replyTaskRepository,
		});
		const highComment = createCommentInput({
			workspaceId: "workspace-001",
			accountId: "account-001",
			content: "Need high review",
		});
		const mediumComment = createCommentInput({
			workspaceId: "workspace-001",
			accountId: "account-001",
			content: "Need medium review",
		});
		const highReply = createCandidateReply({
			commentInputId: highComment.id,
			accountId: "account-001",
			workspaceId: "workspace-001",
			content: "High risk reply",
			riskLevel: "high",
			confidence: 0.7,
			modelSource: "claude",
			knowledgeHits: 1,
		});
		const mediumReply = createCandidateReply({
			commentInputId: mediumComment.id,
			accountId: "account-001",
			workspaceId: "workspace-001",
			content: "Medium risk reply",
			riskLevel: "medium",
			confidence: 0.8,
			modelSource: "claude",
			knowledgeHits: 1,
		});

		await commentInputRepository.save(highComment);
		await commentInputRepository.save(mediumComment);
		await candidateReplyRepository.save(highReply);
		await candidateReplyRepository.save(mediumReply);

		const highResult = await taskCreationService.createFromCandidateReply({
			candidateReplyId: highReply.id,
			triggeredBy: "router-001",
		});
		await taskCreationService.createFromCandidateReply({
			candidateReplyId: mediumReply.id,
			triggeredBy: "router-001",
		});

		const filtered = await reviewQueueService.listPending("workspace-001", {
			riskLevel: "high",
		});

		expect(filtered.total).toBe(1);
		expect(filtered.items[0]?.riskLevel).toBe("high");

		if (highResult.status !== "created") {
			throw new Error("Expected created high result");
		}

		await reviewQueueService.decide({
			taskId: highResult.task.id,
			action: "reject",
			actorId: "admin-001",
			actorRoles: ["admin"],
			note: "Unsafe claim",
		});

		expect((await replyTaskRepository.findById(highResult.task.id))?.status).toBe(
			"rejected",
		);
	});
});
