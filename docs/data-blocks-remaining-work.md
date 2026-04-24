# 数据积木模块后续规划

## 文档信息

- **版本**: v2.1
- **创建时间**: 2026-04-23
- **最后更新**: 2026-04-24
- **状态**: 部分已实施

## 一、文档范围

本文档仅保留**尚未实现**的数据积木能力。

以下内容已根据当前代码核对，确认已经实现，因此不再作为待办保留：

- 4 种核心数据积木类型：
  - `account_current_metrics`
  - `followers_growth_trend`
  - `account_activity_metrics`
  - `account_overview`
- 后端读取接口与默认积木配置
- 前端卡片渲染与详情预览
- 数据积木页面的账号切换
- 数据积木布局加载、刷新、删除、拖拽排序
- 旧类型与旧读取逻辑的主干清理

---

## 二、尚未实现的能力

### 2.1 所有账号视图（聚合展示）

**状态**: 未实现

#### 原始规划
- 支持“所有账号”视图
- 聚合展示多个账号的数据积木

#### 代码核对
当前实现中：
- `src/pages/DataBlocks.tsx` 使用单选账号下拉
- `src/components/DataBlockDetailPane.tsx` 也是单账号选择
- 后端接口 `get_card_data` / `get_data_block_preview` 仍按单个 `account_id` 读取

未发现：
- “所有账号”选项
- 聚合查询逻辑
- 聚合型卡片展示逻辑

#### 结论
该能力仍未实现，应保留。

---

### 2.2 时间范围切换功能

**状态**: 未实现

#### 原始规划
- 粉丝增长趋势支持 `24h / 7天 / 30天`
- 账号概览支持切换时间范围
- 后续支持自定义时间范围

#### 代码核对
当前实现中：
- 后端趋势类积木默认 `hours = 24`
- `get_data_block_preview` 中固定给趋势类积木注入 `{"hours": 24}`
- 前端没有时间范围切换控件
- `AddCardDialog` 也没有配置时间范围

#### 结论
当前只有固定 24 小时逻辑，没有用户可切换的时间范围能力，应保留。

---

### 2.3 账号历史趋势展示

**状态**: 未实现

#### 需求归属说明
该能力原先曾在账号管理文档中提及，但从职责边界看，更适合归入数据积木 / 数据展示模块维护。

#### 原始规划
- 基于账号历史快照展示趋势数据
- 支持在前端查看账号一段时间内的变化过程，而不只是当前最新值

#### 代码核对
当前实现中：
- 后端已具备 `get_account_trend` 接口
- 账号历史快照数据已存在
- `src/components/AccountDetailPane.tsx` 当前仅展示 `latestTrend`，不是完整历史趋势
- 未发现前端对 `getAccountTrend` / `get_account_trend` 的实际调用
- 未发现独立的历史趋势图、时间序列列表或趋势面板实现

#### 结论
后端数据能力已具备，但前端历史趋势展示仍未实现，应保留。

---

### 2.4 数据导出

**状态**: 未实现

#### 原始规划
- 支持导出 CSV / Excel

#### 代码核对
未发现：
- 数据导出命令
- 导出按钮或导出入口
- CSV / Excel 生成逻辑

#### 结论
该能力未实现，应保留。

---

### 2.5 多账号数据对比

**状态**: 未实现

#### 原始规划
- 支持多个账号的数据对比

#### 代码核对
当前实现中：
- 页面和详情都只支持单账号选择
- 后端接口一次只接受一个 `account_id`
- 没有对比图表、对比卡片或并列展示逻辑

#### 结论
该能力未实现，应保留。

---

### 2.6 告警功能

**状态**: 未实现

#### 原始规划
- 当指标异常时发送通知

#### 代码核对
未发现：
- 指标阈值配置
- 告警规则
- 通知发送逻辑
- 数据积木异常检测逻辑

#### 结论
该能力未实现，应保留。

---

### 2.7 新数据源的二期积木

**状态**: 未实现

#### 原始规划
1. 推文数据积木
2. 任务执行数据积木
3. 粉丝分析数据积木

#### 代码核对
当前实现中：
- `src/config/data-blocks.ts`
- `src/services/data-blocks/types.ts`
- `src/components/AddCardDialog.tsx`

都只保留以下 4 种类型：
- `account_current_metrics`
- `followers_growth_trend`
- `account_activity_metrics`
- `account_overview`

未发现新的二期积木类型定义与实现。

#### 结论
这些二期扩展仍未实现，应保留。

---

## 三、需要谨慎表述但不属于“未实现”的部分

### 3.1 图表库集成

**状态**: 已实现

#### 代码核对
- `src/components/DataCard.tsx` 已接入 `recharts`
- 粉丝增长趋势卡片已使用图表组件展示

#### 结论
旧文档中“图表库集成待完成”已经过时，应删除。

### 3.2 前端 UI 组件实现

**状态**: 已实现

#### 代码核对
已存在：
- `src/pages/DataBlocks.tsx`
- `src/components/DataCard.tsx`
- `src/components/DataBlockDetailPane.tsx`
- `src/components/AddCardDialog.tsx`
- `src/components/SortableDataCard.tsx`

#### 结论
旧文档中“前端 UI 组件实现待完成”已经过时，应删除。

### 3.3 多账号切换功能

**状态**: 已实现（单账号切换）

#### 代码核对
- `src/pages/DataBlocks.tsx` 已通过下拉框切换账号
- `src/components/DataBlockDetailPane.tsx` 也已支持账号切换
- 账号来源为 `getManagedAccountsForTaskSelection()`

#### 结论
“多账号切换功能待完成”这一表述不准确。
更准确的说法应是：
- **单账号切换已实现**
- **多账号聚合 / 对比未实现**

### 3.4 测试和优化

**状态**: 部分已实现，不能作为明确待办总称保留

#### 代码核对
已存在：
- `src/services/data-blocks/tauri.test.ts`
- `src/pages/DataBlocks.test.tsx`

#### 结论
“测试和优化”表述过泛，不适合作为正式剩余需求。
如果后续仍需推进，应拆成明确事项单独记录。

---

## 四、当前建议的后续优先级

### P1
- 时间范围切换功能
- 所有账号视图（聚合展示）

### P2
- 账号历史趋势展示
- 多账号数据对比
- 数据导出

### P3
- 告警功能
- 二期新数据源积木

---

## 五、参考代码

- 后端命令: `src-tauri/src/commands/data_blocks.rs`
- 前端页面: `src/pages/DataBlocks.tsx`
- 卡片渲染: `src/components/DataCard.tsx`
- 详情预览: `src/components/DataBlockDetailPane.tsx`
- 类型定义: `src/services/data-blocks/types.ts`
- 积木目录: `src/config/data-blocks.ts`
- 账号趋势接口: `src-tauri/src/commands/account.rs`
- 账号详情面板: `src/components/AccountDetailPane.tsx`

---

**文档状态**: 当前仅保留未实现能力
