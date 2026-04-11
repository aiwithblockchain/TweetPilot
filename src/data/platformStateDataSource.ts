import type { LocalBridgeInstance } from "../adapters/localBridge/types";
import type { AccountId, ExecutionChannel, Instance, PlatformState } from "../domain/types";
import { seedPlatformState } from "./seed";

export type PlatformStateDataSourceMode = "seed" | "local-bridge-hybrid";
export const LOCAL_BRIDGE_INSTANCE_ID_PREFIX = "lb-";
export const LOCAL_BRIDGE_CHANNEL_ID_PREFIX = "ch-local-bridge-";
export const LOCAL_BRIDGE_FALLBACK_ACCOUNT_ID = "acc-local-bridge";

export interface PlatformStateDataSource {
	getSnapshot(): PlatformState;
}

export interface LocalBridgeHybridPlatformSnapshot {
	instances?: LocalBridgeInstance[];
}

export interface LocalBridgeHybridPlatformDataSourceOptions {
	baseState?: PlatformState;
	bridgeSnapshot?: LocalBridgeHybridPlatformSnapshot;
	instanceAccountBindings?: Record<string, AccountId>;
	fallbackAccountId?: AccountId;
}

function clonePlatformState(state: PlatformState): PlatformState {
	return {
		workspaces: state.workspaces.map((workspace) => ({ ...workspace })),
		accounts: state.accounts.map((account) => ({ ...account })),
		instances: state.instances.map((instance) => ({
			...instance,
			capabilities: [...instance.capabilities],
		})),
		channels: state.channels.map((channel) => ({
			...channel,
			capabilities: [...channel.capabilities],
			metadata: channel.metadata ? { ...channel.metadata } : undefined,
		})),
	};
}

export function dedupeInstances(instances: Instance[]): Instance[] {
	const entries = new Map(instances.map((instance) => [instance.id, instance]));
	return Array.from(entries.values());
}

export function dedupeChannels(channels: ExecutionChannel[]): ExecutionChannel[] {
	const entries = new Map(channels.map((channel) => [channel.id, channel]));
	return Array.from(entries.values());
}

export class SeedPlatformDataSource implements PlatformStateDataSource {
	constructor(private readonly snapshot: PlatformState = seedPlatformState) {}

	getSnapshot(): PlatformState {
		return clonePlatformState(this.snapshot);
	}
}

export class LocalBridgeHybridPlatformDataSource
	implements PlatformStateDataSource
{
	private readonly baseState: PlatformState;
	private readonly bridgeSnapshot?: LocalBridgeHybridPlatformSnapshot;
	private readonly instanceAccountBindings: Record<string, AccountId>;
	private readonly fallbackAccountId?: AccountId;

	constructor(options: LocalBridgeHybridPlatformDataSourceOptions = {}) {
		this.baseState = options.baseState ?? seedPlatformState;
		this.bridgeSnapshot = options.bridgeSnapshot;
		this.instanceAccountBindings = options.instanceAccountBindings ?? {};
		this.fallbackAccountId = options.fallbackAccountId;
	}

	getSnapshot(): PlatformState {
		const state = clonePlatformState(this.baseState);
		const bridgeInstances = this.bridgeSnapshot?.instances ?? [];

		if (bridgeInstances.length === 0) {
			state.channels = state.channels.map((channel) =>
				channel.type === "local-bridge"
					? { ...channel, status: "unavailable" }
					: channel,
			);
			return state;
		}

		const fallbackAccountId =
			this.fallbackAccountId ??
			state.accounts[0]?.id ??
			LOCAL_BRIDGE_FALLBACK_ACCOUNT_ID;

		const hybridInstances = bridgeInstances.map((instance) => ({
			id: `${LOCAL_BRIDGE_INSTANCE_ID_PREFIX}${instance.instanceId}`,
			name: instance.instanceName,
			accountId:
				this.instanceAccountBindings[instance.instanceId] ?? fallbackAccountId,
			status: "online" as const,
			capabilities: [...instance.capabilities],
		}));

		state.instances = dedupeInstances([...state.instances, ...hybridInstances]);

		const boundAccountIds = new Set(
			hybridInstances.map((instance) => instance.accountId),
		);
		const existingLocalBridgeAccountIds = new Set(
			state.channels
				.filter((channel) => channel.type === "local-bridge")
				.map((channel) => channel.accountId),
		);

		const updatedChannels = state.channels.map((channel) =>
			channel.type === "local-bridge"
				? { ...channel, status: "available" as const }
				: channel,
		);

		for (const accountId of boundAccountIds) {
			if (existingLocalBridgeAccountIds.has(accountId)) {
				continue;
			}

			updatedChannels.push({
				id: `${LOCAL_BRIDGE_CHANNEL_ID_PREFIX}${accountId}`,
				name: "Local Bridge",
				type: "local-bridge",
				accountId,
				status: "available",
				capabilities: ["reply"],
			});
		}

		state.channels = dedupeChannels(updatedChannels);
		return state;
	}
}
