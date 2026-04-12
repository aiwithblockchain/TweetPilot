import { describe, expect, it } from "vitest";
import { createExecutionRequest } from "../../src/domain/executionRequest";
import { createReplyTask } from "../../src/domain/replyTask";
import { InMemoryReplyTaskRepository } from "../../src/data/repositories/InMemoryReplyTaskRepository";
import { ExecutionFailureHandler } from "../../src/services/executionFailureHandler";

function buildTask() {
	return createReplyTask({
		workspaceId: "ws-001",
		accountId: "acc-001",
		commentInputId: "ci-001",
		candidateReplyId: "cr-001",
		riskLevel: "low",
		createdBy: "user-001",
		status: "ready_for_execution",
		route: "ready_for_execution",
	});
}

function buildRequest(taskId: string) {
	return {
		...createExecutionRequest({
			taskId,
			channelId: "ch-001",
			channelType: "local-bridge",
			actionType: "reply",
			payload: {
				commentInputId: "ci-001",
				candidateReplyId: "cr-001",
				targetTweetId: "tweet-001",
				replyContent: "reply",
				accountId: "acc-001",
				workspaceId: "ws-001",
			},
		}),
		status: "failed" as const,
	};
}

describe("ExecutionFailureHandler", () => {
	it("moves manual-intervention failures into takeover", async () => {
		const repository = new InMemoryReplyTaskRepository();
		const task = buildTask();
		await repository.save(task);

		const handler = new ExecutionFailureHandler(repository);
		await handler.handle({
			taskId: task.id,
			request: buildRequest(task.id),
			error: {
				code: "RATE_LIMITED",
				message: "too many requests",
				retryable: true,
			},
			actorId: "executor-001",
		});

		const stored = await repository.findById(task.id);
		expect(stored?.status).toBe("in_takeover");
		expect(stored?.events.at(-1)).toMatchObject({
			type: "task_failed",
			actorId: "executor-001",
			payload: expect.objectContaining({
				errorCode: "RATE_LIMITED",
				requiresManualIntervention: true,
			}),
		});
	});

	it("keeps retryable failures in ready_for_execution", async () => {
		const repository = new InMemoryReplyTaskRepository();
		const task = buildTask();
		await repository.save(task);

		const handler = new ExecutionFailureHandler(repository);
		await handler.handle({
			taskId: task.id,
			request: buildRequest(task.id),
			error: {
				code: "NETWORK_ERROR",
				message: "temporary failure",
				retryable: true,
			},
			actorId: "executor-001",
		});

		const stored = await repository.findById(task.id);
		expect(stored?.status).toBe("ready_for_execution");
		expect(stored?.events.at(-1)?.payload).toMatchObject({
			retryable: true,
			requiresManualIntervention: false,
		});
	});

	it("rejects non-retryable failures", async () => {
		const repository = new InMemoryReplyTaskRepository();
		const task = buildTask();
		await repository.save(task);

		const handler = new ExecutionFailureHandler(repository);
		await handler.handle({
			taskId: task.id,
			request: buildRequest(task.id),
			error: {
				code: "CONTENT_INVALID",
				message: "cannot send",
				retryable: false,
			},
			actorId: "executor-001",
		});

		const stored = await repository.findById(task.id);
		expect(stored?.status).toBe("rejected");
	});

	it("is idempotent for the same failed request", async () => {
		const repository = new InMemoryReplyTaskRepository();
		const task = buildTask();
		const request = buildRequest(task.id);
		await repository.save(task);

		const handler = new ExecutionFailureHandler(repository);
		await handler.handle({
			taskId: task.id,
			request,
			error: {
				code: "RATE_LIMITED",
				message: "too many requests",
				retryable: true,
			},
			actorId: "executor-001",
		});
		await handler.handle({
			taskId: task.id,
			request,
			error: {
				code: "RATE_LIMITED",
				message: "too many requests",
				retryable: true,
			},
			actorId: "executor-001",
		});

		const stored = await repository.findById(task.id);
		const matchingEvents =
			stored?.events.filter(
				(event) => event.payload?.executionRequestId === request.id,
			) ?? [];

		expect(matchingEvents).toHaveLength(1);
	});
});
