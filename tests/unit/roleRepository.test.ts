import { beforeEach, describe, expect, it } from 'vitest';
import { createRole } from '../../src/domain/role';
import { createCandidateReply } from '../../src/domain/candidateReply';
import { InMemoryCandidateReplyRepository } from '../../src/data/repositories/InMemoryCandidateReplyRepository';
import { InMemoryRoleRepository } from '../../src/data/repositories/InMemoryRoleRepository';

describe('InMemoryRoleRepository', () => {
  let candidateReplyRepository: InMemoryCandidateReplyRepository;
  let repository: InMemoryRoleRepository;

  beforeEach(() => {
    candidateReplyRepository = new InMemoryCandidateReplyRepository();
    repository = new InMemoryRoleRepository(candidateReplyRepository);
  });

  it('should save and retrieve a role by id', async () => {
    const role = createRole({
      name: '友好助手',
      description: '轻量互动场景',
      prompt: '以友好助手风格回复。',
      workspaceId: 'ws-001',
    });

    await repository.save(role);

    await expect(repository.findById(role.id)).resolves.toEqual(role);
  });

  it('should return roles filtered by workspace', async () => {
    const ws1Role = createRole({
      name: '客服',
      description: '客服',
      prompt: '客服 prompt',
      workspaceId: 'ws-001',
    });
    const ws2Role = createRole({
      name: '增长',
      description: '增长',
      prompt: '增长 prompt',
      workspaceId: 'ws-002',
    });

    await repository.save(ws1Role);
    await repository.save(ws2Role);

    const roles = await repository.findByWorkspace('ws-001');

    expect(roles).toHaveLength(1);
    expect(roles[0].id).toBe(ws1Role.id);
  });

  it('should bind account roles and query the default role', async () => {
    const firstRole = createRole({
      name: '专业客服',
      description: '客服',
      prompt: '客服 prompt',
      workspaceId: 'ws-001',
    });
    const secondRole = createRole({
      name: '友好助手',
      description: '助手',
      prompt: '助手 prompt',
      workspaceId: 'ws-001',
    });

    await repository.save(firstRole);
    await repository.save(secondRole);
    await repository.bindRole('acc-001', firstRole.id, true);
    await repository.bindRole('acc-001', secondRole.id, false);

    const roles = await repository.getAccountRoles('acc-001');
    const defaultRole = await repository.getDefaultRole('acc-001');

    expect(roles.map((role) => role.id)).toEqual([firstRole.id, secondRole.id]);
    expect(defaultRole?.id).toBe(firstRole.id);
  });

  it('should switch default role when rebinding an existing role as default', async () => {
    const firstRole = createRole({
      name: '专业客服',
      description: '客服',
      prompt: '客服 prompt',
      workspaceId: 'ws-001',
    });
    const secondRole = createRole({
      name: '友好助手',
      description: '助手',
      prompt: '助手 prompt',
      workspaceId: 'ws-001',
    });

    await repository.save(firstRole);
    await repository.save(secondRole);
    await repository.bindRole('acc-001', firstRole.id, true);
    await repository.bindRole('acc-001', secondRole.id, false);

    await repository.bindRole('acc-001', secondRole.id, true);

    await expect(repository.getDefaultRole('acc-001')).resolves.toMatchObject({
      id: secondRole.id,
    });
  });

  it('should reject binding a role that does not exist', async () => {
    await expect(
      repository.bindRole('acc-001', 'role-missing', true)
    ).rejects.toThrow(/does not exist/i);
  });

  it('should ignore unbinding a role that is not currently bound', async () => {
    await expect(
      repository.unbindRole('acc-001', 'role-missing')
    ).resolves.toBeUndefined();
  });

  it('should return null when an account has no default role', async () => {
    await expect(repository.getDefaultRole('acc-unknown')).resolves.toBeNull();
  });

  it('should prevent deleting roles referenced by candidate replies', async () => {
    const role = createRole({
      name: '专业客服',
      description: '客服',
      prompt: '客服 prompt',
      workspaceId: 'ws-001',
    });
    await repository.save(role);
    await candidateReplyRepository.save(
      createCandidateReply({
        commentInputId: 'ci-001',
        accountId: 'acc-001',
        roleId: role.id,
        workspaceId: 'ws-001',
        content: 'reply',
        riskLevel: 'low',
        confidence: 0.8,
        modelSource: 'claude',
        knowledgeHits: 1,
      })
    );

    await expect(repository.delete(role.id)).rejects.toThrow(
      /candidate replies reference this role/i
    );
  });
});
