import { describe, expect, it } from "vitest";
import {
	type CreateCandidateReplyParams,
	createCandidateReply,
	generateCandidateReplyId,
} from "../candidateReply";

describe("CandidateReply Domain", () => {
	describe("generateCandidateReplyId", () => {
		it("should generate valid UUID v4 format", () => {
			const id = generateCandidateReplyId();

			// UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
			const uuidV4Regex =
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

			expect(id).toMatch(uuidV4Regex);
		});

		it("should generate unique IDs on multiple calls", () => {
			const ids = new Set<string>();
			const iterations = 100;

			for (let i = 0; i < iterations; i++) {
				ids.add(generateCandidateReplyId());
			}

			expect(ids.size).toBe(iterations);
		});
	});

	describe("createCandidateReply", () => {
		it("should create CandidateReply object with all required fields", () => {
			const params: CreateCandidateReplyParams = {
				commentInputId: "comment-123",
				accountId: "account-456",
				roleId: "role-789",
				workspaceId: "workspace-001",
				content: "This is a test reply",
				riskLevel: "low",
				confidence: 0.85,
				modelSource: "claude",
				knowledgeHits: 2,
				metadata: { test: true },
			};

			const reply = createCandidateReply(params);

			expect(reply.id).toBeDefined();
			expect(reply.commentInputId).toBe("comment-123");
			expect(reply.accountId).toBe("account-456");
			expect(reply.roleId).toBe("role-789");
			expect(reply.workspaceId).toBe("workspace-001");
			expect(reply.content).toBe("This is a test reply");
			expect(reply.riskLevel).toBe("low");
			expect(reply.confidence).toBe(0.85);
			expect(reply.modelSource).toBe("claude");
			expect(reply.knowledgeHits).toBe(2);
			expect(reply.generatedAt).toBeInstanceOf(Date);
			expect(reply.metadata).toEqual({ test: true });
		});

		it("should create CandidateReply without optional roleId", () => {
			const params: CreateCandidateReplyParams = {
				commentInputId: "comment-123",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Reply without role",
				riskLevel: "medium",
				confidence: 0.7,
				modelSource: "claude",
				knowledgeHits: 0,
			};

			const reply = createCandidateReply(params);

			expect(reply.roleId).toBeUndefined();
			expect(reply.content).toBe("Reply without role");
		});

		it("should generate unique ID for each created reply", () => {
			const params: CreateCandidateReplyParams = {
				commentInputId: "comment-123",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Test reply",
				riskLevel: "low",
				confidence: 0.8,
				modelSource: "claude",
				knowledgeHits: 1,
			};

			const reply1 = createCandidateReply(params);
			const reply2 = createCandidateReply(params);

			expect(reply1.id).not.toBe(reply2.id);
		});

		it("should set generatedAt to current time", () => {
			const before = new Date();

			const params: CreateCandidateReplyParams = {
				commentInputId: "comment-123",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Test reply",
				riskLevel: "low",
				confidence: 0.8,
				modelSource: "claude",
				knowledgeHits: 1,
			};

			const reply = createCandidateReply(params);
			const after = new Date();

			expect(reply.generatedAt.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(reply.generatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
		});

		it("should throw error when confidence is less than 0", () => {
			const params: CreateCandidateReplyParams = {
				commentInputId: "comment-123",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Test reply",
				riskLevel: "low",
				confidence: -0.1,
				modelSource: "claude",
				knowledgeHits: 1,
			};

			expect(() => createCandidateReply(params)).toThrow(
				"Confidence must be between 0 and 1, got -0.1",
			);
		});

		it("should throw error when confidence is greater than 1", () => {
			const params: CreateCandidateReplyParams = {
				commentInputId: "comment-123",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Test reply",
				riskLevel: "low",
				confidence: 1.5,
				modelSource: "claude",
				knowledgeHits: 1,
			};

			expect(() => createCandidateReply(params)).toThrow(
				"Confidence must be between 0 and 1, got 1.5",
			);
		});

		it("should accept confidence at boundary values 0 and 1", () => {
			const params0: CreateCandidateReplyParams = {
				commentInputId: "comment-123",
				accountId: "account-456",
				workspaceId: "workspace-001",
				content: "Test reply",
				riskLevel: "low",
				confidence: 0,
				modelSource: "claude",
				knowledgeHits: 1,
			};

			const params1: CreateCandidateReplyParams = {
				...params0,
				confidence: 1,
			};

			expect(() => createCandidateReply(params0)).not.toThrow();
			expect(() => createCandidateReply(params1)).not.toThrow();

			const reply0 = createCandidateReply(params0);
			const reply1 = createCandidateReply(params1);

			expect(reply0.confidence).toBe(0);
			expect(reply1.confidence).toBe(1);
		});
	});
});
