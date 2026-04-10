// Contract tests for LocalBridge API responses
// These tests verify that our adapter can handle LocalBridge response structures

import { describe, it, expect } from 'vitest';
import {
  instancesFixture,
  tabStatusFixture,
  tweetRepliesFixture,
} from '../../../src/adapters/localBridge/fixtures';
import { extractRepliesFromResponse, mapReplyToCommentInputParams } from '../../../src/adapters/localBridge/mapper';

describe('LocalBridge Contract Tests', () => {
  describe('Instance Query Response Structure', () => {
    it('should have expected structure for instance objects', () => {
      const instance = instancesFixture[0];

      expect(instance).toHaveProperty('instanceId');
      expect(instance).toHaveProperty('instanceName');
      expect(instance).toHaveProperty('clientName');
      expect(instance).toHaveProperty('clientVersion');
      expect(instance).toHaveProperty('capabilities');
      expect(instance).toHaveProperty('connectedAt');
      expect(instance).toHaveProperty('lastSeenAt');
      expect(instance).toHaveProperty('isTemporary');

      expect(typeof instance.instanceId).toBe('string');
      expect(typeof instance.instanceName).toBe('string');
      expect(Array.isArray(instance.capabilities)).toBe(true);
    });
  });

  describe('Tab Status Response Structure', () => {
    it('should have expected structure for tab status', () => {
      expect(tabStatusFixture).toHaveProperty('tabs');
      expect(tabStatusFixture).toHaveProperty('hasXTabs');
      expect(tabStatusFixture).toHaveProperty('isLoggedIn');

      expect(Array.isArray(tabStatusFixture.tabs)).toBe(true);
      expect(typeof tabStatusFixture.hasXTabs).toBe('boolean');
      expect(typeof tabStatusFixture.isLoggedIn).toBe('boolean');

      const tab = tabStatusFixture.tabs[0];
      expect(tab).toHaveProperty('tabId');
      expect(tab).toHaveProperty('url');
      expect(tab).toHaveProperty('active');
      expect(typeof tab.tabId).toBe('number');
    });
  });

  describe('Tweet Replies Response Structure', () => {
    it('should have expected nested structure for replies', () => {
      expect(tweetRepliesFixture).toHaveProperty('data');
      expect(tweetRepliesFixture.data).toHaveProperty('threaded_conversation_with_injections_v2');

      const conversation = tweetRepliesFixture.data?.threaded_conversation_with_injections_v2;
      expect(conversation).toHaveProperty('instructions');
      expect(Array.isArray(conversation?.instructions)).toBe(true);

      const instruction = conversation?.instructions?.[0];
      expect(instruction).toHaveProperty('type');
      expect(instruction).toHaveProperty('entries');
      expect(Array.isArray(instruction?.entries)).toBe(true);
    });

    it('should extract replies from fixture response', () => {
      const replies = extractRepliesFromResponse(tweetRepliesFixture, '1234567890');

      // Should extract 2 replies (excluding the original tweet)
      expect(replies).toHaveLength(2);

      const reply1 = replies[0];
      expect(reply1.tweetId).toBe('1234567891');
      expect(reply1.authorScreenName).toBe('reply_author_1');
      expect(reply1.content).toBe('This is a reply to the tweet');
      expect(reply1.targetTweetId).toBe('1234567890');

      const reply2 = replies[1];
      expect(reply2.tweetId).toBe('1234567892');
      expect(reply2.authorScreenName).toBe('reply_author_2');
    });
  });

  describe('Reply to CommentInput Mapping', () => {
    it('should map reply to platform CommentInput params', () => {
      const replies = extractRepliesFromResponse(tweetRepliesFixture, '1234567890');
      const reply = replies[0];

      const params = mapReplyToCommentInputParams(reply, 'ws-1', 'acc-1');

      expect(params.workspaceId).toBe('ws-1');
      expect(params.accountId).toBe('acc-1');
      expect(params.content).toBe('This is a reply to the tweet');
      expect(params.targetTweetId).toBe('1234567890');
      expect(params.targetTweetUrl).toContain('reply_author_1');
      expect(params.targetTweetUrl).toContain('1234567891');

      expect(params.metadata).toHaveProperty('authorId');
      expect(params.metadata).toHaveProperty('authorScreenName');
      expect(params.metadata).toHaveProperty('tweetId');
      expect(params.metadata).toHaveProperty('createdAt');
    });
  });
});
