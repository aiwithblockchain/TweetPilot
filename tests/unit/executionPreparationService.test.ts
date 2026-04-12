import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryCommentInputRepository } from "../../src/data/commentInputRepository";
import { InMemoryCandidateReplyRepository } from "../../src/data/repositories/InMemoryCandidateReplyRepository";
import { createCandidateReply } from "../../src/domain/candidateReply";
import { createCommentInput } from "../../src/domain/commentInput";
import type { ExecutionChannel } from "../../src/domain/executionChannel";
import { createReplyTask } from "../../src/domain/replyTask";
import { ExecutionEligibilityService } from "../../src/services/executionEligibilityService";
import { ExecutionPreparationService } from "../../src/services/executionPreparationService";
import { ExecutionRequestBuilder } from "../../src/services/executionRequestBuilder";

describe("ExecutionPreparationService", () => {
	let commentInputRepository: InMemoryCommentInputRepository;
	let candidateReplyRepository: InMemoryCandidateReplyRepository;
	let service: ExecutionPreparationService;
	let channel: ExecutionChannel;

	beforeEach(() => {
		commentInputRepository = new InMemoryCommentInputRepository();
		candidateReplyRepository = new InMemoryCandidateReplyRepository();
		service = new ExecutionPreparationService(
			candidateReplyRepository,
			new ExecutionEligibilityService(),
			new ExecutionRequestBuilder(commentInputRepository),
		);
		channel = {
			id: "ch-001",
			name: "Local Bridge",
			type: "local-bridge",
			accountId: "acc-001",
			status: "available",
			capabilities: ["reply"],
		};
	});

	async function seedReadyTask() {
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
			confidence: 0.9,
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

		return { task, commentInput };
	}

	it("prepares an execution request when task and channel are valid", async () => {
		const { task, commentInput } = await seedReadyTask();

		const result = await service.prepare({
			task,
			availableChannels: [channel],
		});

		expect(result.ready).toBe(true);
		expect(result.request).toMatchObject({
			taskId: task.id,
			channelId: channel.id,
			channelType: "local-bridge",
			payload: {
				commentInputId: commentInput.id,
				targetTweetId: "tweet-123",
				replyContent: "Answer",
			},
		});
	});

	it("returns eligibility errors before reading candidate reply", async () => {
		const { task } = await seedReadyTask();

		const result = await service.prepare({
			task: { ...task, status: "pending_review" },
			availableChannels: [channel],
		});

		expect(result).toEqual({
			ready: false,
			error: {
				code: "INVALID_STATUS",
				message: "Task status is pending_review, expected ready_for_execution",
			},
		});
	});

	it("returns an error when the candidate reply is missing", async () => {
		const { task } = await seedReadyTask();
		await candidateReplyRepository.delete(task.candidateReplyId);

		const result = await service.prepare({
			task,
			availableChannels: [channel],
		});

		expect(result).toEqual({
			ready: false,
			error: {
				code: "CANDIDATE_REPLY_NOT_FOUND",
				message: `CandidateReply ${task.candidateReplyId} not found`,
			},
		});
	});

	it("returns routing errors when no available channel exists", async () => {
		const { task } = await seedReadyTask();

		const result = await service.prepare({
			task,
			availableChannels: [],
		});

		expect(result).toEqual({
			ready: false,
			error: {
				code: "NO_AVAILABLE_CHANNELS",
				message: "No available channels for account acc-001",
			},
		});
	});

	it("returns request build failures", async () => {
		const { task, commentInput } = await seedReadyTask();
		await commentInputRepository.save({
			...commentInput,
			targetTweetId: undefined,
		});

		const result = await service.prepare({
			task,
			availableChannels: [channel],
		});

		expect(result).toEqual({
			ready: false,
			error: {
				code: "REQUEST_BUILD_FAILED",
				message: `CommentInput ${commentInput.id} has no targetTweetId`,
			},
		});
	});
});
