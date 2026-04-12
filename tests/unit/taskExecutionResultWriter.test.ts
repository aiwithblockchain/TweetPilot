import { describe, expect, it } from "vitest";
import { InMemoryExecutionRequestRepository } from "../../src/data/executionRequestRepository";
import { InMemoryReplyTaskRepository } from "../../src/data/repositories/InMemoryReplyTaskRepository";
import { createExecutionRequest } from "../../src/domain/executionRequest";
import { createReplyTask } from "../../src/domain/replyTask";
import { TaskExecutionResultWriter } from "../../src/services/taskExecutionResultWriter";

function buildTask() {
	return createReplyTask({
		workspaceId: "ws-001",
		accountId: "acc-001",
		commentInputId: "comment-001",
		candidateReplyId: "candidate-001",
		riskLevel: "low",
		createdBy: "user-001",
	});
}

function buildRequest(taskId: string) {
	return createExecutionRequest({
		taskId,
		channelId: "ch-001",
		channelType: "local-bridge",
		actionType: "reply",
		payload: {
			commentInputId: "comment-001",
			candidateReplyId: "candidate-001",
			targetTweetId: "tweet-001",
			replyContent: "reply text",
			accountId: "acc-001",
			workspaceId: "ws-001",
		},
	});
}

describe("TaskExecutionResultWriter", () => {
	it("records a completion event for successful requests", async () => {
		const taskRepository = new InMemoryReplyTaskRepository();
		const requestRepository = new InMemoryExecutionRequestRepository();
		const task = buildTask();
		const request = {
			...buildRequest(task.id),
			status: "completed" as const,
			result: {
				success: true,
				tweetId: "tweet-999",
				executedAt: new Date("2026-04-11T00:00:00.000Z"),
			},
		};

		await taskRepository.save(task);
		await requestRepository.save(request);

		const writer = new TaskExecutionResultWriter(taskRepository, requestRepository);
		await writer.writeResult({
			taskId: task.id,
			requestId: request.id,
			actorId: "executor-001",
		});

		const stored = await taskRepository.findById(task.id);
		expect(stored?.events.at(-1)).toMatchObject({
			type: "task_completed",
			actorId: "executor-001",
			payload: expect.objectContaining({
				executionRequestId: request.id,
				tweetId: "tweet-999",
			}),
		});
	});

	it("skips failed requests and leaves failure handling to the failure handler", async () => {
		const taskRepository = new InMemoryReplyTaskRepository();
		const requestRepository = new InMemoryExecutionRequestRepository();
		const task = buildTask();
		const request = {
			...buildRequest(task.id),
			status: "failed" as const,
			error: {
				code: "RATE_LIMITED",
				message: "too many requests",
				retryable: true,
			},
		};

		await taskRepository.save(task);
		await requestRepository.save(request);

		const writer = new TaskExecutionResultWriter(taskRepository, requestRepository);
		await writer.writeResult({
			taskId: task.id,
			requestId: request.id,
			actorId: "executor-001",
		});

		const stored = await taskRepository.findById(task.id);
		expect(stored?.events).toHaveLength(1);
	});

	it("rejects mismatched task and request associations", async () => {
		const taskRepository = new InMemoryReplyTaskRepository();
		const requestRepository = new InMemoryExecutionRequestRepository();
		const task = buildTask();
		const otherTask = {
			...buildTask(),
			id: "task-other",
		};
		const request = buildRequest(otherTask.id);

		await taskRepository.save(task);
		await requestRepository.save(request);

		const writer = new TaskExecutionResultWriter(taskRepository, requestRepository);
		await expect(
			writer.writeResult({
				taskId: task.id,
				requestId: request.id,
				actorId: "executor-001",
			}),
		).rejects.toThrow(/does not belong to task/);
	});
});
