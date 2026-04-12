import { describe, expect, it, vi } from "vitest";
import { InMemoryExecutionRequestRepository } from "../../src/data/executionRequestRepository";
import { createExecutionRequest } from "../../src/domain/executionRequest";
import { createReplyTask } from "../../src/domain/replyTask";
import { ExecutionCooldownChecker } from "../../src/domain/executionCooldown";
import { DuplicateExecutionProtector } from "../../src/domain/executionProtection";
import { ExecutionProtectionService } from "../../src/services/executionProtectionService";

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

function buildRequest(taskId: string, createdAt: string, status: "pending" | "completed" | "failed", channelId = "ch-001") {
	return {
		...createExecutionRequest({
			taskId,
			channelId,
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
		createdAt: new Date(createdAt),
		updatedAt: new Date(createdAt),
	};
}

describe("ExecutionProtectionService", () => {
	it("allows execution when duplicate and cooldown checks pass", async () => {
		const repository = new InMemoryExecutionRequestRepository();
		const service = new ExecutionProtectionService(
			repository,
			new DuplicateExecutionProtector(),
			new ExecutionCooldownChecker({ minIntervalMs: 1000 }),
		);

		await expect(
			service.checkProtection({ task: buildTask(), channelId: "ch-001" }),
		).resolves.toEqual({
			allowed: true,
			violations: [],
		});
	});

	it("blocks duplicate execution", async () => {
		const repository = new InMemoryExecutionRequestRepository();
		const task = buildTask();
		await repository.save(buildRequest(task.id, "2026-04-12T01:00:00.000Z", "pending"));
		const service = new ExecutionProtectionService(
			repository,
			new DuplicateExecutionProtector(),
			new ExecutionCooldownChecker({ minIntervalMs: 1000 }),
		);

		const result = await service.checkProtection({
			task,
			channelId: "ch-001",
		});

		expect(result.allowed).toBe(false);
		expect(result.violations[0]).toContain("active execution request");
	});

	it("blocks cooldown violations", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-12T01:00:05.000Z"));

		const repository = new InMemoryExecutionRequestRepository();
		const task = buildTask();
		await repository.save(buildRequest("task-other", "2026-04-12T01:00:02.000Z", "failed"));
		const service = new ExecutionProtectionService(
			repository,
			new DuplicateExecutionProtector(),
			new ExecutionCooldownChecker({ minIntervalMs: 5000 }),
		);

		const result = await service.checkProtection({
			task,
			channelId: "ch-001",
		});

		expect(result.allowed).toBe(false);
		expect(result.violations[0]).toContain("cooldown period");
		vi.useRealTimers();
	});

	it("aggregates multiple violations", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-12T01:00:05.000Z"));

		const repository = new InMemoryExecutionRequestRepository();
		const task = buildTask();
		await repository.save(buildRequest(task.id, "2026-04-12T01:00:04.000Z", "pending"));
		const service = new ExecutionProtectionService(
			repository,
			new DuplicateExecutionProtector(),
			new ExecutionCooldownChecker({ minIntervalMs: 5000 }),
		);

		const result = await service.checkProtection({
			task,
			channelId: "ch-001",
		});

		expect(result.allowed).toBe(false);
		expect(result.violations).toHaveLength(2);
		vi.useRealTimers();
	});
});
