"""FastAPI 入口 — 酒店评论 RAG 问答服务"""

import os
import sys
import json
import asyncio
import numpy as np
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# 确保模块路径
sys.path.insert(0, str(Path(__file__).parent))

# 加载环境变量：优先本地 .env，回退到项目根目录 .env
load_dotenv()
load_dotenv(Path(__file__).parent.parent / ".env")

class NumpyEncoder(json.JSONEncoder):
    """处理 numpy 类型的 JSON 编码器"""
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


def json_dumps(obj) -> str:
    """带 numpy 支持的 JSON 序列化"""
    return json.dumps(obj, ensure_ascii=False, cls=NumpyEncoder)


app = FastAPI(title="Hotel Review RAG API", version="1.0.0")

# CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# RAG 系统单例
rag_system = None


class ChatRequest(BaseModel):
    query: str
    options: dict = {}


@app.on_event("startup")
async def startup():
    """启动时初始化 RAG 系统"""
    global rag_system

    api_key = os.getenv("DASHSCOPE_API_KEY")
    dashvector_api_key = os.getenv("DASHVECTOR_API_KEY")
    dashvector_endpoint = os.getenv("DASHVECTOR_HOTEL_ENDPOINT")

    if not all([api_key, dashvector_api_key, dashvector_endpoint]):
        print("WARNING: 缺少 API Key 环境变量，RAG 系统未初始化")
        return

    try:
        from modules.rag_system import HotelReviewRAG
        data_dir = Path(__file__).parent / "data"

        print("正在初始化 RAG 系统...")
        rag_system = HotelReviewRAG(
            api_key=api_key,
            dashvector_api_key=dashvector_api_key,
            dashvector_endpoint=dashvector_endpoint,
            data_dir=data_dir
        )
        print("RAG 系统初始化完成")
    except Exception as e:
        print(f"RAG 系统初始化失败: {e}")


@app.get("/api/v1/health")
async def health():
    """健康检查"""
    return {
        "status": "ok",
        "version": "1.0.0",
        "rag_ready": rag_system is not None
    }


@app.post("/api/v1/chat")
async def chat(request: ChatRequest):
    """RAG 问答接口"""
    if not request.query or not request.query.strip():
        raise HTTPException(status_code=400, detail="query 不能为空")

    if rag_system is None:
        raise HTTPException(status_code=503, detail="RAG 系统未就绪")

    enable_generation = request.options.get("enable_generation", True)

    # 非流式：只返回检索结果
    if not enable_generation:
        try:
            result = rag_system.query(
                request.query.strip(),
                enable_hyde=False,
                enable_generation=False,
                print_response=False,
                **{k: v for k, v in request.options.items() if k != "enable_generation"}
            )

            # 转换评论格式
            comments = _format_comments(result['references']['comments'])
            summaries = [
                {"category": s['metadata'].get('category', ''), "content": s['summary']}
                for s in result['references']['summaries']
            ]

            return JSONResponse(content=_sanitize({
                "references": {
                    "comments": comments,
                    "summaries": summaries
                },
                "timing": result['timing']
            }))
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # 流式：SSE 响应
    # 使用 asyncio.Queue + 线程池，避免同步生成器阻塞事件循环导致 SSE 缓冲
    queue: asyncio.Queue = asyncio.Queue()
    _SENTINEL = object()

    query_text = request.query.strip()
    query_options = {k: v for k, v in request.options.items() if k != "enable_generation"}

    def _run_query_stream():
        """在线程池中运行同步 RAG 流水线，通过 queue 推送事件"""
        try:
            for event in rag_system.query_stream(
                query_text, enable_hyde=False, **query_options
            ):
                event_type = event.get("type")

                if event_type == "intent":
                    queue.put_nowait(f"data: {json_dumps(event)}\n\n")
                elif event_type == "references":
                    data = event["data"]
                    data["comments"] = _format_comments(data["comments"])
                    queue.put_nowait(f"data: {json_dumps(_sanitize(event))}\n\n")
                elif event_type == "chunk":
                    queue.put_nowait(f"data: {json_dumps(event)}\n\n")
                elif event_type == "done":
                    queue.put_nowait(f"data: {json_dumps(_sanitize(event))}\n\n")

        except Exception as e:
            error_event = {"type": "error", "message": str(e)}
            queue.put_nowait(f"data: {json_dumps(error_event)}\n\n")
        finally:
            queue.put_nowait(_SENTINEL)

    async def generate_sse():
        """异步生成器：从 queue 取出 SSE 事件并 yield"""
        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, _run_query_stream)

        while True:
            item = await queue.get()
            if item is _SENTINEL:
                break
            yield item

    return StreamingResponse(
        generate_sse(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


def _sanitize(obj):
    """递归将 numpy 类型转换为 Python 原生类型"""
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        v = float(obj)
        return None if np.isnan(v) else v
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, float) and np.isnan(obj):
        return None
    return obj


def _format_comments(raw_comments: list) -> list:
    """将 RAG 返回的评论格式转换为前端 Comment 类型"""
    formatted = []
    for i, c in enumerate(raw_comments):
        meta = c.get('metadata', {})
        comment_id = c.get('comment_id', '')

        # 从 rag_system 的 df_comments 获取完整数据
        full_data = {}
        if rag_system and comment_id:
            try:
                row = rag_system.df_comments.loc[comment_id]
                full_data = row.to_dict() if hasattr(row, 'to_dict') else {}
            except (KeyError, Exception):
                pass

        formatted.append(_sanitize({
            "_id": str(comment_id),
            "comment": str(c.get('comment', '')),
            "score": meta.get('score', 0),
            "star": full_data.get('star', int(meta.get('score', 0))),
            "useful_count": meta.get('useful_count', 0),
            "publish_date": str(meta.get('publish_date', '')),
            "room_type": str(meta.get('room_type', '')),
            "fuzzy_room_type": str(meta.get('fuzzy_room_type', '')),
            "travel_type": str(full_data.get('travel_type', '')),
            "review_count": meta.get('review_count', 0),
            "quality_score": meta.get('quality_score', 0),
            "category1": full_data.get('category1', None),
            "category2": full_data.get('category2', None),
            "category3": full_data.get('category3', None),
            "images": full_data.get('images', []),
            "relevance_score": c.get('final_score', c.get('rrf_score', 0)),
            "rank": c.get('final_rank', c.get('rrf_rank', i + 1))
        }))
    return formatted


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
