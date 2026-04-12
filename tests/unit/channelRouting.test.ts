import { describe, expect, it } from "vitest";
import {
	ChannelRoutingError,
	DefaultChannelRoutingStrategy,
} from "../../src/domain/channelRouting";
import type { ExecutionChannel } from "../../src/domain/executionChannel";
import { createReplyTask } from "../../src/domain/replyTask";

function buildChannel(
	id: string,
	overrides: Partial<ExecutionChannel> = {},
): ExecutionChannel {
	return {
		id,
		name: `Channel ${id}`,
		type: "local-bridge",
		accountId: "acc-001",
		status: "available",
		capabilities: ["reply"],
		...overrides,
	};
}

describe("DefaultChannelRoutingStrategy", () => {
	const strategy = new DefaultChannelRoutingStrategy();
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

	it("routes to the available local-bridge channel for the task account", () => {
		const result = strategy.route(task, [
			buildChannel("ch-other", { accountId: "acc-002" }),
			buildChannel("ch-001"),
		]);

		expect(result).toEqual({
			channelType: "local-bridge",
			channelId: "ch-001",
			reason: "Local bridge channel is available (Slice 5 primary path)",
		});
	});

	it("ignores unavailable channels", () => {
		expect(() =>
			strategy.route(task, [
				buildChannel("ch-001", { status: "unavailable" }),
				buildChannel("ch-002", { accountId: "acc-002" }),
			]),
		).toThrow(/No available channels for account acc-001/);
	});

	it("rejects slice-5 execution when only official channels exist", () => {
		try {
			strategy.route(task, [
				buildChannel("ch-api", { type: "x-api" }),
				buildChannel("ch-mcp", { type: "x-mcp" }),
			]);
			throw new Error("Expected routing to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(ChannelRoutingError);
			expect((error as ChannelRoutingError).code).toBe(
				"NOT_EXECUTABLE_IN_SLICE5",
			);
			expect((error as Error).message).toContain("Slice 7");
		}
	});

	it("requires reply capability on the selected local-bridge channel", () => {
		try {
			strategy.route(task, [
				buildChannel("ch-001", { capabilities: ["monitor"] }),
				buildChannel("ch-api", { type: "x-api" }),
			]);
			throw new Error("Expected routing to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(ChannelRoutingError);
			expect((error as ChannelRoutingError).code).toBe(
				"NOT_EXECUTABLE_IN_SLICE5",
			);
		}
	});
});
