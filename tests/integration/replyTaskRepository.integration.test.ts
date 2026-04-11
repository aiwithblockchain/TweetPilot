import { describe, expect, it } from "vitest";
import { ReplyTaskDomainErrorCode } from "../../src/domain/errors";
import {
	appendReplyTaskEvent,
	createReplyTask,
	markReplyTaskStatus,
} from "../../src/domain/replyTask";
import { InMemoryReplyTaskRepository } from "../../src/data/repositories/InMemoryReplyTaskRepository";

describe("ReplyTask repository integration", () => {
	it("should persist task status, version and events across updates", async () => {
		const repository = new InMemoryReplyTaskRepository();
		const createdTask = createReplyTask({
			workspaceId: "workspace-001",
			accountId: "account-001",
			commentInputId: "comment-001",
			candidateReplyId: "candidate-001",
			riskLevel: "high",
			createdBy: "user-001",
		});

		await repository.save(createdTask);

		const pendingRouteTask = markReplyTaskStatus(createdTask, "pending_route");
		const withRouteEvent = appendReplyTaskEvent(pendingRouteTask, {
			type: "risk_routed",
			actorId: "system",
			payload: { route: "pending_review" },
		});

		await repository.save(withRouteEvent);

		const storedTask = await repository.findById(createdTask.id);
		const events = await repository.findEvents(createdTask.id);

		expect(storedTask).not.toBeNull();
		expect(storedTask?.status).toBe("pending_route");
		expect(storedTask?.version).toBe(2);
		expect(storedTask?.events).toHaveLength(2);
		expect(events.map((event) => event.type)).toEqual([
			"task_created",
			"risk_routed",
		]);
	});

	it("should reject stale task updates after a newer version is persisted", async () => {
		const repository = new InMemoryReplyTaskRepository();
		const createdTask = createReplyTask({
			workspaceId: "workspace-001",
			accountId: "account-001",
			commentInputId: "comment-001",
			candidateReplyId: "candidate-001",
			riskLevel: "high",
			createdBy: "user-001",
		});

		await repository.save(createdTask);

		const latestTask = appendReplyTaskEvent(createdTask, {
			type: "risk_routed",
			actorId: "system",
		});
		await repository.save(latestTask);

		const staleTask = markReplyTaskStatus(createdTask, "pending_route");

		await expect(repository.save(staleTask)).rejects.toMatchObject({
			code: ReplyTaskDomainErrorCode.OPTIMISTIC_LOCK_FAILED,
		});
	});
});
