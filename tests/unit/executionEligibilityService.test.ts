import { describe, expect, it } from "vitest";
import type {
	ChannelRoutingResult,
	ChannelRoutingStrategy,
} from "../../src/domain/channelRouting";
import type { ExecutionChannel } from "../../src/domain/executionChannel";
import type {
	ExecutionEligibilityChecker,
	ExecutionEligibilityResult,
} from "../../src/domain/executionEligibility";
import { createReplyTask } from "../../src/domain/replyTask";
import { ExecutionEligibilityService } from "../../src/services/executionEligibilityService";

describe("ExecutionEligibilityService", () => {
	const task = createReplyTask({
		workspaceId: "ws-001",
		accountId: "acc-001",
		commentInputId: "ci-001",
		candidateReplyId: "cr-001",
		riskLevel: "low",
		createdBy: "user-001",
		status: "ready_for_execution",
		route: "ready_for_execution",
	});

	const channels: ExecutionChannel[] = [
		{
			id: "ch-001",
			name: "Local Bridge",
			type: "local-bridge",
			accountId: "acc-001",
			status: "available",
			capabilities: ["reply"],
		},
	];

	it("returns routing when eligibility passes", () => {
		const checker: ExecutionEligibilityChecker = {
			check: (): ExecutionEligibilityResult => ({ eligible: true }),
		};
		const routing: ChannelRoutingResult = {
			channelType: "local-bridge",
			channelId: "ch-001",
			reason: "primary",
		};
		const routingStrategy: ChannelRoutingStrategy = {
			route: () => routing,
		};

		const service = new ExecutionEligibilityService(checker, routingStrategy);

		expect(service.checkEligibility({ task, availableChannels: channels })).toEqual({
			eligible: true,
			routing,
		});
	});

	it("returns the eligibility error without attempting routing", () => {
		const checker: ExecutionEligibilityChecker = {
			check: (): ExecutionEligibilityResult => ({
				eligible: false,
				code: "INVALID_STATUS",
				reason: "not ready",
			}),
		};
		const routingStrategy: ChannelRoutingStrategy = {
			route: () => {
				throw new Error("should not be called");
			},
		};

		const service = new ExecutionEligibilityService(checker, routingStrategy);

		expect(service.checkEligibility({ task, availableChannels: channels })).toEqual({
			eligible: false,
			code: "INVALID_STATUS",
			reason: "not ready",
		});
	});

	it("returns routing errors as structured failures", () => {
		const checker: ExecutionEligibilityChecker = {
			check: (): ExecutionEligibilityResult => ({ eligible: true }),
		};
		const routingStrategy: ChannelRoutingStrategy = {
			route: () => {
				throw new Error("routing exploded");
			},
		};

		const service = new ExecutionEligibilityService(checker, routingStrategy);

		expect(service.checkEligibility({ task, availableChannels: channels })).toEqual({
			eligible: false,
			code: "ROUTING_FAILED",
			reason: "routing exploded",
		});
	});
});
