import { describe, it, expect } from 'vitest';
import { platformState } from '../../src/data/platformState';

describe('PlatformState', () => {
  it('should return all workspaces', () => {
    const workspaces = platformState.getWorkspaces();
    expect(workspaces).toHaveLength(2);
    expect(workspaces[0].id).toBe('ws-001');
    expect(workspaces[0].name).toBe('Default Workspace');
  });

  it('should return all accounts', () => {
    const accounts = platformState.getAccounts();
    expect(accounts).toHaveLength(2);
    expect(accounts[0].id).toBe('acc-001');
    expect(accounts[0].handle).toBe('@tweetpilot_demo');
  });

  it('should filter accounts by workspace', () => {
    const accounts = platformState.getAccounts('ws-001');
    expect(accounts).toHaveLength(1);
    expect(accounts[0].workspaceId).toBe('ws-001');
  });

  it('should return all instances', () => {
    const instances = platformState.getInstances();
    expect(instances).toHaveLength(2);
    expect(instances[0].id).toBe('inst-001');
    expect(instances[0].status).toBe('online');
  });

  it('should filter instances by account', () => {
    const instances = platformState.getInstances('acc-001');
    expect(instances).toHaveLength(1);
    expect(instances[0].accountId).toBe('acc-001');
  });

  it('should return all channels', () => {
    const channels = platformState.getChannels();
    expect(channels).toHaveLength(3);
    expect(channels[0].type).toBe('local-bridge');
    expect(channels[1].type).toBe('x-api');
  });

  it('should filter channels by account', () => {
    const channels = platformState.getChannels('acc-001');
    expect(channels).toHaveLength(2);
    expect(channels.every((ch) => ch.accountId === 'acc-001')).toBe(true);
  });
});
