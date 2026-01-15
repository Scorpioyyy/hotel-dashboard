# Tasks: 广州花园酒店评论数据分析系统

**Input**: Design documents from `/specs/001-review-dashboard/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api.yaml, research.md

**Tests**: 未在规格中明确要求测试，本任务列表不包含测试任务。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Download Insforge Next.js template using MCP tool `mcp__insforge__download-template`
- [x] T002 Copy template files to project root and install dependencies with `npm install`
- [x] T003 [P] Install Recharts chart library with `npm install recharts`
- [x] T004 [P] Configure Tailwind CSS for styling (if not included in template)
- [x] T005 Create project directory structure per plan.md in src/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Types & Constants

- [ ] T006 [P] Create TypeScript types for Comment entity in src/types/comment.ts
- [ ] T007 [P] Create TypeScript types for Stats in src/types/stats.ts
- [ ] T008 [P] Create TypeScript types for QA in src/types/qa.ts
- [ ] T009 [P] Create TypeScript types for Filters in src/types/filters.ts
- [ ] T010 Create constants file with 14 standard categories in src/lib/constants.ts

### Database & Data Import

- [ ] T011 Create Insforge client wrapper in src/lib/insforge.ts
- [ ] T012 Create comments table in Insforge using MCP tool `mcp__insforge__run-raw-sql` with schema from data-model.md
- [ ] T013 Import enriched_comments.csv to Insforge using MCP tool `mcp__insforge__bulk-upsert`
- [ ] T014 Create database indexes for performance optimization using MCP tool `mcp__insforge__run-raw-sql`

### Shared UI Components

- [ ] T015 [P] Create Loading component in src/components/ui/Loading.tsx
- [ ] T016 [P] Create ErrorMessage component in src/components/ui/ErrorMessage.tsx
- [ ] T017 [P] Create Card component in src/components/ui/Card.tsx

### Shared Utilities

- [ ] T018 Create utility functions (date parsing, category filtering) in src/lib/utils.ts

### Layout

- [ ] T019 Create root layout with navigation in src/app/layout.tsx
- [ ] T020 Create global styles with Chinese font support in src/app/globals.css

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 数据可视化看板 (Priority: P1) 🎯 MVP

**Goal**: 展示 7 个必选维度的图表，支持筛选联动，响应式设计

**Independent Test**: 访问看板首页，验证 7 个图表正确渲染并展示真实数据，筛选后图表联动更新

### API Implementation for US1

- [ ] T021 [US1] Implement GET /api/stats route in src/app/api/stats/route.ts
- [ ] T022 [US1] Implement GET /api/filters/options route in src/app/api/filters/route.ts

### Filter Components for US1

- [ ] T023 [P] [US1] Create DateRangePicker component in src/components/filters/DateRangePicker.tsx
- [ ] T024 [P] [US1] Create CategoryFilter component in src/components/filters/CategoryFilter.tsx
- [ ] T025 [US1] Create FilterBar component (combines all filters) in src/components/filters/FilterBar.tsx

### Chart Components for US1

- [ ] T026 [P] [US1] Create ScoreChart (评分分布) in src/components/charts/ScoreChart.tsx
- [ ] T027 [P] [US1] Create TrendChart (时间趋势) in src/components/charts/TrendChart.tsx
- [ ] T028 [P] [US1] Create RoomTypeChart (房型分析) in src/components/charts/RoomTypeChart.tsx
- [ ] T029 [P] [US1] Create TravelTypeChart (旅行类型) in src/components/charts/TravelTypeChart.tsx
- [ ] T030 [P] [US1] Create CategoryChart (类别分布) in src/components/charts/CategoryChart.tsx
- [ ] T031 [P] [US1] Create QualityChart (质量分布) in src/components/charts/QualityChart.tsx
- [ ] T032 [P] [US1] Create UserActivityChart (用户活跃度) in src/components/charts/UserActivityChart.tsx

### Hooks for US1

- [ ] T033 [US1] Create useStats hook for fetching stats data in src/hooks/useStats.ts
- [ ] T034 [US1] Create useFilters hook for filter state management in src/hooks/useFilters.ts

### Dashboard Page for US1

- [ ] T035 [US1] Implement dashboard page with all charts in src/app/page.tsx
- [ ] T036 [US1] Add responsive grid layout for charts on dashboard page
- [ ] T037 [US1] Implement filter-chart linkage (筛选联动) on dashboard page

**Checkpoint**: User Story 1 完成 - 看板页面可独立访问和测试

---

## Phase 4: User Story 2 - 评论详情浏览 (Priority: P2)

**Goal**: 展示评论列表和配图，支持多条件筛选和高质量评论推荐

**Independent Test**: 访问评论列表页，验证评论内容和图片显示，筛选功能正常工作

### API Implementation for US2

- [ ] T038 [US2] Implement GET /api/comments route with pagination in src/app/api/comments/route.ts
- [ ] T039 [US2] Implement GET /api/comments/[id] route in src/app/api/comments/[id]/route.ts

### Comment Components for US2

- [ ] T040 [P] [US2] Create CommentCard component in src/components/comments/CommentCard.tsx
- [ ] T041 [P] [US2] Create ImageGallery component (lightbox) in src/components/comments/ImageGallery.tsx
- [ ] T042 [US2] Create CommentList component with pagination in src/components/comments/CommentList.tsx

### Hooks for US2

- [ ] T043 [US2] Create useComments hook for fetching comments in src/hooks/useComments.ts

### Comments Page for US2

- [ ] T044 [US2] Implement comments list page in src/app/comments/page.tsx
- [ ] T045 [US2] Add filter integration (reuse FilterBar from US1) on comments page
- [ ] T046 [US2] Implement high-quality filter (quality_score >= 8) toggle on comments page
- [ ] T047 [US2] Add responsive layout for comment cards

**Checkpoint**: User Story 2 完成 - 评论列表页可独立访问和测试

---

## Phase 5: User Story 3 - 智能问答服务 (Priority: P3)

**Goal**: 自然语言问答，AI 回答附带 3-5 条评论引用

**Independent Test**: 输入问题，验证返回基于真实评论的回答和引用来源

### API Implementation for US3

- [ ] T048 [US3] Implement POST /api/qa route with Insforge AI SDK in src/app/api/qa/route.ts
- [ ] T049 [US3] Implement keyword extraction and comment retrieval logic in /api/qa
- [ ] T050 [US3] Implement streaming response for AI answers in /api/qa

### QA Components for US3

- [ ] T051 [P] [US3] Create ChatInput component in src/components/qa/ChatInput.tsx
- [ ] T052 [P] [US3] Create ChatMessage component in src/components/qa/ChatMessage.tsx
- [ ] T053 [US3] Create ReferenceList component (显示引用评论) in src/components/qa/ReferenceList.tsx

### QA Page for US3

- [ ] T054 [US3] Implement QA page with chat interface in src/app/qa/page.tsx
- [ ] T055 [US3] Add loading state during AI processing
- [ ] T056 [US3] Handle no-data scenario with user-friendly message
- [ ] T057 [US3] Add responsive layout for QA page

**Checkpoint**: User Story 3 完成 - 智能问答页可独立访问和测试

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T058 [P] Add navigation menu to switch between dashboard, comments, and QA pages
- [ ] T059 [P] Optimize mobile responsive design across all pages
- [ ] T060 [P] Add error boundaries for graceful error handling
- [ ] T061 Verify all text is in Chinese (buttons, labels, error messages)
- [ ] T062 Performance optimization: verify page load < 3s, QA response < 5s
- [ ] T063 Run quickstart.md validation to ensure setup instructions work

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational (BLOCKS all user stories)
    ↓
Phase 3: US1 (P1) ─┬─→ Phase 4: US2 (P2) ─┬─→ Phase 5: US3 (P3)
                   │                       │
                   └── Can run in parallel ┘
    ↓
Phase 6: Polish
```

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 - No dependencies on other stories
- **US2 (P2)**: Can start after Phase 2 - Reuses FilterBar from US1 (optional)
- **US3 (P3)**: Can start after Phase 2 - Independent of US1/US2

### Within Each User Story

1. API routes first
2. Components (parallelizable)
3. Hooks
4. Page integration
5. Polish (responsive, error handling)

### Parallel Opportunities

**Phase 2 (Foundational)**:
```
T006, T007, T008, T009 (types) - all parallel
T015, T016, T017 (UI components) - all parallel
```

**Phase 3 (US1 Charts)**:
```
T026, T027, T028, T029, T030, T031, T032 (charts) - all parallel
T023, T024 (filters) - parallel
```

**Phase 4 (US2 Components)**:
```
T040, T041 (comment components) - parallel
```

**Phase 5 (US3 Components)**:
```
T051, T052 (QA components) - parallel
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (数据导入、类型定义、基础组件)
3. Complete Phase 3: User Story 1 (数据可视化看板)
4. **STOP and VALIDATE**: 访问首页验证 7 个图表和筛选联动
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → 基础设施就绪
2. Add US1 → 看板功能可用 (MVP!)
3. Add US2 → 评论浏览功能可用
4. Add US3 → 智能问答功能可用
5. Polish → 生产就绪

### Suggested Execution Order (Single Developer)

```
Day 1: T001-T020 (Setup + Foundational)
Day 2: T021-T037 (US1 - Dashboard)
Day 3: T038-T047 (US2 - Comments)
Day 4: T048-T057 (US3 - QA)
Day 5: T058-T063 (Polish)
```

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [USx] label maps task to specific user story for traceability
- All UI text must be in Chinese (宪法原则 II)
- Categories must be filtered to 14 standard subcategories (宪法原则 I)
- AI answers must include 3-5 reference comments (宪法原则 III)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
