# TweetPilot 项目 gstack 使用指南

## 文档目的

本文档说明如何在 TweetPilot 项目中使用 gstack 提升开发效率，而不是替代现有的开发流程。

## 核心原则

**gstack 不是用来替代你的任务卡和文档的。**

你的项目已经有：
- 清晰的 Slice 拆解
- 详细的任务卡
- 完整的测试要求
- 明确的验收标准

这些都很好，保留它们。

**gstack 的价值在于：让你能并行执行多个任务，并自动化质量把关。**

## 何时使用 gstack

### 阶段 1：单线程开发（当前阶段 - Slice 1-2）

**不需要 gstack 的并行能力。**

在这个阶段，你的重点是：
- 建立稳固的基础架构
- 验证技术选型
- 建立开发节奏

**推荐使用的 gstack 技能：**

#### 1. `/review` - 代码审查
每完成一个任务卡后运行：
```
/review
```

它会：
- 发现生产级 bug（不只是 lint 错误）
- 自动修复明显问题
- 标记需要人工决策的问题
- 检查测试覆盖率

**使用时机：**
- 完成 T2-01 后 → `/review`
- 完成 T2-02 后 → `/review`
- 完成整个 Slice 2 后 → `/review`

#### 2. `/ship` - 自动化发布
完成一个 Slice 后运行：
```
/ship
```

它会：
- 运行所有测试
- 检查覆盖率
- 创建 PR
- 更新文档（通过 `/document-release`）

**使用时机：**
- Slice 2 完成后 → `/ship`
- 每个 Slice 完成后 → `/ship`

### 阶段 2：并行开发（Slice 3-5）

**开始使用 gstack 的并行能力。**

到 Slice 3-5 时，你会遇到可以并行开发的模块：
- Reply Agent（Slice 3）
- 风险分流（Slice 4）
- 执行通道（Slice 5）

**推荐工作流：**

#### 使用 Conductor 并行开发

安装 [Conductor](https://conductor.build)，然后：

```
实例 1: 实现 Slice 3 的 T3-01
实例 2: 实现 Slice 3 的 T3-02
实例 3: 为 Slice 2 补充集成测试
实例 4: 准备 Slice 4 的设计原型
```

每个实例完成后自动运行 `/review`。

#### 3. `/qa` - 端到端测试
整个 Slice 完成后运行：
```
/qa http://localhost:你的端口
```

它会：
- 打开真实浏览器
- 点击 UI 测试流程
- 自动发现 bug 并修复
- 生成回归测试

**使用时机：**
- Slice 3 完成后（Reply Agent 可用）
- Slice 5 完成后（执行通道打通）

### 阶段 3：高级使用（Slice 6-8）

**使用 gstack 的高级技能。**

#### 4. `/office-hours` - 产品审视
在开始一个复杂 Slice 前运行：
```
/office-hours
```

它会：
- 用 6 个强制性问题挑战你的设计
- 找出隐藏的技术风险
- 提出更简单的实现路径

**使用时机：**
- 开始 Slice 6（报表）前
- 开始 Slice 8（扩展能力）前

#### 5. `/autoplan` - 自动化规划
对于复杂的任务卡，可以用 `/autoplan` 生成实现计划：
```
/autoplan
```

它会自动运行：
- CEO review（挑战需求）
- Design review（UI/UX 审查）
- Eng review（技术架构审查）

**使用时机：**
- 遇到复杂的、没有明确任务卡的需求时
- 需要快速验证一个想法的可行性时

#### 6. `/cso` - 安全审计
在关键 Slice 完成后运行：
```
/cso
```

它会：
- 运行 OWASP Top 10 检查
- 运行 STRIDE 威胁模型
- 给出具体的漏洞利用场景

**使用时机：**
- Slice 5 完成后（执行通道涉及安全）
- Slice 8 完成后（扩展能力涉及沙箱）

## 不要使用 gstack 做什么

### ❌ 不要用 gstack 替代你的任务卡

你的任务卡写得很好：
- 明确的目标
- 清晰的边界
- 详细的验收标准

gstack 的 `/autoplan` 不会比你的任务卡更好。

### ❌ 不要在早期阶段使用并行开发

在 Slice 1-2 阶段，不要急于使用 Conductor 并行开发。

原因：
- 基础架构还不稳定
- 并行开发会增加集成成本
- 你需要建立开发节奏

### ❌ 不要过度依赖 AI 生成的代码

gstack 生成的代码需要你审查：
- 是否符合项目架构约束
- 是否符合你的编码风格
- 是否有安全问题

## 推荐的工作流

### 单个任务卡的工作流

```
1. 阅读任务卡（手动）
2. 实现代码（手动或 AI 辅助）
3. 运行 /review（gstack）
4. 修复问题（手动）
5. 运行测试（手动）
6. 提交代码（手动）
```

### 单个 Slice 的工作流

```
1. 完成所有任务卡
2. 运行 /review（gstack）
3. 运行 /qa（gstack，如果有 UI）
4. 运行 /ship（gstack）
5. 更新进展跟踪文档（手动）
```

### 并行开发的工作流（Slice 3+）

```
1. 识别可并行的任务卡
2. 启动多个 Conductor 实例
3. 每个实例完成后运行 /review
4. 集成所有代码
5. 运行 /qa 测试整体
6. 运行 /ship 创建 PR
```

## 每个 Slice 的 gstack 使用建议

| Slice | 推荐使用的 gstack 技能 | 原因 |
|-------|----------------------|------|
| Slice 1 | `/review`, `/ship` | 基础架构，重点是代码质量 |
| Slice 2 | `/review`, `/ship` | 数据层，重点是测试覆盖 |
| Slice 3 | `/review`, `/qa`, `/ship` | Reply Agent，需要端到端测试 |
| Slice 4 | `/review`, `/qa`, `/ship` | 风险分流，需要 UI 测试 |
| Slice 5 | `/review`, `/qa`, `/cso`, `/ship` | 执行通道，需要安全审计 |
| Slice 6 | `/office-hours`, `/review`, `/qa`, `/ship` | 报表，需要产品审视 |
| Slice 7 | `/review`, `/cso`, `/ship` | 官方通道，需要安全审计 |
| Slice 8 | `/office-hours`, `/review`, `/cso`, `/ship` | 扩展能力，需要架构审视 |

## 常见问题

### Q: 我应该在什么时候开始使用 Conductor 并行开发？

A: 在 Slice 3 开始时。此时基础架构已稳定，可以并行开发 Reply Agent 的不同模块。

### Q: `/review` 和手动 code review 有什么区别？

A: `/review` 会发现生产级 bug（竞态条件、内存泄漏等），而不只是代码风格问题。它是手动 review 的补充，不是替代。

### Q: 我应该相信 gstack 生成的代码吗？

A: 不要盲目相信。gstack 生成的代码需要你审查，确保符合项目架构约束和编码规范。

### Q: `/qa` 能测试 Electron 应用吗？

A: 能。`/qa` 使用真实的 Chromium 浏览器，可以测试 Electron 应用的 UI。

## 下一步

完成当前任务后，问我：

> "T2-XX 已完成，下一步如何使用 gstack？"

我会根据你的进度给出具体建议。

## 参考资源

- [gstack 官方文档](https://github.com/garrytan/gstack)
- [Conductor 官方网站](https://conductor.build)
- [gstack 技能详解](~/.claude/skills/gstack/docs/skills.md)




Viewed CLAUDE.md:1-12
Listed directory TweetPilot
Viewed GSTACK_GUIDE.md:1-261

是的，我理解这个文件以及其中定义的命令。

`CLAUDE.md` 文件在这里被用作 **gstack**（一个基于 Claude 的自动化工作流框架）的配置和技能声明文件。它定义了开发流程中可以调用的自动化“技能”（Skills）。

以下是我对这些命令和配置的理解：

### 1. 核心指令
*   **浏览工具配置**：明确要求使用 `/browse` 技能进行联网搜索，严禁使用 `mcp__claude-in-chrome__*` 相关的工具。这确保了联网操作的一致性和可控性。

### 2. 常用技能（Slash Commands）
根据项目中的 `GSTACK_GUIDE.md` 说明，这些命令代表了不同的自动化工作流：

*   **`/review` (代码审查)**：自动检查代码逻辑漏洞、性能问题和测试覆盖率，而不只是基础的格式检查。
*   **`/ship` (自动化发布)**：完成一个阶段（Slice）后的全流程自动化：运行测试 -> 检查覆盖率 -> 创建 PR -> 更新文档。
*   **`/qa` (端到端测试)**：调用真实浏览器（Playwright/Chromium）进行 UI 自动化测试，并自动发现和修复 Bug。
*   **`/office-hours` (产品审视)**：在复杂任务开始前，从产品和设计的角度挑战当前方案，寻找更简洁的实现路径。
*   **`/autoplan` (自动化规划)**：自动执行 CEO、工程、设计三方审查，为复杂任务生成详细的实现计划。
*   **`/cso` (安全审计)**：进行安全风险扫描，包括 OWASP Top 10 和危害建模。

### 3. 项目上下文
*   **项目定位**：TweetPilot 是一个 Twitter/X 的自动化管理工具。
*   **使用节奏**：
    *   **早期 (Slice 1-2)**：重点使用 `/review` 和 `/ship` 保证基础代码稳固。
    *   **中期 (Slice 3-5)**：引入 `/qa` 进行 UI 测试。
    *   **后期 (Slice 6-8)**：使用 `/office-hours` 和 `/cso` 处理复杂逻辑和安全性。

**总结：**
这些命令是你的“AI 助手快捷键”。你可以通过输入这些指令来触发具体的自动化任务，而不是每次都手动下达复杂的指令。

**你需要我现在执行其中的某项指令（如对当前代码进行 `/review`），或者针对某个 Slice 进行规划吗？**