# P0-12 TweetClaw 能力对齐分析

## 1. 背景与结论

当前 TweetPilot 的“推特账号管理 / 数据积木 / 任务管理”并没有真正建立在 tweetClaw 能力之上，现状更接近“UI 已经存在，部分 Tauri 命令已接线，但底层核心能力仍以 mock 数据和最小状态同步为主”。

从代码上看，问题最直接地体现在两个地方：

1. `src-tauri/src/commands/account.rs` 中，账号列表、可绑定账号、账号详情等大量逻辑仍然依赖本地持久化和硬编码数据。
2. `src-tauri/src/services/localbridge.rs` 中，Rust 侧只实现了 `get_status`、`get_instances`、`get_basic_info` 三个接口，而 Python SDK 已经围绕 tweetClaw 封装出完整的读取、写入、媒体、标签页、AI 协作和复合工作流能力。

因此，用户指出 `get_basic_info` 未使用，进而推断推特管理能力没有真正实现，这个判断是成立的。

更准确地说：

- LocalBridge 只是 REST 转发层。
- 真正的能力提供者是 LocalBridge 连接的 tweetClaw 浏览器扩展实例。
- 当前系统只浅层使用了“实例列表”这一项能力，远远没有把 tweetClaw 的真实能力映射为产品功能。

本文档目标是：

1. 盘点当前尚未实现的账号管理、数据管理、任务管理功能。
2. 梳理 `docs/clawBotCli` 下 Python SDK 已具备的 tweetClaw 能力。
3. 建立“tweetClaw 能力 -> 当前系统功能”的对齐表，并说明应如何组合能力落地。
4. 明确现有能力缺口，区分“Rust/Tauri 还没接入”与“tweetClaw 本身还需要增强”两类问题，并提出扩展建议。

---

## 2. 当前实现现状审查

### 2.1 账号管理现状

`src-tauri/src/commands/account.rs` 已经暴露出一套账号管理接口，但核心问题是“数据来源不真实”。

#### 已有内容

- 已有映射账号持久化结构：`PersistedAccountData`
- 已有账号结构：`TwitterAccount`
- 已有账号状态字段：`Online / Offline / Verifying`
- 已有账号设置接口：`get_account_settings`
- 已有账号状态刷新接口：`refresh_all_accounts_status`
- 已有人格设定持久化：`AccountPersonalityRecord`

#### 关键问题

1. **默认账号是假的**
   `default_persisted_accounts()` 直接返回 `@testuser1`。

2. **可绑定账号列表是硬编码的**
   `get_available_accounts()` 依赖 `ALL_ACCOUNTS` 常量，而不是从 tweetClaw 实例或真实 Twitter 资料获取。

3. **账号绑定是硬编码映射**
   `map_account(screen_name)` 也是从 `ALL_ACCOUNTS` 中查找，不是真实账号发现逻辑。

4. **账号详情是拼接出来的**
   `get_account_settings()` 里：
   - `twitter_id` 是 `screen_name + 123456789` 伪造出来的
   - `extension_id` / `extension_name` 是固定字符串
   - `is_linked` 被固定写成 `true`

5. **真正接了 LocalBridge 的只有状态刷新**
   `refresh_all_accounts_status()` 会尝试调用 `get_instances()`，但它做的也只是：
   - 从实例里拿 `screen_name`、`name`、`profile_image_url`
   - 组装一个简化版 `TwitterAccount`
   - 没有进一步拉取账号详细资料、登录态、标签页、关注数、推文数、固定推文等信息

6. **`get_basic_info` 已实现但未接入业务**
   Rust LocalBridge client 中实现了 `/api/v1/x/basic_info` 的解析逻辑，但没有在账号管理流程中使用。

### 2.2 数据积木现状

`src-tauri/src/commands/data_blocks.rs` 说明当前卡片系统也只是“有壳没魂”。

#### 已有内容

- 已有卡片布局持久化：`data-blocks-layout.json`
- 已有卡片增删改查：`get_layout`、`save_layout`、`add_card`、`delete_card`
- 已有卡片类型字段：`card_type`
- 已有刷新时间字段：`last_updated`

#### 关键问题

`get_card_data()` 中几乎所有卡片数据都是硬编码：

- `latest_tweets` 返回固定三条测试推文
- `account_basic_data` 返回固定关注数、粉丝数、推文数、点赞数
- `account_interaction_data` 返回固定总浏览、点赞、转推
- `tweet_time_distribution` 返回固定周分布
- `task_execution_stats` 返回固定成功/失败比例

也就是说：

- 数据积木没有接入 tweetClaw 读取能力
- 没有和具体账号实例建立绑定关系
- 没有真正按卡片类型组合底层能力
- 没有分页、缓存、刷新、失败重试、空状态等真实数据行为

### 2.3 任务管理现状

从现有已审查代码和用户指出的问题来看，任务管理至少存在以下缺口：

1. 缺少基于 tweetClaw 写能力的任务执行器
2. 缺少任务与账号实例的绑定关系
3. 缺少读取上下文 -> AI 生成 -> 发帖 / 回复 / 互动 的复合工作流落地
4. 缺少媒体上传型任务
5. 缺少搜索、发现、互动、回复等行为任务
6. 缺少任务状态回写到数据积木和账号视图
7. 缺少真实成功率、失败原因、执行日志、重试机制

换句话说，现阶段任务管理更像“概念上的产品区域”，还不是以 tweetClaw 为执行引擎的可运行系统。

---

## 3. 当前尚未实现的功能点清单

以下清单按“账号管理 / 数据管理 / 任务管理”三大模块拆解。

### 3.1 账号管理尚未实现的功能点

#### A. 账号发现与绑定

1. 从 LocalBridge 实时发现所有 tweetClaw 实例
2. 将“实例”和“Twitter 账号”建立稳定映射，而不是只保留 screen_name
3. 支持同一机器多实例、多账号并存
4. 支持按实例 ID、tab ID、screen_name 唯一识别账号
5. 支持账号首次接入时的真实资料拉取
6. 支持账号重复绑定检测，基于真实实例标识而不是 screen_name 文本

#### B. 账号基础资料

1. 使用 `get_basic_info()` 获取真实 viewer 信息
2. 真实保存 `twitter_id`
3. 真实保存 `name / screen_name / avatar / description`
4. 真实识别是否已登录
5. 真实识别默认 tab / 活跃 tab
6. 真实展示扩展实例名称、实例 ID、连接状态
7. 真实展示账号资料更新时间

#### C. 账号状态与健康检查

1. 检查 LocalBridge 是否在线
2. 检查 tweetClaw 实例是否在线
3. 检查 X/Twitter 是否登录
4. 检查 tab 是否可用
5. 检查当前账号是否可执行读操作
6. 检查当前账号是否可执行写操作
7. 区分“桥接失败 / 扩展离线 / 未登录 / 页面异常 / 解析失败”等状态

#### D. 账号运营能力

1. 查看主页时间线
2. 查看账号详情页
3. 查看 pinned tweet
4. 查看单条 tweet 详情
5. 搜索用户
6. 搜索 tweet
7. 获取 tweet 回复列表
8. 对外执行 like / unlike
9. 执行 retweet / unretweet
10. 执行 bookmark / unbookmark
11. 执行 follow / unfollow
12. 创建 tweet
13. 回复 tweet
14. 删除 tweet
15. 带媒体发帖
16. 带媒体回复

#### E. 账号配置

1. 将人格设定与真实账号实例关联
2. 每个账号单独配置默认 AI 平台
3. 每个账号单独配置默认发帖 tab
4. 每个账号单独配置风格、安全策略、内容规则
5. 账号级别的速率限制与冷却策略

### 3.2 数据管理尚未实现的功能点

#### A. 已有卡片未真实化

1. `latest_tweets` 应接真实 timeline 数据
2. `account_basic_data` 应接真实 basic info / profile 数据
3. `account_interaction_data` 应接真实互动数据来源
4. `tweet_time_distribution` 应从真实 tweet 数据统计
5. `task_execution_stats` 应从真实任务执行记录统计

#### B. 缺少的数据积木类型

1. 账号连接状态卡
2. 实例状态卡
3. 登录状态卡
4. 默认 tab / tabs 列表卡
5. 粉丝增长卡
6. 发帖频率卡
7. 最近互动卡
8. 最近提及 / mentions 卡
9. 搜索监控结果卡
10. 固定推文表现卡
11. 竞品账号追踪卡
12. 关键词搜索结果卡
13. 待处理回复队列卡
14. 草稿箱卡
15. 任务队列卡
16. 任务失败告警卡
17. 媒体资产卡
18. AI 生成建议卡

#### C. 数据层能力缺口

1. 卡片与账号实例未绑定
2. 卡片缺少参数配置体系
3. 卡片刷新未真正触发数据重拉
4. 卡片缺少错误态 / 空态 / 加载态
5. 卡片缺少缓存策略
6. 卡片缺少多账号聚合能力
7. 卡片缺少时间窗口过滤
8. 卡片缺少搜索条件配置
9. 卡片缺少 drill-down 跳转能力

### 3.3 任务管理尚未实现的功能点

#### A. 内容发布任务

1. 定时发帖
2. 批量发帖
3. 带媒体发帖
4. 多账号分发
5. 草稿审批后发帖
6. 基于 AI 生成内容后发帖

#### B. 互动任务

1. 自动点赞目标推文
2. 自动转推目标推文
3. 自动收藏目标推文
4. 自动关注目标用户
5. 自动回复指定 tweet
6. 搜索关键词后对首条 / 多条结果执行互动

#### C. 监控任务

1. 定时搜索关键词
2. 定时抓取某账号主页
3. 定时抓取 pinned tweet 变化
4. 定时采集回复列表
5. 定时发现新用户 / 新 tweet

#### D. AI 协作任务

1. 读取 tweet -> AI 生成回复
2. 搜索用户 -> 抽取画像 -> AI 生成互动建议
3. 分析时间线 -> AI 生成发帖建议
4. 读取 pinned tweet -> AI 自动回复
5. 根据人格设定生成多版本文案

#### E. 运维与审计

1. 任务执行日志
2. 每步执行证据
3. 失败原因分类
4. 自动重试
5. 幂等控制
6. 速率控制
7. 账号级并发控制
8. 任务回滚或补偿策略

---

## 4. docs/clawBotCli 中 tweetClaw 的 Python 能力盘点

这里聚焦“通过 LocalBridge 得到 tweetClaw 实例后，可用的真实能力”，不把 LocalBridge 自身配置逻辑当成功能重点。

## 4.1 总入口

`docs/clawBotCli/clawbot/client.py` 中 `ClawBotClient` 已明确组织出以下能力域：

- `x_status`
- `x_read`
- `x_actions`
- `x_tabs`
- `ai_chat`
- `media`
- `workflows`

同时又以别名形式挂到：

- `client.x.status`
- `client.x.timeline`
- `client.x.tweets`
- `client.x.users`
- `client.x.search`
- `client.x.actions`
- `client.x.tabs`
- `client.ai.status`
- `client.ai.chat`
- `client.ai.navigation`
- `client.workflows`

这意味着 tweetClaw 实际已经具备“读、写、媒体、AI、标签页、工作流编排”的完整骨架。

### 4.2 X 状态能力，`x_status.py`

可用能力：

1. `get_status()`
   - 获取 X 整体状态
   - 包含是否有 X tabs、是否登录、tabs 列表等

2. `is_logged_in()`
   - 判断当前是否登录 X

3. `list_tabs()`
   - 列出 tweetClaw 当前可用标签页

4. `get_default_tab_id()`
   - 获取默认 tab

5. `get_instances()`
   - 获取实例列表

6. `get_basic_info()`
   - 获取 viewer 基础资料

7. `get_docs_raw()`
   - 获取原始能力说明文档

### 4.3 X 读取能力，`x_read.py`

可用能力：

1. `get_timeline_raw(tab_id)`
2. `list_timeline_tweets(tab_id)`
3. `get_first_timeline_tweet(tab_id)`
4. `get_tweet_raw(tweet_id, tab_id)`
5. `get_tweet(tweet_id, tab_id)`
6. `get_tweet_replies(tweet_id, cursor, tab_id)`
7. `get_user(screen_name, tab_id)`
8. `get_pinned_tweet(screen_name, tab_id)`
9. `search(query, count, cursor, tab_id)`
10. `search_tweets(query, count, cursor, tab_id)`
11. `search_first_tweet(query, tab_id)`
12. `search_first_user(query, tab_id)`

这些能力已经足够支撑：

- 时间线读取
- 用户资料读取
- 推文详情读取
- 回复列表读取
- 搜索发现
- pinned tweet 场景

### 4.4 X 写操作能力，`x_actions.py`

可用能力：

1. `create_tweet(text, media_ids)`
2. `reply(tweet_id, text, media_ids)`
3. `like(tweet_id, tab_id)`
4. `unlike(tweet_id, tab_id)`
5. `retweet(tweet_id, tab_id)`
6. `unretweet(tweet_id, tab_id)`
7. `bookmark(tweet_id, tab_id)`
8. `unbookmark(tweet_id, tab_id)`
9. `follow(user_id, tab_id)`
10. `unfollow(user_id, tab_id)`
11. `delete_tweet(tweet_id, tab_id)`

这些能力已经覆盖了绝大多数基础账号运营动作。

### 4.5 标签页能力，`x_tabs.py`

可用能力：

1. `open(path="home")`
2. `navigate(path, tab_id)`
3. `close(tab_id)`

这组能力的价值非常高，因为它让系统可以：

- 主动打开操作 tab
- 在不同页面间切换上下文
- 为不同工作流隔离 tab
- 将“账号”与“tab 上下文”绑定起来

### 4.6 媒体能力，`media.py`

可用能力：

1. `upload(file_path, client_name, instance_id, tab_id)`
2. `upload_many(paths, client_name, instance_id, tab_id)`
3. `post_tweet(text, file_paths, instance_id, tab_id)`
4. `reply_with_media(tweet_id, text, file_paths, instance_id, tab_id)`

而且媒体上传并不是简单 HTTP 上传，而是：

- 创建任务
- 分块上传
- seal input
- start task
- wait for completion
- 获取 `mediaId`
- 再结合 `x_actions` 发帖或回复

这意味着 tweetClaw 已经具备“媒体型任务”的基础设施。

### 4.7 AI 能力，`ai_chat.py`

可用能力：

1. `get_status()`
2. `available_platforms()`
3. `logged_in_platforms()`
4. `new_conversation(platform)`
5. `navigate(platform)`
6. `send_message(platform, prompt, conversation_id)`
7. `ask(platform, prompt, conversation_id)`

这表明 tweetClaw 不只是 Twitter 自动化工具，还是“浏览器内 AI 平台协作器”，可以把 X 读到的上下文送到 AI 平台，再把 AI 结果带回任务流。

### 4.8 复合工作流能力，`workflows/common.py`

已经内置的工作流包括：

1. `read_and_like_first_tweet(tab_id)`
2. `search_and_fetch_profile(query, tab_id)`
3. `reply_to_pinned_tweet(username, text, tab_id)`
4. `analyze_tweet_and_generate_reply(tweet_id, platform, tab_id)`
5. `reply_to_pinned_tweet_with_ai(username, platform, tab_id)`
6. `post_text_with_media(text, *paths)`

这说明 tweetClaw 已经超出“原子 API 集合”的阶段，开始具备产品级编排能力。

### 4.9 底层 REST 能力总览，`transport/x_api.py`

Rust 当前只实现了 3 个接口，但 Python transport 实际已映射出更多端点：

#### 状态与资料
- `GET /api/v1/x/docs`
- `GET /api/v1/x/status`
- `GET /api/v1/x/instances`
- `GET /api/v1/x/basic_info`

#### 读取
- `GET /api/v1/x/timeline`
- `GET /api/v1/x/tweets/{tweet_id}`
- `GET /api/v1/x/tweets/{tweet_id}/replies`
- `GET /api/v1/x/users`
- `GET /api/v1/x/search`

#### 写操作
- `POST /api/v1/x/tweets`
- `POST /api/v1/x/replies`
- `POST /api/v1/x/likes`
- `POST /api/v1/x/unlikes`
- `POST /api/v1/x/retweets`
- `POST /api/v1/x/unretweets`
- `POST /api/v1/x/bookmarks`
- `POST /api/v1/x/unbookmarks`
- `POST /api/v1/x/follows`
- `POST /api/v1/x/unfollows`
- `DELETE /api/v1/x/mytweets`

#### 标签页
- `POST /tweetclaw/open-tab`
- `POST /tweetclaw/close-tab`
- `POST /tweetclaw/navigate-tab`

结论很明确：

**现在的主要瓶颈不是 tweetClaw 完全没有能力，而是 TweetPilot 的 Rust/Tauri 层没有把这些能力接进来。**

---

## 5. 能力对齐分析，tweetClaw 如何映射当前系统功能

下面按产品域建立能力对齐表。

## 5.1 账号管理能力对齐表

| 当前系统目标 | 需要的 tweetClaw 能力 | 组合方式 | 当前状态 | 差距类型 |
|---|---|---|---|---|
| 发现已接入账号 | `get_instances()` | 拉取实例列表，提取实例 ID、screen_name、name、avatar | 仅部分使用 | Rust 未接全 |
| 获取当前账号真实资料 | `get_basic_info()` | 对实例或默认 tab 调用，解析 viewer 的 id/name/screen_name/description | 未使用 | Rust 未接全 |
| 判断账号是否登录 | `get_status()` / `is_logged_in()` | 结合实例状态与 tab 状态判断可用性 | 未落地 | Rust 未接全 |
| 展示账号 tabs | `list_tabs()` / `get_default_tab_id()` | 读取 tab 列表并绑定账号工作上下文 | 未落地 | Rust 未接全 |
| 展示账号主页资料 | `get_user(screen_name)` | 在账号详情页拉取完整 profile 数据 | 未落地 | Rust 未接全 |
| 展示 pinned tweet | `get_pinned_tweet(screen_name)` | 在账号详情页补充 pinned tweet 卡片 | 未落地 | Rust 未接全 |
| 展示账号近期推文 | `list_timeline_tweets(tab_id)` | 拉 timeline 前 N 条生成账号动态区域 | 未落地 | Rust 未接全 |
| 账号健康检查 | `get_status()` + `get_instances()` + `get_basic_info()` | 组合判断桥接在线、实例在线、登录、资料可读 | 未落地 | Rust 未接全 |
| 账号运营动作 | `create_tweet`、`reply`、`like`、`retweet`、`bookmark`、`follow` 等 | 在账号详情页触发具体动作 | 未落地 | Rust 未接全 |
| 账号级 AI 助理 | `get_tweet` + `send_message` + `reply` | 读取上下文，AI 生成，再执行操作 | 未落地 | Rust 未接全 |

### 5.2 数据积木能力对齐表

| 数据积木 / 目标 | 需要的 tweetClaw 能力 | 组合方式 | 当前状态 | 差距类型 |
|---|---|---|---|---|
| 最新推文卡 `latest_tweets` | `list_timeline_tweets()` | 拉取 timeline，截取前 N 条，映射时间、文本、互动数 | 当前为 mock | Rust 未接全 |
| 账号基础数据卡 `account_basic_data` | `get_basic_info()` + `get_user()` | viewer 基础资料 + profile 数据汇总 | 当前为 mock | Rust 未接全 |
| 账号互动数据卡 `account_interaction_data` | `list_timeline_tweets()` + `get_tweet()` | 从最近推文统计互动数据 | 当前为 mock | Rust 未接全 |
| 发帖时间分布卡 | `list_timeline_tweets()` | 解析 tweet 时间戳后聚合统计 | 当前为 mock | Rust 未接全 |
| 任务执行统计卡 | 任务执行日志 + `x_actions` 结果 | 对任务结果做聚合 | 当前为 mock | 任务系统未实现 |
| 搜索结果卡 | `search_tweets()` / `search_first_user()` | 基于关键词或主题查询并展示 | 未实现 | Rust 未接全 |
| 回复监控卡 | `get_tweet_replies()` | 拉取指定 tweet 的回复列表 | 未实现 | Rust 未接全 |
| 固定推文卡 | `get_pinned_tweet()` | 展示 pinned tweet 及其状态 | 未实现 | Rust 未接全 |
| 竞品用户画像卡 | `search_first_user()` + `get_user()` | 搜索目标用户并抓取 profile | 未实现 | Rust 未接全 |
| AI 内容建议卡 | `list_timeline_tweets()` + `ask()` | 把上下文喂给 AI 生成建议 | 未实现 | Rust 未接全 |
| 媒体资产卡 | `upload()` / 媒体任务结果 | 展示已上传媒体及可复用 media_id | 未实现 | 需要产品与能力增强 |

### 5.3 任务管理能力对齐表

| 任务类型 | 需要的 tweetClaw 能力 | 组合方式 | 当前状态 | 差距类型 |
|---|---|---|---|---|
| 纯文本发帖任务 | `create_tweet()` | 账号选定后直接执行 | 未实现 | Rust 未接全 |
| 媒体发帖任务 | `upload_many()` + `create_tweet()` | 先上传媒体，再发帖 | 未实现 | Rust 未接全 |
| 自动回复任务 | `get_tweet()` + `reply()` | 读取目标 tweet，生成或填写回复后执行 | 未实现 | Rust 未接全 |
| AI 自动回复任务 | `get_tweet()` + `send_message()` + `reply()` | 读取 tweet -> AI 草拟 -> 回复 | 未实现 | Rust 未接全 |
| 点赞任务 | `like()` | 对指定 tweet 执行 | 未实现 | Rust 未接全 |
| 关注任务 | `search_first_user()` + `follow()` | 搜索目标并关注 | 未实现 | Rust 未接全 |
| 搜索互动任务 | `search_tweets()` + `like/retweet/reply` | 搜索结果批量处理 | 未实现 | Rust 未接全 |
| pinned tweet 回复任务 | `get_pinned_tweet()` + `reply()` | 找到 pinned tweet 后回复 | 未实现 | Rust 未接全 |
| AI pinned tweet 回复任务 | `get_pinned_tweet()` + `send_message()` + `reply()` | Python workflows 已有原型 | 未实现 | Rust 未接全 |
| 多 tab 浏览任务 | `open()` + `navigate()` + `close()` | 为任务创建隔离 tab 上下文 | 未实现 | Rust 未接全 |
| 搜索监控任务 | `search()` 周期性执行 | 定时抓取并存档结果 | 未实现 | 任务系统未实现 |
| 媒体回复任务 | `upload_many()` + `reply()` | 先上传媒体，再回复 | 未实现 | Rust 未接全 |

---

## 6. 推荐的落地组合方式

这里不只是列接口，而是说明产品能力应如何用 tweetClaw 组合出来。

### 6.1 真实账号同步流程

推荐流程：

1. `get_instances()`
   - 获取所有可用 tweetClaw 实例
2. 对每个实例读取：
   - `get_status()`，判断登录态与 tabs
   - `get_basic_info()`，获取 viewer 基础信息
3. 如果已有 `screen_name`，再调用：
   - `get_user(screen_name)`，补全 profile 信息
4. 保存统一账号实体：
   - `instance_id`
   - `screen_name`
   - `twitter_id`
   - `display_name`
   - `avatar`
   - `description`
   - `is_logged_in`
   - `default_tab_id`
   - `tabs`
   - `last_synced_at`

这才是账号管理的真实基础。

### 6.2 “账号详情页”推荐组合

账号详情页至少应由以下能力组合：

- 基础资料：`get_basic_info()` + `get_user(screen_name)`
- 登录态：`get_status()`
- tabs：`list_tabs()` + `get_default_tab_id()`
- 最近推文：`list_timeline_tweets()`
- pinned tweet：`get_pinned_tweet(screen_name)`
- 快捷动作：`create_tweet()` / `reply()` / `like()` / `follow()`
- AI 助理：`ask()` / `send_message()`

### 6.3 “数据积木刷新”推荐组合

当前 `refresh_card_data(card_id)` 只是更新时间戳，应该改为：

1. 根据 `card_id` 找到卡片定义和配置
2. 根据卡片类型选择数据源能力
3. 按配置读取指定账号 / tab / query / tweet_id
4. 计算聚合结果
5. 保存缓存与 `last_updated`
6. 返回结构化卡片数据

例如：

- `latest_tweets`
  - 输入：`account_id`, `tab_id`, `limit`
  - 能力：`list_timeline_tweets(tab_id)`

- `tweet_time_distribution`
  - 输入：`account_id`, `days`
  - 能力：`list_timeline_tweets()` 或账号 tweet 列表接口
  - 输出：按小时 / 周几聚合

- `reply_monitor`
  - 输入：`tweet_id`
  - 能力：`get_tweet_replies(tweet_id)`

### 6.4 “任务执行引擎”推荐组合

建议任务系统拆成四层：

1. **任务定义层**
   - 类型、目标账号、输入参数、调度方式

2. **能力编排层**
   - 将任务翻译为 tweetClaw 原子能力序列

3. **执行层**
   - 调用 LocalBridge / tweetClaw

4. **审计层**
   - 保存每一步输入、输出、错误、耗时、截图 / 证据

例如“AI 回复 pinned tweet”任务：

1. `get_pinned_tweet(screen_name)`
2. `get_tweet(tweet_id)`
3. `send_message(platform, prompt)`
4. `reply(tweet_id, ai_text)`
5. 记录结果和错误

这实际上已经被 Python `reply_to_pinned_tweet_with_ai()` 证明可行。

---

## 7. 缺口分析，哪些是 TweetPilot 没接入，哪些是 tweetClaw 还需要增强

## 7.1 主要是 TweetPilot 没接入的能力

这部分不需要先改 tweetClaw，本质是 Rust/Tauri 层能力缺失。

### 已经存在但未接入的 tweetClaw 能力

1. 账号基础资料读取，`get_basic_info`
2. timeline 读取
3. tweet 详情读取
4. tweet replies 读取
5. 用户资料读取
6. 搜索能力
7. 发帖
8. 回复
9. like / retweet / bookmark / follow
10. 删除 tweet
11. tabs 管理
12. AI 平台交互
13. 媒体上传与带图发帖
14. 复合工作流原型

### 应优先补上的 Rust LocalBridge client 能力

建议把 `src-tauri/src/services/localbridge.rs` 扩展为完整 client，至少新增：

- `get_docs()`
- `list_timeline_tweets(tab_id)`
- `get_tweet(tweet_id, tab_id)`
- `get_tweet_replies(tweet_id, cursor, tab_id)`
- `get_user(screen_name, tab_id)`
- `get_pinned_tweet(screen_name, tab_id)`
- `search(query, count, cursor, tab_id)`
- `create_tweet(text, media_ids)`
- `reply(tweet_id, text, media_ids)`
- `like(tweet_id, tab_id)`
- `retweet(tweet_id, tab_id)`
- `bookmark(tweet_id, tab_id)`
- `follow(user_id, tab_id)`
- `delete_tweet(tweet_id, tab_id)`
- `open_tab(path)`
- `navigate_tab(path, tab_id)`
- `close_tab(tab_id)`

### 应优先改造的 Tauri commands

1. `account.rs`
   - 去掉 `ALL_ACCOUNTS`
   - 去掉默认假账号
   - 接入真实账号同步
   - 接入 `get_basic_info`
   - 接入实例 ID / tab 信息

2. `data_blocks.rs`
   - 所有 mock 卡片改为真实数据 provider
   - 引入卡片配置与账号绑定
   - 刷新逻辑改为真实拉取

3. 任务命令模块
   - 新增 task commands
   - 将 tweetClaw 原子能力包装成任务步骤

## 7.2 需要 tweetClaw 增强的能力

虽然当前大部分问题是 TweetPilot 未接入，但如果要支撑更强产品，tweetClaw 本身也需要继续增强。

### A. 账号与实例元数据增强

当前 `get_instances()` 返回的数据已经包含部分字段，但还不够稳定和产品化。建议补充：

1. 稳定的 `instance_id`
2. 扩展版本号
3. 浏览器 profile 标识
4. 最近心跳时间
5. 当前活跃页面类型
6. 当前账号是否可写
7. 权限与能力标记，是否支持 media、AI、tabs、search 等

### B. 更强的账号读取能力

建议新增：

1. `get_my_profile_metrics()`
   - 粉丝、关注、推文、媒体数等结构化指标

2. `list_my_tweets(cursor, limit)`
   - 不只读 timeline，而是读自己的发帖历史

3. `list_mentions(cursor, limit)`
   - 获取提及列表

4. `list_notifications(cursor, limit)`
   - 获取通知流

5. `get_engagement_metrics(tweet_id)`
   - 单 tweet 更完整互动指标

### C. 更强的任务/自动化能力

建议新增：

1. 批量动作接口
   - 批量 like / follow / bookmark

2. 幂等执行支持
   - 避免重复发帖、重复回复

3. 任务执行快照
   - 保存执行前后 DOM、截图、关键日志

4. 速率限制信号
   - 暴露平台风控、限流、操作冷却信息

5. 统一错误码
   - 区分未登录、页面结构变更、目标不存在、权限不足、风控限制等

### D. AI 协作增强

建议新增：

1. `summarize_timeline()`
2. `draft_tweets(persona, topic, count)`
3. `draft_reply(tweet_id, persona)`
4. `classify_search_results(query)`
5. `extract_user_profile(screen_name)`

这些可以做成 workflow，而不是必须都做成原子 API。

### E. 数据积木友好型聚合接口

如果产品大量依赖仪表盘，tweetClaw 可以提供更适合卡片消费的聚合能力：

1. `get_account_dashboard_summary()`
2. `get_recent_activity_summary()`
3. `get_posting_time_distribution()`
4. `get_task_ready_context()`

这样可以降低 Tauri 前后端重复聚合的复杂度。

---

## 8. 基于 tweetClaw 能力，建议新增的数据积木类型

既然 tweetClaw 已经有更丰富的读写和工作流能力，TweetPilot 不应该只停留在“最新推文 + 基础数据”两张卡。

推荐新增以下数据积木：

### 8.1 账号运营类

1. **账号连接状态卡**
   - 显示桥接状态、扩展状态、登录状态、默认 tab

2. **账号资料卡**
   - 显示头像、简介、粉丝、关注、发帖数

3. **最近发帖卡**
   - 展示最近 N 条 tweet

4. **固定推文卡**
   - 展示 pinned tweet 与快捷回复入口

5. **互动概览卡**
   - 汇总最近推文点赞、转推、回复趋势

### 8.2 发现与监控类

6. **关键词搜索监控卡**
   - 定时搜索关键词并展示最新结果

7. **竞品账号追踪卡**
   - 展示目标账号最近动态与资料变化

8. **回复队列卡**
   - 展示待处理回复列表

9. **提及监控卡**
   - 展示最近 mentions

10. **通知摘要卡**
   - 展示最近通知摘要

### 8.3 内容生产类

11. **AI 发帖建议卡**
   - 根据账号人格和近期动态生成 tweet 草稿

12. **AI 回复建议卡**
   - 针对指定 tweet 给出回复建议

13. **草稿箱卡**
   - 存放待发布 tweet 草稿

14. **媒体资产卡**
   - 展示可复用媒体与上传状态

### 8.4 任务与执行类

15. **任务队列卡**
   - 展示待执行 / 执行中 / 已完成任务

16. **任务结果卡**
   - 展示最近任务成功率、失败原因

17. **风控告警卡**
   - 展示限流、未登录、页面异常等风险

18. **多账号分发卡**
   - 展示同一内容向多个账号分发的状态

---

## 9. 推荐实施优先级

## P0，先把“假数据产品”变成“真实账号驱动产品”

### P0-1 账号同步真实化

- 去掉 `ALL_ACCOUNTS`
- 去掉默认测试账号
- 接入 `get_instances()` + `get_basic_info()` + `get_status()`
- 建立真实账号实体

### P0-2 数据积木真实化

优先改造现有卡片：

- `latest_tweets`
- `account_basic_data`
- `account_interaction_data`
- `tweet_time_distribution`
- `task_execution_stats`

### P0-3 Rust LocalBridge client 补齐

优先补齐：

- timeline
- user
- tweet
- replies
- search
- actions
- tabs

## P1，把账号页和任务页变成可运营系统

- 账号详情页接入 timeline / pinned tweet / tabs / action buttons
- 新增发帖、回复、like、follow 等任务
- 新增 AI 回复任务
- 新增搜索监控任务

## P2，扩展为完整运营工作台

- 媒体任务
- 多账号分发
- AI 内容建议
- 数据积木高级聚合
- 风控与审计

---

## 10. 最终结论

当前 TweetPilot 的核心问题不是“完全没有界面”，而是“界面和命令层与 tweetClaw 真实能力严重脱节”。

用一句话概括：

**TweetPilot 现在只用到了 tweetClaw 的一个角落，账号管理、数据积木、任务管理三大模块都还没有真正建立在 tweetClaw 之上。**

更具体地说：

1. **账号管理** 现在只有浅层实例同步，没有真实资料、真实状态、真实运营动作。
2. **数据积木** 现在主要是 mock 数据，没有把 tweetClaw 读取能力变成真实仪表盘。
3. **任务管理** 现在还没有把 tweetClaw 的读、写、媒体、AI、tab、workflow 组合成执行系统。

而从 `docs/clawBotCli` 可以确认：

- tweetClaw 已经具备足以支撑第一阶段产品落地的大部分基础能力。
- 当前最大的缺口主要在 TweetPilot 的 Rust/Tauri 接入层，而不是 tweetClaw 完全做不到。
- 真正需要 tweetClaw 继续增强的，是更高阶的数据聚合、监控、审计、自动化和风控能力。

因此后续工作的正确方向不是继续堆 UI，而是：

1. 先补齐 Rust LocalBridge client
2. 再把账号管理和数据积木全部改成真实数据驱动
3. 最后把 Python 已经验证过的复合工作流迁移成 TweetPilot 任务系统

只有这样，TweetPilot 才会从“推特运营工作台原型”变成“真正可用的 tweetClaw 驱动产品”。
