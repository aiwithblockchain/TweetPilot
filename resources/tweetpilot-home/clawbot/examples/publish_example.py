#!/usr/bin/env python3
"""Example focused on publishing and replying with optional media."""

import argparse
from typing import List, Optional

from clawbot import ClawBotClient
from multi_instance_example import resolve_instance_id


def main() -> int:
    parser = argparse.ArgumentParser(description="Publish or reply via clawbot library")
    parser.add_argument("--text", required=True, help="Tweet or reply text")
    parser.add_argument("--reply-to", help="Reply target tweet id")
    parser.add_argument("--media", help="Comma-separated media paths")
    parser.add_argument("--instance-id", help="Explicit instanceId for multi-instance routing")
    args = parser.parse_args()

    client = ClawBotClient()
    media_paths: List[str] = [item.strip() for item in args.media.split(",")] if args.media else []
    instance_id: Optional[str] = resolve_instance_id(client, preferred_instance_id=args.instance_id)

    if args.reply_to:
        if media_paths:
            result = client.media.reply_with_media(args.reply_to, args.text, media_paths, instance_id=instance_id)
        else:
            result = client.x.actions.reply(args.reply_to, args.text, instance_id=instance_id)
    else:
        if media_paths:
            result = client.media.post_tweet(args.text, media_paths, instance_id=instance_id)
        else:
            result = client.x.actions.create_tweet(args.text, instance_id=instance_id)

    print(f"instance_id: {instance_id}")
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
