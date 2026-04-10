import { seedPlatformState } from "../data/seed";
import type {
	Account,
	ExecutionChannel,
	Instance,
	PlatformState,
	Workspace,
} from "../domain/types";

// Platform state manager
// In subsequent task cards, this will be replaced with real data sources
class PlatformStateManager {
	private state: PlatformState;

	constructor(initialState: PlatformState) {
		this.state = initialState;
	}

	getWorkspaces(): Workspace[] {
		return this.state.workspaces;
	}

	getAccounts(workspaceId?: string): Account[] {
		if (workspaceId) {
			return this.state.accounts.filter(
				(acc) => acc.workspaceId === workspaceId,
			);
		}
		return this.state.accounts;
	}

	getInstances(accountId?: string): Instance[] {
		if (accountId) {
			return this.state.instances.filter(
				(inst) => inst.accountId === accountId,
			);
		}
		return this.state.instances;
	}

	getChannels(accountId?: string): ExecutionChannel[] {
		if (accountId) {
			return this.state.channels.filter((ch) => ch.accountId === accountId);
		}
		return this.state.channels;
	}

	getState(): PlatformState {
		return this.state;
	}
}

// Export singleton instance
export const platformState = new PlatformStateManager(seedPlatformState);
