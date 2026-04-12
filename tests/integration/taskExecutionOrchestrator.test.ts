import { describe, expect, it } from "vitest";
import { InMemoryCommentInputRepository } from "../../src/data/commentInputRepository";
import { InMemoryExecutionRequestRepository } from "../../src/data/executionRequestRepository";
import { InMemoryCandidateReplyRepository } from "../../src/data/repositories/InMemoryCandidateReplyRepository";
import { InMemoryReplyTaskRepository } from "../../src/data/repositories/InMemoryReplyTaskRepository";
import { createCandidateReply } from "../../src/domain/candidateReply";
import { createCommentInput } from "../../src/domain/commentInput";
import type { ExecutionChannel } from "../../src/domain/executionChannel";
import { createReplyTask } from "../../src/domain/replyTask";
import type { ITwitterReplyExecutor } from "../../src/domain/twitterReplyExecutor";
import { ExecutionEligibilityService } from "../../src/services/executionEligibilityService";
import { ExecutionPreparationService } from "../../src/services/executionPreparationService";
import { ExecutionRequestBuilder } from "../../src/services/executionRequestBuilder";
import { ExecutionService } from "../../src/services/executionService";
import { TaskExecutionOrchestrator } from "../../src/services/taskExecutionOrchestrator";
import { TaskExecutionResultWriter } from "../../src/services/taskExecutionResultWriter";

describe("taskExecutionOrchestrator integration", () => {
	it("executes a task end-to-end and writes back task events", async () => {
		const commentInputRepository = new InMemoryCommentInputRepository();
		const candidateReplyRepository = new InMemoryCandidateReplyRepository();
		const taskRepository = new InMemoryReplyTaskRepository();
		const requestRepository = new InMemoryExecutionRequestRepository();

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
			confidence: 0.88,
			modelSource: "claude",
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
		await taskRepository.save(task);

		const executor: ITwitterReplyExecutor = {
			type: "localbridge",
			isAvailable: async () => true,
			postReply: async () => ({
				success: true,
				replyTweetId: "tweet-999",
				rawResponse: { ok: true },
			}),
		};

		const channel: ExecutionChannel = {
			id: "ch-001",
			name: "Local Bridge",
			type: "local-bridge",
			accountId: "acc-001",
			status: "available",
			capabilities: ["reply"],
		};

		const builder = new ExecutionRequestBuilder(commentInputRepository);
		const preparationService = new ExecutionPreparationService(
			candidateReplyRepository,
			new ExecutionEligibilityService(),
			builder,
		);
		const service = new ExecutionService(requestRepository, executor);
		const writer = new TaskExecutionResultWriter(taskRepository, requestRepository);
		const orchestrator = new TaskExecutionOrchestrator(
			taskRepository,
			requestRepository,
			preparationService,
			service,
			writer,
			{
				getChannels: (accountId?: string) =>
					accountId === task.accountId ? [channel] : [],
				getChannel: (channelId: string) => (channelId === channel.id ? channel : null),
			},
		);

		const result = await orchestrator.executeTask({
			taskId: task.id,
			actorId: "executor-001",
		});
		expect(result.executionRequestId).toBeDefined();

		const storedRequest = await requestRepository.findById(
			result.executionRequestId!,
		);
		const storedTask = await taskRepository.findById(task.id);

		expect(result.success).toBe(true);
		expect(result.tweetId).toBe("tweet-999");
		expect(storedRequest?.status).toBe("completed");
		expect(storedRequest?.result?.tweetId).toBe("tweet-999");
		expect(storedTask?.events.at(-1)).toMatchObject({
			type: "task_completed",
			actorId: "executor-001",
			payload: expect.objectContaining({
				executionRequestId: result.executionRequestId,
			}),
		});
	});
});
