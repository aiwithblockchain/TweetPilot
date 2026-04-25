# ClawBot Python 库使用指南

**面向对象：AI 助手**

本文档帮助你快速理解 ClawBot 目录结构，并在编写 X/Twitter 相关 Python 脚本时正确复用已有能力。

---

## 快速开始

### 基础导入

```python
from clawbot import ClawBotClient

client = ClawBotClient()
```

### 最常用操作

```python
# 读取时间线
tweets = client.x.timeline.list_timeline_tweets()

# 发推
result = client.x.actions.create_tweet("Hello World")

# 回复推文
result = client.x.actions.reply(tweet_id, "Nice tweet!")

# 带图发推
result = client.media.post_tweet("Check this out", ["image.png"])

# 搜索推文
tweets = client.x.search.search_tweets("AI", count=10)
```

---

## 目录结构

```text
clawbot/
├── README.md              # 本文档
├── requirements.txt       # Python 依赖
├── clawbot/              # 核心库（优先使用）
│   ├── client.py         # 主入口 ClawBotClient
│   ├── config.py         # 配置（API 地址、超时）
│   ├── services/         # 业务服务层（优先调用）
│   ├── domain/           # 数据模型
│   ├── transport/        # 底层 API 调用
│   ├── upload/           # 媒体上传
│   └── workflows/        # 多步骤工作流
├── examples/             # 示例脚本（快速参考）
└── openclaw.py           # AI 自动回复演示
```

---

## 按任务类型选择模块

### 1. 读取 X/Twitter 数据

**使用模块：**
- `client.x.status` - 登录状态、标签页
- `client.x.timeline` - 时间线
- `client.x.tweets` - 推文详情、回复
- `client.x.users` - 用户资料
- `client.x.search` - 搜索推文/用户
- `client.x.tabs` - 标签页控制

**常用方法：**

```python
# 检查登录状态
status = client.x.status.get_status()
print(status.is_logged_in)

# 读取时间线
tweets = client.x.timeline.list_timeline_tweets()
first_tweet = client.x.timeline.get_first_timeline_tweet()

# 获取推文详情
tweet = client.x.tweets.get_tweet(tweet_id)
replies = client.x.tweets.get_tweet_replies(tweet_id)

# 获取用户资料
user = client.x.users.get_user("elonmusk")
pinned = client.x.users.get_pinned_tweet("elonmusk")

# 搜索
tweets = client.x.search.search_tweets("AI", count=20)
user = client.x.search.search_first_user("OpenAI")

# 标签页控制
tab = client.x.tabs.open("home")
client.x.tabs.navigate("notifications", tab_id)
client.x.tabs.close(tab_id)
```

### 2. 写入 X/Twitter 操作

**使用模块：**
- `client.x.actions` - 发推、回复、点赞、转推等

**常用方法：**

```python
# 发推
result = client.x.actions.create_tweet("Hello World")

# 回复
result = client.x.actions.reply(tweet_id, "Great post!")

# 互动操作
client.x.actions.like(tweet_id)
client.x.actions.unlike(tweet_id)
client.x.actions.retweet(tweet_id)
client.x.actions.unretweet(tweet_id)
client.x.actions.bookmark(tweet_id)
client.x.actions.unbookmark(tweet_id)

# 关注操作
client.x.actions.follow(user_id)
client.x.actions.unfollow(user_id)

# 删除推文
client.x.actions.delete_tweet(tweet_id)
```

### 3. 媒体上传与发布

**使用模块：**
- `client.media` - 上传图片/视频并发推

**常用方法：**

```python
# 上传单个文件
result = client.media.upload("image.jpg")
media_id = result.media_id

# 带媒体发推
result = client.media.post_tweet(
    text="Check out these images!",
    file_paths=["img1.jpg", "img2.png"]
)

# 带媒体回复
result = client.media.reply_with_media(
    tweet_id="123456789",
    text="Here's my response",
    file_paths=["response.jpg"]
)
```

### 4. AI 平台交互

**使用模块：**
- `client.ai.status` - AI 平台状态
- `client.ai.chat` - 发送消息
- `client.ai.navigation` - 导航到 AI 平台

**常用方法：**

```python
# 检查 AI 平台状态
status = client.ai.status.get_status()
platforms = client.ai.status.logged_in_platforms()

# 导航到 AI 平台
client.ai.navigation.navigate("chatgpt")

# 创建新对话
result = client.ai.chat.new_conversation("chatgpt")

# 发送消息
result = client.ai.chat.send_message(
    platform="chatgpt",
    prompt="Analyze this tweet"
)
print(result.content)
```

### 5. 组合工作流

**使用模块：**
- `client.workflows` - 多步骤自动化流程

**适用场景：**
- 需要串联多个操作（读取 → 分析 → 执行）
- 已有现成工作流可复用

**示例：**

查看 `openclaw.py` 了解完整的 AI 自动回复工作流示例。

---

## 使用规则（重要）

### ✅ 应该做的

1. **优先复用现有能力** - 先检查 `client.x.*` 和 `client.media.*` 是否已有对应方法
2. **从高层 API 开始** - 优先使用 `services/` 层，避免直接调用 `transport/`
3. **参考示例代码** - 查看 `examples/` 目录快速了解用法
4. **组合现有接口** - 大多数需求可通过组合现有方法实现

### ❌ 不应该做的

1. **不要重复实现已有功能** - 发推、点赞、搜索等基础操作都已实现
2. **不要直接操作底层 API** - 除非 `services/` 层确实不支持
3. **不要忽略错误处理** - 使用 `clawbot.errors` 中的异常类型

---

## 示例脚本参考

`examples/` 目录包含以下参考脚本：

| 脚本 | 功能 |
|------|------|
| `read_api_examples.py` | 读取时间线、推文详情、用户资料 |
| `write_api_examples.py` | 发推、点赞、转推等写操作 |
| `tweet_details_and_search_example.py` | 推文详情和搜索功能 |
| `status_and_metadata_example.py` | 状态检查和元数据读取 |
| `publish_example.py` | 发布推文（带/不带媒体） |
| `reply_with_media.py` | 带媒体回复推文 |
| `workflow_example.py` | 多步骤工作流示例 |
| `ai_workflow.py` | AI 平台交互示例 |

---

## 常见任务速查

### 获取时间线第一条推文并点赞

```python
from clawbot import ClawBotClient

client = ClawBotClient()
tweet = client.x.timeline.get_first_timeline_tweet()
if tweet:
    client.x.actions.like(tweet.id)
```

### 搜索关键词并回复第一条

```python
tweets = client.x.search.search_tweets("Python", count=5)
if tweets:
    client.x.actions.reply(tweets[0].id, "Interesting!")
```

### 读取用户置顶推文并转推

```python
pinned = client.x.users.get_pinned_tweet("elonmusk")
if pinned:
    client.x.actions.retweet(pinned.id)
```

### 带图片发推

```python
result = client.media.post_tweet(
    text="Beautiful sunset 🌅",
    file_paths=["sunset.jpg"]
)
```

### AI 分析推文后自动回复

```python
# 1. 获取推文
tweet = client.x.timeline.get_first_timeline_tweet()

# 2. 让 AI 分析
ai_result = client.ai.chat.send_message(
    platform="chatgpt",
    prompt=f"Analyze this tweet and suggest a reply: {tweet.text}"
)

# 3. 自动回复
if ai_result.success:
    client.x.actions.reply(tweet.id, ai_result.content)
```

---

## 配置说明

默认配置在 `clawbot/config.py`：

```python
API_BASE_URL = "http://127.0.0.1:10088"  # LocalBridge 地址
API_TIMEOUT = 30                          # 默认超时（秒）
MEDIA_UPLOAD_TIMEOUT = 300                # 媒体上传超时（秒）
```

自定义配置：

```python
client = ClawBotClient(
    base_url="http://localhost:8080",
    timeout=60
)
```

---

## 错误处理

```python
from clawbot.errors import (
    MediaUploadError,
    ParseError,
    TaskTimeoutError,
    ApiRequestError
)

try:
    client.media.post_tweet("Hello", ["image.jpg"])
except MediaUploadError as e:
    print(f"Upload failed: {e}")
except TaskTimeoutError as e:
    print(f"Timeout: {e}")
except ApiRequestError as e:
    print(f"API error: {e}")
```

---

## 依赖要求

- Python 3.10+
- LocalBridge 运行在 `http://127.0.0.1:10088`
- TweetCat 浏览器扩展已安装并连接
- X/Twitter 账号已登录

安装依赖：

```bash
pip install -r requirements.txt
```

---

## 总结

**编写新脚本时的思路：**

1. 明确任务类型（读/写/媒体/AI）
2. 查看本文档对应章节找到相关模块
3. 参考 `examples/` 中的示例代码
4. 使用 `ClawBotClient` 调用对应方法
5. 添加必要的错误处理

**记住：大多数 X/Twitter 操作都已实现，优先复用而非重写。**
