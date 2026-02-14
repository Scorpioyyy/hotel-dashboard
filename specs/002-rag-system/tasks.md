# Tasks: RAG 系统集成

**Input**: Design documents from `/specs/002-rag-system/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/api.md

**Tests**: Not explicitly requested - no test tasks generated.

**Organization**: Tasks are grouped by user story. US2 (code splitting) is foundational and must complete before other stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create project directory structure and move data files

- [x] T001 Create `rag-service/` directory structure: `rag-service/modules/`, `rag-service/utils/`, `rag-service/data/` per plan.md Project Structure
- [x] T002 Move `public/inverted_index.pkl` to `rag-service/data/inverted_index.pkl`
- [x] T003 Create `rag-service/requirements.txt` with all Python dependencies: fastapi, uvicorn[standard], pydantic, python-dotenv, requests, pandas, numpy, nltk, jieba, dashscope, dashvector, chromadb, tqdm
- [x] T004 Create `rag-service/.env` file with placeholder environment variables (DASHSCOPE_API_KEY, DASHVECTOR_API_KEY, DASHVECTOR_HOTEL_ENDPOINT, NEXT_PUBLIC_INSFORGE_BASE_URL, NEXT_PUBLIC_INSFORGE_ANON_KEY) and add `rag-service/.env` to `.gitignore`
- [x] T005 Create `rag-service/modules/__init__.py` and `rag-service/utils/__init__.py` as empty init files

---

## Phase 2: User Story 2 - Python RAG 代码模块化重构 (Priority: P1) 🎯 Foundational

**Goal**: Split `rag/lib.py` (1769 lines, 12 classes) into 8 core modules + 2 utility modules, each under 300 lines

**Independent Test**: Run the original test query (`example.py` logic) against the refactored modules and verify identical behavior

**⚠️ CRITICAL**: No other user story work can begin until this phase is complete

### Implementation for User Story 2

- [x] T006 [US2] Create `rag-service/config.py` — extract module-level constants from `rag/lib.py` lines 1-30: imports for datetime, TODAY constant, EXACT_ROOM_TYPES list, FUZZY_ROOM_TYPES list. Add all shared imports needed by other modules.
- [x] T007 [P] [US2] Create `rag-service/modules/clients.py` — extract LLMClient class (lines 33-54) and EmbeddingClient class (lines 58-77) from `rag/lib.py`. Import dashscope Generation and TextEmbedding. Target: ~50 lines.
- [x] T008 [P] [US2] Create `rag-service/modules/index.py` — extract InvertedIndex class (lines 81-225) from `rag/lib.py`. Import jieba, pickle, numpy, nltk, math. Include tokenize, build, search, save, load methods. Target: ~150 lines.
- [x] T009 [P] [US2] Create `rag-service/modules/intent.py` — extract IntentRecognizer (lines 228-275), IntentDetector (lines 278-356), IntentExpander (lines 359-428), HyDEGenerator (lines 431-494) from `rag/lib.py`. Import from config (EXACT_ROOM_TYPES, FUZZY_ROOM_TYPES) and modules.clients (LLMClient). Target: ~270 lines.
- [x] T010 [P] [US2] Create `rag-service/modules/retriever.py` — extract HybridRetriever class (lines 497-901) from `rag/lib.py`. Import from modules.index, modules.clients, modules.intent. Includes all 5 retrieval routes (_route_bm25, _route_vector, _route_reverse, _route_hyde, _route_summary) and _rrf_fusion. Target: ~300 lines (refactor verbose logging/comments to reduce from ~410).
- [x] T011 [P] [US2] Create `rag-service/modules/ranker.py` — extract Reranker class (lines 904-938) and MultiFactorRanker class (lines 941-1090) from `rag/lib.py`. Import dashscope TextReRank. Target: ~190 lines.
- [x] T012 [P] [US2] Create `rag-service/modules/generator.py` — extract ResponseGenerator class (lines 1093-1246) from `rag/lib.py`. Import dashscope Generation. Keep existing `generate()` method. Target: ~160 lines.
- [x] T013 [P] [US2] Create `rag-service/utils/formatting.py` — extract print_retrieval_results function (lines 1568-1644) and print_rag_result function (lines 1647-1769) from `rag/lib.py`. Target: ~200 lines.
- [x] T014 [US2] Create `rag-service/modules/rag_system.py` — extract HotelReviewRAG class (lines 1249-1565) from `rag/lib.py`. Update all imports to reference the new module paths (from modules.clients import LLMClient, etc.). Update `__init__` to instantiate all sub-modules. Keep `query()` and `_timed_call()` methods. Target: ~300 lines (refactor verbose logging to reduce from ~320).
- [x] T015 [US2] Update all cross-module imports in `rag-service/modules/` and `rag-service/utils/` to ensure correct dependency chain: config → clients → (index, intent) → retriever → ranker → generator → rag_system. Verify no circular imports.
- [x] T016 [US2] Create `rag-service/test_rag.py` — adapt `rag/example.py` to use the new modular imports (`from modules.rag_system import HotelReviewRAG`, `from utils.formatting import print_rag_result`). Update data_dir to `Path("./data")`. This file serves as the verification script.

**Checkpoint**: At this point, running `cd rag-service && python test_rag.py` should produce the same output as the original `rag/example.py`. All 12 classes are now in separate modules with clean imports.

---

## Phase 3: User Story 3 - 评论数据从数据库读取 (Priority: P1)

**Goal**: Replace CSV file reading with Insforge database REST API calls for comment data loading

**Independent Test**: Start RAG system and verify it loads exactly 2171 comments from Insforge database (matching the database record count)

### Implementation for User Story 3

- [x] T017 [US3] Create `rag-service/utils/database.py` — implement `get_all_comments_from_insforge()` function that fetches all comments via Insforge REST API (`{base_url}/rest/v1/comments?select=*&offset={offset}&limit={batch_size}`) with pagination (batch_size=1000). Return pandas DataFrame with `_id` as index. Use environment variables NEXT_PUBLIC_INSFORGE_BASE_URL and NEXT_PUBLIC_INSFORGE_ANON_KEY. Handle `publish_date` string-to-datetime conversion per research.md R6.
- [x] T018 [US3] Modify `rag-service/modules/rag_system.py` — in `HotelReviewRAG.__init__()`, replace `pd.read_csv(processed_dir / "enriched_comments.csv", index_col=0)` with call to `get_all_comments_from_insforge()` from `utils.database`. Add error handling for database connection failure with clear error message.
- [x] T019 [US3] Verify data loading by running `rag-service/test_rag.py` and confirming it successfully loads 2171 comments from Insforge database and produces correct query results.

**Checkpoint**: RAG system now reads comment data from Insforge database instead of CSV. The `public/enriched_comments.csv` file is no longer needed by the RAG service.

---

## Phase 4: User Story 4 - FastAPI 服务提供 RAG 问答 API (Priority: P1)

**Goal**: Wrap the RAG system in a FastAPI HTTP service with SSE streaming chat endpoint and health check endpoint

**Independent Test**: Start FastAPI service with `uvicorn main:app --port 8000`, then test with cURL: `curl -N -X POST http://localhost:8000/api/v1/chat -H "Content-Type: application/json" -d '{"query":"套房空间大吗？"}'`

### Implementation for User Story 4

- [x] T020 [US4] Add `generate_stream()` method to `rag-service/modules/generator.py` — implement streaming version of `generate()` that uses `Generation.call(stream=True)` and yields each text chunk. Keep original `generate()` method unchanged for non-streaming use.
- [x] T021 [US4] Add `query_stream()` method to `rag-service/modules/rag_system.py` — implement streaming version of `query()` that calls all pipeline stages (intent → retrieval → ranking) synchronously, then yields references data followed by streaming generation chunks from `generator.generate_stream()`. Also yield timing data at the end. Set default `enable_hyde=False` per FR-006.
- [x] T022 [US4] Create `rag-service/main.py` — implement FastAPI application with: (1) CORS middleware allowing all origins per FR-009; (2) RAG system initialization on startup (singleton); (3) Pydantic models for ChatRequest (query: str, options: dict = {}); (4) `POST /api/v1/chat` endpoint returning StreamingResponse with SSE format per contracts/api.md (event types: references, chunk, done, error); (5) `POST /api/v1/chat` with `enable_generation=false` returning JSON response; (6) `GET /api/v1/health` returning status/version/rag_ready per contracts/api.md; (7) Input validation: reject empty query with 400 error. Set default RAG options: enable_hyde=False, other defaults per spec.
- [x] T023 [US4] Verify FastAPI service by starting `uvicorn main:app --reload --port 8000` in Anaconda base environment and testing both endpoints with cURL: health check (`GET /api/v1/health`) and streaming chat (`POST /api/v1/chat`). Verify SSE event sequence: references → chunk(s) → done.

**Checkpoint**: FastAPI service is fully functional. RAG queries work via HTTP API with SSE streaming. Health check confirms system readiness.

---

## Phase 5: User Story 5 - 前端无缝对接 Python RAG 服务 (Priority: P1)

**Goal**: Modify `src/lib/qa.ts` to call Python FastAPI instead of Insforge AI SDK, keeping function signatures identical

**Independent Test**: Start both FastAPI (port 8000) and Next.js (port 3000), open http://localhost:3000/qa, submit a question, verify streaming output and reference comments display correctly

### Implementation for User Story 5

- [x] T024 [US5] Add `NEXT_PUBLIC_PYTHON_API_URL=http://localhost:8000` to project root `.env.local` file
- [x] T025 [US5] Rewrite `src/lib/qa.ts` — replace entire implementation while preserving all exported function signatures. New implementation: (1) `getReferencesForQuestion(question)`: POST to `${PYTHON_API_URL}/api/v1/chat` with `{query, options: {enable_generation: false}}`, parse JSON response, convert `references.comments` to `Comment[]` type (map fields per contracts/api.md Comment type mapping, default `images: []`, derive `categories` from category1/2/3); (2) `askQuestionStream(question, references, signal)`: POST to `${PYTHON_API_URL}/api/v1/chat` with `{query}` and AbortSignal, parse SSE stream using ReadableStream reader, yield `chunk.content` strings for events with `type === 'chunk'`; (3) Keep `QAResponse` interface export; (4) Remove imports of `ai` from insforge and `getHighQualityComments` from api; (5) Remove `extractCategories()` and `buildSystemPrompt()` helper functions (no longer needed); (6) Keep or update `askQuestion()` non-streaming function to also call the Python API.

**Checkpoint**: Full end-to-end flow works: user asks question in browser → Next.js calls Python API → RAG pipeline executes → streaming response displayed. No UI files modified.

---

## Phase 6: User Story 1 - 智能问答获得高质量回答 (Priority: P1) — End-to-End Verification

**Goal**: Verify the complete integrated system delivers high-quality RAG-powered answers with reference comments

**Independent Test**: Open http://localhost:3000/qa and test multiple queries, verify streaming output, reference comments, abort functionality, and conversation history

### Verification for User Story 1

- [ ] T026 [US1] End-to-end verification: Start FastAPI service (port 8000) and Next.js dev server (port 3000). Test the following scenarios on http://localhost:3000/qa: (1) Submit "套房空间大吗？" and verify streaming response with relevant content about suite room space; (2) Verify 10 reference comments are displayed below the answer; (3) Submit another question and verify conversation history is preserved; (4) During a streaming response, click the stop/abort button and verify generation stops immediately with existing content preserved; (5) Verify evaluation browsing page (/) and dashboard (/dashboard) still work correctly with no regressions.
- [x] T027 [US1] Verify no UI files were modified: confirm `src/app/qa/page.tsx`, `src/lib/qa-background.ts`, and all files in `src/components/qa/` are unchanged (git diff should show no changes to these files).

**Checkpoint**: Complete RAG system integration is working. All acceptance scenarios from spec.md User Story 1 are verified.

---

## Phase 7: User Story 6 - 部署就绪 (Priority: P2)

**Goal**: Prepare deployment configuration files for Railway (Python) and Vercel (Next.js)

**Independent Test**: Verify deployment files exist and are correctly configured

### Implementation for User Story 6

- [x] T028 [P] [US6] Create `rag-service/Procfile` with content: `web: uvicorn main:app --host 0.0.0.0 --port $PORT`
- [x] T029 [P] [US6] Create `rag-service/runtime.txt` with content: `python-3.11`
- [x] T030 [US6] Verify all environment variables are documented in `specs/002-rag-system/quickstart.md` and `rag-service/.env` has correct placeholder keys for both development and production deployment

**Checkpoint**: Project is ready for deployment to Railway (Python service) and Vercel (Next.js frontend).

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup and final verification

- [x] T031 Update `.gitignore` to include: `rag-service/.env`, `rag-service/data/chroma_db/`, `rag-service/__pycache__/`, `rag-service/modules/__pycache__/`, `rag-service/utils/__pycache__/`
- [x] T032 Verify code quality: each Python module file in `rag-service/modules/` is under 300 lines (check with `wc -l`); no circular imports exist; dependency direction follows config → clients → (index, intent) → retriever → ranker → generator → rag_system → main
- [ ] T033 Clean up obsolete files: the original `rag/lib.py` and `rag/example.py` can be removed once `rag-service/` is verified working. Move `rag/项目框架.md` to `rag-service/` for reference. Remove `public/enriched_comments.csv` (data now comes from Insforge database).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **US2 Code Splitting (Phase 2)**: Depends on Setup — **BLOCKS all other user stories**
- **US3 Database (Phase 3)**: Depends on US2 completion
- **US4 FastAPI (Phase 4)**: Depends on US2 + US3 completion
- **US5 Frontend (Phase 5)**: Depends on US4 completion
- **US1 Verification (Phase 6)**: Depends on US4 + US5 completion
- **US6 Deployment (Phase 7)**: Depends on US4 completion (can run parallel with US5)
- **Polish (Phase 8)**: Depends on all stories being complete

### User Story Dependencies

```
Phase 1: Setup
    ↓
Phase 2: US2 (Code Splitting) ← FOUNDATIONAL BLOCKER
    ↓
Phase 3: US3 (Database Migration)
    ↓
Phase 4: US4 (FastAPI Service)
    ↓ ────────────────────────┐
Phase 5: US5 (Frontend)     Phase 7: US6 (Deployment) [parallel]
    ↓                            ↓
Phase 6: US1 (E2E Verify)
    ↓
Phase 8: Polish
```

### Within Each User Story

- Module extraction tasks (T007-T013) can run in parallel (different files)
- Cross-module import update (T015) must wait for all extractions
- Each phase checkpoint must be verified before proceeding

### Parallel Opportunities

**Phase 2 parallel group** (all extract from different sections of lib.py):
```
T007 (clients.py) | T008 (index.py) | T009 (intent.py) | T010 (retriever.py) | T011 (ranker.py) | T012 (generator.py) | T013 (formatting.py)
```

**Phase 7 parallel group** (independent deployment files):
```
T028 (Procfile) | T029 (runtime.txt)
```

---

## Implementation Strategy

### MVP First (US2 → US3 → US4 → US5 → US1)

1. Complete Phase 1: Setup (project structure)
2. Complete Phase 2: US2 Code Splitting (**critical path**)
3. **VALIDATE**: Run `test_rag.py` to confirm modular code works
4. Complete Phase 3: US3 Database Migration
5. **VALIDATE**: Run `test_rag.py` to confirm Insforge data loading works
6. Complete Phase 4: US4 FastAPI Service
7. **VALIDATE**: cURL test to confirm API works
8. Complete Phase 5: US5 Frontend Integration
9. **VALIDATE**: Browser test for full end-to-end flow
10. Complete Phase 6: US1 End-to-End Verification
11. Optional: Phase 7 (Deployment) + Phase 8 (Polish)

### Key Risk Mitigation

- **After T016**: Verify RAG output matches original before proceeding
- **After T019**: Verify database data matches CSV data before proceeding
- **After T023**: Verify SSE streaming works before frontend integration
- **After T025**: Verify all UI files are untouched

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US2 is foundational — all other stories depend on it
- US1 is a verification story — it has no implementation, only testing
- US6 (P2) is optional and can be deferred
- Environment: Anaconda base (no venv), Windows 11
- HyDE is disabled (`enable_hyde=False`) in all RAG configurations
