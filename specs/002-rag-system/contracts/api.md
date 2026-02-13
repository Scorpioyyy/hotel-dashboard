# API Contracts: RAG 系统集成

**Feature**: 002-rag-system
**Date**: 2026-02-12
**Base URL**: `http://localhost:8000` (开发) / `https://<service>.railway.app` (生产)

## POST /api/v1/chat

RAG 问答接口，返回 SSE 流式响应。

### Request

```
POST /api/v1/chat
Content-Type: application/json
```

**Body**:
```json
{
  "query": "套房空间大吗？",
  "options": {
    "enable_generation": true
  }
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `query` | string | YES | - | 用户问题（不能为空） |
| `options` | object | NO | `{}` | RAG 参数覆盖 |
| `options.enable_generation` | boolean | NO | `true` | `false` 时只返回检索结果，不生成回复 |

### Response（SSE Stream）

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**事件序列**:

1. **references** - 检索到的参考评论（在生成开始前发送）
```
data: {"type": "references", "data": {"comments": [{"_id": "...", "comment": "...", "score": 4.5, "star": 5, "room_type": "...", "fuzzy_room_type": "...", "travel_type": "...", "publish_date": "2024-10-15", "useful_count": 3, "review_count": 12, "quality_score": 9, "category1": "房间设施", "category2": "整体满意度", "category3": null, "relevance_score": 0.85, "rank": 1}], "summaries": [{"category": "房间设施", "content": "..."}]}}

```

2. **chunk** - 生成的文本片段（多次发送）
```
data: {"type": "chunk", "content": "根据"}

data: {"type": "chunk", "content": "住客"}

data: {"type": "chunk", "content": "评论"}

```

3. **done** - 生成完成信号
```
data: {"type": "done", "timing": {"intent_recognition": 0.5, "intent_detection": 0.8, "intent_expansion": 1.2, "retrieval": 1.5, "ranking": 0.8, "generation": 3.2, "total": 8.0}}

```

4. **error** - 错误信号（替代正常流程）
```
data: {"type": "error", "message": "RAG 系统初始化失败"}

```

### Response（非流式，enable_generation=false）

```
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "references": {
    "comments": [
      {
        "_id": "abc123",
        "comment": "套房空间很大...",
        "score": 4.5,
        "star": 5,
        "room_type": "粤韵大床套房",
        "fuzzy_room_type": "套房",
        "travel_type": "商务出差",
        "publish_date": "2024-10-15",
        "useful_count": 3,
        "review_count": 12,
        "quality_score": 9,
        "category1": "房间设施",
        "category2": "整体满意度",
        "category3": null,
        "relevance_score": 0.85,
        "rank": 1
      }
    ],
    "summaries": []
  },
  "timing": {
    "intent_recognition": 0.5,
    "retrieval": 1.5,
    "ranking": 0.8,
    "total": 2.8
  }
}
```

### Error Responses

| 状态码 | 说明 |
|--------|------|
| 400 | 请求参数无效（query 为空） |
| 500 | 服务器内部错误 |
| 503 | RAG 系统未就绪 |

```json
{
  "detail": "query 不能为空"
}
```

---

## GET /api/v1/health

健康检查接口。

### Request

```
GET /api/v1/health
```

### Response

```
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "status": "ok",
  "version": "1.0.0",
  "rag_ready": true
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | string | 服务状态（"ok" / "error"） |
| `version` | string | API 版本号 |
| `rag_ready` | boolean | RAG 系统是否已初始化完成 |

---

## 前端接口契约（src/lib/qa.ts）

前端保持以下函数签名不变：

### getReferencesForQuestion

```typescript
export async function getReferencesForQuestion(
  question: string
): Promise<Comment[]>
```

**内部实现变更**:
- 旧: 调用 Insforge 数据库查询高质量评论
- 新: 调用 `POST /api/v1/chat` with `enable_generation=false`，将返回的 references.comments 转换为 `Comment[]`

### askQuestionStream

```typescript
export async function* askQuestionStream(
  question: string,
  references: Comment[],
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown>
```

**内部实现变更**:
- 旧: 调用 Insforge AI SDK 流式生成
- 新: 调用 `POST /api/v1/chat` 接收 SSE 流，yield 每个 `chunk` 事件的 content

**注意**: `references` 参数在新实现中不使用（检索已在 `getReferencesForQuestion` 中完成），但签名必须保留以保持兼容。

### Comment 类型映射

Python API 返回的评论对象需要转换为前端 `Comment` 类型：

| Python 字段 | TypeScript 字段 | 转换说明 |
|------------|----------------|---------|
| `_id` | `_id` | 直接映射 |
| `comment` | `comment` | 直接映射 |
| `score` | `score` | 直接映射 |
| `star` | `star` | 直接映射 |
| `useful_count` | `useful_count` | 直接映射 |
| `publish_date` | `publish_date` | 直接映射（字符串） |
| `room_type` | `room_type` | 直接映射 |
| `fuzzy_room_type` | `fuzzy_room_type` | 直接映射 |
| `travel_type` | `travel_type` | 直接映射 |
| `review_count` | `review_count` | 直接映射 |
| `quality_score` | `quality_score` | 直接映射 |
| `category1` | `category1` | 直接映射 |
| `category2` | `category2` | 直接映射 |
| `category3` | `category3` | 直接映射 |
| - | `images` | 默认 `[]`（RAG 不返回此字段） |
| - | `categories` | 从 category1/2/3 派生 |
