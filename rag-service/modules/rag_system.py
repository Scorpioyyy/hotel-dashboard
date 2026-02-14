"""酒店评论 RAG 系统：完整的检索增强生成工作流"""

import time
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

import pandas as pd
import dashvector
import chromadb

from config import TODAY, EXACT_ROOM_TYPES, FUZZY_ROOM_TYPES
from modules.clients import LLMClient, EmbeddingClient, IntlLLMClient, IntlEmbeddingClient
from modules.index import InvertedIndex
from modules.intent import IntentRecognizer, IntentDetector, IntentExpander, HyDEGenerator
from modules.retriever import HybridRetriever
from modules.ranker import Reranker, MultiFactorRanker
from modules.generator import ResponseGenerator, IntlResponseGenerator
from utils.database import get_all_comments_from_insforge


class HotelReviewRAG:
    """酒店评论 RAG 系统：完整的检索增强生成工作流"""

    def __init__(self, api_key: str, dashvector_api_key: str, dashvector_endpoint: str,
                 data_dir: Path, df_comments: pd.DataFrame = None,
                 intl_api_key: str = None,
                 detection_model: str = "qwen-plus",
                 expansion_hyde_model: str = "qwen-flash",
                 generation_model: str = "deepseek-v3.2"):
        """
        初始化 RAG 系统

        参数:
            api_key: DashScope API Key（北京端点）
            dashvector_api_key: DashVector API Key
            dashvector_endpoint: DashVector 集合端点
            data_dir: 数据目录（包含 inverted_index.pkl 和 chroma_db/）
            df_comments: 评论 DataFrame（若为 None 则从 Insforge 数据库加载）
            intl_api_key: DashScope 国际版 API Key（新加坡端点，为空则使用全北京模式）
            detection_model: 意图检测模型
            expansion_hyde_model: 意图扩展/HyDE 模型
            generation_model: 回复生成模型
        """
        # 连接向量数据库
        dashvector_client = dashvector.Client(
            api_key=dashvector_api_key, endpoint=dashvector_endpoint
        )
        self.comments_collection = dashvector_client.get("comment_database")
        self.reverse_queries_collection = dashvector_client.get("reverse_query_database")

        chroma_db_path = data_dir / "chroma_db"
        chroma_client = chromadb.PersistentClient(path=str(chroma_db_path))
        self.summaries_collection = chroma_client.get_collection("summary_database")

        # 加载倒排索引
        self.inverted_index = InvertedIndex()
        self.inverted_index.load(str(data_dir / "inverted_index.pkl"))

        # 加载评论数据
        if df_comments is not None:
            self.df_comments = df_comments
        else:
            self.df_comments = get_all_comments_from_insforge()

        # 意图识别和重排始终使用北京端点（新加坡不可用）
        self.intent_recognizer = IntentRecognizer(api_key=api_key)
        self.reranker = Reranker(api_key=api_key)

        if intl_api_key:
            # 国际混合模式：意图检测/扩展/Embedding/生成 使用新加坡端点
            detection_client = IntlLLMClient(intl_api_key, model=detection_model, json=True)
            expansion_hyde_client = IntlLLMClient(intl_api_key, model=expansion_hyde_model, json=True)
            embedding_client = IntlEmbeddingClient(intl_api_key)
            self.generator = IntlResponseGenerator(intl_api_key, model="qwen-plus-latest")
        else:
            # 全北京模式
            detection_client = LLMClient(api_key=api_key, model=detection_model, json=True)
            expansion_hyde_client = LLMClient(api_key=api_key, model=expansion_hyde_model, json=True)
            embedding_client = EmbeddingClient(api_key=api_key)
            self.generator = ResponseGenerator(api_key=api_key, model=generation_model)

        self.intent_detector = IntentDetector(
            detection_client, EXACT_ROOM_TYPES, FUZZY_ROOM_TYPES
        )
        self.intent_expander = IntentExpander(expansion_hyde_client)
        self.hyde_generator = HyDEGenerator(expansion_hyde_client)
        self.retriever = HybridRetriever(
            self.inverted_index, self.comments_collection,
            self.reverse_queries_collection, self.summaries_collection,
            embedding_client, self.df_comments, self.hyde_generator
        )

    def query(self, user_query: str,
              route_topk: int = 150,
              retrieval_topk: int = 100,
              ranking_topk: int = 10,
              enable_expansion: bool = True,
              enable_bm25: bool = True,
              enable_vector: bool = True,
              enable_reverse: bool = True,
              enable_hyde: bool = True,
              enable_summary: bool = True,
              enable_ranking: bool = True,
              enable_generation: bool = True,
              print_response: bool = True,
              w_relevance: float = 0.40,
              w_quality: float = 0.25,
              w_length: float = 0.05,
              w_review: float = 0.05,
              w_useful: float = 0.05,
              w_recency: float = 0.20,
              base_decay: float = 0.5,
              implied_boost: float = 0.5,
              clear_boost: float = 0.5,
              half_life_days: int = 180,
              today: datetime | None = TODAY,
              history: dict | None = None) -> dict:
        """
        处理用户查询并生成回复

        返回:
            {
                'response': 模型回复文本,
                'references': { 'comments', 'summaries', 'hyde_responses' },
                'query_processing': { 'intent_recognition', 'intent_detection', 'intent_expansion' },
                'timing': { ... }
            }
        """
        total_start = time.time()
        timing = {}
        if not today:
            today = datetime.today()

        # 一、查询处理
        query_processing_start = time.time()

        # 1. 意图识别（传入历史对话用于上下文理解）
        intent_recognition_start = time.time()
        need_retrieval = self.intent_recognizer.recognize(user_query, history=history)
        timing['intent_recognition'] = time.time() - intent_recognition_start

        # 2. 意图检测与意图扩展
        intent_detection_result = None
        intent_expansion_result = None
        timing['intent_detection'] = 0
        timing['intent_expansion'] = 0

        if need_retrieval:
            if enable_expansion:
                with ThreadPoolExecutor(max_workers=2) as executor:
                    future_detect = executor.submit(
                        self._timed_call, self.intent_detector.detect, user_query
                    )
                    future_expand = executor.submit(
                        self._timed_call, self.intent_expander.expand, user_query
                    )
                    intent_detection_result, timing['intent_detection'] = future_detect.result()
                    intent_expansion_result, timing['intent_expansion'] = future_expand.result()
            else:
                intent_detection_result, timing['intent_detection'] = self._timed_call(
                    self.intent_detector.detect, user_query
                )
                intent_expansion_result, timing['intent_expansion'] = None, 0

        timing['query_processing_total'] = time.time() - query_processing_start

        # 直接回答
        if not need_retrieval:
            if enable_generation:
                first_token_base = time.time() - total_start
                response, ttft_model, subsequent, generation = self.generator.generate(
                    user_query, need_retrieval=False, print_response=print_response,
                    today=today, history=history
                )
                timing['ttft'] = first_token_base + ttft_model
                timing['ttft_model'] = ttft_model
                timing['subsequent'] = subsequent
                timing['generation'] = generation
            else:
                response = ""
                timing['ttft'] = 0
                timing['ttft_model'] = 0
                timing['subsequent'] = 0
                timing['generation'] = 0

            timing['total'] = time.time() - total_start
            return {
                'response': response,
                'references': {'comments': [], 'summaries': [], 'hyde_responses': {}},
                'query_processing': {
                    'intent_recognition': need_retrieval,
                    'intent_detection': None,
                    'intent_expansion': None
                },
                'timing': timing
            }

        # 二、混合检索
        if enable_ranking:
            final_topk_for_retrieval = retrieval_topk
        else:
            final_topk_for_retrieval = ranking_topk

        rewritten_queries = (intent_expansion_result
                             if intent_expansion_result
                             else [{'query': user_query, 'weight': 1.0}])

        comments, summaries, retrieval_timing, hyde_results = self.retriever.retrieve(
            rewritten_queries,
            room_type=intent_detection_result.get('room_type'),
            fuzzy_room_type=intent_detection_result.get('fuzzy_room_type'),
            topk=route_topk,
            final_topk=final_topk_for_retrieval,
            enable_bm25=enable_bm25,
            enable_vector=enable_vector,
            enable_reverse=enable_reverse,
            enable_hyde=enable_hyde,
            enable_summary=enable_summary
        )
        timing['retrieval'] = retrieval_timing

        # 三、重排
        if enable_ranking:
            ranker = MultiFactorRanker(
                self.reranker,
                w_relevance=w_relevance, w_quality=w_quality,
                w_length=w_length, w_review=w_review,
                w_useful=w_useful, w_recency=w_recency,
                base_decay=base_decay, implied_boost=implied_boost,
                clear_boost=clear_boost, half_life_days=half_life_days
            )
            ranked_comments, ranking_timing = ranker.rank(
                user_query, comments,
                time_sensitivity=intent_detection_result.get('time_sensitivity'),
                topk=ranking_topk, today=today
            )
            timing['ranking'] = ranking_timing
        else:
            ranked_comments = comments
            timing['ranking'] = {'total': 0, 'rerank': 0, 'scoring': 0}

        # 四、回复生成
        if enable_generation:
            first_token_base = time.time() - total_start
            response, ttft_model, subsequent, generation = self.generator.generate(
                user_query,
                rewritten_queries=intent_expansion_result,
                ranked_comments=ranked_comments,
                summaries=summaries,
                need_retrieval=True,
                print_response=print_response,
                today=today,
                history=history
            )
            timing['ttft'] = first_token_base + ttft_model
            timing['ttft_model'] = ttft_model
            timing['subsequent'] = subsequent
            timing['generation'] = generation
        else:
            response = ""
            timing['ttft'] = 0
            timing['ttft_model'] = 0
            timing['subsequent'] = 0
            timing['generation'] = 0

        timing['total'] = time.time() - total_start

        # 五、构建返回结果
        processed_comments = []
        for c in ranked_comments:
            comment_data = {
                'comment_id': c['comment_id'],
                'comment': c['comment'],
                'rrf_score': c['rrf_score'],
                'rrf_rank': c['rrf_rank'],
                'route_ranks': c['route_ranks'],
                'metadata': c['metadata']
            }
            if enable_ranking:
                comment_data['rerank_score'] = c['rerank_score']
                comment_data['rerank_rank'] = c['rerank_rank']
                comment_data['final_score'] = c['final_score']
                comment_data['final_rank'] = c['final_rank']
                comment_data['feature_scores'] = c['feature_scores']
            processed_comments.append(comment_data)

        return {
            'response': response,
            'references': {
                'comments': processed_comments,
                'summaries': summaries,
                'hyde_responses': hyde_results
            },
            'query_processing': {
                'intent_recognition': need_retrieval,
                'intent_detection': intent_detection_result,
                'intent_expansion': intent_expansion_result
            },
            'timing': timing
        }

    def query_stream(self, user_query: str,
                     route_topk: int = 150,
                     retrieval_topk: int = 100,
                     ranking_topk: int = 10,
                     enable_expansion: bool = True,
                     enable_bm25: bool = True,
                     enable_vector: bool = True,
                     enable_reverse: bool = True,
                     enable_hyde: bool = False,
                     enable_summary: bool = True,
                     enable_ranking: bool = True,
                     w_relevance: float = 0.40,
                     w_quality: float = 0.25,
                     w_length: float = 0.05,
                     w_review: float = 0.05,
                     w_useful: float = 0.05,
                     w_recency: float = 0.20,
                     base_decay: float = 0.5,
                     implied_boost: float = 0.5,
                     clear_boost: float = 0.5,
                     half_life_days: int = 180,
                     today: datetime | None = TODAY,
                     history: dict | None = None):
        """
        流式处理用户查询（用于 FastAPI SSE 接口）

        Yields:
            dict: SSE 事件，格式为 {"type": ..., "data": ...} 或 {"type": "chunk", "content": ...}
        """
        total_start = time.time()
        timing = {}
        if not today:
            today = datetime.today()

        # 一、查询处理
        query_processing_start = time.time()

        intent_recognition_start = time.time()
        need_retrieval = self.intent_recognizer.recognize(user_query, history=history)
        timing['intent_recognition'] = time.time() - intent_recognition_start

        # 发送意图识别结果（前端据此控制"检索中"显示）
        yield {"type": "intent", "data": {"need_retrieval": need_retrieval}}

        intent_detection_result = None
        intent_expansion_result = None
        timing['intent_detection'] = 0
        timing['intent_expansion'] = 0

        if need_retrieval:
            if enable_expansion:
                with ThreadPoolExecutor(max_workers=2) as executor:
                    future_detect = executor.submit(
                        self._timed_call, self.intent_detector.detect, user_query
                    )
                    future_expand = executor.submit(
                        self._timed_call, self.intent_expander.expand, user_query
                    )
                    intent_detection_result, timing['intent_detection'] = future_detect.result()
                    intent_expansion_result, timing['intent_expansion'] = future_expand.result()
            else:
                intent_detection_result, timing['intent_detection'] = self._timed_call(
                    self.intent_detector.detect, user_query
                )

        timing['query_processing_total'] = time.time() - query_processing_start

        # 直接回答（不需要检索）
        if not need_retrieval:
            for chunk in self.generator.generate_stream(
                user_query, need_retrieval=False, today=today, history=history
            ):
                yield {"type": "chunk", "content": chunk}

            timing['total'] = time.time() - total_start
            yield {
                "type": "done",
                "data": {
                    "references": {"comments": [], "summaries": []},
                    "timing": timing
                }
            }
            return

        # 二、混合检索
        if enable_ranking:
            final_topk_for_retrieval = retrieval_topk
        else:
            final_topk_for_retrieval = ranking_topk

        rewritten_queries = (intent_expansion_result
                             if intent_expansion_result
                             else [{'query': user_query, 'weight': 1.0}])

        comments, summaries, retrieval_timing, hyde_results = self.retriever.retrieve(
            rewritten_queries,
            room_type=intent_detection_result.get('room_type'),
            fuzzy_room_type=intent_detection_result.get('fuzzy_room_type'),
            topk=route_topk,
            final_topk=final_topk_for_retrieval,
            enable_bm25=enable_bm25,
            enable_vector=enable_vector,
            enable_reverse=enable_reverse,
            enable_hyde=enable_hyde,
            enable_summary=enable_summary
        )
        timing['retrieval'] = retrieval_timing

        # 三、重排
        if enable_ranking:
            ranker = MultiFactorRanker(
                self.reranker,
                w_relevance=w_relevance, w_quality=w_quality,
                w_length=w_length, w_review=w_review,
                w_useful=w_useful, w_recency=w_recency,
                base_decay=base_decay, implied_boost=implied_boost,
                clear_boost=clear_boost, half_life_days=half_life_days
            )
            ranked_comments, ranking_timing = ranker.rank(
                user_query, comments,
                time_sensitivity=intent_detection_result.get('time_sensitivity'),
                topk=ranking_topk, today=today
            )
            timing['ranking'] = ranking_timing
        else:
            ranked_comments = comments
            timing['ranking'] = {'total': 0, 'rerank': 0, 'scoring': 0}

        # 发送参考评论（在生成之前）
        processed_comments = []
        for c in ranked_comments:
            comment_data = {
                'comment_id': c['comment_id'],
                'comment': c['comment'],
                'metadata': c['metadata']
            }
            if enable_ranking:
                comment_data['final_rank'] = c['final_rank']
                comment_data['final_score'] = c['final_score']
            processed_comments.append(comment_data)

        yield {
            "type": "references",
            "data": {
                "comments": processed_comments,
                "summaries": [
                    {"summary": s['summary'], "metadata": s['metadata']}
                    for s in summaries
                ]
            }
        }

        # 四、流式回复生成
        for chunk in self.generator.generate_stream(
            user_query,
            rewritten_queries=intent_expansion_result,
            ranked_comments=ranked_comments,
            summaries=summaries,
            need_retrieval=True,
            today=today,
            history=history
        ):
            yield {"type": "chunk", "content": chunk}

        timing['total'] = time.time() - total_start
        yield {
            "type": "done",
            "data": {"timing": timing}
        }

    def _timed_call(self, func, *args) -> tuple:
        """带计时的函数调用"""
        start = time.time()
        result = func(*args)
        return result, time.time() - start
