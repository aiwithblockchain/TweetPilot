# LocalBridge 适配层使用说明

## 概述

LocalBridge 适配层提供了与 LocalBridge REST API 的集成，支持从 X (Twitter) 获取评论输入并映射为平台的 CommentInput 对象。

## 架构

```
LocalBridge API (原始响应)
    ↓
LocalBridgeClient (HTTP 客户端)
    ↓
Mapper (适配层)
    ↓
CommentInput (平台领域对象)
    ↓
CommentInputRepository (事实层)
```

## 核心组件

### 1. LocalBridgeClient

位置: `src/adapters/localBridge/client.ts`

封装了与 LocalBridge REST API 的通信：

```typescript
const client = new LocalBridgeClient({
  baseUrl: 'http://127.0.0.1:10088',
  timeout: 10000
});

// 获取实例列表
const instances = await client.getInstances();

// 获取标签页状态
const tabStatus = await client.getTabStatus(instanceId);

// 获取推文回复
const replies = await client.getTweetReplies(tweetId, { tabId });
```

### 2. Mapper (适配层)

位置: `src/adapters/localBridge/mapper.ts`

将 LocalBridge 原始响应映射为平台对象：

```typescript
// 从 LocalBridge 响应中提取回复
const replies = extractRepliesFromResponse(response, targetTweetId);

// 映射为 CommentInput 创建参数
const params = mapReplyToCommentInputParams(
  reply,
  workspaceId,
  accountId
);
```

### 3. Electron 集成

在渲染进程中通过 IPC 调用：

```typescript
// 在渲染进程中
const instances = await window.tweetOps.localBridge.getInstances();
const replies = await window.tweetOps.localBridge.getTweetReplies(tweetId);
```

## 使用示例

### 完整流程：从 LocalBridge 获取回复并保存到事实层

```typescript
import { LocalBridgeClient } from './adapters/localBridge';
import { extractRepliesFromResponse, mapReplyToCommentInputParams } from './adapters/localBridge/mapper';
import { createCommentInput } from './domain/commentInput';
import { InMemoryCommentInputRepository } from './data/commentInputRepository';

// 1. 创建客户端
const client = new LocalBridgeClient();

// 2. 获取推文回复
const response = await client.getTweetReplies('1234567890');

// 3. 提取并适配回复
const replies = extractRepliesFromResponse(response, '1234567890');

// 4. 保存到事实层
const repository = new InMemoryCommentInputRepository();

for (const reply of replies) {
  const params = mapReplyToCommentInputParams(
    reply,
    'workspace-1',
    'account-1'
  );
  const commentInput = createCommentInput(params);
  await repository.save(commentInput);
}

// 5. 查询保存的评论
const comments = await repository.findByAccountId('account-1');
```

## 测试

### 运行测试

```bash
# 运行所有适配层测试
npm test -- tests/adapters/localBridge/

# 运行契约测试
npm test -- tests/adapters/localBridge/contract.test.ts

# 运行集成测试
npm test -- tests/adapters/localBridge/integration.test.ts
```

### 契约测试

契约测试验证适配层能够正确处理 LocalBridge 的响应结构：

- 实例查询响应结构
- 标签页状态响应结构
- 推文回复响应结构
- 回复到 CommentInput 的映射

### 集成测试

集成测试验证适配层输出可以进入事实层仓储：

- 保存适配后的回复到仓储
- 按账号查询评论
- 按工作空间查询评论
- 保留元数据

## 设计原则

1. **解耦**: 平台模型与 LocalBridge 原始结构完全解耦
2. **单一职责**: 只支持第一阶段的最小真实输入链路（已监控推文的回复）
3. **契约保护**: 通过 fixture 和契约测试检测 LocalBridge 返回结构变更
4. **不暴露原始结构**: LocalBridge 原始响应不会直接传递给 UI 或仓储

## 当前限制

第一阶段只支持：

- 已监控推文下的回复评论输入

不支持：

- 全量提及流
- 私信输入
- 通知中心流
- 复杂分页和历史回补
