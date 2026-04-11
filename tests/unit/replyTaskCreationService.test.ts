import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCandidateReply } from "../../src/domain/candidateReply";
import { InMemoryCandidateReplyRepository } from "../../src/data/repositories/InMemoryCandidateReplyRepository";
import { InMemoryReplyTaskRepository } from "../../src/data/repositories/InMemoryReplyTaskRepository";
import {
	ReplyTaskCreationError,
	ReplyTaskCreationErrorCode,
	createReplyTaskCreationService,
} from "../../src/services/replyTaskCreationService";

describe("replyTaskCreationService", () => {
	let candidateReplyRepository: InMemoryCandidateReplyRepository;
	let replyTaskRepository: InMemoryReplyTaskRepository;
	let service: ReturnType<typeof createReplyTaskCreationService>;

	beforeEach(() => {
		candidateReplyRepository = new InMemoryCandidateReplyRepository();
		replyTaskRepository = new InMemoryReplyTaskRepository();
		service = createReplyTaskCreationService({
			candidateReplyRepository,
			replyTaskRepository,
		});
	});

	it("should map candidate reply fields into a reply task", async () => {
		const candidateReply = createCandidateReply({
			commentInputId: "comment-001",
			accountId: "account-001",
			roleId: "role-001",
			workspaceId: "workspace-001",
			content: "Candidate reply",
			riskLevel: "medium",
			confidence: 0.8,
			modelSource: "claude",
			knowledgeHits: 2,
		});
		await candidateReplyRepository.save(candidateReply);

		const result = await service.createFromCandidateReply({
			candidateReplyId: candidateReply.id,
			triggeredBy: "user-001",
			requestedRoute: "auto",
		});

		expect(result.status).toBe("created");
		if (result.status !== "created") {
			throw new Error("Expected created result");
		}

		expect(result.task.workspaceId).toBe(candidateReply.workspaceId);
		expect(result.task.accountId).toBe(candidateReply.accountId);
		expect(result.task.commentInputId).toBe(candidateReply.commentInputId);
		expect(result.task.candidateReplyId).toBe(candidateReply.id);
		expect(result.task.roleId).toBe(candidateReply.roleId);
		expect(result.task.riskLevel).toBe(candidateReply.riskLevel);
		expect(result.task.status).toBe("pending_route");
	});

	it("should return existing task result for duplicate taskization", async () => {
		const candidateReply = createCandidateReply({
			commentInputId: "comment-001",
			accountId: "account-001",
			workspaceId: "workspace-001",
			content: "Candidate reply",
			riskLevel: "low",
			confidence: 0.8,
			modelSource: "claude",
			knowledgeHits: 1,
		});
		await candidateReplyRepository.save(candidateReply);

		const firstResult = await service.createFromCandidateReply({
			candidateReplyId: candidateReply.id,
			triggeredBy: "user-001",
		});
		const secondResult = await service.createFromCandidateReply({
			candidateReplyId: candidateReply.id,
			triggeredBy: "user-002",
		});

		expect(firstResult.status).toBe("created");
		expect(secondResult).toMatchObject({
			status: "existing",
			code: ReplyTaskCreationErrorCode.REPLY_TASK_ALREADY_EXISTS,
		});
	});

	it("should throw candidate reply not found error when source is missing", async () => {
		await expect(
			service.createFromCandidateReply({
				candidateReplyId: "missing-candidate",
				triggeredBy: "user-001",
			}),
		).rejects.toMatchObject({
			name: "ReplyTaskCreationError",
			code: ReplyTaskCreationErrorCode.CANDIDATE_REPLY_NOT_FOUND,
		} satisfies Partial<ReplyTaskCreationError>);
	});

	it("should skip task creation when requestedRoute is skip", async () => {
		const candidateReplyRepositorySpy = vi.spyOn(
			candidateReplyRepository,
			"findById",
		);
		const saveSpy = vi.spyOn(replyTaskRepository, "save");

		const result = await service.createFromCandidateReply({
			candidateReplyId: "candidate-001",
			triggeredBy: "user-001",
			requestedRoute: "skip",
		});

		expect(result).toEqual({
			status: "skipped",
			code: ReplyTaskCreationErrorCode.REPLY_TASK_CREATION_SKIPPED,
			candidateReplyId: "candidate-001",
		});
		expect(candidateReplyRepositorySpy).not.toHaveBeenCalled();
		expect(saveSpy).not.toHaveBeenCalled();
	});

	it("should include trigger and source candidate reply in task_created event payload", async () => {
		const candidateReply = createCandidateReply({
			commentInputId: "comment-001",
			accountId: "account-001",
			workspaceId: "workspace-001",
			content: "Candidate reply",
			riskLevel: "high",
			confidence: 0.8,
			modelSource: "claude",
			knowledgeHits: 1,
		});
		await candidateReplyRepository.save(candidateReply);

		const result = await service.createFromCandidateReply({
			candidateReplyId: candidateReply.id,
			triggeredBy: "operator-001",
			requestedRoute: "force_review",
			metadata: {
				source: "manual-trigger",
			},
		});

		expect(result.status).toBe("created");
		if (result.status !== "created") {
			throw new Error("Expected created result");
		}

		expect(result.task.events[0]).toMatchObject({
			type: "task_created",
			actorId: "operator-001",
			payload: {
				sourceCandidateReplyId: candidateReply.id,
				requestedRoute: "force_review",
				source: "manual-trigger",
			},
		});
	});

	it("should support batch task creation without changing single-create contract", async () => {
		const candidateReplyA = createCandidateReply({
			commentInputId: "comment-001",
			accountId: "account-001",
			workspaceId: "workspace-001",
			content: "Candidate reply A",
			riskLevel: "low",
			confidence: 0.8,
			modelSource: "claude",
			knowledgeHits: 1,
		});
		const candidateReplyB = createCandidateReply({
			commentInputId: "comment-002",
			accountId: "account-001",
			workspaceId: "workspace-001",
			content: "Candidate reply B",
			riskLevel: "medium",
			confidence: 0.7,
			modelSource: "claude",
			knowledgeHits: 0,
		});
		await candidateReplyRepository.save(candidateReplyA);
		await candidateReplyRepository.save(candidateReplyB);

		const results = await service.createBatchFromCandidateReplies([
			{
				candidateReplyId: candidateReplyA.id,
				triggeredBy: "user-001",
			},
			{
				candidateReplyId: candidateReplyB.id,
				triggeredBy: "user-001",
			},
		]);

		expect(results).toHaveLength(2);
		expect(results.every((result) => result.status === "created")).toBe(true);
	});
});
