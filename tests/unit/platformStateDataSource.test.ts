import { describe, expect, it } from "vitest";
import type { LocalBridgeInstance } from "../../src/adapters/localBridge/types";
import { seedPlatformState } from "../../src/data/seed";
import {
	LOCAL_BRIDGE_CHANNEL_ID_PREFIX,
	LOCAL_BRIDGE_FALLBACK_ACCOUNT_ID,
	LOCAL_BRIDGE_INSTANCE_ID_PREFIX,
	LocalBridgeHybridPlatformDataSource,
	SeedPlatformDataSource,
	dedupeChannels,
	dedupeInstances,
} from "../../src/data/platformStateDataSource";

describe("PlatformStateDataSource", () => {
	it("should return a cloned seed snapshot", () => {
		const dataSource = new SeedPlatformDataSource(seedPlatformState);
		const snapshot = dataSource.getSnapshot();

		snapshot.workspaces[0].name = "Modified";

		expect(seedPlatformState.workspaces[0].name).toBe("Default Workspace");
		expect(dataSource.getSnapshot().workspaces[0].name).toBe(
			"Default Workspace",
		);
	});

	it("should return a legal hybrid snapshot when no bridge data is available", () => {
		const dataSource = new LocalBridgeHybridPlatformDataSource();
		const snapshot = dataSource.getSnapshot();

		expect(snapshot.workspaces).toHaveLength(2);
		expect(snapshot.accounts).toHaveLength(2);
		expect(snapshot.instances).toHaveLength(2);
		expect(
			snapshot.channels
				.filter((channel) => channel.type === "local-bridge")
				.every((channel) => channel.status === "unavailable"),
		).toBe(true);
	});

	it("should merge bridge instances into the hybrid snapshot", () => {
		const bridgeInstances: LocalBridgeInstance[] = [
			{
				clientName: "LocalBridge",
				instanceId: "lb-001",
				instanceName: "Bridge Instance",
				clientVersion: "1.0.0",
				capabilities: ["read", "monitor"],
				connectedAt: "2026-04-11T00:00:00.000Z",
				lastSeenAt: "2026-04-11T00:00:00.000Z",
				isTemporary: false,
			},
		];

		const dataSource = new LocalBridgeHybridPlatformDataSource({
			bridgeSnapshot: { instances: bridgeInstances },
			instanceAccountBindings: { "lb-001": "acc-002" },
		});
		const snapshot = dataSource.getSnapshot();

		expect(
			snapshot.instances.some(
				(instance) =>
					instance.id === `${LOCAL_BRIDGE_INSTANCE_ID_PREFIX}lb-001`,
			),
		).toBe(true);
		expect(
			snapshot.channels.some(
				(channel) =>
					channel.type === "local-bridge" &&
					channel.accountId === "acc-002" &&
					channel.status === "available",
			),
		).toBe(true);
	});

	it("should keep the last duplicate instance entry", () => {
		const deduped = dedupeInstances([
			{
				id: "inst-001",
				name: "Old Instance",
				accountId: "acc-001",
				status: "offline",
				capabilities: ["read"],
			},
			{
				id: "inst-001",
				name: "New Instance",
				accountId: "acc-001",
				status: "online",
				capabilities: ["read", "write"],
			},
		]);

		expect(deduped).toHaveLength(1);
		expect(deduped[0].name).toBe("New Instance");
		expect(deduped[0].status).toBe("online");
	});

	it("should keep the last duplicate channel entry", () => {
		const deduped = dedupeChannels([
			{
				id: "ch-001",
				name: "Bridge",
				type: "local-bridge",
				accountId: "acc-001",
				status: "unavailable",
				capabilities: ["reply"],
			},
			{
				id: "ch-001",
				name: "Bridge",
				type: "local-bridge",
				accountId: "acc-001",
				status: "available",
				capabilities: ["reply"],
			},
		]);

		expect(deduped).toHaveLength(1);
		expect(deduped[0].status).toBe("available");
	});

	it("should use fallback account id when no binding or seed account exists", () => {
		const dataSource = new LocalBridgeHybridPlatformDataSource({
			baseState: {
				workspaces: [],
				accounts: [],
				instances: [],
				channels: [],
			},
			bridgeSnapshot: {
				instances: [
					{
						clientName: "LocalBridge",
						instanceId: "solo",
						instanceName: "Solo Bridge",
						clientVersion: "1.0.0",
						capabilities: ["read"],
						connectedAt: "2026-04-11T00:00:00.000Z",
						lastSeenAt: "2026-04-11T00:00:00.000Z",
						isTemporary: false,
					},
				],
			},
		});

		const snapshot = dataSource.getSnapshot();

		expect(snapshot.instances[0].accountId).toBe(LOCAL_BRIDGE_FALLBACK_ACCOUNT_ID);
		expect(snapshot.channels[0].id).toBe(
			`${LOCAL_BRIDGE_CHANNEL_ID_PREFIX}${LOCAL_BRIDGE_FALLBACK_ACCOUNT_ID}`,
		);
	});

	it("should mark existing local bridge channels as available when bridge data exists", () => {
		const dataSource = new LocalBridgeHybridPlatformDataSource({
			bridgeSnapshot: {
				instances: [
					{
						clientName: "LocalBridge",
						instanceId: "lb-available",
						instanceName: "Available Bridge",
						clientVersion: "1.0.0",
						capabilities: ["read"],
						connectedAt: "2026-04-11T00:00:00.000Z",
						lastSeenAt: "2026-04-11T00:00:00.000Z",
						isTemporary: false,
					},
				],
			},
		});

		const snapshot = dataSource.getSnapshot();
		const localBridgeChannels = snapshot.channels.filter(
			(channel) => channel.type === "local-bridge",
		);

		expect(localBridgeChannels.length).toBeGreaterThan(0);
		expect(localBridgeChannels.every((channel) => channel.status === "available")).toBe(
			true,
		);
	});
});
