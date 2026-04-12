import type { ReplyTask } from "./replyTask";

export type ExecutionEligibilityCode =
	| "IN_TAKEOVER"
	| "REJECTED"
	| "INVALID_STATUS"
	| "MISSING_CANDIDATE_REPLY"
	| "MISSING_ACCOUNT"
	| "MISSING_WORKSPACE";

export type ExecutionEligibilityResult =
	| { eligible: true }
	| {
			eligible: false;
			reason: string;
			code: ExecutionEligibilityCode;
	  };

export interface ExecutionEligibilityChecker {
	check(task: ReplyTask): ExecutionEligibilityResult;
}

export class DefaultExecutionEligibilityChecker
	implements ExecutionEligibilityChecker
{
	check(task: ReplyTask): ExecutionEligibilityResult {
		if (task.status === "in_takeover") {
			return {
				eligible: false,
				reason: "Task is currently under manual takeover",
				code: "IN_TAKEOVER",
			};
		}

		if (task.status === "rejected") {
			return {
				eligible: false,
				reason: "Task has been rejected",
				code: "REJECTED",
			};
		}

		if (task.status !== "ready_for_execution") {
			return {
				eligible: false,
				reason: `Task status is ${task.status}, expected ready_for_execution`,
				code: "INVALID_STATUS",
			};
		}

		if (!task.candidateReplyId?.trim()) {
			return {
				eligible: false,
				reason: "Task has no candidate reply",
				code: "MISSING_CANDIDATE_REPLY",
			};
		}

		if (!task.accountId?.trim()) {
			return {
				eligible: false,
				reason: "Task has no account assignment",
				code: "MISSING_ACCOUNT",
			};
		}

		if (!task.workspaceId?.trim()) {
			return {
				eligible: false,
				reason: "Task has no workspace assignment",
				code: "MISSING_WORKSPACE",
			};
		}

		return { eligible: true };
	}
}
