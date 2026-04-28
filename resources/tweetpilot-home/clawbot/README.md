# ClawBot Python 库使用指南

**面向对象：AI 助手**

本文档帮助你在用户明确选择 Python 时，正确理解 ClawBot 的定位、复用方式和运行约定。

---

## 先记住 4 个边界

1. **LocalBridge 是能力源**
2. **ClawBot 是 Python 复用层**
3. **ClawBot 不是唯一入口**
4. **最新 REST API 文档的权威来源是 `GET /api/v1/x/docs`**

这意味着：

- 如果用户选择 Python，优先复用 ClawBot 是合理的
- 但如果用户明确不想依赖 ClawBot，就不应强行要求使用 ClawBot
- 非 Python 场景下，ClawBot 不是主文档来源
- 本 README 不是 LocalBridge 正式 REST API 文档的替代品

---

## 什么时候应该先读本 README

当用户要求以下任一场景时，应先读本 README：

- 用 Python 访问 X / Twitter
- 用 Python 编写自动化脚本
- 用 Python 读写时间线、推文、用户资料、媒体能力
- 希望优先复用 TweetPilot 已有 Python 能力

如果用户明确表示：

- 不想依赖 ClawBot
- 想自己从头写 Python 请求逻辑
- 想直接基于 REST API 编码

那么此时不应把本 README 当成唯一前置文档，而应先获取：

- `GET /api/v1/x/docs`

---

## Python 场景下的默认策略

### 路径 A：优先复用 ClawBot

这是默认推荐路径。

执行顺序应为：

1. 阅读本 README
2. 确认现有能力是否已覆盖需求
3. 若已覆盖，优先直接复用
4. 避免重复手写已经存在的 REST API 封装

推荐导入方式：

```python
from clawbot import ClawBotClient

client = ClawBotClient()
```

### 路径 B：用户明确不要 ClawBot

如果用户明确说不要依赖 ClawBot，则正确做法是：

1. 通过 LocalBridge 文档接口获取最新 REST API 文档
2. 按用户要求用原生 Python 编写请求逻辑
3. 可将 ClawBot 视为参考实现，但不是强制依赖

---

## 运行方式（重要）

生成到用户工作目录的 Python 脚本，默认应按**用户工作目录脚本**来理解，而不是要求用户先进入 ClawBot 资源目录。

也就是说：

- 不要要求用户先 `cd ~/.tweetpilot/clawbot`
- 不要把脚本设计成“只有在 ClawBot 资源目录里运行才可用”
- 脚本中继续使用统一导入：

```python
from clawbot import ClawBotClient
```

ClawBot 的源码资源位于：

- `~/.tweetpilot/clawbot/`

真正的 Python 包入口位于：

- `~/.tweetpilot/clawbot/clawbot/__init__.py`

因此，这个导入成立的前提通常是：

1. **通过 TweetPilot 内部执行器 / 定时任务运行**  
   TweetPilot 会为 Python 进程注入正确的 `PYTHONPATH`，让工作目录下的脚本也能导入 `clawbot`。

2. **用户脱离 TweetPilot，直接用系统 Python 运行脚本**  
   则需要显式把 `~/.tweetpilot/clawbot` 加入 `PYTHONPATH`，或在脚本中加入等价的 `sys.path` 处理。

例如：

```bash
PYTHONPATH="$HOME/.tweetpilot/clawbot" python3 scripts/example.py
```

所以在为用户编写脚本时：

- 默认假设脚本保存在用户工作目录中；
- 不要要求先切换到 `~/.tweetpilot/clawbot`；
- 优先保持 `from clawbot import ClawBotClient` 这一统一导入方式；
- 若用户明确要求脱离 TweetPilot 独立运行，再补充对应环境说明。

### AI 自测脚本时的注意事项

如果 AI 编写了依赖 `clawbot` 的 Python 脚本，并且想在生成后立即自行测试，需要先区分测试场景：

1. **通过 TweetPilot 内部执行器 / 定时任务运行**  
   不应因为担心导入失败，就主动把 `sys.path` 修补代码写进用户脚本。正常情况下，TweetPilot 会注入正确的 `PYTHONPATH`。

2. **脱离 TweetPilot，直接用系统 Python 手动测试脚本**  
   应先确认测试环境是否已包含 `~/.tweetpilot/clawbot`。若没有，应优先通过环境方式补充，例如：

```bash
PYTHONPATH="$HOME/.tweetpilot/clawbot" python3 scripts/example.py
```

只有在用户明确要求脚本脱离 TweetPilot 独立运行时，才应补充等价的 `sys.path` 处理或环境说明。

如果只是因为手动测试时缺少 `PYTHONPATH` 导致 `import clawbot` 失败，不应立刻误判为脚本业务逻辑或 ClawBot 接口本身有问题。

---

## 快速开始

### 基础导入

```python
from clawbot import ClawBotClient

client = ClawBotClient()
```

### 最常用操作

```python
from clawbot import ClawBotClient

client = ClawBotClient()

# 可选，多实例环境下显式选择 instance_id
instances = client.x.status.get_instances()
instance_id = None
if isinstance(instances, list) and instances:
    first_instance = instances[0]
    instance_id = first_instance.get("instanceId") or first_instance.get("id")

# 读取时间线
tweets = client.x.timeline.list_timeline_tweets(instance_id=instance_id)

# 发推
result = client.x.actions.create_tweet("Hello World", instance_id=instance_id)

# 回复推文
result = client.x.actions.reply(tweet_id, "Nice tweet!", instance_id=instance_id)

# 带图发推
result = client.media.post_tweet("Check this out", ["image.png"], instance_id=instance_id)

# 搜索推文
tweets = client.x.search.search_tweets("AI", count=10, instance_id=instance_id)
```

---

## 目录结构

```text
clawbot/
├── README.md              # 本文档
├── requirements.txt       # Python 依赖
├── clawbot/               # 核心库（优先使用）
│   ├── client.py          # 主入口 ClawBotClient
│   ├── config.py          # 配置（API 地址、超时）
│   ├── services/          # 业务服务层（优先调用）
│   ├── domain/            # 数据模型
│   ├── transport/         # 底层 API 调用
│   ├── upload/            # 媒体上传
│   └── workflows/         # 多步骤工作流
├── examples/              # 示例脚本（快速参考）
├── ai_dom_probe.py        # AI 平台 DOM 提取最小探针
└── openclaw.py            # AI 自动回复演示
```

---

## 按任务类型选择模块

### 1. 读取 X / Twitter 数据

**使用模块：**
- `client.x.status` - 登录状态、标签页
- `client.x.timeline` - 时间线
- `client.x.tweets` - 推文详情、回复
- `client.x.users` - 用户资料
- `client.x.search` - 搜索推文 / 用户
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
tweet = client.x.tweets.get_tweet(tweet_id)  # 底层 REST 统一走 GET /api/v1/x/tweets?tweetId=...，但 Python 返回的是从 raw TweetDetail 中抽出的结构化 focal tweet
replies = client.x.tweets.get_tweet_replies(tweet_id)  # 底层 REST 统一走 GET /api/v1/x/tweets/{tweet_id}/replies，但 Python 返回的是从 raw replies payload 中抽出的结构化回复列表

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

### 2. 写入 X / Twitter 操作

**使用模块：**
- `client.x.actions` - 发推、回复、点赞、转推等

说明：旧调用方式仍然可用。在多实例 bridge 环境下，建议额外传入可选的 `instance_id`，显式路由到目标实例。

**常用方法：**

```python
# 发推
result = client.x.actions.create_tweet("Hello World", instance_id=instance_id)

# 回复
result = client.x.actions.reply(tweet_id, "Great post!", instance_id=instance_id)

# 互动操作
client.x.actions.like(tweet_id, instance_id=instance_id)
client.x.actions.unlike(tweet_id, instance_id=instance_id)
client.x.actions.retweet(tweet_id, instance_id=instance_id)
client.x.actions.unretweet(tweet_id, instance_id=instance_id)
client.x.actions.bookmark(tweet_id, instance_id=instance_id)
client.x.actions.unbookmark(tweet_id, instance_id=instance_id)

# 关注操作
client.x.actions.follow(user_id, instance_id=instance_id)
client.x.actions.unfollow(user_id, instance_id=instance_id)

# 删除推文
client.x.actions.delete_tweet(tweet_id, instance_id=instance_id)
```

### 3. 媒体上传与发布

**使用模块：**
- `client.media` - 上传图片 / 视频并发推

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
client.ai.navigation.navigate("grok")

# 创建新对话
result = client.ai.chat.new_conversation("grok")

# 发送消息
result = client.ai.chat.send_message(
    platform="grok",
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
5. **把 README 理解为 Python 复用指南** - 而不是 LocalBridge 正式 REST API 文档

### ❌ 不应该做的

1. **不要重复实现已有功能** - 发推、点赞、搜索等基础操作都已实现
2. **不要把 ClawBot 写成唯一入口** - 用户可以选择直接写 REST API
3. **不要把本 README 当成非 Python 场景主文档**
4. **不要直接操作底层 API** - 除非 `services/` 层确实不支持
5. **不要忽略错误处理** - 使用 `clawbot.errors` 中的异常类型

---

## 示例脚本参考

`examples/` 目录包含以下参考脚本：

| 脚本 | 功能 |
|------|------|
| `read_api_examples.py` | 读取时间线、推文详情、用户资料 |
| `write_api_examples.py` | 发推、点赞、转推等写操作 |
| `tweet_details_and_search_example.py` | 推文详情和搜索功能 |
| `status_and_metadata_example.py` | 状态检查和元数据读取 |
| `publish_example.py` | 发布推文（带 / 不带媒体） |
| `reply_with_media.py` | 带媒体回复推文 |
| `workflow_example.py` | 多步骤工作流示例 |
| `ai_workflow.py` | AI 平台交互示例 |
| `ai_reply_pinned_tweet.py` | 读取置顶推文并调用 AI 自动回复 |
| `ai_dom_probe.py` | 仅验证 AI 平台消息发送与 DOM 提取 |

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

如果需要单独排查 AI 平台消息发送或 DOM 提取问题，优先运行 `ai_dom_probe.py`。

如果需要完整演示读取置顶推文并自动回复，运行 `openclaw.py`。

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
- X / Twitter 账号已登录

安装依赖：

```bash
pip install -r requirements.txt
```

---

## 总结

**编写 Python 脚本时的思路：**

1. 先判断用户是否要优先复用 ClawBot
2. 若要复用，先看本文档和 `examples/`
3. 优先使用 `ClawBotClient` 现有能力
4. 仅在确实缺失时，才考虑直接写底层请求逻辑
5. 若用户明确不要 ClawBot，则改走 `GET /api/v1/x/docs`

**记住：ClawBot 是 Python 推荐复用层，不是唯一入口；LocalBridge 才是能力源。**
