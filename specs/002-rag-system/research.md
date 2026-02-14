# Research: RAG 系统集成

**Feature**: 002-rag-system
**Date**: 2026-02-12

## R1: Python-Next.js 集成架构

**Decision**: FastAPI 独立后端服务，Next.js 通过 HTTP API 调用

**Rationale**:
- Next.js 运行在 Node.js 环境，无法直接执行 Python 代码
- RAG 系统依赖大量 Python 特有库（dashscope、dashvector、chromadb、jieba、pickle）
- FastAPI 原生支持 SSE 流式响应，与前端 AsyncGenerator 模式天然匹配
- 前后端分离便于独立部署和扩展

**Alternatives considered**:
- child_process 调用 Python 脚本：性能差、状态管理困难、不适合流式响应
- 完全重写为 TypeScript：工作量巨大，jieba/pickle/dashscope 无 JS 等价物
- Pyodide (WASM Python)：不支持 C 扩展库（numpy、chromadb），不可行

## R2: 流式响应协议

**Decision**: Server-Sent Events (SSE) 通过 FastAPI StreamingResponse

**Rationale**:
- SSE 是 HTTP 标准协议，无需额外依赖（如 WebSocket）
- 前端 fetch + ReadableStream 原生支持 SSE 解析
- 与 OpenAI API 流式响应格式一致，业界标准
- 单向数据流（服务端→客户端）满足问答场景需求

**Alternatives considered**:
- WebSocket：双向通信能力过剩，增加复杂度
- HTTP 长轮询：延迟高，不适合逐字输出
- gRPC streaming：需要额外客户端库，前端兼容性差

## R3: 评论数据源迁移

**Decision**: 从 Insforge REST API 分页获取，替代 CSV 文件读取

**Rationale**:
- 保持与前端数据源一致（前端已从 Insforge 读取）
- 支持数据动态更新
- 数据库中已有完整的 2171 条评论数据
- Insforge REST API 支持分页（offset/limit），可批量获取

**Alternatives considered**:
- 保留 CSV 读取：数据不同步风险，需维护两份数据
- Insforge Python SDK：无官方 Python SDK，使用 REST API 更通用

## R4: 倒排索引存储策略

**Decision**: 存储在 Python 服务端文件系统（`rag-service/data/`）

**Rationale**:
- `inverted_index.pkl` 是 Python pickle 序列化文件（1.5MB）
- pickle 格式只能在 Python 环境中反序列化
- 包含 jieba 分词结果和 BM25 统计数据，与 Python 运行时强耦合
- 文件在服务启动时加载一次即可，无需动态更新

**Alternatives considered**:
- 存入数据库（Insforge BYTEA）：JavaScript 无法反序列化，无意义
- 云对象存储（S3/OSS）：增加复杂度，启动时需下载
- 重建为 Elasticsearch：需额外服务，过度工程化

## R5: Python 代码模块化拆分策略

**Decision**: 按功能职责拆分为 8 个核心模块 + 2 个工具模块

**Rationale**:
- 当前 `lib.py` 有 1769 行，12 个类，违反单一职责原则
- 按类的功能归属分组，相关类放在同一模块
- 依赖方向清晰：config → clients → (index, intent) → retriever → ranker → generator → rag_system

**模块拆分映射**:

| 模块 | 包含的类/函数 | 原始行范围 | 预估行数 |
|------|-------------|-----------|---------|
| `config.py` | TODAY, ROOM_TYPES 常量 | L22-29 | ~30 |
| `modules/clients.py` | LLMClient, EmbeddingClient | L33-77 | ~50 |
| `modules/index.py` | InvertedIndex | L81-225 | ~150 |
| `modules/intent.py` | IntentRecognizer, IntentDetector, IntentExpander, HyDEGenerator | L228-494 | ~270 |
| `modules/retriever.py` | HybridRetriever | L497-901 | ~410（需重构精简） |
| `modules/ranker.py` | Reranker, MultiFactorRanker | L904-1090 | ~190 |
| `modules/generator.py` | ResponseGenerator | L1093-1246 | ~160 |
| `modules/rag_system.py` | HotelReviewRAG | L1249-1565 | ~320（需精简） |
| `utils/formatting.py` | print_retrieval_results, print_rag_result | L1568-1769 | ~200 |
| `utils/database.py` | get_all_comments_from_insforge | 新增 | ~50 |

**注意**: `retriever.py`（~410行）和 `rag_system.py`（~320行）超过 300 行目标，实施时需要精简冗余代码或进一步拆分。

## R6: 数据库字段映射验证

**Decision**: Insforge 数据库字段与 RAG 系统所需字段完全兼容

**Rationale**:
经过对比 Insforge `comments` 表 schema 和 RAG 系统使用的 DataFrame 字段：

| RAG 使用的字段 | Insforge 列名 | 数据类型 | 匹配状态 |
|---------------|-------------|---------|---------|
| `_id`（索引） | `_id` | text (PK) | 完全匹配 |
| `comment` | `comment` | text | 完全匹配 |
| `score` | `score` | real | 完全匹配 |
| `quality_score` | `quality_score` | integer | 完全匹配 |
| `publish_date` | `publish_date` | date | 需要格式转换 |
| `room_type` | `room_type` | text | 完全匹配 |
| `fuzzy_room_type` | `fuzzy_room_type` | text | 完全匹配 |
| `travel_type` | `travel_type` | text | 完全匹配 |
| `useful_count` | `useful_count` | integer | 完全匹配 |
| `review_count` | `review_count` | integer | 完全匹配 |
| `comment_len` | `comment_len` | integer | 完全匹配 |
| `category1/2/3` | `category1/2/3` | text | 完全匹配 |
| `images` | `images` | ARRAY | 完全匹配 |
| `star` | `star` | integer | 完全匹配 |

**注意**: `publish_date` 在数据库中为 `date` 类型，RAG 代码中使用 `datetime` 比较，需确保格式转换正确。

## R7: ResponseGenerator 流式改造

**Decision**: 将 `ResponseGenerator.generate()` 改为支持 yield 的流式生成

**Rationale**:
- 当前实现使用 `Generation.call()` 同步获取完整响应
- 需要改为 `Generation.call(stream=True)` 实现逐 chunk 输出
- DashScope API 原生支持 `stream=True` 参数
- FastAPI 通过 `StreamingResponse` + `async generator` 将 chunk 转为 SSE

**实现方案**:
- 新增 `generate_stream()` 方法，保留原有 `generate()` 方法
- `generate_stream()` yield 每个 chunk 的文本内容
- FastAPI 层将 chunk 包装为 `data: {"type": "chunk", "content": "..."}\n\n` 格式
