#!/usr/bin/env python3
"""Minimal probe for AI platform DOM reply extraction."""

import argparse
import sys

from clawbot import ClawBotClient
from clawbot.errors import ParseError


def choose_platform(client: ClawBotClient, preferred_platform: str | None = None) -> str:
    status = client.ai.status.get_status()
    platforms = status.get("platforms", {}) if isinstance(status, dict) else {}

    if preferred_platform:
        info = platforms.get(preferred_platform, {}) if isinstance(platforms, dict) else {}
        if info.get("hasTab") and info.get("isLoggedIn"):
            return preferred_platform
        raise ParseError(f"AI platform {preferred_platform!r} is not ready")

    for name, info in platforms.items():
        if info.get("hasTab") and info.get("isLoggedIn"):
            return name

    raise ParseError("No logged-in AI platform is available")


def main() -> int:
    parser = argparse.ArgumentParser(description="Probe AI DOM extraction only")
    parser.add_argument("--platform", default="grok", help="AI platform name, e.g. grok")
    parser.add_argument(
        "--prompt",
        default="Please reply with exactly: hello",
        help="Prompt to send to the AI platform",
    )
    parser.add_argument(
        "--new-conversation",
        action="store_true",
        help="Create a new conversation before sending the prompt",
    )
    args = parser.parse_args()

    client = ClawBotClient()

    print("\n🤖 AI DOM Extraction Probe")
    print("=" * 60)

    platform = choose_platform(client, preferred_platform=args.platform)
    print(f"Platform: {platform}")

    if args.new_conversation:
        print("Creating new conversation...")
        new_conv = client.ai.chat.new_conversation(platform)
        print(f"New conversation result: success={new_conv.success}, raw={new_conv.raw}")
        if not new_conv.success:
            raise ParseError("Failed to create new conversation")

    print("Sending prompt...")
    result = client.ai.chat.send_message(platform=platform, prompt=args.prompt)

    print("\nResult summary")
    print("-" * 60)
    print(f"success: {result.success}")
    print(f"platform: {result.platform}")
    print(f"conversation_id: {result.conversation_id}")
    print(f"content: {result.content!r}")
    print(f"raw: {result.raw}")
    print("-" * 60)

    if not result.success or not result.content:
        return 1
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Probe interrupted by user")
        sys.exit(1)
    except Exception as exc:
        print(f"\n\n❌ Probe failed: {exc}")
        raise
