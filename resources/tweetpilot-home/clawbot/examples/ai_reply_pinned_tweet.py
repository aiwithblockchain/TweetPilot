"""Example: reply to a pinned tweet with AI-generated text."""

import argparse

from clawbot import ClawBotClient
from multi_instance_example import resolve_instance_id


def main() -> int:
    parser = argparse.ArgumentParser(description="Reply to a pinned tweet with AI")
    parser.add_argument("--username", default="openclaw", help="Target X username")
    parser.add_argument("--platform", default="grok", help="AI platform name")
    parser.add_argument("--instance-id", help="Explicit instanceId for multi-instance routing")
    args = parser.parse_args()

    client = ClawBotClient()
    instance_id = resolve_instance_id(client, preferred_instance_id=args.instance_id)
    result = client.workflows.reply_to_pinned_tweet_with_ai(
        args.username,
        args.platform,
        instance_id=instance_id,
    )
    print(f"instance_id: {instance_id}")
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
