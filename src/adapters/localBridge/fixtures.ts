// Contract test fixtures for LocalBridge API responses
// These fixtures help detect breaking changes in LocalBridge response structure

import type {
  LocalBridgeInstance,
  LocalBridgeTabStatus,
  LocalBridgeRepliesResponse,
} from './types';

// Fixture: Instance query response
export const instancesFixture: LocalBridgeInstance[] = [
  {
    clientName: 'tweetClaw',
    instanceId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    instanceName: 'mac pro ws sonic2',
    clientVersion: '0.3.17',
    capabilities: ['query_x_tabs_status', 'query_x_basic_info'],
    connectedAt: '2025-01-01T10:00:00Z',
    lastSeenAt: '2025-01-01T10:05:00Z',
    isTemporary: false,
  },
];

// Fixture: Tab status response
export const tabStatusFixture: LocalBridgeTabStatus = {
  tabs: [
    {
      tabId: 123456789,
      url: 'https://x.com/home',
      active: true,
    },
  ],
  activeXUrl: 'https://x.com/home',
  hasXTabs: true,
  isLoggedIn: true,
  activeXTabId: 123456789,
};

// Fixture: Tweet replies response
export const tweetRepliesFixture: LocalBridgeRepliesResponse = {
  data: {
    threaded_conversation_with_injections_v2: {
      instructions: [
        {
          type: 'TimelineAddEntries',
          entries: [
            {
              entryId: 'tweet-1234567890',
              content: {
                entryType: 'TimelineTimelineItem',
                itemContent: {
                  itemType: 'TimelineTweet',
                  tweet_results: {
                    result: {
                      __typename: 'Tweet',
                      rest_id: '1234567890',
                      core: {
                        user_results: {
                          result: {
                            rest_id: '9876543210',
                            legacy: {
                              screen_name: 'original_author',
                              name: 'Original Author',
                            },
                          },
                        },
                      },
                      legacy: {
                        created_at: 'Mon Jan 01 00:00:00 +0000 2024',
                        full_text: 'This is the original tweet',
                        favorite_count: 10,
                        retweet_count: 5,
                      },
                    },
                  },
                },
              },
            },
            {
              entryId: 'conversationthread-1234567891',
              content: {
                entryType: 'TimelineTimelineItem',
                itemContent: {
                  itemType: 'TimelineTweet',
                  tweet_results: {
                    result: {
                      __typename: 'Tweet',
                      rest_id: '1234567891',
                      core: {
                        user_results: {
                          result: {
                            rest_id: '1111111111',
                            legacy: {
                              screen_name: 'reply_author_1',
                              name: 'Reply Author 1',
                            },
                          },
                        },
                      },
                      legacy: {
                        created_at: 'Mon Jan 01 01:00:00 +0000 2024',
                        full_text: 'This is a reply to the tweet',
                      },
                    },
                  },
                },
              },
            },
            {
              entryId: 'conversationthread-1234567892',
              content: {
                entryType: 'TimelineTimelineItem',
                itemContent: {
                  itemType: 'TimelineTweet',
                  tweet_results: {
                    result: {
                      __typename: 'Tweet',
                      rest_id: '1234567892',
                      core: {
                        user_results: {
                          result: {
                            rest_id: '2222222222',
                            legacy: {
                              screen_name: 'reply_author_2',
                              name: 'Reply Author 2',
                            },
                          },
                        },
                      },
                      legacy: {
                        created_at: 'Mon Jan 01 02:00:00 +0000 2024',
                        full_text: 'Another reply to the tweet',
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    },
  },
};
