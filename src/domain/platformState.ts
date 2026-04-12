import type { ExecutionChannel } from "./executionChannel";

export interface IPlatformState {
	getChannel(channelId: string): ExecutionChannel | null;
}
