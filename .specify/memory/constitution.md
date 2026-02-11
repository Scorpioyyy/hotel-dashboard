<!--
===============================================================================
SYNC IMPACT REPORT
===============================================================================
Version change: N/A (initial) → 1.0.0
Modified principles: N/A (initial creation)
Added sections:
  - Core Principles (5 principles)
  - Technical Constraints
  - Quality Standards
  - Governance
Removed sections: N/A
Templates requiring updates:
  - .specify/templates/plan-template.md: ✅ No updates needed (generic structure)
  - .specify/templates/spec-template.md: ✅ No updates needed (generic structure)
  - .specify/templates/tasks-template.md: ✅ No updates needed (generic structure)
Follow-up TODOs: None
===============================================================================
-->

# 花园酒店评论分析系统 Constitution

## Core Principles

### I. 数据驱动设计 (Data-Driven Design)

所有功能开发必须以实际评论数据为核心驱动：
- 数据可视化必须准确反映 `enriched_comments.csv` 中的真实数据分布
- 图表设计必须服务于数据洞察，禁止添加无数据支撑的装饰性元素
- 评论类别必须严格遵循 `categories.json` 定义的 14 个标准小类，非标准类别必须过滤

**理由**：本系统核心价值在于提供准确的数据洞察，任何失真都会导致错误的业务决策。

### II. 用户体验优先 (User Experience First)

界面设计必须满足以下要求：
- 全部使用中文界面，包括图表标签、提示信息、错误消息
- 页面加载时间必须 < 3 秒，问答响应时间必须 < 5 秒
- 交互反馈必须及时（加载状态、错误提示、成功确认）

**理由**：系统面向业务用户，良好的用户体验直接影响系统的采用率和使用效率。

### III. AI 回答可溯源 (AI Response Traceability)

智能问答模块必须确保回答的可追溯性：
- AI 回答必须基于实际检索到的评论数据，禁止生成无依据的内容
- 必须展示 AI 回答所依据的原始评论作为引用来源
- 召回的评论数据必须与用户问题具有语义相关性
- 当无相关数据时，必须明确告知用户而非编造回答

**理由**：避免 AI 幻觉，确保业务决策基于真实的顾客反馈。

### IV. 性能与可维护性 (Performance & Maintainability)

代码实现必须兼顾性能和可维护性：
- 代码结构必须模块化，组件职责单一
- 必须使用 TypeScript 确保类型安全
- 数据处理逻辑必须与展示逻辑分离

**理由**：系统需要长期维护和迭代，良好的架构设计降低后续开发成本。

### V. 简洁实用 (Simplicity & Pragmatism)

开发过程必须遵循简洁原则：
- 优先使用 Next.js 和 Insforge 提供的内置功能，避免引入额外依赖
- 功能实现以满足需求文档为准，禁止过度工程化
- 图表类型选择必须基于数据特点和展示效果，不追求复杂
- 代码注释适度，仅在逻辑不自明处添加说明

**理由**：项目目标明确，过度设计会增加开发时间和维护负担。

## Technical Constraints

**技术栈限定**：
- 前端框架：Next.js（必须使用）
- 后端服务：Insforge（通过 MCP 调用）
- 编程语言：TypeScript/Python

## Quality Standards

**性能指标**：
- 页面加载时间 < 3 秒
- 图表渲染流畅无卡顿
- 问答响应时间 < 5 秒

**代码质量**：
- 组件必须可复用且职责单一
- API 接口必须有错误处理

**用户体验**：
- 所有文本必须使用中文
- 必须提供加载状态指示
- 错误信息必须友好且具有指导性

## Governance

本 Constitution 为项目开发的最高指导原则：

1. **遵循优先级**：当需求文档与 Constitution 冲突时，以 Constitution 为准
2. **修订流程**：任何原则修改必须经过评审并记录变更理由
3. **合规检查**：每次代码审查必须验证是否符合 Constitution 原则
4. **例外处理**：如需违反原则，必须在 Complexity Tracking 中记录理由和被拒绝的替代方案

**运行时指导**：开发过程中遇到技术决策时，参考 `需求文档.md` 获取详细需求说明。

**Version**: 1.0.0 | **Ratified**: 2026-01-14 | **Last Amended**: 2026-01-14
