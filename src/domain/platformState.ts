import type { ExecutionChannel } from "./executionChannel";

export interface IPlatformState {
	getChannels(accountId?: string): ExecutionChannel[];
	getChannel(channelId: string): ExecutionChannel | null;
}
