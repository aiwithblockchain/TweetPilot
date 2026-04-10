// Core domain types for TweetPilot platform

export type WorkspaceId = string;
export type AccountId = string;
export type InstanceId = string;
export type ChannelId = string;

export interface Workspace {
	id: WorkspaceId;
	name: string;
	description?: string;
}

export interface Account {
	id: AccountId;
	workspaceId: WorkspaceId;
	handle: string;
	displayName: string;
	status: "active" | "inactive";
}

export interface Instance {
	id: InstanceId;
	name: string;
	accountId: AccountId;
	status: "online" | "offline";
	capabilities: string[];
}

export interface ExecutionChannel {
	id: ChannelId;
	name: string;
	type: "local-bridge" | "x-api" | "x-mcp";
	accountId: AccountId;
	status: "available" | "unavailable";
}

export interface PlatformState {
	workspaces: Workspace[];
	accounts: Account[];
	instances: Instance[];
	channels: ExecutionChannel[];
}
