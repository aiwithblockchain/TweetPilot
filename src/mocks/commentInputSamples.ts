// Standardized comment input samples for testing and development
// These samples reuse the same domain model as real inputs

import type { CreateCommentInputParams } from '../domain/commentInput';

/**
 * Standard comment input samples for testing
 * These represent typical comment inputs that would come from X/Twitter
 */
export const STANDARD_COMMENT_SAMPLES: CreateCommentInputParams[] = [
  {
    workspaceId: 'ws-test-001',
    accountId: 'acc-test-001',
    content: 'Great post! Thanks for sharing this insight.',
    targetTweetId: 'tweet-sample-001',
    targetTweetUrl: 'https://x.com/testuser/status/1234567890',
    metadata: {
      source: 'mock',
      authorUsername: 'test_commenter_1',
      authorId: 'user-001',
      timestamp: '2026-04-10T10:00:00Z',
    },
  },
  {
    workspaceId: 'ws-test-001',
    accountId: 'acc-test-001',
    content: 'Could you elaborate more on this point?',
    targetTweetId: 'tweet-sample-002',
    targetTweetUrl: 'https://x.com/testuser/status/1234567891',
    metadata: {
      source: 'mock',
      authorUsername: 'test_commenter_2',
      authorId: 'user-002',
      timestamp: '2026-04-10T10:05:00Z',
    },
  },
  {
    workspaceId: 'ws-test-001',
    accountId: 'acc-test-002',
    content: 'This is exactly what I was looking for!',
    targetTweetId: 'tweet-sample-003',
    targetTweetUrl: 'https://x.com/testuser/status/1234567892',
    metadata: {
      source: 'mock',
      authorUsername: 'test_commenter_3',
      authorId: 'user-003',
      timestamp: '2026-04-10T10:10:00Z',
    },
  },
  {
    workspaceId: 'ws-test-002',
    accountId: 'acc-test-003',
    content: 'Interesting perspective. I have a different view though.',
    targetTweetId: 'tweet-sample-004',
    targetTweetUrl: 'https://x.com/testuser/status/1234567893',
    metadata: {
      source: 'mock',
      authorUsername: 'test_commenter_4',
      authorId: 'user-004',
      timestamp: '2026-04-10T10:15:00Z',
    },
  },
];

/**
 * Get a specific sample by index
 */
export function getSample(index: number): CreateCommentInputParams {
  if (index < 0 || index >= STANDARD_COMMENT_SAMPLES.length) {
    throw new Error(`Sample index ${index} out of range`);
  }
  return STANDARD_COMMENT_SAMPLES[index];
}

/**
 * Get all samples for a specific workspace
 */
export function getSamplesByWorkspace(workspaceId: string): CreateCommentInputParams[] {
  return STANDARD_COMMENT_SAMPLES.filter((sample) => sample.workspaceId === workspaceId);
}

/**
 * Get all samples for a specific account
 */
export function getSamplesByAccount(accountId: string): CreateCommentInputParams[] {
  return STANDARD_COMMENT_SAMPLES.filter((sample) => sample.accountId === accountId);
}
