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

