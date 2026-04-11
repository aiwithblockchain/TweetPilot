import { describe, expect, it } from "vitest";
import {
	ReplyTaskDomainError,
	ReplyTaskDomainErrorCode,
} from "../errors";
import {
	appendReplyTaskEvent,
	assertCanTransition,
	createReplyTask,
	markReplyTaskStatus,
} from "../replyTask";

describe("ReplyTask Domain", () => {
	describe("createReplyTask", () => {
		it("should create reply task with default status, route and version", () => {
			const task = createReplyTask({
				workspaceId: "workspace-001",
				accountId: "account-001",
				commentInputId: "comment-001",
				candidateReplyId: "candidate-001",
				roleId: "role-001",
				riskLevel: "medium",
				createdBy: "user-001",
			});

			expect(task.id).toBeDefined();
			expect(task.workspaceId).toBe("workspace-001");
			expect(task.accountId).toBe("account-001");
			expect(task.commentInputId).toBe("comment-001");
			expect(task.candidateReplyId).toBe("candidate-001");
			expect(task.roleId).toBe("role-001");
			expect(task.riskLevel).toBe("medium");
			expect(task.status).toBe("created");
			expect(task.route).toBe("pending_review");
			expect(task.version).toBe(1);
			expect(task.createdAt).toBeInstanceOf(Date);
			expect(task.updatedAt).toBeInstanceOf(Date);
			expect(task.events).toHaveLength(1);
			expect(task.events[0]).toMatchObject({
				taskId: task.id,
				type: "task_created",
				actorId: "user-001",
			});
		});
	});

	describe("assertCanTransition", () => {
		it("should allow valid status transitions", () => {
			expect(() =>
				assertCanTransition("created", "pending_route"),
			).not.toThrow();
			expect(() =>
				assertCanTransition("pending_route", "pending_review"),
			).not.toThrow();
			expect(() =>
				assertCanTransition("pending_review", "ready_for_execution"),
			).not.toThrow();
		});

		it("should throw structured error for invalid status transitions", () => {
			expect(() =>
				assertCanTransition("completed", "pending_review"),
			).toThrowError(ReplyTaskDomainError);

			try {
				assertCanTransition("rejected", "ready_for_execution");
			} catch (error) {
				expect(error).toBeInstanceOf(ReplyTaskDomainError);
				expect((error as ReplyTaskDomainError).code).toBe(
					ReplyTaskDomainErrorCode.INVALID_TASK_STATUS_TRANSITION,
				);
			}
		});
	});

	describe("markReplyTaskStatus", () => {
		it("should update status when transition is valid", () => {
			const task = createReplyTask({
				workspaceId: "workspace-001",
				accountId: "account-001",
				commentInputId: "comment-001",
				candidateReplyId: "candidate-001",
				riskLevel: "low",
				createdBy: "user-001",
			});
			const pendingRouteTask = markReplyTaskStatus(task, "pending_route");
			const pendingReviewTask = markReplyTaskStatus(
				pendingRouteTask,
				"pending_review",
				{
					route: "pending_review",
				},
			);

			expect(pendingRouteTask.status).toBe("pending_route");
			expect(pendingReviewTask.status).toBe("pending_review");
			expect(pendingReviewTask.route).toBe("pending_review");
			expect(pendingReviewTask.updatedAt.getTime()).toBeGreaterThanOrEqual(
				task.updatedAt.getTime(),
			);
		});
	});

	describe("appendReplyTaskEvent", () => {
		it("should append task events and update timestamp", () => {
			const task = createReplyTask({
				workspaceId: "workspace-001",
				accountId: "account-001",
				commentInputId: "comment-001",
				candidateReplyId: "candidate-001",
				riskLevel: "high",
				createdBy: "user-001",
			});

			const withFailedEvent = appendReplyTaskEvent(task, {
				type: "task_failed",
				actorId: "system",
				payload: { reason: "timeout" },
			});
			const withCompletedEvent = appendReplyTaskEvent(withFailedEvent, {
				type: "task_completed",
				actorId: "operator-001",
				payload: { channel: "manual" },
			});

			expect(withCompletedEvent.events).toHaveLength(3);
			expect(withCompletedEvent.events[1]).toMatchObject({
				taskId: task.id,
				type: "task_failed",
				actorId: "system",
				payload: { reason: "timeout" },
			});
			expect(withCompletedEvent.events[2]).toMatchObject({
				taskId: task.id,
				type: "task_completed",
				actorId: "operator-001",
				payload: { channel: "manual" },
			});
			expect(withCompletedEvent.updatedAt.getTime()).toBeGreaterThanOrEqual(
				task.updatedAt.getTime(),
			);
		});
	});
});
