# skill.md 与 ClawBot 资源安装及 AI Session 接入技术方案

## 1. 文档目标

本文档只解决以下四个问题：

1. 如何把 `skill.md` 和 ClawBot Python 资源库在安装时或第一次启动时放到 `~/.tweetpilot/` 指定目录
2. `skill.md` 的最终内容是什么，以及它如何描述 ClawBot、`product.md`、`禁忌词.md` 三类约束
3. `skill.md` 和 ClawBot 资源在当前代码仓库中应该放在哪个目录，才能被打包进入最终安装程序
4. 如何在 AI session 创建时，把“先阅读 skill.md”的系统提示词加进去，以及代码层面应该怎么实现

本文档不再展开其他衍生文档，不再维护多份设计说明。最终保留的文档只有：

- `docs/skill.md`
- `docs/ai-session-constraints-implementation.md`

---

## 2. 最终方案结论

本方案采用：

- **安装包内置资源 + 程序第一次启动时自动安装到用户目录**
- **不修改操作系统安装脚本，不依赖安装器在系统安装阶段写入用户 Home 目录**
- **由应用代码在首次启动时完成 `~/.tweetpilot/` 初始化**

选择这个方案的原因是：

1. 安装器阶段通常不适合稳定获取当前实际用户的 Home 目录上下文
2. 跨平台安装脚本处理用户目录写入更复杂，维护成本更高
3. 应用启动时由代码自行安装，逻辑可控、可测试、可补偿、可重复执行
4. 这样更容易处理“首次启动安装、后续缺失补装、未来资源升级”这三类场景

所以，针对你的第 1 个问题，结论是：

> **优先修改应用代码，不优先修改安装脚本。**

安装脚本的职责只保留为：

- 把 `skill.md` 和 ClawBot 资源打进最终安装包

程序代码的职责是：

- 在第一次启动时把这些资源复制到 `~/.tweetpilot/`

---

## 3. 最终目录设计

### 3.1 用户运行时目录

运行时目录固定为：

```text
~/.tweetpilot/
├── skill.md
└── clawbot/
    ├── README.md
    ├── auth.py
    ├── api.py
    ├── utils.py
    └── ...
```

说明：

- `~/.tweetpilot/skill.md`
  - 是 AI session 每次启动时都要优先读取的全局约束文档

- `~/.tweetpilot/clawbot/`
  - 是全局公共 Python 资源库
  - 存放已编写并测试成功的可复用代码和使用说明

### 3.2 用户工作目录约束文件

假设用户当前工作目录为 `<workspace>`，则：

```text
<workspace>/.tweetpilot/
├── product.md
└── 禁忌词.md
```

说明：

- `product.md`
  - 由用户在工作目录中维护
  - AI 在涉及产品知识时读取

- `禁忌词.md`
  - 由用户在工作目录中维护
  - AI 在生成发推和回复内容时读取

你已经明确说明：

> 现在可以假设 `product.md` 和 `禁忌词.md` 已经在用户创建的工作目录下存在。

因此，当前方案不负责生成这两个文件，只负责让 AI 在需要时读取它们。

---

## 4. `skill.md` 的最终内容

根据你的最新要求，`skill.md` 不再只是模板说明，而是最终可直接使用的正式文档。

本仓库中应直接保存一份完整可发布版本，内容见：

- `docs/skill.md`

该文档已经满足以下要求：

1. 描述如何使用 ClawBot 资源库
2. 描述何时读取工作目录下的 `product.md`
3. 描述何时读取工作目录下的 `禁忌词.md`
4. 明确缺失资源时的处理方式
5. 明确 AI 的最小执行顺序

后续打包进入安装程序时，建议直接使用这份 `docs/skill.md` 作为源文件复制到打包资源目录。

---

## 5. 仓库内资源应该放在哪个目录

为了能够被最终安装程序打包，并在第一次启动时复制到 `~/.tweetpilot/`，建议在当前仓库中增加以下目录：

```text
resources/
└── tweetpilot-home/
    ├── skill.md
    └── clawbot/
        ├── README.md
        ├── auth.py
        ├── api.py
        ├── utils.py
        └── ...
```

说明：

- `resources/tweetpilot-home/skill.md`
  - 安装包内置的 `skill.md` 正式版本

- `resources/tweetpilot-home/clawbot/`
  - 安装包内置的 ClawBot 资源库

推荐做法：

1. 保留 `docs/skill.md` 作为文档版本
2. 在打包前，将其同步到 `resources/tweetpilot-home/skill.md`
3. ClawBot 资源实际文件直接放在 `resources/tweetpilot-home/clawbot/`

如果你希望减少维护两份 skill 内容的风险，也可以直接把正式内容只保留在 `resources/tweetpilot-home/skill.md`，然后 `docs/skill.md` 只作为说明引用。但按照你现在的要求“最终只保留 2 个文档”，更合适的做法是：

- `docs/skill.md`：给人阅读
- `resources/tweetpilot-home/skill.md`：给程序打包

这两个文件内容应保持一致。

---

## 6. 打包方案：安装脚本改什么，代码改什么

这部分对应你的第 3 个问题。

### 6.1 打包脚本的职责

打包脚本只做一件事：

> 把 `resources/tweetpilot-home/` 打进安装包。

它不负责：

- 创建 `~/.tweetpilot/`
- 往用户 Home 目录写文件
- 判断是否首次启动

### 6.2 程序代码的职责

程序代码负责：

1. 应用第一次启动时检查 `~/.tweetpilot/`
2. 如果不存在，则创建该目录
3. 如果 `~/.tweetpilot/skill.md` 缺失，则从安装包资源复制过去
4. 如果 `~/.tweetpilot/clawbot/` 缺失，则从安装包资源复制过去
5. 如果后续启动发现资源缺失，也允许补装
6. 默认不覆盖用户已经存在的文件

### 6.3 为什么不建议把写入用户目录交给安装脚本

不建议安装脚本直接写入用户目录，原因如下：

- 安装器逻辑跨平台差异大
- 用户身份上下文不稳定
- Home 目录解析容易出现权限和路径问题
- 不利于应用后续做缺失补装和状态检测

因此，推荐：

- **安装脚本负责编包**
- **应用代码负责首次落地安装**

---

## 7. 打包资源目录的具体设计

建议新增：

```text
resources/
└── tweetpilot-home/
    ├── skill.md
    └── clawbot/
```

### 7.1 资源来源

- `resources/tweetpilot-home/skill.md`
  - 来源于已完成的正式 skill 文档内容

- `resources/tweetpilot-home/clawbot/`
  - 来源于当前你准备随产品分发的 ClawBot 代码库

### 7.2 打包配置要做什么

需要修改当前桌面应用的打包配置，把 `resources/tweetpilot-home/` 声明为安装包资源。

如果当前项目最终通过 Electron Builder 打包，则需要在对应打包配置中加入类似职责：

- 将 `resources/tweetpilot-home/**` 复制进安装包的 resources 区域

如果当前项目最终通过 Tauri 打包，则需要在 Tauri 的 bundle/resources 配置中声明：

- 将 `resources/tweetpilot-home/**` 包含进应用资源

也就是说：

> **打包配置一定要改，但安装脚本不负责写用户目录。**

---

## 8. 第一次启动时如何安装到 `~/.tweetpilot/`

这部分对应你的第 1 个问题里的“代码怎么实现”。

### 8.1 实现策略

在应用启动初始化阶段执行：

1. 获取用户 Home 目录
2. 拼出 `~/.tweetpilot/`
3. 检查目录是否存在，不存在则创建
4. 从安装包资源区定位 `tweetpilot-home/skill.md`
5. 如果 `~/.tweetpilot/skill.md` 缺失，则复制
6. 从安装包资源区定位 `tweetpilot-home/clawbot/`
7. 如果 `~/.tweetpilot/clawbot/` 缺失，则递归复制
8. 如果目标已存在，则默认保留，不覆盖

### 8.2 覆盖规则

建议采用以下规则：

- **首次启动**：自动安装
- **后续启动**：缺失则补装
- **已存在文件**：默认不覆盖

这样做的好处是：

- 不会破坏用户后续手动调整过的 `skill.md`
- 不会每次都重复复制 ClawBot
- 如果用户误删了文件，下次启动还能自动补齐

### 8.3 应该改哪一层代码

这部分逻辑应放在：

- 主进程启动初始化代码
- 或桌面宿主的应用启动入口

不应放在：

- `ReplyAgent`
- AI provider
- 前端页面组件

原因很简单：

- 资源安装属于应用启动阶段职责，不属于 AI 响应阶段职责

---

## 9. 代码修改方案：首次启动安装资源

下面开始回答“具体要修改哪些代码”。

### 9.1 新增目录

需要新增：

```text
resources/tweetpilot-home/
```

其中包含：

```text
resources/tweetpilot-home/skill.md
resources/tweetpilot-home/clawbot/
```

### 9.2 需要修改的代码位置

#### A. 应用启动入口文件

需要修改应用启动入口文件，加入“默认资源安装器”的调用。

职责：

- 程序启动时执行一次资源检查
- 如果 `~/.tweetpilot/skill.md` 不存在，则从安装包资源复制
- 如果 `~/.tweetpilot/clawbot/` 不存在，则从安装包资源复制

这部分是整个方案最关键的落地点。

#### B. 新增默认资源安装模块

建议新增一个独立模块，专门负责：

- 定位安装包内资源目录
- 定位用户 `~/.tweetpilot/` 目标目录
- 创建目标目录
- 按规则复制 `skill.md`
- 递归复制 ClawBot 目录
- 做缺失检查与补装

这样可以避免把文件系统操作散落在主进程入口代码里。

#### C. 修改打包配置文件

打包配置文件需要增加对 `resources/tweetpilot-home/` 的声明。

职责：

- 确保安装包里真的包含 `skill.md` 和 ClawBot 目录
- 保证运行时应用代码能从安装包资源区读到这些文件

---

## 10. 打包脚本建议怎么写

这里回答你问的“打包脚本怎么写”。

### 10.1 打包脚本职责最小化

建议打包脚本只做两件事：

1. 确保 `resources/tweetpilot-home/skill.md` 存在
2. 确保 `resources/tweetpilot-home/clawbot/` 存在
3. 执行原有打包命令

如果你希望让 `docs/skill.md` 成为唯一维护源，可以在打包前增加一步同步动作：

- 将 `docs/skill.md` 复制到 `resources/tweetpilot-home/skill.md`

这样打包脚本就需要加一段“预打包复制动作”。

### 10.2 推荐策略

推荐如下：

- **文档维护源**：`docs/skill.md`
- **安装包资源源**：`resources/tweetpilot-home/skill.md`
- **打包前同步**：由打包脚本执行一次复制

对应职责分离：

- 文档供人读
- resources 供程序打包

---

## 11. AI session 创建时如何加入“先阅读 skill.md”的系统提示词

这部分对应你的第 4 个问题。

### 11.1 最终目标

每次创建 AI session 时，都要做到：

1. 程序先读取 `~/.tweetpilot/skill.md`
2. 将“你必须先阅读并遵守该文档”的要求加入系统提示词
3. 如果当前请求属于特定类型，再继续拼接对应约束：
   - `product.md`
   - `禁忌词.md`
   - ClawBot 说明文档

### 11.2 推荐实现方式

推荐采用：

- **session 装配层先读取文件内容**
- **再把 skill 文本作为系统提示词的一部分传给模型**

而不是仅仅告诉模型一句：

- “请去读取 `~/.tweetpilot/skill.md`”

原因是：

- 当前应用不是一个原生具备文件工具调用能力的 agent 框架
- 仅靠一句路径提示，模型未必真的能读取本地文件
- 更可靠的做法是：由程序代码先读取文件，再把内容传给模型

所以，这里的真正实现不应该是“写一句路径提示词”，而应该是：

> **程序先读 skill.md，然后把 skill.md 内容注入系统提示词。**

### 11.3 系统提示词应该长什么样

程序创建 session 时，建议形成如下结构：

1. 产品内置基础安全提示词
2. `skill.md` 正文内容
3. 按需追加：
   - `product.md` 内容
   - `禁忌词.md` 内容
   - ClawBot 使用说明摘要或全文
4. 最后才是业务 prompt / 用户输入

---

## 12. AI session 接入需要修改哪些代码

### 12.1 `src/services/index.ts`

职责：

- 作为 AI session 约束装配的入口之一
- 在创建 AI provider / agent 时接入全局 skill 读取流程
- 组织 session 初始化时所需的约束内容

### 12.2 `src/agents/ReplyAgent.ts`

职责：

- 将当前 prompt 拼接逻辑调整为“系统约束层 + 业务层”结构
- 在生成最终请求前，接入：
  - `skill.md`
  - 按需读取的 `product.md`
  - 按需读取的 `禁忌词.md`
  - 按需读取的 ClawBot 说明信息
- 保证最终 prompt 不再只是单一用户业务文本

### 12.3 `src/ai/IAIProvider.ts`

职责：

- 扩展 provider 抽象，使其支持系统提示词与业务消息分层传递
- 让调用层能够显式传入 session 级约束内容

### 12.4 `src/ai/ClaudeProvider.ts`

职责：

- 支持将 session 约束作为系统提示词传给模型
- 支持将业务内容作为用户消息传给模型
- 避免把所有文本继续混成单一 user prompt

### 12.5 新增：session 约束装配模块

建议新增独立模块，专门负责：

- 读取 `~/.tweetpilot/skill.md`
- 判断当前请求类型
- 按需读取工作目录下的 `product.md`
- 按需读取工作目录下的 `禁忌词.md`
- 按需读取 ClawBot 使用说明
- 生成本次 session 的系统约束内容

这是 AI 接入部分的核心模块。

---

## 13. 哪些内容放在程序里，哪些内容放在文档里

### 13.1 放在文档里的

- `docs/skill.md`：供人阅读和维护的正式约束文档

### 13.2 放在打包资源里的

- `resources/tweetpilot-home/skill.md`
- `resources/tweetpilot-home/clawbot/`

### 13.3 放在代码里的

- 第一次启动自动安装逻辑
- `~/.tweetpilot/` 缺失补装逻辑
- AI session 创建时的 skill 内容注入逻辑
- 按请求类型读取 `product.md` / `禁忌词.md` / ClawBot 的逻辑

---

## 14. 最终保留的文档

根据你的要求，最后只保留 2 个文档：

1. `docs/skill.md`
2. `docs/ai-session-constraints-implementation.md`

其余本文之前生成的文档都应清空。

---

## 15. 清理清单

以下文档应清空内容：

- `docs/ai-clawbot-integration-design.md`
- `docs/ai-session-constraints-implementation-plan.md`
- `docs/skill-md-template.md`
- `docs/workspace-constraint-files-spec.md`

---

## 16. 实施顺序建议

建议按以下顺序开发：

### 第一步：准备打包资源目录

新增：

```text
resources/tweetpilot-home/skill.md
resources/tweetpilot-home/clawbot/
```

### 第二步：修改打包配置

确保 `resources/tweetpilot-home/` 会进入最终安装程序。

### 第三步：实现首次启动安装代码

在应用启动入口调用默认资源安装器，把资源复制到 `~/.tweetpilot/`。

### 第四步：实现 AI session 约束装配

读取 `~/.tweetpilot/skill.md`，并在 session 创建时作为系统提示词注入。

### 第五步：按需读取工作目录约束

对产品知识类请求读取 `product.md`，对发推和回复类请求读取 `禁忌词.md`，对 Python 脚本请求读取 ClawBot 说明。

---

## 17. 最终结论

本方案的核心结论如下：

1. `skill.md` 和 ClawBot 资源不通过安装脚本直接写入用户目录，而是通过**安装包内置 + 第一次启动时由程序代码复制**实现
2. 仓库中应新增 `resources/tweetpilot-home/`，作为安装包资源源目录
3. `docs/skill.md` 是已经写完的正式文档，`resources/tweetpilot-home/skill.md` 应由它同步生成或直接保持一致
4. AI session 创建时，不是只告诉模型去读路径，而是由程序先读取 `~/.tweetpilot/skill.md`，再把内容作为系统提示词注入
5. 与工作目录相关的 `product.md` 和 `禁忌词.md` 视为已存在，AI 在对应场景下按需读取

---

**文档版本**：v1.0  
**更新日期**：2026-04-25  
**适用范围**：TweetPilot 中 `skill.md`、ClawBot 资源安装与 AI session 接入实现方案
