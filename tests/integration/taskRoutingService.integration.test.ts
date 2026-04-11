import { describe, expect, it } from "vitest";
import { createCandidateReply } from "../../src/domain/candidateReply";
import { InMemoryCandidateReplyRepository } from "../../src/data/repositories/InMemoryCandidateReplyRepository";
import { InMemoryReplyTaskRepository } from "../../src/data/repositories/InMemoryReplyTaskRepository";
import { createReplyTaskCreationService } from "../../src/services/replyTaskCreationService";
import { createTaskRoutingService } from "../../src/services/taskRoutingService";

describe("taskRoutingService integration", () => {
	it("should route taskized candidate replies according to risk level", async () => {
		const candidateReplyRepository = new InMemoryCandidateReplyRepository();
		const replyTaskRepository = new InMemoryReplyTaskRepository();
		const taskRoutingService = createTaskRoutingService({
			replyTaskRepository,
		});
		const taskCreationService = createReplyTaskCreationService({
			candidateReplyRepository,
			replyTaskRepository,
			taskRoutingService,
		});
		const highRiskReply = createCandidateReply({
			commentInputId: "comment-001",
			accountId: "account-001",
			workspaceId: "workspace-001",
			content: "High risk reply",
			riskLevel: "high",
			confidence: 0.8,
			modelSource: "claude",
			knowledgeHits: 1,
		});
		const lowRiskReply = createCandidateReply({
			commentInputId: "comment-002",
			accountId: "account-001",
			workspaceId: "workspace-001",
			content: "Low risk reply",
			riskLevel: "low",
			confidence: 0.9,
			modelSource: "claude",
			knowledgeHits: 0,
		});
		await candidateReplyRepository.save(highRiskReply);
		await candidateReplyRepository.save(lowRiskReply);

		const highResult = await taskCreationService.createFromCandidateReply({
			candidateReplyId: highRiskReply.id,
			triggeredBy: "user-001",
		});
		const lowResult = await taskCreationService.createFromCandidateReply({
			candidateReplyId: lowRiskReply.id,
			triggeredBy: "user-001",
		});

		expect(highResult.status).toBe("created");
		expect(lowResult.status).toBe("created");
		if (highResult.status !== "created" || lowResult.status !== "created") {
			throw new Error("Expected created results");
		}

		expect(highResult.task.status).toBe("pending_review");
		expect(lowResult.task.status).toBe("ready_for_execution");
		expect(await replyTaskRepository.findPendingReview()).toHaveLength(1);
		expect(await replyTaskRepository.findByRoute("ready_for_execution")).toHaveLength(
			1,
		);
	});

	it("should follow overridden medium risk rule", async () => {
		const candidateReplyRepository = new InMemoryCandidateReplyRepository();
		const replyTaskRepository = new InMemoryReplyTaskRepository();
		const taskRoutingService = createTaskRoutingService({
			replyTaskRepository,
			rules: {
				medium: {
					riskLevel: "medium",
					defaultRoute: "ready_for_execution",
					fallbackRoute: "pending_review",
				},
			},
		});
		const taskCreationService = createReplyTaskCreationService({
			candidateReplyRepository,
			replyTaskRepository,
			taskRoutingService,
		});
		const mediumReply = createCandidateReply({
			commentInputId: "comment-001",
			accountId: "account-001",
			workspaceId: "workspace-001",
			content: "Medium risk reply",
			riskLevel: "medium",
			confidence: 0.7,
			modelSource: "claude",
			knowledgeHits: 1,
		});
		await candidateReplyRepository.save(mediumReply);

		const result = await taskCreationService.createFromCandidateReply({
			candidateReplyId: mediumReply.id,
			triggeredBy: "user-001",
		});

		expect(result.status).toBe("created");
		if (result.status !== "created") {
			throw new Error("Expected created result");
		}

		expect(result.task.status).toBe("ready_for_execution");
		expect(await replyTaskRepository.findPendingReview()).toHaveLength(0);
	});
});
