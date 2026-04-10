import { beforeEach, describe, expect, it } from 'vitest';
import { createCandidateReply } from '../../src/domain/candidateReply';
import { createRole } from '../../src/domain/role';
import { InMemoryCandidateReplyRepository } from '../../src/data/repositories/InMemoryCandidateReplyRepository';
import { InMemoryRoleRepository } from '../../src/data/repositories/InMemoryRoleRepository';

describe('Role Repository Integration', () => {
  let candidateReplyRepository: InMemoryCandidateReplyRepository;
  let repository: InMemoryRoleRepository;

  beforeEach(() => {
    candidateReplyRepository = new InMemoryCandidateReplyRepository();
    repository = new InMemoryRoleRepository(candidateReplyRepository);
  });

  it('should return roles after an account is bound to them', async () => {
    const role = createRole({
      name: '专业客服',
      description: '客服',
      prompt: '客服 prompt',
      workspaceId: 'ws-001',
    });

    await repository.save(role);
    await repository.bindRole('acc-001', role.id, true);

    const roles = await repository.getAccountRoles('acc-001');

    expect(roles).toHaveLength(1);
    expect(roles[0].id).toBe(role.id);
  });

  it('should switch default role when another bound role becomes default', async () => {
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

    const defaultRole = await repository.getDefaultRole('acc-001');
    expect(defaultRole?.id).toBe(secondRole.id);
  });

  it('should reject deleting a role referenced by candidate replies', async () => {
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
        confidence: 0.75,
        modelSource: 'claude',
        knowledgeHits: 2,
      })
    );

    await expect(repository.delete(role.id)).rejects.toThrow(
      /candidate replies reference this role/i
    );
  });

  it('should reject deleting a role that is still bound to an account', async () => {
    const role = createRole({
      name: '专业客服',
      description: '客服',
      prompt: '客服 prompt',
      workspaceId: 'ws-001',
    });

    await repository.save(role);
    await repository.bindRole('acc-001', role.id, true);

    await expect(repository.delete(role.id)).rejects.toThrow(
      /accounts are bound to this role/i
    );
  });

  it('should delete an unused role successfully', async () => {
    const role = createRole({
      name: '专业客服',
      description: '客服',
      prompt: '客服 prompt',
      workspaceId: 'ws-001',
    });

    await repository.save(role);
    await repository.delete(role.id);

    await expect(repository.findById(role.id)).resolves.toBeNull();
  });
});
