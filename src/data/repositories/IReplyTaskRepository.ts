import type {
	ReplyTaskRoute,
	ReplyTask,
	ReplyTaskEvent,
	ReplyTaskId,
	ReplyTaskStatus,
} from "../../domain/replyTask";

export interface IReplyTaskRepository {
	save(task: ReplyTask): Promise<void>;
	findById(id: ReplyTaskId): Promise<ReplyTask | null>;
	findByCandidateReplyId(candidateReplyId: string): Promise<ReplyTask | null>;
	findByWorkspace(workspaceId: string): Promise<ReplyTask[]>;
	findByStatus(status: ReplyTaskStatus): Promise<ReplyTask[]>;
	findByRoute(route: ReplyTaskRoute): Promise<ReplyTask[]>;
	findPendingReview(): Promise<ReplyTask[]>;
	findEvents(taskId: ReplyTaskId): Promise<ReplyTaskEvent[]>;
}
