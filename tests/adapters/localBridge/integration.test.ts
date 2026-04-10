// Integration tests for LocalBridge adapter to CommentInput repository
// Verifies that adapted replies can be saved to and retrieved from the fact layer

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCommentInputRepository } from '../../../src/data/commentInputRepository';
import { createCommentInput } from '../../../src/domain/commentInput';
import { extractRepliesFromResponse, mapReplyToCommentInputParams } from '../../../src/adapters/localBridge/mapper';
import { tweetRepliesFixture } from '../../../src/adapters/localBridge/fixtures';

describe('LocalBridge to CommentInput Integration', () => {
  let repository: InMemoryCommentInputRepository;

  beforeEach(() => {
    repository = new InMemoryCommentInputRepository();
  });

  it('should save adapted replies to fact layer repository', async () => {
    // Extract replies from LocalBridge response
    const replies = extractRepliesFromResponse(tweetRepliesFixture, '1234567890');
    expect(replies.length).toBeGreaterThan(0);

    // Map first reply to CommentInput params
    const params = mapReplyToCommentInputParams(replies[0], 'workspace-1', 'account-1');

    // Create CommentInput domain object
    const commentInput = createCommentInput(params);

    // Save to repository
    await repository.save(commentInput);

    // Verify it was saved
    const exists = await repository.exists(commentInput.id);
    expect(exists).toBe(true);

    // Retrieve and verify
    const retrieved = await repository.findById(commentInput.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.content).toBe('This is a reply to the tweet');
    expect(retrieved?.workspaceId).toBe('workspace-1');
    expect(retrieved?.accountId).toBe('account-1');
    expect(retrieved?.targetTweetId).toBe('1234567890');
  });

  it('should save multiple replies and retrieve by account', async () => {
    const replies = extractRepliesFromResponse(tweetRepliesFixture, '1234567890');

    // Save all replies for the same account
    for (const reply of replies) {
      const params = mapReplyToCommentInputParams(reply, 'workspace-1', 'account-1');
      const commentInput = createCommentInput(params);
      await repository.save(commentInput);
    }

    // Retrieve all by account
    const accountComments = await repository.findByAccountId('account-1');
    expect(accountComments.length).toBe(2);
  });

  it('should save multiple replies and retrieve by workspace', async () => {
    const replies = extractRepliesFromResponse(tweetRepliesFixture, '1234567890');

    // Save replies for different accounts in same workspace
    const reply1Params = mapReplyToCommentInputParams(replies[0], 'workspace-1', 'account-1');
    const reply2Params = mapReplyToCommentInputParams(replies[1], 'workspace-1', 'account-2');

    await repository.save(createCommentInput(reply1Params));
    await repository.save(createCommentInput(reply2Params));

    // Retrieve all by workspace
    const workspaceComments = await repository.findByWorkspaceId('workspace-1');
    expect(workspaceComments.length).toBe(2);
  });

  it('should preserve metadata from LocalBridge response', async () => {
    const replies = extractRepliesFromResponse(tweetRepliesFixture, '1234567890');
    const params = mapReplyToCommentInputParams(replies[0], 'workspace-1', 'account-1');
    const commentInput = createCommentInput(params);

    await repository.save(commentInput);

    const retrieved = await repository.findById(commentInput.id);
    expect(retrieved?.metadata).toBeDefined();
    expect(retrieved?.metadata?.authorId).toBe('1111111111');
    expect(retrieved?.metadata?.authorScreenName).toBe('reply_author_1');
    expect(retrieved?.metadata?.tweetId).toBe('1234567891');
  });

  it('should handle empty replies response gracefully', async () => {
    const emptyResponse = {
      data: {
        threaded_conversation_with_injections_v2: {
          instructions: [],
        },
      },
    };

    const replies = extractRepliesFromResponse(emptyResponse, '1234567890');
    expect(replies).toEqual([]);
  });
});
