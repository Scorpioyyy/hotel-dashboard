# Implementation Plan: 花园酒店评论分析系统

**Branch**: `001-review-dashboard` | **Date**: 2026-01-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-review-dashboard/spec.md`

## Summary

构建一个基于 Next.js 的全栈 Web 应用，为广州花园酒店评论数据提供：
1. **评论详情浏览** - 评论内容和配图展示，支持多条件筛选
2. **数据可视化看板** - 7 个必选维度的图表展示，支持筛选联动
3. **智能问答服务** - 基于 Gemini AI 的自然语言问答，回答附带评论引用

技术方案采用 Next.js 全栈架构，使用 Insforge 作为后端数据库，通过 MCP 调用 Gemini 3 Flash Preview 实现智能问答。

## Technical Context

**Language/Version**: TypeScript 5.x + Next.js 14.x
**Primary Dependencies**: Next.js, Recharts (图表库), Insforge SDK (含 AI 集成)
**Storage**: Insforge (通过 MCP 调用)
**Testing**: Jest + React Testing Library
**Target Platform**: Web (桌面端 + 移动端响应式)
**Project Type**: Web application (Next.js 全栈)
**Performance Goals**: 页面加载 < 3s, 问答响应 < 5s, 图表联动 < 1s
**Constraints**: 全中文界面, 响应式设计, AI 回答必须可溯源
**Scale/Scope**: 单酒店评论数据分析，预估数据量 < 10000 条评论

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 状态 | 验证项 |
|------|------|--------|
| I. 数据驱动设计 | ✅ 通过 | 所有图表基于 enriched_comments.csv 真实数据，类别严格遵循 14 个标准小类 |
| II. 用户体验优先 | ✅ 通过 | 全中文界面，响应式设计，性能目标已定义（<3s/<5s） |
| III. AI 回答可溯源 | ✅ 通过 | FR-021 要求展示 3-5 条引用评论，FR-022 要求无数据时明确告知 |
| IV. 性能与可维护性 | ✅ 通过 | TypeScript 类型安全，模块化设计，数据/展示分离 |
| V. 简洁实用 | ✅ 通过 | 优先使用 Next.js + Insforge 内置功能，避免过度工程化 |

**结论**: 所有宪法原则检查通过，无需复杂度追踪。

## Project Structure

### Documentation (this feature)

```text
specs/001-review-dashboard/
├── plan.md              # 本文件
├── research.md          # Phase 0: 技术研究
├── data-model.md        # Phase 1: 数据模型设计
├── quickstart.md        # Phase 1: 快速入门指南
├── contracts/           # Phase 1: API 契约
│   └── api.yaml         # OpenAPI 规范
└── tasks.md             # Phase 2: 任务列表（/speckit.tasks 生成）
```

### Source Code (repository root)

```text
src/
├── app/                   # Next.js App Router
│   ├── page.tsx           # 评论浏览页（首页）
│   ├── dashboard/         # 数据看板页
│   │   └── page.tsx
│   ├── qa/                # 智能问答页
│   │   └── page.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/            # 可复用组件
│   ├── charts/            # 图表组件
│   │   ├── ScoreChart.tsx
│   │   ├── TrendChart.tsx
│   │   ├── RoomTypeChart.tsx
│   │   ├── TravelTypeChart.tsx
│   │   ├── CategoryChart.tsx
│   │   ├── QualityChart.tsx
│   │   └── UserActivityChart.tsx
│   ├── comments/          # 评论相关组件
│   │   ├── CommentCard.tsx
│   │   ├── CommentList.tsx
│   │   └── ImageGallery.tsx
│   ├── filters/           # 筛选器组件
│   │   ├── DateRangePicker.tsx
│   │   ├── FilterBar.tsx
│   │   └── CategoryFilter.tsx
│   ├── qa/                # 问答组件
│   │   ├── ChatInput.tsx
│   │   ├── ChatMessage.tsx
│   │   └── ReferenceList.tsx
│   └── ui/                # 基础 UI 组件
│       ├── Loading.tsx
│       ├── ErrorMessage.tsx
│       └── Card.tsx
├── lib/                   # 工具库
│   ├── insforge.ts        # Insforge 客户端（含 AI 集成）
│   ├── api.ts             # API 客户端封装（直接调用 Insforge）
│   ├── qa.ts              # 智能问答服务
│   ├── qa-background.ts   # 后台问答服务（支持页面切换时继续接收输出）
│   ├── constants.ts       # 常量定义（14 个标准小类等）
│   └── utils.ts           # 工具函数
├── types/                 # TypeScript 类型定义
│   ├── comment.ts
│   ├── stats.ts
│   └── qa.ts
└── hooks/                 # 自定义 Hooks
    ├── useComments.ts
    ├── useStats.ts
    └── useFilters.ts

public/
├── enriched_comments.csv  # 原始数据文件
└── categories.json        # 类别定义文件
```

**Structure Decision**: 采用 Next.js App Router 架构，前后端代码在同一项目中。没有独立的 API Routes，所有数据操作通过 `lib/api.ts` 直接调用 Insforge 客户端。智能问答功能使用后台流式服务（`lib/qa-background.ts`）支持页面切换时继续接收输出。

## Complexity Tracking

> 无宪法原则违反，此表留空。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
