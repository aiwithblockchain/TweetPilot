import { describe, it, expect } from 'vitest';
import {
  createCommentInput,
  generateCommentInputId,
  type CreateCommentInputParams,
} from '../../src/domain/commentInput';

describe('CommentInput Domain Object', () => {
  describe('generateCommentInputId', () => {
    it('should generate consistent IDs for identical inputs', () => {
      const params: CreateCommentInputParams = {
        workspaceId: 'ws-001',
        accountId: 'acc-001',
        content: 'This is a test comment',
        targetTweetId: 'tweet-123',
      };

      const id1 = generateCommentInputId(params);
      const id2 = generateCommentInputId(params);

      expect(id1).toBe(id2);
    });

    it('should generate different IDs for different content', () => {
      const params1: CreateCommentInputParams = {
        workspaceId: 'ws-001',
        accountId: 'acc-001',
        content: 'First comment',
        targetTweetId: 'tweet-123',
      };

      const params2: CreateCommentInputParams = {
        workspaceId: 'ws-001',
        accountId: 'acc-001',
        content: 'Second comment',
        targetTweetId: 'tweet-123',
      };

      const id1 = generateCommentInputId(params1);
      const id2 = generateCommentInputId(params2);

      expect(id1).not.toBe(id2);
    });

    it('should normalize content (case-insensitive and trim)', () => {
      const params1: CreateCommentInputParams = {
        workspaceId: 'ws-001',
        accountId: 'acc-001',
        content: '  Hello World  ',
        targetTweetId: 'tweet-123',
      };

      const params2: CreateCommentInputParams = {
        workspaceId: 'ws-001',
        accountId: 'acc-001',
        content: 'hello world',
        targetTweetId: 'tweet-123',
      };

      const id1 = generateCommentInputId(params1);
      const id2 = generateCommentInputId(params2);

      expect(id1).toBe(id2);
    });

    it('should generate different IDs for different target tweets', () => {
      const params1: CreateCommentInputParams = {
        workspaceId: 'ws-001',
        accountId: 'acc-001',
        content: 'Same comment',
        targetTweetId: 'tweet-123',
      };

      const params2: CreateCommentInputParams = {
        workspaceId: 'ws-001',
        accountId: 'acc-001',
        content: 'Same comment',
        targetTweetId: 'tweet-456',
      };

      const id1 = generateCommentInputId(params1);
      const id2 = generateCommentInputId(params2);

      expect(id1).not.toBe(id2);
    });

    it('should generate different IDs for different accounts', () => {
      const params1: CreateCommentInputParams = {
        workspaceId: 'ws-001',
        accountId: 'acc-001',
        content: 'Same comment',
        targetTweetId: 'tweet-123',
      };

      const params2: CreateCommentInputParams = {
        workspaceId: 'ws-001',
        accountId: 'acc-002',
        content: 'Same comment',
        targetTweetId: 'tweet-123',
      };

      const id1 = generateCommentInputId(params1);
      const id2 = generateCommentInputId(params2);

      expect(id1).not.toBe(id2);
    });
  });

  describe('createCommentInput', () => {
    it('should create a comment input with all required fields', () => {
      const params: CreateCommentInputParams = {
        workspaceId: 'ws-001',
        accountId: 'acc-001',
        content: 'Test comment',
        targetTweetId: 'tweet-123',
        targetTweetUrl: 'https://x.com/user/status/123',
        metadata: { source: 'manual' },
      };

      const commentInput = createCommentInput(params);

      expect(commentInput.id).toBeDefined();
      expect(commentInput.workspaceId).toBe('ws-001');
      expect(commentInput.accountId).toBe('acc-001');
      expect(commentInput.content).toBe('Test comment');
      expect(commentInput.targetTweetId).toBe('tweet-123');
      expect(commentInput.targetTweetUrl).toBe('https://x.com/user/status/123');
      expect(commentInput.createdAt).toBeInstanceOf(Date);
      expect(commentInput.metadata).toEqual({ source: 'manual' });
    });

    it('should create a comment input without optional fields', () => {
      const params: CreateCommentInputParams = {
        workspaceId: 'ws-001',
        accountId: 'acc-001',
        content: 'Test comment',
      };

      const commentInput = createCommentInput(params);

      expect(commentInput.id).toBeDefined();
      expect(commentInput.targetTweetId).toBeUndefined();
      expect(commentInput.targetTweetUrl).toBeUndefined();
      expect(commentInput.metadata).toBeUndefined();
    });
  });
});
