import { describe, expect, it, vi } from "vitest";
import { createExecutionRequest } from "../../src/domain/executionRequest";
import { ExecutionCooldownChecker } from "../../src/domain/executionCooldown";

function buildRequest(createdAt: string, overrides?: { accountId?: string; channelId?: string }) {
	return {
		...createExecutionRequest({
			taskId: `task-${createdAt}`,
			channelId: overrides?.channelId ?? "ch-001",
			channelType: "local-bridge",
			actionType: "reply",
			payload: {
				commentInputId: "ci-001",
				candidateReplyId: "cr-001",
				targetTweetId: "tweet-001",
				replyContent: "reply",
				accountId: overrides?.accountId ?? "acc-001",
				workspaceId: "ws-001",
			},
		}),
		createdAt: new Date(createdAt),
		updatedAt: new Date(createdAt),
	};
}

describe("ExecutionCooldownChecker", () => {
	it("allows execution when there are no recent requests", () => {
		const checker = new ExecutionCooldownChecker({ minIntervalMs: 5000 });

		expect(checker.check("acc-001", "ch-001", [])).toEqual({ allowed: true });
	});

	it("blocks execution when the latest request is within cooldown", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-12T01:00:05.000Z"));

		const checker = new ExecutionCooldownChecker({ minIntervalMs: 5000 });
		const result = checker.check("acc-001", "ch-001", [
			buildRequest("2026-04-12T01:00:02.000Z"),
		]);

		expect(result.allowed).toBe(false);
		expect(result.reason).toContain("cooldown period");
		expect(result.cooldownUntil).toEqual(new Date("2026-04-12T01:00:07.000Z"));

		vi.useRealTimers();
	});

	it("allows execution after cooldown expires", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-12T01:00:10.000Z"));

		const checker = new ExecutionCooldownChecker({ minIntervalMs: 5000 });
		expect(
			checker.check("acc-001", "ch-001", [
				buildRequest("2026-04-12T01:00:02.000Z"),
			]),
		).toEqual({ allowed: true });

		vi.useRealTimers();
	});
});
