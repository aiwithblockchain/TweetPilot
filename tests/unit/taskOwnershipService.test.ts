import { beforeEach, describe, expect, it } from "vitest";
import { createReplyTask } from "../../src/domain/replyTask";
import {
	ReplyTaskDomainError,
	ReplyTaskDomainErrorCode,
} from "../../src/domain/errors";
import { InMemoryReplyTaskRepository } from "../../src/data/repositories/InMemoryReplyTaskRepository";
import {
	TaskOwnershipError,
	TaskOwnershipErrorCode,
	createTaskOwnershipService,
} from "../../src/services/taskOwnershipService";

describe("taskOwnershipService", () => {
	let replyTaskRepository: InMemoryReplyTaskRepository;
	let service: ReturnType<typeof createTaskOwnershipService>;

	beforeEach(() => {
		replyTaskRepository = new InMemoryReplyTaskRepository();
		service = createTaskOwnershipService({
			replyTaskRepository,
		});
	});

	it("should assign pending review task without removing it from review flow", async () => {
		const task = await seedTask("pending_review");

		const assignedTask = await service.assignTask(
			task.id,
			"owner-001",
			"owner-001",
		);

		expect(assignedTask.status).toBe("pending_review");
		expect(assignedTask.assigneeId).toBe("owner-001");
		expect(assignedTask.events.at(-1)).toMatchObject({
			type: "task_assigned",
			actorId: "owner-001",
			payload: {
				assigneeId: "owner-001",
			},
		});
	});

	it("should move ready_for_execution task into assigned when ownership is set", async () => {
		const task = await seedTask("ready_for_execution");

		const assignedTask = await service.assignTask(
			task.id,
			"owner-001",
			"owner-001",
		);

		expect(assignedTask.status).toBe("assigned");
		expect(assignedTask.assigneeId).toBe("owner-001");
	});

	it("should deny unauthorized assignment", async () => {
		const task = await seedTask("pending_review");

		await expect(
			service.assignTask(task.id, "owner-001", "random-user"),
		).rejects.toMatchObject({
			name: "TaskOwnershipError",
			code: TaskOwnershipErrorCode.TASK_ASSIGNMENT_PERMISSION_DENIED,
		} satisfies Partial<TaskOwnershipError>);
	});

	it("should require force for re-assignment", async () => {
		const assignedTask = await seedTask("assigned", {
			assigneeId: "owner-001",
		});

		await expect(
			service.assignTask(assignedTask.id, "owner-002", "owner-001"),
		).rejects.toMatchObject({
			code: TaskOwnershipErrorCode.TASK_ASSIGNMENT_PERMISSION_DENIED,
		});

		const reassignedTask = await service.assignTask(
			assignedTask.id,
			"owner-002",
			"owner-001",
			{
				force: true,
			},
		);

		expect(reassignedTask.status).toBe("assigned");
		expect(reassignedTask.assigneeId).toBe("owner-002");
	});

	it("should move assigned task into in_takeover", async () => {
		const task = await seedTask("assigned", {
			assigneeId: "owner-001",
		});

		const takenOverTask = await service.takeOverTask(
			task.id,
			"owner-001",
			"Need manual intervention",
			{
				expectedVersion: task.version,
			},
		);

		expect(takenOverTask.status).toBe("in_takeover");
		expect(takenOverTask.takenOverBy).toBe("owner-001");
		expect(takenOverTask.events.at(-1)).toMatchObject({
			type: "task_taken_over",
			actorId: "owner-001",
			payload: {
				action: "take_over",
				note: "Need manual intervention",
				expectedVersion: task.version,
			},
		});
	});

	it("should reject takeover on version mismatch", async () => {
		const task = await seedTask("assigned", {
			assigneeId: "owner-001",
		});

		await expect(
			service.takeOverTask(task.id, "owner-001", undefined, {
				expectedVersion: task.version + 1,
			}),
		).rejects.toMatchObject({
			name: "TaskOwnershipError",
			code: TaskOwnershipErrorCode.TASK_TAKEOVER_CONFLICT,
		} satisfies Partial<TaskOwnershipError>);
	});

	it("should complete takeover with allowed result statuses only", async () => {
		const task = await seedTask("in_takeover", {
			assigneeId: "owner-001",
			takenOverBy: "owner-001",
		});

		const completedTask = await service.completeTakeover(
			task.id,
			"owner-001",
			"completed",
			"Done",
		);

		expect(completedTask.status).toBe("completed");
		expect(completedTask.events.at(-1)).toMatchObject({
			type: "task_taken_over",
			payload: {
				action: "complete_takeover",
				result: "completed",
				note: "Done",
			},
		});

		await expect(
			service.completeTakeover(
				task.id,
				"owner-001",
				"invalid-result" as "completed",
			),
		).rejects.toMatchObject({
			name: "TaskOwnershipError",
			code: TaskOwnershipErrorCode.TASK_TAKEOVER_RESULT_INVALID,
		} satisfies Partial<TaskOwnershipError>);
	});

	it("should reject illegal takeover attempts on rejected task", async () => {
		const task = await seedTask("rejected", {
			assigneeId: "owner-001",
		});

		await expect(
			service.takeOverTask(task.id, "owner-001"),
		).rejects.toMatchObject({
			name: "ReplyTaskDomainError",
			code: ReplyTaskDomainErrorCode.INVALID_TASK_STATUS_TRANSITION,
		} satisfies Partial<ReplyTaskDomainError>);
	});

	async function seedTask(
		status:
			| "pending_review"
			| "ready_for_execution"
			| "assigned"
			| "in_takeover"
			| "rejected",
		overrides?: Partial<{
			assigneeId: string;
			takenOverBy: string;
		}>,
	) {
		const task = {
			...createReplyTask({
				workspaceId: "workspace-001",
				accountId: "account-001",
				commentInputId: "comment-001",
				candidateReplyId: `candidate-${status}`,
				riskLevel: "high",
				createdBy: "user-001",
				assigneeId: overrides?.assigneeId,
				takenOverBy: overrides?.takenOverBy,
			}),
			status,
			route:
				status === "ready_for_execution"
					? ("ready_for_execution" as const)
					: ("pending_review" as const),
		};

		await replyTaskRepository.save(task);

		return task;
	}
});
