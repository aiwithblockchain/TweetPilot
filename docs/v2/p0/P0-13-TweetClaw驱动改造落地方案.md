# P0-13 TweetClaw 驱动改造落地方案

## 1. 文档定位

本文档是当前 TweetPilot 推特能力改造的唯一主实施方案，用来替代此前分散的阶段性方案、完成总结和失真的审查报告。

它基于以下事实重新制定：

1. `P0-12-TweetClaw能力对齐分析.md` 已确认当前系统并未真正建立在 tweetClaw 能力之上。
2. `docs/clawBotCli` 已证明 tweetClaw 通过 LocalBridge 暴露出的能力面远超当前 Rust/Tauri 接入层。
3. 当前最主要的问题不是“还没做 UI”，而是“账号管理、数据积木、任务管理三条主线仍然是 mock 或半接线状态”。
4. LocalBridge 是 REST 转发层，真正的能力来自 tweetClaw 扩展实例。

本文档目标不是重复问题分析，而是明确：

- 先改哪些文件
- 每个文件改什么
- 哪些能力先接，哪些后接
- 哪些旧文档可以淘汰
- 如何把当前系统从“原型态”推进到“真实可运行态”

---

## 2. 文档处理结论

本轮文档治理后，建议按以下方式处理原有未提交文档。

### 2.1 保留

1. `docs/v2/p0/P0-12-TweetClaw能力对齐分析.md`
   - 作为问题分析与能力对齐依据

2. `docs/v2/p0/P0-10-接口设计修复方案.md`
   - 保留其“接口不要暴露实现细节”的架构约束
   - 后续以本方案为主，不再单独作为实施清单

### 2.2 归档

1. `docs/v2/p0/P0-09-功能增强计划.md`
   - 保留历史价值，但不再作为当前主计划
   - 应迁入 `docs/v2/p0/archive/`

### 2.3 合并后删除

1. `docs/v2/p0/P0-09-阶段2-LocalBridge集成方案.md`
   - 其中对实例模型、LocalBridge 客户端草案的有效部分已吸收进本方案
   - 原文不再保留

### 2.4 直接删除

1. `docs/v2/p0/P0-09-阶段1-GitHub克隆功能完成总结.md`
2. `docs/v2/p0/P0-09-阶段2-LocalBridge集成完成总结.md`
3. `docs/v2/p0/P0-11-接口设计全面审查报告.md`

删除原因：

- 属于阶段性完成总结，长期价值低
- 或者其结论已与当前代码现实冲突，会误导后续判断

---

## 3. 改造总原则

### 3.1 原则一，先真实化账号，再真实化卡片，再接任务

不能先做任务，因为：

- 任务执行依赖真实账号上下文
- 数据积木依赖真实账号和真实读能力
- 如果账号层仍然是假的，后面全部会建立在错误基础上

所以顺序固定为：

1. 账号管理真实化
2. 数据积木真实化
3. 任务系统接入 tweetClaw workflow

### 3.2 原则二，优先补 Rust LocalBridge client，不要先在前端绕逻辑

当前 Python SDK 已经证明能力存在。

因此正确做法是：

- 在 Rust 侧补齐能力封装
- 让 Tauri commands 直接消费这些能力
- 前端只使用稳定 service interface

不要把 tweetClaw 组合逻辑散落到前端组件里。

### 3.3 原则三，前端接口保持产品语义，不暴露 LocalBridge 实现语义

保留 `P0-10` 的核心原则：

- UI 不应该调用 `syncAccountsFromLocalBridge()` 这种实现细节命名
- UI 应只表达产品动作，例如：
  - `refreshAllAccountsStatus()`
  - `getAccountSettings()`
  - `getCardData()`
  - `createTask()`

LocalBridge / tweetClaw 作为底层能力源，应被封装在 Tauri command 和 Rust service 里。

### 3.4 原则四，先打通真实读能力，再做写能力

写能力更敏感，也更容易放大错误。

所以接入顺序应是：

1. 读状态
2. 读实例
3. 读账号基础信息
4. 读 timeline
5. 读用户 profile
6. 读 tweet / replies / search
7. 再接 create/reply/like/follow 等写动作

### 3.5 原则五，所有数据积木必须有明确数据源

后续每个卡片都必须能回答三个问题：

1. 数据从哪个 tweetClaw 能力来
2. 需要哪些配置参数
3. 数据刷新时实际执行什么动作

不能再出现“刷新只是更新时间，数据仍然是常量”的假刷新行为。

---

## 4. 当前代码改造范围

本轮改造聚焦以下核心文件。

## 4.1 后端核心

1. `src-tauri/src/services/localbridge.rs`
2. `src-tauri/src/commands/account.rs`
3. `src-tauri/src/commands/data_blocks.rs`
4. `src-tauri/src/commands/task.rs`
5. `src-tauri/src/main.rs`

## 4.2 前端服务层

1. `src/services/account/types.ts`
2. `src/services/account/tauri.ts`
3. `src/services/account/mock.ts`
4. `src/services/data-blocks/types.ts`
5. `src/services/data-blocks/tauri.ts`
6. `src/services/data-blocks/mock.ts`
7. `src/services/task/types.ts`
8. `src/services/task/tauri.ts`
9. `src/services/task/mock.ts`

## 4.3 前端 UI 消费层

1. `src/components/AccountManagement.tsx`
2. 账号设置相关组件
3. 数据积木相关组件
4. 任务管理相关组件

注意，本轮 UI 层不是重点，UI 只做必要的字段对齐和真实状态展示。

---

## 5. 阶段一，账号管理真实化

这是最高优先级。

## 5.1 改造目标

把当前账号体系从：

- 硬编码账号列表
- 假账号详情
- 伪造 twitter_id
- 仅用 `get_instances()` 做浅同步

改成：

- 基于 tweetClaw 实例发现账号
- 基于 `get_basic_info()` 获取真实 viewer 信息
- 基于 `get_status()` 获取登录与 tab 状态
- 账号实体中保存真实实例上下文

## 5.2 `src-tauri/src/services/localbridge.rs` 要做的事

当前只实现了：

- `get_status()`
- `get_instances()`
- `get_basic_info()`

第一阶段至少要补到下面这组：

### A. 状态类

- `get_status()`
- `get_instances()`
- `get_basic_info()`
- `test_connection()`

### B. 读取类，第一批

- `get_timeline(tab_id)`
- `get_user(screen_name, tab_id)`
- `get_tweet(tweet_id, tab_id)`
- `get_tweet_replies(tweet_id, cursor, tab_id)`
- `search(query, count, cursor, tab_id)`
- `get_pinned_tweet(screen_name, tab_id)`

### C. 写操作类，第二批

- `create_tweet(text, media_ids)`
- `reply(tweet_id, text, media_ids)`
- `like(tweet_id, tab_id)`
- `retweet(tweet_id, tab_id)`
- `bookmark(tweet_id, tab_id)`
- `follow(user_id, tab_id)`
- `delete_tweet(tweet_id, tab_id)`

### D. 标签页类，第二批

- `open_tab(path)`
- `navigate_tab(path, tab_id)`
- `close_tab(tab_id)`

### E. 实现要求

1. 每个方法都要做统一错误处理
2. 对 raw JSON 解析要抽出最小稳定结构
3. 不要把过深的 Twitter 响应结构直接暴露给 command 层
4. 尽量在 service 层完成第一次语义抽象

## 5.3 `src-tauri/src/commands/account.rs` 要做的事

### 必删内容

1. 删除 `ALL_ACCOUNTS` 常量依赖
2. 删除默认 `@testuser1`
3. 删除伪造 `twitter_id`
4. 删除固定 `extension_id = ext_abc123`
5. 删除固定 `extension_name = LocalBridge Extension`
6. 删除 `is_linked = true` 这种硬编码

### 必改逻辑

#### A. `get_available_accounts()`

改为：

- 从 LocalBridge `get_instances()` 获取实例
- 对实例进一步补全 viewer 基本信息
- 返回“当前可接入但未映射”的真实账号

#### B. `map_account(screen_name)`

改为：

- 不再从 `ALL_ACCOUNTS` 查找
- 从最近同步到的真实账号候选池里匹配
- 或直接触发一次实时同步后映射

#### C. `refresh_all_accounts_status()`

改为真正的账号同步入口：

1. 调 `get_instances()`
2. 对每个实例检查基础状态
3. 尝试拿 `screen_name / name / avatar / id / description`
4. 补默认 tab / tabs 信息
5. 更新本地映射与状态
6. 标记不可用实例的离线原因

#### D. `get_account_settings(screen_name)`

改为读取真实账号实体：

- `twitter_id` 来自真实资料
- `is_linked` 由实例绑定关系推导
- `extension_id` / `extension_name` 由实例真实字段提供
- 人格设定仍从本地持久化读

### 新增建议

新增一个统一的账号同步内部函数，例如：

- `sync_accounts_from_tweetclaw()`

但它只作为 Rust 内部帮助函数存在，不一定暴露到前端接口层。

## 5.4 数据模型调整

建议在 Rust 侧补强账号实体，至少增加：

- `twitter_id: Option<String>`
- `description: Option<String>`
- `instance_id: Option<String>`
- `extension_name: Option<String>`
- `default_tab_id: Option<i32>`
- `tab_count: Option<usize>`
- `is_logged_in: bool`
- `status_reason: Option<String>`

如果前端暂时不全展示，也应该先在后端实体里保住这些真实字段。

---

## 6. 阶段二，数据积木真实化

账号真实化之后，立刻处理 `data_blocks.rs`。

## 6.1 改造目标

把当前 `get_card_data()` 从硬编码常量返回，改成真正的“按卡片类型选择 provider”。

## 6.2 `src-tauri/src/commands/data_blocks.rs` 要做的事

### 先保留的卡片类型

第一阶段先只真实化现有卡片，不急着同时加十几种新卡。

优先顺序：

1. `account_basic_data`
2. `latest_tweets`
3. `account_interaction_data`
4. `tweet_time_distribution`
5. `task_execution_stats`

### 每张卡的真实数据源

#### A. `account_basic_data`

数据源：

- `get_basic_info()`
- `get_user(screen_name)`

输出建议：

- `screenName`
- `displayName`
- `description`
- `followers`
- `following`
- `tweets`
- `avatar`
- `isLoggedIn`

#### B. `latest_tweets`

数据源：

- `get_timeline(tab_id)` 或 timeline tweet 列表解析能力

输出建议：

- tweet id
- text
- created_at
- likes
- retweets
- replies
- author

#### C. `account_interaction_data`

数据源：

- 最近 timeline 或本人 tweet 列表聚合

输出建议：

- totalLikes
- totalRetweets
- totalReplies
- sampleSize

#### D. `tweet_time_distribution`

数据源：

- 最近 tweet 列表的时间字段聚合

输出建议：

- 周维度或小时维度分布

#### E. `task_execution_stats`

第一阶段先继续由本地任务记录提供，但必须是真实任务记录，不再是常量。

## 6.3 卡片配置体系要补齐

当前 `config` 只是一个空 JSON 占位。

后续每个卡片至少支持这些参数：

- `accountId`
- `instanceId`
- `tabId`
- `limit`
- `query`
- `tweetId`
- `timeRange`

### 建议做法

1. 为卡片类型建立配置 schema
2. `get_card_data(card_id, card_type, account_id)` 内先解析卡片配置
3. 再选择 provider
4. provider 返回统一结果结构

## 6.4 刷新逻辑必须改真

`refresh_card_data(card_id)` 不能只更新时间。

应改为：

1. 读取卡片配置
2. 执行对应 provider
3. 保存缓存或刷新快照
4. 更新 `last_updated`
5. 返回成功或失败状态

---

## 7. 阶段三，任务系统接 tweetClaw 能力

这是第三优先级，但在架构上要提前留口。

## 7.1 改造目标

把当前任务系统从“脚本执行概念”转成“tweetClaw 能力编排器”。

## 7.2 第一批任务类型

优先只做最能证明链路打通的 5 类：

1. 文本发帖任务
2. 回复任务
3. 点赞任务
4. 搜索并互动任务
5. AI 回复任务

## 7.3 每类任务的底层能力映射

### A. 文本发帖任务

- 输入：账号、文本
- 能力：`create_tweet(text)`

### B. 回复任务

- 输入：账号、tweet_id、text
- 能力：`reply(tweet_id, text)`

### C. 点赞任务

- 输入：账号、tweet_id
- 能力：`like(tweet_id, tab_id)`

### D. 搜索并互动任务

- 输入：query、互动策略、limit
- 能力：
  - `search_tweets(query)`
  - `like / reply / retweet`

### E. AI 回复任务

- 输入：tweet_id、AI 平台、人格设定
- 能力：
  - `get_tweet(tweet_id)`
  - `send_message(platform, prompt)`
  - `reply(tweet_id, ai_text)`

## 7.4 `src-tauri/src/commands/task.rs` 要做的事

### 第一阶段不做的事

- 不先做通用任意脚本执行
- 不先做多种 runtime 沙箱
- 不先做很重的调度器

### 第一阶段要做的事

1. 任务类型重新收敛到 tweetClaw 场景
2. 任务配置模型补字段：
   - `account_screen_name`
   - `instance_id`
   - `tab_id`
   - `tweet_id`
   - `query`
   - `platform`
   - `prompt_template`
3. 执行器按任务类型路由到 tweetClaw 能力
4. 保存真实执行记录
5. 错误分类至少区分：
   - bridge_unreachable
   - instance_offline
   - not_logged_in
   - parse_failed
   - action_failed

## 7.5 执行记录模型

建议增加：

- `step_logs`
- `started_at`
- `finished_at`
- `duration_ms`
- `error_code`
- `error_message`
- `input_snapshot`
- `output_snapshot`

这样后面 `task_execution_stats` 卡片才有真实来源。

---

## 8. 前端接口调整方案

## 8.1 AccountService

原则：继续保持产品语义接口。

### 保留

- `getAvailableAccounts()`
- `getMappedAccounts()`
- `mapAccount()`
- `refreshAllAccountsStatus()`
- `getAccountSettings()`
- `saveAccountPersonality()`
- `unlinkAccount()`
- `deleteAccountCompletely()`

### 调整点

- 返回结构要补充真实字段
- mock 实现不能再和真实字段完全脱节

## 8.2 DataBlocksService

### 保留

- `getLayout()`
- `saveLayout()`
- `addCard()`
- `deleteCard()`
- `getCardData()`
- `refreshCardData()`

### 调整点

- `getCardData()` 返回值要更结构化
- 卡片类型与配置要有稳定类型定义

## 8.3 TaskService

### 调整点

任务类型从“泛脚本执行”偏向“tweetClaw 场景任务”。

如果现有 UI 已强绑定脚本概念，则需要做一次类型重构，但接口层仍应保持面向产品，而不是暴露 LocalBridge 细节。

---

## 9. 具体实施顺序

## 第 1 步，文档清理

1. 归档 `P0-09-功能增强计划.md`
2. 删除阶段性完成总结
3. 删除失真审查报告
4. 删除已被本方案吸收的旧 LocalBridge 集成方案

## 第 2 步，补 Rust LocalBridge client

目标文件：

- `src-tauri/src/services/localbridge.rs`

先做读能力，不急着上写能力。

## 第 3 步，改账号命令

目标文件：

- `src-tauri/src/commands/account.rs`

把假账号、硬编码、伪造字段全部清掉。

## 第 4 步，改数据积木命令

目标文件：

- `src-tauri/src/commands/data_blocks.rs`

把 5 张现有卡先接成真实数据。

## 第 5 步，前端字段对齐

目标文件：

- `src/services/account/*`
- `src/services/data-blocks/*`
- 相关 React 组件

## 第 6 步，任务模型重构

目标文件：

- `src-tauri/src/commands/task.rs`
- `src/services/task/*`

先做最小闭环任务类型。

---

## 10. 阶段验收标准

## 10.1 阶段一验收，账号层

必须满足：

1. 不再存在默认假账号
2. 不再依赖 `ALL_ACCOUNTS`
3. `get_basic_info()` 真正参与账号同步
4. 账号详情不再伪造 twitter_id
5. 账号状态能区分至少在线、离线、未登录、桥接异常
6. 前端账号列表展示真实同步结果

## 10.2 阶段二验收，数据积木层

必须满足：

1. `latest_tweets` 不再返回固定测试文本
2. `account_basic_data` 不再返回固定数字
3. `refresh_card_data()` 真正执行数据刷新
4. 至少 3 张卡可以绑定真实账号上下文
5. 数据异常时有错误态，而不是空 JSON 糊过去

## 10.3 阶段三验收，任务层

必须满足：

1. 至少 3 类 tweetClaw 任务可执行
2. 任务执行记录可查看
3. 任务统计卡有真实来源
4. 错误分类可区分能力问题和数据问题

---

## 11. 风险与注意事项

### 11.1 最大风险

不是代码写不出来，而是误把“接口存在”当成“能力已接入”。

现在项目里已经有这个问题：

- 看上去有 account 管理
- 看上去有 data blocks
- 看上去有 LocalBridge 集成

但底层并没有打通。

所以本轮必须坚持“看数据源，不看 UI 壳子”。

### 11.2 解析风险

tweetClaw 返回的 Twitter 原始结构可能很深。

应对策略：

- 在 `localbridge.rs` 里收敛解析
- 不把复杂 raw JSON 层层往上传
- 对关键字段提最小必要集

### 11.3 写操作风险

写操作接入后会更容易触发真实副作用。

因此：

- 先读后写
- 先单账号后多账号
- 先最小任务类型后复杂编排

---

## 12. 最终结论

这轮改造的真正目标，不是“继续补几个接口”，而是把 TweetPilot 的推特产品能力底座彻底换成 tweetClaw 驱动。

具体来说：

1. 账号层要从假映射变成真实实例同步
2. 数据积木要从 mock 展示变成真实读能力投影
3. 任务系统要从概念型脚本执行变成 tweetClaw 能力编排器

只有完成这三步，TweetPilot 才算真正进入“可用产品”阶段。
