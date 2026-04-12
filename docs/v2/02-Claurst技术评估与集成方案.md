# TweetPilot V2 - Claurst 技术评估与集成方案

## 文档信息
- 版本：v2.0.0
- 创建日期：2026-04-12
- 文档状态：初稿
- 负责人：技术架构团队

## 1. Claurst 能力清单

### 1.1 核心功能

**Agent 系统**：
- **命名 Agent 系统**：内置 3 个 Agent（build、plan、explore），支持自定义 Agent
- **Coordinator 模式**：Manager-Executor 关系，支持并行 Worker Agent
- **会话管理**：每个 Agent 有独立的长期会话，积累经验
- **权限控制**：5 个权限级别（None、ReadOnly、Write、Execute、Dangerous）

**MCP（Model Context Protocol）支持**：
- 完整的 MCP 客户端实现
- 支持 stdio 和 HTTP/SSE 两种传输方式
- 自动发现和包装 MCP 工具
- 支持环境变量展开
- 自动重连机制（指数退避）

**多模型支持**：
- 支持 30+ AI 提供商（Anthropic、OpenAI、Google、GitHub Copilot、Ollama、DeepSeek、Groq、Mistral 等）
- 支持按任务切换模型
- 支持按角色切换模型

**工具系统**：
- 40+ 内置工具（文件操作、Shell 执行、搜索、Web、任务管理等）
- 工具并发执行
- 工具权限管理

### 1.2 新特性（重点）

**Managed Agents（实验性功能）**：
- **Manager-Executor 模式**：Manager 负责任务分解和协调，Executor 负责具体执行
- **性能优化**：Manager 使用大模型（Opus），Executor 使用小模型（Haiku），成本降低到原来的几分之一
- **6 个预建模板**：可以直接使用或自定义
- **命令**：`/managed-agents`

**Multi-Provider Support**：
- 支持 30+ AI 提供商
- 命令：`/connect` 连接到任意 AI 提供商
- 可以为不同任务配置不同模型
- 成本优化：根据任务复杂度选择合适的模型

**Speech Modes**：
- `/rocky`、`/caveman`、`/normal` 等语音模式
- 可以听到不同的语音风格

### 1.3 技术特性

**技术栈**：
- Rust 编写，性能高，内存安全
- 版本：0.0.9（早期版本）
- 许可证：GPL-3.0（强 Copyleft）

**部署方式**：
- 跨平台：macOS、Windows、Linux
- 单一二进制文件，无依赖
- 支持 headless 模式

### 1.4 限制和约束

**许可证限制**：
- GPL-3.0：如果修改 Claurst 源码，衍生作品必须开源
- 缓解：通过进程隔离使用，不修改源码

**版本稳定性**：
- 版本 0.0.9，早期版本，可能不稳定
- 缓解：锁定版本，关键功能有 fallback

**语言差异**：
- Claurst 是 Rust，TweetPilot 是 TypeScript
- 需要跨语言集成

## 2. Claurst 与 TweetPilot 的匹配度分析

### 2.1 可以直接使用 Claurst 的功能

| 功能 | Claurst 能力 | TweetPilot 需求 | 匹配度 |
|------|-------------|----------------|--------|
| **Agent 编排** | Coordinator 模式，Manager-Executor | Reply Agent、Content Agent、Growth Agent | ✅ 高度匹配 |
| **会话管理** | 长期会话，积累经验 | 角色实例需要积累经验 | ✅ 高度匹配 |
| **多模型支持** | 30+ 提供商 | 不同任务使用不同模型 | ✅ 高度匹配 |
| **MCP 协议** | 完整的 MCP 客户端 | 需要扩展 Twitter、知识库、数据访问能力 | ✅ 高度匹配 |

### 2.2 需要通过 MCP 扩展的功能

| 功能 | 实现方式 | 优先级 |
|------|---------|--------|
| **Twitter 操作** | 开发 Twitter MCP 服务器，封装 LocalBridge 能力 | P0 |
| **知识库访问** | 开发知识库 MCP 服务器，提供产品专属知识 | P1 |
| **数据访问** | 开发数据访问 MCP 服务器，提供历史数据查询 | P1 |

### 2.3 需要自己开发的功能

| 功能 | 原因 | 优先级 |
|------|------|--------|
| **LocalBridge 驱动** | Claurst 不提供 Twitter 操作能力 | P0 |
| **产品管理** | Claurst 不提供产品中心化能力 | P0 |
| **任务管理** | Claurst 不提供任务编排能力 | P0 |
| **UI 界面** | Claurst 是 TUI，需要 Web UI | P0 |
| **数据存储** | Claurst 不提供数据持久化能力 | P0 |

## 3. 集成方案设计

### 3.0 核心架构决策

在深入集成方案之前,我们需要明确三个关键架构决策:

#### 决策 1: 单 Claurst 进程模式（借鉴 VS Code Extension Host 架构）

**采用 Extension Host 模式**（类似 VS Code 管理所有扩展）:
- 一个 TweetPilot 实例 = 一个产品 = 一个 Claurst Host 进程
- Claurst Coordinator Mode 内部管理所有 Worker Agent
- **不需要 Claurst 进程池**

**VS Code Extension Host 架构对比**:

| 维度 | VS Code | TweetPilot |
|------|---------|-----------|
| **Host 进程** | Extension Host | Claurst Host (Coordinator Mode) |
| **管理对象** | Extensions | Worker Agents (Reply, Content, Growth) |
| **通信方式** | IPC (stdin/stdout + JSON) | IPC (stdin/stdout + JSON) |
| **共享资源** | VS Code API | MCP Servers (Twitter, 知识库, 数据) |
| **进程隔离** | Extension 崩溃不影响主进程 | Worker 崩溃不影响 TweetPilot |
| **多实例** | 多个 Workspace = 多个 Extension Host | 多个产品 = 多个 Claurst Host |

**理由**:
- ✅ **单一 Host 进程管理所有 Worker**：Claurst Coordinator 就像 VS Code Extension Host，统一管理所有 Agent Worker
- ✅ **IPC 通信机制**：通过 stdin/stdout + JSON 进行进程间通信，与 VS Code Extension Host 相同
- ✅ **资源共享**：所有 Worker 共享 MCP Servers，就像 Extensions 共享 VS Code API
- ✅ **进程隔离**：Worker 崩溃不影响 TweetPilot 主进程，保证稳定性
- ✅ **符合产品中心化理念**：一个产品对应一个 Claurst Host，类似一个 Workspace 对应一个 Extension Host
- ✅ **简化架构**：不需要复杂的进程池管理，Coordinator 内部自动管理

**如果用户需要管理多个产品**: 打开多个 TweetPilot 窗口,每个窗口管理一个产品,操作系统级别的进程隔离（类似 VS Code 打开多个 Workspace）。

#### 决策 2: 使用 Claurst 二进制 + MCP 扩展

**不 Fork Claurst 源码,通过 MCP 协议扩展所有能力**:

**理由**:
- ✅ **避免 GPL-3.0 传染**: 不修改 Claurst 源码,TweetPilot 可以保持私有
- ✅ **MCP 协议足够强大**: 可以实现任何自定义能力,包括 Twitter 特定操作
- ✅ **升级简单**: Claurst 发布新版本,直接替换二进制即可
- ✅ **维护成本低**: 不需要维护 fork,不需要合并上游更新
- ✅ **社区支持**: 享受 Claurst 社区的 bug 修复和新特性

**MCP 协议的强大之处**:
```typescript
// Claurst 的 Agent 不需要知道这是 Twitter 操作
// 它只是调用 MCP 工具

// Twitter MCP Server 可以提供任何 Twitter 能力:
- twitter_get_tweet
- twitter_send_tweet
- twitter_reply_comment
- twitter_drive_browser (驱动 LocalBridge)
- twitter_execute_script (执行自定义脚本)
- twitter_get_analytics (获取分析数据)
// ... 任何你能想到的 Twitter 操作
```

**唯一需要 Fork 的情况**: Claurst 核心有严重 bug 且上游不修复（概率很低）

#### 决策 3: LocalBridge REST API 架构与 MCP 集成路径

**LocalBridge 是独立的 REST API 服务程序**:

LocalBridge 通过 REST API 对外提供服务，我们有三种集成路径：

**当前架构（P0）**：直接调用 LocalBridge REST API
```
Claurst Agent
  ↓
Twitter MCP Server (Node.js 进程)
  ↓ HTTP 请求
LocalBridge REST API 服务 (独立程序)
  ↓
Browser Extension → Twitter
```

**可选路径 1（P1）**：LocalBridge MCP 协议转换
```
Claurst Agent
  ↓ MCP 协议
LocalBridge MCP Server (封装 LocalBridge REST API)
  ↓ HTTP 请求
LocalBridge REST API 服务
  ↓
Browser Extension → Twitter
```

**可选路径 2（P2）**：使用 X 官方 API（按使用量计费）
```
Claurst Agent
  ↓ MCP 协议
X API MCP Server (封装 X 官方 API)
  ↓ X API (按使用量计费)
X 官方 API
```

**架构灵活性设计**:
- **当前状态**：LocalBridge 是 REST API 服务，已开发完成
- **P1 工作**：可选开发 LocalBridge MCP 协议转换层，统一接口
- **P2 工作**：支持切换到 X 官方 API（按使用量计费）
- **设计原则**：通过接口抽象，支持多种 Twitter 数据源切换

**优势**:
- LocalBridge REST API 服务独立运行，不需要修改
- 当前可直接通过 HTTP 调用 LocalBridge
- 未来可选择 MCP 协议统一接口
- 支持切换到 Twitter 官方 MCP 服务（当可用时）或社区 MCP 服务
- 架构灵活，适应不同集成需求

---

### 3.1 集成架构图（Extension Host 模式 + REST API）

```
┌─────────────────────────────────────────────────────────────────┐
│                      TweetPilot 主进程                           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐         │
│  │  Web UI     │  │  API Gateway │  │  产品管理       │         │
│  │  (React)    │  │  (Express)   │  │  任务管理       │         │
│  └─────────────┘  └──────────────┘  └────────────────┘         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Claurst Host Manager（进程管理器）                │  │
│  │  - 启动/停止 Claurst Host 进程                            │  │
│  │  - 通过 stdin/stdout + JSON 进行 IPC 通信                │  │
│  │  - 监控进程健康状态                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         ↕ IPC (stdin/stdout + JSON)             │
└─────────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────────┐
│              Claurst Host 进程（Extension Host 模式）            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │        Claurst Coordinator (Opus) - Host Manager         │  │
│  │  - 任务分解和协调                                         │  │
│  │  - 管理所有 Worker Agent（类似 Extension Host）          │  │
│  │  - 调用 MCP 工具                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         ↓                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Worker Agent 池（类似 Extensions）                │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │  │
│  │  │ Reply    │  │ Content  │  │ Growth   │               │  │
│  │  │ Worker 1 │  │ Worker 1 │  │ Worker 1 │               │  │
│  │  │ (Haiku)  │  │ (Sonnet) │  │ (Haiku)  │               │  │
│  │  └──────────┘  └──────────┘  └──────────┘               │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐               │  │
│  │  │ Reply    │  │ Content  │  │ Growth   │               │  │
│  │  │ Worker 2 │  │ Worker 2 │  │ Worker 2 │               │  │
│  │  │ (Sonnet) │  │ (Opus)   │  │ (Sonnet) │               │  │
│  │  └──────────┘  └──────────┘  └──────────┘               │  │
│  │  ... 更多 Worker（按需创建，动态管理）                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                         ↓                                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         MCP 服务层（共享资源，类似 VS Code API）          │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │ Twitter MCP  │  │ 知识库 MCP   │  │ 数据访问 MCP │   │  │
│  │  │              │  │              │  │              │   │  │
│  │  │ ┌──────────┐ │  │              │  │              │   │  │
│  │  │ │LocalBridge│ │  │              │  │              │   │  │
│  │  │ │HTTP Client│ │  │              │  │              │   │  │
│  │  │ └──────────┘ │  │              │  │              │   │  │
│  │  │      ↓ HTTP  │  │              │  │              │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  │  所有 Worker 共享 MCP 服务器（统一配置，统一管理）       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  一个 Claurst Host 进程管理当前产品的所有 Agent Worker         │
└─────────────────────────────────────────────────────────────────┘
                           ↓ HTTP
┌─────────────────────────────────────────────────────────────────┐
│   LocalBridge REST API 服务（独立程序，已开发完成）             │
│   - HTTP Server (localhost:3000)                                │
│   - RESTful API 接口                                            │
│   - 驱动浏览器扩展执行 Twitter 操作                             │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│   Browser Extension → Twitter                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Extension Host 模式架构说明**:

| 层级 | VS Code 架构 | TweetPilot 架构 | 说明 |
|------|-------------|----------------|------|
| **主进程** | VS Code Main Process | TweetPilot 主进程 | 管理 UI、产品、任务 |
| **Host 进程** | Extension Host | Claurst Host (Coordinator) | 管理所有 Worker/Extension |
| **通信方式** | IPC (stdin/stdout + JSON) | IPC (stdin/stdout + JSON) | 进程间通信 |
| **Worker/Extension** | Extensions | Worker Agents | 具体执行任务 |
| **共享资源** | VS Code API | MCP Servers | 所有 Worker 共享 |
| **进程隔离** | Extension 崩溃不影响主进程 | Worker 崩溃不影响 TweetPilot | 稳定性保证 |

**核心优势**:
- ✅ **单一 Host 进程**：一个 Claurst Host 管理所有 Worker，简化架构
- ✅ **IPC 通信**：通过 stdin/stdout + JSON 进行可靠的进程间通信
- ✅ **资源共享**：所有 Worker 共享 MCP Servers，避免重复配置
- ✅ **进程隔离**：Worker 崩溃不影响 TweetPilot 主进程
- ✅ **动态管理**：Coordinator 按需创建和销毁 Worker
- ✅ **成本优化**：Coordinator 用 Opus，Worker 用 Haiku/Sonnet

### 3.2 数据流图（Extension Host 模式 + IPC 通信）

```
用户请求（处理评论回复）
  ↓
TweetPilot API Gateway
  ↓
任务管理模块（创建任务）
  ↓
Claurst Host Manager（进程管理器）
  ├── 构建任务提示词（包含产品ID、工作区ID、账号ID、评论ID）
  ├── 编码为 JSON 消息
  └── 通过 stdin 发送到 Claurst Host 进程
  ↓ IPC (stdin/stdout + JSON)
Claurst Host 进程（Extension Host 模式）
  ↓
Claurst Coordinator (Opus) 接收任务，分析并分解
  ├── 创建 Worker 1 (Haiku): 获取评论上下文
  │   └── 调用 MCP 工具: twitter_get_comments(productId, workspaceId, accountId, commentId)
  │       └── Twitter MCP Server → HTTP Client → LocalBridge REST API (GET /api/tweets/{id}/comments)
  │           └── LocalBridge → 浏览器扩展 → Twitter
  ├── 创建 Worker 2 (Haiku): 搜索知识库
  │   └── 调用 MCP 工具: knowledge_search(productId, workspaceId, query)
  │       └── Knowledge MCP Server → 产品知识库
  ├── 创建 Worker 3 (Haiku): 生成回复候选 1
  ├── 创建 Worker 4 (Haiku): 生成回复候选 2
  └── 创建 Worker 5 (Haiku): 生成回复候选 3
  ↓
Coordinator 收集所有 Worker 结果（并行执行）
  ↓
Coordinator 综合分析，选择最佳回复
  ↓
编码为 JSON 消息，通过 stdout 返回
  ↓ IPC (stdin/stdout + JSON)
Claurst Host Manager 接收结果
  ├── 解析 JSON 消息
  └── 提取任务结果
  ↓
TweetPilot 任务管理模块
  ↓
更新任务状态，保存到数据库
  ↓
返回给用户（审核队列）
```

**Extension Host 模式关键点**:

| 特性 | VS Code Extension Host | TweetPilot Claurst Host | 说明 |
|------|----------------------|------------------------|------|
| **进程模型** | 单一 Extension Host 进程 | 单一 Claurst Host 进程 | 简化架构 |
| **通信协议** | IPC (stdin/stdout + JSON) | IPC (stdin/stdout + JSON) | 可靠的进程间通信 |
| **Worker 管理** | Extension Host 管理所有 Extensions | Coordinator 管理所有 Worker Agents | 动态创建和销毁 |
| **资源共享** | Extensions 共享 VS Code API | Workers 共享 MCP Servers | 避免重复配置 |
| **并行执行** | Extensions 可并行运行 | Workers 并行执行任务 | 提升性能 |
| **进程隔离** | Extension 崩溃不影响主进程 | Worker 崩溃不影响 TweetPilot | 稳定性保证 |
| **成本优化** | N/A | Coordinator (Opus) + Workers (Haiku) | 降低 70-80% 成本 |

**IPC 通信优势**:
- ✅ **可靠性高**: stdin/stdout 是操作系统级别的标准流，非常稳定
- ✅ **跨平台**: 所有操作系统都支持 stdin/stdout
- ✅ **简单高效**: JSON 序列化/反序列化性能好，易于调试
- ✅ **进程隔离**: Claurst Host 崩溃不会影响 TweetPilot 主进程
- ✅ **无需网络**: 不依赖 HTTP/TCP，避免端口占用和网络问题

### 3.3 LocalBridge REST API 集成架构

LocalBridge 是独立的 REST API 服务程序，我们设计灵活的集成架构以支持多种集成路径。

#### 当前架构：直接调用 LocalBridge REST API（P0）

**LocalBridge REST API 服务**（已开发完成）:
- 独立运行的 HTTP 服务
- 提供 RESTful API 接口
- 驱动浏览器扩展执行 Twitter 操作

**集成层次**:
```
Claurst Agent
  ↓
Twitter MCP Server (Node.js 进程)
  ↓ HTTP 请求
LocalBridge REST API 服务 (独立程序，已有)
  ↓
Browser Extension → Twitter
```

#### Layer 1: LocalBridge HTTP Client（抽象层）

提供类型安全的 TypeScript 接口，封装 LocalBridge REST API 调用。

```typescript
// src/modules/LocalBridgeClient.ts

export interface ILocalBridgeClient {
  // 基础操作
  getTweet(tweetId: string): Promise<Tweet>;
  sendTweet(content: string, accountId: string): Promise<Tweet>;
  getComments(tweetId: string): Promise<Comment[]>;
  replyToComment(commentId: string, content: string, accountId: string): Promise<Comment>;
  
  // 高级操作
  getAnalytics(accountId: string, period: string): Promise<Analytics>;
  searchTweets(query: string, limit: number): Promise<Tweet[]>;
  getTrends(location: string): Promise<Trend[]>;
}

export class LocalBridgeClient implements ILocalBridgeClient {
  private baseURL: string;
  private timeout: number = 30000;

  constructor(config: LocalBridgeConfig) {
    this.baseURL = config.baseURL || 'http://localhost:3000';
  }

  // HTTP 请求封装
  private async request<T>(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('LocalBridge request timeout');
      }
      throw error;
    }
  }

  // 实现接口方法
  async getTweet(tweetId: string): Promise<Tweet> {
    return this.request<Tweet>('GET', `/api/tweets/${tweetId}`);
  }

  async sendTweet(content: string, accountId: string): Promise<Tweet> {
    return this.request<Tweet>('POST', '/api/tweets', {
      content,
      accountId,
    });
  }

  async getComments(tweetId: string): Promise<Comment[]> {
    return this.request<Comment[]>('GET', `/api/tweets/${tweetId}/comments`);
  }

  async replyToComment(
    commentId: string,
    content: string,
    accountId: string
  ): Promise<Comment> {
    return this.request<Comment>('POST', `/api/comments/${commentId}/reply`, {
      content,
      accountId,
    });
  }

  async getAnalytics(accountId: string, period: string): Promise<Analytics> {
    return this.request<Analytics>(
      'GET',
      `/api/accounts/${accountId}/analytics?period=${period}`
    );
  }

  async searchTweets(query: string, limit: number): Promise<Tweet[]> {
    return this.request<Tweet[]>(
      'GET',
      `/api/tweets/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );
  }

  async getTrends(location: string): Promise<Trend[]> {
    return this.request<Trend[]>(
      'GET',
      `/api/trends?location=${encodeURIComponent(location)}`
    );
  }

  // 健康检查
  async healthCheck(): Promise<boolean> {
    try {
      await this.request('GET', '/health');
      return true;
    } catch {
      return false;
    }
  }
}

// 类型定义
interface LocalBridgeConfig {
  baseURL?: string;
  timeout?: number;
}
```

#### Layer 2: Twitter MCP Server（MCP 协议层）

封装 LocalBridgeClient，暴露标准 MCP 接口给 Claurst。

```typescript
// mcp-servers/twitter/index.ts

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { LocalBridgeClient } from '../../src/modules/LocalBridgeClient.js';

class TwitterMCPServer {
  private server: Server;
  private client: LocalBridgeClient;

  constructor() {
    // 初始化 LocalBridge HTTP Client
    this.client = new LocalBridgeClient({
      baseURL: process.env.LOCALBRIDGE_URL || 'http://localhost:3000',
    });

    // 初始化 MCP Server
    this.server = new Server(
      {
        name: 'twitter-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  // 设置工具处理器
  private setupToolHandlers(): void {
    // 注册所有 Twitter 工具
    this.server.setRequestHandler('tools/list', async () => ({
      tools: [
        {
          name: 'twitter_get_tweet',
          description: '获取推文详情',
          inputSchema: {
            type: 'object',
            properties: {
              productId: { type: 'string', description: '产品 ID' },
              workspaceId: { type: 'string', description: '工作区 ID' },
              tweetId: { type: 'string', description: '推文 ID' },
            },
            required: ['productId', 'workspaceId', 'tweetId'],
          },
        },
        {
          name: 'twitter_send_tweet',
          description: '发送推文',
          inputSchema: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              workspaceId: { type: 'string' },
              accountId: { type: 'string', description: '账号 ID' },
              content: { type: 'string', description: '推文内容' },
            },
            required: ['productId', 'workspaceId', 'accountId', 'content'],
          },
        },
        {
          name: 'twitter_get_comments',
          description: '获取推文的评论列表',
          inputSchema: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              workspaceId: { type: 'string' },
              tweetId: { type: 'string', description: '推文 ID' },
            },
            required: ['productId', 'workspaceId', 'tweetId'],
          },
        },
        {
          name: 'twitter_reply_comment',
          description: '回复评论',
          inputSchema: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              workspaceId: { type: 'string' },
              accountId: { type: 'string' },
              commentId: { type: 'string', description: '评论 ID' },
              content: { type: 'string', description: '回复内容' },
            },
            required: ['productId', 'workspaceId', 'accountId', 'commentId', 'content'],
          },
        },
        {
          name: 'twitter_get_analytics',
          description: '获取账号分析数据',
          inputSchema: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              workspaceId: { type: 'string' },
              accountId: { type: 'string' },
              period: { type: 'string', description: '时间周期（7d, 30d, 90d）' },
            },
            required: ['productId', 'workspaceId', 'accountId', 'period'],
          },
        },
        {
          name: 'twitter_search_tweets',
          description: '搜索推文',
          inputSchema: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              workspaceId: { type: 'string' },
              query: { type: 'string', description: '搜索关键词' },
              limit: { type: 'number', description: '返回数量限制' },
            },
            required: ['productId', 'workspaceId', 'query'],
          },
        },
        // ... 更多工具
      ],
    }));

    // 处理工具调用
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result;

        switch (name) {
          case 'twitter_get_tweet':
            result = await this.client.getTweet(args.tweetId);
            break;

          case 'twitter_send_tweet':
            result = await this.client.sendTweet(args.content, args.accountId);
            break;

          case 'twitter_get_comments':
            result = await this.client.getComments(args.tweetId);
            break;

          case 'twitter_reply_comment':
            result = await this.client.replyToComment(
              args.commentId,
              args.content,
              args.accountId
            );
            break;

          case 'twitter_get_analytics':
            result = await this.client.getAnalytics(args.accountId, args.period);
            break;

          case 'twitter_search_tweets':
            result = await this.client.searchTweets(args.query, args.limit || 10);
            break;

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  // 启动服务器
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Twitter MCP Server started');
  }
}

// 启动服务器
const server = new TwitterMCPServer();
server.start().catch(console.error);
```

#### Layer 3: Claurst 配置

配置 Claurst 使用 Twitter MCP Server。

```json
// ~/.claurst/settings.json
{
  "config": {
    "mcp_servers": [
      {
        "name": "twitter",
        "command": "node",
        "args": ["./mcp-servers/twitter/index.js"],
        "type": "stdio",
        "env": {
          "LOCALBRIDGE_URL": "http://localhost:3000"
        }
      },
      {
        "name": "knowledge",
        "command": "node",
        "args": ["./mcp-servers/knowledge/index.js"],
        "type": "stdio"
      },
      {
        "name": "data",
        "command": "node",
        "args": ["./mcp-servers/data/index.js"],
        "type": "stdio"
      }
    ]
  }
}
```

#### Layer 4: Claurst Host Manager（Extension Host 模式实现）

TweetPilot 主进程中的 Claurst Host Manager，负责管理 Claurst Host 进程的生命周期和 IPC 通信。

```typescript
// src/services/ClaurstHostManager.ts

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as readline from 'readline';

/**
 * Claurst Host Manager
 * 
 * 借鉴 VS Code Extension Host 架构：
 * - 管理单一 Claurst Host 进程（Coordinator Mode）
 * - 通过 stdin/stdout + JSON 进行 IPC 通信
 * - 监控进程健康状态
 * - 自动重启崩溃的进程
 */
export class ClaurstHostManager extends EventEmitter {
  private hostProcess: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }>();
  private isStarting = false;
  private isShuttingDown = false;

  constructor(
    private config: ClaurstHostConfig
  ) {
    super();
  }

  /**
   * 启动 Claurst Host 进程（Extension Host 模式）
   */
  async start(): Promise<void> {
    if (this.hostProcess || this.isStarting) {
      throw new Error('Claurst Host is already running or starting');
    }

    this.isStarting = true;

    try {
      // 启动 Claurst 进程（Coordinator Mode）
      this.hostProcess = spawn('claurst', [
        '--coordinator',  // 启用 Coordinator Mode
        '--project', this.config.projectPath,
        '--model', this.config.model || 'claude-opus-4-6',
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],  // stdin, stdout, stderr
        env: {
          ...process.env,
          CLAURST_COORDINATOR_MODE: '1',  // 启用 Coordinator Mode
          WORKSPACE_ID: this.config.workspaceId,
          PRODUCT_ID: this.config.productId,
        },
      });

      // 设置 stdout 读取器（接收 JSON 消息）
      const rl = readline.createInterface({
        input: this.hostProcess.stdout!,
        crlfDelay: Infinity,
      });

      rl.on('line', (line) => {
        this.handleMessage(line);
      });

      // 监听 stderr（日志输出）
      this.hostProcess.stderr!.on('data', (data) => {
        console.error(`[Claurst Host] ${data.toString()}`);
      });

      // 监听进程退出
      this.hostProcess.on('exit', (code, signal) => {
        console.error(`[Claurst Host] Process exited with code ${code}, signal ${signal}`);
        this.handleProcessExit(code, signal);
      });

      // 监听进程错误
      this.hostProcess.on('error', (error) => {
        console.error(`[Claurst Host] Process error:`, error);
        this.emit('error', error);
      });

      // 等待进程启动完成
      await this.waitForReady();

      this.isStarting = false;
      this.emit('ready');

      console.log('[Claurst Host] Started successfully');
    } catch (error) {
      this.isStarting = false;
      throw error;
    }
  }

  /**
   * 发送任务到 Claurst Host（IPC 通信）
   */
  async executeTask(task: ClaurstTask): Promise<ClaurstTaskResult> {
    if (!this.hostProcess) {
      throw new Error('Claurst Host is not running');
    }

    const requestId = ++this.requestId;

    // 构建 JSON 消息
    const message: ClaurstMessage = {
      type: 'request',
      id: requestId,
      timestamp: Date.now(),
      payload: {
        task: task.type,
        prompt: task.prompt,
        context: task.context,
      },
    };

    // 创建 Promise 等待响应
    const promise = new Promise<ClaurstTaskResult>((resolve, reject) => {
      // 设置超时
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Task timeout after ${this.config.timeout || 60000}ms`));
      }, this.config.timeout || 60000);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });
    });

    // 通过 stdin 发送 JSON 消息
    const json = JSON.stringify(message) + '\n';
    this.hostProcess.stdin!.write(json);

    return promise;
  }

  /**
   * 处理来自 Claurst Host 的消息（IPC 通信）
   */
  private handleMessage(line: string): void {
    try {
      const message: ClaurstMessage = JSON.parse(line);

      if (message.type === 'response') {
        // 响应消息
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.id);
          pending.resolve(message.payload);
        }
      } else if (message.type === 'error') {
        // 错误消息
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.id);
          pending.reject(new Error(message.payload.error));
        }
      } else if (message.type === 'event') {
        // 事件消息（如进度更新）
        this.emit('event', message.payload);
      }
    } catch (error) {
      console.error('[Claurst Host] Failed to parse message:', line, error);
    }
  }

  /**
   * 处理进程退出（自动重启）
   */
  private handleProcessExit(code: number | null, signal: string | null): void {
    this.hostProcess = null;

    // 拒绝所有待处理的请求
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Claurst Host process exited'));
    }
    this.pendingRequests.clear();

    // 如果不是主动关闭，尝试自动重启
    if (!this.isShuttingDown) {
      console.warn('[Claurst Host] Process crashed, attempting to restart...');
      this.emit('crash', { code, signal });

      // 延迟 1 秒后重启
      setTimeout(() => {
        this.start().catch((error) => {
          console.error('[Claurst Host] Failed to restart:', error);
          this.emit('restart-failed', error);
        });
      }, 1000);
    }
  }

  /**
   * 等待进程启动完成
   */
  private async waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Claurst Host startup timeout'));
      }, 30000);

      // 发送 ping 消息
      const checkReady = async () => {
        try {
          await this.ping();
          clearTimeout(timeout);
          resolve();
        } catch (error) {
          // 继续等待
          setTimeout(checkReady, 500);
        }
      };

      checkReady();
    });
  }

  /**
   * Ping Claurst Host（健康检查）
   */
  async ping(): Promise<void> {
    if (!this.hostProcess) {
      throw new Error('Claurst Host is not running');
    }

    const requestId = ++this.requestId;

    const message: ClaurstMessage = {
      type: 'ping',
      id: requestId,
      timestamp: Date.now(),
      payload: {},
    };

    const promise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Ping timeout'));
      }, 5000);

      this.pendingRequests.set(requestId, {
        resolve: () => resolve(),
        reject,
        timeout,
      });
    });

    const json = JSON.stringify(message) + '\n';
    this.hostProcess.stdin!.write(json);

    return promise;
  }

  /**
   * 停止 Claurst Host 进程
   */
  async stop(): Promise<void> {
    if (!this.hostProcess) {
      return;
    }

    this.isShuttingDown = true;

    // 发送关闭消息
    const message: ClaurstMessage = {
      type: 'shutdown',
      id: ++this.requestId,
      timestamp: Date.now(),
      payload: {},
    };

    const json = JSON.stringify(message) + '\n';
    this.hostProcess.stdin!.write(json);

    // 等待进程退出
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        // 强制杀死进程
        this.hostProcess?.kill('SIGKILL');
        resolve();
      }, 5000);

      this.hostProcess!.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.hostProcess = null;
    this.isShuttingDown = false;
    this.emit('stopped');

    console.log('[Claurst Host] Stopped');
  }

  /**
   * 获取进程状态
   */
  getStatus(): ClaurstHostStatus {
    return {
      isRunning: this.hostProcess !== null,
      isStarting: this.isStarting,
      isShuttingDown: this.isShuttingDown,
      pendingRequests: this.pendingRequests.size,
      pid: this.hostProcess?.pid,
    };
  }
}

// 类型定义
interface ClaurstHostConfig {
  projectPath: string;
  workspaceId: string;
  productId: string;
  model?: string;
  timeout?: number;
}

interface ClaurstMessage {
  type: 'request' | 'response' | 'error' | 'event' | 'ping' | 'pong' | 'shutdown';
  id: number;
  timestamp: number;
  payload: any;
}

interface ClaurstTask {
  type: 'reply' | 'content' | 'growth' | 'analysis';
  prompt: string;
  context: {
    productId: string;
    workspaceId: string;
    accountId: string;
    [key: string]: any;
  };
}

interface ClaurstTaskResult {
  success: boolean;
  result: any;
  metadata: {
    model: string;
    tokensUsed: number;
    executionTime: number;
  };
}

interface ClaurstHostStatus {
  isRunning: boolean;
  isStarting: boolean;
  isShuttingDown: boolean;
  pendingRequests: number;
  pid?: number;
}
```

#### 完整工作流程（Extension Host 模式 + IPC 通信）

```
1. LocalBridge REST API 服务独立运行（已有）
   ↓
2. TweetPilot 启动 Claurst Host Manager
   ↓
3. Claurst Host Manager 启动 Claurst Host 进程（Coordinator Mode）
   - 通过 child_process.spawn() 启动
   - 配置 stdio: ['pipe', 'pipe', 'pipe']
   - 设置环境变量 CLAURST_COORDINATOR_MODE=1
   ↓
4. Claurst Host 启动时自动连接 MCP Servers（根据 settings.json）
   ↓
5. Twitter MCP Server 启动时初始化 LocalBridge HTTP Client
   ↓
6. 用户发起任务："回复评论 #12345"
   ↓
7. TweetPilot 任务管理模块调用 Claurst Host Manager
   ↓
8. Claurst Host Manager 构建 JSON 消息，通过 stdin 发送
   - 消息格式：{ type: 'request', id: 1, payload: { task, prompt, context } }
   ↓ IPC (stdin/stdout + JSON)
9. Claurst Host 接收消息，Coordinator 分析并分解任务
   ↓
10. Coordinator 创建多个 Worker Agent 并行执行
   ↓
11. Worker Agent 调用 MCP 工具：twitter_get_comments(...)
   ↓
12. Twitter MCP Server 接收调用，通过 HTTP Client 调用 LocalBridge REST API
   ↓
13. LocalBridge REST API 驱动浏览器扩展，执行 Twitter 操作
   ↓
14. 结果逐层返回：LocalBridge → HTTP Response → MCP Server → Worker → Coordinator
   ↓
15. Coordinator 综合所有 Worker 结果，生成最终回复
   ↓
16. Claurst Host 构建 JSON 响应消息，通过 stdout 返回
   - 消息格式：{ type: 'response', id: 1, payload: { result } }
   ↓ IPC (stdin/stdout + JSON)
17. Claurst Host Manager 接收消息，解析 JSON，提取结果
   ↓
18. 返回给 TweetPilot 任务管理模块
   ↓
19. 更新任务状态，保存到数据库
   ↓
20. 返回给用户（审核队列）
```

**Extension Host 模式优势总结**:
- ✅ **单一 Host 进程**: 一个 Claurst Host 管理所有 Worker，简化架构
- ✅ **IPC 通信**: stdin/stdout + JSON，可靠、跨平台、易于调试
- ✅ **进程隔离**: Worker 崩溃不影响 TweetPilot 主进程
- ✅ **自动重启**: Host 进程崩溃时自动重启，保证可用性
- ✅ **健康监控**: 定期 ping 检查进程健康状态
- ✅ **资源共享**: 所有 Worker 共享 MCP Servers
- ✅ **职责清晰**: 每一层都有明确的职责
- ✅ **易于测试**: 每一层都可以独立测试
- ✅ **类型安全**: TypeScript 提供完整的类型检查
- ✅ **架构灵活**: 未来可选择 MCP 协议统一接口或切换到 X 官方 API

#### 可选集成路径（P1/P2）

**路径 1: LocalBridge MCP 协议转换（P1 可选工作）**

如果希望统一所有 Twitter 数据源的接口，可以开发 LocalBridge MCP 协议转换层：

```typescript
// localbridge-mcp-adapter/index.ts
// 将 LocalBridge REST API 封装为标准 MCP 协议服务

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { LocalBridgeClient } from '../src/modules/LocalBridgeClient.js';

class LocalBridgeMCPAdapter {
  private server: Server;
  private client: LocalBridgeClient;

  constructor() {
    this.client = new LocalBridgeClient({
      baseURL: process.env.LOCALBRIDGE_URL || 'http://localhost:3000',
    });

    this.server = new Server(
      { name: 'localbridge-mcp', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    this.setupMCPProtocol();
  }

  private setupMCPProtocol(): void {
    // 实现标准 MCP 协议接口
    // 将 LocalBridge REST API 调用转换为 MCP 工具
  }
}
```

**优势**:
- 统一接口：所有 Twitter 数据源都通过 MCP 协议访问
- 易于切换：可以在 LocalBridge 和 X 官方 API 之间切换
- 标准化：符合 MCP 协议规范

**路径 2: X 官方 API 集成（P2 可选工作）**

支持使用 X 官方按使用量计费的 API 服务替代 LocalBridge：

```json
// ~/.claurst/settings.json
{
  "config": {
    "mcp_servers": [
      {
        "name": "twitter",
        "command": "node",
        "args": ["./mcp-servers/x-api/index.js"],
        "type": "stdio",
        "env": {
          "X_API_KEY": "your-api-key",
          "X_API_SECRET": "your-api-secret",
          "X_BEARER_TOKEN": "your-bearer-token"
        }
      }
    ]
  }
}
```

**X API 按使用量计费模式（2026 年 2 月推出）**:
- **定价模式**：按操作计费，预付费信用系统（[来源](https://www.wearefounders.uk/post/the-x-api-price-hike-a-blow-to-indie-hackers)）
- **操作价格**：
  - 读推文：约 $0.005 每次请求
  - 用户查询：约 $0.01 每次请求
  - 写推文：约 $0.01 每条推文
- **计费方式**：预先购买信用额度，按实际使用扣费，无月费上限
- **官方文档**：[X API Pricing](https://docs.x.com/x-api/getting-started/pricing)

**优势**:
- **官方 API**：X 官方提供，功能完整、稳定可靠
- **按需付费**：只为实际使用付费，适合中小规模运营
- **无需浏览器扩展**：直接调用 API，更稳定
- **功能完整**：支持所有 X API 功能（时间线、搜索、互动、分析等）

**成本对比示例**:
- **LocalBridge**：免费（使用浏览器扩展），但依赖浏览器环境
- **X API**：按使用量计费
  - 每天处理 100 条评论（读取 + 回复）：约 $1.5/天（100 × $0.005 读 + 100 × $0.01 写）
  - 每月处理 3000 条评论：约 $45/月
  - 适合中小规模运营，成本可控

**架构灵活性设计**:

```typescript
// src/interfaces/ITwitterDataSource.ts
// 定义统一的 Twitter 数据源接口

export interface ITwitterDataSource {
  getTweet(tweetId: string): Promise<Tweet>;
  sendTweet(content: string, accountId: string): Promise<Tweet>;
  getComments(tweetId: string): Promise<Comment[]>;
  replyToComment(commentId: string, content: string, accountId: string): Promise<Comment>;
}

// 实现 1: LocalBridge REST API
export class LocalBridgeDataSource implements ITwitterDataSource {
  private client: LocalBridgeClient;
  // 实现...
}

// 实现 2: X 官方 API
export class XAPIDataSource implements ITwitterDataSource {
  private apiClient: XAPIClient;
  // 实现...
}

// 配置切换
const dataSource = config.useLocalBridge
  ? new LocalBridgeDataSource()
  : new XAPIDataSource();
```

**集成路径总结**:

| 路径 | 优先级 | 优势 | 适用场景 |
|------|--------|------|---------|
| **直接调用 LocalBridge REST API** | P0（当前） | 免费，LocalBridge 已开发完成 | 初期开发，快速验证，小规模运营 |
| **LocalBridge MCP 协议转换** | P1（可选） | 统一接口，易于切换 | 需要标准化接口 |
| **X 官方 API（按使用量计费）** | P2（可选） | 官方 API，功能完整，稳定可靠 | 中大规模运营，需要稳定性和完整功能 |

## 4. Managed Agents 的应用

### 4.1 Manager-Executor 模式详解

**Claurst Coordinator Mode 工作原理**：

Claurst 的 Coordinator Mode 通过环境变量 `CLAURST_COORDINATOR_MODE=1` 启用。启用后,Claurst 会注入特殊的系统提示词,指导模型进行任务编排而非直接执行。

**核心机制**：
1. **Coordinator 专用工具**：
   - `Agent` - 创建新的 Worker Agent
   - `SendMessage` - 与运行中的 Worker 通信
   - `TaskStop` - 取消不需要的 Worker
   - `TaskCreate/TaskUpdate/TaskList` - 任务管理

2. **Worker 工具集**：
   - Worker 接收所有标准工具(文件操作、Bash、Web 搜索、MCP 工具)
   - Worker **不能**使用 Coordinator 专用工具(防止递归编排)
   - Worker 的提示词必须完全自包含(无法访问 Coordinator 的会话历史)

3. **工作流程**：
   ```
   Coordinator (Opus) 启动
     ↓
   分析任务,制定计划
     ↓
   并行创建多个 Worker (Haiku)
     ├── Worker 1: 获取评论上下文
     ├── Worker 2: 搜索知识库
     ├── Worker 3: 生成回复候选 1
     ├── Worker 4: 生成回复候选 2
     └── Worker 5: 生成回复候选 3
     ↓
   等待所有 Worker 完成
     ↓
   Coordinator 综合结果,选择最佳回复
     ↓
   返回最终结果
   ```

**TweetPilot 中的应用架构**：
```
Reply Agent (Manager - Opus)
  ↓ 分解任务
  ├── Executor 1 (Haiku) - 获取评论上下文
  ├── Executor 2 (Haiku) - 搜索知识库
  ├── Executor 3 (Haiku) - 生成回复候选 1
  ├── Executor 4 (Haiku) - 生成回复候选 2
  └── Executor 5 (Haiku) - 生成回复候选 3
  ↓ 综合结果
Reply Agent (Manager) - 选择最佳回复
```

### 4.2 性能优化和成本优化

**成本对比（基于 Anthropic 2026 年 4 月定价）**：

| 方案 | 模型配置 | 输入成本 | 输出成本 | 总成本（相对） | 性能 |
|------|---------|---------|---------|---------------|------|
| **传统方案** | 全部使用 Opus | $15/1M tokens | $75/1M tokens | 100% | 高质量，但慢 |
| **Managed Agents** | Manager: Opus<br>Executor: Haiku | Manager: $15/1M<br>Executor: $0.8/1M | Manager: $75/1M<br>Executor: $4/1M | 20-30% | 高质量，更快 |
| **全 Haiku 方案** | 全部使用 Haiku | $0.8/1M tokens | $4/1M tokens | 5-10% | 质量较低 |

**实际成本计算示例（处理 100 条评论回复）**：

假设每条评论回复需要：
- 输入：2000 tokens（评论上下文 + 知识库 + 系统提示词）
- 输出：500 tokens（生成的回复）

**传统方案（全 Opus）**：
```
输入成本：100 × 2000 × $15 / 1,000,000 = $3.00
输出成本：100 × 500 × $75 / 1,000,000 = $3.75
总成本：$6.75
```

**Managed Agents 方案**：
```
Manager (Opus):
  - 输入：100 × 500 × $15 / 1,000,000 = $0.75 (任务分解)
  - 输出：100 × 200 × $75 / 1,000,000 = $1.50 (综合结果)

Executor (Haiku, 5 个并行):
  - 输入：500 × 2000 × $0.8 / 1,000,000 = $0.80
  - 输出：500 × 500 × $4 / 1,000,000 = $1.00

总成本：$0.75 + $1.50 + $0.80 + $1.00 = $4.05
节省：($6.75 - $4.05) / $6.75 = 40%
```

**性能提升**：
- 传统方案：串行执行，100 条评论需要约 100 × 10s = 1000s (16.7 分钟)
- Managed Agents：并行执行，100 条评论需要约 20 × 15s = 300s (5 分钟)
- 速度提升：3.3 倍

**原理**：
- Manager（Opus）：负责任务分解、协调、综合，使用大模型保证质量
- Executor（Haiku）：负责具体执行，使用小模型降低成本
- 并行执行：多个 Executor 并行工作，提升速度
- 智能路由：简单任务直接用 Haiku，复杂任务才用 Opus

### 4.3 具体应用场景

**场景 1：批量回复评论（详细实现）**

```typescript
// 使用 Coordinator Mode 批量处理评论
async function batchReplyComments(comments: Comment[]): Promise<Reply[]> {
  // 启动 Coordinator (Opus)
  const coordinator = await claurstManager.startProcess({
    agentInstanceId: 'reply-coordinator',
    productId: 'prod-123',
    workspaceId: 'workspace-456',
    model: 'claude-opus-4-6',
    coordinatorMode: true, // 启用 Coordinator Mode
  });

  // 构建任务提示词
  const prompt = `
你是 Reply Agent Coordinator。请批量处理以下 ${comments.length} 条评论回复任务。

工作流程：
1. 分析所有评论，按复杂度分组（简单、常规、复杂）
2. 为每组评论创建 Worker Agent 并行处理
3. 收集所有 Worker 的结果
4. 审核和优化回复质量
5. 返回最终结果

评论列表：
${JSON.stringify(comments, null, 2)}

可用的 MCP 工具：
- twitter_get_comments: 获取评论详情
- knowledge_search: 搜索产品知识库
- data_get_tweet_history: 获取历史推文

请开始处理。
  `;

  // 发送任务
  const result = await coordinator.executeTask(prompt);

  return result.replies;
}

// Coordinator 内部工作流程（由 Claurst 自动执行）
/*
Coordinator (Opus) 分析评论：
  - 简单评论（感谢、确认）：15 条
  - 常规评论（FAQ、产品咨询）：25 条
  - 复杂评论（技术支持、投诉）：10 条

Coordinator 创建 Worker Agents：
  - Worker 1 (Haiku): 处理 15 条简单评论
  - Worker 2 (Haiku): 处理 25 条常规评论（分 5 批，每批 5 条）
  - Worker 3 (Sonnet): 处理 10 条复杂评论（使用更强模型）

Workers 并行执行：
  - Worker 1: 调用 knowledge_search 获取标准回复模板
  - Worker 2: 调用 knowledge_search 获取 FAQ 答案
  - Worker 3: 调用 twitter_get_comments 获取完整上下文，调用 data_get_tweet_history 查找相关历史

Coordinator 收集结果：
  - 审核所有回复的质量
  - 优化语气和风格
  - 标记需要人工审核的回复

返回结果：
  - 50 条回复草稿
  - 质量评分
  - 人工审核建议
*/
```

**实际成本和时间对比**：

| 方案 | 模型使用 | 输入 Tokens | 输出 Tokens | 成本 | 时间 |
|------|---------|------------|------------|------|------|
| **传统方案** | 50 × Opus | 100,000 | 25,000 | $3.38 | 500s (8.3 分钟) |
| **Coordinator** | 1 × Opus<br>50 × Haiku | Opus: 10,000<br>Haiku: 100,000 | Opus: 5,000<br>Haiku: 25,000 | $0.63 | 150s (2.5 分钟) |
| **节省** | - | - | - | 81% | 70% |

**场景 2：内容创作（多候选生成）**

```typescript
// 使用 Coordinator Mode 生成多个推文候选
async function createTweetWithCandidates(topic: string): Promise<Tweet[]> {
  const coordinator = await claurstManager.startProcess({
    agentInstanceId: 'content-coordinator',
    productId: 'prod-123',
    workspaceId: 'workspace-456',
    model: 'claude-opus-4-6',
    coordinatorMode: true,
  });

  const prompt = `
你是 Content Agent Coordinator。请为以下主题创作推文，生成 5 个不同风格的候选。

主题：${topic}

工作流程：
1. 分析产品定位和目标受众（调用 knowledge_search）
2. 创建 5 个 Worker，每个生成不同风格的推文：
   - Worker 1: 专业严肃风格
   - Worker 2: 轻松幽默风格
   - Worker 3: 技术深度风格
   - Worker 4: 故事叙述风格
   - Worker 5: 问题引导风格
3. 收集所有候选
4. 评估每个候选的质量和适配度
5. 推荐最佳候选

请开始处理。
  `;

  const result = await coordinator.executeTask(prompt);
  return result.candidates;
}
```

**场景 3：数据分析（多维度并行）**

```typescript
// 使用 Coordinator Mode 进行多维度数据分析
async function analyzeTwitterData(
  productId: string,
  period: string
): Promise<AnalysisReport> {
  const coordinator = await claurstManager.startProcess({
    agentInstanceId: 'growth-coordinator',
    productId,
    workspaceId: 'workspace-456',
    model: 'claude-opus-4-6',
    coordinatorMode: true,
  });

  const prompt = `
你是 Growth Agent Coordinator。请分析产品的 Twitter 数据，生成综合报表。

分析周期：${period}

工作流程：
1. 创建 4 个 Worker 并行分析不同维度：
   - Worker 1: 增长分析（粉丝增长、互动增长）
   - Worker 2: 内容分析（推文表现、最佳内容类型）
   - Worker 3: 受众分析（受众画像、活跃时段）
   - Worker 4: 竞品分析（竞品动态、差距分析）
2. 收集所有分析结果
3. 综合分析，找出关键洞察
4. 生成可执行的优化建议
5. 生成可视化报表

可用的 MCP 工具：
- data_get_tweet_history: 获取历史推文
- data_get_interaction_stats: 获取互动统计
- data_get_audience_insights: 获取受众洞察

请开始处理。
  `;

  const result = await coordinator.executeTask(prompt);
  return result.report;
}
```

## 5. Multi-Provider 的应用

### 5.1 模型选择策略

**按任务复杂度选择**：

| 任务类型 | 复杂度 | 推荐模型 | 输入成本 | 输出成本 | 适用场景 |
|---------|--------|---------|---------|---------|---------|
| **简单回复**（感谢、确认） | 低 | Haiku | $0.8/1M | $4/1M | 标准化回复、简单确认 |
| **常规回复**（FAQ、产品介绍） | 中 | Sonnet | $3/1M | $15/1M | 产品咨询、功能介绍 |
| **复杂回复**（技术支持、投诉处理） | 高 | Opus | $15/1M | $75/1M | 技术问题、投诉处理 |
| **内容创作** | 中-高 | Sonnet/Opus | $3-15/1M | $15-75/1M | 推文创作、文案撰写 |
| **数据分析** | 中 | Sonnet | $3/1M | $15/1M | 数据统计、趋势分析 |
| **本地测试** | 任意 | Ollama (免费) | 免费 | 免费 | 开发测试、功能验证 |

**智能路由实现**：

```typescript
// 任务复杂度分析器
class TaskComplexityAnalyzer {
  // 分析任务复杂度
  analyzeComplexity(task: Task): number {
    let score = 0;

    // 1. 文本长度
    const textLength = task.content.length;
    if (textLength < 100) score += 0.1;
    else if (textLength < 500) score += 0.3;
    else score += 0.5;

    // 2. 关键词检测
    const complexKeywords = [
      '技术问题', '报错', 'bug', '不工作', '投诉',
      'technical', 'error', 'issue', 'complaint'
    ];
    const hasComplexKeyword = complexKeywords.some(
      keyword => task.content.toLowerCase().includes(keyword)
    );
    if (hasComplexKeyword) score += 0.3;

    // 3. 情感分析
    const sentiment = this.analyzeSentiment(task.content);
    if (sentiment === 'negative') score += 0.2;

    // 4. 历史数据
    const userHistory = this.getUserHistory(task.userId);
    if (userHistory.hasComplexInteractions) score += 0.2;

    return Math.min(score, 1.0);
  }

  // 情感分析
  private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    const negativeWords = ['不满', '失望', '糟糕', 'disappointed', 'terrible'];
    const hasNegative = negativeWords.some(word => 
      text.toLowerCase().includes(word)
    );
    return hasNegative ? 'negative' : 'neutral';
  }
}

// 模型选择器
class ModelSelector {
  private analyzer = new TaskComplexityAnalyzer();

  // 根据任务选择最佳模型
  selectModel(task: Task, budget?: Budget): string {
    const complexity = this.analyzer.analyzeComplexity(task);

    // 预算控制
    if (budget && budget.remaining < budget.threshold) {
      return this.selectBudgetModel(complexity);
    }

    // 标准选择
    if (complexity < 0.3) return 'claude-haiku-4-5-20251001';
    if (complexity < 0.7) return 'claude-sonnet-4-6';
    return 'claude-opus-4-6';
  }

  // 预算受限时的模型选择
  private selectBudgetModel(complexity: number): string {
    // 优先使用 Haiku，只有极复杂任务才用 Sonnet
    if (complexity < 0.8) return 'claude-haiku-4-5-20251001';
    return 'claude-sonnet-4-6';
  }
}

// 角色实例配置（支持多模型）
const agentInstances = [
  {
    id: 'reply-agent-simple',
    role: 'Reply Agent',
    model: 'claude-haiku-4-5-20251001',
    useCase: '简单回复、感谢、确认',
    costPerTask: 0.001, // $0.001 per task
  },
  {
    id: 'reply-agent-standard',
    role: 'Reply Agent',
    model: 'claude-sonnet-4-6',
    useCase: '常规回复、FAQ、产品介绍',
    costPerTask: 0.005, // $0.005 per task
  },
  {
    id: 'reply-agent-complex',
    role: 'Reply Agent',
    model: 'claude-opus-4-6',
    useCase: '复杂回复、技术支持、投诉处理',
    costPerTask: 0.025, // $0.025 per task
  },
  {
    id: 'reply-agent-local',
    role: 'Reply Agent',
    model: 'ollama/llama3.2',
    provider: 'ollama',
    useCase: '本地测试、开发验证',
    costPerTask: 0, // 免费
  }
];
```

### 5.2 成本优化

**策略 1：智能路由（详细实现）**

```typescript
// 成本优化控制器
class CostOptimizationController {
  private modelSelector = new ModelSelector();
  private costTracker = new CostTracker();

  // 执行任务（带成本优化）
  async executeTask(task: Task): Promise<TaskResult> {
    // 1. 获取预算信息
    const budget = await this.getBudget(task.productId);
    const spent = await this.costTracker.getSpent(task.productId);
    const remaining = budget.total - spent;

    // 2. 选择模型
    const model = this.modelSelector.selectModel(task, {
      total: budget.total,
      remaining,
      threshold: budget.total * 0.2, // 预算剩余 20% 时启用节省模式
    });

    // 3. 估算成本
    const estimatedCost = this.estimateCost(task, model);

    // 4. 预算检查
    if (estimatedCost > remaining) {
      throw new Error(
        `Insufficient budget: need $${estimatedCost}, have $${remaining}`
      );
    }

    // 5. 执行任务
    const startTime = Date.now();
    const result = await this.executeWithModel(task, model);
    const executionTime = Date.now() - startTime;

    // 6. 记录成本
    await this.costTracker.recordCost({
      productId: task.productId,
      taskId: task.id,
      model,
      inputTokens: result.metadata.inputTokens,
      outputTokens: result.metadata.outputTokens,
      cost: result.metadata.cost,
      executionTime,
    });

    return result;
  }

  // 估算任务成本
  private estimateCost(task: Task, model: string): number {
    const pricing = this.getModelPricing(model);
    const estimatedInputTokens = task.content.length * 0.3; // 粗略估算
    const estimatedOutputTokens = 500; // 平均输出

    return (
      (estimatedInputTokens * pricing.input) / 1_000_000 +
      (estimatedOutputTokens * pricing.output) / 1_000_000
    );
  }

  // 获取模型定价
  private getModelPricing(model: string): { input: number; output: number } {
    const pricing = {
      'claude-opus-4-6': { input: 15, output: 75 },
      'claude-sonnet-4-6': { input: 3, output: 15 },
      'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
      'ollama/llama3.2': { input: 0, output: 0 },
    };
    return pricing[model] || pricing['claude-sonnet-4-6'];
  }
}

// 成本追踪器
class CostTracker {
  // 记录成本
  async recordCost(record: CostRecord): Promise<void> {
    await db.costRecords.insert(record);
    
    // 更新产品总成本
    await db.products.update(record.productId, {
      totalCost: db.raw('total_cost + ?', [record.cost]),
    });
  }

  // 获取已花费金额
  async getSpent(productId: string, period?: string): Promise<number> {
    const query = db.costRecords
      .where('product_id', productId);

    if (period) {
      const startDate = this.getPeriodStartDate(period);
      query.where('created_at', '>=', startDate);
    }

    const result = await query.sum('cost as total');
    return result[0].total || 0;
  }

  // 获取成本统计
  async getCostStats(productId: string): Promise<CostStats> {
    const records = await db.costRecords
      .where('product_id', productId)
      .select('model', db.raw('SUM(cost) as total_cost'), db.raw('COUNT(*) as task_count'))
      .groupBy('model');

    return {
      byModel: records,
      total: records.reduce((sum, r) => sum + r.total_cost, 0),
      taskCount: records.reduce((sum, r) => sum + r.task_count, 0),
    };
  }
}
```

**策略 2：预算预警和限流**

```typescript
// 预算管理器
class BudgetManager {
  // 设置产品预算
  async setBudget(productId: string, budget: Budget): Promise<void> {
    await db.budgets.upsert({
      product_id: productId,
      total: budget.total,
      period: budget.period, // 'daily', 'weekly', 'monthly'
      alert_threshold: budget.alertThreshold || 0.8,
      hard_limit: budget.hardLimit || budget.total,
    });
  }

  // 检查预算状态
  async checkBudget(productId: string): Promise<BudgetStatus> {
    const budget = await db.budgets.findOne({ product_id: productId });
    const spent = await this.costTracker.getSpent(productId, budget.period);
    const remaining = budget.total - spent;
    const percentage = spent / budget.total;

    return {
      total: budget.total,
      spent,
      remaining,
      percentage,
      status: this.getBudgetStatus(percentage, budget),
    };
  }

  // 获取预算状态
  private getBudgetStatus(
    percentage: number,
    budget: Budget
  ): 'normal' | 'warning' | 'critical' | 'exceeded' {
    if (percentage >= 1.0) return 'exceeded';
    if (percentage >= 0.9) return 'critical';
    if (percentage >= budget.alert_threshold) return 'warning';
    return 'normal';
  }

  // 预算预警
  async sendBudgetAlert(productId: string, status: BudgetStatus): Promise<void> {
    if (status.status === 'warning') {
      await this.notificationService.send({
        type: 'budget_warning',
        productId,
        message: `预算使用已达 ${(status.percentage * 100).toFixed(1)}%`,
      });
    } else if (status.status === 'critical') {
      await this.notificationService.send({
        type: 'budget_critical',
        productId,
        message: `预算使用已达 ${(status.percentage * 100).toFixed(1)}%，即将耗尽`,
      });
    } else if (status.status === 'exceeded') {
      await this.notificationService.send({
        type: 'budget_exceeded',
        productId,
        message: '预算已耗尽，任务执行已暂停',
      });
    }
  }
}
```

### 5.3 多提供商支持

**优势**：
- **降低成本**：可以使用更便宜的提供商（Ollama 本地模型、DeepSeek 等）
- **提高可用性**：一个提供商故障时，自动切换到另一个
- **灵活性**：不同任务使用不同提供商
- **本地开发**：使用 Ollama 进行本地开发和测试，零成本

**Claurst 支持的提供商（30+）**：

| 提供商 | 类型 | 成本 | 适用场景 |
|--------|------|------|---------|
| **Anthropic** | 云端 | $$$ | 生产环境，高质量任务 |
| **OpenAI** | 云端 | $$$ | 生产环境，备用方案 |
| **Google Gemini** | 云端 | $$ | 长上下文任务 |
| **DeepSeek** | 云端 | $ | 成本敏感任务 |
| **Groq** | 云端 | $$ | 快速推理 |
| **Ollama** | 本地 | 免费 | 开发测试 |
| **LM Studio** | 本地 | 免费 | 开发测试 |

**配置示例（多提供商）**：

```json
// ~/.claurst/settings.json
{
  "provider": "anthropic",
  "providers": {
    "anthropic": {
      "api_key": "sk-ant-...",
      "enabled": true,
      "models_whitelist": [
        "claude-opus-4-6",
        "claude-sonnet-4-6",
        "claude-haiku-4-5-20251001"
      ]
    },
    "openai": {
      "api_key": "sk-...",
      "enabled": true,
      "models_whitelist": ["gpt-4o", "gpt-4o-mini"]
    },
    "deepseek": {
      "api_key": "sk-...",
      "enabled": true,
      "api_base": "https://api.deepseek.com/v1"
    },
    "ollama": {
      "enabled": true,
      "api_base": "http://localhost:11434/v1"
    }
  }
}
```

**多提供商路由策略**：

```typescript
// 提供商路由器
class ProviderRouter {
  private providers = ['anthropic', 'openai', 'deepseek', 'ollama'];
  private healthStatus = new Map<string, ProviderHealth>();

  // 选择最佳提供商
  selectProvider(task: Task, preferences: ProviderPreferences): string {
    // 1. 环境检查
    if (preferences.environment === 'development') {
      return 'ollama'; // 开发环境优先使用本地模型
    }

    // 2. 成本优先
    if (preferences.costPriority === 'high') {
      return this.selectCheapestProvider(task);
    }

    // 3. 质量优先
    if (preferences.qualityPriority === 'high') {
      return 'anthropic'; // Anthropic 质量最高
    }

    // 4. 健康检查
    const healthyProviders = this.getHealthyProviders();
    if (!healthyProviders.includes('anthropic')) {
      return this.selectFallbackProvider(healthyProviders);
    }

    // 5. 默认使用 Anthropic
    return 'anthropic';
  }

  // 选择最便宜的提供商
  private selectCheapestProvider(task: Task): string {
    const costs = {
      anthropic: this.estimateCost(task, 'anthropic'),
      openai: this.estimateCost(task, 'openai'),
      deepseek: this.estimateCost(task, 'deepseek'),
    };

    return Object.entries(costs).sort((a, b) => a[1] - b[1])[0][0];
  }

  // 健康检查
  async checkProviderHealth(provider: string): Promise<ProviderHealth> {
    try {
      const startTime = Date.now();
      await this.pingProvider(provider);
      const latency = Date.now() - startTime;

      return {
        provider,
        status: 'healthy',
        latency,
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        provider,
        status: 'unhealthy',
        error: error.message,
        lastCheck: new Date(),
      };
    }
  }

  // 自动故障转移
  async executeWithFailover(
    task: Task,
    primaryProvider: string
  ): Promise<TaskResult> {
    const providers = [primaryProvider, ...this.getFallbackProviders(primaryProvider)];

    for (const provider of providers) {
      try {
        console.log(`Attempting to execute task with provider: ${provider}`);
        const result = await this.executeWithProvider(task, provider);
        return result;
      } catch (error) {
        console.error(`Provider ${provider} failed:`, error.message);
        
        // 标记提供商为不健康
        this.healthStatus.set(provider, {
          provider,
          status: 'unhealthy',
          error: error.message,
          lastCheck: new Date(),
        });

        // 如果是最后一个提供商，抛出错误
        if (provider === providers[providers.length - 1]) {
          throw new Error('All providers failed');
        }

        // 继续尝试下一个提供商
        continue;
      }
    }
  }

  // 获取备用提供商
  private getFallbackProviders(primary: string): string[] {
    const fallbackMap = {
      anthropic: ['openai', 'deepseek'],
      openai: ['anthropic', 'deepseek'],
      deepseek: ['anthropic', 'openai'],
      ollama: ['anthropic'],
    };
    return fallbackMap[primary] || ['anthropic'];
  }
}

// 提供商健康监控
class ProviderHealthMonitor {
  private router = new ProviderRouter();
  private checkInterval = 60000; // 1 分钟

  // 启动健康监控
  start(): void {
    setInterval(async () => {
      await this.checkAllProviders();
    }, this.checkInterval);
  }

  // 检查所有提供商
  private async checkAllProviders(): Promise<void> {
    const providers = ['anthropic', 'openai', 'deepseek', 'ollama'];
    
    const results = await Promise.all(
      providers.map(p => this.router.checkProviderHealth(p))
    );

    // 记录健康状态
    for (const result of results) {
      console.log(`Provider ${result.provider}: ${result.status}`);
      
      if (result.status === 'unhealthy') {
        // 发送告警
        await this.sendAlert({
          provider: result.provider,
          error: result.error,
        });
      }
    }
  }

  // 发送告警
  private async sendAlert(alert: { provider: string; error: string }): Promise<void> {
    // 实现告警逻辑（邮件、Slack 等）
    console.error(`ALERT: Provider ${alert.provider} is unhealthy: ${alert.error}`);
  }
}
```

## 6. TypeScript vs Rust 的集成方式

### 6.1 集成方式对比

**方式 1：进程通信（推荐）**

```typescript
// TweetPilot (TypeScript) 启动 Claurst 进程
const claurst = spawn('claurst', ['--agent', 'reply-agent'], {
  env: { WORKSPACE_ID: 'prod-123' }
});

// 通过 stdin/stdout 通信
claurst.stdin.write(JSON.stringify({ task: '...' }) + '\n');
claurst.stdout.on('data', (data) => {
  const result = JSON.parse(data.toString());
  // 处理结果
});
```

**优点**：
- ✅ 简单，易于实现
- ✅ 隔离性好，Claurst 崩溃不影响 TweetPilot
- ✅ 不需要修改 Claurst 源码，避免 GPL 传染
- ✅ 跨语言，TypeScript 和 Rust 完全解耦

**缺点**：
- ⚠️ 进程启动有开销（约 100-200ms）
- ⚠️ 通信有序列化/反序列化开销

**方式 2：HTTP API**

```typescript
// Claurst 提供 HTTP API（需要开发）
const response = await fetch('http://localhost:3000/api/agent/reply', {
  method: 'POST',
  body: JSON.stringify({ task: '...' })
});
const result = await response.json();
```

**优点**：
- ✅ 标准化，易于调试
- ✅ 可以远程部署 Claurst
- ✅ 支持负载均衡

**缺点**：
- ❌ 需要额外开发 HTTP API 层
- ❌ 增加网络延迟
- ❌ 需要处理认证和安全

**方式 3：FFI（Foreign Function Interface）**

```typescript
// 通过 Node.js FFI 调用 Rust 库
const ffi = require('ffi-napi');
const claurst = ffi.Library('libclaurst.so', {
  'execute_task': ['string', ['string']]
});

const result = claurst.execute_task(JSON.stringify({ task: '...' }));
```

**优点**：
- ✅ 性能最高，无进程启动开销
- ✅ 无序列化开销

**缺点**：
- ❌ 复杂度高，需要维护 C ABI
- ❌ 可能触发 GPL 传染（链接 GPL 库）
- ❌ 调试困难
- ❌ 跨平台兼容性问题

### 6.2 推荐方案

**第一阶段：进程通信**
- 简单快速，易于实现
- 避免 GPL 风险
- 适合快速验证

**第二阶段：HTTP API（可选）**
- 如果需要远程部署或负载均衡
- 标准化，易于扩展

### 6.3 性能和开发效率的权衡

**Rust 的优势**：
- 性能高（比 TypeScript 快 10-100 倍）
- 内存安全
- 适合 CPU 密集型任务

**TypeScript 的优势**：
- 开发效率高
- 生态丰富（npm 包）
- 团队熟悉

**推荐分工**：
- **核心模块用 Rust**：Claurst Agent 引擎（已有）
- **业务模块用 TypeScript**：TweetPilot 平台（产品管理、任务管理、UI）
- **通过进程通信集成**：发挥各自优势

## 7. 技术风险评估与缓解方案

### 7.1 GPL-3.0 许可证风险

**风险描述**：
- 如果修改 Claurst 源码，TweetPilot 必须开源（GPL 传染）
- 影响：高（可能影响商业化）
- 概率：中（如果不注意容易触发）

**详细缓解措施**：

```typescript
// 1. 进程隔离架构（避免 GPL 传染）
class ClaurstIsolationLayer {
  // 通过进程通信，完全隔离 Claurst
  // TweetPilot 不链接 Claurst 的任何代码
  // 不修改 Claurst 源码，只通过标准接口通信
  
  private async startIsolatedProcess(): Promise<ChildProcess> {
    // 启动独立的 Claurst 进程
    return spawn('claurst', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false, // 不分离进程，保持控制
    });
  }
}

// 2. MCP 扩展层（所有扩展通过 MCP）
// 不修改 Claurst 源码，所有功能扩展通过 MCP 协议
class TwitterMCPServer {
  // MCP 服务器是独立的 Node.js 进程
  // 不包含 Claurst 代码，不受 GPL 影响
}

// 3. Fallback 方案（直接调用 Claude API）
class ClaudeAPIFallback {
  // 如果 Claurst 有法律风险，可以切换到直接调用 API
  async executeTask(task: Task): Promise<TaskResult> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: task.prompt }],
      }),
    });
    
    return await response.json();
  }
}
```

**合规性检查清单**：
- [ ] 确认不修改 Claurst 源码
- [ ] 确认通过进程隔离使用
- [ ] 确认所有扩展通过 MCP 实现
- [ ] 咨询法律顾问确认合规性
- [ ] 准备 Fallback 方案并测试

### 7.2 版本稳定性风险

**风险描述**：
- Claurst 版本 0.0.9，早期版本，可能不稳定
- 影响：高（可能导致生产故障）
- 概率：中（早期版本通常有 bug）

**详细缓解措施**：

```typescript
// 1. 版本锁定和管理
class ClaurstVersionManager {
  private readonly LOCKED_VERSION = '0.0.9';
  private readonly VERSION_CHECK_INTERVAL = 86400000; // 24 小时

  // 检查 Claurst 版本
  async checkVersion(): Promise<void> {
    const installedVersion = await this.getInstalledVersion();
    
    if (installedVersion !== this.LOCKED_VERSION) {
      throw new Error(
        `Claurst version mismatch: expected ${this.LOCKED_VERSION}, got ${installedVersion}`
      );
    }
  }

  // 获取安装的版本
  private async getInstalledVersion(): Promise<string> {
    const result = await execAsync('claurst --version');
    return result.stdout.trim();
  }
}

// 2. 健壮的错误处理和重试
class ClaurstErrorHandler {
  private maxRetries = 3;
  private retryDelay = 1000;

  async executeWithRetry(
    task: Task,
    attempt: number = 1
  ): Promise<TaskResult> {
    try {
      return await this.execute(task);
    } catch (error) {
      console.error(`Claurst execution failed (attempt ${attempt}):`, error);

      // 记录错误
      await this.logError(error, task);

      // 如果是 Claurst 崩溃，尝试重启
      if (this.isProcessCrash(error)) {
        await this.restartProcess();
      }

      // 重试
      if (attempt < this.maxRetries) {
        await this.sleep(this.retryDelay * attempt);
        return await this.executeWithRetry(task, attempt + 1);
      }

      // 所有重试失败，使用 Fallback
      console.warn('All retries failed, using fallback');
      return await this.fallbackExecutor.execute(task);
    }
  }

  // 判断是否是进程崩溃
  private isProcessCrash(error: Error): boolean {
    return (
      error.message.includes('SIGKILL') ||
      error.message.includes('SIGTERM') ||
      error.message.includes('Process exited')
    );
  }
}

// 3. 监控和告警
class ClaurstMonitor {
  private metrics = {
    successCount: 0,
    failureCount: 0,
    crashCount: 0,
    avgExecutionTime: 0,
  };

  // 记录执行结果
  recordExecution(result: ExecutionResult): void {
    if (result.success) {
      this.metrics.successCount++;
    } else {
      this.metrics.failureCount++;
      
      if (result.error.type === 'crash') {
        this.metrics.crashCount++;
      }
    }

    // 更新平均执行时间
    this.metrics.avgExecutionTime =
      (this.metrics.avgExecutionTime * 0.9 + result.executionTime * 0.1);

    // 检查是否需要告警
    this.checkAlerts();
  }

  // 检查告警条件
  private checkAlerts(): void {
    const total = this.metrics.successCount + this.metrics.failureCount;
    const failureRate = this.metrics.failureCount / total;

    // 失败率超过 10%
    if (failureRate > 0.1) {
      this.sendAlert({
        type: 'high_failure_rate',
        message: `Claurst failure rate: ${(failureRate * 100).toFixed(1)}%`,
      });
    }

    // 崩溃次数超过 5 次
    if (this.metrics.crashCount > 5) {
      this.sendAlert({
        type: 'frequent_crashes',
        message: `Claurst crashed ${this.metrics.crashCount} times`,
      });
    }
  }
}

// 4. Fallback 方案
class FallbackExecutor {
  // 直接调用 Claude API
  async execute(task: Task): Promise<TaskResult> {
    console.log('Using fallback: direct Claude API call');
    
    const response = await this.claudeAPI.createMessage({
      model: task.model || 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: task.prompt }],
    });

    return {
      success: true,
      result: response.content[0].text,
      metadata: {
        model: response.model,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        fallback: true,
      },
    };
  }
}
```

### 7.3 集成复杂度风险

**风险描述**：
- TypeScript 和 Rust 集成复杂
- 进程通信可能不稳定
- 影响：中（可能导致通信失败）
- 概率：中（跨语言集成通常有挑战）

**详细缓解措施**：

```typescript
// 1. 标准化通信协议
interface ClaurstMessage {
  version: '1.0';
  type: 'request' | 'response' | 'error';
  id: string;
  timestamp: number;
  payload: any;
}

class ClaurstProtocol {
  private readonly PROTOCOL_VERSION = '1.0';

  // 编码消息
  encode(message: ClaurstMessage): string {
    return JSON.stringify(message) + '\n';
  }

  // 解码消息
  decode(data: string): ClaurstMessage {
    try {
      const message = JSON.parse(data);
      
      // 验证协议版本
      if (message.version !== this.PROTOCOL_VERSION) {
        throw new Error(`Protocol version mismatch: ${message.version}`);
      }

      return message;
    } catch (error) {
      throw new Error(`Failed to decode message: ${error.message}`);
    }
  }
}

// 2. 健壮的进程管理
class RobustProcessManager {
  private processes = new Map<string, ManagedProcess>();
  private healthCheckInterval = 30000; // 30 秒

  // 启动健康检查
  startHealthCheck(): void {
    setInterval(() => {
      this.checkAllProcesses();
    }, this.healthCheckInterval);
  }

  // 检查所有进程
  private async checkAllProcesses(): Promise<void> {
    for (const [id, process] of this.processes) {
      const isHealthy = await this.checkProcessHealth(process);
      
      if (!isHealthy) {
        console.warn(`Process ${id} is unhealthy, restarting...`);
        await this.restartProcess(id);
      }
    }
  }

  // 检查进程健康
  private async checkProcessHealth(process: ManagedProcess): Promise<boolean> {
    try {
      // 发送 ping 消息
      const response = await process.ping({ timeout: 5000 });
      return response.status === 'ok';
    } catch (error) {
      return false;
    }
  }

  // 重启进程
  private async restartProcess(id: string): Promise<void> {
    const process = this.processes.get(id);
    if (!process) return;

    // 杀死旧进程
    await process.kill();

    // 启动新进程
    const newProcess = await this.startProcess(process.config);
    this.processes.set(id, newProcess);
  }
}

// 3. 边界情况测试
class ClaurstIntegrationTests {
  // 测试大消息
  async testLargeMessage(): Promise<void> {
    const largePrompt = 'x'.repeat(100000); // 100KB
    const result = await this.claurst.execute({ prompt: largePrompt });
    assert(result.success);
  }

  // 测试并发
  async testConcurrency(): Promise<void> {
    const tasks = Array(10).fill(null).map((_, i) => ({
      prompt: `Task ${i}`,
    }));

    const results = await Promise.all(
      tasks.map(task => this.claurst.execute(task))
    );

    assert(results.every(r => r.success));
  }

  // 测试进程崩溃恢复
  async testCrashRecovery(): Promise<void> {
    // 杀死进程
    await this.claurst.kill();

    // 尝试执行任务（应该自动重启）
    const result = await this.claurst.execute({ prompt: 'test' });
    assert(result.success);
  }
}
```

### 7.4 性能风险

**风险描述**：
- 进程通信可能有性能开销
- 影响：中（可能影响用户体验）
- 概率：低（通常可以优化）

**详细缓解措施**：

```typescript
// 1. 性能监控
class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric>();

  // 记录性能指标
  record(operation: string, duration: number): void {
    const metric = this.metrics.get(operation) || {
      count: 0,
      totalDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
    };

    metric.count++;
    metric.totalDuration += duration;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);

    this.metrics.set(operation, metric);
  }

  // 获取性能报告
  getReport(): PerformanceReport {
    const report = {};
    
    for (const [operation, metric] of this.metrics) {
      report[operation] = {
        avgDuration: metric.totalDuration / metric.count,
        minDuration: metric.minDuration,
        maxDuration: metric.maxDuration,
        count: metric.count,
      };
    }

    return report;
  }
}

// 2. 进程池优化
class OptimizedProcessPool {
  private pool: ClaurstProcess[] = [];
  private maxPoolSize = 5;
  private minPoolSize = 2;

  // 预热进程池
  async warmup(): Promise<void> {
    const promises = Array(this.minPoolSize)
      .fill(null)
      .map(() => this.createProcess());

    this.pool = await Promise.all(promises);
  }

  // 获取进程（复用）
  async getProcess(): Promise<ClaurstProcess> {
    // 查找空闲进程
    const idleProcess = this.pool.find(p => p.isIdle());
    if (idleProcess) {
      return idleProcess;
    }

    // 如果池未满，创建新进程
    if (this.pool.length < this.maxPoolSize) {
      const newProcess = await this.createProcess();
      this.pool.push(newProcess);
      return newProcess;
    }

    // 等待进程空闲
    return await this.waitForIdleProcess();
  }
}

// 3. 异步处理
class AsyncTaskQueue {
  private queue: Task[] = [];
  private processing = false;

  // 添加任务到队列
  async enqueue(task: Task): Promise<string> {
    const taskId = this.generateTaskId();
    this.queue.push({ ...task, id: taskId });
    
    // 触发处理
    this.processQueue();
    
    return taskId;
  }

  // 处理队列
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      
      try {
        const result = await this.claurst.execute(task);
        await this.saveResult(task.id, result);
      } catch (error) {
        await this.saveError(task.id, error);
      }
    }

    this.processing = false;
  }
}
```

### 7.5 风险总结和优先级

| 风险 | 影响 | 概率 | 优先级 | 缓解状态 |
|------|------|------|--------|---------|
| GPL-3.0 许可证 | 高 | 中 | P0 | ✅ 已缓解 |
| 版本稳定性 | 高 | 中 | P0 | ✅ 已缓解 |
| 集成复杂度 | 中 | 中 | P1 | ✅ 已缓解 |
| 性能问题 | 中 | 低 | P2 | ✅ 已缓解 |

**总体风险评估**：可控

所有识别的风险都有明确的缓解措施,并且已经实现了详细的技术方案。通过进程隔离、版本锁定、健壮的错误处理、性能优化等措施,可以将风险降低到可接受的水平。

## 8. 总结

### 8.1 核心结论

**Claurst 高度匹配 TweetPilot 的需求**：
- ✅ Agent 编排能力（Coordinator 模式、Managed Agents）
- ✅ 会话管理能力（长期会话，积累经验）
- ✅ 多模型支持（30+ 提供商，成本优化）
- ✅ MCP 协议支持（扩展 Twitter、知识库、数据访问）

**推荐集成方案**：
- ✅ **单 Claurst 进程模式**：一个 TweetPilot 实例 = 一个产品 = 一个 Claurst 进程
- ✅ **使用 Claurst 二进制 + MCP 扩展**：不 Fork 源码，通过 MCP 协议扩展所有能力
- ✅ **LocalBridge 三层架构**：LocalBridge → LocalBridgeDriver → Twitter MCP Server → Claurst
- ✅ **Coordinator Mode**：利用 Managed Agents 优化成本和性能
- ✅ **Multi-Provider 支持**：灵活选择模型，成本优化

**预期收益**：
- ✅ 节省 3-6 个月 Agent 引擎开发时间
- ✅ 成本降低 70-80%（Managed Agents）
- ✅ 性能提升（并行执行）
- ✅ 质量保证（Rust 实现，成熟设计）
- ✅ 避免 GPL-3.0 风险（不修改 Claurst 源码）
- ✅ 升级灵活（直接替换二进制）

### 8.2 三个关键架构决策

#### 决策 1: 单 Claurst 进程模式

**结论**: 采用单产品模式，不需要 Claurst 进程池

**理由**:
- Claurst Coordinator Mode 本身就是进程池管理器
- 一个 Coordinator 可以管理多个 Worker Agent
- 符合产品中心化理念（一个 IDE 管理一个工程）
- 简化架构，降低复杂度

**实施**:
- 一个 TweetPilot 窗口 = 一个产品 = 一个 Claurst 进程
- 如果用户需要管理多个产品，打开多个 TweetPilot 窗口
- 操作系统级别的进程隔离，更安全

#### 决策 2: 使用 Claurst 二进制 + MCP 扩展

**结论**: 不 Fork Claurst 源码，通过 MCP 协议扩展所有能力

**理由**:
- ✅ **避免 GPL-3.0 传染**: 不修改 Claurst 源码，TweetPilot 可以保持私有
- ✅ **MCP 协议足够强大**: 可以实现任何自定义能力，包括 Twitter 特定操作
- ✅ **升级简单**: Claurst 发布新版本，直接替换二进制即可
- ✅ **维护成本低**: 不需要维护 fork，不需要合并上游更新
- ✅ **社区支持**: 享受 Claurst 社区的 bug 修复和新特性

**实施**:
- 开发 3 个 MCP Server：Twitter、知识库、数据访问
- Twitter MCP Server 封装 LocalBridge 能力
- Claurst 通过 MCP 协议调用，完全解耦

#### 决策 3: LocalBridge REST API 架构与 MCP 集成路径

**结论**: LocalBridge 是独立的 REST API 服务，支持多种集成路径

**当前架构（P0）**:
```
Claurst Agent → Twitter MCP Server → HTTP Client → LocalBridge REST API
```

**可选路径（P1/P2）**:
- P1: LocalBridge MCP 协议转换（统一接口）
- P2: X 官方 API 集成（官方 API，按使用量计费）

**理由**:
- LocalBridge REST API 服务已开发完成，不需要修改
- HTTP Client 提供类型安全的抽象层
- Twitter MCP Server 暴露标准 MCP 接口
- Claurst 通过 MCP 协议调用，完全解耦
- 架构灵活，支持未来切换到 X 官方 API

**实施**:
- 开发 LocalBridgeClient（TypeScript HTTP Client）
- 开发 Twitter MCP Server（封装 LocalBridgeClient）
- 配置 Claurst 连接 Twitter MCP Server
- （可选）开发 LocalBridge MCP 协议转换层
- （可选）集成 X 官方 API

### 8.3 技术风险可控

**GPL-3.0 许可证**：通过进程隔离使用，不修改源码，风险可控

**版本稳定性**：锁定版本，准备 fallback，风险可控

**集成复杂度**：使用标准协议，充分测试，风险可控

**性能**：单进程 Coordinator Mode，异步处理，风险可控

### 8.4 下一步行动

1. **验证 Claurst 能力**（1 周）
   - 安装 Claurst
   - 测试 Coordinator Mode（Managed Agents）
   - 测试 Multi-Provider
   - 测试 MCP 协议

2. **开发 LocalBridge HTTP Client**（1 周）
   - 实现 ILocalBridgeClient 接口
   - 实现 HTTP 请求封装和错误处理
   - 单元测试

3. **开发 Twitter MCP Server**（2 周）
   - 封装 LocalBridgeClient
   - 实现 MCP 协议
   - 定义所有 Twitter 工具
   - 集成测试

4. **开发其他 MCP Server**（1 周）
   - 知识库 MCP Server
   - 数据访问 MCP Server

5. **集成 Claurst**（1 周）
   - 配置 Claurst 连接 MCP Servers
   - 测试 Coordinator Mode 工作流
   - 端到端测试

6. **完整集成**（2 周）
   - 集成到 TweetPilot 平台
   - 实现 Reply Agent 完整工作流
   - 性能测试和优化

7. **可选工作（P1/P2）**
   - P1: 开发 LocalBridge MCP 协议转换层（1-2 周）
   - P2: 集成 X 官方 API（1-2 周）

**总时间**: 约 8 周（核心功能）+ 2-4 周（可选功能）

---

**文档状态**：✅ 完整版本完成（基于 LocalBridge REST API 架构）
**关键更新**：
- 更新为 LocalBridge REST API 架构（不再是 stdin/stdout 通信）
- 添加 LocalBridge HTTP Client 实现
- 更新 Twitter MCP Server 以使用 HTTP Client
- 添加可选的 MCP 集成路径（P1/P2）
- 添加 X 官方 API 集成选项（按使用量计费）
- 更新所有架构图和数据流图

**下一步**：开始编写模块化架构设计文档
