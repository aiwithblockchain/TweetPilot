import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryCommentInputRepository } from "../../data/commentInputRepository";
import { createCandidateReply } from "../../domain/candidateReply";
import { createCommentInput } from "../../domain/commentInput";
import type { ExecutionChannel } from "../../domain/executionChannel";
import { createReplyTask } from "../../domain/replyTask";
import { ExecutionRequestBuilder } from "../executionRequestBuilder";

describe("ExecutionRequestBuilder", () => {
	let commentInputRepository: InMemoryCommentInputRepository;
	let builder: ExecutionRequestBuilder;

	beforeEach(() => {
		commentInputRepository = new InMemoryCommentInputRepository();
		builder = new ExecutionRequestBuilder(commentInputRepository);
	});

	function buildChannel(
		overrides: Partial<ExecutionChannel> = {},
	): ExecutionChannel {
		return {
			id: "channel-001",
			name: "Local Bridge",
			type: "local-bridge",
			accountId: "acc-001",
			status: "available",
			capabilities: ["reply"],
			metadata: undefined,
			...overrides,
		};
	}

	it("builds an execution request from task, reply, and comment input", async () => {
		const commentInput = createCommentInput({
			workspaceId: "ws-001",
			accountId: "acc-001",
			content: "What do you think?",
			targetTweetId: "tweet-123",
		});
		await commentInputRepository.save(commentInput);

		const candidateReply = createCandidateReply({
			commentInputId: commentInput.id,
			accountId: "acc-001",
			workspaceId: "ws-001",
			content: "I think this is solid.",
			riskLevel: "low",
			confidence: 0.9,
			modelSource: "test-model",
			knowledgeHits: 0,
		});
		const task = createReplyTask({
			workspaceId: "ws-001",
			accountId: "acc-001",
			commentInputId: commentInput.id,
			candidateReplyId: candidateReply.id,
			riskLevel: "low",
			createdBy: "user-001",
			roleId: "role-001",
		});

		const request = await builder.build({
			task,
			candidateReply,
			channel: buildChannel(),
		});

		expect(request.taskId).toBe(task.id);
		expect(request.channelId).toBe("channel-001");
		expect(request.payload).toEqual({
			commentInputId: commentInput.id,
			candidateReplyId: candidateReply.id,
			targetTweetId: "tweet-123",
			replyContent: "I think this is solid.",
			accountId: "acc-001",
			workspaceId: "ws-001",
			roleId: "role-001",
		});
	});

	it("rejects a channel bound to a different account", async () => {
		const commentInput = createCommentInput({
			workspaceId: "ws-001",
			accountId: "acc-001",
			content: "Question",
			targetTweetId: "tweet-123",
		});
		await commentInputRepository.save(commentInput);

		const candidateReply = createCandidateReply({
			commentInputId: commentInput.id,
			accountId: "acc-001",
			workspaceId: "ws-001",
			content: "Answer",
			riskLevel: "low",
			confidence: 0.8,
			modelSource: "test-model",
			knowledgeHits: 0,
		});
		const task = createReplyTask({
			workspaceId: "ws-001",
			accountId: "acc-001",
			commentInputId: commentInput.id,
			candidateReplyId: candidateReply.id,
			riskLevel: "low",
			createdBy: "user-001",
		});

		await expect(
			builder.build({
				task,
				candidateReply,
				channel: buildChannel({ accountId: "acc-999" }),
			}),
		).rejects.toThrow(/Channel accountId mismatch/);
	});

	it("rejects a channel without reply capability", async () => {
		const commentInput = createCommentInput({
			workspaceId: "ws-001",
			accountId: "acc-001",
			content: "Question",
			targetTweetId: "tweet-123",
		});
		await commentInputRepository.save(commentInput);

		const candidateReply = createCandidateReply({
			commentInputId: commentInput.id,
			accountId: "acc-001",
			workspaceId: "ws-001",
			content: "Answer",
			riskLevel: "low",
			confidence: 0.8,
			modelSource: "test-model",
			knowledgeHits: 0,
		});
		const task = createReplyTask({
			workspaceId: "ws-001",
			accountId: "acc-001",
			commentInputId: commentInput.id,
			candidateReplyId: candidateReply.id,
			riskLevel: "low",
			createdBy: "user-001",
		});

		await expect(
			builder.build({
				task,
				candidateReply,
				channel: buildChannel({ capabilities: ["monitor"] }),
			}),
		).rejects.toThrow(/does not support reply capability/);
	});

	it("rejects when comment input is missing", async () => {
		const candidateReply = createCandidateReply({
			commentInputId: "missing-comment",
			accountId: "acc-001",
			workspaceId: "ws-001",
			content: "Answer",
			riskLevel: "low",
			confidence: 0.8,
			modelSource: "test-model",
			knowledgeHits: 0,
		});
		const task = createReplyTask({
			workspaceId: "ws-001",
			accountId: "acc-001",
			commentInputId: "missing-comment",
			candidateReplyId: candidateReply.id,
			riskLevel: "low",
			createdBy: "user-001",
		});

		await expect(
			builder.build({
				task,
				candidateReply,
				channel: buildChannel(),
			}),
		).rejects.toThrow(/CommentInput missing-comment not found/);
	});

	it("rejects when target tweet id is missing on comment input", async () => {
		const commentInput = createCommentInput({
			workspaceId: "ws-001",
			accountId: "acc-001",
			content: "Question",
		});
		await commentInputRepository.save(commentInput);

		const candidateReply = createCandidateReply({
			commentInputId: commentInput.id,
			accountId: "acc-001",
			workspaceId: "ws-001",
			content: "Answer",
			riskLevel: "low",
			confidence: 0.8,
			modelSource: "test-model",
			knowledgeHits: 0,
		});
		const task = createReplyTask({
			workspaceId: "ws-001",
			accountId: "acc-001",
			commentInputId: commentInput.id,
			candidateReplyId: candidateReply.id,
			riskLevel: "low",
			createdBy: "user-001",
		});

		await expect(
			builder.build({
				task,
				candidateReply,
				channel: buildChannel(),
			}),
		).rejects.toThrow(/has no targetTweetId/);
	});
});
