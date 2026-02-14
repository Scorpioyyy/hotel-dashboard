"""重排模块：Reranker + 多因子排序"""

import time
import numpy as np
import pandas as pd
from datetime import datetime
from dashscope import TextReRank


class Reranker:
    """Reranker：使用 Qwen3-Rerank 模型计算相关性得分"""

    def __init__(self, api_key: str, model: str = "qwen3-rerank"):
        self.api_key = api_key
        self.model = model

    def rerank(self, query: str, documents: list[str], topk: int = None) -> dict:
        """
        对文档进行重排序

        返回:
            {index: relevance_score}
        """
        if topk is None:
            topk = len(documents)

        response = TextReRank.call(
            api_key=self.api_key,
            model=self.model,
            query=query,
            documents=documents,
            top_n=topk,
            return_documents=False
        )

        if response.status_code == 200:
            return {item.index: item.relevance_score for item in response.output.results}
        else:
            raise RuntimeError(f"Rerank 调用失败: {response.message}")


class MultiFactorRanker:
    """多因子排序器：融合相关性、内容质量、时效性进行综合排序"""

    def __init__(self, reranker,
                 w_relevance: float = 0.40,
                 w_quality: float = 0.25,
                 w_length: float = 0.05,
                 w_review: float = 0.05,
                 w_useful: float = 0.05,
                 w_recency: float = 0.20,
                 base_decay: float = 0.5,
                 implied_boost: float = 0.5,
                 clear_boost: float = 0.5,
                 half_life_days: int = 180):
        self.reranker = reranker

        self.w_relevance = w_relevance
        self.w_quality = w_quality
        self.w_length = w_length
        self.w_review = w_review
        self.w_useful = w_useful
        self.w_recency = w_recency

        self.base_decay = base_decay
        self.implied_boost = implied_boost
        self.clear_boost = clear_boost
        self.half_life_days = half_life_days

    def rank(self, query: str, candidates: list[dict], time_sensitivity: str = None,
             topk: int = 10, today: datetime | None = None) -> tuple[list[dict], dict]:
        """
        多因子排序

        返回:
            (ranked_results, timing_info)
        """
        ranking_start = time.time()

        if not candidates:
            return [], {'total': 0, 'rerank': 0, 'scoring': 0}

        # 1. Rerank 打分
        rerank_start = time.time()
        documents = [c['comment'] for c in candidates]
        relevance_map = self.reranker.rerank(query, documents)
        rerank_time = time.time() - rerank_start

        # 2. 提取各特征值
        scoring_start = time.time()

        relevance_score = np.array([relevance_map.get(i, 0) for i in range(len(candidates))])

        quality_score = np.array([c['metadata']['quality_score'] for c in candidates])
        norm_quality = quality_score / 10.0

        comment_len = np.array([len(c['comment']) for c in candidates])
        log_comment_len = np.log(comment_len + 1)
        norm_length = log_comment_len / 7.51

        review_count = np.array([c['metadata']['review_count'] for c in candidates])
        log_review_count = np.log(review_count + 1)
        norm_review = log_review_count / 6.32

        useful_count = np.array([c['metadata']['useful_count'] for c in candidates])
        log_useful_count = np.log(useful_count + 1)
        norm_useful = log_useful_count / 3.64

        # 时效性
        decay = self.base_decay
        if time_sensitivity == "implied":
            decay += self.implied_boost
        elif time_sensitivity == "clear":
            decay += self.implied_boost + self.clear_boost

        publish_date = pd.to_datetime([c['metadata']['publish_date'] for c in candidates])
        if not today:
            today = datetime.today()
        days_ago = (today - publish_date).days.values
        days_ago = np.maximum(days_ago, 0)
        recency_score = np.exp(-decay * days_ago / self.half_life_days)

        # 3. 计算综合得分
        final_score = (
            self.w_relevance * relevance_score +
            self.w_quality * norm_quality +
            self.w_length * norm_length +
            self.w_review * norm_review +
            self.w_useful * norm_useful +
            self.w_recency * recency_score
        )
        sorted_index = np.argsort(final_score)[::-1]

        # 4. 构建结果
        ranked_results = []

        rerank_sorted_index = np.argsort(relevance_score)[::-1]
        rerank_rank = np.empty_like(rerank_sorted_index)
        rerank_rank[rerank_sorted_index] = np.arange(1, len(relevance_score) + 1)

        for rank, idx in enumerate(sorted_index[:topk], 1):
            c = candidates[idx]
            result = {
                **c,
                'rerank_score': float(relevance_score[idx]),
                'rerank_rank': int(rerank_rank[idx]),
                'final_score': float(final_score[idx]),
                'final_rank': rank,
                'feature_scores': {
                    'relevance': float(relevance_score[idx]),
                    'quality': float(norm_quality[idx]),
                    'log_comment_len': float(norm_length[idx]),
                    'log_review_count': float(norm_review[idx]),
                    'log_useful_count': float(norm_useful[idx]),
                    'recency': float(recency_score[idx])
                }
            }
            ranked_results.append(result)

        scoring_time = time.time() - scoring_start

        timing_info = {
            'total': time.time() - ranking_start,
            'rerank': rerank_time,
            'scoring': scoring_time
        }

        return ranked_results, timing_info
