import { describe, expect, it } from "vitest";
import { InMemoryCommentInputRepository } from "../../src/data/commentInputRepository";
import { createCandidateReply } from "../../src/domain/candidateReply";
import { createCommentInput } from "../../src/domain/commentInput";
import type { ExecutionChannel } from "../../src/domain/executionChannel";
import { createReplyTask } from "../../src/domain/replyTask";
import { ExecutionRequestBuilder } from "../../src/services/executionRequestBuilder";

function buildExecutionChannel(
	overrides: Partial<ExecutionChannel> = {},
): ExecutionChannel {
	return {
		id: "ch-001",
		name: "Local Bridge",
		type: "local-bridge",
		accountId: "acc-001",
		status: "available",
		capabilities: ["reply"],
		metadata: {
			source: "integration-test",
		},
		...overrides,
	};
}

describe("executionRequestBuilder integration", () => {
	it("constructs an execution request from real task, reply, and channel objects", async () => {
		const commentInputRepository = new InMemoryCommentInputRepository();
		const builder = new ExecutionRequestBuilder(commentInputRepository);

		const commentInput = createCommentInput({
			workspaceId: "ws-001",
			accountId: "acc-001",
			content: "Can you reply to this?",
			targetTweetId: "tweet-123",
			targetTweetUrl: "https://x.com/example/status/123",
		});
		await commentInputRepository.save(commentInput);

		const candidateReply = createCandidateReply({
			commentInputId: commentInput.id,
			accountId: "acc-001",
			roleId: "role-001",
			workspaceId: "ws-001",
			content: "Absolutely, here's a thoughtful reply.",
			riskLevel: "low",
			confidence: 0.91,
			modelSource: "claude",
			knowledgeHits: 2,
		});

		const task = createReplyTask({
			workspaceId: "ws-001",
			accountId: "acc-001",
			commentInputId: commentInput.id,
			candidateReplyId: candidateReply.id,
			roleId: "role-001",
			riskLevel: "low",
			createdBy: "user-001",
		});

		const request = await builder.build({
			task,
			candidateReply,
			channel: buildExecutionChannel(),
		});

		expect(request.actionType).toBe("reply");
		expect(request.channelId).toBe("ch-001");
		expect(request.channelType).toBe("local-bridge");
		expect(request.status).toBe("pending");
		expect(request.payload).toEqual({
			commentInputId: commentInput.id,
			candidateReplyId: candidateReply.id,
			targetTweetId: commentInput.targetTweetId,
			replyContent: candidateReply.content,
			accountId: task.accountId,
			workspaceId: task.workspaceId,
			roleId: task.roleId,
		});
	});

	it("preserves the documented field source chain", async () => {
		const commentInputRepository = new InMemoryCommentInputRepository();
		const builder = new ExecutionRequestBuilder(commentInputRepository);

		const commentInput = createCommentInput({
			workspaceId: "ws-field-chain",
			accountId: "acc-field-chain",
			content: "Original comment content",
			targetTweetId: "tweet-source-of-truth",
		});
		await commentInputRepository.save(commentInput);

		const candidateReply = createCandidateReply({
			commentInputId: commentInput.id,
			accountId: "acc-field-chain",
			workspaceId: "ws-field-chain",
			content: "Reply content source of truth",
			riskLevel: "medium",
			confidence: 0.82,
			modelSource: "claude",
			knowledgeHits: 1,
		});

		const task = createReplyTask({
			workspaceId: "ws-field-chain",
			accountId: "acc-field-chain",
			commentInputId: commentInput.id,
			candidateReplyId: candidateReply.id,
			riskLevel: "medium",
			createdBy: "user-002",
		});

		const request = await builder.build({
			task,
			candidateReply,
			channel: buildExecutionChannel({
				id: "ch-field-chain",
				accountId: "acc-field-chain",
			}),
		});

		expect(request.payload.targetTweetId).toBe(commentInput.targetTweetId);
		expect(request.payload.replyContent).toBe(candidateReply.content);
		expect(request.payload.accountId).toBe(task.accountId);
		expect(request.payload.workspaceId).toBe(task.workspaceId);
		expect(request.payload.roleId).toBe(task.roleId);
		expect(request.payload.commentInputId).toBe(commentInput.id);
		expect(request.payload.candidateReplyId).toBe(candidateReply.id);
	});
});
