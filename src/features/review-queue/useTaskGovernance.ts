import { useState } from "react";
import type { ReplyTask } from "../../domain/replyTask";
import { reviewQueueService, taskOwnershipService } from "../../services";
import type { TaskTakeoverCompletionResult } from "../../domain/taskOwnership";

type GovernanceRole = "none" | "reviewer" | "admin";

export interface TaskGovernanceDependencies {
	reviewQueueService?: Pick<typeof reviewQueueService, "decide">;
	taskOwnershipService?: Pick<
		typeof taskOwnershipService,
		"assignTask" | "takeOverTask" | "completeTakeover"
	>;
}

export interface UseTaskGovernanceOptions extends TaskGovernanceDependencies {
	selectedTask: ReplyTask | null;
	onRefresh: () => Promise<void>;
}

function toActorRoles(role: GovernanceRole): Array<"reviewer" | "admin"> | undefined {
	if (role === "reviewer" || role === "admin") {
		return [role];
	}

	return undefined;
}

export function useTaskGovernance(options: UseTaskGovernanceOptions) {
	const reviewService =
		options.reviewQueueService ?? reviewQueueService;
	const ownershipService =
		options.taskOwnershipService ?? taskOwnershipService;
	const [actorId, setActorId] = useState("admin-001");
	const [actorRole, setActorRole] = useState<GovernanceRole>("admin");
	const [assigneeId, setAssigneeId] = useState("owner-001");
	const [note, setNote] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const runAction = async (action: () => Promise<void>) => {
		setIsSubmitting(true);
		setError(null);

		try {
			await action();
			await options.onRefresh();
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Governance action failed.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return {
		actorId,
		actorRole,
		assigneeId,
		note,
		isSubmitting,
		error,
		setActorId,
		setActorRole,
		setAssigneeId,
		setNote,
		approve() {
			if (!options.selectedTask) {
				return Promise.resolve();
			}

			return runAction(async () => {
				await reviewService.decide({
					taskId: options.selectedTask!.id,
					action: "approve",
					actorId,
					actorRoles: toActorRoles(actorRole),
					note: note || undefined,
				});
			});
		},
		reject() {
			if (!options.selectedTask) {
				return Promise.resolve();
			}

			return runAction(async () => {
				await reviewService.decide({
					taskId: options.selectedTask!.id,
					action: "reject",
					actorId,
					actorRoles: toActorRoles(actorRole),
					note: note || undefined,
				});
			});
		},
		returnToQueue() {
			if (!options.selectedTask) {
				return Promise.resolve();
			}

			return runAction(async () => {
				await reviewService.decide({
					taskId: options.selectedTask!.id,
					action: "return_to_queue",
					actorId,
					actorRoles: toActorRoles(actorRole),
					note: note || undefined,
				});
			});
		},
		assign() {
			if (!options.selectedTask) {
				return Promise.resolve();
			}

			return runAction(async () => {
				await ownershipService.assignTask(
					options.selectedTask!.id,
					assigneeId,
					actorId,
					{
						actorRoles:
							actorRole === "admin" ? ["admin"] : undefined,
						force: options.selectedTask?.assigneeId
							? options.selectedTask.assigneeId !== assigneeId
							: false,
					},
				);
			});
		},
		takeOver() {
			if (!options.selectedTask) {
				return Promise.resolve();
			}

			return runAction(async () => {
				await ownershipService.takeOverTask(
					options.selectedTask!.id,
					actorId,
					note || undefined,
					{
						expectedVersion: options.selectedTask!.version,
						actorRoles:
							actorRole === "admin" ? ["admin"] : undefined,
					},
				);
			});
		},
		completeTakeover(result: TaskTakeoverCompletionResult) {
			if (!options.selectedTask) {
				return Promise.resolve();
			}

			return runAction(async () => {
				await ownershipService.completeTakeover(
					options.selectedTask!.id,
					actorId,
					result,
					note || undefined,
					{
						actorRoles:
							actorRole === "admin" ? ["admin"] : undefined,
					},
				);
			});
		},
	};
}
