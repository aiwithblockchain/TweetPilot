import { describe, expect, it } from "vitest";
import {
	DefaultExecutionEligibilityChecker,
} from "../../src/domain/executionEligibility";
import { createReplyTask, type ReplyTask } from "../../src/domain/replyTask";

function buildTask(overrides: Partial<ReplyTask> = {}): ReplyTask {
	return {
		...createReplyTask({
			workspaceId: "ws-001",
			accountId: "acc-001",
			commentInputId: "ci-001",
			candidateReplyId: "cr-001",
			riskLevel: "low",
			createdBy: "user-001",
			status: "ready_for_execution",
			route: "ready_for_execution",
		}),
		status: "ready_for_execution",
		route: "ready_for_execution",
		...overrides,
	};
}

describe("DefaultExecutionEligibilityChecker", () => {
	const checker = new DefaultExecutionEligibilityChecker();

	it("accepts tasks that are ready for execution", () => {
		expect(checker.check(buildTask())).toEqual({ eligible: true });
	});

	it("rejects tasks under manual takeover", () => {
		expect(checker.check(buildTask({ status: "in_takeover" }))).toEqual({
			eligible: false,
			reason: "Task is currently under manual takeover",
			code: "IN_TAKEOVER",
		});
	});

	it("rejects rejected tasks", () => {
		expect(checker.check(buildTask({ status: "rejected" }))).toEqual({
			eligible: false,
			reason: "Task has been rejected",
			code: "REJECTED",
		});
	});

	it("rejects tasks in any other status", () => {
		expect(checker.check(buildTask({ status: "pending_review" }))).toEqual({
			eligible: false,
			reason: "Task status is pending_review, expected ready_for_execution",
			code: "INVALID_STATUS",
		});
	});

	it("rejects missing candidate reply assignment", () => {
		expect(checker.check(buildTask({ candidateReplyId: "" }))).toEqual({
			eligible: false,
			reason: "Task has no candidate reply",
			code: "MISSING_CANDIDATE_REPLY",
		});
	});

	it("rejects missing account assignment", () => {
		expect(checker.check(buildTask({ accountId: "" }))).toEqual({
			eligible: false,
			reason: "Task has no account assignment",
			code: "MISSING_ACCOUNT",
		});
	});

	it("rejects missing workspace assignment", () => {
		expect(checker.check(buildTask({ workspaceId: "" }))).toEqual({
			eligible: false,
			reason: "Task has no workspace assignment",
			code: "MISSING_WORKSPACE",
		});
	});
});
