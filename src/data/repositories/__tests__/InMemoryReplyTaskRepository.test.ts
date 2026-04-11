import { beforeEach, describe, expect, it } from "vitest";
import {
	ReplyTaskDomainError,
	ReplyTaskDomainErrorCode,
} from "../../../domain/errors";
import {
	appendReplyTaskEvent,
	createReplyTask,
	markReplyTaskStatus,
} from "../../../domain/replyTask";
import { InMemoryReplyTaskRepository } from "../InMemoryReplyTaskRepository";

describe("InMemoryReplyTaskRepository", () => {
	let repository: InMemoryReplyTaskRepository;

	beforeEach(() => {
		repository = new InMemoryReplyTaskRepository();
	});

	it("should save and retrieve a task by id", async () => {
		const task = createReplyTask({
			workspaceId: "workspace-001",
			accountId: "account-001",
			commentInputId: "comment-001",
			candidateReplyId: "candidate-001",
			riskLevel: "medium",
			createdBy: "user-001",
		});

		await repository.save(task);

		expect(await repository.findById(task.id)).toEqual(task);
	});

	it("should find a task by candidate reply id", async () => {
		const task = createReplyTask({
			workspaceId: "workspace-001",
			accountId: "account-001",
			commentInputId: "comment-001",
			candidateReplyId: "candidate-lookup",
			riskLevel: "low",
			createdBy: "user-001",
		});

		await repository.save(task);

		expect(await repository.findByCandidateReplyId("candidate-lookup")).toEqual(
			task,
		);
	});

	it("should filter tasks by workspace and status", async () => {
		const task1 = createReplyTask({
			workspaceId: "workspace-001",
			accountId: "account-001",
			commentInputId: "comment-001",
			candidateReplyId: "candidate-001",
			riskLevel: "medium",
			createdBy: "user-001",
		});
		const task2 = createReplyTask({
			workspaceId: "workspace-001",
			accountId: "account-002",
			commentInputId: "comment-002",
			candidateReplyId: "candidate-002",
			riskLevel: "high",
			createdBy: "user-001",
		});
		const task3 = createReplyTask({
			workspaceId: "workspace-002",
			accountId: "account-003",
			commentInputId: "comment-003",
			candidateReplyId: "candidate-003",
			riskLevel: "low",
			createdBy: "user-001",
		});

		const pendingRouteTask1 = markReplyTaskStatus(task1, "pending_route");
		const pendingReviewTask1 = markReplyTaskStatus(
			pendingRouteTask1,
			"pending_review",
		);
		const pendingRouteTask2 = markReplyTaskStatus(task2, "pending_route");
		const pendingReviewTask2 = markReplyTaskStatus(
			pendingRouteTask2,
			"pending_review",
		);

		await repository.save(pendingReviewTask1);
		await repository.save(pendingReviewTask2);
		await repository.save(task3);

		expect(await repository.findByWorkspace("workspace-001")).toHaveLength(2);
		expect(await repository.findByStatus("pending_review")).toHaveLength(2);
	});

	it("should return pending review tasks only", async () => {
		const task = createReplyTask({
			workspaceId: "workspace-001",
			accountId: "account-001",
			commentInputId: "comment-001",
			candidateReplyId: "candidate-001",
			riskLevel: "high",
			createdBy: "user-001",
		});
		const pendingRouteTask = markReplyTaskStatus(task, "pending_route");
		const pendingReviewTask = markReplyTaskStatus(
			pendingRouteTask,
			"pending_review",
		);

		await repository.save(pendingReviewTask);

		const pendingTasks = await repository.findPendingReview();

		expect(pendingTasks).toHaveLength(1);
		expect(pendingTasks[0].status).toBe("pending_review");
	});

	it("should filter tasks by route", async () => {
		const pendingReviewTask = markReplyTaskStatus(
			markReplyTaskStatus(
				createReplyTask({
					workspaceId: "workspace-001",
					accountId: "account-001",
					commentInputId: "comment-001",
					candidateReplyId: "candidate-001",
					riskLevel: "high",
					createdBy: "user-001",
				}),
				"pending_route",
			),
			"pending_review",
			{ route: "pending_review" },
		);
		const readyTask = markReplyTaskStatus(
			markReplyTaskStatus(
				createReplyTask({
					workspaceId: "workspace-001",
					accountId: "account-001",
					commentInputId: "comment-002",
					candidateReplyId: "candidate-002",
					riskLevel: "low",
					createdBy: "user-001",
				}),
				"pending_route",
			),
			"ready_for_execution",
			{ route: "ready_for_execution" },
		);

		await repository.save(pendingReviewTask);
		await repository.save(readyTask);

		expect(await repository.findByRoute("pending_review")).toHaveLength(1);
		expect(await repository.findByRoute("ready_for_execution")).toHaveLength(1);
	});

	it("should return full event history for a task", async () => {
		const task = createReplyTask({
			workspaceId: "workspace-001",
			accountId: "account-001",
			commentInputId: "comment-001",
			candidateReplyId: "candidate-001",
			riskLevel: "high",
			createdBy: "user-001",
		});
		const updatedTask = appendReplyTaskEvent(task, {
			type: "review_requested",
			actorId: "system",
		});

		await repository.save(updatedTask);

		const events = await repository.findEvents(updatedTask.id);

		expect(events).toHaveLength(2);
		expect(events.map((event) => event.type)).toEqual([
			"task_created",
			"review_requested",
		]);
	});

	it("should increment version when saving an existing task", async () => {
		const task = createReplyTask({
			workspaceId: "workspace-001",
			accountId: "account-001",
			commentInputId: "comment-001",
			candidateReplyId: "candidate-001",
			riskLevel: "low",
			createdBy: "user-001",
		});

		await repository.save(task);
		const updatedTask = appendReplyTaskEvent(task, {
			type: "risk_routed",
			actorId: "system",
		});
		await repository.save(updatedTask);

		const storedTask = await repository.findById(task.id);

		expect(storedTask?.version).toBe(2);
		expect(storedTask?.events).toHaveLength(2);
	});

	it("should reject stale saves with optimistic lock error", async () => {
		const task = createReplyTask({
			workspaceId: "workspace-001",
			accountId: "account-001",
			commentInputId: "comment-001",
			candidateReplyId: "candidate-001",
			riskLevel: "low",
			createdBy: "user-001",
		});

		await repository.save(task);

		const firstUpdate = appendReplyTaskEvent(task, {
			type: "risk_routed",
			actorId: "system",
		});
		await repository.save(firstUpdate);

		const staleUpdate = appendReplyTaskEvent(task, {
			type: "review_requested",
			actorId: "system",
		});

		await expect(repository.save(staleUpdate)).rejects.toMatchObject({
			name: "ReplyTaskDomainError",
			code: ReplyTaskDomainErrorCode.OPTIMISTIC_LOCK_FAILED,
		} satisfies Partial<ReplyTaskDomainError>);
	});

	it("should clear all stored tasks", async () => {
		const task = createReplyTask({
			workspaceId: "workspace-001",
			accountId: "account-001",
			commentInputId: "comment-001",
			candidateReplyId: "candidate-001",
			riskLevel: "low",
			createdBy: "user-001",
		});

		await repository.save(task);
		repository.clear();

		expect(await repository.findById(task.id)).toBeNull();
		expect(await repository.findEvents(task.id)).toEqual([]);
	});
});
