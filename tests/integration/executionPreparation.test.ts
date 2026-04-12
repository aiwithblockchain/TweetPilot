import { describe, expect, it } from "vitest";
import { InMemoryCommentInputRepository } from "../../src/data/commentInputRepository";
import { InMemoryCandidateReplyRepository } from "../../src/data/repositories/InMemoryCandidateReplyRepository";
import { createCandidateReply } from "../../src/domain/candidateReply";
import { createCommentInput } from "../../src/domain/commentInput";
import type { ExecutionChannel } from "../../src/domain/executionChannel";
import { createReplyTask } from "../../src/domain/replyTask";
import { ExecutionEligibilityService } from "../../src/services/executionEligibilityService";
import { ExecutionPreparationService } from "../../src/services/executionPreparationService";
import { ExecutionRequestBuilder } from "../../src/services/executionRequestBuilder";

describe("executionPreparation integration", () => {
	it("builds an executable request from real task, reply, and channel inputs", async () => {
		const commentInputRepository = new InMemoryCommentInputRepository();
		const candidateReplyRepository = new InMemoryCandidateReplyRepository();
		const service = new ExecutionPreparationService(
			candidateReplyRepository,
			new ExecutionEligibilityService(),
			new ExecutionRequestBuilder(commentInputRepository),
		);

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
			content: "Answer from integration",
			riskLevel: "low",
			confidence: 0.92,
			modelSource: "test-model",
			knowledgeHits: 0,
		});
		await candidateReplyRepository.save(candidateReply);

		const task = createReplyTask({
			workspaceId: "ws-001",
			accountId: "acc-001",
			commentInputId: commentInput.id,
			candidateReplyId: candidateReply.id,
			riskLevel: "low",
			createdBy: "user-001",
			status: "ready_for_execution",
			route: "ready_for_execution",
		});

		const availableChannels: ExecutionChannel[] = [
			{
				id: "ch-x-api",
				name: "Official API",
				type: "x-api",
				accountId: "acc-001",
				status: "available",
				capabilities: ["reply"],
			},
			{
				id: "ch-local",
				name: "Local Bridge",
				type: "local-bridge",
				accountId: "acc-001",
				status: "available",
				capabilities: ["reply"],
			},
		];

		const result = await service.prepare({
			task,
			availableChannels,
		});

		expect(result.ready).toBe(true);
		expect(result.request?.channelId).toBe("ch-local");
		expect(result.request?.channelType).toBe("local-bridge");
		expect(result.request?.payload).toMatchObject({
			accountId: "acc-001",
			workspaceId: "ws-001",
			targetTweetId: "tweet-123",
			replyContent: "Answer from integration",
		});
	});

	it("returns slice-5 routing errors when no local-bridge channel is available", async () => {
		const commentInputRepository = new InMemoryCommentInputRepository();
		const candidateReplyRepository = new InMemoryCandidateReplyRepository();
		const service = new ExecutionPreparationService(
			candidateReplyRepository,
			new ExecutionEligibilityService(),
			new ExecutionRequestBuilder(commentInputRepository),
		);

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
			confidence: 0.92,
			modelSource: "test-model",
			knowledgeHits: 0,
		});
		await candidateReplyRepository.save(candidateReply);

		const task = createReplyTask({
			workspaceId: "ws-001",
			accountId: "acc-001",
			commentInputId: commentInput.id,
			candidateReplyId: candidateReply.id,
			riskLevel: "low",
			createdBy: "user-001",
			status: "ready_for_execution",
			route: "ready_for_execution",
		});

		const result = await service.prepare({
			task,
			availableChannels: [
				{
					id: "ch-x-mcp",
					name: "Official MCP",
					type: "x-mcp",
					accountId: "acc-001",
					status: "available",
					capabilities: ["reply"],
				},
			],
		});

		expect(result).toEqual({
			ready: false,
			error: {
				code: "NOT_EXECUTABLE_IN_SLICE5",
				message:
					"No local-bridge channel available for account acc-001. Official channels (x-api/x-mcp) are reserved for Slice 7.",
			},
		});
	});
});
