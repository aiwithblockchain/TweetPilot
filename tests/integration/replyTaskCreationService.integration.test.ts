import { describe, expect, it } from "vitest";
import { createCandidateReply } from "../../src/domain/candidateReply";
import { InMemoryCandidateReplyRepository } from "../../src/data/repositories/InMemoryCandidateReplyRepository";
import { InMemoryReplyTaskRepository } from "../../src/data/repositories/InMemoryReplyTaskRepository";
import { createReplyTaskCreationService } from "../../src/services/replyTaskCreationService";

describe("replyTaskCreationService integration", () => {
	it("should create and persist a reply task from candidate reply", async () => {
		const candidateReplyRepository = new InMemoryCandidateReplyRepository();
		const replyTaskRepository = new InMemoryReplyTaskRepository();
		const service = createReplyTaskCreationService({
			candidateReplyRepository,
			replyTaskRepository,
		});
		const candidateReply = createCandidateReply({
			commentInputId: "comment-001",
			accountId: "account-001",
			roleId: "role-001",
			workspaceId: "workspace-001",
			content: "Candidate reply",
			riskLevel: "high",
			confidence: 0.8,
			modelSource: "claude",
			knowledgeHits: 2,
		});

		await candidateReplyRepository.save(candidateReply);

		const result = await service.createFromCandidateReply({
			candidateReplyId: candidateReply.id,
			triggeredBy: "user-001",
		});

		expect(result.status).toBe("created");
		const storedTask = await replyTaskRepository.findByCandidateReplyId(
			candidateReply.id,
		);
		expect(storedTask).not.toBeNull();
		expect(storedTask?.status).toBe("pending_route");
		expect(storedTask?.events[0]).toMatchObject({
			type: "task_created",
			actorId: "user-001",
		});
	});

	it("should keep idempotency when taskization is triggered repeatedly", async () => {
		const candidateReplyRepository = new InMemoryCandidateReplyRepository();
		const replyTaskRepository = new InMemoryReplyTaskRepository();
		const service = createReplyTaskCreationService({
			candidateReplyRepository,
			replyTaskRepository,
		});
		const candidateReply = createCandidateReply({
			commentInputId: "comment-001",
			accountId: "account-001",
			workspaceId: "workspace-001",
			content: "Candidate reply",
			riskLevel: "low",
			confidence: 0.8,
			modelSource: "claude",
			knowledgeHits: 0,
		});
		await candidateReplyRepository.save(candidateReply);

		await service.createFromCandidateReply({
			candidateReplyId: candidateReply.id,
			triggeredBy: "user-001",
		});
		const duplicateResult = await service.createFromCandidateReply({
			candidateReplyId: candidateReply.id,
			triggeredBy: "user-002",
		});

		expect(duplicateResult.status).toBe("existing");
		expect(await replyTaskRepository.findByWorkspace("workspace-001")).toHaveLength(
			1,
		);
		expect(await candidateReplyRepository.findById(candidateReply.id)).toEqual(
			candidateReply,
		);
	});
});
