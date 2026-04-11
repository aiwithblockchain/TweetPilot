import type { RiskLevel } from "./candidateReply";
import type { ReplyTaskRoute, ReplyTaskId } from "./replyTask";

export interface TaskRoutingDecision {
	taskId: ReplyTaskId;
	riskLevel: RiskLevel;
	route: ReplyTaskRoute;
	reason: string;
}

export interface TaskRiskRule {
	riskLevel: RiskLevel;
	defaultRoute: ReplyTaskRoute;
	fallbackRoute: "pending_review";
}

export const DEFAULT_TASK_RISK_RULES: Record<RiskLevel, TaskRiskRule> = {
	low: {
		riskLevel: "low",
		defaultRoute: "ready_for_execution",
		fallbackRoute: "pending_review",
	},
	medium: {
		riskLevel: "medium",
		defaultRoute: "pending_review",
		fallbackRoute: "pending_review",
	},
	high: {
		riskLevel: "high",
		defaultRoute: "pending_review",
		fallbackRoute: "pending_review",
	},
};
