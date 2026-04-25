# LocalBridge 与开发方式总纲

## 1. 文档目标

本文档用于明确 TweetPilot 当前关于 LocalBridge、Python、ClawBot、REST API 文档获取方式以及 AI 辅助开发的产品边界。

这是一份**总纲文档**，目标不是描述某次局部实现，而是统一以下问题：

1. TweetPilot 的底层能力源是什么
2. Python 在整个体系中的定位是什么
3. ClawBot 的角色是什么
4. 非 Python 场景应该如何获取最新 API 文档
5. AI 后续应该如何根据用户选择的开发方式生成代码
6. 哪些现有文档已经过时，后续需要如何改造

---

## 2. 核心定位

### 2.1 LocalBridge 是能力源

TweetPilot 在 X/Twitter 相关自动化能力上的底层能力源是 **LocalBridge**。

只要用户已经正确连接 LocalBridge，就意味着本地已经有一套可调用的 REST API 能力可供使用。

因此，TweetPilot 在开发方式上的核心原则应改为：

- **能力源是 LocalBridge**
- **语言只是接入方式**
- **Python 不是唯一方案**
- **ClawBot 不是能力源本身，而是 Python 复用层**

---

### 2.2 Python 是推荐方案之一，不是唯一方案

当前 TweetPilot 在任务执行层面对 Python 的支持最完整，因此 Python 仍然是当前最适合优先支持的开发方式。

但从产品边界上，TweetPilot 不应把用户的 LocalBridge 使用方式限定为 Python。

用户完全可以选择：

- Python
- shell + curl
- JavaScript / TypeScript
- Go
- Rust
- 任何能够访问 REST API 的语言或工具

因此，TweetPilot 后续文档和 AI 约束都应避免表达成：

- “访问 LocalBridge 必须使用 Python”
- “必须通过 ClawBot 才能调用能力”
- “任务系统的长期形态就是 Python 脚本系统”

这些表达都不再准确。

---

## 3. Python 路径的产品定义

当用户明确选择 **Python** 时，TweetPilot 应提供两条路径。

### 3.1 路径 A：优先复用 ClawBot

ClawBot 是我们当前维护的 Python 代码库，用于帮助用户快速复用已经实现好的 LocalBridge / X/Twitter 基础能力。

当用户要求：

- 用 Python 访问推特 / X
- 用 Python 读写时间线、推文、用户信息、媒体能力
- 用 Python 编写自动化脚本

AI 的首选策略应为：

1. 先阅读 `~/.tweetpilot/clawbot/README.md`
2. 确认 ClawBot 是否已有可复用能力
3. 若已有能力，优先 `import clawbot` 直接复用
4. 避免重新手写已存在的 REST API 封装

ClawBot 的定位是：

- Python 用户的推荐复用层
- 提升开发效率
- 降低重复实现成本

而不是：

- 唯一允许的接入方式
- LocalBridge 的唯一文档来源
- 非用不可的强制依赖

---

### 3.2 路径 B：不用 ClawBot，直接基于 REST API 自己写 Python

如果用户明确表示：

- 不想依赖 ClawBot
- 想自己从头写 Python 请求逻辑
- 想直接操作 REST API

那么 AI 不应强行把用户拉回 ClawBot。

此时正确做法应为：

1. 通过 LocalBridge 的文档接口获取最新 REST API 文档
2. 按用户要求，用原生 Python 请求方式编写代码
3. 将 ClawBot 视为“可选参考实现”，而不是强制前置条件

这意味着 Python 场景下的真实产品边界应是：

- **优先推荐 ClawBot**
- **但允许用户绕过 ClawBot，直接基于 LocalBridge REST API 编写 Python**

---

## 4. 非 Python 路径的产品定义

如果用户明确不使用 Python，那么 TweetPilot 不应试图继续把需求转回 Python。

此时应遵循以下原则：

1. 只要用户目标是访问 LocalBridge 的 REST API，就允许使用任意语言或工具
2. AI 应先获取最新 REST API 文档，再按用户指定方式生成代码或脚本
3. ClawBot 在非 Python 场景下不再是主文档来源

### 4.1 最新 REST API 文档获取方式

后续统一采用 **运行时读取** 的方式获取最新 API 文档。

唯一支持的获取方式为：

- 基于 LocalBridge 的本地配置定位服务地址
- 请求：`GET /api/v1/x/docs`

也就是说：

- **放弃静态 `api_doc.json` 文件方案**
- **不再设计本地静态 JSON 文档作为权威来源**
- **统一以 LocalBridge 运行时返回的文档内容为准**

### 4.2 AI 在非 Python 场景下的推荐流程

当用户要求：

- shell 脚本
- curl 示例
- JavaScript / TypeScript 代码
- Go / Rust / 其他语言调用代码

AI 的正确流程应为：

1. 先通过 curl 或等价方式访问 LocalBridge 文档接口
2. 获取最新 REST API 文档
3. 根据用户指定语言生成调用代码
4. 不要假设 ClawBot 是必经路径

---

## 5. 文档来源优先级

根据新的产品边界，后续 AI 在不同场景下应参考的文档来源也要重新定义。

### 5.1 Python + 优先复用现有能力

优先读取：

1. `~/.tweetpilot/clawbot/README.md`
2. `~/.tweetpilot/clawbot/examples/`
3. 必要时再参考 LocalBridge 最新 REST API 文档

### 5.2 Python + 用户明确要求自己写 REST API

优先读取：

1. LocalBridge 文档接口：`GET /api/v1/x/docs`
2. 必要时将 ClawBot 作为参考实现

### 5.3 非 Python

优先读取：

1. LocalBridge 文档接口：`GET /api/v1/x/docs`
2. 按用户要求生成任意语言或工具的调用方式

---

## 6. 对 AI 约束系统的影响

当前 AI 约束体系仍明显停留在旧阶段，后续必须重写，使其与本文档一致。

### 6.1 `resources/tweetpilot-home/skill.md` 必须改造

当前 `skill.md` 仍主要按以下旧思路组织：

- Python 是核心默认路径
- Python 场景主要围绕 ClawBot
- 缺少非 Python 场景的明确分流
- 仍未把 LocalBridge 文档接口作为最新 REST API 文档的权威来源

后续改造方向必须包括：

1. 明确 **LocalBridge 是能力源**
2. 明确 **Python 只是推荐方案之一**
3. 明确 **Python 下优先复用 ClawBot，但不是强制**
4. 明确 **非 Python 时，AI 应先通过 `GET /api/v1/x/docs` 获取最新文档**
5. 保留 `product.md` 与 `content_rules.md` 这类工作区约束文件的角色，但不要再把整个体系误写成“只有 Python + ClawBot”

### 6.2 `resources/tweetpilot-home/clawbot/README.md` 必须改造

当前 README 仍主要强调：

- 如何直接复用 ClawBot
- 如何在 Python 中导入并使用 `ClawBotClient`

这部分仍然有价值，但定位需要更清晰。

后续改造方向必须包括：

1. 明确 ClawBot 是 **Python 推荐复用层**，不是唯一入口
2. 明确如果用户不用 ClawBot，也可以直接根据 LocalBridge REST API 文档自己写 Python
3. 明确 README 的主要目标是帮助 AI / 用户复用现有 Python 能力，而不是替代 LocalBridge 的正式 API 文档
4. 去掉任何会让 AI 误判“所有能力只能从 ClawBot 获取”的表述

---

## 7. 对实现层的影响

本文档不是实现方案，但它会直接影响后续若干实现与文档改造方向。

### 7.1 AI 会话约束构建逻辑

当前 AI 会话系统把 `skill.md` 作为主要系统提示词来源，这个总体方向仍可保留。

但 `skill.md` 内容必须跟随新的产品边界重写，否则 AI 仍会被旧规则引导。

### 7.2 LocalBridge 文档读取能力

后续如果希望 AI 真正执行“先获取最新 REST API 文档，再生成代码”这一流程，就需要确保：

- AI 有能力通过命令行工具访问 LocalBridge 文档接口
- 或者应用后续提供更明确的文档读取封装

但无论实现细节如何，产品规则已经明确：

- **权威 REST API 文档来源是 `GET /api/v1/x/docs`**

---

## 8. 推荐后续工作

### P1：先改文档边界

1. 重写 `resources/tweetpilot-home/skill.md`
2. 重写 `resources/tweetpilot-home/clawbot/README.md`
3. 新增 / 更新关于 LocalBridge 文档接口的说明

### P2：再改 AI 行为约束

1. 让 AI 在 Python / 非 Python 场景中走不同文档路径
2. 让 AI 在非 Python 场景下优先获取最新 REST API 文档
3. 让 AI 在 Python 场景下区分“优先复用 ClawBot”和“用户要求自己写 REST API”这两种情况

### P3：最后补实现

1. 如有需要，补充面向 LocalBridge 文档接口的调用示例
2. 如有需要，为 AI / 系统增加更稳定的文档读取方式
3. 再决定是否要做更强的语言无关任务能力支持

---

## 9. 一句话总结

TweetPilot 后续在开发方式上的统一原则应为：

> **LocalBridge 是能力源；ClawBot 是 Python 复用层；Python 不是唯一方案；最新 REST API 文档统一通过 `GET /api/v1/x/docs` 获取。**
