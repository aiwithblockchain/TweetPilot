# 数据积木模块后台逻辑重构方案

## 文档信息

- **版本**: v1.0
- **创建时间**: 2026-04-21
- **最后更新**: 2026-04-21

## 一、重构背景与目标

### 当前问题

1. **数据来源错误**：数据积木通过实时查询 LocalBridge API 获取数据，用户看到的是"当前快照"
2. **缺乏价值**：实时数据用户直接访问 Twitter 也能看到，没有额外价值
3. **Mock 代码冗余**：存在大量 Mock 数据和逻辑，不符合生产需求

### 设计理念转变

**从"实时查询"到"历史累积"**

- **旧设计**：数据积木 = 实时 API 查询结果
- **新设计**：数据积木 = 历史累积数据 + 趋势分析

### 核心价值

运营人员需要的不是"现在有多少粉丝"（Twitter 上就能看），而是：
- 过去 7 天每天涨了多少粉丝
- 哪个时间段涨粉最快
- 本周 vs 上周的推文互动数对比
- 过去 30 天的总浏览量趋势

**数据积木的价值 = 长期累积的数据 + 趋势分析**

## 二、架构变化

### 旧架构

```
前端 UI
  ↓ getCardData()
后端 Rust
  ↓ client.get_basic_info()
LocalBridge API (实时查询)
  ↓
Twitter API
```

### 新架构

```
定时任务 (5分钟)
  ↓ 写入接口
SQLite 数据库 (时间序列数据)
  ↑ 读取接口
后端 Rust
  ↑ getCardData()
前端 UI
```

**关键变化**：
- 定时任务负责**写入**数据到 SQLite
- 数据积木负责**读取**数据库中的历史数据
- 前端 UI 保持不变（卡片布局和管理逻辑）

## 三、要删除的代码

### 3.1 前端代码删除清单

#### 删除文件
- `src/services/data-blocks/mock.ts` - 完整删除
- `src/services/mock-data/data-blocks.ts` - 完整删除（如果存在）

#### 修改文件
- `src/services/data-blocks/index.ts`
  - 删除 `dataBlocksMockService` 的导入和引用
  - 简化为只使用 `dataBlocksTauriService`

### 3.2 后端代码删除清单

#### 修改文件：`src-tauri/src/commands/data_blocks.rs`

删除以下函数（实时查询逻辑）：
- `get_latest_tweets_data()` (第 163-187 行)
- `get_account_basic_data()` (第 189-210 行)
- `get_account_interaction_data()` (第 212-235 行)
- `get_tweet_time_distribution()` (第 237-285 行)
- `get_task_execution_stats()` (第 287-301 行)
- `format_tweet_time()` (第 303-309 行)
- `parse_day_of_week()` (第 311-334 行)

删除 `get_card_data()` 函数中的实时查询逻辑（第 134-147 行）：
```rust
// 删除这部分
let client = if let Ok(config) = crate::commands::preferences::get_local_bridge_config().await {
    LocalBridgeClient::new(config.endpoint, config.timeout_ms).ok()
} else {
    None
};

match card_type.as_str() {
    "latest_tweets" => get_latest_tweets_data(client, account_id).await,
    "account_basic_data" => get_account_basic_data(client, account_id).await,
    // ... 其他 case
}
```

## 四、数据库设计

### 4.1 表结构：`account_metrics_snapshots`

存储账号指标的时间序列快照数据。

```sql
CREATE TABLE IF NOT EXISTS account_metrics_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 账号标识（外键关联到 managed_twitter_accounts 表）
    twitter_id TEXT NOT NULL,
    
    -- 核心数据指标（来自 /api/v1/x/basic_info）
    followers_count INTEGER NOT NULL DEFAULT 0,
    following_count INTEGER NOT NULL DEFAULT 0,
    tweet_count INTEGER NOT NULL DEFAULT 0,
    favourites_count INTEGER NOT NULL DEFAULT 0,
    listed_count INTEGER NOT NULL DEFAULT 0,
    media_count INTEGER NOT NULL DEFAULT 0,
    
    -- 时间戳
    snapshot_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- 索引优化
    UNIQUE(twitter_id, snapshot_time)
);

-- 索引：按账号和时间查询
CREATE INDEX IF NOT EXISTS idx_account_time 
ON account_metrics_snapshots(twitter_id, snapshot_time DESC);

-- 索引：按时间范围查询
CREATE INDEX IF NOT EXISTS idx_snapshot_time 
ON account_metrics_snapshots(snapshot_time DESC);
```

### 4.2 数据字段说明

#### 外键关联
| 字段 | 类型 | 说明 |
|------|------|------|
| `twitter_id` | TEXT | Twitter 账号唯一 ID，关联到 `managed_twitter_accounts.twitter_id` |

**注意**：账号的基础信息（screen_name, display_name, avatar_url, is_verified, account_created_at）存储在 `managed_twitter_accounts` 表中，通过 `twitter_id` 关联获取。

#### 核心数据指标（运营关注的数据）
| 字段 | 类型 | API 路径 | 说明 |
|------|------|----------|------|
| `followers_count` | INTEGER | `legacy.followers_count` | 粉丝数 |
| `following_count` | INTEGER | `legacy.friends_count` | 关注数 |
| `tweet_count` | INTEGER | `legacy.statuses_count` | 推文数 |
| `favourites_count` | INTEGER | `legacy.favourites_count` | 点赞数 |
| `listed_count` | INTEGER | `legacy.listed_count` | 被列表收录数 |
| `media_count` | INTEGER | `legacy.media_count` | 媒体数量 |

#### 时间戳
| 字段 | 类型 | 说明 |
|------|------|------|
| `snapshot_time` | TIMESTAMP | 快照时间（数据采集时间） |

### 4.3 数据存储策略

**时间粒度**：
- 按天存储快照，一年最多 365 条记录
- 每天的数据会随着 5 分钟定时任务不断更新（UPDATE），保持最新

**数据保留策略**：
- 按天数据：保留 365 天（一年）
- 后期扩展：可以开发"按月聚合"功能，聚合后可以删除按天的旧数据
- 数据清理：交由专门的清理逻辑处理（后续开发）

**写入机制**：
- 24 小时内：UPDATE 现有记录的核心数据指标
- 超过 24 小时：INSERT 新记录

**唯一性约束**：
- `UNIQUE(twitter_id, snapshot_time)` 确保同一账号在同一时间点只有一条记录

## 五、新增接口设计

### 5.1 写入接口（数据采集）

#### 设计原则：24 小时快照机制

**核心思路**：
- 定时任务每 5 分钟执行一次，但不是每次都新增记录
- 按天存储快照，一年最多 365 条记录
- 每天的数据会随着 5 分钟定时任务不断更新，保持最新

**写入逻辑**：
1. 查询数据库中该账号最新的一条记录
2. 检查最新记录的 `snapshot_time` 与当前时间的时间差
3. **如果时间差 < 24 小时**：
   - 只更新这条记录的 6 个核心数据指标
   - 不更新其他字段（twitter_id, screen_name, display_name, avatar_url, is_verified, account_created_at）
4. **如果时间差 >= 24 小时**：
   - 插入新的一条记录（包含完整数据）

**优势**：
- 低存储成本：一年只有 365 条记录
- 高查询频率：每 5 分钟更新一次，数据保持新鲜
- 数据新鲜度：虽然按天存储，但当天的数据始终是最新的

#### 函数签名

```rust
/// 写入或更新账号指标快照到数据库
/// 
/// 由定时任务 `refresh_all_accounts_status()` 调用
/// 每 5 分钟执行一次
/// 
/// 逻辑：
/// - 如果最新记录 < 24 小时：只更新核心数据指标
/// - 如果最新记录 >= 24 小时：插入新记录
pub async fn write_account_metrics_snapshot(
    twitter_id: String,
    followers_count: i64,
    following_count: i64,
    tweet_count: i64,
    favourites_count: i64,
    listed_count: i64,
    media_count: i64,
) -> Result<(), String>
```

**注意**：账号的基础信息（screen_name, display_name, avatar_url, is_verified, account_created_at）由推特账号管理模块负责维护，存储在 `managed_twitter_accounts` 表中。

#### 实现伪代码

```rust
pub async fn write_account_metrics_snapshot(...) -> Result<(), String> {
    // 1. 查询该账号最新的一条记录
    let latest_record = db.query(
        "SELECT * FROM account_metrics_snapshots 
         WHERE twitter_id = ? 
         ORDER BY snapshot_time DESC 
         LIMIT 1",
        &[twitter_id]
    )?;
    
    let now = chrono::Utc::now();
    
    if let Some(record) = latest_record {
        let last_snapshot_time = parse_timestamp(record.snapshot_time)?;
        let duration = now.signed_duration_since(last_snapshot_time);
        
        if duration.num_hours() < 24 {
            // 2a. 时间差 < 24 小时：只更新核心数据指标
            db.execute(
                "UPDATE account_metrics_snapshots 
                 SET followers_count = ?,
                     following_count = ?,
                     tweet_count = ?,
                     favourites_count = ?,
                     listed_count = ?,
                     media_count = ?,
                     snapshot_time = ?
                 WHERE id = ?",
                &[
                    followers_count,
                    following_count,
                    tweet_count,
                    favourites_count,
                    listed_count,
                    media_count,
                    now.to_rfc3339(),
                    record.id
                ]
            )?;
        } else {
            // 2b. 时间差 >= 24 小时：插入新记录
            db.execute(
                "INSERT INTO account_metrics_snapshots (
                    twitter_id, screen_name, display_name, avatar_url,
                    is_verified, account_created_at,
                    followers_count, following_count, tweet_count,
                    favourites_count, listed_count, media_count,
                    snapshot_time
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                &[...all_fields]
            )?;
        }
    } else {
        // 3. 没有记录：插入第一条记录
        db.execute(
            "INSERT INTO account_metrics_snapshots (...) VALUES (...)",
            &[...all_fields]
        )?;
    }
    
    Ok(())
}
```

#### 调用位置

在 [src-tauri/src/commands/account.rs](src-tauri/src/commands/account.rs) 的 `refresh_all_accounts_status()` 函数中：

```rust
// 第 300-326 行，获取 basic_info 后
match client.get_basic_info_with_instance(instance_id).await {
    Ok(basic_info) => {
        // ... 现有逻辑 ...
        
        // 新增：写入数据库快照
        if let Err(e) = write_account_metrics_snapshot(
            basic_info.id.clone().unwrap_or_default(),
            real_screen_name.clone(),
            Some(display_name.clone()),
            Some(avatar.clone()),
            basic_info.is_verified.unwrap_or(false),
            basic_info.created_at.clone(),
            basic_info.followers_count.unwrap_or(0),
            basic_info.following_count.unwrap_or(0),
            basic_info.tweet_count.unwrap_or(0),
            basic_info.favourites_count.unwrap_or(0),
            basic_info.listed_count.unwrap_or(0),
            basic_info.media_count.unwrap_or(0),
        ).await {
            eprintln!("写入账号指标快照失败: {}", e);
        }
    }
}
```

### 5.2 读取接口（数据展示）

#### 设计原则：两个数据积木

**数据积木 1：历史趋势数据积木**
- 展示过去 N 天（7天/30天/365天）的数据变化趋势
- 用折线图或柱状图展示 6 个核心指标的历史变化
- 每天一个数据点

**数据积木 2：实时数据积木**
- 展示数据库中最新的一条记录
- 显示当前的 6 个核心指标数值
- 这是最近一次 5 分钟定时任务更新的数据

#### 函数签名

```rust
/// 读取账号指标的历史数据（用于历史趋势数据积木）
/// 
/// 返回按天存储的历史快照数据
pub async fn read_account_metrics_history(
    twitter_id: String,
    days: u32,  // 查询最近 N 天的数据
) -> Result<Vec<MetricsSnapshot>, String>

/// 读取账号最新的指标数据（用于实时数据积木）
/// 
/// 返回数据库中最新的一条记录
pub async fn read_account_metrics_latest(
    twitter_id: String,
) -> Result<MetricsSnapshot, String>

/// 指标快照数据结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsSnapshot {
    pub snapshot_time: String,
    pub followers_count: i64,
    pub following_count: i64,
    pub tweet_count: i64,
    pub favourites_count: i64,
    pub listed_count: i64,
    pub media_count: i64,
}
```

#### 查询示例

**示例 1：获取过去 7 天的历史数据（历史趋势数据积木）**
```rust
let history = read_account_metrics_history(
    "2008000592866893824".to_string(),
    7,  // 最近 7 天
).await?;
```

返回结果：
```json
[
  {
    "snapshot_time": "2026-04-21T15:30:00Z",
    "followers_count": 150,
    "following_count": 80,
    "tweet_count": 450,
    "favourites_count": 320,
    "listed_count": 5,
    "media_count": 120
  },
  {
    "snapshot_time": "2026-04-20T23:55:00Z",
    "followers_count": 145,
    "following_count": 78,
    "tweet_count": 445,
    "favourites_count": 315,
    "listed_count": 5,
    "media_count": 118
  }
  // ... 最多 7 条记录
]
```

**示例 2：获取最新数据（实时数据积木）**
```rust
let latest = read_account_metrics_latest(
    "2008000592866893824".to_string(),
).await?;
```

返回结果：
```json
{
  "snapshot_time": "2026-04-21T15:30:00Z",
  "followers_count": 150,
  "following_count": 80,
  "tweet_count": 450,
  "favourites_count": 320,
  "listed_count": 5,
  "media_count": 120
}
```

#### SQL 查询逻辑

**查询历史数据（按天）**：
```sql
SELECT 
    snapshot_time,
    followers_count,
    following_count,
    tweet_count,
    favourites_count,
    listed_count,
    media_count
FROM account_metrics_snapshots
WHERE twitter_id = ?
  AND snapshot_time >= datetime('now', '-' || ? || ' days')
ORDER BY snapshot_time DESC
LIMIT ?
```

**查询最新数据**：
```sql
SELECT 
    snapshot_time,
    followers_count,
    following_count,
    tweet_count,
    favourites_count,
    listed_count,
    media_count
FROM account_metrics_snapshots
WHERE twitter_id = ?
ORDER BY snapshot_time DESC
LIMIT 1
```

### 5.3 数据积木展示逻辑

#### 两个数据积木的实现

**数据积木 1：`account_metrics_latest`（实时数据积木）**

展示最新的账号指标数据。

```rust
#[tauri::command]
pub async fn get_card_data(
    card_id: String,
    card_type: String,
    account_id: Option<String>,
) -> Result<Value, String> {
    let cards = load_cards()?;
    let card = get_card_or_error(&cards, &card_id)?;
    if card.card_type != card_type {
        return Err("卡片类型不匹配".to_string());
    }

    match card_type.as_str() {
        "account_metrics_latest" => {
            let twitter_id = account_id.ok_or("缺少账号 ID")?;
            
            // 读取最新数据
            let latest = read_account_metrics_latest(twitter_id).await?;
            
            Ok(json!({
                "followers": latest.followers_count,
                "following": latest.following_count,
                "tweets": latest.tweet_count,
                "favourites": latest.favourites_count,
                "listed": latest.listed_count,
                "media": latest.media_count,
                "snapshot_time": latest.snapshot_time,
            }))
        }
        "account_metrics_history" => {
            let twitter_id = account_id.ok_or("缺少账号 ID")?;
            
            // 从卡片配置中读取天数，默认 7 天
            let days = card.config
                .as_ref()
                .and_then(|c| c.get("days"))
                .and_then(|d| d.as_u64())
                .unwrap_or(7) as u32;
            
            // 读取历史数据
            let history = read_account_metrics_history(twitter_id, days).await?;
            
            // 计算变化趋势（最新 vs 最旧）
            let latest = history.first();
            let oldest = history.last();
            
            let trends = if let (Some(latest), Some(oldest)) = (latest, oldest) {
                json!({
                    "followers_change": latest.followers_count - oldest.followers_count,
                    "following_change": latest.following_count - oldest.following_count,
                    "tweet_change": latest.tweet_count - oldest.tweet_count,
                    "favourites_change": latest.favourites_count - oldest.favourites_count,
                    "listed_change": latest.listed_count - oldest.listed_count,
                    "media_change": latest.media_count - oldest.media_count,
                })
            } else {
                json!({})
            };
            
            Ok(json!({
                "history": history,
                "trends": trends,
                "days": days,
            }))
        }
        _ => Ok(json!({})),
    }
}
```

#### 前端展示建议

**实时数据积木 UI**：
- 卡片标题：「账号实时数据」
- 展示 6 个核心指标的当前值
- 显示最后更新时间
- 简洁的数字展示，可以用图标辅助

**历史趋势数据积木 UI**：
- 卡片标题：「账号增长趋势」
- 用折线图或柱状图展示历史数据
- 支持切换时间范围（7天/30天/365天）
- 显示总体变化趋势（如：「过去 7 天粉丝增长 +15」）
- 可以选择展示哪些指标（默认展示粉丝数、推文数）

## 六、实现步骤

### Phase 1：数据库基础设施
1. 创建 SQLite 表结构 `account_metrics_snapshots`
2. 添加索引优化查询性能
3. 实现写入接口 `write_account_metrics_snapshot()`
   - 实现 24 小时快照机制（< 24h UPDATE，>= 24h INSERT）
   - 在定时任务 `refresh_all_accounts_status()` 中集成写入逻辑

### Phase 2：读取接口实现
1. 实现 `read_account_metrics_latest()` 函数（查询最新数据）
2. 实现 `read_account_metrics_history()` 函数（查询历史数据）
3. 编写 SQL 查询逻辑（按天查询，支持不同时间范围）

### Phase 3：数据积木重构
1. 删除 Mock 代码
   - 删除 [src/services/data-blocks/mock.ts](src/services/data-blocks/mock.ts)
   - 删除 [src/services/mock-data/data-blocks.ts](src/services/mock-data/data-blocks.ts)
   - 简化 [src/services/data-blocks/index.ts](src/services/data-blocks/index.ts)
2. 删除实时查询逻辑
   - 删除 [src-tauri/src/commands/data_blocks.rs](src-tauri/src/commands/data_blocks.rs) 中的旧数据获取函数
3. 修改 `get_card_data()` 使用新的读取接口
   - 实现 `account_metrics_latest` 数据积木
   - 实现 `account_metrics_history` 数据积木
4. 更新前端数据结构（如果需要）

### Phase 4：前端 UI 适配
1. 创建实时数据积木组件（展示 6 个核心指标）
2. 创建历史趋势数据积木组件（折线图/柱状图）
3. 支持时间范围切换（7天/30天/365天）
4. 测试数据展示和刷新

### Phase 5：测试与优化
1. 测试写入逻辑（24 小时机制）
2. 测试读取逻辑（最新数据和历史数据）
3. 验证数据积木展示正确性
4. 性能优化（索引、查询优化）
5. 数据清理策略（后续开发）

## 七、前端 UI 保持不变

以下功能**不需要修改**：
- 卡片布局管理（`getLayout`, `saveLayout`）
- 添加/删除卡片（`addCard`, `deleteCard`）
- 卡片拖拽排序
- 卡片刷新机制（`refreshCardData`）

前端只需要适配新的数据结构（从"当前快照"变为"当前数据 + 趋势 + 历史"）。

## 八、多账号支持

**设计**：
- 通过 `twitter_id` 区分不同账号
- 前端传递 `account_id` 参数指定查询哪个账号
- 每个账号独立存储快照数据
- 支持"所有账号"视图（聚合展示多个账号的数据）

**实现**：
- 数据库表通过 `twitter_id` 字段区分账号
- 读取接口需要传入 `twitter_id` 参数
- 前端可以通过下拉菜单或标签页切换不同账号的数据积木

## 九、参考文档

- [Twitter API 数据积木设计方案](./twitter-api-data-block-design.md)
- API 端点：`/api/v1/x/basic_info`
- 定时任务：`refresh_all_accounts_status()` (每 5 分钟)

---

**文档状态**：设计阶段，待评审
