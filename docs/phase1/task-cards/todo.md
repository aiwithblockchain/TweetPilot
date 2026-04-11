# Phase 1 遗留问题清单

本文档记录了 Phase 1 的遗留问题，这些问题将在后续阶段处理。

## 状态说明
- ⏭️ **推迟到后续阶段** - 需要更多基础设施或不适合当前阶段
- 🟡 **可选优化** - 低优先级改进，不影响功能

---

## Slice 1 可选优化

### 1. 状态管理的单例模式优化
- **来源**: Slice 1 Complete Review
- **严重程度**: 低
- **状态**: 🟡 **可选优化**
- **位置**: [src/data/platformState.ts:44](../../../src/data/platformState.ts#L44)

**问题描述**:
- 单例模式使测试隔离困难，多个测试可能共享状态

**建议解决方案**:
```typescript
// 导出工厂函数而非单例
export function createPlatformState(initialState: PlatformState) {
  return new PlatformStateManager(initialState);
}

// 导出默认实例供应用使用
export const platformState = createPlatformState(seedPlatformState);
```

**建议时机**: 在测试变复杂前修复

---

### 2. 添加 React Error Boundary
- **来源**: Slice 1 Complete Review
- **严重程度**: 低
- **状态**: 🟡 **可选优化**
- **位置**: [src/App.tsx](../../../src/App.tsx)

**问题描述**:
- 如果任何子组件抛出错误，整个应用会崩溃，没有错误恢复机制

**建议解决方案**:
```typescript
// src/components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component<Props, State> {
  // ... 标准 Error Boundary 实现
}

// 在 App.tsx 中使用
<ErrorBoundary>
  <DashboardView currentView={currentView} />
</ErrorBoundary>
```

**建议时机**: 可在后续 Slice 添加

---

## Slice 2 遗留问题

### 13. E2E 测试未使用真实 Electron 环境
- **来源**: T2-04 Code Review
- **严重程度**: 高
- **状态**: ⏭️ **推迟到后续阶段**
- **位置**: [tests/e2e/](../../../tests/e2e/)

**问题描述**:
- 当前 E2E 测试使用 RTL (React Testing Library) 模拟，而非真实的 Electron 渲染器验证
- 无法验证真实运行环境中的问题

**建议解决方案**:
- 使用 Playwright 拉起真实的 Electron 窗口进行 E2E 测试
- 参考 Slice 1 中已有的 Playwright + Electron 测试基础设施

**建议时机**: 
- 在进入 Slice 3 之前，在项目路线图中标记"打通真实运行环境 E2E 测试"的里程碑
- 建议在 Slice 3 或 Slice 4 期间完成

---

### 14. 评论输入列表样式优化
- **来源**: T2-04 Code Review
- **严重程度**: 低
- **状态**: 🟡 **可选优化**
- **位置**: [src/styles.css](../../../src/styles.css)

**问题描述**:
- 多个 Meta 信息的展示较为拥挤，缺少视觉层次

**建议解决方案**:
- 引入间距标准或图标辅助区分信息
- 优化 Metadata 展示的视觉层次

**建议时机**: 在后续美化环节中处理

---

### 3. 导航状态管理优化
- **来源**: Slice 1 Complete Review
- **严重程度**: 低
- **状态**: 🟡 **可选优化**
- **位置**: [src/App.tsx:18-27](../../../src/App.tsx#L18-L27)

**问题描述**:
- 每次渲染都重新计算 `activeItems`，虽然性能影响小，但可以优化

**建议解决方案**:
```typescript
const activeItems = useMemo(
  () => navigationItems.map((item) => ({
    ...item,
    active: item.id === currentView,
  })),
  [currentView]
);
```

**建议时机**: 性能影响可忽略，低优先级

---

### 4. 添加 JSDoc 注释
- **来源**: Slice 1 Complete Review
- **严重程度**: 低
- **状态**: 🟡 **可选优化**
- **位置**: [src/data/platformState.ts](../../../src/data/platformState.ts)

**问题描述**:
- 公共 API 缺少文档注释，不利于团队协作

**建议解决方案**:
```typescript
/**
 * Platform state manager for TweetPilot.
 * Provides query interfaces for workspaces, accounts, instances, and channels.
 * 
 * @remarks
 * This is a temporary implementation using seed data.
 * Will be replaced with real data sources in subsequent task cards.
 */
class PlatformStateManager {
  // ...
}
```

**建议时机**: 团队规模小时可选

---

## T2-01 可选优化

### 5. LocalBridgeClient 异步清理
- **来源**: T2-01 Review Fixes Verification
- **严重程度**: 低
- **状态**: 🟡 **可选优化**
- **位置**: [electron/main.ts:68-70](../../../electron/main.ts#L68-L70)

**问题描述**:
- 当前只是清空引用，如果 `LocalBridgeClient` 有 `dispose()` 方法，应该调用

**建议解决方案**:
```typescript
app.on('will-quit', async () => {
  if (localBridgeClient?.dispose) {
    await localBridgeClient.dispose();
  }
  localBridgeClient = null;
});
```

**建议时机**: 检查 `LocalBridgeClient` 是否有资源需要清理

---

### 6. IPC 类型提取到共享文件
- **来源**: T2-01 Review Fixes Verification
- **严重程度**: 低
- **状态**: 🟡 **可选优化**
- **位置**: [electron/main.ts](../../../electron/main.ts), [electron/preload.ts](../../../electron/preload.ts)

**问题描述**:
- `IPCError`/`IPCSuccess`/`IPCResult` 在 main.ts 和 preload.ts 中重复

**建议解决方案**:
```typescript
// src/types/ipc.ts
export interface IPCError { ... }
export interface IPCSuccess<T> { ... }
export type IPCResult<T> = IPCSuccess<T> | IPCError;
```

**建议时机**: 可在未来重构时完成

---

### 7. 添加 IPC 错误处理测试
- **来源**: T2-01 Review Fixes Verification
- **严重程度**: 低
- **状态**: 🟡 **可选优化**

**问题描述**:
- 缺少 IPC 错误处理、输入验证、清理逻辑的测试

**建议解决方案**:
- 为 IPC 错误处理添加单元测试
- 为输入验证添加测试
- 为 app quit 清理逻辑添加测试

**建议时机**: 可在 T2-02 或后续任务卡中添加

---

## 数据流过渡问题

### 8. 种子数据向真实数据流的平滑过渡
- **来源**: T1-03 评审
- **严重程度**: 中
- **状态**: ⏭️ **推迟到后续阶段**

**问题描述**:
- 当前使用 `seed.ts` 提供初始化数据
- 未来需要过渡到基于 `LocalBridge` 或 API 的真实数据流
- 需要关注如何平滑过渡，避免大规模重构

**建议解决方案**:
1. 在设计 LocalBridge 时，保持与当前 `PlatformStateManager` 接口的兼容性
2. 考虑使用适配器模式，让 `seed.ts` 和真实数据源都能适配同一接口
3. 逐步迁移，先保持两种数据源并存，再逐步切换

**建议时机**: 
- 在 Phase 2 实现 LocalBridge 时同步考虑
- 在 Slice 4-5（本地桥接与扩展通信）阶段解决

---

## T2-01 & T2-02 可选优化

### 9. LocalBridgeClient 缺少 dispose 方法
- **来源**: T2-01-T2-02 Complete Review
- **严重程度**: 低
- **状态**: 🟡 **可选优化**
- **位置**: [src/adapters/localBridge/client.ts](../../../src/adapters/localBridge/client.ts)

**问题描述**:
- 虽然 `electron/main.ts` 已添加清理逻辑，但 `LocalBridgeClient` 本身没有 `dispose()` 方法

**建议解决方案**:
```typescript
export class LocalBridgeClient {
  // ...
  
  dispose(): void {
    // 如果未来有需要清理的资源（如 WebSocket 连接），在这里清理
  }
}
```

**建议时机**: 当前没有需要清理的资源，可在未来需要时添加

---

### 10. 日期解析可以更健壮
- **来源**: T2-01-T2-02 Complete Review
- **严重程度**: 低
- **状态**: 🟡 **可选优化**
- **位置**: [src/adapters/localBridge/mapper.ts:40-42](../../../src/adapters/localBridge/mapper.ts#L40-L42)

**问题描述**:
- 如果 Twitter 日期格式变更，`new Date()` 可能返回 Invalid Date

**建议解决方案**:
```typescript
function parseTwitterDate(dateStr: string): Date {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid Twitter date format: ${dateStr}`);
  }
  return date;
}
```

**建议时机**: Twitter 日期格式稳定，低优先级

---

### 11. 哈希函数可以使用更好的算法
- **来源**: T2-01-T2-02 Complete Review
- **严重程度**: 低
- **状态**: 🟡 **可选优化**
- **位置**: [src/domain/commentInput.ts:34-41](../../../src/domain/commentInput.ts#L34-L41)

**问题描述**:
- 简单的哈希函数，可能有碰撞

**建议解决方案**:
- 如果未来需要更强的唯一性保证，可以使用 crypto.subtle.digest() 或 UUID

**建议时机**: 当前场景足够，低优先级

---

### 12. 契约测试可以添加更多边界情况
- **来源**: T2-01-T2-02 Complete Review
- **严重程度**: 低
- **状态**: 🟡 **可选优化**
- **位置**: [tests/adapters/localBridge/contract.test.ts](../../../tests/adapters/localBridge/contract.test.ts)

**当前覆盖**:
- ✅ 正常响应结构
- ✅ 空回复列表

**可添加**:
- 缺少必需字段的响应
- 嵌套结构为 null 的情况
- 超大回复列表（性能测试）

**建议时机**: 可在后续 Slice 添加

---

## Slice 3 可选优化

### 15. 温度变化策略优化
- **来源**: Slice 3 Engineering Review
- **严重程度**: 低
- **状态**: 🟡 **可选优化**
- **位置**: [src/agents/ReplyAgent.ts](../../../src/agents/ReplyAgent.ts)

**问题描述**:
- 当前温度变化策略是简单的线性递增（0.7, 0.8, 0.9）
- 第二阶段可能需要更灵活的策略（随机、指数、用户自定义）

**建议解决方案**:
```typescript
// src/agents/temperatureStrategies.ts
export interface ITemperatureStrategy {
  getTemperature(baseTemperature: number, index: number, count: number): number;
}

export class LinearTemperatureStrategy implements ITemperatureStrategy {
  constructor(private step: number = 0.1) {}
  getTemperature(base: number, index: number, count: number): number {
    return base + (index * this.step);
  }
}

export class RandomTemperatureStrategy implements ITemperatureStrategy {
  constructor(private range: number = 0.3) {}
  getTemperature(base: number, index: number, count: number): number {
    return base + (Math.random() * this.range);
  }
}
```

**建议时机**: 第二阶段，当需要更多样化的回复生成策略时

---

### 16. 测试覆盖率目标
- **来源**: Slice 3 Engineering Review
- **严重程度**: 低
- **状态**: 🟡 **可选优化**
- **位置**: 所有任务卡的"完成定义"部分

**问题描述**:
- 当前任务卡的"完成定义"中没有明确的测试覆盖率目标
- 建议添加量化指标（如 ≥80%）

**建议解决方案**:
在每个任务卡的"完成定义"部分添加：
- 单元测试覆盖率 ≥ 80%
- 关键路径测试覆盖率 100%

**建议时机**: 第二阶段建立 CI/CD 流程时统一添加

---

## Slice 4 遗留问题

### 17. 审核队列缓存策略
- **来源**: Slice 4 Review v2
- **严重程度**: 中
- **状态**: ⏭️ **推迟到后续阶段**
- **位置**: [T4-03.审核队列读取与审核动作.md](./T4-03.审核队列读取与审核动作.md)

**问题描述**:
- 当前 Slice 4 已通过分页降低一次性读取压力，但审核队列仍然是高频读取入口
- 如果后续任务规模上升，单纯依赖内存仓储扫描会成为性能瓶颈

**建议解决方案**:
- 在进入真实持久化或多用户协作阶段时，为审核队列增加查询缓存
- 结合任务状态、风险等级和更新时间设计缓存键
- 缓存失效策略应与审核、指派、接管动作联动

**建议时机**:
- 在 Slice 5-6 或后续真实数据源接入时统一处理
- 不建议在当前 InMemory 阶段提前引入额外缓存层

---

### 18. 审核队列实时更新机制
- **来源**: Slice 4 Review v2
- **严重程度**: 低
- **状态**: 🟡 **可选优化**
- **位置**: [T4-05.审核工作台UI与最小链路集成.md](./T4-05.审核工作台UI与最小链路集成.md)

**问题描述**:
- 当前审核工作台默认依赖主动刷新
- 在多操作者场景中，任务状态、指派结果和接管结果可能无法及时反映

**建议解决方案**:
- 第一阶段可优先考虑轻量轮询
- 后续如果存在更强协作需求，再考虑事件推送或 WebSocket
- 需要与分页、过滤和错误恢复策略一起设计

**建议时机**:
- 在 Slice 4 真正进入多人使用或验收演示前可评估是否补做
- 如当前仍以单机最小链路为主，可继续保持为低优先级优化项

---

### 19. 完整权限体系与 RBAC 模型
- **来源**: Slice 4 Review v2
- **严重程度**: 中
- **状态**: ⏭️ **推迟到后续阶段**
- **位置**: [T4-04.责任归属、人工接管与治理回写.md](./T4-04.责任归属、人工接管与治理回写.md)

**问题描述**:
- 当前 Slice 4 只定义了最小权限校验，足以支撑第一阶段治理边界
- 但尚未形成完整的角色权限矩阵、资源级授权和组织级权限继承

**建议解决方案**:
- 后续引入明确的 `viewer` / `reviewer` / `operator` / `admin` 等角色模型
- 将权限判断从简单字段检查提升为统一策略层
- 为审核、接管、执行、审计查询定义统一授权入口

**建议时机**:
- 在进入跨团队协作或多客户空间并发治理阶段时处理
- 不建议在当前 Slice 4 阶段扩张为完整权限系统

---

### 20. 工作流引擎与复杂治理编排
- **来源**: Slice 4 Review v2
- **严重程度**: 中
- **状态**: ⏭️ **推迟到后续阶段**
- **位置**: [T4-02.风险分流规则与任务路由.md](./T4-02.风险分流规则与任务路由.md)

**问题描述**:
- 当前 Slice 4 只覆盖最小风险分流、审核和接管闭环
- 尚未支持多级审批、升级策略、自动释放、超时回收、批量治理等复杂流程

**建议解决方案**:
- 在后续阶段评估是否引入工作流引擎或显式编排层
- 将超时、升级、批量操作、复杂分支条件沉淀为可配置流程
- 在引入前先稳定当前 `ReplyTask` 状态机和事件模型

**建议时机**:
- 建议在 Slice 5-6 之后，根据真实治理复杂度再决定是否建设
- 当前阶段保持任务状态机 + 服务层编排即可

---

### 21. ReplyTask 边界输入与性能测试补强
- **来源**: T4-00 Code Review
- **严重程度**: 低
- **状态**: 🟡 **可选优化**
- **位置**: [src/domain/__tests__/replyTask.test.ts](../../../src/domain/__tests__/replyTask.test.ts), [src/data/repositories/__tests__/InMemoryReplyTaskRepository.test.ts](../../../src/data/repositories/__tests__/InMemoryReplyTaskRepository.test.ts)

**问题描述**:
- 当前 `T4-00` 已覆盖核心状态机、事件追加和乐观锁冲突，但仍缺少更细的边界输入测试和大数据量性能测试
- 这不会阻塞 Slice 4 后续开发，但会影响后期回归的稳健性

**建议解决方案**:
- 增加空字符串 ID、异常 payload、超长事件历史等边界输入测试
- 增加 `1000+` 任务下的仓储查询性能基线测试
- 将性能测试与功能测试分开，避免日常单测变慢

**建议时机**:
- 在 Slice 4 后续任务基本稳定后补做
- 优先保证任务化、路由、审核链路先落地，再补性能与极端场景测试

---

### 22. 批量任务化的部分失败处理策略
- **来源**: T4-01 Code Review
- **严重程度**: 低
- **状态**: 🟡 **可选优化**
- **位置**: [src/services/replyTaskCreationService.ts](../../../src/services/replyTaskCreationService.ts)

**问题描述**:
- 当前 `createBatchFromCandidateReplies()` 基于 `Promise.all` 实现
- 当批量输入中存在单条失败时，整个批量调用会以异常结束，而不是返回部分成功结果

**建议解决方案**:
- 在后续明确批量任务化的产品语义后，再决定是否改成 `Promise.allSettled`
- 如果需要支持部分成功，应补充新的结果类型，显式区分 `created`、`existing`、`skipped`、`failed`
- 避免在当前预留接口阶段提前引入未使用的复杂返回结构

**建议时机**:
- 等 Slice 4 或 Slice 5 真正引入批量任务化入口时再处理
- 当前阶段保持单条任务化链路稳定优先
