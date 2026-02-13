# Feature Specification: RAG 系统集成

**Feature Branch**: `002-rag-system`
**Created**: 2026-02-12
**Status**: Draft
**Input**: 将完整的 Python RAG 系统集成到 Next.js 项目中，替换当前简单的智能问答实现

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 智能问答获得高质量回答 (Priority: P1)

用户在酒店评论系统的"智能问答"页面提出关于酒店的问题（如"套房空间大吗？""早餐怎么样？"），系统通过完整的 RAG 流程（意图识别 → 五路混合检索 → 重排序 → 流式生成）返回基于真实住客评论的高质量回答，同时展示最相关的 10 条参考评论。

**Why this priority**: 这是本次集成的核心目标——用完整的 RAG 系统替换当前简单的类别匹配 + 高质量评论检索 + 大模型生成的问答逻辑，显著提升回答的准确性和相关性。

**Independent Test**: 用户在问答页面输入问题，观察是否能收到流式回答和相关参考评论。可通过对比同一问题在新旧系统下的回答质量来验证改善效果。

**Acceptance Scenarios**:

1. **Given** 用户在问答页面, **When** 输入"套房空间大吗？"并提交, **Then** 系统通过 RAG 流程检索相关评论并流式生成回答，回答内容基于真实评论且与套房空间相关
2. **Given** 用户在问答页面, **When** 输入问题并等待回答完成, **Then** 页面下方展示最相关的 10 条参考评论（来自 RAG 重排后的 Top-10）
3. **Given** 用户在问答页面正在接收流式回答, **When** 点击终止按钮, **Then** 回答生成立即停止，已生成的内容保留
4. **Given** 用户在问答页面, **When** 连续提出多个问题, **Then** 会话历史正常保存和展示（与当前行为一致）

---

### User Story 2 - Python RAG 代码模块化重构 (Priority: P1)

开发者需要将当前 1769 行的单文件 Python RAG 系统（`rag/lib.py`）拆分为符合工程规范的模块化结构，每个模块负责单一功能（如客户端封装、意图识别、混合检索、重排序、回复生成等），便于后续维护、测试和扩展。

**Why this priority**: 模块化是后续所有集成工作的基础。不拆分代码就无法构建清晰的 FastAPI 服务层，也无法满足工程规范要求。

**Independent Test**: 拆分后运行原有的测试用例（`example.py`），确认 RAG 系统的查询功能与拆分前输出一致。

**Acceptance Scenarios**:

1. **Given** 当前 `rag/lib.py` 包含全部 RAG 逻辑, **When** 完成代码拆分, **Then** 代码被分为至少 8 个模块文件，每个文件不超过 300 行
2. **Given** 拆分后的模块结构, **When** 运行测试用例（相同的查询和参数）, **Then** 输出结果与拆分前一致
3. **Given** 拆分后的模块结构, **When** 检查模块间依赖关系, **Then** 无循环依赖，依赖方向为 utils → modules → rag_system → main

---

### User Story 3 - 评论数据从数据库读取 (Priority: P1)

RAG 系统初始化时从 Insforge 数据库（而非 CSV 文件）加载评论数据，确保 RAG 系统与前端使用相同的数据源，保持数据一致性。

**Why this priority**: 数据一致性是系统可靠性的基础。前端已经从 Insforge 读取评论数据，RAG 后端也必须使用同一数据源。

**Independent Test**: 启动 RAG 服务后，验证加载的评论数量与 Insforge 数据库中的记录数一致。

**Acceptance Scenarios**:

1. **Given** Insforge 数据库中有 2171 条评论, **When** RAG 系统初始化, **Then** 成功加载全部 2171 条评论数据
2. **Given** RAG 系统已初始化, **When** 执行查询, **Then** 检索结果中的评论数据与 Insforge 数据库内容一致
3. **Given** 数据库连接配置缺失或错误, **When** RAG 系统尝试初始化, **Then** 系统给出明确的错误提示

---

### User Story 4 - FastAPI 服务提供 RAG 问答 API (Priority: P1)

通过 FastAPI 框架将 RAG 系统封装为 HTTP 服务，提供流式问答接口和健康检查接口，支持 Next.js 前端通过 HTTP 调用。

**Why this priority**: FastAPI 服务是连接前端和 RAG 系统的桥梁，是前端集成的前置条件。

**Independent Test**: 启动 FastAPI 服务后，通过 HTTP 客户端（如 cURL）直接调用问答接口，验证流式响应和参考评论返回。

**Acceptance Scenarios**:

1. **Given** FastAPI 服务已启动, **When** 发送 POST 请求到 `/api/v1/chat` 包含查询内容, **Then** 收到 SSE 流式响应，包含回答文本片段和参考评论
2. **Given** FastAPI 服务已启动, **When** 发送 GET 请求到 `/api/v1/health`, **Then** 返回服务状态信息
3. **Given** FastAPI 服务已启动, **When** 来自不同域名的请求到达, **Then** CORS 中间件允许跨域访问
4. **Given** RAG 系统配置, **When** 处理查询请求, **Then** HyDE 召回通路被禁用（`enable_hyde=False`），其他参数使用默认值

---

### User Story 5 - 前端无缝对接 Python RAG 服务 (Priority: P1)

修改 Next.js 前端的问答逻辑层（`src/lib/qa.ts`），将 API 调用从 Insforge AI SDK 切换为 Python FastAPI 服务，同时保持所有函数签名和行为不变，确保 UI 层无需任何修改。

**Why this priority**: 这是将整个 RAG 系统能力交付给用户的最后一步。接口兼容性确保了零 UI 改动。

**Independent Test**: 启动 FastAPI 服务和 Next.js 开发服务器，在浏览器中使用问答功能，验证流式输出、参考评论展示、终止生成等所有交互行为与之前一致。

**Acceptance Scenarios**:

1. **Given** FastAPI 服务和 Next.js 同时运行, **When** 用户在问答页面提问, **Then** 回答以流式方式逐字显示（与之前的体验一致）
2. **Given** 前端代码修改完成, **When** 检查 `src/app/qa/page.tsx` 和 `src/components/qa/*`, **Then** 这些文件未被修改
3. **Given** 前端代码修改完成, **When** 检查 `src/lib/qa.ts` 的导出函数签名, **Then** `getReferencesForQuestion` 和 `askQuestionStream` 的签名与修改前完全一致
4. **Given** 用户在问答页面, **When** 在回答生成过程中点击终止, **Then** 生成立即停止（AbortSignal 正常工作）

---

### User Story 6 - 部署就绪 (Priority: P2)

系统具备部署到云端的条件：Python 服务可部署到 Railway，Next.js 前端可部署到 Vercel，通过环境变量配置服务间通信。

**Why this priority**: 部署是交付的最终步骤，但本地联调验证通过后即可满足核心需求，部署为可选的后续工作。

**Independent Test**: 按照部署文档配置环境变量并部署，验证云端服务能正常处理问答请求。

**Acceptance Scenarios**:

1. **Given** Python 服务已准备好部署文件（Procfile、runtime.txt、requirements.txt）, **When** 部署到 Railway, **Then** 服务启动成功并响应健康检查
2. **Given** Next.js 前端配置了 Python API 地址, **When** 部署到 Vercel, **Then** 前端能正常调用远程 Python API

---

### Edge Cases

- 当 Python FastAPI 服务未启动或不可达时，前端问答功能应显示明确的错误提示而非静默失败
- 当用户输入空查询或超长查询时，系统应进行合理处理（拒绝空查询，截断或拒绝超长查询）
- 当 Insforge 数据库不可达时，RAG 系统初始化应给出明确错误，不应回退到 CSV
- 当 DashVector 或 ChromaDB 服务不可达时，对应的检索通路应优雅降级，其余通路继续工作
- 当网络中断导致 SSE 流式响应中断时，前端应正确处理中断状态
- 当并发用户同时提问时，RAG 系统应能正常处理多个请求

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 将 `rag/lib.py`（1769行）拆分为至少 8 个独立模块（clients、index、intent、retriever、ranker、generator、rag_system、config），每个模块不超过 300 行
- **FR-002**: 系统 MUST 将 `rag/` 目录重命名为 `rag-service/`，并建立 `modules/`、`utils/`、`data/` 子目录结构
- **FR-003**: 系统 MUST 从 Insforge 数据库读取评论数据（通过 REST API 分页获取），替代 CSV 文件读取
- **FR-004**: 系统 MUST 提供 FastAPI HTTP 服务，包含 POST `/api/v1/chat`（流式问答）和 GET `/api/v1/health`（健康检查）接口
- **FR-005**: 系统 MUST 通过 Server-Sent Events (SSE) 实现流式响应，逐字返回生成内容
- **FR-006**: 系统 MUST 在问答流程中禁用 HyDE 召回通路（`enable_hyde=False`），其他参数使用默认值
- **FR-007**: 系统 MUST 保持 `src/lib/qa.ts` 中 `getReferencesForQuestion` 和 `askQuestionStream` 的函数签名不变
- **FR-008**: 系统 MUST 不修改 `src/app/qa/page.tsx`、`src/lib/qa-background.ts`、`src/components/qa/*` 等 UI 文件
- **FR-009**: 系统 MUST 配置 CORS 中间件，允许 Next.js 前端域名的跨域请求
- **FR-010**: 系统 MUST 支持 AbortSignal 终止正在进行的流式生成
- **FR-011**: 系统 MUST 将倒排索引文件（`inverted_index.pkl`）和 ChromaDB 数据存储在 Python 服务端文件系统
- **FR-012**: 系统 MUST 通过环境变量管理所有敏感配置（API Keys、数据库地址等），不硬编码
- **FR-013**: 系统 MUST 为每次问答返回 Top-10 参考评论（经过混合检索 + 重排后的结果）
- **FR-014**: 系统 MUST 包含完整的 `requirements.txt` 列出所有 Python 依赖
- **FR-015**: 系统 MUST 确保评论浏览和数据看板功能不受影响（零改动）

### Key Entities

- **评论（Comment）**: 酒店住客评论数据，包含评论内容、评分、房型、出行类型、发布日期、质量分、类别标签等。存储于 Insforge 数据库，是 RAG 检索的核心数据源
- **查询意图（Intent）**: 用户问题经过意图识别后的结构化表示，包含是否需要检索、意图类别、房型检测、时效性检测等信息
- **检索结果（RetrievalResult）**: 五路混合检索（BM25、向量、反向 Query、HyDE、类别摘要）的融合结果，包含评论 ID 和融合分数
- **重排结果（RankedResult）**: 经过 Rerank 模型打分和多因子排序后的最终排序结果，包含相关性分数、质量分、时效性等
- **流式事件（SSE Event）**: FastAPI 返回的流式事件，包含 intent/references/chunk/done 四种类型

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户提出问题后，首个回答文字在 5 秒内开始显示
- **SC-002**: 完整回答在 15 秒内生成完毕
- **SC-003**: 每次问答返回 10 条参考评论，且参考评论与用户问题的相关性明显优于旧系统的简单类别匹配结果
- **SC-004**: 评论浏览和数据看板功能 100% 不受影响，所有现有功能正常工作
- **SC-005**: 前端 UI 文件（`page.tsx`、组件、样式）零修改，所有改动仅在后端逻辑层
- **SC-006**: Python 代码模块化后，每个文件不超过 300 行，无循环依赖
- **SC-007**: RAG 系统成功从 Insforge 数据库加载全部评论数据（2171 条），数量与数据库一致
- **SC-008**: 用户可以正常终止正在进行的回答生成，与旧系统行为一致
