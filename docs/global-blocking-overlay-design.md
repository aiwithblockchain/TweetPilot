# 全局等待遮罩（Blocking Overlay）技术方案

> 目标：在执行不可逆的异步操作（如彻底删除账号数据 + 解除管理绑定 + 清空数据积木）期间，阻止用户对界面的任何交互，避免连续误点击导致状态不一致。

---

## 1. 问题场景

当用户在 ConfirmDialog 中点击"确认删除"后，后端需要依次完成：

1. 解除账号管理绑定
2. 清空关联数据积木数据 / 布局 / 配置
3. 删除账号主数据

这些操作耗时不确定（数据量大时可能数秒）。当前 ConfirmDialog 仅在按钮上显示 loading，对话框关闭后用户可以立即操作其他控件，可能触发依赖已删除数据的操作，产生竞态问题。

---

## 2. 方案设计

### 2.1 核心思路

新增一个 `BlockingOverlayContext`，与现有 `ToastContext` 同级挂载在 `<App>` 顶层。任何模块在发起不可逆操作前调用 `block(message)`，操作完成后调用 `unblock()`。遮罩层渲染在最高 z-index，拦截所有指针事件。

### 2.2 状态定义

```typescript
// contexts/BlockingOverlayContext.tsx

interface BlockingOverlayState {
  active: boolean
  message: string  // 展示给用户的提示文案，如"正在删除数据..."
}

interface BlockingOverlayContextValue {
  block: (message: string) => void
  unblock: () => void
  isBlocking: boolean
}
```

### 2.3 Provider 实现

```tsx
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

const BlockingOverlayContext = createContext<BlockingOverlayContextValue | undefined>(undefined)

export function useBlockingOverlay() {
  const ctx = useContext(BlockingOverlayContext)
  if (!ctx) throw new Error('useBlockingOverlay must be used within BlockingOverlayProvider')
  return ctx
}

export function BlockingOverlayProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BlockingOverlayState>({ active: false, message: '' })

  const block = useCallback((message: string) => {
    setState({ active: true, message })
  }, [])

  const unblock = useCallback(() => {
    setState({ active: false, message: '' })
  }, [])

  return (
    <BlockingOverlayContext.Provider value={{ block, unblock, isBlocking: state.active }}>
      {children}
      {state.active && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
          style={{ cursor: 'wait' }}
        >
          <div className="bg-[var(--color-bg)] rounded-lg px-6 py-4 shadow-xl flex items-center gap-3">
            <Spinner />
            <span className="text-sm text-[var(--color-text)]">{state.message}</span>
          </div>
        </div>
      )}
    </BlockingOverlayContext.Provider>
  )
}
```

### 2.4 挂载位置

在 `App.tsx` 中，将 `BlockingOverlayProvider` 包裹在 `ToastProvider` 内层（确保遮罩层 z-index 高于 Toast）：

```tsx
function App() {
  // ... theme init ...
  return (
    <ToastProvider>
      <BlockingOverlayProvider>
        <AppContent />
      </BlockingOverlayProvider>
    </ToastProvider>
  )
}
```

---

## 3. 调用方式

### 3.1 典型用法：彻底删除账号

```typescript
const { block, unblock } = useBlockingOverlay()

const handleFullDelete = async (accountId: string) => {
  block('正在彻底删除账号数据...')
  try {
    await invoke('delete_account_completely', { twitterId: accountId })
    // 刷新列表等后续操作
  } catch (err) {
    toast.error('删除失败: ' + String(err))
  } finally {
    unblock()
  }
}
```

### 3.2 与 ConfirmDialog 的配合

ConfirmDialog 的 `onConfirm` 回调中调用 `block()`，对话框自身可以正常关闭，遮罩层接管阻断职责直到操作完成。

---

## 4. 遮罩层行为规格

| 属性 | 规格 |
|------|------|
| z-index | 9999（高于 ConfirmDialog 的 50、Toast 的 50） |
| 背景 | `bg-black/40`，半透明黑色 |
| 鼠标样式 | `cursor: wait` |
| 指针事件 | 遮罩层 `div` 覆盖全屏，自动拦截所有点击 |
| 键盘事件 | 遮罩层获取焦点，阻止 Tab 穿透 |
| 内容 | 居中卡片：Spinner + 文案 |
| 动画 | 无入场动画（立即显示），避免用户在动画期间误操作 |
| 超时保护 | 不在遮罩层实现；由调用方在 `finally` 中保证 `unblock()` |

---

## 5. 键盘无障碍处理

遮罩激活时需要阻止焦点逃逸到遮罩后方的控件：

```tsx
{state.active && (
  <div
    className="fixed inset-0 z-[9999] ..."
    role="alertdialog"
    aria-modal="true"
    aria-label={state.message}
    tabIndex={-1}
    ref={(el) => el?.focus()}
    onKeyDown={(e) => {
      // 阻止 Tab 和 Escape 穿透
      if (e.key === 'Tab' || e.key === 'Escape') {
        e.preventDefault()
      }
    }}
  >
    ...
  </div>
)}
```

---

## 6. 适用场景清单

以下操作应触发全局遮罩：

1. 彻底删除账号数据（解除绑定 + 清空数据积木 + 删除主数据）
2. 工作区删除
3. 未来可能新增的批量操作

普通操作（如取消管理但保留数据、单个数据积木编辑）不需要全局遮罩，使用按钮级 loading 即可。

判断标准：操作是否不可逆 + 是否涉及跨模块级联清理。两者都满足时使用全局遮罩。

---

## 7. 实现步骤

1. 新建 `src/contexts/BlockingOverlayContext.tsx`，实现 Provider + hook
2. 在 `src/App.tsx` 中挂载 Provider
3. 在彻底删除账号的调用处接入 `block()` / `unblock()`
4. 在工作区删除的调用处接入
5. 验证：遮罩期间点击任意界面元素无响应，操作完成后遮罩消失、界面恢复交互
