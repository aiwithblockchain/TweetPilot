import type {
	Account,
	ExecutionChannel,
	Instance,
	Workspace,
} from "../domain/types";
import type { IPlatformState } from "../domain/platformState";
import {
	type PlatformStateDataSource,
	type PlatformStateDataSourceMode,
	LocalBridgeHybridPlatformDataSource,
	SeedPlatformDataSource,
} from "./platformStateDataSource";

export const PLATFORM_DATA_SOURCE_ENV_KEY = "VITE_PLATFORM_DATA_SOURCE";

export class PlatformStateManager implements IPlatformState {
	constructor(private readonly dataSource: PlatformStateDataSource) {}

	private getStateSnapshot() {
		return this.dataSource.getSnapshot();
	}

	getWorkspaces(): Workspace[] {
		return this.getStateSnapshot().workspaces;
	}

	getAccounts(workspaceId?: string): Account[] {
		const accounts = this.getStateSnapshot().accounts;
		if (workspaceId) {
			return accounts.filter((account) => account.workspaceId === workspaceId);
		}
		return accounts;
	}

	getInstances(accountId?: string): Instance[] {
		const instances = this.getStateSnapshot().instances;
		if (accountId) {
			return instances.filter((instance) => instance.accountId === accountId);
		}
		return instances;
	}

	getChannels(accountId?: string): ExecutionChannel[] {
		const channels = this.getStateSnapshot().channels;
		if (accountId) {
			return channels.filter((channel) => channel.accountId === accountId);
		}
		return channels;
	}

	getChannel(channelId: string): ExecutionChannel | null {
		return this.getStateSnapshot().channels.find((channel) => channel.id === channelId) ?? null;
	}
}

export function resolveConfiguredDataSourceMode(
	envValue =
		import.meta.env?.[PLATFORM_DATA_SOURCE_ENV_KEY] ??
		(typeof process !== "undefined"
			? process.env?.[PLATFORM_DATA_SOURCE_ENV_KEY]
			: undefined),
): PlatformStateDataSourceMode {
	return envValue === "local-bridge-hybrid" ? envValue : "seed";
}

export function createPlatformState(
	dataSource: PlatformStateDataSource = resolveDefaultPlatformStateDataSource(),
): PlatformStateManager {
	return new PlatformStateManager(dataSource);
}

export function resolveDefaultPlatformStateDataSource(): PlatformStateDataSource {
	const mode = resolveConfiguredDataSourceMode();

	if (mode === "local-bridge-hybrid") {
		return new LocalBridgeHybridPlatformDataSource();
	}

	return new SeedPlatformDataSource();
}

export const platformState = createPlatformState();
