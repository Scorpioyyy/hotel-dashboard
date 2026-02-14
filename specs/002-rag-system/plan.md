# Implementation Plan: RAG 系统集成

**Branch**: `002-rag-system` | **Date**: 2026-02-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-rag-system/spec.md`

## Summary

将完整的 Python RAG 系统（1769行，12个类）集成到 Next.js 酒店评论项目中，替换当前简单的类别匹配 + Gemini 生成的智能问答。采用 FastAPI 独立后端服务架构，通过 SSE 流式响应连接前端。核心工作包括：Python 代码模块化拆分、评论数据从 CSV 迁移到 Insforge 数据库、构建 FastAPI HTTP 服务、修改前端 `qa.ts` 调用逻辑（保持接口签名不变，UI 零改动）。

## Technical Context

**Language/Version**: Python 3.x (Anaconda base) + TypeScript (Next.js 15)
**Primary Dependencies**: FastAPI, uvicorn, dashscope, dashvector, chromadb, jieba, pandas, numpy | Next.js, @insforge/sdk
**Storage**: Insforge PostgreSQL (评论数据), DashVector (向量), ChromaDB (类别摘要), 文件系统 (倒排索引 PKL)
**Testing**: 手动测试 (cURL + 浏览器联调)，运行 example.py 验证拆分
**Target Platform**: Windows 11 开发环境，Vercel + Railway 部署
**Project Type**: Web (Python 后端 + Next.js 前端)
**Performance Goals**: TTFT < 5秒, 完整回复 < 15秒
**Constraints**: 前端 UI 零改动, HyDE 禁用, Anaconda base 环境, 模块 < 300 行
**Scale/Scope**: 2171 条评论, 单用户开发/学术项目

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 状态 | 说明 |
|------|------|------|
| I. 数据驱动设计 | PASS | RAG 系统基于真实评论数据检索和生成，从 Insforge 读取保证数据一致性 |
| II. 用户体验优先 | PASS | 中文界面不变；问答响应 < 5秒（TTFT）满足要求；流式输出提供即时反馈 |
| III. AI 回答可溯源 | PASS | RAG 系统核心优势：五路检索 + 重排确保相关性；Top-10 参考评论作为引用来源 |
| IV. 性能与可维护性 | PASS | 模块化拆分（8+2 模块，每个 < 300 行）；Python 使用类型提示；TypeScript 保持类型安全 |
| V. 简洁实用 | PASS (justified) | 引入 FastAPI 是必要的（Python 无法在 Node.js 中运行）；复用已有 RAG 实现不过度工程化（见 Complexity Tracking） |

**技术栈约束检查**:
- PASS 前端框架：Next.js（不变）
- PASS 后端服务：Insforge（评论数据读取保持）
- PASS 编程语言：TypeScript + Python
- JUSTIFIED 新增 FastAPI 后端服务（见 Complexity Tracking）

**Post-Phase 1 Re-check**: 所有原则继续满足。数据模型与 Insforge schema 完全兼容（见 [research.md](research.md) R6），API 契约清晰（见 [contracts/api.md](contracts/api.md)），流式协议使用标准 SSE。

## Project Structure

### Documentation (this feature)

```text
specs/002-rag-system/
├── plan.md              # This file
├── research.md          # Phase 0: 技术研究决策
├── data-model.md        # Phase 1: 数据模型设计
├── quickstart.md        # Phase 1: 快速启动指南
├── contracts/
│   └── api.md           # Phase 1: API 接口契约
└── tasks.md             # Phase 2: 任务列表（/speckit.tasks 生成）
```

### Source Code (repository root)

```text
rag-service/                      # Python FastAPI 服务（从 rag/ 重命名）
├── main.py                       # FastAPI 入口 + 路由
├── config.py                     # 常量配置（TODAY, ROOM_TYPES）
├── requirements.txt              # Python 依赖列表
├── .env                          # 环境变量（不提交 Git）
├── modules/
│   ├── __init__.py
│   ├── clients.py                # LLMClient, EmbeddingClient (~50 lines)
│   ├── index.py                  # InvertedIndex (~150 lines)
│   ├── intent.py                 # IntentRecognizer, IntentDetector, IntentExpander, HyDEGenerator (~270 lines)
│   ├── retriever.py              # HybridRetriever (~300 lines, 需精简)
│   ├── ranker.py                 # Reranker, MultiFactorRanker (~190 lines)
│   ├── generator.py              # ResponseGenerator (~160 lines, 新增 generate_stream)
│   └── rag_system.py             # HotelReviewRAG (~300 lines, 需精简)
├── utils/
│   ├── __init__.py
│   ├── formatting.py             # print_retrieval_results, print_rag_result (~200 lines)
│   └── database.py               # get_all_comments_from_insforge (~50 lines)
└── data/
    ├── inverted_index.pkl        # BM25 倒排索引（从 public/ 移入）
    └── chroma_db/                # ChromaDB 类别摘要数据库

src/                              # Next.js 前端（最小改动）
├── lib/
│   ├── qa.ts                     # 修改：调用 Python FastAPI
│   ├── qa-background.ts          # 不修改
│   ├── api.ts                    # 不修改
│   └── insforge.ts               # 不修改
├── app/
│   └── qa/page.tsx               # 不修改
├── components/qa/                # 不修改
└── types/comment.ts              # 不修改
```

**Structure Decision**: Web 应用架构（Python 后端 + Next.js 前端）。Python RAG 服务独立于 Next.js 项目，通过 HTTP API 通信。前端仅修改 `src/lib/qa.ts` 的内部实现，保持接口签名不变。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 引入 FastAPI 服务（新依赖） | Python RAG 系统无法在 Node.js 环境运行，需要独立的 Python HTTP 服务 | child_process 调用性能差且不支持流式；完全重写为 TS 工作量过大且缺乏等价库 |
| 两个运行时环境 (Python + Node.js) | RAG 系统依赖 Python 特有库（dashscope, chromadb, jieba, pickle），无 JS 替代品 | 单一运行时不可行，这是跨语言集成的最小复杂度方案 |
