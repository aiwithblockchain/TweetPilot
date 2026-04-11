import { beforeEach, describe, expect, it } from "vitest";
import { createReplyTask } from "../../src/domain/replyTask";
import { InMemoryReplyTaskRepository } from "../../src/data/repositories/InMemoryReplyTaskRepository";
import {
	TaskRoutingError,
	TaskRoutingErrorCode,
	createTaskRoutingService,
} from "../../src/services/taskRoutingService";

describe("taskRoutingService", () => {
	let repository: InMemoryReplyTaskRepository;

	beforeEach(() => {
		repository = new InMemoryReplyTaskRepository();
	});

	it("should route low risk task to ready_for_execution", async () => {
		const task = {
			...createReplyTask({
				workspaceId: "workspace-001",
				accountId: "account-001",
				commentInputId: "comment-001",
				candidateReplyId: "candidate-001",
				riskLevel: "low",
				createdBy: "user-001",
			}),
			status: "pending_route" as const,
		};
		await repository.save(task);
		const service = createTaskRoutingService({
			replyTaskRepository: repository,
		});

		const decision = await service.routeTask(task.id, "router");
		const storedTask = await repository.findById(task.id);

		expect(decision).toMatchObject({
			taskId: task.id,
			riskLevel: "low",
			route: "ready_for_execution",
		});
		expect(storedTask?.status).toBe("ready_for_execution");
		expect(storedTask?.route).toBe("ready_for_execution");
		expect(storedTask?.events.at(-1)).toMatchObject({
			type: "risk_routed",
			actorId: "router",
		});
	});

	it("should route medium and high risk tasks to pending_review", async () => {
		const mediumTask = {
			...createReplyTask({
				workspaceId: "workspace-001",
				accountId: "account-001",
				commentInputId: "comment-001",
				candidateReplyId: "candidate-medium",
				riskLevel: "medium",
				createdBy: "user-001",
			}),
			status: "pending_route" as const,
		};
		const highTask = {
			...createReplyTask({
				workspaceId: "workspace-001",
				accountId: "account-001",
				commentInputId: "comment-002",
				candidateReplyId: "candidate-high",
				riskLevel: "high",
				createdBy: "user-001",
			}),
			status: "pending_route" as const,
		};
		await repository.save(mediumTask);
		await repository.save(highTask);
		const service = createTaskRoutingService({
			replyTaskRepository: repository,
		});

		await service.routeTask(mediumTask.id, "router");
		await service.routeTask(highTask.id, "router");

		expect((await repository.findById(mediumTask.id))?.status).toBe(
			"pending_review",
		);
		expect((await repository.findById(highTask.id))?.status).toBe(
			"pending_review",
		);
	});

	it("should throw TASK_ROUTE_NOT_FOUND when task is missing", async () => {
		const service = createTaskRoutingService({
			replyTaskRepository: repository,
		});

		await expect(service.routeTask("missing-task", "router")).rejects.toMatchObject(
			{
				name: "TaskRoutingError",
				code: TaskRoutingErrorCode.TASK_ROUTE_NOT_FOUND,
			} satisfies Partial<TaskRoutingError>,
		);
	});

	it("should apply fallback and throw TASK_ROUTE_FALLBACK_APPLIED when rule is missing", async () => {
		const task = {
			...createReplyTask({
				workspaceId: "workspace-001",
				accountId: "account-001",
				commentInputId: "comment-001",
				candidateReplyId: "candidate-001",
				riskLevel: "low",
				createdBy: "user-001",
			}),
			status: "pending_route" as const,
		};
		await repository.save(task);
		const service = createTaskRoutingService({
			replyTaskRepository: repository,
			rules: {
				low: undefined,
			},
		});

		await expect(service.routeTask(task.id, "router")).rejects.toMatchObject({
			code: TaskRoutingErrorCode.TASK_ROUTE_RULE_MISSING,
		});
		expect((await repository.findById(task.id))?.status).toBe("pending_review");
		expect((await repository.findById(task.id))?.events.at(-1)).toMatchObject({
			type: "risk_routed",
			payload: {
				fallbackApplied: true,
				errorCode: TaskRoutingErrorCode.TASK_ROUTE_RULE_MISSING,
			},
		});
	});

	it("should apply fallback and throw TASK_ROUTE_FALLBACK_APPLIED when rule config is invalid", async () => {
		const task = {
			...createReplyTask({
				workspaceId: "workspace-001",
				accountId: "account-001",
				commentInputId: "comment-001",
				candidateReplyId: "candidate-001",
				riskLevel: "low",
				createdBy: "user-001",
			}),
			status: "pending_route" as const,
		};
		await repository.save(task);
		const service = createTaskRoutingService({
			replyTaskRepository: repository,
			rules: {
				low: {
					riskLevel: "low",
					defaultRoute: "invalid-route" as unknown as "pending_review",
					fallbackRoute: "pending_review",
				},
			},
		});

		await expect(service.routeTask(task.id, "router")).rejects.toMatchObject({
			code: TaskRoutingErrorCode.TASK_ROUTE_FALLBACK_APPLIED,
		});
		expect((await repository.findById(task.id))?.status).toBe("pending_review");
	});
});
