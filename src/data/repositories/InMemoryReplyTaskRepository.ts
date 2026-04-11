import type {
	ReplyTaskRoute,
	ReplyTask,
	ReplyTaskEvent,
	ReplyTaskId,
	ReplyTaskStatus,
} from "../../domain/replyTask";
import {
	ReplyTaskDomainError,
	ReplyTaskDomainErrorCode,
} from "../../domain/errors";
import type { IReplyTaskRepository } from "./IReplyTaskRepository";

function sortByNewest(tasks: ReplyTask[]): ReplyTask[] {
	return tasks.sort(
		(left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
	);
}

export class InMemoryReplyTaskRepository implements IReplyTaskRepository {
	private tasks: Map<ReplyTaskId, ReplyTask> = new Map();

	async save(task: ReplyTask): Promise<void> {
		const existing = this.tasks.get(task.id);

		if (existing) {
			if (existing.version !== task.version) {
				throw new ReplyTaskDomainError(
					ReplyTaskDomainErrorCode.OPTIMISTIC_LOCK_FAILED,
					`Failed to save reply task "${task.id}" due to version mismatch: expected ${existing.version}, received ${task.version}`,
				);
			}

			this.tasks.set(task.id, {
				...task,
				version: existing.version + 1,
				updatedAt:
					task.updatedAt.getTime() >= existing.updatedAt.getTime()
						? task.updatedAt
						: new Date(),
			});
			return;
		}

		this.tasks.set(task.id, task);
	}

	async findById(id: ReplyTaskId): Promise<ReplyTask | null> {
		return this.tasks.get(id) ?? null;
	}

	async findByCandidateReplyId(candidateReplyId: string): Promise<ReplyTask | null> {
		return (
			Array.from(this.tasks.values()).find(
				(task) => task.candidateReplyId === candidateReplyId,
			) ?? null
		);
	}

	async findByWorkspace(workspaceId: string): Promise<ReplyTask[]> {
		return sortByNewest(
			Array.from(this.tasks.values()).filter(
				(task) => task.workspaceId === workspaceId,
			),
		);
	}

	async findByStatus(status: ReplyTaskStatus): Promise<ReplyTask[]> {
		return sortByNewest(
			Array.from(this.tasks.values()).filter((task) => task.status === status),
		);
	}

	async findByRoute(route: ReplyTaskRoute): Promise<ReplyTask[]> {
		return sortByNewest(
			Array.from(this.tasks.values()).filter((task) => task.route === route),
		);
	}

	async findPendingReview(): Promise<ReplyTask[]> {
		return this.findByStatus("pending_review");
	}

	async findEvents(taskId: ReplyTaskId): Promise<ReplyTaskEvent[]> {
		const task = this.tasks.get(taskId);
		return task ? [...task.events] : [];
	}

	clear(): void {
		this.tasks.clear();
	}
}
