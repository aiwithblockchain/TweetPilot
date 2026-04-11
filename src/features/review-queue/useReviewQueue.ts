import { useEffect, useMemo, useState } from "react";
import { candidateReplyRepository, commentInputRepository, replyTaskRepository } from "../../data";
import { platformState } from "../../data/platformState";
import type { CandidateReply } from "../../domain/candidateReply";
import type { CommentInput } from "../../domain/commentInput";
import type { ReplyTask, ReplyTaskEvent } from "../../domain/replyTask";
import type { ReviewQueueItem, ReviewQueueQuery } from "../../domain/reviewQueue";
import { reviewQueueService } from "../../services";
import type { Workspace } from "../../domain/types";

export interface ReviewTaskDetailModel {
	task: ReplyTask;
	candidateReply: CandidateReply | null;
	commentInput: CommentInput | null;
	events: ReplyTaskEvent[];
}

export interface ReviewQueueViewModel {
	items: ReviewQueueItem[];
	selectedTaskId: string | null;
	selectedTask: ReviewTaskDetailModel | null;
	isLoading: boolean;
	error: string | null;
	total: number;
	workspaces: Workspace[];
	workspaceId: string;
	query: ReviewQueueQuery;
	refresh(): Promise<void>;
	selectTask(taskId: string | null): void;
	setWorkspaceId(workspaceId: string): void;
	setRiskLevel(riskLevel?: "medium" | "high"): void;
	setPage(page: number): void;
}

export interface ReviewQueueDependencies {
	reviewQueueService?: Pick<typeof reviewQueueService, "listPending">;
	replyTaskRepository?: Pick<typeof replyTaskRepository, "findById" | "findEvents">;
	candidateReplyRepository?: Pick<typeof candidateReplyRepository, "findById">;
	commentInputRepository?: Pick<typeof commentInputRepository, "findById">;
	platformState?: Pick<typeof platformState, "getWorkspaces">;
	pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 5;

async function buildTaskDetail(
	taskId: string,
	dependencies: Required<
		Pick<
			ReviewQueueDependencies,
			"replyTaskRepository" | "candidateReplyRepository" | "commentInputRepository"
		>
	>,
): Promise<ReviewTaskDetailModel | null> {
	const task = await dependencies.replyTaskRepository.findById(taskId);

	if (!task) {
		return null;
	}

	const [candidateReply, commentInput, events] = await Promise.all([
		dependencies.candidateReplyRepository.findById(task.candidateReplyId),
		dependencies.commentInputRepository.findById(task.commentInputId),
		dependencies.replyTaskRepository.findEvents(task.id),
	]);

	return {
		task,
		candidateReply,
		commentInput,
		events,
	};
}

export function useReviewQueue(
	dependencies: ReviewQueueDependencies = {},
): ReviewQueueViewModel {
	const reviewService =
		dependencies.reviewQueueService ?? reviewQueueService;
	const taskRepository =
		dependencies.replyTaskRepository ?? replyTaskRepository;
	const replyRepository =
		dependencies.candidateReplyRepository ?? candidateReplyRepository;
	const inputRepository =
		dependencies.commentInputRepository ?? commentInputRepository;
	const workspaceSource = dependencies.platformState ?? platformState;
	const workspaces = workspaceSource.getWorkspaces();
	const defaultWorkspaceId = workspaces[0]?.id ?? "";
	const pageSize = dependencies.pageSize ?? DEFAULT_PAGE_SIZE;

	const [workspaceId, setWorkspaceIdState] = useState(defaultWorkspaceId);
	const [query, setQuery] = useState<ReviewQueueQuery>({
		limit: pageSize,
		offset: 0,
		sortBy: "createdAt",
		sortOrder: "desc",
	});
	const [items, setItems] = useState<ReviewQueueItem[]>([]);
	const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
	const [selectedTask, setSelectedTask] = useState<ReviewTaskDetailModel | null>(
		null,
	);
	const [total, setTotal] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const queryKey = useMemo(
		() =>
			JSON.stringify({
				workspaceId,
				limit: query.limit,
				offset: query.offset,
				riskLevel: query.riskLevel ?? null,
				sortBy: query.sortBy ?? "createdAt",
				sortOrder: query.sortOrder ?? "desc",
			}),
		[query, workspaceId],
	);

	const refresh = async () => {
		if (!workspaceId) {
			setItems([]);
			setTotal(0);
			setSelectedTaskId(null);
			setSelectedTask(null);
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			const result = await reviewService.listPending(workspaceId, query);
			const nextSelectedTaskId =
				selectedTaskId ?? result.items[0]?.taskId ?? null;
			const detail = nextSelectedTaskId
				? await buildTaskDetail(nextSelectedTaskId, {
						replyTaskRepository: taskRepository,
						candidateReplyRepository: replyRepository,
						commentInputRepository: inputRepository,
					})
				: null;

			setItems(result.items);
			setTotal(result.total);
			setSelectedTaskId(detail ? nextSelectedTaskId : result.items[0]?.taskId ?? null);
			setSelectedTask(
				detail ??
					(result.items[0]
						? await buildTaskDetail(result.items[0].taskId, {
								replyTaskRepository: taskRepository,
								candidateReplyRepository: replyRepository,
								commentInputRepository: inputRepository,
							})
						: null),
			);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Failed to load review queue.",
			);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		void refresh();
		// queryKey intentionally collapses object dependencies into one stable trigger.
	}, [queryKey]);

	useEffect(() => {
		if (!selectedTaskId) {
			setSelectedTask(null);
			return;
		}

		void buildTaskDetail(selectedTaskId, {
			replyTaskRepository: taskRepository,
			candidateReplyRepository: replyRepository,
			commentInputRepository: inputRepository,
		}).then((detail) => {
			setSelectedTask(detail);
		});
	}, [selectedTaskId, taskRepository, replyRepository, inputRepository]);

	return {
		items,
		selectedTaskId,
		selectedTask,
		isLoading,
		error,
		total,
		workspaces,
		workspaceId,
		query,
		refresh,
		selectTask(taskId) {
			setSelectedTaskId(taskId);
		},
		setWorkspaceId(nextWorkspaceId) {
			setWorkspaceIdState(nextWorkspaceId);
			setSelectedTaskId(null);
			setQuery((currentQuery) => ({
				...currentQuery,
				offset: 0,
			}));
		},
		setRiskLevel(riskLevel) {
			setSelectedTaskId(null);
			setQuery((currentQuery) => ({
				...currentQuery,
				offset: 0,
				riskLevel,
			}));
		},
		setPage(page) {
			setQuery((currentQuery) => ({
				...currentQuery,
				offset: Math.max(0, page) * pageSize,
			}));
		},
	};
}
