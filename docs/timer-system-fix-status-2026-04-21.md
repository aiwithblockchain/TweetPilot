# 定时器系统修复状态报告

**日期**: 2026-04-21 23:06  
**状态**: 部分修复,仍有严重性能问题

---

## 已完成的修复

### 1. ✅ 修复了 PartialEq 和 Ord 不一致问题
**文件**: [src-tauri/src/unified_timer/types.rs](../src-tauri/src/unified_timer/types.rs)

**问题**: `PartialEq` 只比较 `id`,而 `Ord` 比较 `next_execution` 和 `priority`,违反了 Rust 的一致性要求,导致 BinaryHeap 认为不同的定时器是"相等"的,新定时器替换旧定时器,队列大小始终为 1。

**修复**: 让 `PartialEq` 和 `Ord` 保持一致,都比较 `next_execution`、`priority` 和 `id`。

**结果**: 队列大小现在可以正确增长到 2、3 等。

### 2. ✅ 添加了 EventLoop 唤醒机制
**文件**: [src-tauri/src/unified_timer/event_loop.rs](../src-tauri/src/unified_timer/event_loop.rs), [src-tauri/src/unified_timer/mod.rs](../src-tauri/src/unified_timer/mod.rs)

**问题**: EventLoop 在队列为空时 sleep 60 秒,新定时器注册时无法唤醒。

**修复**: 添加 `tokio::sync::Notify`,在新定时器注册时调用 `notify_one()` 唤醒 EventLoop。

**结果**: EventLoop 可以在新定时器注册时立即唤醒。

### 3. ✅ 修复了前端启动流程
**文件**: [src/App.tsx](../src/App.tsx)

**问题**: 应用重启时前端显示主界面,但后端数据库未初始化。

**修复**: 前端在检测到保存的工作区时,调用 `set_current_workspace` 初始化后端。

**结果**: 应用重启时后端正确初始化。

### 4. ✅ 添加了详细的日志
**文件**: [src-tauri/src/unified_timer/event_loop.rs](../src-tauri/src/unified_timer/event_loop.rs), [src-tauri/src/unified_timer/registry.rs](../src-tauri/src/unified_timer/registry.rs)

**修复**: 将关键日志从 debug 改为 info 级别,添加了详细的执行流程日志。

**结果**: 可以清楚地看到定时器的完整生命周期。

---

## 当前存在的严重问题

### ❌ EventLoop 无限循环问题

**现象**: 定时器被 pop 出来后,如果还没到执行时间,会被放回队列,但 EventLoop 立即又把它 pop 出来,导致无限循环。

**日志证据**:
```
[15:03:54] Popped timer: system-account-sync
[15:03:54] Timer not ready, putting back to queue
[15:03:54] Rebuilding queue. New size: 1
[15:03:54] Popped timer: system-account-sync (立即又被弹出!)
[15:03:54] Timer not ready, putting back to queue
[15:03:54] Rebuilding queue. New size: 1
(重复多次...)
```

**根本原因**: 

1. `update_timer` 方法现在总是重建队列(为了修复定时器不放回队列的问题)
2. EventLoop 在调用 `update_timer` 后会 sleep
3. Sleep 结束后,EventLoop 回到循环开始,立即 pop 下一个定时器
4. 但由于队列是按 `next_execution` 排序的,同一个定时器又被 pop 出来了
5. 如果还没到执行时间,又被放回队列,形成无限循环

**为什么定时器最终还是执行了**:

虽然有无限循环,但每次循环都会 sleep 一小段时间(根据距离执行时间的秒数),所以最终还是会到达执行时间并执行。但这个过程效率极低,浪费 CPU 资源。

---

## 需要的修复方案

### 方案 1: 修改 EventLoop 逻辑(推荐)

**思路**: EventLoop 应该在每次循环中只处理一个定时器,处理完后 sleep,sleep 结束后再处理下一个。

**具体修改**:

在 [src-tauri/src/unified_timer/event_loop.rs:99-117](../src-tauri/src/unified_timer/event_loop.rs#L99-L117) 中,当定时器还没到执行时间时:

1. 不要立即放回队列
2. 计算 sleep 时间
3. Sleep 结束后再放回队列
4. 然后继续下一次循环

伪代码:
```rust
if next_time <= now {
    // 执行定时器
    Self::execute_timer(...).await;
} else {
    // 不要立即放回队列
    let duration = (next_time - now).to_std().unwrap_or(Duration::from_secs(1));
    let sleep_duration = duration.min(Duration::from_secs(60));
    log::info!("[EventLoop] Sleeping for {} seconds until timer is ready", sleep_duration.as_secs());
    
    tokio::select! {
        _ = sleep(sleep_duration) => {
            log::info!("[EventLoop] Wake from scheduled timeout, putting timer back");
            // Sleep 结束后再放回队列
            let mut reg = registry.lock().await;
            reg.update_timer(timer.clone());
        }
        _ = wakeup.notified() => {
            log::info!("[EventLoop] Wake from notification, putting timer back");
            // 被唤醒也要放回队列
            let mut reg = registry.lock().await;
            reg.update_timer(timer.clone());
        }
    }
}
```

### 方案 2: 修改 update_timer 逻辑

**思路**: 让 `update_timer` 更智能,只在必要时重建队列。

**问题**: 这个方案不能解决根本问题,因为即使不重建队列,定时器也会被 pop 出来多次。

---

## 建议的下一步

1. **立即实施方案 1** - 修改 EventLoop 逻辑,避免无限循环
2. **测试验证** - 创建 2 分钟间隔的测试任务,验证定时器准时执行且没有无限循环
3. **性能监控** - 监控 CPU 使用率,确保没有无谓的循环

---

## 测试计划

1. 创建 2 个 2 分钟间隔的定时任务
2. 监控日志,确认:
   - 定时器只被 pop 一次
   - Sleep 时间正确计算
   - 定时器在预定时间准时执行
   - 没有无限循环
3. 检查数据库,确认任务执行记录正确保存

---

## 相关文件

- 问题分析: [docs/timer-system-analysis-2026-04-21.md](./timer-system-analysis-2026-04-21.md)
- 修复总结: [docs/timer-system-fix-summary-2026-04-21.md](./timer-system-fix-summary-2026-04-21.md)
