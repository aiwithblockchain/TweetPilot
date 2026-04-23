# 数据积木模块重构方案 v2.0

## 文档信息

- **版本**: v2.0
- **创建时间**: 2026-04-23
- **最后更新**: 2026-04-23
- **状态**: 已实施

## 一、重构背景

### 核心问题

旧版数据积木通过实时查询 LocalBridge API 获取数据，用户看到的是"当前快照"，缺乏历史趋势分析能力。

### 设计理念

**从"实时查询"到"历史累积"**

- **旧设计**: 数据积木 = 实时 API 查询结果
- **新设计**: 数据积木 = x_account_trend 表的 1 小时间隔历史数据

### 核心价值

运营人员需要的不是"现在有多少粉丝"，而是：
- 过去 24 小时粉丝增长趋势
- 账号活跃度变化（推文数、点赞数）
- 多维度数据对比分析

**数据积木的价值 = 1 小时间隔的历史数据 + 趋势分析**

## 二、数据源：x_account_trend 表

### 表结构

```sql
CREATE TABLE x_account_trend (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    twitter_id TEXT NOT NULL,
    screen_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    description TEXT,
    is_verified BOOLEAN DEFAULT 0,
    followers_count INTEGER,
    following_count INTEGER,
    tweet_count INTEGER,
    favourites_count INTEGER,
    listed_count INTEGER,
    media_count INTEGER,
    account_created_at TEXT,
    last_online_time TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    FOREIGN KEY (twitter_id) REFERENCES x_accounts(twitter_id) ON DELETE CASCADE
)
```

### 数据特点

- **时间粒度**: 1 小时间隔
- **数据来源**: 定时任务 `refresh_all_accounts_status()` 每 5 分钟采集一次
- **存储策略**: 每小时插入新记录，保留历史数据
- **关键字段**: 
  - `followers_count`: 粉丝数
  - `following_count`: 关注数
  - `tweet_count`: 推文数
  - `favourites_count`: 点赞数
  - `listed_count`: 被列表收录数
  - `media_count`: 媒体数量

## 三、数据积木卡片设计

基于 x_account_trend 表，设计 4 种数据积木卡片：

### 1. 账号实时数据卡片 (`account_current_metrics`)

**功能**: 显示最新的账号指标快照

**数据来源**: `x_account_trend` 表最新一条记录

**返回数据结构**:
```json
{
  "screenName": "用户名",
  "displayName": "显示名称",
  "avatarUrl": "头像URL",
  "isVerified": true,
  "followers": 150,
  "following": 80,
  "tweets": 450,
  "favourites": 320,
  "listed": 5,
  "media": 120,
  "snapshotTime": "2026-04-23T14:30:00Z"
}
```

**前端展示建议**:
- 卡片标题: "账号实时数据"
- 6 个核心指标的当前值
- 显示最后更新时间
- 简洁的数字展示 + 图标

### 2. 粉丝增长趋势卡片 (`followers_growth_trend`)

**功能**: 显示过去 N 小时的粉丝增长曲线

**配置参数**: `hours` (默认 24 小时)

**数据来源**: `x_account_trend` 表最近 N 小时的记录

**返回数据结构**:
```json
{
  "data": [
    {"time": "2026-04-23T14:00:00Z", "followers": 145},
    {"time": "2026-04-23T15:00:00Z", "followers": 147},
    {"time": "2026-04-23T16:00:00Z", "followers": 150}
  ],
  "growth": 5,
  "hours": 24
}
```

**前端展示建议**:
- 卡片标题: "粉丝增长趋势"
- 折线图展示历史数据
- 显示总增长数（正数绿色，负数红色）
- 支持切换时间范围（24h / 7天 / 30天）

### 3. 账号活跃度卡片 (`account_activity_metrics`)

**功能**: 显示推文数、点赞数、媒体数的变化

**配置参数**: `hours` (默认 24 小时)

**数据来源**: `x_account_trend` 表最近 N 小时的首尾记录对比

**返回数据结构**:
```json
{
  "tweetChange": 5,
  "favouriteChange": 12,
  "mediaChange": 3,
  "hours": 24
}
```

**前端展示建议**:
- 卡片标题: "账号活跃度"
- 3 个指标的变化值（带 +/- 符号）
- 用颜色区分增长/下降
- 显示时间范围

### 4. 账号概览卡片 (`account_overview`)

**功能**: 综合展示多个维度的数据对比

**配置参数**: `hours` (默认 24 小时)

**数据来源**: `x_account_trend` 表最新记录 + 历史对比

**返回数据结构**:
```json
{
  "current": {
    "screenName": "用户名",
    "displayName": "显示名称",
    "avatarUrl": "头像URL",
    "followers": 150,
    "following": 80,
    "tweets": 450,
    "favourites": 320
  },
  "changes": {
    "followers": 5,
    "following": 2,
    "tweets": 3,
    "favourites": 8
  },
  "hours": 24
}
```

**前端展示建议**:
- 卡片标题: "账号概览"
- 左侧显示当前值
- 右侧显示变化值（带箭头和颜色）
- 支持切换时间范围

## 四、后端实现

### 4.1 数据读取接口

#### 函数 1: `get_account_current_metrics`

```rust
async fn get_account_current_metrics(account_id: Option<String>) -> Result<Value, String>
```

**功能**: 读取账号最新的指标数据

**实现逻辑**:
1. 从 `x_account_trend` 表查询最新一条记录
2. 返回所有核心指标

#### 函数 2: `get_followers_growth_trend`

```rust
async fn get_followers_growth_trend(account_id: Option<String>, card: &Card) -> Result<Value, String>
```

**功能**: 读取粉丝增长趋势数据

**实现逻辑**:
1. 从卡片配置读取 `hours` 参数（默认 24）
2. 查询最近 N 小时的记录
3. 计算总增长数（最新 - 最旧）
4. 返回时间序列数据

#### 函数 3: `get_account_activity_metrics`

```rust
async fn get_account_activity_metrics(account_id: Option<String>, card: &Card) -> Result<Value, String>
```

**功能**: 读取账号活跃度指标变化

**实现逻辑**:
1. 从卡片配置读取 `hours` 参数（默认 24）
2. 查询最近 N 小时的首尾记录
3. 计算推文数、点赞数、媒体数的变化
4. 返回变化值

#### 函数 4: `get_account_overview`

```rust
async fn get_account_overview(account_id: Option<String>, card: &Card) -> Result<Value, String>
```

**功能**: 读取账号概览数据

**实现逻辑**:
1. 从卡片配置读取 `hours` 参数（默认 24）
2. 查询最新记录和历史记录
3. 计算所有核心指标的变化
4. 返回当前值 + 变化值

### 4.2 数据库查询

使用 `TaskDatabase` 中已有的方法：

- `get_latest_account_snapshot(twitter_id)`: 获取最新快照
- `get_account_snapshots(twitter_id, limit)`: 获取历史快照列表

### 4.3 默认卡片配置

```rust
fn default_cards() -> Vec<Card> {
    vec![
        Card {
            id: "card_1",
            card_type: "account_current_metrics",
            position: 0,
            config: Some(json!({})),
        },
        Card {
            id: "card_2",
            card_type: "followers_growth_trend",
            position: 1,
            config: Some(json!({"hours": 24})),
        },
        Card {
            id: "card_3",
            card_type: "account_activity_metrics",
            position: 2,
            config: Some(json!({"hours": 24})),
        },
        Card {
            id: "card_4",
            card_type: "account_overview",
            position: 3,
            config: Some(json!({"hours": 24})),
        },
    ]
}
```

## 五、前端实现

### 5.1 类型定义更新

**文件**: `src/services/data-blocks/types.ts`

```typescript
export type KnownDataBlockCardType =
  | 'account_current_metrics'
  | 'followers_growth_trend'
  | 'account_activity_metrics'
  | 'account_overview'
```

### 5.2 前端 UI 建议

#### 卡片 1: 账号实时数据
- 使用网格布局展示 6 个指标
- 每个指标显示图标 + 数值
- 底部显示最后更新时间

#### 卡片 2: 粉丝增长趋势
- 使用折线图（推荐 Chart.js 或 Recharts）
- X 轴: 时间，Y 轴: 粉丝数
- 顶部显示总增长数（带颜色）
- 支持时间范围切换按钮

#### 卡片 3: 账号活跃度
- 使用卡片式布局
- 3 个指标垂直排列
- 每个指标显示变化值 + 百分比（可选）
- 用颜色区分增长/下降

#### 卡片 4: 账号概览
- 左右分栏布局
- 左侧: 当前值（大字号）
- 右侧: 变化值（带箭头图标）
- 支持时间范围切换

## 六、已删除的代码

### 6.1 后端删除清单

**文件**: `src-tauri/src/commands/data_blocks.rs`

删除的函数：
- `get_latest_tweets_data()` - 实时查询推文
- `get_account_basic_data()` - 实时查询账号基础数据
- `get_account_interaction_data()` - 实时查询互动数据
- `get_tweet_time_distribution()` - 实时查询推文时间分布
- `get_task_execution_stats()` - 任务执行统计（已移除）
- `format_tweet_time()` - 辅助函数
- `parse_day_of_week()` - 辅助函数

删除的依赖：
- `LocalBridgeClient` 导入
- `HashMap` 导入（不再需要）

### 6.2 前端删除清单

**文件**: `src/services/data-blocks/types.ts`

删除的卡片类型：
- `latest_tweets`
- `account_basic_data`
- `account_interaction_data`
- `tweet_time_distribution`
- `task_execution_stats`

## 七、多账号支持

**设计**:
- 通过 `account_id` 参数区分不同账号
- 前端传递 `twitter_id` 指定查询哪个账号
- 每个账号独立存储快照数据
- 支持"所有账号"视图（聚合展示，后续开发）

**实现**:
- 数据库表通过 `twitter_id` 字段区分账号
- 所有读取接口需要传入 `account_id` 参数
- 前端可以通过下拉菜单切换不同账号的数据积木

## 八、后续扩展（Phase 2）

### 8.1 更多数据源

未来可以增加更多数据源，例如：

1. **推文数据积木**
   - 数据源: `x_tweets` 表（如果有）
   - 卡片类型: 最新推文、推文互动统计、推文时间分布

2. **任务执行数据积木**
   - 数据源: `tasks` 和 `executions` 表
   - 卡片类型: 任务执行成功率、任务执行时长统计

3. **粉丝分析数据积木**
   - 数据源: 粉丝数据表（需要新增）
   - 卡片类型: 粉丝增长来源、粉丝活跃度分析

### 8.2 高级功能

1. **数据导出**: 支持导出 CSV/Excel
2. **自定义时间范围**: 支持自定义开始和结束时间
3. **数据对比**: 支持多个账号的数据对比
4. **告警功能**: 当指标异常时发送通知

## 九、实施状态

### 已完成

- ✅ 删除旧的实时查询逻辑函数
- ✅ 实现基于 x_account_trend 的数据读取接口
- ✅ 设计并实现 4 种新的数据积木卡片类型
- ✅ 更新前端类型定义
- ✅ 更新默认卡片配置

### 待完成

- ⏳ 前端 UI 组件实现
- ⏳ 图表库集成（Chart.js 或 Recharts）
- ⏳ 时间范围切换功能
- ⏳ 多账号切换功能
- ⏳ 测试和优化

## 十、参考信息

- **数据库文件**: `src-tauri/src/task_database.rs`
- **后端命令**: `src-tauri/src/commands/data_blocks.rs`
- **前端类型**: `src/services/data-blocks/types.ts`
- **定时任务**: `refresh_all_accounts_status()` (每 5 分钟执行)

---

**文档状态**: 已实施，待前端 UI 开发
