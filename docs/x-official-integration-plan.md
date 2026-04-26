# TweetPilot 接入 X 官方 MCP / API 设计方案

## 1. 文档目标

本文档定义 TweetPilot 如何基于 X 官方方案，为产品提供稳定、可扩展的 X / Twitter 读写能力。

本文档回答的不是“xmcp 能不能跑”，而是以下工程问题：

1. 在 TweetPilot 当前代码结构下，如何接入 X 官方能力
2. 脚本系统如何通过官方方案读写 X
3. AI 系统如何通过官方 MCP 读写 X
4. 应该如何划分能力边界、认证边界和部署边界
5. 第一阶段应该先落地哪些能力，避免过度设计

本文档是一个**正式设计方案**，目标是指导后续实现与文档改造，而不是描述单次实验。

---

## 2. 背景与问题定义

### 2.1 当前现状

TweetPilot 当前围绕 X / Twitter 能力的产品与实现，主要建立在 **LocalBridge** 之上。

从现有文档与代码可确认：

- `docs/localbridge-and-development-strategy.md` 将 LocalBridge 定义为当前能力源
- `resources/tweetpilot-home/skill.md` 也默认把 LocalBridge 作为 X 能力入口
- `src-tauri/src/services/localbridge.rs` 提供了对 LocalBridge REST API 的 Rust 客户端封装
- `src-tauri/src/commands/preferences.rs` 当前只维护 LocalBridge 的配置与连通性检测
- `src-tauri/src/task_executor.rs` 负责执行 Python 脚本，并默认向脚本注入 ClawBot 的 `PYTHONPATH`

这套体系说明：

- 当前产品已经具备 X 自动化任务的执行框架
- 但当前 X 能力的底层来源仍偏向 LocalBridge
- 如果要切换到 X 官方方案，重点不是推倒执行框架，而是重构“X 能力接入层”

### 2.2 新目标

本次目标不是继续扩展 LocalBridge，而是让 TweetPilot 能通过 **X 官方方案** 提供读写能力。

具体目标分成两类：

1. **脚本模式**
   - 用户在 TweetPilot 中编写 Python 脚本
   - 脚本通过 X 官方方案读取、搜索、发帖及执行有限写操作

2. **AI 模式**
   - TweetPilot 内置 AI 可以通过官方 MCP 工具调用 X
   - AI 在受控权限范围内完成搜索、用户查询、发帖等动作

### 2.3 本文档关注的范围

本文档只讨论：

- 如何通过 X 官方方案为 TweetPilot 提供读写能力
- 如何在当前架构下组织脚本与 AI 的调用路径
- 如何定义第一阶段范围与后续工程化方向

本文档**不讨论**：

- LocalBridge 与官方方案并行切换策略
- 生产级无头 OAuth 自动化实现细节
- 所有 200+ X API 工具的全面接入设计

---

## 3. 官方方案确认

基于 X 官方文档、MCP 页面与 `skill.md`，可以确认以下事实。

### 3.1 官方提供两个相关 MCP 能力

#### 3.1.1 XMCP

官方提供本地运行的 XMCP 服务，用于把 X API endpoint 转换为 MCP tools。

关键特征：

- 默认本地地址：`http://127.0.0.1:8000/mcp`
- 启动时读取 OpenAPI 规范：`https://api.x.com/2/openapi.json`
- 自动将 operation 转为 MCP tools
- 支持 `X_API_TOOL_ALLOWLIST` 控制暴露的工具集合
- 面向任意 MCP 客户端，包括自定义 agent

#### 3.1.2 Docs MCP

官方同时提供文档检索 MCP 服务：`https://docs.x.com/mcp`

关键特征：

- 用于搜索和读取 X 文档
- 不是执行 X API 的服务
- 适合给 AI 提供“查文档再决策”的能力

### 3.2 X API 本身支持多种认证方式

`skill.md` 明确列出了：

- Bearer Token：适用于只读公共数据
- OAuth 1.0a：适用于用户上下文读写操作
- OAuth 2.0：更现代的用户上下文授权方式
- Basic Auth：企业场景

### 3.3 官方 XMCP 当前实现形态的重要限制

官方资料与本地 `xmcp` 代码一致确认了以下限制：

- 不支持 stream / webhook endpoint
- OpenAPI spec 在启动时拉取，更新后需重启服务
- OAuth token 只保存在内存中，不随服务重启持久化
- 当前官方 XMCP 落地形态以 OAuth 1.0a + 浏览器授权为主

这些限制决定了：

- XMCP 适合本地开发、人工操作或受控桌面环境
- 不适合作为“无需人工介入即可无限期运行”的最终形态
- 如果后续要进入长期无人值守运行阶段，需要做额外工程化改造

---

## 4. 对当前 TweetPilot 架构的影响判断

### 4.1 不需要重写任务执行框架

`src-tauri/src/task_executor.rs` 当前已经具备：

- Python 脚本执行能力
- 工作目录解析
- 超时机制
- 统一 stdout / stderr 采集
- `PYTHONPATH` 注入能力

这意味着：

> 对官方 X 接入来说，任务执行器不是瓶颈。

真正需要重构的是：

- Python 脚本可访问的 X 能力层
- 资源安装与环境注入逻辑
- 文档与 AI 约束

### 4.2 需要新增独立于 LocalBridge 的配置与状态层

当前 `src-tauri/src/commands/preferences.rs` 只管理 LocalBridge 配置：

- endpoint
- timeout_ms
- sync_interval_ms

如果接入 XMCP / X 官方 API，就不能继续把它塞进 LocalBridge 配置中。

需要新增独立配置，例如：

- X provider 类型
- XMCP URL
- Docs MCP URL
- 官方 API 认证模式
- AI 是否允许写操作
- 第一阶段开放的 tool allowlist

### 4.3 AI 系统当前没有正式的 MCP 接入层

从 `src-tauri/src/commands/ai.rs` 可见，当前 AI 已具备：

- provider / model 配置
- system prompt 构建
- 会话初始化与消息发送

但没有看见一个正式的：

- MCP server 连接层
- tool 调用调度层
- MCP tool allowlist 控制层

因此，如果要让 AI 直接通过官方 XMCP 读写 X，必须新增这一层能力。

### 4.4 当前文档和 skill 约束需要更新

`resources/tweetpilot-home/skill.md` 当前仍将 LocalBridge 明确写为能力源。

如果官方方案落地，这份约束文档将不再准确，因为它会持续把 AI 和脚本引回旧路径。

因此，X 官方方案接入不是单纯的“新增服务地址”，而是一次：

- 能力源抽象升级
- 文档边界升级
- AI 约束升级

---

## 5. 设计目标

本方案的设计目标如下。

### 5.1 主目标

让 TweetPilot 通过 X 官方方案完成：

- 读取用户资料
- 根据用户名查用户
- 查询推文
- 搜索近期推文
- 创建推文

### 5.2 架构目标

- 不破坏现有任务执行框架
- 不把官方方案硬编码进 LocalBridge 模块
- 脚本模式和 AI 模式共享同一套官方能力边界
- 后续允许继续扩展，但第一阶段不做过量抽象

### 5.3 约束目标

- 限制第一阶段可用能力范围
- 限制 AI 写操作默认权限
- 保持读路径和写路径清晰可控
- 明确官方 XMCP 的启动与运行限制

---

## 6. 核心设计原则

### 6.1 把 X 官方能力视为独立 provider，而不是 LocalBridge 的一个分支

TweetPilot 需要从“单一能力源”升级为“可配置 provider”。

推荐的 provider 概念至少包括：

- `localbridge`
- `x-official`

这样做的原因是：

- 代码边界更清晰
- 配置边界更清晰
- 文档边界更清晰
- 避免把所有官方逻辑塞进 LocalBridge 命名空间，造成长期混乱

### 6.2 XMCP 作为独立服务运行，不嵌入 Tauri 主进程

不建议把 `xmcp/server.py` 内嵌到主应用流程中。

推荐方式：

- XMCP 独立运行
- TweetPilot 通过客户端方式连接其 MCP endpoint

原因：

- 这与官方形态一致
- 认证生命周期独立
- 容易调试与排错
- 后续替换或升级不影响主应用进程

### 6.3 脚本模式和 AI 模式共用同一官方能力边界，但不强制共用同一调用协议

两类使用方式目标相同：都要读写 X。

但它们最适合的接入方式不同：

- **脚本模式** 更适合稳定函数接口
- **AI 模式** 更适合 MCP 工具接口

因此推荐：

- 脚本模式通过官方 Python API / SDK 封装层访问
- AI 模式通过 XMCP 访问

这两者共享：

- 官方认证边界
- 官方 endpoint 能力边界
- 产品层允许暴露的操作边界

但不要求脚本也直接通过 MCP 调用。

### 6.4 第一阶段只做最小闭环能力

避免一次性开放 200+ tools。

第一阶段只建议开放以下能力：

读操作：

- `getUsersMe`
- `getUsersByUsername`
- `getPostsById`
- `getUsersPosts`
- `searchPostsRecent`

写操作：

- `createPosts`

### 6.5 AI 写权限默认关闭

AI 可以在第一阶段拥有完整的读能力，但写能力不应默认打开。

推荐默认策略：

- `enable_ai_write = false`
- 如需开放写操作，必须通过显式设置开启
- 后续可增加 UI 提示、审计与确认机制

---

## 7. 推荐总体架构

### 7.1 架构概览

```text
TweetPilot
├─ 前端 React / Tauri UI
├─ src-tauri
│  ├─ Task Executor
│  ├─ AI Session
│  ├─ X Provider Config & Health Layer   (新增)
│  ├─ Official X AI MCP Integration      (新增)
│  └─ Resource Installer / Session Constraints
│
├─ Python Script Runtime
│  └─ Official X Python Wrapper Layer    (新增)
│
├─ XMCP                                  (独立服务)
│  └─ http://127.0.0.1:8000/mcp
│
└─ X Docs MCP                            (可选)
   └─ https://docs.x.com/mcp
```

### 7.2 两条主要调用链路

#### 7.2.1 脚本链路

```text
Python Script
  -> TweetPilot 提供的 Official X Python Wrapper
  -> X 官方 API / 官方 SDK
  -> X
```

#### 7.2.2 AI 链路

```text
AI Session
  -> TweetPilot MCP Client Layer
  -> XMCP
  -> X API
```

---

## 8. 方案细化：脚本模式

### 8.1 设计目标

让用户在 TweetPilot 中编写 Python 脚本时，不再只能依赖 ClawBot / LocalBridge，而是可以直接通过 TweetPilot 提供的官方 X 封装层访问 X。

### 8.2 推荐方式

新增一个由 TweetPilot 安装到用户环境中的 Python 包装层，例如：

- `~/.tweetpilot/xofficial/`
- 或 `~/.tweetpilot/python-packages/tweetpilot_x/`

对用户脚本暴露稳定接口，例如：

```python
from tweetpilot_x import XClient

client = XClient()

me = client.get_me()
user = client.get_user_by_username("xdevelopers")
posts = client.search_recent_posts("AI", max_results=10)
post = client.create_post("hello world")
```

### 8.3 为什么脚本模式不建议第一阶段直接走 MCP

虽然理论上也可以让 Python 脚本走 MCP，但第一阶段并不推荐。

原因：

1. Python 脚本更适合显式函数调用模型
2. 更容易封装异常、分页、参数校验
3. 更容易为最终用户提供稳定 API
4. 更适合结合官方 Python SDK 或原生 REST 调用
5. 不把脚本可用性绑定到 MCP 客户端库成熟度

因此，脚本模式推荐走：

- 官方 Python SDK
- 或最小 REST 封装层

而不是把 MCP 当作脚本层的唯一协议。

### 8.4 对当前 TaskExecutor 的影响

当前 `src-tauri/src/task_executor.rs` 会向 Python 注入：

- `~/.tweetpilot/clawbot`

后续建议调整为：

- 允许同时注入官方 X 包装层路径
- 或根据当前 provider 决定注入哪些路径

目标是让脚本可以直接：

```python
from tweetpilot_x import XClient
```

而不需要用户手工配置额外环境。

### 8.5 第一阶段脚本层能力清单

建议只提供以下稳定方法：

- `get_me()`
- `get_user_by_username(username)`
- `get_post(post_id)`
- `get_user_posts(user_id=None, username=None, max_results=...)`
- `search_recent_posts(query, max_results=...)`
- `create_post(text, reply_to_id=None, quote_post_id=None)`

### 8.6 脚本层认证建议

脚本模式应优先走一个更工程化的认证封装，而不是完全照搬 XMCP 的启动时浏览器授权逻辑。

原因：

- X API 本身支持 Bearer / OAuth 1.0a / OAuth 2.0
- `skill.md` 也明确 OAuth 2.0 是新项目更现代的方向
- 脚本层的目标是稳定可复用，不应被迫依附 MCP 当前的交互式授权形态

因此，脚本层建议单独封装认证读取与访问逻辑。

---

## 9. 方案细化：AI 模式

### 9.1 设计目标

让 TweetPilot 内置 AI 可以通过 X 官方 MCP 工具直接读取和在受控条件下写入 X。

### 9.2 推荐方式

新增一个 MCP Client Integration Layer，负责：

- 连接 XMCP
- 可选连接 X Docs MCP
- 获取工具列表
- 执行 tool call
- 将结果回传 AI 会话层
- 在工具执行前检查 allowlist 与写权限

### 9.3 为什么 AI 模式推荐走 XMCP

原因：

1. 官方已经明确支持通过 MCP 暴露 X API endpoint
2. AI 工具调用天然适合 MCP 这种“工具集合 + 参数”的模式
3. 若后续接入 Docs MCP，AI 还可以先查文档再执行 API
4. 这是与官方能力最一致的 agent-native 路径

### 9.4 AI 模式的推荐能力边界

#### 默认开放的读能力

- `getUsersMe`
- `getUsersByUsername`
- `getPostsById`
- `getUsersPosts`
- `searchPostsRecent`

#### 默认关闭的写能力

- `createPosts`
- `deletePosts`
- `likePost`
- `repostPost`

第一阶段只有在显式开启写权限时，才允许 `createPosts`。

### 9.5 AI 模式的 Docs MCP 使用建议

Docs MCP 不是必须，但值得作为增强能力接入。

适合场景：

- AI 不确定该用哪个 endpoint
- 需要查询字段、参数、扩展对象、认证说明
- 需要基于官方文档做更准确的 API 选择

因此，建议将 Docs MCP 作为“可选增强项”设计到架构中，而不是第一阶段强依赖。

### 9.6 AI 提示词与技能文档的改造需求

当前 `resources/tweetpilot-home/skill.md` 仍围绕 LocalBridge 构建。

当 provider = `x-official` 时，必须更新 AI 约束，使其：

- 不再默认把 LocalBridge 视为唯一能力源
- 知道脚本模式下可用 `tweetpilot_x`
- 知道 AI 模式下可用 XMCP / Docs MCP
- 明确官方模式的读写权限边界

---

## 10. 配置设计

### 10.1 新增 provider 配置概念

建议新增独立配置文件，例如：

- `x-provider-config.json`

参考结构：

```json
{
  "provider": "x-official",
  "official": {
    "xmcp_url": "http://127.0.0.1:8000/mcp",
    "docs_mcp_url": "https://docs.x.com/mcp",
    "api_base_url": "https://api.x.com/2",
    "auth_mode": "oauth1",
    "enable_ai_write": false,
    "tool_allowlist": [
      "getUsersMe",
      "getUsersByUsername",
      "getPostsById",
      "getUsersPosts",
      "searchPostsRecent",
      "createPosts"
    ]
  }
}
```

### 10.2 新增后端配置命令

建议在 Tauri 后端新增：

- `get_x_provider_config`
- `update_x_provider_config`
- `test_xmcp_connection`
- `get_x_integration_status`

### 10.3 集成状态返回建议

返回结构建议包括：

- 当前 provider
- XMCP 是否可达
- Docs MCP 是否可达
- 官方认证是否就绪
- AI 是否允许写入
- 当前开放的工具数量或 allowlist 摘要

---

## 11. 第一阶段实施范围

### 11.1 功能范围

第一阶段只落地以下闭环：

#### 脚本模式

- 查询当前账号信息
- 根据用户名查用户
- 查询单条推文
- 搜索近期推文
- 发推

#### AI 模式

- 查询当前账号信息
- 根据用户名查用户
- 查询单条推文
- 搜索近期推文
- 在显式开启写权限后允许发推

### 11.2 不在第一阶段范围内的能力

暂不建议纳入：

- 媒体上传完整流程
- DM
- Spaces
- Lists 全面管理
- Follow / block / mute 等高风险用户关系操作
- 全量工具自由开放
- 流式能力
- Webhook

---

## 12. 分阶段实施建议

### Phase 1：建立官方 provider 基础设施

目标：在架构层承认 X 官方能力源。

建议工作：

1. 新增 provider 概念
2. 新增官方 X 配置文件与后端读取命令
3. 新增 XMCP 连通性检测与状态展示
4. 明确前端设置中可切换或展示官方 provider 状态

### Phase 2：完成脚本模式官方接入

目标：让 Python 脚本可通过官方方案稳定读写 X。

建议工作：

1. 新增 `tweetpilot_x` Python 包装层
2. 在资源安装中安装该包装层
3. 在任务执行器中补充相应 `PYTHONPATH`
4. 提供最小读写 API

成功标准：

- 脚本可 `get_me`
- 脚本可 `search_recent_posts`
- 脚本可 `create_post`

### Phase 3：完成 AI 模式 XMCP 接入

目标：让 AI 能通过官方 MCP 访问 X。

建议工作：

1. 新增 MCP client integration layer
2. 连接 XMCP
3. 接入 tool allowlist 控制
4. 默认只开放读工具
5. 后续再按设置开启写工具

成功标准：

- AI 能读取官方 X 数据
- AI 能在受控前提下触发 `createPosts`

### Phase 4：更新文档与 AI 约束

目标：让产品文档与 AI 行为和新架构一致。

建议工作：

1. 更新 `resources/tweetpilot-home/skill.md`
2. 更新与 LocalBridge 强绑定的产品说明
3. 新增官方模式的使用文档
4. 明确脚本与 AI 两条路径的区别

### Phase 5：长期工程化改造

目标：解决 XMCP 当前官方实现带来的运行限制。

建议工作：

1. 处理 token 生命周期问题
2. 设计更稳定的启动与重启恢复策略
3. 增加更清晰的状态监控与错误提示
4. 视需要评估是否对官方 XMCP 做有限二次封装

---

## 13. 风险与限制

### 13.1 XMCP 当前适合桌面/人工值守环境，不适合直接视为最终生产形态

原因：

- OAuth 1.0a 浏览器授权
- token 只在内存中
- 服务重启后状态不保留

这意味着：

- 对 TweetPilot 桌面场景是可接受的第一阶段方案
- 对无人值守长期运行场景，需要后续专门设计

### 13.2 官方能力边界与 MCP 边界并不完全一致

X API 本身支持的能力范围，比 XMCP 第一阶段适合开放给产品的能力范围更大。

因此必须接受：

- 官方有 200+ tools，不等于产品要全部开放
- 第一阶段必须以 allowlist 为核心策略

### 13.3 脚本与 AI 不应共享一套“直接工具名 API”

虽然底层能力源相同，但脚本用户需要稳定函数接口，AI 需要工具接口。

如果强行共用一层“直接 tool name 调用”，会降低脚本体验并加大维护成本。

---

## 14. 推荐结论

基于当前 TweetPilot 代码结构与 X 官方方案的形态，推荐采用以下总体方案：

1. 将 X 官方能力定义为一个新的 provider：`x-official`
2. 将 XMCP 作为独立服务接入，不嵌入主应用进程
3. 将脚本模式设计为“官方 Python API / SDK 包装层”访问 X
4. 将 AI 模式设计为“通过 XMCP 的 MCP 工具访问 X”
5. 将 Docs MCP 作为后续增强项接入，而非第一阶段强依赖
6. 第一阶段只开放最小读写闭环，不开放全量工具
7. AI 写权限默认关闭，按配置显式开启
8. 后续再处理 token 生命周期、无头运行和长期工程化问题

---

## 15. 一句话总结

TweetPilot 接入 X 官方方案的正确方向不是把 `xmcp` 直接塞进现有 LocalBridge 体系，而是：

> **把 X 官方能力抽象为新的 provider；脚本层走稳定的官方 Python 封装，AI 层走 XMCP，二者共享统一的官方能力边界与权限边界。**
