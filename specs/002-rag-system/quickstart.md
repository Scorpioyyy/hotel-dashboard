# Quickstart: RAG 系统集成

**Feature**: 002-rag-system
**Date**: 2026-02-12

## 前置条件

- **Anaconda** 已安装，使用 base 环境
- **Node.js** 18+ 已安装
- **环境变量** 已配置（见下方）

## 环境变量配置

### Python 服务（`rag-service/.env`）

```bash
DASHSCOPE_API_KEY=sk-xxxxx
DASHVECTOR_API_KEY=xxxxx
DASHVECTOR_HOTEL_ENDPOINT=xxxxx
NEXT_PUBLIC_INSFORGE_BASE_URL=https://your-project.insforge.dev
NEXT_PUBLIC_INSFORGE_ANON_KEY=your_anon_key
```

### Next.js 前端（项目根目录 `.env.local`）

```bash
NEXT_PUBLIC_PYTHON_API_URL=http://localhost:8000
NEXT_PUBLIC_INSFORGE_BASE_URL=https://your-project.insforge.dev
NEXT_PUBLIC_INSFORGE_ANON_KEY=your_anon_key
```

## 启动步骤

### 1. 启动 Python RAG 服务

```bash
# 确认使用 Anaconda base 环境
conda activate base

# 进入 RAG 服务目录
cd rag-service

# 安装依赖（首次运行）
pip install -r requirements.txt

# 启动服务（端口 8000）
uvicorn main:app --reload --port 8000
```

验证：访问 http://localhost:8000/api/v1/health 应返回 `{"status": "ok"}`

### 2. 启动 Next.js 前端

```bash
# 回到项目根目录
cd ..

# 安装依赖（如需）
npm install

# 启动开发服务器（端口 3000）
npm run dev
```

验证：访问 http://localhost:3000/qa 进行问答测试

## 测试验证

### 快速测试（cURL）

```bash
# 健康检查
curl http://localhost:8000/api/v1/health

# 问答测试（流式）
curl -N -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "套房空间大吗？"}'

# 仅检索（不生成）
curl -X POST http://localhost:8000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "套房空间大吗？", "options": {"enable_generation": false}}'
```

### 联调测试

1. 确保 Python 服务运行在 8000 端口
2. 确保 `.env.local` 中 `NEXT_PUBLIC_PYTHON_API_URL=http://localhost:8000`
3. 在浏览器打开 http://localhost:3000/qa
4. 输入问题，验证：
   - 流式输出正常显示
   - 参考评论展示正常
   - 终止生成功能正常
   - 评论浏览和数据看板不受影响

## 项目目录结构

```
hotel-review-rag/
├── rag-service/              # Python FastAPI 服务
│   ├── main.py               # FastAPI 入口
│   ├── config.py             # 配置常量
│   ├── requirements.txt      # Python 依赖
│   ├── .env                  # 环境变量（不提交）
│   ├── modules/
│   │   ├── __init__.py
│   │   ├── clients.py        # LLMClient, EmbeddingClient
│   │   ├── index.py          # InvertedIndex
│   │   ├── intent.py         # IntentRecognizer, IntentDetector, IntentExpander, HyDEGenerator
│   │   ├── retriever.py      # HybridRetriever
│   │   ├── ranker.py         # Reranker, MultiFactorRanker
│   │   ├── generator.py      # ResponseGenerator
│   │   └── rag_system.py     # HotelReviewRAG
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── formatting.py     # print_retrieval_results, print_rag_result
│   │   └── database.py       # get_all_comments_from_insforge
│   └── data/
│       ├── inverted_index.pkl
│       └── chroma_db/
├── src/                      # Next.js 前端（仅修改 lib/qa.ts）
│   ├── lib/
│   │   ├── qa.ts             # 修改：调用 Python API
│   │   ├── qa-background.ts  # 不修改
│   │   └── api.ts            # 不修改
│   ├── app/
│   │   └── qa/page.tsx       # 不修改
│   └── components/qa/        # 不修改
└── .env.local                # Next.js 环境变量
```
