import { describe, expect, it } from "vitest";
import { createExecutionRequest } from "../../src/domain/executionRequest";
import { DuplicateExecutionProtector } from "../../src/domain/executionProtection";
import { createReplyTask } from "../../src/domain/replyTask";

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

function buildRequest(taskId: string, status: "pending" | "in_progress" | "completed" | "failed" | "cancelled") {
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
		status,
	};
}

describe("DuplicateExecutionProtector", () => {
	const protector = new DuplicateExecutionProtector();

	it("allows execution when the task has no prior requests", () => {
		expect(protector.check(buildTask(), [])).toEqual({ allowed: true });
	});

	it("blocks duplicate execution when an active request exists", () => {
		const task = buildTask();
		const request = buildRequest(task.id, "in_progress");

		expect(protector.check(task, [request])).toEqual({
			allowed: false,
			reason: "Task already has an active execution request (status: in_progress)",
			existingRequestId: request.id,
		});
	});

	it("allows retry when all previous requests are failed or cancelled", () => {
		const task = buildTask();

		expect(
			protector.check(task, [
				buildRequest(task.id, "failed"),
				buildRequest(task.id, "cancelled"),
			]),
		).toEqual({ allowed: true });
	});
});
