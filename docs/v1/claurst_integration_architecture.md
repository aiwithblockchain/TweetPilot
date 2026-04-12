# TweetPilot 与 Claurst 集成架构设计

## 版本信息
- 版本：v2.0.0
- 更新日期：2026-04-12
- 文档状态：完整架构设计版

## 1. 架构概述

TweetPilot 采用**产品中心化 + 角色实例 + Claurst 会话**的多层架构设计。

### 1.1 核心理念

**产品是场景切换的第一步**：
- 用户进入平台后，首先选择产品（类似 VS Code 选择工作区）
- 每个产品有独立的配置、知识库、账号、团队
- 切换产品 = 切换整个工作场景

**角色实例是任务执行的基本单元**：
- 角色定义（Reply Agent、Content Agent、Growth Agent）是模板
- 角色实例是具体的 AI 成员，可以配置不同的模型
- 每个角色实例对应一个 Claurst 会话，用于积累经验

**任务会话是协作的容器**：
- 用户处理一个任务时创建任务会话
- 任务会话包含多个角色实例协作完成任务
- 任务完成后，任务会话结束，但角色实例的 Claurst 会话继续保留

### 1.2 层级关系

```
平台
  ↓
产品（场景切换）
  ├── 产品配置（知识库、账号、团队）
  ├── 角色实例池
  │   ├── Reply Agent #1 (Sonnet) → Claurst Session A1
  │   ├── Reply Agent #2 (Opus) → Claurst Session A2
  │   ├── Content Agent #1 (Sonnet) → Claurst Session B1
  │   └── Growth Agent #1 (Haiku) → Claurst Session C1
  └── 任务列表
      ├── 任务 1（评论回复）
      │   ├── 使用 Reply Agent #1
      │   └── 使用 Content Agent #1
      └── 任务 2（内容创作）
          └── 使用 Content Agent #1
```

## 2. 详细架构设计

### 2.1 产品层

**产品是顶层隔离单元**，包含：

```typescript
interface Product {
  id: string;
  name: string;
  description: string;
  
  // 产品配置
  config: {
    knowledgeBase: KnowledgeBaseConfig;  // 产品专属知识库
    accounts: TwitterAccount[];          // 运营该产品的 Twitter 账号
    team: TeamMember[];                  // 运营团队
    settings: ProductSettings;           // 产品专属设置
  };
  
  // 角色实例池
  agentInstances: AgentInstance[];
  
  // 任务列表
  tasks: Task[];
  
  // 数据沉淀
  dataAssets: {
    tweetHistory: TweetHistory[];
    interactionStats: InteractionStats[];
    trends: TrendSnapshot[];
  };
}
```

**产品切换流程**：
1. 用户在产品选择器中选择产品
2. 加载产品配置（知识库、账号、团队）
3. 加载产品的角色实例池
4. 进入产品工作台

### 2.2 角色实例层

**角色定义 vs 角色实例**：

```typescript
// 角色定义（模板）
interface AgentRole {
  id: string;
  name: string;  // "Reply Agent", "Content Agent", "Growth Agent"
  description: string;
  defaultPrompt: string;
  defaultModel: string;
  capabilities: string[];
}

// 角色实例（具体的 AI 成员）
interface AgentInstance {
  id: string;
  roleId: string;  // 引用角色定义
  name: string;    // "Reply Agent #1", "Reply Agent #2"
  productId: string;
  
  // 实例配置
  config: {
    model: string;           // "claude-sonnet-4-6", "claude-opus-4-6"
    temperature: number;
    maxTurns: number;
    customPrompt?: string;   // 覆盖默认 prompt
  };
  
  // Claurst 会话
  claurstSession: {
    sessionId: string;       // Claurst 会话 ID
    sessionPath: string;     // 会话文件路径
    createdAt: Date;
    lastActiveAt: Date;
  };
  
  // 实例状态
  status: 'active' | 'idle' | 'busy';
  stats: {
    tasksCompleted: number;
    successRate: number;
    avgResponseTime: number;
  };
}
```

**角色实例的生命周期**：
1. **创建**：用户在产品中创建角色实例，指定角色类型和模型
2. **初始化**：创建对应的 Claurst 会话，初始化系统提示词
3. **使用**：任务分配给角色实例，通过 Claurst 会话执行
4. **学习**：每次任务执行后，经验积累在 Claurst 会话中
5. **保留**：角色实例长期存在，持续积累经验

### 2.3 任务会话层

**任务会话是协作的容器**：

```typescript
interface TaskSession {
  id: string;
  productId: string;
  taskType: 'reply' | 'content' | 'growth' | 'analysis';
  
  // 任务上下文
  context: {
    workspaceId: string;
    accountId: string;
    targetId: string;  // 评论 ID、推文 ID 等
    metadata: Record<string, any>;
  };
  
  // 参与的角色实例
  participants: {
    agentInstanceId: string;
    role: 'primary' | 'reviewer' | 'assistant';
    claurstSessionId: string;
  }[];
  
  // 任务状态
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: TaskResult;
  
  // 时间戳
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}
```

**任务执行流程**：
1. **创建任务会话**：用户发起任务，系统创建任务会话
2. **分配角色实例**：根据任务类型，分配合适的角色实例
3. **执行任务**：
   - 每个角色实例通过自己的 Claurst 会话执行
   - 传递任务上下文（产品 ID、工作区 ID、账号 ID）
   - Claurst 会话调用 MCP 工具获取数据
   - 生成结果
4. **协作**：多个角色实例可以协作（例如 Reply Agent 生成回复，Content Agent 审核）
5. **完成任务**：收集结果，更新任务状态
6. **保留经验**：任务会话结束，但角色实例的 Claurst 会话保留经验

### 2.4 Claurst 会话层

**每个角色实例对应一个 Claurst 会话**：

```
产品 A
├── Reply Agent #1 → Claurst Session A1
│   └── 会话历史：处理过的所有回复任务
├── Reply Agent #2 → Claurst Session A2
│   └── 会话历史：处理过的所有回复任务
├── Content Agent #1 → Claurst Session B1
│   └── 会话历史：处理过的所有内容创作任务
└── Growth Agent #1 → Claurst Session C1
    └── 会话历史：处理过的所有增长任务

产品 B
├── Reply Agent #3 → Claurst Session A3
└── Content Agent #2 → Claurst Session B2
```

**会话存储位置**：
```
~/.claurst/projects/tweetpilot/
├── reply-agent-1-{uuid}.jsonl      # Reply Agent #1 的会话
├── reply-agent-2-{uuid}.jsonl      # Reply Agent #2 的会话
├── content-agent-1-{uuid}.jsonl    # Content Agent #1 的会话
└── growth-agent-1-{uuid}.jsonl     # Growth Agent #1 的会话
```

**会话内容示例**：
```jsonl
{"type":"user","message":{"role":"user","content":"处理评论回复任务：产品ID=prod-123, 账号ID=acc-456, 评论ID=comment-789"},"timestamp":"2026-04-12T10:00:00Z"}
{"type":"assistant","message":{"role":"assistant","content":"我会处理这个评论回复任务..."},"timestamp":"2026-04-12T10:00:05Z"}
{"type":"user","message":{"role":"user","content":"处理评论回复任务：产品ID=prod-123, 账号ID=acc-456, 评论ID=comment-790"},"timestamp":"2026-04-12T11:00:00Z"}
{"type":"assistant","message":{"role":"assistant","content":"基于之前的经验，我会..."},"timestamp":"2026-04-12T11:00:05Z"}
```

**会话的价值**：
- **经验积累**：每次任务执行后，经验积累在会话中
- **上下文保留**：角色实例可以记住之前处理过的类似任务
- **风格一致性**：同一个角色实例处理的任务保持风格一致
- **学习能力**：角色实例可以从成功和失败中学习

## 3. MCP 服务层设计

### 3.1 MCP 全局配置

**所有角色实例共享相同的 MCP 服务器配置**：

```json
// ~/.claurst/settings.json
{
  "config": {
    "mcp_servers": [
      {
        "name": "twitter",
        "command": "node",
        "args": ["./mcp-servers/twitter/index.js"],
        "type": "stdio"
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

### 3.2 MCP 工具设计（参数化）

**MCP 工具接收运行时参数，根据参数返回不同数据**：

```typescript
// Twitter MCP 服务器
class TwitterMCPServer {
  async twitter_get_comments(params: {
    productId: string;      // 产品 ID
    workspaceId: string;    // 工作区 ID
    accountId: string;      // 账号 ID
    tweetId: string;        // 推文 ID
  }) {
    // 1. 根据 productId 和 workspaceId 获取凭证
    const credentials = await this.getCredentials(params.productId, params.accountId);
    
    // 2. 使用凭证调用 Twitter API
    const comments = await this.twitterAPI.getComments(params.tweetId, credentials);
    
    // 3. 返回评论数据
    return comments;
  }
  
  async twitter_reply(params: {
    productId: string;
    workspaceId: string;
    accountId: string;
    commentId: string;
    content: string;
  }) {
    // 根据参数发送回复
    const credentials = await this.getCredentials(params.productId, params.accountId);
    return await this.twitterAPI.reply(params.commentId, params.content, credentials);
  }
}

// 知识库 MCP 服务器
class KnowledgeMCPServer {
  async knowledge_search(params: {
    productId: string;      // 产品 ID
    workspaceId: string;    // 工作区 ID
    query: string;
  }) {
    // 1. 根据 productId 加载对应的知识库
    const knowledgeBase = await this.loadKnowledgeBase(params.productId);
    
    // 2. 搜索知识库
    const results = await knowledgeBase.search(params.query);
    
    // 3. 返回搜索结果
    return results;
  }
  
  async knowledge_get_faq(params: {
    productId: string;
    workspaceId: string;
    category?: string;
  }) {
    // 根据 productId 返回对应的 FAQ
    const knowledgeBase = await this.loadKnowledgeBase(params.productId);
    return await knowledgeBase.getFAQ(params.category);
  }
}

// 数据访问 MCP 服务器
class DataMCPServer {
  async data_get_tweet_history(params: {
    productId: string;
    workspaceId: string;
    accountId: string;
    startDate?: string;
    endDate?: string;
  }) {
    // 根据 productId 和 accountId 查询历史推文
    return await this.database.getTweetHistory({
      productId: params.productId,
      accountId: params.accountId,
      startDate: params.startDate,
      endDate: params.endDate,
    });
  }
  
  async data_get_interaction_stats(params: {
    productId: string;
    workspaceId: string;
    accountId: string;
    period: string;
  }) {
    // 根据 productId 和 accountId 返回互动统计
    return await this.database.getInteractionStats({
      productId: params.productId,
      accountId: params.accountId,
      period: params.period,
    });
  }
}
```

### 3.3 工作流程

```
用户发起任务
  ↓
TweetPilot 创建任务会话
  ↓
分配角色实例（例如 Reply Agent #1）
  ↓
构建任务提示词（包含产品 ID、工作区 ID、账号 ID）
  ↓
发送到 Reply Agent #1 的 Claurst 会话
  ↓
Claurst 会话调用 MCP 工具
  ├── twitter_get_comments(productId, workspaceId, accountId, tweetId)
  ├── knowledge_search(productId, workspaceId, query)
  └── data_get_tweet_history(productId, workspaceId, accountId)
  ↓
MCP 服务器根据参数返回对应数据
  ↓
Claurst 会话生成回复
  ↓
返回结果给 TweetPilot
  ↓
TweetPilot 更新任务状态
  ↓
经验保留在 Claurst 会话中
```

## 4. 完整架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        TweetPilot 平台                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                    产品选择器                           │    │
│  │  [产品 A] [产品 B] [产品 C]                            │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                 产品 A 工作台                           │    │
│  │                                                         │    │
│  │  产品配置                                               │    │
│  │  ├── 知识库：产品 A 的 FAQ、产品资料                   │    │
│  │  ├── 账号：@ProductA_Official, @ProductA_Support       │    │
│  │  └── 团队：运营团队成员                                │    │
│  │                                                         │    │
│  │  角色实例池                                             │    │
│  │  ├── Reply Agent #1 (Sonnet) → Session A1              │    │
│  │  ├── Reply Agent #2 (Opus) → Session A2                │    │
│  │  ├── Content Agent #1 (Sonnet) → Session B1            │    │
│  │  └── Growth Agent #1 (Haiku) → Session C1              │    │
│  │                                                         │    │
│  │  任务列表                                               │    │
│  │  ├── 任务 1：回复评论 #12345                           │    │
│  │  │   └── 使用 Reply Agent #1                           │    │
│  │  ├── 任务 2：创作推文                                   │    │
│  │  │   └── 使用 Content Agent #1                         │    │
│  │  └── 任务 3：分析增长数据                              │    │
│  │      └── 使用 Growth Agent #1                          │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              MCP 服务层（全局配置）                     │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │    │
│  │  │ Twitter  │  │ 知识库   │  │ 数据访问 │             │    │
│  │  │ MCP      │  │ MCP      │  │ MCP      │             │    │
│  │  └──────────┘  └──────────┘  └──────────┘             │    │
│  │  根据运行时参数（产品ID、工作区ID）返回不同数据        │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Claurst 会话层                             │    │
│  │  ┌──────────────────────────────────────────────┐      │    │
│  │  │ Reply Agent #1 Session (A1)                  │      │    │
│  │  │ - 处理过 50 个回复任务                       │      │    │
│  │  │ - 学会了产品 A 的回复风格                    │      │    │
│  │  │ - 积累了常见问题的回复模板                   │      │    │
│  │  └──────────────────────────────────────────────┘      │    │
│  │  ┌──────────────────────────────────────────────┐      │    │
│  │  │ Content Agent #1 Session (B1)                │      │    │
│  │  │ - 创作过 30 条推文                           │      │    │
│  │  │ - 学会了产品 A 的品牌语气                    │      │    │
│  │  │ - 知道什么样的内容更受欢迎                   │      │    │
│  │  └──────────────────────────────────────────────┘      │    │
│  │  ┌──────────────────────────────────────────────┐      │    │
│  │  │ Growth Agent #1 Session (C1)                 │      │    │
│  │  │ - 分析过 20 次增长数据                       │      │    │
│  │  │ - 学会了产品 A 的增长模式                    │      │    │
│  │  │ - 知道什么样的策略更有效                     │      │    │
│  │  └──────────────────────────────────────────────┘      │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## 5. 关键优势

### 5.1 产品中心化体验
- ✅ 用户首先选择产品，进入产品专属的工作场景
- ✅ 每个产品有独立的配置、知识库、账号、团队
- ✅ 类似 VS Code 的工作区体验，直观易用

### 5.2 角色实例的灵活性
- ✅ 可以创建多个相同角色的实例，配置不同模型
- ✅ 可以根据任务需求选择合适的角色实例
- ✅ 可以对比不同模型的效果（例如 Sonnet vs Opus）

### 5.3 经验积累和学习
- ✅ 每个角色实例有独立的 Claurst 会话，积累专业经验
- ✅ 角色实例可以记住之前处理过的类似任务
- ✅ 角色实例可以从成功和失败中学习，持续改进

### 5.4 配置简单
- ✅ MCP 服务器全局配置一次，所有角色实例共享
- ✅ MCP 工具根据运行时参数返回不同数据，灵活高效
- ✅ 不需要为每个产品或角色实例单独配置 MCP

### 5.5 任务协作
- ✅ 任务会话可以包含多个角色实例协作
- ✅ 例如：Reply Agent 生成回复，Content Agent 审核
- ✅ 角色实例之间可以互相学习和配合

### 5.6 数据隔离
- ✅ 产品之间数据完全隔离
- ✅ 角色实例之间会话完全隔离
- ✅ MCP 服务器根据参数返回对应产品的数据

## 6. 实施路径

### 阶段 1：基础架构搭建（2-3 周）

**目标**：建立产品中心化的基础架构

**任务**：
1. 实现产品数据模型
2. 实现产品选择器 UI
3. 实现产品工作台 UI
4. 实现角色定义和角色实例数据模型

**关键文件**：
- `src/domain/Product.ts` - 产品数据模型
- `src/domain/AgentRole.ts` - 角色定义数据模型
- `src/domain/AgentInstance.ts` - 角色实例数据模型
- `src/ui/components/ProductSelector.tsx` - 产品选择器
- `src/ui/views/ProductWorkbench.tsx` - 产品工作台

### 阶段 2：MCP 服务器开发（3-4 周）

**目标**：开发参数化的 MCP 服务器

**任务**：
1. 开发 Twitter MCP 服务器（参数化）
2. 开发知识库 MCP 服务器（参数化）
3. 开发数据访问 MCP 服务器（参数化）
4. 配置 Claurst 全局 MCP 设置

**关键文件**：
- `mcp-servers/twitter/index.ts` - Twitter MCP 服务器
- `mcp-servers/knowledge/index.ts` - 知识库 MCP 服务器
- `mcp-servers/data/index.ts` - 数据访问 MCP 服务器
- `~/.claurst/settings.json` - Claurst 全局配置

### 阶段 3：角色实例和会话管理（3-4 周）

**目标**：实现角色实例和 Claurst 会话管理

**任务**：
1. 实现角色实例创建和配置
2. 实现 Claurst 会话初始化
3. 实现角色实例和会话的绑定
4. 实现会话状态监控

**关键文件**：
- `src/services/AgentInstanceService.ts` - 角色实例服务
- `src/services/ClaurstSessionService.ts` - Claurst 会话服务
- `src/ui/views/AgentInstanceManager.tsx` - 角色实例管理界面

### 阶段 4：任务会话和执行（4-5 周）

**目标**：实现任务会话和任务执行

**任务**：
1. 实现任务会话创建
2. 实现角色实例分配
3. 实现任务执行流程
4. 实现结果收集和展示
5. 实现 Reply Agent 完整工作流

**关键文件**：
- `src/services/TaskSessionService.ts` - 任务会话服务
- `src/services/TaskExecutionService.ts` - 任务执行服务
- `src/services/ReplyAgentService.ts` - Reply Agent 服务
- `src/ui/views/TaskManager.tsx` - 任务管理界面

### 阶段 5：平台功能完善（4-6 周）

**目标**：完善平台级功能

**任务**：
1. 实现审核队列
2. 实现报表和数据分析
3. 实现团队协作功能
4. 实现权限管理
5. 实现监控和告警

**关键文件**：
- `src/services/ReviewQueueService.ts` - 审核队列服务
- `src/services/ReportService.ts` - 报表服务
- `src/services/PermissionService.ts` - 权限服务
- `src/ui/views/ReviewQueue.tsx` - 审核队列界面
- `src/ui/views/Reports.tsx` - 报表界面

## 7. 总结

这个架构设计的核心优势：

1. **产品中心化**：用户体验直观，类似 IDE 的工作区模式
2. **角色实例灵活**：可以创建多个实例，配置不同模型，对比效果
3. **经验积累**：每个角色实例有独立会话，持续学习和改进
4. **配置简单**：MCP 全局配置，参数化返回数据
5. **任务协作**：多个角色实例可以协作完成复杂任务
6. **数据隔离**：产品、角色实例、会话之间完全隔离

总实施时间：16-22 周（4-5.5 个月），相比从零开发 Agent 引擎节省约 50% 时间。
