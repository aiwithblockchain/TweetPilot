#!/usr/bin/env python3
"""
读取马斯克(@elonmusk)的最新推文，然后转发并点赞
使用 clawbot 库
"""
import sys
import os
import requests

# 添加 clawbot 库路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "docs", "clawBotCli"))

from clawbot import ClawBotClient


def main():
    print("=== 马斯克推文转发和点赞脚本 ===\n")

    try:
        # 1. 从环境变量获取账号信息
        twitter_account = os.environ.get('TWITTER_ACCOUNT')
        instance_id = os.environ.get('TWITTER_INSTANCE_ID')
        tab_id_str = os.environ.get('TWITTER_TAB_ID')

        if twitter_account:
            print(f"任务指定账号: {twitter_account}")
        if instance_id:
            print(f"使用实例 ID: {instance_id}")
        if tab_id_str:
            print(f"使用标签页 ID: {tab_id_str}\n")

        # 2. 如果没有提供 instance_id，则获取第一个可用实例
        if not instance_id:
            print("正在获取可用的 tweetClaw 实例...")
            response = requests.get("http://127.0.0.1:10088/api/v1/x/instances", timeout=30)
            response.raise_for_status()
            instances = response.json()

            if not instances:
                print("✗ 未找到可用的 tweetClaw 实例")
                return 1

            instance_id = instances[0]["instanceId"]
            instance_name = instances[0]["instanceName"]
            print(f"✓ 使用实例: {instance_name} ({instance_id})\n")

        # 3. 创建 clawbot 客户端并设置 instanceId header
        client = ClawBotClient()
        client.x_transport.session.headers.update({"X-Instance-Id": instance_id})
        client.ai_transport.session.headers.update({"X-Instance-Id": instance_id})

        # 4. 如果没有提供 tab_id，则获取第一个可用标签页
        if not tab_id_str:
            print("正在获取可用的 X 标签页...")
            status = client.x_status.get_status()

            if not status.tabs:
                print("✗ 未找到可用的 X 标签页")
                return 1

            tab_id = status.tabs[0].tab_id
            print(f"✓ 使用标签页 ID: {tab_id}\n")
        else:
            tab_id = int(tab_id_str)

        # 4. 搜索马斯克的最新推文
        print("正在搜索 @elonmusk 的最新推文...")
        tweets = client.x_read.search_tweets("from:elonmusk", count=1, tab_id=tab_id)

        if not tweets:
            print("✗ 未找到推文")
            return 1

        tweet = tweets[0]
        print(f"✓ 找到最新推文:")
        print(f"  ID: {tweet.id}")
        print(f"  作者: @{tweet.author_screen_name}")
        print(f"  内容: {tweet.text[:100]}...")
        print()

        tweet_id = tweet.id

        # 5. 点赞推文
        print(f"正在点赞推文 {tweet_id}...")
        like_result = client.x_actions.like(tweet_id, tab_id=tab_id)
        if like_result.success:
            print("✓ 点赞成功\n")
        else:
            print(f"⚠ 点赞失败: {like_result.message}\n")

        # 6. 转发推文
        print(f"正在转发推文 {tweet_id}...")
        retweet_result = client.x_actions.retweet(tweet_id, tab_id=tab_id)
        if retweet_result.success:
            print("✓ 转发成功\n")
        else:
            print(f"⚠ 转发失败: {retweet_result.message}\n")

        print("=== 任务完成 ===")
        return 0

    except Exception as e:
        print(f"\n✗ 执行失败: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
