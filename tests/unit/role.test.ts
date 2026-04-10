import { describe, expect, it } from 'vitest';
import { createRole } from '../../src/domain/role';
import { createAccountRole } from '../../src/domain/accountRole';

describe('Role Domain', () => {
  it('should create a role with prompt and workspace attribution', () => {
    const role = createRole({
      name: '专业客服',
      description: '处理标准客服场景',
      prompt: '请用专业客服口吻回复用户。',
      workspaceId: 'ws-001',
      metadata: { tone: 'professional' },
    });

    expect(role.id).toBeDefined();
    expect(role.name).toBe('专业客服');
    expect(role.description).toBe('处理标准客服场景');
    expect(role.prompt).toBe('请用专业客服口吻回复用户。');
    expect(role.workspaceId).toBe('ws-001');
    expect(role.createdAt).toBeInstanceOf(Date);
    expect(role.metadata).toEqual({ tone: 'professional' });
  });

  it('should create an account-role binding with default marker', () => {
    const binding = createAccountRole({
      accountId: 'acc-001',
      roleId: 'role-001',
      isDefault: true,
    });

    expect(binding.accountId).toBe('acc-001');
    expect(binding.roleId).toBe('role-001');
    expect(binding.isDefault).toBe(true);
    expect(binding.createdAt).toBeInstanceOf(Date);
  });
});
