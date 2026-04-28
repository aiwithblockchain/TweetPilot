#!/usr/bin/env python3
"""Example migrated from legacy write API tests."""

from clawbot import ClawBotClient
from multi_instance_example import resolve_instance_id


def main() -> int:
    client = ClawBotClient()
    instance_id = resolve_instance_id(client)

    print("\n🧪 Write API examples via clawbot")
    print("=" * 60)
    print("⚠️  These examples perform real actions on your X account!")
    print(f"Resolved instance_id: {instance_id}")

    text = input("Enter tweet text (default: Test from clawbot): ").strip() or "Test from clawbot"
    confirm = input("Create tweet? (yes/no): ").strip().lower()
    if confirm == "yes":
        result = client.x.actions.create_tweet(text, instance_id=instance_id)
        print(result)

    tweet_id = input("Enter tweet ID to like (or press Enter to skip): ").strip()
    if tweet_id:
        print(client.x.actions.like(tweet_id, instance_id=instance_id))

    tweet_id = input("Enter tweet ID to retweet (or press Enter to skip): ").strip()
    if tweet_id:
        print(client.x.actions.retweet(tweet_id, instance_id=instance_id))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
