import { beforeEach, describe, expect, it } from "vitest";
import type { CandidateReply } from "../../../domain/candidateReply";
import { createCandidateReply } from "../../../domain/candidateReply";
import { InMemoryCandidateReplyRepository } from "../InMemoryCandidateReplyRepository";

describe("InMemoryCandidateReplyRepository", () => {
	let repository: InMemoryCandidateReplyRepository;

	beforeEach(() => {
		repository = new InMemoryCandidateReplyRepository();
	});

	describe("save and findById", () => {
		it("should save and retrieve a candidate reply", async () => {
			const reply = createCandidateReply({
				commentInputId: "comment-123",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Test reply",
				riskLevel: "low",
				confidence: 0.8,
				modelSource: "claude",
				knowledgeHits: 1,
			});

			await repository.save(reply);
			const retrieved = await repository.findById(reply.id);

			expect(retrieved).toEqual(reply);
		});

		it("should return null for non-existent ID", async () => {
			const result = await repository.findById("non-existent-id");
			expect(result).toBeNull();
		});

		it("should update existing reply when saving with same ID", async () => {
			const reply = createCandidateReply({
				commentInputId: "comment-123",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Original content",
				riskLevel: "low",
				confidence: 0.8,
				modelSource: "claude",
				knowledgeHits: 1,
			});

			await repository.save(reply);

			const updatedReply: CandidateReply = {
				...reply,
				content: "Updated content",
			};

			await repository.save(updatedReply);
			const retrieved = await repository.findById(reply.id);

			expect(retrieved?.content).toBe("Updated content");
		});
	});

	describe("findByCommentInput", () => {
		it("should find all replies for a comment input", async () => {
			const reply1 = createCandidateReply({
				commentInputId: "comment-123",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Reply 1",
				riskLevel: "low",
				confidence: 0.8,
				modelSource: "claude",
				knowledgeHits: 1,
			});

			const reply2 = createCandidateReply({
				commentInputId: "comment-123",
				accountId: "account-789",
				workspaceId: "workspace-001",
				content: "Reply 2",
				riskLevel: "medium",
				confidence: 0.7,
				modelSource: "claude",
				knowledgeHits: 2,
			});

			const reply3 = createCandidateReply({
				commentInputId: "comment-999",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Reply 3",
				riskLevel: "low",
				confidence: 0.9,
				modelSource: "claude",
				knowledgeHits: 0,
			});

			await repository.save(reply1);
			await repository.save(reply2);
			await repository.save(reply3);

			const results = await repository.findByCommentInput("comment-123");

			expect(results).toHaveLength(2);
			expect(results.map((r) => r.id)).toContain(reply1.id);
			expect(results.map((r) => r.id)).toContain(reply2.id);
			expect(results.map((r) => r.id)).not.toContain(reply3.id);
		});

		it("should return replies sorted by newest first", async () => {
			const reply1 = createCandidateReply({
				commentInputId: "comment-123",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Reply 1",
				riskLevel: "low",
				confidence: 0.8,
				modelSource: "claude",
				knowledgeHits: 1,
			});

			// Wait a bit to ensure different timestamps
			await new Promise((resolve) => setTimeout(resolve, 10));

			const reply2 = createCandidateReply({
				commentInputId: "comment-123",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Reply 2",
				riskLevel: "low",
				confidence: 0.8,
				modelSource: "claude",
				knowledgeHits: 1,
			});

			await repository.save(reply1);
			await repository.save(reply2);

			const results = await repository.findByCommentInput("comment-123");

			expect(results[0].id).toBe(reply2.id); // Newest first
			expect(results[1].id).toBe(reply1.id);
		});
	});

	describe("findByAccount", () => {
		it("should find all replies for an account", async () => {
			const reply1 = createCandidateReply({
				commentInputId: "comment-123",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Reply 1",
				riskLevel: "low",
				confidence: 0.8,
				modelSource: "claude",
				knowledgeHits: 1,
			});

			const reply2 = createCandidateReply({
				commentInputId: "comment-789",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Reply 2",
				riskLevel: "medium",
				confidence: 0.7,
				modelSource: "claude",
				knowledgeHits: 2,
			});

			await repository.save(reply1);
			await repository.save(reply2);

			const results = await repository.findByAccount("account-456");

			expect(results).toHaveLength(2);
			expect(results.map((r) => r.id)).toContain(reply1.id);
			expect(results.map((r) => r.id)).toContain(reply2.id);
		});
	});

	describe("findByRole", () => {
		it("should find all replies for a role", async () => {
			const reply1 = createCandidateReply({
				commentInputId: "comment-123",
				accountId: "account-456",
				roleId: "role-789",
				workspaceId: "workspace-001",
				content: "Reply 1",
				riskLevel: "low",
				confidence: 0.8,
				modelSource: "claude",
				knowledgeHits: 1,
			});

			const reply2 = createCandidateReply({
				commentInputId: "comment-456",
				accountId: "account-789",
				roleId: "role-789",
				workspaceId: "workspace-001",
				content: "Reply 2",
				riskLevel: "medium",
				confidence: 0.7,
				modelSource: "claude",
				knowledgeHits: 2,
			});

			const reply3 = createCandidateReply({
				commentInputId: "comment-999",
				accountId: "account-456",
				roleId: "role-999",
				workspaceId: "workspace-001",
				content: "Reply 3",
				riskLevel: "low",
				confidence: 0.9,
				modelSource: "claude",
				knowledgeHits: 0,
			});

			await repository.save(reply1);
			await repository.save(reply2);
			await repository.save(reply3);

			const results = await repository.findByRole("role-789");

			expect(results).toHaveLength(2);
			expect(results.map((r) => r.id)).toContain(reply1.id);
			expect(results.map((r) => r.id)).toContain(reply2.id);
			expect(results.map((r) => r.id)).not.toContain(reply3.id);
		});
	});

	describe("findByWorkspace", () => {
		it("should find all replies for a workspace", async () => {
			const reply1 = createCandidateReply({
				commentInputId: "comment-123",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Reply 1",
				riskLevel: "low",
				confidence: 0.8,
				modelSource: "claude",
				knowledgeHits: 1,
			});

			const reply2 = createCandidateReply({
				commentInputId: "comment-456",
				accountId: "account-789",
				workspaceId: "workspace-001",
				content: "Reply 2",
				riskLevel: "medium",
				confidence: 0.7,
				modelSource: "claude",
				knowledgeHits: 2,
			});

			await repository.save(reply1);
			await repository.save(reply2);

			const results = await repository.findByWorkspace("workspace-001");

			expect(results).toHaveLength(2);
		});
	});

	describe("countByCommentInput", () => {
		it("should count replies for a comment input", async () => {
			const reply1 = createCandidateReply({
				commentInputId: "comment-123",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Reply 1",
				riskLevel: "low",
				confidence: 0.8,
				modelSource: "claude",
				knowledgeHits: 1,
			});

			const reply2 = createCandidateReply({
				commentInputId: "comment-123",
				accountId: "account-789",
				workspaceId: "workspace-001",
				content: "Reply 2",
				riskLevel: "medium",
				confidence: 0.7,
				modelSource: "claude",
				knowledgeHits: 2,
			});

			await repository.save(reply1);
			await repository.save(reply2);

			const count = await repository.countByCommentInput("comment-123");

			expect(count).toBe(2);
		});

		it("should return 0 for comment input with no replies", async () => {
			const count = await repository.countByCommentInput("non-existent");
			expect(count).toBe(0);
		});
	});

	describe("countByRiskLevel", () => {
		it("should count replies by risk level", async () => {
			const reply1 = createCandidateReply({
				commentInputId: "comment-123",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Reply 1",
				riskLevel: "low",
				confidence: 0.8,
				modelSource: "claude",
				knowledgeHits: 1,
			});

			const reply2 = createCandidateReply({
				commentInputId: "comment-456",
				accountId: "account-789",
				workspaceId: "workspace-001",
				content: "Reply 2",
				riskLevel: "low",
				confidence: 0.7,
				modelSource: "claude",
				knowledgeHits: 2,
			});

			const reply3 = createCandidateReply({
				commentInputId: "comment-789",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Reply 3",
				riskLevel: "high",
				confidence: 0.6,
				modelSource: "claude",
				knowledgeHits: 0,
			});

			await repository.save(reply1);
			await repository.save(reply2);
			await repository.save(reply3);

			const lowCount = await repository.countByRiskLevel("low");
			const mediumCount = await repository.countByRiskLevel("medium");
			const highCount = await repository.countByRiskLevel("high");

			expect(lowCount).toBe(2);
			expect(mediumCount).toBe(0);
			expect(highCount).toBe(1);
		});
	});

	describe("delete", () => {
		it("should delete a candidate reply", async () => {
			const reply = createCandidateReply({
				commentInputId: "comment-123",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Test reply",
				riskLevel: "low",
				confidence: 0.8,
				modelSource: "claude",
				knowledgeHits: 1,
			});

			await repository.save(reply);
			await repository.delete(reply.id);

			const retrieved = await repository.findById(reply.id);
			expect(retrieved).toBeNull();
		});
	});

	describe("integration tests", () => {
		it("should save and retrieve candidate reply successfully", async () => {
			const reply = createCandidateReply({
				commentInputId: "comment-123",
				accountId: "account-456",
				roleId: "role-789",
				workspaceId: "workspace-001",
				content: "Integration test reply",
				riskLevel: "medium",
				confidence: 0.75,
				modelSource: "claude",
				knowledgeHits: 3,
				metadata: { test: "integration" },
			});

			await repository.save(reply);

			const byId = await repository.findById(reply.id);
			const byComment = await repository.findByCommentInput("comment-123");
			const byAccount = await repository.findByAccount("account-456");
			const byRole = await repository.findByRole("role-789");
			const byWorkspace = await repository.findByWorkspace("workspace-001");

			expect(byId).toEqual(reply);
			expect(byComment).toContainEqual(reply);
			expect(byAccount).toContainEqual(reply);
			expect(byRole).toContainEqual(reply);
			expect(byWorkspace).toContainEqual(reply);
		});

		it("should return correct results for associated queries", async () => {
			const reply1 = createCandidateReply({
				commentInputId: "comment-123",
				accountId: "account-456",
				roleId: "role-789",
				workspaceId: "workspace-001",
				content: "Reply 1",
				riskLevel: "low",
				confidence: 0.8,
				modelSource: "claude",
				knowledgeHits: 1,
			});

			const reply2 = createCandidateReply({
				commentInputId: "comment-123",
				accountId: "account-456",
				roleId: "role-999",
				workspaceId: "workspace-001",
				content: "Reply 2",
				riskLevel: "high",
				confidence: 0.6,
				modelSource: "claude",
				knowledgeHits: 0,
			});

			await repository.save(reply1);
			await repository.save(reply2);

			const byComment = await repository.findByCommentInput("comment-123");
			const byRole789 = await repository.findByRole("role-789");
			const byRole999 = await repository.findByRole("role-999");

			expect(byComment).toHaveLength(2);
			expect(byRole789).toHaveLength(1);
			expect(byRole999).toHaveLength(1);
			expect(byRole789[0].id).toBe(reply1.id);
			expect(byRole999[0].id).toBe(reply2.id);
		});

		it("should return correct counts for statistical queries", async () => {
			const reply1 = createCandidateReply({
				commentInputId: "comment-123",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Reply 1",
				riskLevel: "low",
				confidence: 0.8,
				modelSource: "claude",
				knowledgeHits: 1,
			});

			const reply2 = createCandidateReply({
				commentInputId: "comment-123",
				accountId: "account-789",
				workspaceId: "workspace-001",
				content: "Reply 2",
				riskLevel: "low",
				confidence: 0.7,
				modelSource: "claude",
				knowledgeHits: 2,
			});

			const reply3 = createCandidateReply({
				commentInputId: "comment-456",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Reply 3",
				riskLevel: "high",
				confidence: 0.6,
				modelSource: "claude",
				knowledgeHits: 0,
			});

			await repository.save(reply1);
			await repository.save(reply2);
			await repository.save(reply3);

			const countComment123 =
				await repository.countByCommentInput("comment-123");
			const countComment456 =
				await repository.countByCommentInput("comment-456");
			const countLowRisk = await repository.countByRiskLevel("low");
			const countHighRisk = await repository.countByRiskLevel("high");

			expect(countComment123).toBe(2);
			expect(countComment456).toBe(1);
			expect(countLowRisk).toBe(2);
			expect(countHighRisk).toBe(1);
		});

		it("should not find deleted candidate reply", async () => {
			const reply = createCandidateReply({
				commentInputId: "comment-123",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "To be deleted",
				riskLevel: "low",
				confidence: 0.8,
				modelSource: "claude",
				knowledgeHits: 1,
			});

			await repository.save(reply);
			await repository.delete(reply.id);

			const byId = await repository.findById(reply.id);
			const byComment = await repository.findByCommentInput("comment-123");
			const count = await repository.countByCommentInput("comment-123");

			expect(byId).toBeNull();
			expect(byComment).toHaveLength(0);
			expect(count).toBe(0);
		});
	});
});
