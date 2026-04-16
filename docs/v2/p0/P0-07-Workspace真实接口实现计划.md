# P0-07-Workspace 真实接口实现计划

> **文档状态：已完成** ✅
> - 完成日期：2026-04-16
> - 实现位置：[src-tauri/src/commands/workspace.rs](../../../src-tauri/src/commands/workspace.rs)
> - 存储服务：[src-tauri/src/services/storage.rs](../../../src-tauri/src/services/storage.rs)

## 文档信息

- 版本：v1.0
- 创建日期：2026-04-16
- 完成日期：2026-04-16
- 适用阶段：TweetPilot V2 / P0-07 真实接口实现
- 前置依赖：P0-06 已完成（Mock-first 架构 + Tauri 命令补齐）

---

## 1. 文档目标

本文档指导 Workspace 服务从 Mock 实现切换到真实的 Rust + JSON 持久化实现。

**核心目标**：
1. 实现真实的工作区配置持久化（`~/.tweetpilot/workspace.json`）
2. 实现最近工作区历史管理（`~/.tweetpilot/recent-workspaces.json`）
3. 保持前端 Service Interface 不变
4. 通过自动化测试验证实现正确性

---

## 2. 当前基线

### 2.1 已完成
- ✅ Workspace Service Interface 已定义（[src/services/workspace/types.ts](../../../src/services/workspace/types.ts)）
- ✅ Mock 实现可运行（[src/services/workspace/mock.ts](../../../src/services/workspace/mock.ts)）
- ✅ Tauri 命令骨架已就绪（[src-tauri/src/commands/workspace.rs](../../../src-tauri/src/commands/workspace.rs)）
- ✅ 前端已从 Mock 切换到 Tauri 模式
- ✅ 自动化测试覆盖（[src/services/workspace/tauri.test.ts](../../../src/services/workspace/tauri.test.ts)）

### 2.2 当前 Mock 实现行为

Mock 实现使用内存存储，提供以下能力：
- 选择本地目录（通过 Tauri 原生文件夹选择器）
- 设置/获取/清除当前工作区
- 管理最近工作区历史（最多 10 条）
- 从 GitHub 克隆（占位实现）

### 2.3 需要实现的真实能力

1. **持久化当前工作区**
   - 文件：`~/.tweetpilot/workspace.json`
   - 格式：`{ "currentWorkspace": "/path/to/workspace" }`

2. **持久化最近工作区历史**
   - 文件：`~/.tweetpilot/recent-workspaces.json`
   - 格式：`{ "workspaces": [{ "path": "...", "lastAccessed": "..." }] }`
   - 最多保留 10 条记录
   - 按 `lastAccessed` 降序排列

3. **从 GitHub 克隆**（可选，P0-07 可暂不实现）
   - 调用 `git clone` 命令
   - 克隆完成后自动设置为当前工作区

---

## 3. 接口契约（不可变）

### 3.1 TypeScript Service Interface

```typescript
export interface WorkspaceService {
  selectLocalDirectory(): Promise<string | null>
  cloneFromGithub(repoUrl: string, targetDir: string): Promise<string>
  getRecentWorkspaces(): Promise<WorkspaceHistory[]>
  setCurrentWorkspace(path: string): Promise<void>
  getCurrentWorkspace(): Promise<string | null>
  clearCurrentWorkspace(): Promise<void>
}

export interface WorkspaceHistory {
  path: string
  lastAccessed: string
}
```

### 3.2 Tauri Commands

```rust
#[tauri::command]
pub async fn select_local_directory(app: AppHandle) -> Result<Option<String>, String>

#[tauri::command]
pub async fn clone_from_github(repo_url: String, target_dir: String) -> Result<String, String>

#[tauri::command]
pub async fn get_recent_workspaces() -> Result<Vec<WorkspaceHistory>, String>

#[tauri::command]
pub async fn set_current_workspace(path: String) -> Result<(), String>

#[tauri::command]
pub async fn get_current_workspace() -> Result<Option<String>, String>

#[tauri::command]
pub async fn clear_current_workspace() -> Result<(), String>
```

---

## 4. 实现计划

### 阶段 1：基础持久化（核心）

**目标**：实现当前工作区和历史记录的 JSON 持久化。

#### 任务清单

1. **创建 Rust 数据结构**
   - 文件：[src-tauri/src/commands/workspace.rs](../../../src-tauri/src/commands/workspace.rs)
   - 定义 `WorkspaceConfig` 和 `WorkspaceHistory` 结构体
   - 实现 `Serialize` 和 `Deserialize`

2. **实现配置文件读写工具函数**
   - 函数：`read_workspace_config()` / `write_workspace_config()`
   - 函数：`read_recent_workspaces()` / `write_recent_workspaces()`
   - 路径：`~/.tweetpilot/workspace.json` 和 `~/.tweetpilot/recent-workspaces.json`
   - 错误处理：文件不存在时返回默认值，而非报错

3. **实现 `set_current_workspace` 命令**
   - 保存当前工作区到 `workspace.json`
   - 更新最近工作区历史（去重 + 更新时间戳 + 限制 10 条）
   - 原子写入（写临时文件 → 重命名）

4. **实现 `get_current_workspace` 命令**
   - 从 `workspace.json` 读取当前工作区
   - 返回 `Option<String>`

5. **实现 `clear_current_workspace` 命令**
   - 清空 `workspace.json` 中的 `currentWorkspace` 字段
   - 保留文件结构

6. **实现 `get_recent_workspaces` 命令**
   - 从 `recent-workspaces.json` 读取历史记录
   - 按 `lastAccessed` 降序返回

#### 验收标准

- [ ] `npm run build` 通过
- [ ] 自动化测试通过（`npm test`）
- [ ] 手动测试：选择工作区 → 重启应用 → 工作区保持
- [ ] 手动测试：选择多个工作区 → 历史记录正确显示（最多 10 条）
- [ ] 手动测试：清除工作区 → 重启应用 → 显示工作区选择器

---

### 阶段 2：GitHub 克隆（可选）

**目标**：实现从 GitHub 克隆仓库作为工作区。

#### 任务清单

1. **实现 `clone_from_github` 命令**
   - 验证 `repo_url` 格式（https://github.com/... 或 git@github.com:...）
   - 验证 `target_dir` 不存在或为空目录
   - 调用 `git clone` 命令（使用 `std::process::Command`）
   - 克隆成功后调用 `set_current_workspace` 设置为当前工作区
   - 返回克隆后的目录路径

2. **前端 `workspace/tauri.ts` 移除占位抛错**
   - 删除 `cloneFromGithub` 中的 `throw new Error('not available yet')`
   - 改为真实调用 `tauriInvoke('clone_from_github', { repoUrl, targetDir })`

#### 验收标准

- [ ] 克隆公开仓库成功
- [ ] 克隆失败时返回清晰错误信息（如：仓库不存在、网络错误、目录已存在）
- [ ] 克隆成功后自动设置为当前工作区
- [ ] 克隆成功后出现在最近工作区历史中

---

## 5. 数据结构设计

### 5.1 workspace.json

```json
{
  "currentWorkspace": "/Users/username/projects/my-workspace"
}
```

### 5.2 recent-workspaces.json

```json
{
  "workspaces": [
    {
      "path": "/Users/username/projects/workspace-1",
      "lastAccessed": "2026-04-16T14:30:00Z"
    },
    {
      "path": "/Users/username/projects/workspace-2",
      "lastAccessed": "2026-04-15T10:20:00Z"
    }
  ]
}
```

**约束**：
- `workspaces` 数组最多 10 条记录
- 按 `lastAccessed` 降序排列
- 同一 `path` 只保留一条记录（去重）

---

## 6. 错误处理策略

### 6.1 文件不存在
- **行为**：返回默认值（空配置），不报错
- **原因**：首次启动时配置文件不存在是正常情况

### 6.2 文件格式错误
- **行为**：记录警告日志，返回默认值
- **原因**：用户可能手动编辑了配置文件

### 6.3 文件写入失败
- **行为**：返回错误给前端，显示错误提示
- **原因**：磁盘空间不足、权限问题等需要用户介入

### 6.4 Git 克隆失败
- **行为**：返回错误信息（包含 git 命令输出）
- **原因**：网络问题、仓库不存在、认证失败等

---

## 7. 测试策略

### 7.1 单元测试（Rust）

在 [src-tauri/src/commands/workspace.rs](../../../src-tauri/src/commands/workspace.rs) 中添加：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_workspace_config_serialization() {
        // 测试 JSON 序列化/反序列化
    }

    #[test]
    fn test_recent_workspaces_deduplication() {
        // 测试历史记录去重逻辑
    }

    #[test]
    fn test_recent_workspaces_limit() {
        // 测试历史记录最多 10 条
    }
}
```

### 7.2 集成测试（TypeScript）

现有测试文件：[src/services/workspace/tauri.test.ts](../../../src/services/workspace/tauri.test.ts)

需要验证：
- 设置工作区后可以读取
- 清除工作区后返回 null
- 最近工作区历史正确更新

### 7.3 手动测试清单

- [ ] 首次启动：显示工作区选择器
- [ ] 选择工作区：进入主界面
- [ ] 重启应用：自动加载上次工作区
- [ ] 选择多个工作区：历史记录正确显示
- [ ] 清除工作区：下次启动显示选择器
- [ ] 克隆 GitHub 仓库：成功克隆并设置为当前工作区

---

## 8. 实现顺序

1. **阶段 1.1**：创建数据结构和文件读写工具函数
2. **阶段 1.2**：实现 `set_current_workspace` 和 `get_current_workspace`
3. **阶段 1.3**：实现 `clear_current_workspace`
4. **阶段 1.4**：实现 `get_recent_workspaces` 和历史记录管理
5. **阶段 1.5**：运行测试并修复问题
6. **阶段 2**（可选）：实现 GitHub 克隆功能

---

## 9. 风险与约束

### 9.1 跨平台路径处理
- **风险**：Windows/macOS/Linux 路径格式不同
- **缓解**：使用 Rust 的 `std::path::PathBuf` 处理路径

### 9.2 并发写入
- **风险**：多个 Tauri 窗口同时写入配置文件
- **缓解**：使用原子写入（写临时文件 → 重命名）

### 9.3 配置文件损坏
- **风险**：用户手动编辑配置文件导致格式错误
- **缓解**：解析失败时返回默认值，不阻塞应用启动

### 9.4 Git 命令依赖
- **风险**：用户系统未安装 Git
- **缓解**：克隆前检查 `git` 命令是否可用，返回清晰错误信息

---

## 10. 完成标准

> **文档状态：已完成** ✅
> - 完成日期：2026-04-16
> - 所有阶段 1 任务已完成
> - 阶段 2（GitHub 克隆）已实现占位版本

### 10.1 功能完整性
- [x] 当前工作区持久化（`~/.tweetpilot/config.json`）
- [x] 最近工作区历史管理（`~/.tweetpilot/recent-workspaces.json`）
- [x] GitHub 克隆（占位实现，返回 `/tmp/tweetpilot/{repo_name}`）

### 10.2 质量标准
- [x] 所有自动化测试通过（2/2 tests passed）
- [x] 构建通过（`npm run build` 成功）
- [x] 无编译警告
- [x] 错误处理完善（使用 `Result<T, String>`）

### 10.3 实现细节
- [x] 使用 `storage::read_json` / `storage::write_json` 进行持久化
- [x] 原子写入（写临时文件 → 重命名）
- [x] 历史记录去重 + 限制 10 条 + 按时间排序
- [x] 文件不存在时返回默认值（不报错）

### 10.4 验证结果
- [x] 配置文件已创建：`~/.tweetpilot/config.json`
- [x] 历史记录已创建：`~/.tweetpilot/recent-workspaces.json`
- [x] 当前工作区：`/Users/hyperorchid/aiwithblockchain/microcompany`
- [x] 历史记录包含 2 个工作区，按时间排序

---

## 11. 下一步

完成 Workspace 服务真实实现后，按以下顺序实现其他服务：

1. **Settings 服务**（简单，类似 Workspace）
2. **Account 服务**（中等复杂度，涉及 LocalBridge 通信）
3. **Task 服务**（复杂，涉及脚本执行和调度）
4. **DataBlocks 服务**（复杂，涉及数据聚合）

---

最后更新：2026-04-16
