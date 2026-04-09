import { describe, it, expect } from 'vitest';
import { seedPlatformState } from '../../src/data/seed';
import type { PlatformState } from '../../src/domain/types';

describe('Seed Data Contract', () => {
  it('should have valid platform state structure', () => {
    expect(seedPlatformState).toBeDefined();
    expect(seedPlatformState.workspaces).toBeInstanceOf(Array);
    expect(seedPlatformState.accounts).toBeInstanceOf(Array);
    expect(seedPlatformState.instances).toBeInstanceOf(Array);
    expect(seedPlatformState.channels).toBeInstanceOf(Array);
  });

  it('should have at least one workspace', () => {
    expect(seedPlatformState.workspaces.length).toBeGreaterThan(0);
    const workspace = seedPlatformState.workspaces[0];
    expect(workspace.id).toBeDefined();
    expect(workspace.name).toBeDefined();
  });

  it('should have accounts linked to workspaces', () => {
    expect(seedPlatformState.accounts.length).toBeGreaterThan(0);
    const account = seedPlatformState.accounts[0];
    expect(account.id).toBeDefined();
    expect(account.workspaceId).toBeDefined();
    expect(account.handle).toBeDefined();
    expect(account.displayName).toBeDefined();
    expect(account.status).toMatch(/^(active|inactive)$/);
  });

  it('should have instances linked to accounts', () => {
    expect(seedPlatformState.instances.length).toBeGreaterThan(0);
    const instance = seedPlatformState.instances[0];
    expect(instance.id).toBeDefined();
    expect(instance.accountId).toBeDefined();
    expect(instance.name).toBeDefined();
    expect(instance.status).toMatch(/^(online|offline)$/);
    expect(instance.capabilities).toBeInstanceOf(Array);
  });

  it('should have channels linked to accounts', () => {
    expect(seedPlatformState.channels.length).toBeGreaterThan(0);
    const channel = seedPlatformState.channels[0];
    expect(channel.id).toBeDefined();
    expect(channel.accountId).toBeDefined();
    expect(channel.name).toBeDefined();
    expect(channel.type).toMatch(/^(local-bridge|x-api|x-mcp)$/);
    expect(channel.status).toMatch(/^(available|unavailable)$/);
  });

  it('should maintain referential integrity', () => {
    const workspaceIds = new Set(seedPlatformState.workspaces.map((w) => w.id));
    const accountIds = new Set(seedPlatformState.accounts.map((a) => a.id));

    // All accounts should reference existing workspaces
    seedPlatformState.accounts.forEach((account) => {
      expect(workspaceIds.has(account.workspaceId)).toBe(true);
    });

    // All instances should reference existing accounts
    seedPlatformState.instances.forEach((instance) => {
      expect(accountIds.has(instance.accountId)).toBe(true);
    });

    // All channels should reference existing accounts
    seedPlatformState.channels.forEach((channel) => {
      expect(accountIds.has(channel.accountId)).toBe(true);
    });
  });
});
