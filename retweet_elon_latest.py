#!/usr/bin/env python3
"""
Script to find and interact with Elon Musk's latest tweet.
Searches for Elon Musk's profile, gets his latest non-pinned tweet,
then retweets, likes, and bookmarks it.
"""

import sys
sys.path.insert(0, '/Users/hyperorchid/.tweetpilot/clawbot')

from clawbot import ClawBotClient


def main():
    client = ClawBotClient()

    print("🔍 Searching for Elon Musk's profile...")

    # Get Elon Musk's user info by screen name
    user = client.x.users.get_user("elonmusk")
    print(f"✅ Found user: @{user.screen_name} ({user.name})")
    print(f"   User ID: {user.id}")

    # Get user's tweets from profile
    print(f"\n📋 Fetching tweets from @{user.screen_name}'s profile...")
    tweets = client.x.tweets.get_user_tweets(user.id, count=10)

    if not tweets:
        print("❌ No tweets found")
        return 1

    print(f"✅ Found {len(tweets)} tweets")

    # Find first non-pinned tweet (latest tweet)
    latest_tweet = None
    for tweet in tweets:
        # Check if tweet is pinned by looking at the raw data
        is_pinned = tweet.raw.get("is_pinned", False) if hasattr(tweet, 'raw') else False

        if not is_pinned:
            latest_tweet = tweet
            break

    if not latest_tweet:
        print("❌ No non-pinned tweets found")
        return 1

    print(f"\n🎯 Latest tweet found:")
    print(f"   ID: {latest_tweet.id}")
    print(f"   Text: {latest_tweet.text[:100]}{'...' if len(latest_tweet.text) > 100 else ''}")
    print(f"   Created: {latest_tweet.created_at if hasattr(latest_tweet, 'created_at') else 'N/A'}")

    # Interact with the tweet
    print(f"\n🚀 Interacting with tweet {latest_tweet.id}...")

    # Retweet
    print("   📢 Retweeting...")
    retweet_result = client.x.actions.retweet(latest_tweet.id)
    if retweet_result.success:
        print("   ✅ Retweeted successfully")
    else:
        print(f"   ❌ Retweet failed: {retweet_result.error}")

    # Like
    print("   ❤️  Liking...")
    like_result = client.x.actions.like(latest_tweet.id)
    if like_result.success:
        print("   ✅ Liked successfully")
    else:
        print(f"   ❌ Like failed: {like_result.error}")

    # Bookmark
    print("   🔖 Bookmarking...")
    bookmark_result = client.x.actions.bookmark(latest_tweet.id)
    if bookmark_result.success:
        print("   ✅ Bookmarked successfully")
    else:
        print(f"   ❌ Bookmark failed: {bookmark_result.error}")

    print(f"\n✨ Done! Interacted with @{user.screen_name}'s latest tweet")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
