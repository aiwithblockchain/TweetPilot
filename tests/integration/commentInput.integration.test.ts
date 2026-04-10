import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCommentInputRepository } from '../../src/data/commentInputRepository';
import { createCommentInput } from '../../src/domain/commentInput';

describe('CommentInput Integration Tests', () => {
  let repository: InMemoryCommentInputRepository;

  beforeEach(() => {
    repository = new InMemoryCommentInputRepository();
  });

  it('should write a comment input as a fact and retrieve it later', async () => {
    const commentInput = createCommentInput({
      workspaceId: 'ws-001',
      accountId: 'acc-001',
      content: 'This is a test comment for integration testing',
      targetTweetId: 'tweet-12345',
      targetTweetUrl: 'https://x.com/user/status/12345',
      metadata: {
        source: 'manual',
        timestamp: Date.now(),
      },
    });

    await repository.save(commentInput);

    const exists = await repository.exists(commentInput.id);
    expect(exists).toBe(true);

    const retrieved = await repository.findById(commentInput.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(commentInput.id);
    expect(retrieved?.content).toBe('This is a test comment for integration testing');
    expect(retrieved?.workspaceId).toBe('ws-001');
    expect(retrieved?.accountId).toBe('acc-001');
    expect(retrieved?.targetTweetId).toBe('tweet-12345');
  });

  it('should support multiple comment inputs for the same account', async () => {
    const comment1 = createCommentInput({
      workspaceId: 'ws-001',
      accountId: 'acc-001',
      content: 'First comment',
      targetTweetId: 'tweet-001',
    });

    const comment2 = createCommentInput({
      workspaceId: 'ws-001',
      accountId: 'acc-001',
      content: 'Second comment',
      targetTweetId: 'tweet-002',
    });

    const comment3 = createCommentInput({
      workspaceId: 'ws-001',
      accountId: 'acc-001',
      content: 'Third comment',
      targetTweetId: 'tweet-003',
    });

    await repository.save(comment1);
    await repository.save(comment2);
    await repository.save(comment3);

    const accountComments = await repository.findByAccountId('acc-001');
    expect(accountComments).toHaveLength(3);

    const ids = accountComments.map((c) => c.id);
    expect(ids).toContain(comment1.id);
    expect(ids).toContain(comment2.id);
    expect(ids).toContain(comment3.id);
  });

  it('should support querying by workspace across multiple accounts', async () => {
    const comment1 = createCommentInput({
      workspaceId: 'ws-001',
      accountId: 'acc-001',
      content: 'Comment from account 1',
    });

    const comment2 = createCommentInput({
      workspaceId: 'ws-001',
      accountId: 'acc-002',
      content: 'Comment from account 2',
    });

    const comment3 = createCommentInput({
      workspaceId: 'ws-002',
      accountId: 'acc-003',
      content: 'Comment from different workspace',
    });

    await repository.save(comment1);
    await repository.save(comment2);
    await repository.save(comment3);

    const ws001Comments = await repository.findByWorkspaceId('ws-001');
    expect(ws001Comments).toHaveLength(2);

    const ws002Comments = await repository.findByWorkspaceId('ws-002');
    expect(ws002Comments).toHaveLength(1);
    expect(ws002Comments[0].id).toBe(comment3.id);
  });

  it('should handle idempotent writes (same content produces same ID)', async () => {
    const params = {
      workspaceId: 'ws-001',
      accountId: 'acc-001',
      content: 'Duplicate content test',
      targetTweetId: 'tweet-999',
    };

    const comment1 = createCommentInput(params);
    const comment2 = createCommentInput(params);

    expect(comment1.id).toBe(comment2.id);

    await repository.save(comment1);
    const firstSave = await repository.findById(comment1.id);
    expect(firstSave).not.toBeNull();

    await repository.save(comment2);
    const secondSave = await repository.findById(comment2.id);
    expect(secondSave).not.toBeNull();

    const allComments = await repository.findAll();
    const matchingComments = allComments.filter((c) => c.id === comment1.id);
    expect(matchingComments).toHaveLength(1);
  });

  it('should persist comment inputs as platform facts independent of UI state', async () => {
    const comments = [
      createCommentInput({
        workspaceId: 'ws-001',
        accountId: 'acc-001',
        content: 'First user input',
        targetTweetId: 'tweet-100',
      }),
      createCommentInput({
        workspaceId: 'ws-001',
        accountId: 'acc-001',
        content: 'Second user input',
        targetTweetId: 'tweet-101',
      }),
      createCommentInput({
        workspaceId: 'ws-001',
        accountId: 'acc-001',
        content: 'Third user input',
        targetTweetId: 'tweet-102',
      }),
    ];

    for (const comment of comments) {
      await repository.save(comment);
    }

    const allFacts = await repository.findAll();
    expect(allFacts.length).toBeGreaterThanOrEqual(3);

    for (const comment of comments) {
      const retrieved = await repository.findById(comment.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.content).toBe(comment.content);
    }

    const byAccount = await repository.findByAccountId('acc-001');
    expect(byAccount.length).toBeGreaterThanOrEqual(3);

    const byWorkspace = await repository.findByWorkspaceId('ws-001');
    expect(byWorkspace.length).toBeGreaterThanOrEqual(3);
  });
});
