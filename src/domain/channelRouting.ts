import type { ExecutionChannel } from "./executionChannel";
import type { ReplyTask } from "./replyTask";

export type ChannelRoutingErrorCode =
	| "NO_AVAILABLE_CHANNELS"
	| "NOT_EXECUTABLE_IN_SLICE5";

export interface ChannelRoutingResult {
	channelType: ExecutionChannel["type"];
	channelId: string;
	reason: string;
}

export interface ChannelRoutingStrategy {
	route(
		task: ReplyTask,
		availableChannels: ExecutionChannel[],
	): ChannelRoutingResult;
}

export class ChannelRoutingError extends Error {
	constructor(
		public readonly code: ChannelRoutingErrorCode,
		message: string,
	) {
		super(message);
		this.name = "ChannelRoutingError";
	}
}

export class DefaultChannelRoutingStrategy implements ChannelRoutingStrategy {
	route(
		task: ReplyTask,
		availableChannels: ExecutionChannel[],
	): ChannelRoutingResult {
		const accountChannels = availableChannels.filter(
			(channel) =>
				channel.accountId === task.accountId && channel.status === "available",
		);

		if (accountChannels.length === 0) {
			throw new ChannelRoutingError(
				"NO_AVAILABLE_CHANNELS",
				`No available channels for account ${task.accountId}`,
			);
		}

		const localBridgeChannel = accountChannels.find(
			(channel) =>
				channel.type === "local-bridge" &&
				channel.capabilities.includes("reply"),
		);

		if (localBridgeChannel) {
			return {
				channelType: localBridgeChannel.type,
				channelId: localBridgeChannel.id,
				reason: "Local bridge channel is available (Slice 5 primary path)",
			};
		}

		throw new ChannelRoutingError(
			"NOT_EXECUTABLE_IN_SLICE5",
			`No local-bridge channel available for account ${task.accountId}. Official channels (x-api/x-mcp) are reserved for Slice 7.`,
		);
	}
}
