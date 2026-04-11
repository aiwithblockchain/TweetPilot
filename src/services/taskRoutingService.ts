import type { IReplyTaskRepository } from "../data/repositories/IReplyTaskRepository";
import {
	appendReplyTaskEvent,
	markReplyTaskStatus,
	type ReplyTask,
	type ReplyTaskRoute,
} from "../domain/replyTask";
import {
	DEFAULT_TASK_RISK_RULES,
	type TaskRiskRule,
	type TaskRoutingDecision,
} from "../domain/taskRouting";

export enum TaskRoutingErrorCode {
	TASK_ROUTE_NOT_FOUND = "TASK_ROUTE_NOT_FOUND",
	TASK_ROUTE_RULE_MISSING = "TASK_ROUTE_RULE_MISSING",
	TASK_ROUTE_FALLBACK_APPLIED = "TASK_ROUTE_FALLBACK_APPLIED",
}

export class TaskRoutingError extends Error {
	public readonly code: TaskRoutingErrorCode;
	public readonly cause?: unknown;

	constructor(code: TaskRoutingErrorCode, message: string, cause?: unknown) {
		super(message);
		this.name = "TaskRoutingError";
		this.code = code;
		this.cause = cause;
	}
}

export interface TaskRoutingService {
	routeTask(taskId: string, actorId: string): Promise<TaskRoutingDecision>;
}

interface TaskRoutingServiceDependencies {
	replyTaskRepository: Pick<IReplyTaskRepository, "findById" | "save">;
	rules?: Partial<Record<ReplyTask["riskLevel"], TaskRiskRule>>;
}

const SUPPORTED_TASK_ROUTES: ReplyTaskRoute[] = [
	"pending_review",
	"ready_for_execution",
];

function buildRoutingDecision(
	task: ReplyTask,
	route: ReplyTaskRoute,
	reason: string,
): TaskRoutingDecision {
	return {
		taskId: task.id,
		riskLevel: task.riskLevel,
		route,
		reason,
	};
}

function resolveConfiguredRoute(route: string): ReplyTaskRoute {
	if (
		SUPPORTED_TASK_ROUTES.includes(route as ReplyTaskRoute)
	) {
		return route as ReplyTaskRoute;
	}

	throw new TaskRoutingError(
		TaskRoutingErrorCode.TASK_ROUTE_FALLBACK_APPLIED,
		`Unsupported task route "${route}" in routing rule configuration.`,
	);
}

export function createTaskRoutingService(
	dependencies: TaskRoutingServiceDependencies,
): TaskRoutingService {
	const rules = {
		...DEFAULT_TASK_RISK_RULES,
		...(dependencies.rules ?? {}),
	};

	return {
		async routeTask(taskId: string, actorId: string): Promise<TaskRoutingDecision> {
			const task = await dependencies.replyTaskRepository.findById(taskId);

			if (!task) {
				throw new TaskRoutingError(
					TaskRoutingErrorCode.TASK_ROUTE_NOT_FOUND,
					`Reply task "${taskId}" was not found.`,
				);
			}

			const rule = rules[task.riskLevel];
			let route: ReplyTaskRoute;
			let reason: string;
			let fallbackApplied = false;
			let fallbackErrorCode: TaskRoutingErrorCode | null = null;
			let fallbackCause: unknown;

			if (!rule) {
				route = "pending_review";
				reason = `Missing routing rule for risk level "${task.riskLevel}", fallback applied.`;
				fallbackApplied = true;
				fallbackErrorCode = TaskRoutingErrorCode.TASK_ROUTE_RULE_MISSING;
			} else {
				try {
					route = resolveConfiguredRoute(rule.defaultRoute);
					reason = `Routed by ${task.riskLevel} risk rule to "${route}".`;
				} catch (cause) {
					route = rule.fallbackRoute;
					reason = `Routing rule for risk level "${task.riskLevel}" failed, fallback route "${route}" applied.`;
					fallbackApplied = true;
					fallbackErrorCode =
						TaskRoutingErrorCode.TASK_ROUTE_FALLBACK_APPLIED;
					fallbackCause = cause;
				}
			}

			const nextStatus =
				route === "ready_for_execution"
					? "ready_for_execution"
					: "pending_review";
			const routedTask = appendReplyTaskEvent(
				markReplyTaskStatus(task, nextStatus, {
					route,
				}),
				{
					type: "risk_routed",
					actorId,
					payload: {
						route,
						reason,
						fallbackApplied,
						errorCode: fallbackErrorCode,
					},
				},
			);

			await dependencies.replyTaskRepository.save(routedTask);

			if (fallbackApplied) {
				throw new TaskRoutingError(
					fallbackErrorCode ?? TaskRoutingErrorCode.TASK_ROUTE_FALLBACK_APPLIED,
					reason,
					fallbackCause,
				);
			}

			return buildRoutingDecision(task, route, reason);
		},
	};
}
