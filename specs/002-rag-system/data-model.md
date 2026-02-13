# Data Model: RAG 系统集成

**Feature**: 002-rag-system
**Date**: 2026-02-12

## Entities

### 1. Comment（评论）

**存储**: Insforge PostgreSQL `comments` 表
**主键**: `_id` (text)
**记录数**: 2171

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | text | YES | 唯一标识符（主键） |
| `comment` | text | NO | 评论正文 |
| `images` | text[] | NO | 评论图片 URL 数组 |
| `score` | real | NO | 评分（浮点） |
| `star` | integer | NO | 星级（1-5） |
| `useful_count` | integer | NO | 有用数 |
| `publish_date` | date | NO | 发布日期 |
| `room_type` | text | NO | 精确房型 |
| `fuzzy_room_type` | text | NO | 模糊房型（大床房/双床房/套房/主题房） |
| `travel_type` | text | NO | 出行类型 |
| `review_count` | integer | NO | 用户评论总数 |
| `comment_len` | integer | NO | 评论长度 |
| `log_comment_len` | real | NO | 对数评论长度 |
| `log_useful_count` | real | NO | 对数有用数 |
| `log_review_count` | real | NO | 对数评论总数 |
| `quality_score` | integer | NO | 质量评分（1-10） |
| `categories` | text[] | NO | 类别数组 |
| `category1` | text | NO | 主类别 |
| `category2` | text | NO | 次类别 |
| `category3` | text | NO | 第三类别 |

### 2. InvertedIndex（倒排索引）

**存储**: Python 服务端文件系统 `rag-service/data/inverted_index.pkl`
**格式**: Python pickle 序列化

| 属性 | 类型 | 说明 |
|------|------|------|
| `index` | dict[str, dict[str, int]] | 词项 → {文档ID → 词频} |
| `doc_lengths` | dict[str, int] | 文档ID → 文档长度 |
| `avg_doc_length` | float | 平均文档长度 |
| `num_docs` | int | 文档总数 |
| `documents` | dict[str, str] | 文档ID → 文档内容 |
| `stopwords` | set[str] | 停用词集合 |
| `k1` | float | BM25 参数（默认 1.5） |
| `b` | float | BM25 参数（默认 0.75） |

### 3. DashVector Collections（向量集合）

**存储**: DashVector 云端服务

#### 3a. comments_collection（评论向量集合）
| 属性 | 类型 | 说明 |
|------|------|------|
| `id` | str | 评论 _id |
| `vector` | float[1024] | text-embedding-v4 向量 |
| `fields.room_type` | str | 精确房型（用于筛选） |

#### 3b. reverse_queries_collection（反向 Query 向量集合）
| 属性 | 类型 | 说明 |
|------|------|------|
| `id` | str | 反向 Query ID |
| `vector` | float[1024] | 反向 Query 的向量 |
| `fields.room_type` | str | 精确房型（用于筛选） |
| `fields.comment_id` | str | 对应的评论 _id |

### 4. ChromaDB Collection（类别摘要集合）

**存储**: Python 服务端本地 `rag-service/data/chroma_db/`

| 属性 | 类型 | 说明 |
|------|------|------|
| `id` | str | 摘要 ID |
| `document` | str | 类别摘要文本 |
| `embedding` | float[] | 摘要向量 |
| `metadata.category` | str | 所属类别名称 |

### 5. ChatRequest（问答请求）

**来源**: 前端 HTTP 请求体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | YES | 用户问题文本 |
| `options` | object | NO | RAG 参数覆盖 |
| `options.enable_generation` | boolean | NO | 是否生成回复（默认 true） |

### 6. SSE Event（流式事件）

**来源**: FastAPI 服务端响应

| type | 数据内容 | 说明 |
|------|---------|------|
| `references` | `{comments: [...], summaries: [...]}` | 参考评论和摘要 |
| `chunk` | `{content: "..."}` | 生成的文本片段 |
| `done` | `{timing: {...}}` | 生成完成信号 |
| `error` | `{message: "..."}` | 错误信息 |

## Relationships

```
Comment (Insforge DB)
  ├── 1:1 → InvertedIndex entries (by _id)
  ├── 1:1 → DashVector comments_collection (by _id)
  └── 1:N → DashVector reverse_queries_collection (by comment_id)

ChromaDB summaries
  └── N:1 → StandardCategory (14 categories)

ChatRequest
  └── triggers → SSE Event stream
```

## Data Flow

```
用户查询 (ChatRequest)
    │
    ├─→ IntentRecognizer: 判断是否需要检索
    ├─→ IntentDetector: 检测房型/时效性
    ├─→ IntentExpander: 扩展查询
    │
    ├─→ HybridRetriever: 五路检索
    │   ├── BM25: InvertedIndex.search()
    │   ├── Vector: DashVector comments_collection
    │   ├── Reverse: DashVector reverse_queries_collection
    │   ├── HyDE: (已禁用)
    │   └── Summary: ChromaDB summaries_collection
    │   └── RRF Fusion → 候选评论列表
    │
    ├─→ MultiFactorRanker: 重排 Top-10
    │   ├── Reranker: 相关性打分
    │   └── 多因子: 质量25% + 相关性40% + 时效性20% + ...
    │
    └─→ ResponseGenerator: 流式生成
        └── SSE Event stream → 前端
```
