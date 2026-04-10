import type { PlatformState } from "../domain/types";

// Seed data for initial platform state
// This will be replaced by real data sources in subsequent task cards
export const seedPlatformState: PlatformState = {
	workspaces: [
		{
			id: "ws-001",
			name: "Default Workspace",
			description: "Primary customer workspace",
		},
		{
			id: "ws-002",
			name: "Growth Workspace",
			description: "Campaign and community operations workspace",
		},
	],
	accounts: [
		{
			id: "acc-001",
			workspaceId: "ws-001",
			handle: "@tweetpilot_demo",
			displayName: "TweetPilot Demo",
			status: "active",
		},
		{
			id: "acc-002",
			workspaceId: "ws-002",
			handle: "@tweetpilot_growth",
			displayName: "TweetPilot Growth",
			status: "active",
		},
	],
	instances: [
		{
			id: "inst-001",
			name: "Local Instance 1",
			accountId: "acc-001",
			status: "online",
			capabilities: ["read", "write", "monitor"],
		},
		{
			id: "inst-002",
			name: "Growth Instance 1",
			accountId: "acc-002",
			status: "offline",
			capabilities: ["read", "monitor"],
		},
	],
	channels: [
		{
			id: "ch-001",
			name: "Local Bridge",
			type: "local-bridge",
			accountId: "acc-001",
			status: "available",
		},
		{
			id: "ch-002",
			name: "X Official API",
			type: "x-api",
			accountId: "acc-001",
			status: "unavailable",
		},
		{
			id: "ch-003",
			name: "Growth MCP",
			type: "x-mcp",
			accountId: "acc-002",
			status: "available",
		},
	],
};
