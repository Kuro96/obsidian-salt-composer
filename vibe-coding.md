## 场景 1：中小规模开发 / 重构

### 适用条件

适合目标较明确、改动范围中等、需要拆阶段推进的任务，例如功能迭代、模块重构、交互调整。

### 核心文档

计划文档是中小规模开发 / 重构的辅助工具，不是每次改动都必须创建或更新。

当任务属于新的中大型工作，或需要跨多个 phase 控制范围时，优先维护一组本地计划文档。它们默认是个人工作台资产，不需要纳入 git：

- `.opencode/plans/<plan-name>/PRD.md`
- `.opencode/plans/<plan-name>/progress.md`

它们分别承担不同职责：
- `PRD.md`：定义目标、范围、非目标、约束、阶段划分、风险和预期产出。
- `progress.md`：记录任务拆分后的各个 phase 及其完成状态，细化到可执行 checklist，并约束每个 phase 完成后 repo 依然处于可用状态。

不要把临时目录里的文档当作长期事实来源。`tmp/` 里的 `PRD.md`、`progress.txt` 或探索笔记只适合临时分析；如果计划需要跨 session 继续推进，应迁移到 `.opencode/plans/<plan-name>/`。

这些计划文档的定位是“本机 AI 协作上下文”，不是项目正式文档。只有当某个结论变成长期架构约束、用户可见行为或贡献者需要知道的规范时，才把它提炼进 tracked 文档，例如 `docs/architecture.md`、`docs/decisions/*`、`README.md` 或 `CONTRIBUTING.md`。

### Plan routing

新开 OpenCode session 时，不应该默认沿用历史，也不应该默认生成新计划。应先做轻量 plan routing：

1. 如果用户当前需求明确指向某个已有计划，就沿用该 plan。
2. 如果用户没有明确指定，先扫描本地 active plans，例如 `.opencode/plans/*/PRD.md` 和 `.opencode/plans/*/progress.md`，或用户指定过的 repo-specific planning path。
3. 如果当前需求明显属于某个 active plan 的 scope，就复用该 `plan-name`。
4. 如果只是小修、小功能、模型列表更新、文案调整或孤立维护，不创建也不更新 PRD/progress，除非用户明确要求。
5. 如果是新的多阶段工作，或范围不清且需要持续控制，才创建新的 `.opencode/plans/<plan-name>/`。
6. 如果多个 active plans 都可能匹配，先问用户应该使用哪个 plan。

建议每个 `PRD.md` 顶部放 metadata：

```md
# PRD: Tool-First Editing Refactor

Status: active
Plan: tool-first-editing-refactor
Scope: tool-first editing, MCP write review, apply path retirement
Non-goals: provider model updates, unrelated settings cleanup
```

建议每个 `progress.md` 顶部也放 metadata：

```md
# Progress: Tool-First Editing Refactor

Status: active
Plan: tool-first-editing-refactor
PRD: ./PRD.md
Last updated: 2026-04-30
Current phase: Phase 2 - Remove legacy apply path
```

### 维护规则

PRD 和 progress 的更新边界要分开：

- PRD 只在计划本身变化时更新，例如目标、范围、非目标、验收标准、阶段划分或关键约束变化。
- progress 只在执行状态变化时更新，例如 phase 开始、checklist 完成、验证结果、阻塞项、commit message 草案。
- README / 用户文档只在用户可见行为变化时更新；长期架构决策可提炼到 tracked 的 architecture / decision docs。
- 不要把无关维护项塞进当前 PRD。比如 provider 模型列表更新，不应该写进某个 AGENTS.md 迁移 PRD。
- 已完成或归档的 plan 默认不再更新，除非用户明确要求做文档清理或复盘。

### 标准工作流

这个流程的核心不是“让 AI 连续写很多代码”，而是：

1. 先把目标说清楚；
2. 再把改动拆成可验证的阶段；
3. 每一轮只推进一个 phase；
4. 每完成一轮，就停下来检查结果，并给出对应的 commit message。

这样做的好处是：即使 AI 产出有偏差，问题也会被限制在一个较小的范围内，不容易把整个 repo 带偏。

### 需求设计阶段示例

```txt
@explore 先了解一下这个项目有关 xxx 的情况
然后帮我分析一下，距离达成以下目标还需要哪些改动：
- aaa
- bbb
- ccc
然后将结果放到`refactor.md`中
```

### 重构场景 Prompt 示例

```txt
我们在另一个会话中已经完成了 `refactor.md`。

现在请你结合该文档以及当前 repo 的实际情况，先做 plan routing：
- 如果 repo 里已有 clearly matching 的 active plan，请复用它；
- 如果没有匹配的 active plan，请为这次重构创建 `.opencode/plans/<plan-name>/PRD.md` 和 `.opencode/plans/<plan-name>/progress.md`；
- 如果多个 active plan 都可能匹配，请先问我。

`PRD.md` 用于定义重构目标、范围、非目标、约束、阶段划分、风险和预期产出。
`progress.md` 用于记录拆分后的各个 phase 的完成状态，细化到可执行 checklist 级别，按 phase 拆到“要改哪些模块、要验证哪些行为、什么算完成”。这些计划文档默认不用纳入 git；只有稳定、长期有价值的结论才提炼进正式项目文档。

在完成这两份文档后，再按 phase 逐步推进重构。
每完成一轮重构，请更新 progress，给我一个对应的 commit message，并暂停等待我的下一步指示。
你可以根据需要自行判断，在读取 repo 时是否要使用 subagent。
```

这个 prompt 的关键约束有四条：

- 先产出规格与进度文档，再开始改代码；
- 先判断是否复用已有 active plan，不盲目新建计划；
- 改动按 phase 推进，而不是一次性做完；
- 每轮结束后暂停，等待人工确认。
