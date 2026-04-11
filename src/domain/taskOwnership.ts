export type TaskOwnershipActorRole = "admin";
export type TaskTakeoverAction = "take_over" | "complete_takeover";
export type TaskTakeoverCompletionResult =
	| "ready_for_execution"
	| "rejected"
	| "completed";

export interface TaskAssignment {
	taskId: string;
	assigneeId: string;
	assignedBy: string;
	assignedAt: Date;
}

export interface TaskTakeoverResult {
	taskId: string;
	actorId: string;
	action: TaskTakeoverAction;
	result?: TaskTakeoverCompletionResult;
	expectedVersion?: number;
	note?: string;
}
