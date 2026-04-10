import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCommentInputRepository } from '../../src/data/commentInputRepository';
import { createCommentInput } from '../../src/domain/commentInput';

describe('InMemoryCommentInputRepository', () => {
  let repository: InMemoryCommentInputRepository;

  beforeEach(() => {
    repository = new InMemoryCommentInputRepository();
  });

  describe('save and findById', () => {
    it('should save and retrieve a comment input by ID', async () => {
      const commentInput = createCommentInput({
        workspaceId: 'ws-001',
        accountId: 'acc-001',
        content: 'Test comment',
        targetTweetId: 'tweet-123',
      });

      await repository.save(commentInput);
      const retrieved = await repository.findById(commentInput.id);

      expect(retrieved).toEqual(commentInput);
    });

    it('should return null for non-existent ID', async () => {
      const result = await repository.findById('non-existent-id');
      expect(result).toBeNull();
    });

    it('should overwrite existing comment input with same ID', async () => {
      const commentInput = createCommentInput({
        workspaceId: 'ws-001',
        accountId: 'acc-001',
        content: 'Original content',
        targetTweetId: 'tweet-123',
      });

      await repository.save(commentInput);

      const updated = { ...commentInput, content: 'Updated content' };
      await repository.save(updated);

      const retrieved = await repository.findById(commentInput.id);
      expect(retrieved?.content).toBe('Updated content');
    });
  });

  describe('findByAccountId', () => {
    it('should retrieve all comment inputs for a specific account', async () => {
      const comment1 = createCommentInput({
        workspaceId: 'ws-001',
        accountId: 'acc-001',
        content: 'Comment 1',
      });

      const comment2 = createCommentInput({
        workspaceId: 'ws-001',
        accountId: 'acc-001',
        content: 'Comment 2',
      });

      const comment3 = createCommentInput({
        workspaceId: 'ws-001',
        accountId: 'acc-002',
        content: 'Comment 3',
      });

      await repository.save(comment1);
      await repository.save(comment2);
      await repository.save(comment3);

      const results = await repository.findByAccountId('acc-001');

      expect(results).toHaveLength(2);
      expect(results.map((c) => c.id)).toContain(comment1.id);
      expect(results.map((c) => c.id)).toContain(comment2.id);
      expect(results.map((c) => c.id)).not.toContain(comment3.id);
    });

    it('should return empty array for account with no comments', async () => {
      const results = await repository.findByAccountId('non-existent-account');
      expect(results).toEqual([]);
    });
  });

  describe('findByWorkspaceId', () => {
    it('should retrieve all comment inputs for a specific workspace', async () => {
      const comment1 = createCommentInput({
        workspaceId: 'ws-001',
        accountId: 'acc-001',
        content: 'Comment 1',
      });

      const comment2 = createCommentInput({
        workspaceId: 'ws-001',
        accountId: 'acc-002',
        content: 'Comment 2',
      });

      const comment3 = createCommentInput({
        workspaceId: 'ws-002',
        accountId: 'acc-003',
        content: 'Comment 3',
      });

      await repository.save(comment1);
      await repository.save(comment2);
      await repository.save(comment3);

      const results = await repository.findByWorkspaceId('ws-001');

      expect(results).toHaveLength(2);
      expect(results.map((c) => c.id)).toContain(comment1.id);
      expect(results.map((c) => c.id)).toContain(comment2.id);
      expect(results.map((c) => c.id)).not.toContain(comment3.id);
    });

    it('should return empty array for workspace with no comments', async () => {
      const results = await repository.findByWorkspaceId('non-existent-workspace');
      expect(results).toEqual([]);
    });
  });

  describe('findAll', () => {
    it('should retrieve all comment inputs', async () => {
      const comment1 = createCommentInput({
        workspaceId: 'ws-001',
        accountId: 'acc-001',
        content: 'Comment 1',
      });

      const comment2 = createCommentInput({
        workspaceId: 'ws-002',
        accountId: 'acc-002',
        content: 'Comment 2',
      });

      await repository.save(comment1);
      await repository.save(comment2);

      const results = await repository.findAll();

      expect(results).toHaveLength(2);
      expect(results.map((c) => c.id)).toContain(comment1.id);
      expect(results.map((c) => c.id)).toContain(comment2.id);
    });

    it('should return empty array when no comments exist', async () => {
      const results = await repository.findAll();
      expect(results).toEqual([]);
    });
  });

  describe('exists', () => {
    it('should return true for existing comment input', async () => {
      const commentInput = createCommentInput({
        workspaceId: 'ws-001',
        accountId: 'acc-001',
        content: 'Test comment',
      });

      await repository.save(commentInput);
      const exists = await repository.exists(commentInput.id);

      expect(exists).toBe(true);
    });

    it('should return false for non-existent comment input', async () => {
      const exists = await repository.exists('non-existent-id');
      expect(exists).toBe(false);
    });
  });
});
