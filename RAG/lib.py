import re
import json
import time
import nltk
import jieba
import pickle
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dashscope import Generation, TextEmbedding, TextReRank
import dashvector
import chromadb
try:
    from tqdm.notebook import tqdm
except ImportError:
    from tqdm import tqdm


# 定义时间基准常量
TODAY = datetime(2025, 4, 17)

# 定义房型配置常量
EXACT_ROOM_TYPES = [
    '花园大床房', '花园双床房', '红棉大床套房', '红棉双床套房', '城央绿意大床房', '城央绿意双床房', '粤韵大床套房', '粤韵双床套房', '花园行政大床套房',
    '花园行政双床套房', '羊羊得意主题大床房', '羊羊得意主题大床套房', '大嘴猴亲子主题大床房', '盼酷小黄鸭亲子主题大床房', '盼酷小黄鸭亲子主题套房'
]
FUZZY_ROOM_TYPES = ['大床房', '双床房', '套房', '主题房']


# LLM 客户端
class LLMClient:
    """Qwen 客户端封装"""
    def __init__(self, api_key: str, model: str = "qwen-plus", json: bool = False):
        self.api_key = api_key
        self.model = model
        self.json = json
    
    def generate(self, prompt: str, temperature: float = 0.7) -> str:
        """生成文本"""
        response = Generation.call(
            api_key=self.api_key,
            model=self.model,
            prompt=prompt,
            temperature=temperature,
            result_format="message",
            response_format={"type": "json_object"} if self.json else None
        )
        
        if response.status_code == 200:
            return response.output.choices[0].message.content.strip()
        else:
            raise RuntimeError(f"LLM 调用失败: {response.message}")


# Embedding 客户端
class EmbeddingClient:
    """文本嵌入客户端封装"""
    def __init__(self, api_key: str, model: str = "text-embedding-v4", dimension: int = 1024):
        self.api_key = api_key
        self.model = model
        self.dimension = dimension
    
    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """批量生成 embedding"""
        response = TextEmbedding.call(
            api_key=self.api_key,
            model=self.model,
            input=texts,
            dimension=self.dimension
        )
        
        if response.status_code == 200:
            return [item['embedding'] for item in response.output['embeddings']]
        else:
            raise RuntimeError(f"Embedding 调用失败: {response.message}")


# 倒排索引类定义
class InvertedIndex:
    """基于 BM25 的倒排索引"""
    
    def __init__(self, k1: float = 1.5, b: float = 0.75, stopwords_file: str = None):
        """
        参数:
            k1: BM25 参数，控制词频饱和度
            b: BM25 参数，控制文档长度归一化程度
        """
        self.k1 = k1
        self.b = b
        self.index = {}          # {term: {doc_id: term_freq}}
        self.doc_lengths = {}    # {doc_id: doc_length}
        self.avg_doc_length = 0
        self.num_docs = 0
        self.documents = {}      # {doc_id: document_content}

        # 加载停用词
        self.stopwords = set()
        if stopwords_file and Path(stopwords_file).exists():
            with open(stopwords_file, encoding='utf-8') as f:
                self.stopwords.update([line.strip() for line in f])
            try:
                self.stopwords.update(nltk.corpus.stopwords.words('english'))  # 加载英文停用词
            except:
                print("警告: 未能加载 NLTK 英文停用词")
        
        # 字典预加载
        jieba.initialize()
    
    def tokenize(self, text: str) -> list[str]:
        """分词与过滤"""     
        
        # 删除空白字符
        text = re.sub(r'\s+', '', text)
        
        # 中文分词
        tokens = jieba.lcut(text)
        
        # 过滤停用词、非中英文字符，统一小写
        pattern = re.compile(r'[^\u4e00-\u9fffa-zA-Z]')
        tokens = [token.lower() for token in tokens if token.lower() not in self.stopwords and not pattern.search(token)]
        
        return tokens
    
    def build(self, documents: dict[str, str]):
        """
        构建倒排索引
        
        参数:
            documents: {doc_id: document_text}
        """
        self.documents = documents
        self.num_docs = len(documents)
        
        # 统计文档长度
        total_length = 0
        for doc_id, text in tqdm(documents.items(), desc="分词与统计"):
            tokens = self.tokenize(text)
            doc_length = len(tokens)
            self.doc_lengths[doc_id] = doc_length
            total_length += doc_length
            
            # 构建倒排索引
            term_freq = Counter(tokens)
            for term, freq in term_freq.items():
                if term not in self.index:
                    self.index[term] = {}
                self.index[term][doc_id] = freq
        
        self.avg_doc_length = total_length / self.num_docs if self.num_docs > 0 else 0
        print(f"倒排索引构建完成: {len(self.index)} 个词项, {self.num_docs} 篇文档")
        print(f"平均文档长度: {self.avg_doc_length:.2f} 个词")
    
    def search(self, query: str, topk: int = 10) -> list[tuple[str, float]]:
        """
        BM25 检索
        
        参数:
            query: 查询文本
            topk: 返回 Top-K 结果
        
        返回:
            [(doc_id, bm25_score), ...]
        """
        query_tokens = self.tokenize(query)

        if not query_tokens:
            return []
        
        # 计算 IDF
        idf = {}
        for term in query_tokens:
            if term in self.index:
                df = len(self.index[term])  # 文档频率
                idf[term] = max(0, (self.num_docs - df + 0.5) / (df + 0.5) + 1)
        
        # 计算 BM25 分数
        scores = {}
        for term in query_tokens:
            if term not in self.index:
                continue
            
            for doc_id, tf in self.index[term].items():
                if doc_id not in scores:
                    scores[doc_id] = 0
                
                doc_length = self.doc_lengths[doc_id]
                norm_factor = 1 - self.b + self.b * (doc_length / self.avg_doc_length)
                term_score = idf[term] * (tf * (self.k1 + 1)) / (tf + self.k1 * norm_factor)
                scores[doc_id] = scores.get(doc_id, 0) + term_score
        
        # 排序并返回 Top-K
        sorted_docs = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:topk]
        return sorted_docs
    
    def save(self, filepath: str):
        """保存索引到文件"""
        with open(filepath, 'wb') as f:
            pickle.dump({
                'index': self.index,
                'doc_lengths': self.doc_lengths,
                'avg_doc_length': self.avg_doc_length,
                'num_docs': self.num_docs,
                'documents': self.documents,
                'k1': self.k1,
                'b': self.b,
                'stopwords': self.stopwords
            }, f)
        print(f"倒排索引已保存: {filepath}")
    
    def load(self, filepath: str):
        """从文件加载索引"""
        with open(filepath, 'rb') as f:
            data = pickle.load(f)
            self.index = data['index']
            self.doc_lengths = data['doc_lengths']
            self.avg_doc_length = data['avg_doc_length']
            self.num_docs = data['num_docs']
            self.documents = data['documents']
            self.k1 = data['k1']
            self.b = data['b']
            self.stopwords = data.get('stopwords', set())
        print(f"倒排索引已加载")


class IntentRecognizer:
    """意图识别器：判断问题是否需要检索知识库"""
    
    def __init__(self, api_key: str, model: str = "tongyi-intent-detect-v3"):
        self.api_key = api_key
        self.model = model
        
        # 定义意图类别
        self.intent_dict = {
            "RETRIEVAL": "需要检索酒店评论知识库才能回答的问题（如询问酒店设施、服务、位置、价格等具体信息）",
            "DIRECT": "可以直接回答的通用问题（如问候、闲聊、常识性问题等，不涉及酒店具体信息）"
        }
    
    def recognize(self, query: str) -> str:
        """识别用户意图
        
        参数:
            query: 用户查询
            
        返回:
            意图类别: 'RETRIEVAL' 或 'DIRECT'
        """
        # 构建系统提示词
        intent_string = json.dumps(self.intent_dict, ensure_ascii=False)
        system_prompt = f"""You are Qwen, created by Alibaba Cloud. You are a helpful assistant.
You should choose one tag from the tag list:
{intent_string}
Just reply with the chosen tag."""
        
        # 构建消息
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query}
        ]
        
        # 调用意图识别模型
        response = Generation.call(
            api_key=self.api_key,
            model=self.model,
            messages=messages,
            result_format="message"
        )
        
        if response.status_code == 200:
            intent = response.output.choices[0].message.content.strip()
            return intent == "RETRIEVAL"
        else:
            raise RuntimeError(f"意图识别失败: {response.message}")


class IntentDetector:
    """意图检测器：提取房型约束与时效性需求"""
    
    def __init__(self, llm_client, exact_room_types: list, fuzzy_room_types: list):
        self.llm_client = llm_client
        self.exact_room_types = exact_room_types
        self.fuzzy_room_types = fuzzy_room_types
    
    def detect(self, query: str) -> dict:
        """
        检测用户意图
        
        返回:
            {
                "room_type": "花园大床房" | ... | None,
                "fuzzy_room_type": "大床房" | ... | None,
                "time_sensitivity": "clear" | "implied" | None
            }
        """
        prompt = f"""
你是一个酒店智能客服助手，需要分析用户查询并提取关键信息。

【任务】
从用户查询中提取以下信息：
1. 房型约束：用户是否提到特定房型
2. 时效性需求：用户是否关注最新信息

【精确房型列表】
{json.dumps(self.exact_room_types, ensure_ascii=False)}

【模糊房型列表】
{json.dumps(self.fuzzy_room_types, ensure_ascii=False)}

【房型检测规则】
- 优先检测精确房型，如检测到则填入 room_type，若模棱两可或只能检测到模糊房型则视为未检测到，填入 None。填入的内容只能是【精确房型列表】中的房型名称或 None
- 如未检测到精确房型，尝试检测模糊房型，如检测到则填入 fuzzy_room_type，若模棱两可则视为未检测到，填入 None。填入的内容只能是【模糊房型列表】中的房型名称或 None
- 如都未检测到，两者均为 None

【时效性判断标准】
- clear: 用户明确提到"最近"、"今年"、"最新"、"现在"等词汇
- implied: 用户隐含关注当前现状，但未明确表达，表现弱时效性
- None: 用户未表现出时效性关注

【用户查询】
{query}

【输出格式】
严格以 JSON 格式输出：
{{
    "room_type": "花园大床房" 或 None,
    "fuzzy_room_type": "大床房" 或 None,
    "time_sensitivity": "clear" 或 "implied" 或 None
}}
"""

        for i in range(2):
            try:
                response = self.llm_client.generate(prompt, temperature=0.1)
                response = response.replace('```json', '').replace('```', '').strip()
                data = json.loads(response)
                if data['room_type'] and data['room_type'] not in self.exact_room_types:
                    data['room_type'] = None
                if data['fuzzy_room_type'] and data['fuzzy_room_type'] not in self.fuzzy_room_types:
                    data['fuzzy_room_type'] = None
                if data['time_sensitivity'] and data['time_sensitivity'] not in ['clear', 'implied']:
                    data['time_sensitivity'] = None
                return data
            except Exception as e:
                print(f"意图检测第 {i+1} 次尝试失败: {e}")
                if i < 2:
                    time.sleep(0.1)
                    continue
        
        print("意图检测失败，已返回全 None 字典")
        return {
            "room_type": None,
            "fuzzy_room_type": None,
            "time_sensitivity": None
        }


class IntentExpander:
    """意图扩展器：改写 Query 并计算权重"""
    
    def __init__(self, llm_client):
        self.llm_client = llm_client
    
    def expand(self, query: str) -> dict:
        """
        扩展用户意图
        
        返回:
            [
                {"query": "改写的查询1", "weight": 0.6},
                {"query": "改写的查询2", "weight": 0.2},
                {"query": "改写的查询3", "weight": 0.2}
            ]
        """
        prompt = f"""
你是一个酒店智能客服助手，需要深度理解用户查询意图。

【任务】
1. 分析用户查询，检测用户的核心关注点
2. 生成1-3个改写后的查询，每个查询更清晰、更具体地表达一个关注点
3. 为每个改写查询分配权重，表示该关注点的重要性（权重之和为1，且只允许使用0.2的倍数，即0.2,0.4,0.6,0.8,1.0）

【用户查询】
{query}

【要求】
- 改写的查询应该比原查询更具体、更明确
- 每个改写查询应该聚焦一个具体方面
- 权重应该反映该方面在原查询中的重要性
- 对于模糊的查询，使用尽可能多的改写来覆盖更大范围的意图；对于明确的查询，不要对其过度展开

【输出格式】
严格以 JSON 格式输出：
{{
    "rewritten_queries": [
        {{"query": "酒店交通是否便利？", "weight": 0.6}},
        {{"query": "酒店周边有哪些配套设施？", "weight": 0.2}},
        {{"query": "酒店的服务效率如何？", "weight": 0.2}}
    ]
}}

【注意】
- rewritten_queries 数组长度为1-3
- 所有 weight 之和必须等于1，且只允许使用0.2的倍数
"""

        for i in range(2):
            try:
                response = self.llm_client.generate(prompt, temperature=0.3)
                response = response.replace('```json', '').replace('```', '').strip()
                data = json.loads(response)
                queries = data['rewritten_queries']
                if isinstance(queries, list):
                    for item in queries:
                        item['query'] = item['query']
                        item['weight'] = float(item['weight'])
                    return queries
                else:
                    raise TypeError(f"queries 数据类型错误: 期望 list, 实际为 {type(queries).__name__}")
            except Exception as e:
                print(f"意图扩展第 {i+1} 次尝试失败: {e}")
                if i < 2:
                    time.sleep(0.1)
                    continue
        
        print("意图扩展失败，已返回 None")
        return None


class HyDEGenerator:
    """假设性回复生成器：为单个 Query 生成假设回复用于增强检索"""
    
    def __init__(self, llm_client):
        self.llm_client = llm_client
    
    def generate(self, query: str) -> list[str]:
        """
        为单个查询生成假设性回复
        
        策略：生成2条正面回复 + 1条负面回复
        
        参数:
            query: 单个查询文本
        
        返回:
            ["假设回复1", "假设回复2", "假设回复3"]
        """
        prompt = f"""
你是一个酒店评论撰写者，需要为以下查询生成假设性的评论回复。

【查询】
{query}

【任务】
针对上述查询，生成3条假设性的酒店评论：
- 2条正面评论：积极评价酒店相关方面
- 1条负面评论：指出可能存在的不足

【要求】
- 每条评论50-100字
- 评论要具体、真实，包含细节
- 评论风格要像真实用户写的
- 尽量增大3条评论之间的差异性

【输出格式】
严格以 JSON 格式输出：
{{
    "hypothetical_responses": [
        "正面评论1",
        "正面评论2",
        "负面评论"
    ]
}}
"""

        for i in range(2):
            try:
                response = self.llm_client.generate(prompt, temperature=0.7)
                response = response.replace('```json', '').replace('```', '').strip()
                data = json.loads(response)
                responses = data['hypothetical_responses']
                if isinstance(responses, list):
                    return responses
                else:
                    raise TypeError(f"responses 数据类型错误: 期望 list, 实际为 {type(responses).__name__}")
            except Exception as e:
                print(f"假设性回复生成第 {i+1} 次尝试失败: {e}")
                if i < 2:
                    time.sleep(0.1)
                    continue
        
        print("假设性回复生成失败，已返回原查询")
        return [query]


class HybridRetriever:
    """混合检索器：多路召回 + RRF 融合"""
    
    def __init__(self, inverted_index, comments_collection, reverse_queries_collection, 
                 summaries_collection, embedding_client, df_comments, hyde_generator):
        # 倒排索引
        self.inverted_index = inverted_index
        
        # 向量数据库
        self.comments_collection = comments_collection
        self.reverse_queries_collection = reverse_queries_collection
        self.summaries_collection = summaries_collection
        
        # 客户端
        self.embedding_client = embedding_client
        self.hyde_generator = hyde_generator
        
        # 评论数据
        self.df_comments = df_comments
    
    def retrieve(self, rewritten_queries, room_type=None, fuzzy_room_type=None, topk=150, final_topk=100, enable_bm25=True, enable_vector=True,
                 enable_reverse=True, enable_hyde=True, enable_summary=True) -> tuple[list[dict], list[dict], dict, dict]:
        """
        混合检索
        
        参数:
            rewritten_queries: 改写后的 Query 列表及权重 [{"query": ..., "weight": ...}, ...]
            room_type: 精确房型约束（可选）
            fuzzy_room_type: 模糊房型约束（可选）
            topk: 每次召回的评论数量
            final_topk: 最终返回的评论数量
            enable_bm25 等: 是否启用该路召回
        
        返回:
            (comment_results, summary_results, timing_info, hyde_results)
            
            comment_results: 评论检索结果列表
                [
                    {
                        'comment_id': 评论 ID,
                        'comment': 评论文本内容,
                        'rrf_score': RRF 融合得分,
                        'rrf_rank': 在 RRF 排序中的排名,
                        'route_ranks': 召回路由信息,
                            {
                                'bm25': [{'rank': 排名, 'metadata': {'query_idx': 查询索引}}],
                                'vector': [{'rank': 排名, 'metadata': {'query_idx': 查询索引}}],
                                'reverse': [{'rank': 排名, 'metadata': {'query_idx': 查询索引}}],
                                'hyde': [{'rank': 排名, 'metadata': {'query_idx': 查询索引, 'hyde_idx': HyDE 索引}}]
                            },
                        'metadata': 评论元数据,
                            {
                                'score': 评分,
                                'publish_date': 发布日期,
                                'quality_score': 评论质量分,
                                'review_count': 回复数,
                                'useful_count': 点赞数,
                                'room_type': 房型,
                                'fuzzy_room_type': 模糊房型
                            }
                    },
                    ...
                ]
            
            summary_results: 摘要检索结果列表
                [
                    {
                        'summary': 摘要文本,
                        'metadata': 摘要元数据,
                        'retrieved_by_queries': 召回该摘要的查询索引列表
                    },
                    ...
                ]
            
            timing_info: 时间统计信息
                {
                    'routes': 各路召回的延迟,
                        {
                            'bm25': BM25 召回延迟（秒）,
                            'vector': 向量召回延迟（秒，含嵌入时间）,
                            'reverse': 反向查询召回延迟（秒，含嵌入时间）,
                            'hyde': HyDE 召回延迟详情,
                                {
                                    'total': HyDE 总延迟（秒）,
                                    'generation': HyDE 生成延迟（秒）,
                                    'retrieval': HyDE 检索延迟（秒）
                                },
                            'summary': 摘要召回延迟（秒，含嵌入时间）
                        },
                    'rrf_fusion': RRF 融合延迟（秒）,
                    'total': 检索总延迟（秒）
                }
            
            hyde_results: HyDE 假设回复
                {
                    query_idx: [假设回复1, 假设回复2, ...],
                    ...
                }
        """
        timing = {}
        retrieve_start_time = time.time()
        
        # 提取 Query 与权重并做嵌入
        queries = [item['query'] for item in rewritten_queries]
        weights = [item['weight'] for item in rewritten_queries]
        if sum([enable_vector, enable_reverse, enable_summary]):
            embedding_start_time = time.time()
            query_embeddings = self.embedding_client.embed_batch(queries)
            embedding_time = time.time() - embedding_start_time
        
        # 构建房型过滤条件
        room_filter = None
        if room_type:
            room_filter = f"room_type = '{room_type}'"
        elif fuzzy_room_type:
            room_filter = f"fuzzy_room_type = '{fuzzy_room_type}'"

        # 统计启用的通路数
        enabled_routes = sum([enable_bm25, enable_vector, enable_reverse, enable_hyde, enable_summary])
        if enabled_routes == 0:
            raise ValueError("至少需要启用一路召回")
        
        with ThreadPoolExecutor(max_workers=enabled_routes) as executor:
            futures = {}
            if enable_bm25:
                futures[executor.submit(self._route_bm25, queries, topk)] = 'bm25'  # 简化实现，不支持房型过滤
            if enable_vector:
                futures[executor.submit(self._route_vector, query_embeddings, topk, room_filter)] = 'vector'
            if enable_reverse:
                futures[executor.submit(self._route_reverse, query_embeddings, topk, room_filter)] = 'reverse'
            if enable_hyde:
                futures[executor.submit(self._route_hyde, queries, topk, room_filter)] = 'hyde'
            if enable_summary:
                futures[executor.submit(self._route_summary, query_embeddings)] = 'summary'
            
            comment_results = []
            summary_results = []
            route_results = {}
            hyde_results = {}

            for future in as_completed(futures):
                route_name = futures[future]

                # 摘要路单独存储
                if route_name == 'summary':
                    results, route_timing = future.result()
                    timing[route_name] = route_timing + embedding_time  # 补加嵌入时间
                    summary_results = results

                # HyDE 路返回额外的生成结果
                elif route_name == 'hyde':
                    results, route_timing, hyde_generated = future.result()
                    timing[route_name] = route_timing
                    route_results[route_name] = results
                    comment_results.extend(results)
                    hyde_results = hyde_generated
                
                # 其余通路正常合并用于 RRF 融合
                else:
                    results, route_timing = future.result()
                    timing[route_name] = route_timing if route_name == 'bm25' else route_timing + embedding_time  # 补加嵌入时间
                    route_results[route_name] = results
                    comment_results.extend(results)
        
        # 设置未启用通路的默认延迟
        if not enable_bm25:
            timing['bm25'] = 0
        if not enable_vector:
            timing['vector'] = 0
        if not enable_reverse:
            timing['reverse'] = 0
        if not enable_hyde:
            timing['hyde'] = {'total': 0, 'generation': 0, 'retrieval': 0}
        if not enable_summary:
            timing['summary'] = 0
        
        # RRF 融合
        rrf_start_time = time.time()
        rrf_scores = self._rrf_fusion(comment_results, weights, k=60)
        
        # RRF 排名
        sorted_by_rrf = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
        rrf_ranks = {doc_id: rank for rank, (doc_id, score) in enumerate(sorted_by_rrf, 1)}
        
        # 构建检索结果
        final_comment_results = []
        for doc_id, rrf_score in sorted_by_rrf[:final_topk]:
            comment_row = self.df_comments.loc[doc_id]
            
            # 统计该评论在各路召回中的详细信息
            route_ranks = {}
            for route_name, results in route_results.items():
                for d_id, r_name, rank, metadata in results:
                    if d_id == doc_id:
                        if route_name not in route_ranks:
                            route_ranks[route_name] = []
                        
                        route_ranks[route_name].append({
                            'rank': rank,
                            'metadata': metadata
                        })
            
            final_comment_results.append({
                'comment_id': doc_id,
                'comment': comment_row['comment'],
                'rrf_score': rrf_score,
                'rrf_rank': rrf_ranks[doc_id],
                'route_ranks': route_ranks,
                'metadata': {
                    'score': comment_row['score'],
                    'publish_date': comment_row['publish_date'],
                    'quality_score': comment_row['quality_score'],
                    'review_count': comment_row['review_count'],
                    'useful_count': comment_row['useful_count'],
                    'room_type': comment_row['room_type'],
                    'fuzzy_room_type': comment_row['fuzzy_room_type']
                }
            })

        timing['rrf_fusion'] = time.time() - rrf_start_time
        
        timing_info = {
            'routes': timing,
            'total': time.time() - retrieve_start_time
        }

        return final_comment_results, summary_results, timing_info, hyde_results

    
    def _route_bm25(self, queries: list[str], topk: list[int]) -> tuple[list, float]:
        """第一路：BM25 文本召回"""
        start = time.time()
        results = []
        
        # 并行处理多个 Query
        with ThreadPoolExecutor(max_workers=len(queries)) as executor:
            futures = [
                executor.submit(self._single_bm25_query, query_idx, query, topk)
                for query_idx, query in enumerate(queries)
            ]
            for future in as_completed(futures):
                results.extend(future.result())
        
        return results, time.time() - start
    
    def _single_bm25_query(self, query_idx, query, topk):
        """单次 BM25 查询"""
        bm25_results = self.inverted_index.search(query, topk=topk)
        return [(doc_id, 'bm25', rank, {'query_idx': query_idx}) for rank, (doc_id, score) in enumerate(bm25_results, 1)]

    
    def _route_vector(self, query_embeddings: list[list[float]], topk: int, room_filter: str) -> tuple[list, float]:
        """第二路：基础向量召回"""
        start = time.time()
        results = []
        
        with ThreadPoolExecutor(max_workers=len(query_embeddings)) as executor:
            futures = [
                executor.submit(self._single_vector_query, query_idx, emb, room_filter, topk)
                for query_idx, emb in enumerate(query_embeddings)
            ]
            for future in as_completed(futures):
                results.extend(future.result())
        
        return results, time.time() - start
    
    def _single_vector_query(self, query_idx, embedding, room_filter, topk):
        """单次向量查询"""
        response = self.comments_collection.query(vector=embedding, topk=topk, filter=room_filter)
        docs = response.output if response.output else []
        return [(doc.id, 'vector', rank, {'query_idx': query_idx}) for rank, doc in enumerate(docs, 1)]

    
    def _route_reverse(self, query_embeddings: list[list[float]], topk: int, room_filter: str) -> tuple[list, float]:
        """第三路：反向 Query 召回"""
        start = time.time()
        results = []
        
        with ThreadPoolExecutor(max_workers=len(query_embeddings)) as executor:
            futures = [
                executor.submit(self._single_reverse_query, query_idx, emb, room_filter, topk)
                for query_idx, emb in enumerate(query_embeddings)
            ]
            for future in as_completed(futures):
                results.extend(future.result())
        
        return results, time.time() - start
    
    def _single_reverse_query(self, query_idx, embedding, room_filter, topk):
        """单次反向查询"""
        response = self.reverse_queries_collection.query(vector=embedding, topk=topk, filter=room_filter)
        docs = response.output if response.output else []
        return [(doc.fields.get('comment_id'), 'reverse', rank, {'query_idx': query_idx}) for rank, doc in enumerate(docs, 1)]

    
    def _route_hyde(self, queries: list[str], topk: int, room_filter: str) -> tuple[list, dict, dict]:
        """第四路：HyDE 增强召回"""
        route_start = time.time()
        results = []
        hyde_generated = {}
        
        generation_time = []
        retrieval_time = []
        
        with ThreadPoolExecutor(max_workers=len(queries)) as executor:
            futures = [
                executor.submit(self._single_hyde_pipeline, query_idx, query, topk, room_filter)
                for query_idx, query in enumerate(queries)
            ]
            
            for future in as_completed(futures):
                query_results, gen_time, ret_time, query_idx, hyde_responses = future.result()
                results.extend(query_results)
                generation_time.append(gen_time)
                retrieval_time.append(ret_time)
                hyde_generated[query_idx] = hyde_responses

        timing = {
            'total': time.time() - route_start,
            'generation': max(generation_time),
            'retrieval': max(retrieval_time)
        }
        
        return results, timing, hyde_generated
    
    def _single_hyde_pipeline(self, query_idx: int, query: str, topk: int, room_filter: str) -> tuple[list, float, float, int, list]:
        """单个 Query 的 HyDE 生成与召回"""
        
        # 1. 生成假设回复
        gen_start = time.time()
        hyde_responses = self.hyde_generator.generate(query)
        generation_time = time.time() - gen_start
        
        # 2. 向量化并召回
        ret_start = time.time()
        hyde_embeddings = self.embedding_client.embed_batch(hyde_responses)
        
        raw_results = []
        with ThreadPoolExecutor(max_workers=len(hyde_embeddings)) as executor:
            futures = [
                executor.submit(self._single_hyde_query, query_idx, hyde_idx, emb, room_filter, topk)
                for hyde_idx, emb in enumerate(hyde_embeddings)
            ]
            for future in as_completed(futures):
                raw_results.extend(future.result())

        # 3. 去重，避免 HyDE 刷分
        best_candidates = {}  # doc_id -> (rank, item)
        
        for item in raw_results:
            doc_id, route_name, rank, metadata = item
            if doc_id not in best_candidates or rank < best_candidates[doc_id][0]:  # 若多条 HyDE 都召回了同一条评论，只保留排名最靠前的一个
                best_candidates[doc_id] = (rank, item)

        results = [item for rank, item in best_candidates.values()]
        
        retrieval_time = time.time() - ret_start
        
        return results, generation_time, retrieval_time, query_idx, hyde_responses
    
    def _single_hyde_query(self, query_idx, hyde_idx, embedding, room_filter, topk):
        """单次 HyDE 向量查询"""
        response = self.comments_collection.query(vector=embedding, topk=topk, filter=room_filter)
        docs = response.output if response.output else []
        return [(doc.id, 'hyde', rank, {'query_idx': query_idx, 'hyde_idx': hyde_idx}) for rank, doc in enumerate(docs, 1)]

        
    def _route_summary(self, query_embeddings: list[list[float]]) -> tuple[list[dict], float]:
        """第五路：类别摘要召回"""
        start = time.time()
        
        # 为每个 Query 召回最相关的 1 个类别
        summary_results = self.summaries_collection.query(query_embeddings=query_embeddings, n_results=1)
        
        # 收集所有召回的摘要
        category_map = {}
        
        for query_idx, (category_ids, documents, metadatas) in enumerate(zip(
            summary_results['ids'],
            summary_results['documents'],
            summary_results['metadatas']
        )):
            if category_ids:
                category_id = category_ids[0]
                
                if category_id not in category_map:
                    category_map[category_id] = {
                        'summary': documents[0],
                        'metadata': metadatas[0] if metadatas else {},
                        'retrieved_by_queries': []
                    }

                category_map[category_id]['retrieved_by_queries'].append(query_idx)
        
        summaries = list(category_map.values())
        
        return summaries, time.time() - start

    
    def _rrf_fusion(self, all_results: list[tuple], weights: list[float], k: int = 60) -> dict:
        """RRF 融合"""
        rrf_scores = defaultdict(float)
        for doc_id, route_name, rank, metadata in all_results:
            rrf_scores[doc_id] += (1 / (k + rank))  * weights[metadata['query_idx']]  # 根据意图权重进行加权
        return dict(rrf_scores)


class Reranker:
    """Reranker：使用 Qwen3-Rerank 模型计算相关性得分"""
    
    def __init__(self, api_key: str, model: str = "qwen3-rerank"):
        self.api_key = api_key
        self.model = model
    
    def rerank(self, query: str, documents: list[str], topk: int = None) -> dict:
        """
        对文档进行重排序
        
        参数:
            query: 查询文本
            documents: 待排序的文档列表
            topk: 返回前 K 个结果（默认返回全部）
        
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
        
        # 排序权重
        w_relevance: float = 0.40,   # 相关性权重
        w_quality: float = 0.25,     # 评论质量分权重
        w_length: float = 0.05,      # 评论长度权重
        w_review: float = 0.05,      # 回复数权重
        w_useful: float = 0.05,      # 点赞数权重
        w_recency: float = 0.20,     # 时效性权重
        
        # 时效性参数
        base_decay: float = 0.5,     # 基础衰减率
        implied_boost: float = 0.5,  # implied 级别额外衰减增量
        clear_boost: float = 0.5,    #  clear  级别额外衰减增量（在 implied 基础上）
        half_life_days: int = 180    # 半衰期（天数）
        
    ):
        self.reranker = reranker
        
        # 排序权重
        self.w_relevance = w_relevance
        self.w_quality = w_quality
        self.w_length = w_length
        self.w_review = w_review
        self.w_useful = w_useful
        self.w_recency = w_recency
        
        # 时效性参数
        self.base_decay = base_decay
        self.implied_boost = implied_boost
        self.clear_boost = clear_boost
        self.half_life_days = half_life_days
    
    def rank(self, query: str, candidates: list[dict], time_sensitivity: str = None, topk: int = 10,
             today: datetime | None = None) -> tuple[list[dict], dict]:
        """
        多因子排序
        
        参数:
            query: 用户查询
            candidates: 混合检索返回的候选评论列表
            time_sensitivity: 时效性需求
            topk: 返回前 K 个结果
            today: 当前时间
        
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

        # 相关性
        relevance_score = np.array([relevance_map.get(i, 0) for i in range(len(candidates))])  # 取值范围 (0, 1)

        # 内容质量
        # (1) 评论质量分
        quality_score = np.array([c['metadata']['quality_score'] for c in candidates])
        norm_quality = quality_score / 10.0        # 取值范围 (0, 1)

        # (2) 评论长度
        comment_len = np.array([len(c['comment']) for c in candidates])
        log_comment_len = np.log(comment_len + 1)
        norm_length = log_comment_len / 7.51       # 取值范围 (0, 1)

        # (3) 回复数
        review_count = np.array([c['metadata']['review_count'] for c in candidates])
        log_review_count = np.log(review_count + 1)
        norm_review = log_review_count / 6.32      # 取值范围 (0, 1)
        
        # (4) 点赞数
        useful_count = np.array([c['metadata']['useful_count'] for c in candidates])
        log_useful_count = np.log(useful_count + 1)
        norm_useful = log_useful_count / 3.64      # 取值范围 (0, 1)
        
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
        recency_score = np.exp(-decay * days_ago / self.half_life_days)  # 取值范围 (0, 1)
        
        # 3. 计算综合得分并排序
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
        
        # 预计算 rerank_rank
        rerank_sorted_index = np.argsort(relevance_score)[::-1]
        rerank_rank = np.empty_like(rerank_sorted_index)
        rerank_rank[rerank_sorted_index] = np.arange(1, len(relevance_score) + 1)
        
        # 添加重排模块信息
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


class ResponseGenerator:
    """回复生成器：基于检索上下文生成最终回复"""
    
    def __init__(self, api_key: str, model: str = "deepseek-v3.2"):
        self.api_key = api_key
        self.model = model
    
    def generate(self, user_query: str, rewritten_queries: list[dict] = None, ranked_comments: list[dict] = None, summaries: list[dict] = None,
                 need_retrieval: bool = True, print_response: bool = True, today: datetime | None = None) -> tuple[str, float, float]:
        """
        生成回复
        
        参数:
            user_query: 用户原始查询
            rewritten_queries: 改写后的查询列表（含权重）
            ranked_comments: 排序后的 Top-K 评论
            summaries: 召回的摘要信息
            need_retrieval: 是否需要检索（意图识别结果）
            print_response: 是否需要打印流式输出
            today: 当前时间
        
        返回:
            (response_text, ttft_model, subsequent_time, generation_time)
        """
        start_time = time.time()
        
        # 直接回答
        if not need_retrieval:
            prompt = f"""
你是广州花园酒店的智能客服助手。

用户问题：{user_query}

请直接回答用户的问题。注意：
- 如果是问候或闲聊，友好回应
- 如果是通用问题，给出简洁准确的回答
- 语气要亲切专业
- 使用Markdown格式输出，不得出现 "```markdown", "```" 标记
"""

        # 基于检索回答
        else:
            if not today:
                today = datetime.today()
            date = f"{today.year}年{today.month}月{today.day}日"
            
            # 构建改写 Query 上下文
            queries_context = ""
            if rewritten_queries:
                queries_context += "【问题解析】\n系统识别到用户可能关注以下方面：\n"
                queries_context += "\n".join([f"- {q['query']}（意图权重为{q['weight']}）" for q in rewritten_queries])
                queries_context += "\n注意：权重信息是用来帮助你区分意图主次的，**不得**向用户输出权重相关信息。"
            
            # 构建评论上下文
            if ranked_comments:
                comments_context = "【相关用户评论】\n"
                for i, c in enumerate(ranked_comments, 1):
                    comments_context += f"""
【评论{i}】
评分: {c['metadata']['score']}（满分5分）
发布日期: {c['metadata']['publish_date']}
评论文本: {c['comment']}
点赞数: {c['metadata']['useful_count']}
回复数: {c['metadata']['review_count']}
房型: {c['metadata']['room_type']}
"""
            else:
                comments_context = "【未检索到相关用户评论】\n"
            
            # 构建摘要上下文
            summaries_context = ""
            if summaries:
                summaries_context += "【相关评论摘要】\n"
                for s in summaries:
                    summaries_context += f"""
【{s['metadata']['category']}类别摘要】
关键词: {s['metadata']['keywords']}
摘要: {s['summary']}
"""
                summaries_context += """
注意：评论摘要是用来给到你更丰富的概览信息的，但用户只能看到【相关用户评论】的引用而看不到摘要的引用，因此在回复中你可以给出摘要中的模糊信息，\
但**不得**过于精确因为用户无法溯源，也**不得**告诉用户你引用了摘要。若摘要中的信息与用户问题无关，直接忽略即可，**不需要**做出任何额外说明。
"""
            
            prompt = f"""
你是广州花园酒店的智能客服助手，需要基于用户评论为用户提供准确、高质量、有帮助、简洁的回答。

今天是：{date}

用户问题：{user_query}

{queries_context}

{comments_context}

{summaries_context}

【回答要求】
1. 综合以上评论信息，给出客观、全面的回答
2. 回答要有条理，突出重点
3. 如有正面和负面评价，都要提及，保持客观。注意给出的参考评论并不代表所有，切忌以偏概全给出“绝对化”的表述
4. 语气要专业、亲切
5. 回答长度适中，不要过于冗长
6. 不得大段或连续照抄用户评论，严禁全文都在引用用户评论却并没有思考提炼总结。相似内容能合并就合并，不要分开引用（合并后注意不得同时列出超过3条参考评论，使用“等”替代）
7. 一般来说越靠前的评论，其重要性越高，但你也可以自行判断自行选择
8. 不得在回复中罗列用户评论的具体日期，但当用户问题时效性敏感时，可以大致提一下参考评论的时间范围；当用户未表现出明显时效性需求时不要强行给出具体时间
9. 引用某一条评论独特内容时应指出评论几，供用户参考，但针对参考评论总体（如“多数住客……”等内容）或摘要进行归纳总结时无需指出参考了哪些评论
10. 不得同时列出超过3条参考评论，即禁止诸如“（评论1/3/5/7）”的表述。如需同时引用超过3条评论，则应输出“（评论1/3等）”，而不是将其全部列出。优先给出排名靠前的评论引用
11. 如果评论信息不足以回答问题，诚实说明
12. 使用Markdown格式输出，不得出现 "```markdown", "```" 标记

用户问题：{user_query}

请给出你的回答：
"""
        
        # 调用 LLM 生成回复（流式输出）
        completion = Generation.call(
            api_key=self.api_key,
            model=self.model,
            prompt=prompt,
            temperature=0.7,
            result_format="message",
            stream=True,
            incremental_output=True
        )
        
        response_content = ""
        ttft_model = 0
        subsequent_time = 0
        generation_time = 0
        
        for chunk in completion:
            if chunk.status_code != 200:
                raise RuntimeError(f"回复生成失败: {chunk.message}")
            
            message = chunk.output.choices[0].message
            if message.content:
                if not ttft_model:
                    ttft_model = time.time() - start_time        # 模型回复首字延迟
                    first_token_time = time.time()
                if print_response:
                    print(message.content, end="", flush=True)   # 直接打印输出
                response_content += message.content
        
        if print_response and response_content:
            print()

        if ttft_model:
            subsequent_time = time.time() - first_token_time     # 模型后续回复延迟
        
        generation_time = time.time() - start_time               # 模型回复总延迟
        
        return response_content, ttft_model, subsequent_time, generation_time


class HotelReviewRAG:
    """酒店评论 RAG 系统：完整的检索增强生成工作流"""
    
    def __init__(self, api_key: str, dashvector_api_key: str, dashvector_endpoint: str, data_dir: Path,
                 detection_model: str = "qwen-plus", expansion_hyde_model: str = "qwen-flash", generation_model: str = "deepseek-v3.2"):
        
        # 连接向量数据库
        dashvector_client = dashvector.Client(api_key=dashvector_api_key, endpoint=dashvector_endpoint)
        self.comments_collection = dashvector_client.get("comment_database")
        self.reverse_queries_collection = dashvector_client.get("reverse_query_database")
        
        chroma_db_path = data_dir / "chroma_db"
        chroma_client = chromadb.PersistentClient(path=str(chroma_db_path))
        self.summaries_collection = chroma_client.get_collection("summary_database")
        
        # 加载离线数据
        processed_dir = data_dir / "processed"
        self.inverted_index = InvertedIndex()
        self.inverted_index.load(processed_dir / "inverted_index.pkl")
        self.df_comments = pd.read_csv(processed_dir / "enriched_comments.csv", index_col=0)
        
        # 初始化各组件
        self.detection_client = LLMClient(api_key=api_key, model=detection_model, json=True)
        self.expansion_hyde_client = LLMClient(api_key=api_key, model=expansion_hyde_model, json=True)
        self.embedding_client = EmbeddingClient(api_key=api_key)
        self.intent_recognizer = IntentRecognizer(api_key=api_key)
        self.intent_detector = IntentDetector(self.detection_client, EXACT_ROOM_TYPES, FUZZY_ROOM_TYPES)
        self.intent_expander = IntentExpander(self.expansion_hyde_client)
        self.hyde_generator = HyDEGenerator(self.expansion_hyde_client)
        self.retriever = HybridRetriever(
            self.inverted_index, self.comments_collection, self.reverse_queries_collection,
            self.summaries_collection, self.embedding_client, self.df_comments, self.hyde_generator
        )
        self.reranker = Reranker(api_key=api_key)
        self.generator = ResponseGenerator(api_key=api_key, model=generation_model)
        
    def query(self, user_query: str,
              
        # 检索参数
        route_topk: int = 150,
        retrieval_topk: int = 100,
        ranking_topk: int = 10,

        # 是否启用意图扩展器
        enable_expansion: bool = True,
              
        # 五路召回开关
        enable_bm25: bool = True,
        enable_vector: bool = True,
        enable_reverse: bool = True,
        enable_hyde: bool = True,
        enable_summary: bool = True,
              
        # 是否启用重排模块
        enable_ranking: bool = True,

        # 是否需要生成最终回复并打印流式输出
        enable_generation: bool = True,
        print_response: bool = True,
              
        # 排序权重
        w_relevance: float = 0.40,
        w_quality: float = 0.25,
        w_length: float = 0.05,
        w_review: float = 0.05,
        w_useful: float = 0.05,
        w_recency: float = 0.20,
              
        # 时效性参数
        base_decay: float = 0.5,
        implied_boost: float = 0.5,
        clear_boost: float = 0.5,
        half_life_days: int = 180,
        today: datetime | None = TODAY
              
    ) -> dict:
        """
        处理用户查询并生成回复
        
        参数:
            user_query: 用户输入的查询
            route_topk: 每路召回数量
            retrieval_topk: 混合检索输出数量
            ranking_topk: 重排后输出数量
            enable_expansion: 是否启用意图扩展器
            enable_bm25 等: 是否启用该路召回
            enable_ranking: 是否启用重排模块
            enable_generation: 是否需要生成最终回复
            print_response: 是否需要打印流式输出
            w_relevance 等: 排序权重
            base_decay 等: 时效性参数
            today: 当前时间
        
        返回:
            {
                'response': 模型回复文本,
                'references': {
                    'comments': 参考的评论列表,
                    'summaries': 参考的摘要列表,
                    'hyde_responses': HyDE 生成的假设回复
                },
                'query_processing': {
                    'intent_recognition': 意图识别结果,
                    'intent_detection': 意图检测结果,
                    'intent_expansion': 意图扩展结果
                },
                'timing': {
                    'intent_recognition': 意图识别延迟,
                    'intent_detection': 意图检测延迟,
                    'intent_expansion': 意图扩展延迟,
                    'query_processing_total': 查询处理总延迟（不含 HyDE）,
                    'retrieval': 混合检索延迟详情,
                    'ranking': 重排延迟,
                    'ttft': 首字延迟,
                    'ttft_model': 模型回复首字延迟,
                    'subsequent': 模型后续回复延迟,
                    'generation': 模型回复总延迟,
                    'total': 总延迟
                }
            }
        """
        total_start = time.time()
        timing = {}
        if not today:
            today = datetime.today()
        
        # 一、查询处理
        query_processing_start = time.time()
        
        # 1. 意图识别
        intent_recognition_start = time.time()
        need_retrieval = self.intent_recognizer.recognize(user_query)
        timing['intent_recognition'] = time.time() - intent_recognition_start
        
        # 2. 意图检测与意图扩展（并行执行）
        intent_detection_result = None
        intent_expansion_result = None
        timing['intent_detection'] = 0
        timing['intent_expansion'] = 0
        
        if need_retrieval:
            if enable_expansion:
                with ThreadPoolExecutor(max_workers=2) as executor:
                    future_detect = executor.submit(self._timed_call, self.intent_detector.detect, user_query)
                    future_expand = executor.submit(self._timed_call, self.intent_expander.expand, user_query)
                    
                    intent_detection_result, timing['intent_detection'] = future_detect.result()
                    intent_expansion_result, timing['intent_expansion'] = future_expand.result()

            # 不启用意图扩展
            else:
                intent_detection_result, timing['intent_detection'] = self._timed_call(self.intent_detector.detect, user_query)
                intent_expansion_result, timing['intent_expansion'] = None, 0  # 后续将直接使用原始 Query
        
        timing['query_processing_total'] = time.time() - query_processing_start
        
        # 直接回答
        if not need_retrieval:
            if enable_generation:
                first_token_base = time.time() - total_start

                # 获取模型回复
                response, ttft_model, subsequent, generation = self.generator.generate(
                    user_query, need_retrieval=False, print_response=print_response, today=today
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
                'references': {
                    'comments': [],
                    'summaries': [],
                    'hyde_responses': {}
                },
                'query_processing': {
                    'intent_recognition': need_retrieval,
                    'intent_detection': None,
                    'intent_expansion': None
                },
                'timing': timing
            }
        
        # 二、混合检索
        if enable_ranking:
            final_topk_for_retrieval = retrieval_topk  # 启用重排时，混合检索输出 retrieval_topk 条，排序后输出 ranking_topk 条
        else:
            final_topk_for_retrieval = ranking_topk    # 不启用重排时，混合检索直接输出 ranking_topk 条
        
        rewritten_queries = intent_expansion_result if intent_expansion_result else [{'query': user_query, 'weight': 1.0}]
        
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
                w_relevance=w_relevance,
                w_quality=w_quality,
                w_length=w_length,
                w_review=w_review,
                w_useful=w_useful,
                w_recency=w_recency,
                base_decay=base_decay,
                implied_boost=implied_boost,
                clear_boost=clear_boost,
                half_life_days=half_life_days
            )
            ranked_comments, ranking_timing = ranker.rank(
                user_query,
                comments,
                time_sensitivity=intent_detection_result.get('time_sensitivity'),
                topk=ranking_topk,
                today=today
            )
            timing['ranking'] = ranking_timing
        
        # 不启用重排
        else:
            ranked_comments = comments  # 直接使用混合检索结果
            timing['ranking'] = {'total': 0, 'rerank': 0, 'scoring': 0}
        
        # 四、回复生成
        if enable_generation:
            first_token_base = time.time() - total_start

            # 获取模型回复
            response, ttft_model, subsequent, generation = self.generator.generate(
                user_query,
                rewritten_queries=intent_expansion_result,
                ranked_comments=ranked_comments,
                summaries=summaries,
                need_retrieval=True,
                print_response=print_response,
                today=today
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
            
            # 如果启用了重排，添加重排相关信息
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
    
    def _timed_call(self, func, *args) -> tuple:
        """带计时的函数调用"""
        start = time.time()
        result = func(*args)
        return result, time.time() - start


def print_retrieval_results(results):
    """格式化打印召回结果"""
    comments, summaries, timing, hyde_results = results

    # 1. 时间统计
    print(f"⏱️  延迟统计:")
    print(f"  • 检索总计: {timing['total']:.3f}s")
    print(f"  • 文本召回: {timing['routes']['bm25']:.3f}s")
    print(f"  • 向量召回: {timing['routes']['vector']:.3f}s")
    print(f"  • 反向召回: {timing['routes']['reverse']:.3f}s")
    print(f"  • HyDE召回: {timing['routes']['hyde']['total']:.3f}s（生成 {timing['routes']['hyde']['generation']:.3f}s + 检索 {timing['routes']['hyde']['retrieval']:.3f}s）")
    print(f"  • 摘要召回: {timing['routes']['summary']:.3f}s")
    print(f"  • RRF融合: {timing['routes']['rrf_fusion']:.3f}s")

    # 2. HyDE 假设回复
    if hyde_results:
        print(f"\n🔮 HyDE 假设回复:")
        for q_idx, responses in sorted(hyde_results.items()):
            for h_idx, response in enumerate(responses):
                print(f"  • Q{q_idx}-H{h_idx}: {response}")
    else:
        print(f"\n🔮 未启用 HyDE 召回")
    
    # 3. 召回的摘要
    if summaries:
        print(f"\n📚 召回摘要类别 ({len(summaries)}个):")
        for i, summary in enumerate(summaries, 1):
            print(f"  [{i}] {summary['metadata']['category']}（被 Query {summary['retrieved_by_queries']} 召回）")
            print(f"      关键词: {summary['metadata']['keywords']}")
            print(f"      评论数: {summary['metadata']['comment_count']}")
            print(f"      摘要: {summary['summary'][:100]}...")
    else:
        print(f"\n📚 未启用摘要召回")
    
    # 4. 召回的评论
    if comments:
        print(f"\n🏆 Top {len(comments)} 评论:")
        for comment in comments:
            print(f"  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            print(f"  排名: #{comment['rrf_rank']:>2} | RRF 分数: {comment['rrf_score']:.4f}")
            print(f"  评论ID: {comment['comment_id']}")
            print(f"  房型: {comment['metadata']['room_type']}（{comment['metadata']['fuzzy_room_type']}）")
            print(f"  评分: {comment['metadata']['score']:.1f} | 质量: {comment['metadata']['quality_score']} | 回复: {comment['metadata']['review_count']} | 点赞: {comment['metadata']['useful_count']} | 发布: {comment['metadata']['publish_date']}")
            print(f"  内容: {comment['comment']}")
            
            # 召回路由信息
            # 外部排序：按路由的最佳名次排序
            print(f"  召回路由:")
            route_list = []
            for route, hits in comment['route_ranks'].items():
                if not hits:
                    continue
                best_rank_in_route = min(hit['rank'] for hit in hits)
                route_list.append((best_rank_in_route, route, hits))
            route_list.sort(key=lambda x: x[0])
            
            # 遍历输出
            for _, route, hits in route_list:
                route_name = {'bm25': '文本', 'vector': '向量', 'reverse': '反向', 'hyde': 'HyDE'}.get(route, route)
                
                # 内部排序：在同一行里，按名次优先排序
                hits.sort(key=lambda x: (x['rank'], x['metadata'].get('query_idx', 0), x['metadata'].get('hyde_idx', 0)))
                hit_strs = []
                for hit in hits:
                    rank = hit['rank']
                    q_idx = hit['metadata'].get('query_idx', '?')
                    
                    info_str = f"第{rank}名(Q{q_idx}"
                    if route == 'hyde':
                        h_idx = hit['metadata'].get('hyde_idx', '?')
                        info_str += f"-H{h_idx}"
                    info_str += ")"
                    hit_strs.append(info_str)
                
                print(f"    • {route_name}: {', '.join(hit_strs)}")
    else:
        print(f"\n🏆 未召回评论")


def print_rag_result(result: dict):
    """格式化打印 RAG 结果"""
    refs, qp, timing = result['references'], result['query_processing'], result['timing']

    # 1. 时间统计
    print(f"\n⏱️  延迟统计:")
    print(f"  • 查询处理（不含HyDE）: {timing['query_processing_total']:.3f}s")
    print(f"    • 意图识别: {timing['intent_recognition']:.3f}s")
    print(f"    • 意图检测: {timing['intent_detection']:.3f}s")
    print(f"    • 意图扩展: {timing['intent_expansion']:.3f}s")

    if timing.get('retrieval'):
        rt = timing['retrieval']
        print(f"  • 混合检索: {rt['total']:.3f}s")
        print(f"    • 文本召回: {rt['routes']['bm25']:.3f}s")
        print(f"    • 向量召回: {rt['routes']['vector']:.3f}s")
        print(f"    • 反向召回: {rt['routes']['reverse']:.3f}s")
        if rt['routes']['hyde']['total'] > 0:
            print(f"    • HyDE召回: {rt['routes']['hyde']['total']:.3f}s（生成 {rt['routes']['hyde']['generation']:.3f}s + 检索 {rt['routes']['hyde']['retrieval']:.3f}s）")
        else:
            print(f"    • HyDE召回: 0.000s")
        print(f"    • 摘要召回: {rt['routes']['summary']:.3f}s")
        print(f"    • RRF融合: {rt['routes']['rrf_fusion']:.3f}s")
    
    if timing.get('ranking'):
        rk = timing['ranking']
        if rk['total'] > 0:
            print(f"  • 重排: {rk['total']:.3f}s（Rerank {rk['rerank']:.3f}s + 排序 {rk['scoring']:.3f}s）")
        else:
            print(f"  • 重排: 0.000s")

    print(f"  • 模型回复: {timing['generation']:.3f}s")
    print(f"    • 首字延迟: {timing['ttft_model']:.3f}s")
    print(f"    • 后续回复: {timing['subsequent']:.3f}s")
    print(f"  • 首字延迟: {timing['ttft']:.3f}s")
    print(f"  • 总延迟: {timing['total']:.3f}s")

    # 2. 查询处理
    if qp['intent_recognition']:
        print(f"\n🔍 查询处理:")
        print(f"  • 意图检测: {qp['intent_detection']}")
        if qp['intent_expansion']:
            print(f"  • 意图扩展:")
            for q in qp['intent_expansion']:
                print(f"      - {q['query']} (weight={q['weight']})")
        else:
            print(f"  • 意图扩展: 未启用意图扩展")
    else:
        print(f"\n🔍 未触发检索，直接回答")
    
    # 3. HyDE 假设回复
    if refs['hyde_responses']:
        print(f"\n🔮 HyDE 假设回复:")
        for q_idx, responses in sorted(refs['hyde_responses'].items()):
            for h_idx, response in enumerate(responses):
                print(f"  • Q{q_idx}-H{h_idx}: {response}")
    else:
        print(f"\n🔮 未启用 HyDE 召回")

    # 4. 召回的摘要
    if refs['summaries']:
        print(f"\n📚 召回摘要类别 ({len(refs['summaries'])}个):")
        for i, summary in enumerate(refs['summaries'], 1):
            print(f"  [{i}] {summary['metadata']['category']}（被 Query {summary['retrieved_by_queries']} 召回）")
            print(f"      关键词: {summary['metadata']['keywords']}")
            print(f"      评论数: {summary['metadata']['comment_count']}")
            print(f"      摘要: {summary['summary'][:100]}...")
    else:
        print(f"\n📚 未启用摘要召回")
    
    # 5. 召回的评论
    if refs['comments']:
        print(f"\n🏆 Top {len(refs['comments'])} 评论:")
        for comment in refs['comments']:
            print(f"  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
            
            # 根据是否有重排信息显示不同内容
            if 'final_rank' in comment:
                print(f"  综合排名: #{comment['final_rank']:>2} | 综合得分: {comment['final_score']:.4f}")
                print(f"  检索排名: #{comment['rrf_rank']:>2} | 检索得分: {comment['rrf_score']:.4f} | Rerank排名: #{comment['rerank_rank']:>2} | Rerank得分: {comment['rerank_score']:.4f}")
            else:
                print(f"  检索排名: #{comment['rrf_rank']:>2} | 检索得分: {comment['rrf_score']:.4f}")
            
            print(f"  评论ID: {comment['comment_id']}")
            print(f"  房型: {comment['metadata']['room_type']}（{comment['metadata']['fuzzy_room_type']}）")
            print(f"  评分: {comment['metadata']['score']:.1f} | 质量: {comment['metadata']['quality_score']} | 回复: {comment['metadata']['review_count']} | 点赞: {comment['metadata']['useful_count']} | 发布: {comment['metadata']['publish_date']}")
            if 'final_rank' in comment:
                feature = comment['feature_scores']
                print(f"  排序: {comment['final_score']:.4f} = 0.4 * {feature['relevance']:.3f}（相关）+ 0.25 * {feature['quality']:.3f}（质量）+ 0.05 * {feature['log_comment_len']:.3f}（长度）+ 0.05 * {feature['log_review_count']:.3f}（回复）+ 0.05 * {feature['log_useful_count']:.3f}（点赞）+ 0.2 * {feature['recency']:.3f}（时效）")
            print(f"  内容: {comment['comment']}")
            
            # 召回路由信息
            # 外部排序：按路由的最佳名次排序
            print(f"  召回路由:")
            route_list = []
            for route, hits in comment['route_ranks'].items():
                if not hits:
                    continue
                best_rank_in_route = min(hit['rank'] for hit in hits)
                route_list.append((best_rank_in_route, route, hits))
            route_list.sort(key=lambda x: x[0])
            
            # 遍历输出
            for _, route, hits in route_list:
                route_name = {'bm25': '文本', 'vector': '向量', 'reverse': '反向', 'hyde': 'HyDE'}.get(route, route)
                
                # 内部排序：在同一行里，按名次优先排序
                hits.sort(key=lambda x: (x['rank'], x['metadata'].get('query_idx', 0), x['metadata'].get('hyde_idx', 0)))
                hit_strs = []
                for hit in hits:
                    rank = hit['rank']
                    q_idx = hit['metadata'].get('query_idx', '?')
                    
                    info_str = f"第{rank}名(Q{q_idx}"
                    if route == 'hyde':
                        h_idx = hit['metadata'].get('hyde_idx', '?')
                        info_str += f"-H{h_idx}"
                    info_str += ")"
                    hit_strs.append(info_str)
                
                print(f"    • {route_name}: {', '.join(hit_strs)}")
    else:
        print(f"\n🏆 未召回评论")