import { describe, expect, it } from "vitest";
import { InMemoryExecutionRequestRepository } from "../../src/data/executionRequestRepository";
import { createExecutionRequest } from "../../src/domain/executionRequest";
import type { ITwitterReplyExecutor } from "../../src/domain/twitterReplyExecutor";
import { ExecutionService } from "../../src/services/executionService";

function buildRequest() {
	return createExecutionRequest({
		taskId: "task-001",
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
			roleId: "role-001",
		},
	});
}

describe("ExecutionService", () => {
	it("executes a pending request and stores success result", async () => {
		const repository = new InMemoryExecutionRequestRepository();
		const request = buildRequest();
		await repository.save(request);

		const executor: ITwitterReplyExecutor = {
			type: "localbridge",
			isAvailable: async () => true,
			postReply: async () => ({
				success: true,
				replyTweetId: "tweet-999",
				rawResponse: { ok: true },
			}),
		};

		const service = new ExecutionService(repository, executor);
		const result = await service.execute({ requestId: request.id });
		const stored = await repository.findById(request.id);

		expect(result.success).toBe(true);
		expect(result.result?.tweetId).toBe("tweet-999");
		expect(stored?.status).toBe("completed");
		expect(stored?.result?.tweetId).toBe("tweet-999");
	});

	it("stores failure result when executor fails", async () => {
		const repository = new InMemoryExecutionRequestRepository();
		const request = buildRequest();
		await repository.save(request);

		const executor: ITwitterReplyExecutor = {
			type: "localbridge",
			isAvailable: async () => true,
			postReply: async () => ({
				success: false,
				code: "RATE_LIMITED",
				message: "too many requests",
				retryable: true,
			}),
		};

		const service = new ExecutionService(repository, executor);
		const result = await service.execute({ requestId: request.id });
		const stored = await repository.findById(request.id);

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("RATE_LIMITED");
		expect(stored?.status).toBe("failed");
		expect(stored?.error?.code).toBe("RATE_LIMITED");
	});

	it("converts thrown executor errors into failed execution requests", async () => {
		const repository = new InMemoryExecutionRequestRepository();
		const request = buildRequest();
		await repository.save(request);

		const executor: ITwitterReplyExecutor = {
			type: "localbridge",
			isAvailable: async () => true,
			postReply: async () => {
				throw new Error("connection dropped");
			},
		};

		const service = new ExecutionService(repository, executor);
		const result = await service.execute({ requestId: request.id });
		const stored = await repository.findById(request.id);

		expect(result.success).toBe(false);
		expect(result.error?.code).toBe("EXECUTION_EXCEPTION");
		expect(stored?.status).toBe("failed");
		expect(stored?.error?.message).toBe("connection dropped");
	});

	it("returns existing result for completed requests", async () => {
		const repository = new InMemoryExecutionRequestRepository();
		const request = {
			...buildRequest(),
			status: "completed" as const,
			result: {
				success: true,
				tweetId: "tweet-existing",
				executedAt: new Date("2026-04-11T00:00:00.000Z"),
			},
		};
		await repository.save(request);

		const executor: ITwitterReplyExecutor = {
			type: "localbridge",
			isAvailable: async () => true,
			postReply: async () => {
				throw new Error("should not execute");
			},
		};

		const service = new ExecutionService(repository, executor);
		await expect(service.execute({ requestId: request.id })).resolves.toMatchObject({
			success: true,
			result: {
				tweetId: "tweet-existing",
			},
		});
	});

	it("rejects non-pending in-progress requests", async () => {
		const repository = new InMemoryExecutionRequestRepository();
		const request = {
			...buildRequest(),
			status: "in_progress" as const,
		};
		await repository.save(request);

		const executor: ITwitterReplyExecutor = {
			type: "localbridge",
			isAvailable: async () => true,
			postReply: async () => ({
				success: true,
				replyTweetId: "tweet-999",
			}),
		};

		const service = new ExecutionService(repository, executor);
		await expect(service.execute({ requestId: request.id })).rejects.toThrow(
			/not in pending status/,
		);
	});
});
