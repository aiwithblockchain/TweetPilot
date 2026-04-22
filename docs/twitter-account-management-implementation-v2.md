# 推特账号管理实现方案 v2.0

## 文档信息

- **版本**: v2.0
- **创建时间**: 2026-04-22
- **基于**: twitter-account-management-refactor.md v1.0

## 一、核心设计原则

### 1.1 职责分离

- **定时任务**: 只负责读取数据,不处理业务逻辑
- **Channel + 后台协程**: 负责所有业务逻辑(数据库写入、状态更新)
- **前端接口**: 负责数据查询和用户交互

### 1.2 数据管理策略

- **软删除**: 使用 `is_managed` 标志位,不物理删除数据
- **保留历史**: 所有账号数据永久保留,方便追溯和重新管理
- **三种操作**:
  - 添加到管理: `is_managed = 1`
  - 解除管理: `is_managed = 0` (保留数据)
  - 彻底删除: 物理删除记录 + TODO: 删除关联数据积木

## 二、数据库设计

### 2.1 表结构修改

修改 `002_create_accounts_table.sql`,添加 `is_managed` 字段:

```sql
-- Managed Twitter Accounts table
CREATE TABLE IF NOT EXISTS managed_twitter_accounts (
    twitter_id TEXT PRIMARY KEY,
    screen_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    description TEXT,
    is_verified BOOLEAN DEFAULT 0,
    is_managed BOOLEAN DEFAULT 0,  -- 新增: 是否归平台管理
    last_online_time TIMESTAMP,
    instance_id TEXT,
    extension_name TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounts_last_online
ON managed_twitter_accounts(last_online_time DESC);

CREATE INDEX IF NOT EXISTS idx_accounts_is_managed
ON managed_twitter_accounts(is_managed);
```

### 2.2 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `is_managed` | BOOLEAN | 是否归平台管理 (0=未管理, 1=已管理) |
| `last_online_time` | TIMESTAMP | 最后在线时间 (每次发现在线时更新) |

**注意**: `is_online` 状态不存储在数据库,而是实时计算 (账号是否在当前 LocalBridge 查询结果中)

## 三、架构设计

### 3.1 数据流架构

```
┌─────────────────────────────────────────────────────────────┐
│                     定时任务 (每5分钟)                        │
│              refresh_all_accounts_status()                   │
│                                                               │
│  职责: 只读取数据,不处理业务逻辑                              │
│  1. 查询 LocalBridge 获取所有在线实例                         │
│  2. 对每个实例获取推特账号信息                                │
│  3. 将原始数据发送到 Channel                                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ AccountSyncMessage
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Channel (mpsc::channel)                     │
│                                                               │
│  消息类型: AccountSyncMessage                                 │
│  - twitter_id, screen_name, display_name, avatar_url         │
│  - is_verified, description, instance_id, extension_name     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              后台协程 (tokio::spawn)                          │
│          account_sync_worker()                               │
│                                                               │
│  职责: 处理所有业务逻辑                                        │
│  1. 从 Channel 接收账号数据                                   │
│  2. 检查账号是否在数据库中                                     │
│  3. 如果存在且 is_managed=1: 更新信息和 last_online_time      │
│  4. 如果不存在: 插入新记录, is_managed=0                      │
│  5. 批量提交数据库事务                                         │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 组件职责

#### 定时任务: `refresh_all_accounts_status()`

**职责**: 只读取数据,不处理业务逻辑

```rust
pub async fn refresh_all_accounts_status(
    tx: mpsc::Sender<AccountSyncMessage>
) -> Result<(), String> {
    // 1. 查询 LocalBridge 获取所有在线实例
    let instances = client.get_instances().await?;
    
    // 2. 对每个实例获取推特账号信息
    for instance in instances {
        let basic_info = client.get_basic_info_with_instance(instance_id).await?;
        
        // 3. 构造消息并发送到 Channel
        let message = AccountSyncMessage {
            twitter_id: basic_info.id.unwrap_or_default(),
            screen_name: basic_info.screen_name,
            display_name: basic_info.display_name,
            avatar_url: basic_info.avatar_url,
            is_verified: basic_info.is_verified,
            description: basic_info.description,
            instance_id: instance.id,
            extension_name: instance.extension_name,
        };
        
        // 发送到 Channel,不等待处理结果
        tx.send(message).await.map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
```

**不做的事情**:
- ❌ 不查询数据库
- ❌ 不更新数据库
- ❌ 不判断账号是否管理
- ❌ 不更新 UI

#### 后台协程: `account_sync_worker()`

**职责**: 处理所有业务逻辑

```rust
pub async fn account_sync_worker(
    mut rx: mpsc::Receiver<AccountSyncMessage>,
    db: Arc<Mutex<Option<TaskDatabase>>>,
) {
    let mut batch = Vec::new();
    let batch_size = 10;
    let batch_timeout = Duration::from_secs(5);
    
    loop {
        tokio::select! {
            // 接收消息
            Some(msg) = rx.recv() => {
                batch.push(msg);
                
                // 达到批量大小,立即处理
                if batch.len() >= batch_size {
                    process_batch(&batch, &db).await;
                    batch.clear();
                }
            }
            
            // 超时,处理剩余消息
            _ = tokio::time::sleep(batch_timeout), if !batch.is_empty() => {
                process_batch(&batch, &db).await;
                batch.clear();
            }
        }
    }
}

async fn process_batch(
    batch: &[AccountSyncMessage],
    db: &Arc<Mutex<Option<TaskDatabase>>>,
) {
    let db_guard = db.lock().unwrap();
    if let Some(ref database) = *db_guard {
        for msg in batch {
            // 1. 检查账号是否存在
            let exists = database.account_exists(&msg.twitter_id).unwrap_or(false);
            
            if exists {
                // 2. 如果存在,检查是否管理
                let is_managed = database.is_account_managed(&msg.twitter_id).unwrap_or(false);
                
                if is_managed {
                    // 3. 如果管理,更新信息和 last_online_time
                    database.update_account_info(msg).unwrap();
                }
                // 如果不管理,不做任何操作
            } else {
                // 4. 如果不存在,插入新记录, is_managed=0
                database.insert_account(msg, false).unwrap();
            }
        }
    }
}
```

**处理逻辑**:
1. 从 Channel 接收账号数据
2. 批量处理 (提高性能)
3. 对每个账号:
   - 如果存在 + `is_managed=1`: 更新信息和 `last_online_time`
   - 如果存在 + `is_managed=0`: 不做任何操作
   - 如果不存在: 插入新记录, `is_managed=0`

## 四、UI 设计

### 4.1 折叠式分层展示

```
┌─────────────────────────────────┐
│ ▼ 管理的账号 (2)                 │
├─────────────────────────────────┤
│  ● @huhulws (在线)               │
│     aiClaw                       │
│  ○ @account2 (离线)              │
│     Display Name 2               │
├─────────────────────────────────┤
│ ▼ 可添加的账号 (3)               │
├─────────────────────────────────┤
│  + @account3                     │
│     Display Name 3               │
│  + @account4                     │
│     Display Name 4               │
└─────────────────────────────────┘
```

### 4.2 交互设计

#### 管理的账号区域

**显示内容**:
- 头像
- 用户名 (screen_name)
- 显示名称 (display_name)
- 在线状态指示器 (绿点/灰点)
- 状态文本 ("在线" / "离线")

**右键菜单**:
- "解除管理": 设置 `is_managed = 0`, 保留数据
- "彻底删除": 物理删除记录 + TODO: 删除关联数据积木

#### 可添加的账号区域

**显示内容**:
- 头像
- 用户名 (screen_name)
- 显示名称 (display_name)
- "+" 添加按钮

**交互**:
- 点击 "+": 设置 `is_managed = 1`, 账号移动到上层

### 4.3 折叠状态

- 两个区域独立折叠
- 默认都展开
- 折叠状态保存到 localStorage

## 五、接口设计

### 5.1 数据库操作接口

```rust
// 检查账号是否存在
pub fn account_exists(&self, twitter_id: &str) -> Result<bool, String>

// 检查账号是否管理
pub fn is_account_managed(&self, twitter_id: &str) -> Result<bool, String>

// 插入新账号
pub fn insert_account(&self, msg: &AccountSyncMessage, is_managed: bool) -> Result<(), String>

// 更新账号信息和 last_online_time
pub fn update_account_info(&self, msg: &AccountSyncMessage) -> Result<(), String>

// 设置账号管理状态
pub fn set_account_managed(&self, twitter_id: &str, is_managed: bool) -> Result<(), String>

// 彻底删除账号
pub fn delete_account(&self, twitter_id: &str) -> Result<(), String>
```

### 5.2 前端调用接口

```rust
// 获取管理的账号列表 (is_managed=1, 带实时在线状态)
#[tauri::command]
pub async fn get_managed_accounts() -> Result<Vec<AccountWithStatus>, String>

// 获取可添加的账号列表 (LocalBridge 在线但 is_managed=0)
#[tauri::command]
pub async fn get_available_accounts() -> Result<Vec<AvailableAccount>, String>

// 添加到管理
#[tauri::command]
pub async fn add_account_to_management(twitter_id: String) -> Result<(), String>

// 解除管理 (设置 is_managed=0)
#[tauri::command]
pub async fn remove_account_from_management(twitter_id: String) -> Result<(), String>

// 彻底删除
#[tauri::command]
pub async fn delete_account_completely(twitter_id: String) -> Result<(), String>
```

## 六、数据结构定义

```rust
// Channel 消息类型
#[derive(Debug, Clone)]
pub struct AccountSyncMessage {
    pub twitter_id: String,
    pub screen_name: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub is_verified: bool,
    pub description: Option<String>,
    pub instance_id: String,
    pub extension_name: String,
}

// 管理的账号 (带实时在线状态)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountWithStatus {
    pub twitter_id: String,
    pub screen_name: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
    pub description: Option<String>,
    pub is_verified: bool,
    pub is_online: bool,  // 实时计算
    pub last_online_time: Option<String>,
    pub instance_id: Option<String>,
    pub extension_name: Option<String>,
}

// 可添加的账号
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

## 七、实现步骤

### Phase 0: 清理旧代码 (必须先完成)

#### 0.1 分析现有代码

**第一部分: 当前显示账号信息的逻辑**

文件: [src/components/AccountManagement.tsx](src/components/AccountManagement.tsx)

- 调用 `accountService.getMappedAccounts()` 获取账号列表
- 对应后端命令: `get_mapped_accounts`
- 使用 `MAPPED_ACCOUNTS` 内存变量存储账号
- 显示所有映射的账号,不区分管理/未管理
- 有在线/离线状态,但通过 `verify_account_status` 手动验证

**第二部分: 创建任务时执行账号列表的逻辑**

文件: [src/components/TaskCreatePane.tsx:32-54](src/components/TaskCreatePane.tsx#L32-L54)

- 同样调用 `accountService.getMappedAccounts()` 获取账号列表
- 显示所有映射的账号,不区分是否归平台管理
- 使用 `screenName` 作为标识,而不是 `twitter_id`

#### 0.2 清理后端代码

**删除内存存储相关代码**

文件: [src-tauri/src/commands/account.rs](src-tauri/src/commands/account.rs)

需要删除:
- [ ] 全局内存变量 `MAPPED_ACCOUNTS` (第 7-9 行)
- [ ] `TwitterAccount` 结构体 (第 11-29 行)
- [ ] `TwitterAccountInfo` 结构体 (第 37-41 行)
- [ ] `AccountStatus` 枚举 (第 43-49 行)
- [ ] 所有使用 `MAPPED_ACCOUNTS` 的函数:
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

需要保留但重构:
- [ ] `refresh_all_accounts_status()` (第 225-351 行) - 修改为只读取数据并发送到 Channel
- [ ] `get_instances()` (第 353-358 行) - 保留不变

#### 0.3 清理前端服务层

文件: [src/services/account/tauri.ts](src/services/account/tauri.ts)

需要删除的接口:
- [ ] `getAvailableAccounts()` - 将被新接口替代
- [ ] `getMappedAccounts()` - 将被 `getManagedAccounts()` 替代
- [ ] `mapAccount()` - 将被 `addAccountToManagement()` 替代
- [ ] `deleteAccountMapping()` - 将被 `removeAccountFromManagement()` 替代
- [ ] `verifyAccountStatus()` - 不再需要手动验证
- [ ] `reconnectAccount()` - 不再需要
- [ ] `getAccountSettings()` - 暂时保留
- [ ] `saveAccountPersonality()` - 暂时保留
- [ ] `unlinkAccount()` - 将被 `removeAccountFromManagement()` 替代
- [ ] `deleteAccountCompletely()` - 保留但修改参数为 `twitter_id`

需要保留:
- [ ] `refreshAllAccountsStatus()` - 保留不变

#### 0.4 更新类型定义

文件: [src/services/account/types.ts](src/services/account/types.ts)

需要修改:
- [ ] `MappedAccount` → `ManagedAccount`
  - 添加 `twitterId: string` (必填)
  - 添加 `isManaged: boolean`
  - 添加 `isOnline: boolean` (实时计算)
  - 保留其他字段

- [ ] `AvailableAccount` 修改为:
  - 添加 `twitterId: string` (必填)
  - 添加 `instanceId: string`
  - 添加 `extensionName: string`

- [ ] 删除 `AccountStatus` 枚举 (使用 `isOnline: boolean` 替代)

#### 0.5 清理顺序

**建议按以下顺序清理**:

1. **先清理后端**: 删除 `MAPPED_ACCOUNTS` 和相关函数
2. **实现新的数据库接口**: 按照 v2.0 文档实现数据库操作
3. **修改前端服务层**: 更新 `accountService` 的接口定义
4. **最后修改 UI**: 实现折叠式分层展示

这样可以确保数据层稳定后再修改 UI,避免反复修改。

---

### Phase 1: 数据库基础 (已完成)
- [x] 创建 `managed_twitter_accounts` 表
- [x] 统一数据库文件为 `tweetpilot.db`

### Phase 2: 数据库表结构调整
- [ ] 修改 `002_create_accounts_table.sql`, 添加 `is_managed` 字段
- [ ] 添加 `is_managed` 索引
- [ ] 实现数据库操作接口 (增删改查)

### Phase 3: Channel + 后台协程
- [ ] 定义 `AccountSyncMessage` 结构
- [ ] 创建 Channel (mpsc::channel)
- [ ] 实现 `account_sync_worker()` 后台协程
- [ ] 修改 `refresh_all_accounts_status()` 只负责读取和发送

### Phase 4: 前端接口
- [ ] 实现 `get_managed_accounts()` (带实时在线状态)
- [ ] 实现 `get_available_accounts()`
- [ ] 实现 `add_account_to_management()`
- [ ] 实现 `remove_account_from_management()`
- [ ] 实现 `delete_account_completely()`

### Phase 5: UI 实现
- [ ] 实现折叠式分层列表
- [ ] 实现在线/离线状态指示器
- [ ] 实现右键菜单 (解除管理/彻底删除)
- [ ] 实现添加按钮交互

### Phase 6: 测试和优化
- [ ] 测试定时任务 + Channel + 后台协程
- [ ] 测试账号添加/解除/删除
- [ ] 测试在线/离线状态实时更新
- [ ] 性能优化 (批量处理)

## 八、TODO 标记

### 数据积木删除 (未来实现)

当彻底删除账号时:
- 删除 `managed_twitter_accounts` 记录
- **TODO**: 删除关联的数据积木表 (未来实现时需要级联删除)

```rust
pub fn delete_account_completely(&self, twitter_id: &str) -> Result<(), String> {
    // 1. 删除账号记录
    self.delete_account(twitter_id)?;
    
    // 2. TODO: 删除关联的数据积木
    // self.delete_account_data_blocks(twitter_id)?;
    
    Ok(())
}
```

## 九、关键设计决策

### 9.1 为什么使用 Channel + 后台协程?

- **职责分离**: 定时任务只负责读取,不阻塞
- **异步处理**: 数据库写入在后台异步处理,不影响定时任务
- **批量优化**: 后台协程可以批量处理,提高性能
- **解耦**: 定时任务和数据库操作完全解耦

### 9.2 为什么使用 `is_managed` 标志位?

- **保留历史**: 解除管理不删除数据,方便重新添加
- **审计追溯**: 可以查看账号的历史管理状态
- **灵活性**: 可以随时重新管理账号,无需重新获取数据

### 9.3 为什么 `is_online` 不存数据库?

- **实时性**: 在线状态需要实时计算,存数据库会有延迟
- **简化逻辑**: 不需要维护在线/离线状态的更新
- **准确性**: 每次查询都是最新状态

## 十、性能优化

### 10.1 批量处理

后台协程使用批量处理:
- 批量大小: 10 条
- 批量超时: 5 秒
- 减少数据库事务次数

### 10.2 索引优化

```sql
CREATE INDEX IF NOT EXISTS idx_accounts_is_managed
ON managed_twitter_accounts(is_managed);
```

### 10.3 Channel 容量

```rust
let (tx, rx) = mpsc::channel::<AccountSyncMessage>(100);
```

---

**文档状态**: 设计完成,待实现
