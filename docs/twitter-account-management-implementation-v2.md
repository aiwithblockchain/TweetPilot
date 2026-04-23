# 推特账号管理实现方案 v3.0

## 文档信息

- **版本**: v3.0
- **更新时间**: 2026-04-23
- **基于**: v2.0 设计方案（已根据实际实现重写）
- **状态**: 已实现并运行中

## 一、核心设计原则

### 1.1 双存储策略

- **已管理账号**: 持久化到数据库（`x_accounts` + `x_account_trend`）
- **未管理账号**: 仅存在于内存中（`unmanaged_online_accounts`），不写数据库
- **定时同步**: `LocalBridgeSyncExecutor` 每 5 分钟查询 LocalBridge，更新账号状态

### 1.2 数据管理策略

- **软删除**: 使用 `is_managed` 标志位，不物理删除数据
- **快照管理**: 已管理账号的信息变化记录到 `x_account_trend` 表
  - 超过 1 小时：插入新快照
  - 1 小时内：更新现有快照
- **三种操作**:
  - 添加到管理: `is_managed = 1`，插入初始快照
  - 解除管理: `is_managed = 0`（保留历史数据）
  - 彻底删除: 物理删除记录（级联删除快照）

## 二、数据库设计

### 2.1 双表结构

#### 表 1: `x_accounts` - 账号管理状态表

```sql
CREATE TABLE IF NOT EXISTS x_accounts (
    twitter_id TEXT PRIMARY KEY,
    is_managed BOOLEAN NOT NULL DEFAULT 0,
    managed_at TIMESTAMP,
    unmanaged_at TIMESTAMP,
    instance_id TEXT,
    extension_name TEXT,
    personality_prompt TEXT,
    management_level INTEGER DEFAULT 0,
    permission_group TEXT,
    tags TEXT,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### 表 2: `x_account_trend` - 账号快照历史表

```sql
CREATE TABLE IF NOT EXISTS x_account_trend (
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
);
```

### 2.2 核心字段说明

#### `x_accounts` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `is_managed` | BOOLEAN | 是否归平台管理 (0=未管理, 1=已管理) |
| `managed_at` | TIMESTAMP | 加入管理的时间 |
| `unmanaged_at` | TIMESTAMP | 解除管理的时间 |
| `instance_id` | TEXT | 当前绑定的 LocalBridge 实例 ID |
| `extension_name` | TEXT | 当前绑定的扩展名称 |
| `personality_prompt` | TEXT | 性格提示词（用于 AI 交互） |

#### `x_account_trend` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `created_at` | TIMESTAMP | 快照创建时间（RFC3339 格式） |
| `updated_at` | TIMESTAMP | 快照更新时间（RFC3339 格式） |
| `last_online_time` | TIMESTAMP | 最后在线时间 |

**注意**: `is_online` 状态不存储在数据库，而是通过 `last_online_time` 或内存中的 `unmanaged_online_accounts` 实时判断

## 三、架构设计

### 3.1 数据流架构

```
┌─────────────────────────────────────────────────────────────┐
│           LocalBridgeSyncExecutor (定时器，每5分钟)           │
│                                                               │
│  1. 查询 LocalBridge 获取所有在线实例                         │
│  2. 串行获取每个实例的推特账号基本信息                        │
│  3. 解析为 TwitterBasicAccount                               │
│  4. 为每个账号 spawn 独立异步任务（tokio::spawn）            │
│  5. 等待所有任务完成（批量并发处理）                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼ (多个并发任务)
┌─────────────────────────────────────────────────────────────┐
│              process_user_info() 并发处理                     │
│                                                               │
│  每个账号在独立的 tokio 任务中执行:                           │
│  1. 查询数据库 get_account_management_detail()               │
│  2. 判断账号状态:                                             │
│     - 已管理 (is_managed=1):                                 │
│       • 更新实例绑定 (instance_id, extension_name)           │
│       • 检查最后快照时间                                      │
│       • 超过1小时: insert_account_snapshot()                 │
│       • 1小时内: update_account_snapshot()                   │
│       • 从内存中移除 (如果存在)                               │
│     - 未管理 (is_managed=0 或不存在):                        │
│       • 添加到内存 unmanaged_online_accounts                 │
│       • 不写数据库                                            │
│                                                               │
│  注意: 所有任务真正并发执行，通过 Arc<Mutex> 安全访问共享状态 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    数据存储层                                 │
│                                                               │
│  数据库 (已管理账号):                                         │
│  - x_accounts: 管理状态                                       │
│  - x_account_trend: 快照历史                                 │
│                                                               │
│  内存 (未管理账号):                                           │
│  - unmanaged_online_accounts: HashMap<twitter_id, Record>   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 核心组件

#### LocalBridgeSyncExecutor

**文件**: [src-tauri/src/unified_timer/executors/localbridge_sync_executor.rs](../src-tauri/src/unified_timer/executors/localbridge_sync_executor.rs)

**职责**: 定时同步 LocalBridge 账号状态

```rust
pub struct LocalBridgeSyncExecutor {
    last_user_info_query: Mutex<HashMap<String, DateTime<Utc>>>,
    account_binding_cache: Arc<Mutex<HashMap<String, AccountBindingSnapshot>>>,
    unmanaged_online_accounts: Arc<Mutex<HashMap<String, UnmanagedAccountRecord>>>,
    db: Arc<Mutex<crate::task_database::TaskDatabase>>,
}
```

**核心逻辑**:

1. **查询频率控制**: 每个实例首次发现立即查询，之后每 5 分钟查询一次
2. **批量并发处理**: 
   - 串行获取所有实例的用户信息（`get_basic_info_with_instance()`）
   - 为每个账号使用 `tokio::spawn` 创建独立异步任务
   - 收集所有任务句柄（`Vec<JoinHandle>`）
   - 等待所有任务完成（`handle.await`）
   - 所有账号的数据库写入、缓存更新真正并发执行
3. **实例绑定缓存**: 缓存已管理账号的实例绑定，避免重复更新数据库
4. **内存清理**: 每轮同步后清理不在线的未管理账号

#### process_user_info() 函数

**职责**: 处理单个账号的同步逻辑

```rust
async fn process_user_info(
    instance_name: String,
    instance_id: String,
    basic_info: XUser,
    db: Arc<Mutex<TaskDatabase>>,
    binding_cache: Arc<Mutex<HashMap<String, AccountBindingSnapshot>>>,
    unmanaged_accounts: Arc<Mutex<HashMap<String, UnmanagedAccountRecord>>>,
)
```

**处理流程**:

1. 解析 `XUser` 为 `TwitterBasicAccount`
2. 查询数据库 `get_account_management_detail()`
3. 根据账号状态分支处理:
   - **已管理账号** (`is_managed = 1`):
     - 更新实例绑定（如果变化）
     - 查询最后快照时间
     - 超过 1 小时：插入新快照
     - 1 小时内：更新现有快照
     - 从内存中移除
   - **未管理账号** (`is_managed = 0` 或不存在):
     - 添加到内存 `unmanaged_online_accounts`
     - 不写数据库

## 四、UI 设计

### 4.1 三栏布局

```
┌──────────────┬──────────────────┬──────────────────┐
│  左侧边栏    │   中间详情面板   │   右侧面板       │
│              │                  │                  │
│ 已管理账号   │   账号详情       │  （其他功能）    │
│ 未管理账号   │   - 基础信息     │                  │
│              │   - 最新快照     │                  │
│              │   - 性格提示词   │                  │
│              │   - 管理动作     │                  │
└──────────────┴──────────────────┴──────────────────┘
```

### 4.2 左侧边栏 - 账号列表

**文件**: [src/components/AccountManagement.tsx](../src/components/AccountManagement.tsx)

**显示内容**:
- 头像
- 显示名称 (display_name)
- 用户名 (@screen_name)
- 来源标签:
  - "当前已管理账号" (is_managed=1)
  - "历史管理账号" (is_managed=0, 数据库中存在)
  - "未管理在线账号" (内存中，未加入管理)

**数据来源**:
- 已管理账号: `get_managed_accounts()` - 从数据库查询
- 未管理账号: `get_unmanaged_online_accounts()` - 从内存查询

### 4.3 中间详情面板 - 账号详情

**文件**: [src/components/AccountDetailPane.tsx](../src/components/AccountDetailPane.tsx)

**显示内容**:

1. **账号基础信息**:
   - Twitter ID
   - 管理状态
   - 实例 ID / 扩展名称
   - 管理时间 / 解除管理时间
   - 更新时间

2. **性格提示词** (仅历史管理账号):
   - 可编辑文本框
   - 保存 / 取消 / 删除按钮

3. **最新账号信息**:
   - 粉丝数、关注数、推文数等统计数据
   - 个人简介
   - 账号创建时间
   - 最近在线时间

4. **管理动作**:
   - 未管理账号: "加入管理" 按钮
   - 已管理账号: "解除管理" + "彻底删除" 按钮

### 4.4 交互流程

#### 加入管理

1. 用户点击 "加入管理"
2. 调用 `add_account_to_management(twitter_id)`
3. 后端逻辑:
   - 从内存或数据库获取账号信息
   - 插入/更新 `x_accounts` 表，设置 `is_managed = 1`
   - 插入初始快照到 `x_account_trend`
   - 从内存中移除
4. 刷新账号列表

#### 解除管理

1. 用户点击 "解除管理"
2. 调用 `remove_account_from_management(twitter_id)`
3. 后端逻辑:
   - 更新 `x_accounts` 表，设置 `is_managed = 0`
   - 保留历史数据（不删除快照）
4. 清除选中状态，刷新账号列表

#### 彻底删除

1. 用户点击 "彻底删除"
2. 调用 `delete_account_completely(twitter_id)`
3. 后端逻辑:
   - 物理删除 `x_accounts` 记录
   - 级联删除 `x_account_trend` 快照
   - 从内存中移除
4. 清除选中状态，刷新账号列表

## 五、接口设计

### 5.1 数据库操作接口

**文件**: [src-tauri/src/task_database.rs](../src-tauri/src/task_database.rs)

```rust
// 账号管理
pub fn add_account_to_management(&self, account: &TwitterBasicAccount) -> Result<()>
pub fn remove_account_from_management(&self, twitter_id: &str) -> Result<()>
pub fn delete_account_completely(&self, twitter_id: &str) -> Result<()>

// 实例绑定
pub fn update_account_instance_binding(
    &self, 
    twitter_id: &str, 
    instance_id: Option<&str>, 
    extension_name: Option<&str>
) -> Result<bool>

// 性格提示词
pub fn update_account_personality_prompt(
    &self, 
    twitter_id: &str, 
    personality_prompt: Option<&str>
) -> Result<()>

// 快照管理
pub fn insert_account_snapshot(&self, account: &TwitterBasicAccount) -> Result<()>
pub fn update_account_snapshot(&self, account: &TwitterBasicAccount) -> Result<()>
pub fn get_account_last_snapshot_time(&self, twitter_id: &str) -> Result<Option<String>>

// 查询
pub fn get_account_management_detail(&self, twitter_id: &str) -> Result<Option<XAccountRow>>
pub fn get_managed_accounts(&self) -> Result<Vec<XAccountRow>>
pub fn get_managed_accounts_with_latest_snapshot(&self) -> Result<Vec<ManagedAccountWithSnapshot>>
pub fn get_latest_account_snapshot(&self, twitter_id: &str) -> Result<Option<AccountTrendSnapshot>>
pub fn get_account_snapshots(&self, twitter_id: &str, limit: Option<i64>) -> Result<Vec<AccountTrendSnapshot>>

// 任务选择
pub fn get_managed_accounts_for_task_selection(&self) -> Result<Vec<ManagedAccountForTask>>
```

### 5.2 前端调用接口

**文件**: [src-tauri/src/commands/account.rs](../src-tauri/src/commands/account.rs)

```rust
// 获取账号列表
#[tauri::command]
pub async fn get_managed_accounts(state: State<'_, TaskState>) 
    -> Result<Vec<AccountListItemDto>, String>

#[tauri::command]
pub async fn get_unmanaged_online_accounts(state: State<'_, TaskState>) 
    -> Result<Vec<AccountListItemDto>, String>

// 账号管理操作
#[tauri::command]
pub async fn add_account_to_management(twitter_id: String, state: State<'_, TaskState>) 
    -> Result<(), String>

#[tauri::command]
pub async fn remove_account_from_management(twitter_id: String, state: State<'_, TaskState>) 
    -> Result<(), String>

#[tauri::command]
pub async fn delete_account_completely(twitter_id: String, state: State<'_, TaskState>) 
    -> Result<(), String>

// 性格提示词
#[tauri::command]
pub async fn update_account_personality_prompt(
    twitter_id: String, 
    personality_prompt: Option<String>, 
    state: State<'_, TaskState>
) -> Result<(), String>

// 账号详情
#[tauri::command]
pub async fn get_account_detail(twitter_id: String, state: State<'_, TaskState>) 
    -> Result<AccountDetailDto, String>

// 快照历史
#[tauri::command]
pub async fn get_account_trend(
    twitter_id: String, 
    days: Option<i64>, 
    state: State<'_, TaskState>
) -> Result<Vec<AccountTrendSnapshot>, String>

// 任务选择
#[tauri::command]
pub async fn get_managed_accounts_for_task_selection(state: State<'_, TaskState>) 
    -> Result<Vec<ManagedAccountForTask>, String>

// LocalBridge 实例
#[tauri::command]
pub async fn get_instances() -> Result<Vec<serde_json::Value>, String>
```

## 六、数据结构定义

### 6.1 后端数据结构

**文件**: [src-tauri/src/models/twitter_account.rs](../src-tauri/src/models/twitter_account.rs)

```rust
// 推特账号基本信息
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TwitterBasicAccount {
    pub twitter_id: String,
    pub screen_name: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub description: Option<String>,
    pub is_verified: bool,
    pub followers_count: Option<i64>,
    pub following_count: Option<i64>,
    pub tweet_count: Option<i64>,
    pub favourites_count: Option<i64>,
    pub listed_count: Option<i64>,
    pub media_count: Option<i64>,
    pub created_at: Option<String>,
    pub instance_id: String,
    pub extension_name: String,
    pub last_seen: DateTime<Utc>,
}
```

**文件**: [src-tauri/src/unified_timer/executors/localbridge_sync_executor.rs](../src-tauri/src/unified_timer/executors/localbridge_sync_executor.rs)

```rust
// 未管理账号记录（内存存储）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnmanagedAccountRecord {
    pub twitter_id: String,
    pub screen_name: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub description: Option<String>,
    pub is_verified: bool,
    pub followers_count: Option<i64>,
    pub following_count: Option<i64>,
    pub tweet_count: Option<i64>,
    pub favourites_count: Option<i64>,
    pub listed_count: Option<i64>,
    pub media_count: Option<i64>,
    pub created_at: Option<String>,
    pub instance_id: String,
    pub extension_name: String,
    pub last_seen: String,  // RFC3339 格式
}

// 实例绑定快照（缓存）
#[derive(Debug, Clone, PartialEq, Eq)]
struct AccountBindingSnapshot {
    instance_id: String,
    extension_name: String,
}
```

**文件**: [src-tauri/src/commands/account.rs](../src-tauri/src/commands/account.rs)

```rust
// 账号列表项 DTO
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountListItemDto {
    pub twitter_id: String,
    pub screen_name: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub instance_id: Option<String>,
    pub extension_name: Option<String>,
    pub is_managed: bool,
    pub is_online: bool,
    pub personality_prompt: Option<String>,
    pub latest_snapshot_at: Option<String>,
    pub source: String,  // "managed-db" | "unmanaged-memory"
}

// 账号详情 DTO
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountDetailDto {
    pub account: AccountDetailAccountDto,
    pub latest_trend: Option<AccountLatestTrendDto>,
}
```

### 6.2 前端数据结构

**文件**: [src/services/account.ts](../src/services/account.ts)

```typescript
export interface AccountListItem {
  twitterId: string
  screenName: string
  displayName: string
  avatarUrl?: string
  instanceId?: string
  extensionName?: string
  isManaged: boolean
  isOnline: boolean
  personalityPrompt?: string
  latestSnapshotAt?: string
  source: 'managed-db' | 'unmanaged-memory'
}

export interface AccountDetail {
  account: {
    twitterId: string
    isManaged: boolean
    managedAt?: string
    unmanagedAt?: string
    instanceId?: string
    extensionName?: string
    personalityPrompt?: string
    createdAt?: string
    updatedAt?: string
    source: string
  }
  latestTrend?: {
    screenName: string
    displayName: string
    avatarUrl?: string
    description?: string
    followersCount?: number
    followingCount?: number
    tweetCount?: number
    // ... 其他统计字段
  }
}
```

## 七、实现状态

### ✅ 已完成功能

#### 数据库层
- [x] 双表结构设计（`x_accounts` + `x_account_trend`）
- [x] 账号管理接口（添加、解除、删除）
- [x] 快照管理逻辑（1小时规则：超过1小时插入新快照，1小时内更新现有快照）
- [x] 实例绑定更新
- [x] 性格提示词管理
- [x] 账号详情查询
- [x] 快照历史查询
- [x] 任务选择账号列表

#### 同步层
- [x] `LocalBridgeSyncExecutor` 定时器（每5分钟）
- [x] 查询频率控制（首次立即查询，之后每5分钟）
- [x] 批量并发处理（tokio::spawn + 同步等待所有任务完成）
- [x] 实例绑定缓存（避免重复数据库写入）
- [x] 未管理账号内存存储
- [x] 在线账号清理（每轮同步后清理离线账号）

#### 前端层
- [x] 账号列表展示（已管理 + 未管理）
- [x] 账号详情面板
- [x] 性格提示词编辑（增删改）
- [x] 管理操作（加入管理、解除管理、彻底删除）
- [x] 实时状态更新

### 核心特性

1. **双存储策略**: 已管理账号持久化到数据库，未管理账号仅存在内存
2. **快照管理**: 1小时规则确保数据更新频率合理
3. **实例绑定**: 自动跟踪账号与 LocalBridge 实例的绑定关系
4. **性格提示词**: 支持为每个账号设置 AI 交互的性格提示词
5. **软删除**: 解除管理保留历史数据，彻底删除才物理删除

### 📝 关键实现细节

#### 快照管理逻辑

**文件**: [src-tauri/src/unified_timer/executors/localbridge_sync_executor.rs:180-199](../src-tauri/src/unified_timer/executors/localbridge_sync_executor.rs#L180-L199)

```rust
match db_guard.get_account_last_snapshot_time(&account.twitter_id) {
    Ok(last_snapshot_time) => {
        if should_insert_snapshot(last_snapshot_time) {
            // 超过 1 小时：插入新快照
            db_guard.insert_account_snapshot(&account)?;
        } else {
            // 1 小时内：更新现有快照
            db_guard.update_account_snapshot(&account)?;
        }
    }
    Err(e) => {
        log::error!("Failed to query latest snapshot time: {}", e);
    }
}
```

**判断逻辑**:
```rust
fn should_insert_snapshot(last_snapshot_time: Option<String>) -> bool {
    match last_snapshot_time {
        Some(last_snapshot_time) => {
            match chrono::DateTime::parse_from_rfc3339(&last_snapshot_time) {
                Ok(last_snapshot_time) => {
                    let now = Utc::now();
                    let elapsed = now.signed_duration_since(last_snapshot_time.with_timezone(&Utc));
                    elapsed.num_hours() >= 1
                }
                Err(_) => true,
            }
        }
        None => true,
    }
}
```

#### 实例绑定缓存

**目的**: 避免每次同步都更新数据库中的 `instance_id` 和 `extension_name`

**实现**: 
- 启动时从数据库加载已管理账号的实例绑定到内存缓存
- 每次同步时比较当前绑定与缓存，只在变化时更新数据库
- 更新成功后更新缓存

#### 未管理账号清理

**文件**: [src-tauri/src/unified_timer/executors/localbridge_sync_executor.rs:286-291](../src-tauri/src/unified_timer/executors/localbridge_sync_executor.rs#L286-L291)

```rust
fn prune_unmanaged_online_accounts(&self, active_instance_ids: &HashSet<String>) {
    self.unmanaged_online_accounts
        .lock()
        .unwrap()
        .retain(|_, account| active_instance_ids.contains(&account.instance_id));
}
```

每轮同步后，清理不在当前在线实例列表中的未管理账号，确保内存中只保留真正在线的账号。

## 八、关键设计决策

### 8.1 为什么使用双存储策略？

**已管理账号持久化到数据库**:
- 保留历史数据，方便追溯和审计
- 支持快照管理，记录账号信息变化趋势
- 支持性格提示词等扩展字段
- 解除管理后仍保留数据，可随时重新管理

**未管理账号仅存在内存**:
- 减少数据库写入，提高性能
- 避免存储大量临时数据
- 自动清理离线账号，无需手动维护
- 用户明确加入管理后才持久化

### 8.2 为什么使用双表结构？

**`x_accounts` 表**:
- 存储管理状态和元数据
- 一个账号一条记录，便于查询管理状态
- 支持扩展字段（性格提示词、权限组等）

**`x_account_trend` 表**:
- 存储账号信息快照历史
- 支持趋势分析（粉丝增长、推文数变化等）
- 通过外键级联删除，确保数据一致性

### 8.3 为什么使用 1 小时快照规则？

- **平衡数据新鲜度和存储成本**: 5 分钟同步频率下，1 小时内只更新不插入，避免产生大量重复快照
- **保留关键变化**: 超过 1 小时的变化插入新快照，记录账号信息的长期趋势
- **支持趋势分析**: 每小时一个快照点，足够支持日/周/月级别的趋势分析

### 8.4 为什么使用实例绑定缓存？

- **减少数据库写入**: 实例绑定通常不变，缓存后只在变化时更新数据库
- **提高同步性能**: 每 5 分钟同步时避免重复更新相同的绑定信息
- **启动时初始化**: 从数据库加载已管理账号的绑定到缓存，确保首次同步的准确性

### 8.5 为什么不使用 Channel + 后台协程？

**v2.0 设计方案**使用 Channel + 后台协程架构，但**实际实现**选择了更简单的直接同步方案：

**原因**:
- 当前账号数量较少（通常 < 10 个），直接同步性能足够
- 并发处理（`tokio::spawn`）已满足性能需求
- 减少架构复杂度，便于维护和调试
- 未来如果账号数量增长，可以重构为 Channel 架构

**权衡**:
- ✅ 简单直接，易于理解和维护
- ✅ 性能满足当前需求
- ❌ 定时器执行时间受账号数量影响
- ❌ 缺少批量优化和背压控制

## 九、性能优化

### 9.1 并发处理

**文件**: [src-tauri/src/unified_timer/executors/localbridge_sync_executor.rs:392-399](../src-tauri/src/unified_timer/executors/localbridge_sync_executor.rs#L392-L399)

```rust
let mut handles = Vec::new();
for instance in &instances {
    // ... 获取账号信息
    handles.push(tokio::spawn(process_user_info(
        instance_name_clone,
        instance_id_clone,
        basic_info,
        db_clone,
        binding_cache_clone,
        unmanaged_accounts_clone,
    )));
}

for handle in handles {
    handle.await?;
}
```

每个账号的处理逻辑在独立的 tokio 任务中并发执行，提高同步效率。

### 9.2 查询频率控制

**首次发现立即查询**:
- 新实例首次出现时立即查询用户信息
- 确保新账号能快速显示在界面上

**后续每 5 分钟查询一次**:
- 避免频繁查询 LocalBridge API
- 平衡数据新鲜度和 API 调用成本

### 9.3 实例绑定缓存

- 启动时从数据库加载已管理账号的实例绑定
- 每次同步时比较当前绑定与缓存
- 只在绑定变化时更新数据库
- 减少不必要的数据库写入

### 9.4 快照更新策略

- 1 小时内：更新现有快照（`UPDATE`）
- 超过 1 小时：插入新快照（`INSERT`）
- 避免产生大量重复快照
- 保留关键时间点的数据变化

### 9.5 索引优化

```sql
-- 管理状态查询
CREATE INDEX IF NOT EXISTS idx_x_accounts_is_managed
ON x_accounts(is_managed);

-- 管理时间排序
CREATE INDEX IF NOT EXISTS idx_x_accounts_managed_at
ON x_accounts(managed_at DESC);

-- 实例绑定查询
CREATE INDEX IF NOT EXISTS idx_x_accounts_instance_id
ON x_accounts(instance_id);

-- 快照查询
CREATE INDEX IF NOT EXISTS idx_x_account_trend_twitter_id
ON x_account_trend(twitter_id);

-- 快照时间排序
CREATE INDEX IF NOT EXISTS idx_x_account_trend_created_at
ON x_account_trend(twitter_id, created_at DESC);

-- 在线时间排序
CREATE INDEX IF NOT EXISTS idx_x_account_trend_last_online
ON x_account_trend(last_online_time DESC);
```

## 十、未来优化方向

### 10.1 Channel + 后台协程架构

如果账号数量增长到 100+ 个，可以考虑重构为 v2.0 设计的 Channel + 后台协程架构：

**优势**:
- 定时任务只负责读取，不阻塞
- 后台协程批量处理，提高性能
- 支持背压控制，避免数据库过载

**实现要点**:
- 定义 `AccountSyncMessage` 结构
- 创建 `mpsc::channel` 传递账号数据
- 实现 `account_sync_worker()` 后台协程
- 批量处理（10 条/批，5 秒超时）

### 10.2 增量同步

当前每次同步都查询所有实例的用户信息，可以优化为：

- 只查询实例列表变化的账号
- 缓存实例列表，比较差异
- 减少 LocalBridge API 调用次数

### 10.3 快照压缩

当快照数量过多时，可以考虑：

- 保留最近 7 天的所有快照
- 7 天前的快照按天聚合（保留每天最后一个）
- 30 天前的快照按周聚合
- 减少存储空间，保留趋势分析能力

### 10.4 实时推送

当前使用定时轮询（5 分钟），可以考虑：

- LocalBridge 支持 WebSocket 推送
- 账号状态变化时实时通知
- 减少轮询延迟，提高响应速度

### 10.5 数据积木关联

当彻底删除账号时，需要级联删除关联的数据积木：

```rust
pub fn delete_account_completely(&self, twitter_id: &str) -> Result<()> {
    // 1. 删除账号记录（级联删除快照）
    self.conn.execute(
        "DELETE FROM x_accounts WHERE twitter_id = ?1",
        params![twitter_id],
    )?;
    
    // 2. TODO: 删除关联的数据积木
    // self.delete_account_data_blocks(twitter_id)?;
    
    Ok(())
}
```
