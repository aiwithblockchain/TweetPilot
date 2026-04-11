export enum ReplyTaskDomainErrorCode {
	INVALID_TASK_STATUS_TRANSITION = "INVALID_TASK_STATUS_TRANSITION",
	OPTIMISTIC_LOCK_FAILED = "OPTIMISTIC_LOCK_FAILED",
	TASK_NOT_FOUND = "TASK_NOT_FOUND",
	TASK_EVENT_APPEND_FAILED = "TASK_EVENT_APPEND_FAILED",
}

export class ReplyTaskDomainError extends Error {
	public readonly code: ReplyTaskDomainErrorCode;
	public readonly cause?: unknown;

	constructor(
		code: ReplyTaskDomainErrorCode,
		message: string,
		cause?: unknown,
	) {
		super(message);
		this.name = "ReplyTaskDomainError";
		this.code = code;
		this.cause = cause;
	}
}
