# 推特账号管理重构方案

## 文档信息

- **版本**: v1.0
- **创建时间**: 2026-04-21
- **最后更新**: 2026-04-21

## 一、重构背景与目标

### 当前问题

1. **账号管理缺乏持久化**：当前账号信息存储在内存中（`MAPPED_ACCOUNTS`），应用重启后丢失
2. **状态管理不完善**：无法区分"在线"和"离线"状态，无法追踪账号的历史在线状态
3. **UI 展示单一**：左侧列表只显示已映射账号，无法展示可添加的账号

### 设计目标

1. **持久化存储**：使用 SQLite 数据库存储管理范围内的推特账号
2. **状态追踪**：实时追踪账号在线/离线状态，记录最后在线时间
3. **分层展示**：左侧列表分上下两层显示账号
   - 上层：管理范围内的账号（在线/离线状态）
   - 下层：可添加的账号（LocalBridge 查询到但未管理的账号）

## 二、UI 设计

### 左侧账号列表布局

```
┌─────────────────────────────┐
│  管理的账号                  │
├─────────────────────────────┤
│  ● @account1  (在线)         │
│  ○ @account2  (离线)         │
│  ● @account3  (在线)         │
├─────────────────────────────┤
│  可添加的账号                │
├─────────────────────────────┤
│  + @account4                 │
│  + @account5                 │
└─────────────────────────────┘
```

### 上层：管理范围内的账号

**显示内容**：
- 头像
- 用户名（screen_name）
- 显示名称（display_name）
- 在线状态指示器（绿点/灰点）
- 状态文本（"在线" / "离线"）

**状态判断逻辑**：
- 如果该账号在最近一次 LocalBridge 查询结果中 → 显示为"在线"
- 如果该账号不在最近一次 LocalBridge 查询结果中 → 显示为"离线"

**交互**：
- 点击账号：选中该账号，右侧显示该账号的基本信息和数据
- 右键菜单：删除账号、查看详情

### 下层：可添加的账号

**显示内容**：
- 头像
- 用户名（screen_name）
- 显示名称（display_name）
- "+" 添加按钮

**数据来源**：
- 通过 LocalBridge 查询到的实例
- 排除已在管理范围内的账号
- 这些账号肯定是在线的（因为能查到）

**交互**：
- 点击 "+" 按钮：将账号添加到管理范围
- 添加后，账号从下层移动到上层

## 三、数据库设计

### 3.1 表结构：`managed_twitter_accounts`

存储管理范围内的推特账号信息。

```sql
CREATE TABLE IF NOT EXISTS managed_twitter_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- 账号标识（唯一）
    twitter_id TEXT NOT NULL UNIQUE,
    screen_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    
    -- 账号属性
    description TEXT,
    is_verified BOOLEAN DEFAULT 0,
    account_created_at TEXT,
    
    -- 状态管理
    last_online_time TIMESTAMP,
    
    -- LocalBridge 关联
    instance_id TEXT,
    extension_name TEXT,
    
    -- 时间戳
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 索引：按 twitter_id 查询
CREATE INDEX IF NOT EXISTS idx_twitter_id 
ON managed_twitter_accounts(twitter_id);

-- 索引：按最后在线时间查询
CREATE INDEX IF NOT EXISTS idx_last_online_time 
ON managed_twitter_accounts(last_online_time DESC);
```

### 3.2 数据字段说明

#### 账号标识
| 字段 | 类型 | 说明 |
|------|------|------|
| `twitter_id` | TEXT | Twitter 账号唯一 ID（来自 `rest_id`），唯一约束 |
| `screen_name` | TEXT | 用户名（如 `@huhulws`） |
| `display_name` | TEXT | 显示名称（如 `aiClaw`） |
| `avatar_url` | TEXT | 头像 URL |

#### 账号属性
| 字段 | 类型 | 说明 |
|------|------|------|
| `description` | TEXT | 个人简介 |
| `is_verified` | BOOLEAN | 认证状态 |
| `account_created_at` | TEXT | 账号创建时间 |

#### 状态管理
| 字段 | 类型 | 说明 |
|------|------|------|
| `last_online_time` | TIMESTAMP | 最后在线时间（每次发现账号在线时更新） |

**注意**：`is_online` 状态不存储在数据库中，而是在前端调用接口时实时计算。判断逻辑：账号的 `twitter_id` 是否在当前 LocalBridge 查询结果中。

#### LocalBridge 关联
| 字段 | 类型 | 说明 |
|------|------|------|
| `instance_id` | TEXT | LocalBridge 实例 ID |
| `extension_name` | TEXT | 扩展名称 |

#### 时间戳
| 字段 | 类型 | 说明 |
|------|------|------|
| `created_at` | TIMESTAMP | 账号添加到管理范围的时间 |
| `updated_at` | TIMESTAMP | 账号信息最后更新时间 |

## 四、账号状态更新机制

### 4.1 查询时机

**使用现有的定时任务**：`refresh_all_accounts_status()`

- **App 启动时**：执行一次
- **定时任务**：每 5 分钟执行一次

### 4.2 LocalBridge 查询流程

**使用现有流程**（[src-tauri/src/commands/account.rs](src-tauri/src/commands/account.rs) 第 226-351 行）：

1. 调用 `client.get_instances()` 获取实例列表
2. 对每个实例调用 `client.get_basic_info_with_instance(instance_id)` 获取推特账号信息
3. 解析返回的账号数据（twitter_id, screen_name, display_name, avatar_url 等）

**注意**：实例（instance）和推特账号不是一对一的，需要通过 API 才能知道实例对应哪个推特账号。

### 4.3 状态更新逻辑

**在 `refresh_all_accounts_status()` 中新增逻辑**：

```rust
// 伪代码
pub async fn refresh_all_accounts_status() -> Result<(), String> {
    // 1. 查询 LocalBridge 获取所有在线实例
    let instances = client.get_instances().await?;
    let mut online_twitter_ids = HashSet::new();
    
    // 2. 对每个实例获取推特账号信息
    for instance in instances {
        let basic_info = client.get_basic_info_with_instance(instance_id).await?;
        let twitter_id = basic_info.id.unwrap_or_default();
        online_twitter_ids.insert(twitter_id.clone());
        
        // 3. 检查该账号是否在管理范围内
        if is_account_managed(twitter_id.clone()).await? {
            // 3a. 在管理范围内：更新账号信息和最后在线时间
            update_managed_account(
                twitter_id,
                screen_name,
                display_name,
                avatar_url,
                is_verified,
                account_created_at,
                chrono::Utc::now(), // last_online_time
                instance_id,
                extension_name,
            ).await?;
        }
    }
    
    // 4. 不需要标记离线，因为 is_online 是实时计算的
    
    Ok(())
}
```

**状态更新规则**：
- 如果账号在 LocalBridge 查询结果中：
  - 更新 `last_online_time = 当前时间`
  - 更新账号信息（screen_name, display_name, avatar_url 等）
- 如果账号不在 LocalBridge 查询结果中：
  - `last_online_time` 保持不变（记录最后一次在线时间）
  - 不更新任何字段

**注意**：`is_online` 状态不存储在数据库中，而是在前端调用接口时实时计算。

## 五、接口设计

### 5.1 数据库操作接口

#### 添加账号到管理范围

```rust
/// 添加推特账号到管理范围
pub async fn add_managed_account(
    twitter_id: String,
    screen_name: String,
    display_name: String,
    avatar_url: Option<String>,
    description: Option<String>,
    is_verified: bool,
    account_created_at: Option<String>,
    instance_id: Option<String>,
    extension_name: Option<String>,
) -> Result<(), String>
```

**SQL**：
```sql
INSERT INTO managed_twitter_accounts (
    twitter_id, screen_name, display_name, avatar_url,
    description, is_verified, account_created_at,
    last_online_time,
    instance_id, extension_name
) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
```

#### 删除账号

```rust
/// 从管理范围删除推特账号
pub async fn remove_managed_account(
    twitter_id: String,
) -> Result<(), String>
```

**SQL**：
```sql
DELETE FROM managed_twitter_accounts WHERE twitter_id = ?
```

#### 更新账号信息和状态

```rust
/// 更新管理账号的信息和最后在线时间
pub async fn update_managed_account(
    twitter_id: String,
    screen_name: String,
    display_name: String,
    avatar_url: Option<String>,
    is_verified: bool,
    account_created_at: Option<String>,
    last_online_time: chrono::DateTime<chrono::Utc>,
    instance_id: Option<String>,
    extension_name: Option<String>,
) -> Result<(), String>
```

**SQL**：
```sql
UPDATE managed_twitter_accounts
SET screen_name = ?,
    display_name = ?,
    avatar_url = ?,
    is_verified = ?,
    account_created_at = ?,
    last_online_time = ?,
    instance_id = ?,
    extension_name = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE twitter_id = ?
```

#### 查询管理的账号列表（带实时在线状态）

```rust
/// 获取所有管理范围内的账号（带实时在线状态）
pub async fn get_managed_accounts_with_status() -> Result<Vec<ManagedAccountWithStatus>, String>
```

**逻辑**：
1. 从数据库查询所有管理的账号
2. 查询 LocalBridge 获取当前在线的 twitter_id 列表
3. 对每个账号计算 `is_online` 状态（是否在 LocalBridge 查询结果中）
4. 返回账号列表（包含实时 `is_online` 状态）

**SQL**：
```sql
SELECT * FROM managed_twitter_accounts
ORDER BY last_online_time DESC
```

#### 检查账号是否在管理范围

```rust
/// 检查账号是否在管理范围内
pub async fn is_account_managed(
    twitter_id: String,
) -> Result<bool, String>
```

**SQL**：
```sql
SELECT COUNT(*) FROM managed_twitter_accounts WHERE twitter_id = ?
```

### 5.2 前端调用接口

#### 获取管理的账号列表

```rust
#[tauri::command]
pub async fn get_managed_twitter_accounts() -> Result<Vec<ManagedAccountWithStatus>, String>
```

**逻辑**：
1. 从数据库查询所有管理的账号
2. 查询 LocalBridge 获取当前在线的 twitter_id 列表
3. 对每个账号计算 `is_online` 状态（是否在 LocalBridge 查询结果中）
4. 返回账号列表（包含实时 `is_online` 状态）

返回结果：
```json
[
  {
    "twitter_id": "2008000592866893824",
    "screen_name": "@huhulws",
    "display_name": "aiClaw",
    "avatar_url": "https://...",
    "is_online": true,
    "last_online_time": "2026-04-21T15:30:00Z"
  }
]
```

#### 获取可添加的账号列表

```rust
#[tauri::command]
pub async fn get_available_twitter_accounts() -> Result<Vec<AvailableAccount>, String>
```

**逻辑**：
1. 调用 `client.get_instances()` 获取所有实例
2. 对每个实例调用 `client.get_basic_info_with_instance()` 获取推特账号信息
3. 过滤掉已在管理范围内的账号
4. 返回可添加的账号列表

返回结果：
```json
[
  {
    "twitter_id": "1234567890",
    "screen_name": "@newaccount",
    "display_name": "New Account",
    "avatar_url": "https://...",
    "instance_id": "instance_123",
    "extension_name": "Extension 1"
  }
]
```

#### 添加账号到管理范围

```rust
#[tauri::command]
pub async fn add_twitter_account_to_management(
    twitter_id: String,
) -> Result<(), String>
```

**逻辑**：
1. 从 LocalBridge 获取该账号的完整信息
2. 调用 `add_managed_account()` 添加到数据库
3. 返回成功/失败

#### 删除管理的账号

```rust
#[tauri::command]
pub async fn remove_twitter_account_from_management(
    twitter_id: String,
) -> Result<(), String>
```

**逻辑**：
1. 调用 `remove_managed_account()` 从数据库删除
2. 返回成功/失败

## 六、数据结构定义

### Rust 数据结构

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedAccount {
    pub twitter_id: String,
    pub screen_name: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub description: Option<String>,
    pub is_verified: bool,
    pub account_created_at: Option<String>,
    pub last_online_time: Option<String>,
    pub instance_id: Option<String>,
    pub extension_name: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedAccountWithStatus {
    pub twitter_id: String,
    pub screen_name: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub description: Option<String>,
    pub is_verified: bool,
    pub account_created_at: Option<String>,
    pub is_online: bool,  // 实时计算，不存数据库
    pub last_online_time: Option<String>,
    pub instance_id: Option<String>,
    pub extension_name: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailableAccount {
    pub twitter_id: String,
    pub screen_name: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub instance_id: String,
    pub extension_name: String,
}
```

## 七、删除现有代码清单

### 7.1 删除内存存储相关代码

**文件**：[src-tauri/src/commands/account.rs](src-tauri/src/commands/account.rs)

删除以下内容：

1. **全局内存变量**（第 7-9 行）：
```rust
static MAPPED_ACCOUNTS: Lazy<Mutex<Vec<TwitterAccount>>> = Lazy::new(|| {
    Mutex::new(Vec::new())
});
```

2. **TwitterAccount 结构体**（第 11-29 行）：
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TwitterAccount {
    pub screen_name: String,
    pub display_name: String,
    pub avatar: String,
    pub status: AccountStatus,
    pub last_verified: String,
    pub twitter_id: Option<String>,
    pub description: Option<String>,
    pub instance_id: Option<String>,
    pub extension_name: Option<String>,
    pub default_tab_id: Option<i32>,
    #[serde(default = "default_is_logged_in")]
    pub is_logged_in: bool,
    pub followers_count: Option<i64>,
    pub following_count: Option<i64>,
    pub tweet_count: Option<i64>,
}
```

3. **TwitterAccountInfo 结构体**（第 37-41 行）：
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TwitterAccountInfo {
    pub screen_name: String,
    pub display_name: String,
    pub avatar: String,
}
```

4. **AccountStatus 枚举**（第 43-49 行）：
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AccountStatus {
    Online,
    Offline,
    Verifying,
}
```

5. **所有使用 MAPPED_ACCOUNTS 的函数**：
   - `get_available_accounts()` (第 51-98 行)
   - `map_account()` (第 100-184 行)
   - `delete_account_mapping()` (第 186-191 行)
   - `get_mapped_accounts()` (第 193-197 行)
   - `verify_account_status()` (第 199-223 行)
   - `reconnect_account()` (第 361-372 行)
   - `get_account_settings()` (第 387-408 行)
   - `save_account_personality()` (第 410-414 行)
   - `unlink_account()` (第 416-421 行)
   - `delete_account_completely()` (第 423-428 行)

6. **保留但需要重构的函数**：
   - `refresh_all_accounts_status()` (第 225-351 行) - 需要修改为使用数据库
   - `get_instances()` (第 353-358 行) - 保留不变

### 7.2 修改 refresh_all_accounts_status()

**当前逻辑**（需要删除）：
- 将查询结果存储到 `MAPPED_ACCOUNTS` 内存变量
- 使用 `synced_accounts` 临时变量收集数据

**新逻辑**（需要实现）：
- 查询 LocalBridge 获取在线实例
- 对每个实例获取推特账号信息
- 检查账号是否在管理范围内（数据库查询）
- 如果在管理范围内，更新账号信息和 `last_online_time`
- 不需要标记离线（`is_online` 是实时计算的）

## 八、实现步骤

### Phase 1：数据库基础设施
1. 创建 SQLite 表结构 `managed_twitter_accounts`
2. 实现数据库操作接口（增删改查）
3. 编写单元测试验证数据库操作

### Phase 2：状态更新逻辑
1. 修改 `refresh_all_accounts_status()` 函数
2. 实现状态更新逻辑（在线/离线判断）
3. 测试定时任务的状态更新

### Phase 3：前端接口实现
1. 实现 Tauri 命令（`get_managed_twitter_accounts`, `get_available_twitter_accounts` 等）
2. 测试前后端数据交互
3. 处理错误情况

### Phase 4：UI 实现
1. 实现左侧账号列表的分层显示
2. 实现账号添加/删除交互
3. 实现在线/离线状态指示器
4. 实现账号选择和右侧详情展示

### Phase 5：迁移和测试
1. 从内存存储迁移到数据库
2. 删除旧的 `MAPPED_ACCOUNTS` 代码
3. 端到端测试
4. 性能优化

## 九、注意事项

### 9.1 实例与推特账号的关系

- **实例（Instance）**：LocalBridge 中的浏览器扩展实例
- **推特账号（Twitter Account）**：实际的 Twitter 账号
- **关系**：一个实例对应一个推特账号，但需要通过 API 查询才能知道对应关系

**查询流程**：
1. `get_instances()` → 获取实例列表（只有 instance_id, extension_name）
2. `get_basic_info_with_instance(instance_id)` → 获取该实例对应的推特账号信息

### 9.2 状态更新的时机

- **5 分钟定时任务**：每 5 分钟更新一次所有账号的在线状态
- **立即更新**：用户手动添加/删除账号时，立即更新数据库

### 9.3 数据一致性

- 使用 `twitter_id` 作为唯一标识（UNIQUE 约束）
- 避免重复添加同一账号
- 删除账号时同时删除相关的历史数据（如果有）

### 9.4 性能优化

- 使用索引优化查询（`twitter_id`, `is_online`）
- 批量更新状态（`mark_offline_accounts`）
- 避免频繁的数据库写入

## 十、参考文档

- 当前账号管理实现：[src-tauri/src/commands/account.rs](src-tauri/src/commands/account.rs)
- LocalBridge 客户端：[src-tauri/src/services/localbridge.rs](src-tauri/src/services/localbridge.rs)
- 定时任务：`refresh_all_accounts_status()` (每 5 分钟)

---

**文档状态**：设计阶段，待评审
