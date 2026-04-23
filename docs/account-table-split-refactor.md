# 推特账号表拆分重构方案

## 版本信息
- **版本**: v1.0
- **创建时间**: 2026-04-23
- **目标**: 将账号能力重构为 `x_accounts` 管理表 + `x_account_trend` 快照表

---

## 一、问题分析

### 1.1 当前问题

**表结构**: `managed_twitter_accounts` 混合了两种职责：

1. **管理状态**: `is_managed` 字段表示账号是否归平台管理
2. **数据快照**: 推特账号的统计信息（粉丝数、推文数等）

**问题场景**:

当前逻辑中，只有 `is_managed=true` 的账号才会更新数据，导致：
- 未管理在线账号的数据无法持续展示与进入统一管理流程
- 无法追踪当前未进入当前管理集合账号的在线发现态
- 未来的数据积木功能无法对“当前已管理账号”稳定使用完整历史数据

### 1.3 边界定义（本方案的核心约束）

为避免“未管理 / 已管理 / 内存 / 数据库”语义混乱，本方案明确区分 3 类账号：

1. **当前已管理账号（Active Managed）**
   - 定义：存在于 `x_accounts`，且 `is_managed = 1`
   - 数据来源：数据库
   - 详情来源：`x_accounts` + `x_account_trend`
   - 是否出现在左侧“当前已管理账号”分组：**是**
   - 是否写入 `x_account_trend`：**是**

2. **历史管理账号（Archived Managed）**
   - 定义：存在于 `x_accounts`，但 `is_managed = 0`
   - 数据来源：数据库
   - 用途：保留管理关系历史、`managed_at / unmanaged_at`、personality_prompt 等信息
   - 是否出现在左侧“未管理在线账号”分组：**否**
   - 是否写入 `x_account_trend`：**否**
   - 说明：它不是“当前在线未管理在线账号”，不要和内存态账号混用

3. **未被管理在线账号（Unmanaged Online）**
   - 定义：当前在线、可解析为 `TwitterBasicAccount`，但**不属于当前管理集合**的账号
   - 数据来源：5 分钟同步维护的内存表
   - 详情来源：内存中的 `TwitterBasicAccount`
   - 是否出现在左侧“未管理在线账号”分组：**是**
   - 是否写入 `x_account_trend`：**否**
   - 说明：它的展示资格来自“在线 + 可解析”，不是来自数据库

**显示规则**:
- 左侧主列表只展示两组：
  - `当前已管理账号`（数据库中的 active managed）
  - `未管理在线账号`（内存中的 unmanaged online）
- `历史管理账号` 默认不进入左侧主列表；它属于历史记录，不等于当前未管理在线账号

### 1.4 V1 产品策略（历史管理账号）

为避免首版界面和接口复杂度失控，V1 对“历史管理账号（`x_accounts.is_managed = 0`）”采用以下固定策略：

1. **默认不提供左侧入口**
   - 左侧只展示：
     - 当前已管理账号
     - 当前未管理在线账号

2. **默认不提供独立浏览页**
   - V1 不新增“历史账号”第三分组
   - V1 不在概览页中展示历史管理账号列表

3. **只保留数据层能力，不承诺 UI 可达性**
   - 历史管理账号在数据库中保留
   - 允许后端保留查询能力
   - 但前端 V1 不以主流程展示它们

4. **重新加入管理时复用旧记录**
   - 若某账号历史上进入过 `x_accounts`，再次加入管理时直接复用原记录
   - 不新建重复账号行

5. **趋势数据处理策略**
   - 历史管理账号在 `is_managed = 0` 期间停止新增趋势快照
   - 已有趋势数据保留，不删除

### 1.5 术语统一（全文按以下词表理解）

为避免实现阶段再次出现命名漂移，全文统一使用以下术语：

- **当前已管理账号**
  - 指 `x_accounts.is_managed = 1` 的账号
  - 英文语义：`Active Managed`

- **历史管理账号**
  - 指存在于 `x_accounts`，但 `is_managed = 0` 的账号
  - 英文语义：`Archived Managed`

- **未管理在线账号**
  - 指不在 `x_accounts`、但存在于 5 分钟同步内存表中的当前在线账号
  - 英文语义：`Unmanaged Online`

- **管理表**
  - 全文统一指 `x_accounts`

- **趋势表**
  - 全文统一指 `x_account_trend`

- **内存表**
  - 全文统一指 5 分钟同步维护的 `UnmanagedAccountsMemory`

- **当前管理集合**
  - 全文统一指 `x_accounts` 中 `is_managed = 1` 的账号集合

**禁止混用**:
- 不再把“历史管理账号”简称为“未管理账号”
- 不再把“未管理在线账号”简称为“未管理账号”
- 不再把 `x_accounts` 中 `is_managed = 0` 的账号视为内存态账号


### 2.1 管理状态表: `x_accounts`

存储**已进入系统管理生命周期**的账号管理关系和状态。

```sql
CREATE TABLE IF NOT EXISTS x_accounts (
    twitter_id TEXT PRIMARY KEY,
    is_managed BOOLEAN DEFAULT 0,
    managed_at TIMESTAMP,
    unmanaged_at TIMESTAMP,
    -- Instance 信息
    instance_id TEXT,
    extension_name TEXT,
    -- 任务性格提示词
    personality_prompt TEXT,             -- 任务性格提示词 (用于不同账号的任务执行风格)
    -- 未来扩展字段
    management_level INTEGER DEFAULT 0,  -- 管理级别 (0=普通, 1=高级, 2=VIP)
    permission_group TEXT,               -- 权限组
    tags TEXT,                           -- 标签 (JSON 数组)
    notes TEXT,                          -- 备注
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_x_accounts_is_managed
ON x_accounts(is_managed);

CREATE INDEX IF NOT EXISTS idx_x_accounts_managed_at
ON x_accounts(managed_at DESC);

CREATE INDEX IF NOT EXISTS idx_x_accounts_instance_id
ON x_accounts(instance_id);
```

**字段说明**:
- `twitter_id`: 推特账号 ID (主键)
- `is_managed`: 是否归平台管理
- `managed_at`: 添加到管理的时间
- `unmanaged_at`: 解除管理的时间
- `instance_id`: LocalBridge 实例 ID
- `extension_name`: 浏览器扩展名称
- `personality_prompt`: 任务性格提示词 (用于不同账号的任务执行风格)
- `management_level`: 管理级别 (未来扩展)
- `permission_group`: 权限组 (未来扩展)
- `tags`: 标签 (未来扩展)
- `notes`: 备注 (未来扩展)

**设计要点**:
- `x_accounts` 只承载进入系统管理生命周期的账号；纯内存态的未管理在线账号不落入该表
- `instance_id` 和 `extension_name` 从 `x_account_trend` 移到 `x_accounts`，因为这些是账号的管理属性，不是数据快照
- `personality_prompt` 用于为不同账号设置不同的任务执行风格（如回答问题的语气、推文发送的风格等）
- `is_managed = 1` 表示当前处于管理中；`is_managed = 0` 表示历史上进入过系统，但当前不在管理中

### 2.2 数据快照表: `x_account_trend`

存储**当前已管理账号**的统计信息历史快照。

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
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (twitter_id) REFERENCES x_accounts(twitter_id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_x_account_trend_twitter_id
ON x_account_trend(twitter_id);

CREATE INDEX IF NOT EXISTS idx_x_account_trend_created_at
ON x_account_trend(twitter_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_x_account_trend_last_online
ON x_account_trend(last_online_time DESC);
```

**字段说明**:
- `id`: 自增主键 (每次更新都是新记录，保留历史)
- `twitter_id`: 推特账号 ID (外键)
- 其他字段: 推特账号的统计信息
- `created_at`: 记录创建时间 (用于追踪历史变化)
- **注意**: `instance_id` 和 `extension_name` 已移到 `x_accounts` 表

**设计要点**:
- 每次更新都插入新记录，保留历史数据
- 可以查询任意时间点的账号状态
- 支持数据趋势分析
- 不存储 `instance_id` 和 `extension_name`，这些属于管理属性，不是数据快照
- 只为“当前已管理账号”写入快照；未被管理在线账号和历史管理账号都不写入该表

---

## 三、建表方案

本次按**全新结构直接落地**处理，不考虑旧数据迁移，不保留历史兼容迁移逻辑。

创建新的建表文件: `003_create_x_accounts_and_trend.sql`

```sql
CREATE TABLE IF NOT EXISTS x_accounts (
    twitter_id TEXT PRIMARY KEY,
    is_managed BOOLEAN DEFAULT 0,
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
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (twitter_id) REFERENCES x_accounts(twitter_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_x_accounts_is_managed
ON x_accounts(is_managed);

CREATE INDEX IF NOT EXISTS idx_x_accounts_managed_at
ON x_accounts(managed_at DESC);

CREATE INDEX IF NOT EXISTS idx_x_accounts_instance_id
ON x_accounts(instance_id);

CREATE INDEX IF NOT EXISTS idx_x_account_trend_twitter_id
ON x_account_trend(twitter_id);

CREATE INDEX IF NOT EXISTS idx_x_account_trend_created_at
ON x_account_trend(twitter_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_x_account_trend_last_online
ON x_account_trend(last_online_time DESC);
```

**落地约束**:
1. 不编写旧表到新表的数据迁移 SQL
2. 不保留双写逻辑
3. 新代码直接读写 `x_accounts` 与 `x_account_trend`
4. 旧表 `managed_twitter_accounts` 只作为待删除旧结构，不纳入新方案

---

## 四、代码影响分析

### 4.1 受影响的文件

通过搜索 `managed_twitter_accounts` 关键字，找到以下文件：

#### 数据库层
1. **src-tauri/migrations/002_create_accounts_table.sql**
   - 旧表定义，后续可删除或废弃

2. **src-tauri/src/task_database.rs**
   - `get_account_last_update()` - 查询账号最后更新时间
   - `insert_account()` - 插入新账号
   - `update_account()` - 更新账号信息
   - 需要重构为新的接口

#### 业务逻辑层
3. **src-tauri/src/unified_timer/executors/localbridge_sync_executor.rs**
   - `process_user_info()` - 处理推特账号数据
   - 需要修改为：总是插入新快照，不检查 `is_managed`

#### 前端接口层
4. **src-tauri/src/commands/account.rs**
   - 当前只有 8 行代码，只实现了 `get_instances()`
   - 需要实现完整的账号管理 API

#### 前端页面层
5. **src/hooks/useAppLayoutState.ts**
   - 当前账号侧边栏数据已被移除，`accountItems` 始终为空
   - 需要重建账号列表加载、刷新、选中和状态映射逻辑

6. **src/components/CenterContentRouter.tsx**
   - 当前 accounts 视图统一路由到 `AccountDetailPane`
   - 需要明确“概览态”和“账号详情态”的切换策略

7. **src/components/AccountManagement.tsx**
   - 当前仅为占位组件
   - 可作为账号概览页，承载分组统计、批量操作入口

8. **src/components/AccountDetailPane.tsx**
   - 当前仅展示空状态与占位文案
   - 需要重构为双区块详情页：账号管理信息 + 最新趋势快照

9. **src/components/LeftSidebar.tsx**
   - 当前支持基础列表渲染与 badge
   - 可直接复用，无需重写列表容器，只需补充账号列表数据结构

10. **src/components/AccountsOverview.tsx**
    - 当前为占位页面
    - 可与 `AccountManagement.tsx` 二选一保留，避免重复职责

### 4.2 需要新增的接口

#### 数据库操作接口 (task_database.rs)

```rust
// ========== x_accounts 表操作 ==========

/// 账号是否存在于 x_accounts（不代表当前处于管理中）
pub fn account_exists(&self, twitter_id: &str) -> Result<bool>

/// 账号是否属于当前已管理状态（x_accounts 中且 is_managed = 1）
pub fn is_account_managed(&self, twitter_id: &str) -> Result<bool>

/// 添加账号进入管理生命周期；若不存在则创建，若已存在则切回 is_managed = 1
pub fn add_account_to_management(&self, account: &TwitterBasicAccount) -> Result<()>

/// 将账号从当前管理集合移出，保留 x_accounts 历史记录，但标记 is_managed = 0
pub fn remove_account_from_management(&self, twitter_id: &str) -> Result<()>

/// 更新当前已管理账号的实例绑定与扩展信息
pub fn update_account_instance_binding(
    &self,
    twitter_id: &str,
    instance_id: Option<&str>,
    extension_name: Option<&str>
) -> Result<bool>

/// 更新当前已管理账号的任务性格提示词
pub fn update_account_personality_prompt(&self, twitter_id: &str, personality_prompt: Option<&str>) -> Result<()>

/// 获取单个账号的管理信息（无论 is_managed 为 0 还是 1，只要存在于 x_accounts 即可）
pub fn get_account_management_detail(&self, twitter_id: &str) -> Result<Option<XAccountRow>>

/// 获取当前已管理账号列表（只返回 is_managed = 1）
pub fn get_managed_accounts(&self) -> Result<Vec<XAccountListItem>>

/// 彻底删除账号（删除 x_accounts 记录以及级联删除所有趋势快照）
pub fn delete_account_completely(&self, twitter_id: &str) -> Result<()>

// ========== x_account_trend 表操作 ==========

/// 为当前已管理账号插入新的账号快照
pub fn insert_account_snapshot(&self, account: &TwitterBasicAccount) -> Result<()>

/// 获取账号的最新快照（仅当账号已有趋势数据时返回）
pub fn get_latest_account_snapshot(&self, twitter_id: &str) -> Result<Option<TwitterBasicAccount>>

/// 获取账号的历史快照（仅适用于进入过趋势采集链路的当前已管理账号）
pub fn get_account_snapshots(&self, twitter_id: &str, limit: Option<i64>) -> Result<Vec<TwitterBasicAccount>>

/// 获取账号最后一次快照时间
pub fn get_account_last_snapshot_time(&self, twitter_id: &str) -> Result<Option<String>>

/// 获取当前已管理账号列表（管理信息 + 最新快照）
pub fn get_managed_accounts_with_latest_snapshot(&self) -> Result<Vec<AccountWithLatestSnapshot>>
```

#### 内存态未管理在线账号接口 (LocalBridgeSyncExecutor / state)

```rust
/// 获取当前在线且未被管理的账号列表（只来自内存，不落库）
pub fn get_unmanaged_online_accounts_from_memory(&self) -> Vec<TwitterBasicAccount>

/// 用本轮 5 分钟同步结果整体刷新未管理在线账号内存表
pub fn refresh_unmanaged_online_accounts_memory(&self, accounts: Vec<TwitterBasicAccount>)

/// 根据 twitter_id 从内存表读取未管理在线账号详情
pub fn get_unmanaged_online_account_detail_from_memory(&self, twitter_id: &str) -> Option<TwitterBasicAccount>
```

#### 前端调用接口 (commands/account.rs)

```rust
/// 获取当前已管理账号列表（数据库）
#[tauri::command]
pub async fn get_managed_accounts() -> Result<Vec<AccountListItemDto>, String>

/// 获取当前在线且未被管理的账号列表（内存）
#[tauri::command]
pub async fn get_unmanaged_online_accounts() -> Result<Vec<AccountListItemDto>, String>

/// 将未管理在线账号或历史管理账号切入当前管理集合
#[tauri::command]
pub async fn add_account_to_management(twitter_id: String) -> Result<(), String>

/// 将当前已管理账号移出当前管理集合，但保留数据库中的历史管理记录
#[tauri::command]
pub async fn remove_account_from_management(twitter_id: String) -> Result<(), String>

/// 更新当前已管理账号的任务性格提示词
#[tauri::command]
pub async fn update_account_personality_prompt(
    twitter_id: String,
    personality_prompt: Option<String>
) -> Result<(), String>

/// 彻底删除账号
#[tauri::command]
pub async fn delete_account_completely(twitter_id: String) -> Result<(), String>

/// 获取账号详情：
/// 1. 若 twitter_id 属于当前已管理或历史管理账号，则走数据库详情
/// 2. 若不在 x_accounts，但存在于未管理在线内存表，则走内存详情
#[tauri::command]
pub async fn get_account_detail(twitter_id: String) -> Result<AccountDetailDto, String>

/// 获取账号历史趋势：仅当前已管理或历史管理且已写入过趋势表的账号可用
#[tauri::command]
pub async fn get_account_trend(twitter_id: String, days: Option<i64>) -> Result<Vec<AccountSnapshotDto>, String>
```

### 4.3 需要修改的逻辑

#### LocalBridge 同步逻辑

**目标**:
- 每次 5 分钟定时任务都处理“当前已管理账号”的 `x_account_trend` 快照写入
- 同时校验当前已管理账号的 `x_accounts.instance_id` / `extension_name` 是否发生变化
- 维护一份“当前在线且未被管理”的内存表，供左侧未管理分组和主显示区使用
- 明确区分数据库中的历史管理账号，与内存中的未管理在线账号
- 避免每个账号都先查库再决定是否更新，降低批量同步时的数据库压力

**推荐方案：双内存结构**

1. **实例绑定缓存表**
   - 用于管理账号的 `instance_id / extension_name` 变更检测
2. **未管理在线账号内存表**
   - 保存当前在线、可解析成 `TwitterBasicAccount`，但尚未进入 `x_accounts` 管理表的账号对象
   - 这批对象来自每次 5 分钟同步的解析结果
   - 它们不在数据库管理表中，但信息足以展示在主显示区

```rust
use std::collections::HashMap;

pub struct AccountBindingCache {
    bindings: HashMap<String, AccountBindingSnapshot>,
}

pub struct AccountBindingSnapshot {
    pub instance_id: Option<String>,
    pub extension_name: Option<String>,
}

pub struct UnmanagedAccountsMemory {
    accounts: HashMap<String, TwitterBasicAccount>,
}
```

**启动加载流程**:
1. 应用启动时从 `x_accounts` 读取全部 `twitter_id / instance_id / extension_name`
2. 构建 `AccountBindingCache`
3. 初始化空的 `UnmanagedAccountsMemory`
4. 将两个内存结构挂到 LocalBridge 同步执行器可访问的共享状态中

**单次同步流程**:
1. 从 LocalBridge 拿到账号最新资料并解析为 `TwitterBasicAccount`
2. 判断该账号是否存在于 `x_accounts`
3. 若存在于 `x_accounts` 且 `is_managed = 1`（当前已管理）：
   - 比较并同步 `instance_id / extension_name`
   - 按快照策略写入 `x_account_trend`
   - 若该账号之前存在于未管理在线内存表，则移除
4. 若存在于 `x_accounts` 且 `is_managed = 0`（历史管理账号）：
   - 不写入 `x_account_trend`
   - 不放入未管理在线内存表
   - 只忽略本轮趋势采集
5. 若不存在于 `x_accounts`：
   - 视为未管理在线账号
   - 不写入 `x_accounts`
   - 不写入 `x_account_trend`
   - 将完整 `TwitterBasicAccount` 放入 `UnmanagedAccountsMemory`
6. 每轮同步结束后，用本轮在线结果整体刷新未管理在线内存表，剔除已离线或已转管理的账号

**同步伪代码**:
```rust
let account_row = db_guard.get_account_management_detail(&account.twitter_id)?;

match account_row {
    Some(row) if row.is_managed => {
        let latest_binding = AccountBindingSnapshot {
            instance_id: account.instance_id.clone(),
            extension_name: account.extension_name.clone(),
        };

        let should_update_binding = account_binding_cache
            .get(&account.twitter_id)
            .map(|cached| cached != &latest_binding)
            .unwrap_or(true);

        if should_update_binding {
            let updated = db_guard.update_account_instance_binding(
                &account.twitter_id,
                account.instance_id.as_deref(),
                account.extension_name.as_deref(),
            )?;

            if updated {
                account_binding_cache.insert(account.twitter_id.clone(), latest_binding);
            }
        }

        match db_guard.get_account_last_snapshot_time(&account.twitter_id) {
            Ok(Some(last_snapshot_time)) => {
                if elapsed_hours >= 1 {
                    db_guard.insert_account_snapshot(&account)?;
                }
            }
            Ok(None) => {
                db_guard.insert_account_snapshot(&account)?;
            }
        }

        unmanaged_accounts_memory.remove(&account.twitter_id);
    }
    Some(_row) => {
        unmanaged_accounts_memory.remove(&account.twitter_id);
    }
    None => {
        unmanaged_accounts_memory.insert(account.twitter_id.clone(), account.clone());
    }
}
```

**关键变化**:
- ✅ 只有当前已管理账号（`x_accounts.is_managed = 1`）持续写入趋势快照
- ✅ `instance_id` / `extension_name` 归属到 `x_accounts`
- ✅ 用内存缓存减少“先查库再更新”的重复 IO
- ✅ 用内存表维护“当前在线且未被管理”的账号对象
- ✅ 未管理在线账号虽然不进入数据库，但仍可在 UI 中完整展示详情
- ✅ 历史管理账号保留在数据库中，但不混入未管理在线分组
- ✅ 左侧只展示“当前已管理账号”与“当前未管理在线账号”两组

#### 前端界面重构逻辑

基于当前代码现状：
- `useAppLayoutState.ts` 中账号数据加载已被移除
- `LeftSidebar.tsx` 已支持 badge，可复用为账号状态列表
- `AccountDetailPane.tsx` / `AccountsOverview.tsx` / `AccountManagement.tsx` 均为占位态
- `CenterContentRouter.tsx` 当前只把 accounts 视图路由到单一详情面板

**重构目标**:
把账号视图拆成 3 个语义明确的集合：
1. **当前已管理账号**：来自 `x_accounts(is_managed = 1)` + `x_account_trend`
2. **历史管理账号**：存在于 `x_accounts`，但 `is_managed = 0`，默认不进左侧主列表
3. **未被管理在线账号**：来自 5 分钟同步维护的内存表

其中只有第 1 类和第 3 类进入当前主界面左侧列表；第 2 类属于数据库历史状态，不等于“未被管理在线账号”。

**建议界面结构**:

1. **左侧 Sidebar：分组折叠账号列表**
   - 第一组：`当前已管理账号`
     - 数据来源：`get_managed_accounts()`
     - 只包含 `x_accounts.is_managed = 1` 的账号
     - 每项展示：`display_name` / `screen_name`
     - 副文案：`instance_id` 或 `extension_name`
     - badge：`managed`、`online / offline`
   - 第二组：`未管理在线账号`
     - 数据来源：`get_unmanaged_online_accounts()`
     - 通过折叠按钮展开/收起
     - 只展示当前在线且存在于内存中的账号
     - 不包含 `x_accounts.is_managed = 0` 的历史管理账号
     - 每项展示：`display_name` / `screen_name`
     - 副文案：`instance_id` 或 `extension_name`
     - badge：`unmanaged`、`online`

2. **中间主区：账号详情页 (`AccountDetailPane`)**
   - 当前已管理账号与未管理在线账号共用同一详情组件
   - 历史管理账号默认不从左侧主列表进入；若后续需要单独查看，可走独立入口
   - 顶部 Header
     - 头像、显示名、screen_name
     - 管理状态
     - 在线状态
     - 最近同步时间
   - 第一块：账号基础信息卡
     - twitter_id
     - instance_id
     - extension_name
     - personality_prompt
     - 数据来源标记：`managed(db)` / `unmanaged(memory)`
   - 第二块：最新账号信息卡
     - followers_count
     - following_count
     - tweet_count
     - favourites_count
     - listed_count
     - media_count
     - description
     - last_online_time
     - account_created_at
   - 第三块：管理动作区
     - 若为当前已管理账号：展示 personality_prompt 编辑、解除管理、删除等动作
     - 若为未管理在线账号：展示“加入管理”按钮
   - 第四块（仅当前已管理账号显示，可选后续）
     - 历史趋势图
     - 最近几次快照变化摘要

3. **账号概览页 (`AccountManagement` 或 `AccountsOverview` 二选一)**
   - 当未选中具体账号时，显示统计概览
   - 建议内容：
     - 当前已管理账号数
     - 当前未管理在线账号数
     - 当前在线实例数
     - 最近一次同步时间
     - “待补充 personality_prompt 的账号”提醒
   - V1 不在概览页展示历史管理账号列表

**交互规则**:
- 点击左侧任意账号，不论其来自数据库还是内存，都进入主显示区详情页
- 未管理在线账号进入详情页后，可直接执行“加入管理”
- “加入管理”成功后：
  - 若该账号原本不在 `x_accounts`，则创建记录并设为 `is_managed = 1`
  - 若该账号已存在于 `x_accounts` 但处于历史管理状态，则切回 `is_managed = 1`
  - 从未管理在线分组移除
  - 进入已管理分组
  - 后续开始写入 `x_account_trend`
- “解除管理”后：
  - 账号保留在 `x_accounts`
  - 标记为 `is_managed = 0`
  - 停止继续写入 `x_account_trend`
  - 不自动进入“未管理在线账号”分组，除非它在后续同步中再次以“在线且不属于当前管理集合”的身份出现在内存表中

**组件职责建议**:
- 保留 `AccountDetailPane.tsx`：统一渲染当前已管理账号与未管理在线账号详情
- `AccountManagement.tsx` 与 `AccountsOverview.tsx` 只保留一个，避免两个概览页职责重复
- `CenterContentRouter.tsx` 在 accounts 视图下改为：
  - 有选中账号：渲染 `AccountDetailPane`
  - 无选中账号：渲染账号概览组件
- `LeftSidebar.tsx` 需要补充分组折叠能力，支持“当前已管理账号 / 未管理在线账号”两组展示
- 历史管理账号不纳入 V1 主界面导航结构

**前端类型建议**:
```ts
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
    source: 'managed-db' | 'unmanaged-memory'
  }
  latestTrend: {
    screenName: string
    displayName: string
    avatarUrl?: string
    description?: string
    followersCount?: number
    followingCount?: number
    tweetCount?: number
    favouritesCount?: number
    listedCount?: number
    mediaCount?: number
    accountCreatedAt?: string
    lastOnlineTime?: string
    createdAt?: string
  } | null
}
```

**边界约束（前端必须遵守）**:
- `source = 'managed-db'` 表示该账号来自数据库中的当前已管理集合
- `source = 'unmanaged-memory'` 表示该账号来自当前在线未管理内存表
- 不允许把数据库中的历史管理账号伪装成 `unmanaged-memory`
- `latestTrend` 允许为 `null`，尤其是未管理在线账号默认没有历史趋势数据

---

## 五、实施步骤

### Phase 1: 建表与初始化 (优先级: 高)

1. 创建建表文件 `003_create_x_accounts_and_trend.sql`
2. 在 `TaskDatabase::init_schema()` 中接入新表初始化
3. 确认新代码只依赖 `x_accounts` 与 `x_account_trend`

**验证**:
- 检查新表是否创建成功
- 检查索引是否创建成功
- 确认没有旧表迁移逻辑

### Phase 2: 数据库接口重构 (优先级: 高)

1. 在 `task_database.rs` 中实现新的数据库操作接口
2. 增加 `x_accounts.instance_id / extension_name / personality_prompt` 的读写方法
3. 实现“管理信息 + 最新快照”聚合查询
4. 删除旧的 `insert_account()` 和 `update_account()` 方法
5. 添加单元测试

**验证**:
- 编译通过
- 单元测试通过
- `x_accounts` 与 `x_account_trend` 字段职责边界清晰

### Phase 3: 业务逻辑重构 (优先级: 高)

1. 修改 `localbridge_sync_executor.rs` 的 `process_user_info()` 函数
2. 系统启动时预加载 `x_accounts` 中当前已管理账号的实例绑定信息到内存缓存表
3. 增加未管理在线账号内存表，用于保存当前在线且不属于当前管理集合的账号对象
4. 每次 5 分钟同步时：
   - 当前已管理账号：更新实例绑定并按策略写入 `x_account_trend`
   - 历史管理账号：不写入趋势，不进入未管理在线内存表
   - 未管理在线账号：仅刷新内存对象，不写入管理表与趋势表
5. 用数据库已写入的新值刷新实例绑定缓存
6. 测试定时任务是否正常工作

**验证**:
- 定时任务正常执行
- 当前已管理账号持续更新趋势快照
- 历史管理账号不会误进入未管理在线分组
- 未管理在线账号可在内存表中正确维护
- `instance_id` / `extension_name` 变化时可正确落库
- 内存缓存与数据库状态一致
- 日志输出正确

### Phase 4: 前端接口实现 (优先级: 中)

1. 在 `commands/account.rs` 中实现账号管理 API
2. 提供两类列表接口：当前已管理账号（数据库）+ 当前未管理在线账号（内存）
3. `get_account_detail` 同时支持数据库账号与内存账号
4. 补充更新 `personality_prompt` 的接口
5. 历史管理账号相关查询能力仅保留后端能力，不进入 V1 前端主流程
6. 测试 API 是否正常工作

**验证**:
- API 调用成功
- 返回数据格式正确
- 未管理在线账号也可进入主显示区详情
- 当前已管理 / 历史管理 / 未管理在线三类语义不混淆
- 可单独更新账号任务性格提示词

### Phase 5: 前端 UI 实现 (优先级: 中)

1. 在 `useAppLayoutState.ts` 中恢复 accounts 列表加载逻辑
2. 左侧列表改为分组折叠结构：当前已管理账号 / 未管理在线账号
3. 未管理在线账号分组数据来自内存接口
4. 将中间详情页统一为可展示两类账号的详情组件
5. 增加 `personality_prompt` 展示与编辑入口
6. 实现未选中账号时的概览页，而不是继续使用占位文案
7. 明确 V1 不提供历史管理账号入口

**验证**:
- UI 交互正常
- 左侧折叠分组行为正常
- 未管理在线账号可查看详情并加入管理
- 历史管理账号不会误出现在 V1 主界面中
- 列表与详情数据字段边界清晰
- `personality_prompt` 可查看和更新
- 数据实时更新

### Phase 6: 清理旧代码 (优先级: 低)

1. 删除旧表 `managed_twitter_accounts` 的定义与依赖代码
2. 删除旧的数据库接口
3. 删除重复占位组件或合并概览组件
4. 更新文档

---

## 六、风险评估

### 6.1 初始化落地风险

**风险**: 新表建好了，但代码仍残留对旧表 `managed_twitter_accounts` 的读写依赖

**缓解措施**:
- 全面搜索旧表引用并一次性切换到新表
- `TaskDatabase::init_schema()` 只接入新建表文件，不加入旧数据迁移逻辑
- Phase 1 完成后先做一次编译和联调检查，确认没有旧表路径残留

### 6.2 性能风险

**风险**: `x_account_trend` 表数据量增长过快，且 5 分钟定时任务会对实例绑定做额外检查

**缓解措施**:
- 设置快照间隔 (当前为 1 小时)
- `instance_id` / `extension_name` 只在内存比对发现变化时才更新数据库
- 系统启动时一次性预热 `x_accounts` 绑定缓存，避免同步期间反复查库
- 定期清理旧快照 (保留最近 30 天)
- 添加分区或归档机制

### 6.3 缓存一致性风险

**风险**: 实例绑定缓存或未管理在线账号内存表与真实在线状态不一致，导致左侧分组或详情展示错误，或者把历史管理账号误判成未管理在线账号

**缓解措施**:
- `AccountBindingCache` 只作为“是否需要更新”的快速判断，不作为最终事实来源
- 数据库更新成功后，再用已提交结果回写实例绑定缓存
- 未管理在线账号内存表按每轮 5 分钟同步结果整体刷新
- 已加入管理的账号要立即从未管理在线内存表移除
- `x_accounts.is_managed = 0` 的历史管理账号不得写入未管理在线内存表
- 为实例绑定变更和未管理在线账号进出内存表增加日志，便于排查

### 6.4 前端重构风险

**风险**: 账号列表、详情页、概览页职责混乱，或者未管理在线账号只能出现在左侧无法进入主显示区，或者历史管理账号被错误暴露到 V1 主界面

**缓解措施**:
- 明确 `AccountDetailPane` 同时支持当前已管理账号和未管理在线账号
- `AccountManagement` 与 `AccountsOverview` 只保留一个概览组件
- 左侧账号列表按“已管理 / 未被管理”两组实现折叠结构
- V1 不提供历史管理账号主界面入口
- 先定义 DTO，再改 UI，避免字段含义继续混杂

### 6.5 兼容性风险

**风险**: 重构过程中旧代码仍依赖 `managed_twitter_accounts` 表或旧接口

**缓解措施**:
- 全面搜索代码，找到所有旧表与旧接口依赖
- 逐步重构，确保每个模块都切换到新表
- 在实现阶段不保留旧表兼容逻辑，避免双路径长期并存

---

## 七、性能优化

### 7.1 查询优化

**获取最新快照**:
```sql
-- 使用子查询 + 索引
SELECT * FROM x_account_trend
WHERE twitter_id = ?1
AND created_at = (
    SELECT MAX(created_at) FROM x_account_trend WHERE twitter_id = ?1
);
```

**获取管理的账号列表 (带最新快照)**:
```sql
-- 使用 JOIN + 子查询
SELECT 
    a.twitter_id,
    a.is_managed,
    a.instance_id,
    a.extension_name,
    a.personality_prompt,
    t.screen_name,
    t.display_name,
    t.avatar_url,
    t.last_online_time,
    t.created_at AS latest_snapshot_at
FROM x_accounts a
LEFT JOIN (
    SELECT twitter_id, screen_name, display_name, avatar_url, last_online_time, created_at,
           ROW_NUMBER() OVER (PARTITION BY twitter_id ORDER BY created_at DESC) as rn
    FROM x_account_trend
) t ON a.twitter_id = t.twitter_id AND t.rn = 1
WHERE a.is_managed = 1;
```

### 7.2 同步优化

**实例绑定变更只在内存比对失败时写库**:
- 启动时预加载 `x_accounts` → `AccountBindingCache`
- 定时任务内先做缓存比较
- 只有 `instance_id` / `extension_name` 实际发生变化时才执行 UPDATE
- UPDATE 成功后再刷新缓存

### 7.3 数据清理策略

**定期清理旧快照** (保留最近 30 天):
```sql
DELETE FROM x_account_trend
WHERE created_at < datetime('now', '-30 days')
AND twitter_id NOT IN (
    SELECT twitter_id FROM x_accounts WHERE is_managed = 1
);
```

**说明**: 只清理不属于当前已管理集合的旧快照；当前已管理账号保留所有历史数据。

---

## 八、未来扩展

### 8.1 管理级别

在 `x_accounts` 表中添加 `management_level` 字段：
- 0: 普通管理
- 1: 高级管理 (更频繁的数据更新)
- 2: VIP 管理 (实时数据更新)

### 8.2 权限组

在 `x_accounts` 表中添加 `permission_group` 字段：
- 不同权限组可以执行不同的任务
- 支持多账号协作

### 8.3 任务性格系统

基于 `x_accounts.personality_prompt` 实现账号级任务人格配置：
- 同一套任务模板，可按账号应用不同的回答语气与推文风格
- 回答问题、发帖、互动时都先读取账号自己的 `personality_prompt`
- 未配置时回退到系统默认任务提示词
- 后续可扩展为模板继承、变量注入、风格库选择

### 8.4 数据积木

基于 `x_account_trend` 表实现数据积木功能：
- 粉丝增长趋势
- 推文活跃度分析
- 账号健康度评分

---

## 九、总结

### 9.1 核心变化

1. **表结构**: 直接落地 `x_accounts` + `x_account_trend`
2. **账号分层**: 明确区分当前已管理账号、历史管理账号、未管理在线账号
3. **管理属性**: `instance_id` / `extension_name` / `personality_prompt` 收敛到 `x_accounts`
4. **同步机制**: 增加启动预热的实例绑定内存缓存，以及未管理在线账号内存表
5. **历史数据**: 只有当前已管理账号进入快照链路，保留趋势分析能力

### 9.2 优势

1. **职责清晰**: 管理状态、在线发现态、趋势快照三类职责边界清晰
2. **落地直接**: 不承担旧数据迁移与兼容负担
3. **界面一致**: 当前已管理账号与未管理在线账号都能进入统一详情页
4. **扩展性强**: 支持任务性格、管理级别、权限组等扩展
5. **趋势分析**: 当前已管理账号保留历史数据，支持趋势分析
6. **语义收紧**: 避免把数据库历史状态误认为内存在线未管理状态

### 9.3 实施建议

1. **优先级**: Phase 1-3 为高优先级，必须完成
2. **测试**: 每个 Phase 完成后都要充分测试
3. **切换原则**: 新代码直接读写新表，不保留旧迁移逻辑
4. **V1 策略**: 前端主界面只覆盖“当前已管理账号 + 当前未管理在线账号”，不开放历史管理账号入口
5. **文档**: 更新相关文档，说明新的表结构、缓存机制和前端界面结构

---

**文档状态**: 设计方案，待批准
