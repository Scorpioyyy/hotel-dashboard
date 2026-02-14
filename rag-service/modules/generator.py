"""回复生成器：基于检索上下文生成最终回复"""

import time
from datetime import datetime
from dashscope import Generation

from modules.clients import DASHSCOPE_INTL_BASE_URL


class ResponseGenerator:
    """回复生成器：基于检索上下文生成最终回复"""

    def __init__(self, api_key: str, model: str = "deepseek-v3.2"):
        self.api_key = api_key
        self.model = model

    def _build_prompt(self, user_query: str, rewritten_queries=None,
                      ranked_comments=None, summaries=None,
                      need_retrieval: bool = True, today: datetime | None = None,
                      history: dict | None = None) -> str:
        """构建生成 prompt"""
        
        # 构建上一轮对话上下文
        history_context = ""
        if history and history.get("user") and history.get("assistant"):
            history_context = f"""
【上一轮对话】
用户：{history['user']}
助手：{history['assistant']}
"""

        if not need_retrieval:
            return f"""
你是广州花园酒店的智能客服助手。

{history_context}

用户问题：{user_query}

请直接回答用户的问题。注意：
- 如果是问候或闲聊，友好回应
- 如果是通用问题，给出简洁准确的回答
- 如果用户的问题是对上一轮对话的追问，请结合上下文理解用户意图
- 语气要亲切专业
- 使用Markdown格式输出，不得出现 "```markdown", "```" 标记
"""

        if not today:
            today = datetime.today()
        date = f"{today.year}年{today.month}月{today.day}日"

        # 构建改写 Query 上下文
        queries_context = ""
        if rewritten_queries:
            queries_context += "【问题解析】\n系统识别到用户可能关注以下方面：\n"
            queries_context += "\n".join(
                [f"- {q['query']}（意图权重为{q['weight']}）" for q in rewritten_queries]
            )
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
但**不得过于精确因为用户无法溯源**，也**不得告诉用户你引用了摘要**，**更不得将其当作评论引用输出“评论x”**。若摘要中的信息与用户问题无关，直接忽略即可，**不需要**做出任何额外说明。
"""

        return f"""
你是广州花园酒店的智能客服助手，需要基于用户评论为用户提供准确、高质量、有帮助、简洁的回答。

今天是：{date}

{history_context}

用户问题：{user_query}

{queries_context}

{comments_context}

{summaries_context}

【回答要求】
1. 综合以上评论信息，给出客观、全面的回答
2. 回答要有条理，突出重点
3. 如有正面和负面评价，都要提及，保持客观。注意给出的参考评论并不代表所有，切忌以偏概全给出"绝对化"的表述
4. 语气要专业、亲切
5. 回答长度适中，不要过于冗长
6. 不得大段或连续照抄用户评论，严禁全文都在引用用户评论却并没有思考提炼总结。相似内容能合并就合并，不要分开引用（合并后注意不得同时列出超过3条参考评论，使用"等"替代）
7. 一般来说越靠前的评论，其重要性越高，但你也可以自行判断自行选择
8. 不得在回复中罗列用户评论的具体日期，但当用户问题时效性敏感时，可以大致提一下参考评论的时间范围；当用户未表现出明显时效性需求时不要强行给出具体时间
9. 引用【相关用户评论】中某一条评论独特内容时应指出其序号评论几（**仅指出非常确定的引用，模棱两可的引用不要指出，务必保证引用序号绝对正确**），供用户参考；但针对参考评论总体（如"多数住客……"等内容）或【xx类别摘要】进行归纳总结时**无需**指出参考了哪些评论
10. 不得同时列出超过3条参考评论，即禁止诸如"（评论1/3/5/7）"的表述。如需同时引用超过3条评论，则应输出"（评论1/3等）"，而不是将其全部列出。优先给出排名靠前的评论引用
11. 如果评论信息不足以回答问题，诚实说明
12. 所有的回复必须仅依赖检索到的用户评论及摘要，不得出现自作主张的幻觉回复，例如帮用户查询酒店今日客房剩余、当前酒店相关活动推荐等一律不允许出现。你并没有接入酒店内部API无法完成这些事情因此禁止在回复中出现此类幻觉信息
13. 使用Markdown格式输出，不得出现 "```markdown", "```" 标记

用户问题：{user_query}

请给出你的回答：
"""

    def generate(self, user_query: str, rewritten_queries=None, ranked_comments=None,
                 summaries=None, need_retrieval: bool = True, print_response: bool = True,
                 today: datetime | None = None, history: dict | None = None) -> tuple[str, float, float, float]:
        """
        生成回复（流式输出）

        返回:
            (response_text, ttft_model, subsequent_time, generation_time)
        """
        start_time = time.time()
        prompt = self._build_prompt(user_query, rewritten_queries, ranked_comments,
                                    summaries, need_retrieval, today, history)

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
        first_token_time = 0

        for chunk in completion:
            if chunk.status_code != 200:
                raise RuntimeError(f"回复生成失败: {chunk.message}")

            message = chunk.output.choices[0].message
            if message.content:
                if not ttft_model:
                    ttft_model = time.time() - start_time
                    first_token_time = time.time()
                if print_response:
                    print(message.content, end="", flush=True)
                response_content += message.content

        if print_response and response_content:
            print()

        if ttft_model:
            subsequent_time = time.time() - first_token_time

        generation_time = time.time() - start_time

        return response_content, ttft_model, subsequent_time, generation_time

    def generate_stream(self, user_query: str, rewritten_queries=None, ranked_comments=None,
                        summaries=None, need_retrieval: bool = True,
                        today: datetime | None = None, history: dict | None = None):
        """
        流式生成回复（yield 每个 chunk）

        Yields:
            str: 每个文本 chunk
        """
        prompt = self._build_prompt(user_query, rewritten_queries, ranked_comments,
                                    summaries, need_retrieval, today, history)

        completion = Generation.call(
            api_key=self.api_key,
            model=self.model,
            prompt=prompt,
            temperature=0.7,
            result_format="message",
            stream=True,
            incremental_output=True
        )

        for chunk in completion:
            if chunk.status_code != 200:
                raise RuntimeError(f"回复生成失败: {chunk.message}")

            message = chunk.output.choices[0].message
            if message.content:
                yield message.content


class IntlResponseGenerator(ResponseGenerator):
    """国际版回复生成器（新加坡端点，OpenAI 兼容接口）

    继承 ResponseGenerator 复用 _build_prompt()，重写生成方法使用 OpenAI SDK。
    """

    def __init__(self, api_key: str, model: str = "qwen-plus-latest"):
        self.api_key = api_key
        self.model = model
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key, base_url=DASHSCOPE_INTL_BASE_URL)

    def generate(self, user_query: str, rewritten_queries=None, ranked_comments=None,
                 summaries=None, need_retrieval: bool = True, print_response: bool = True,
                 today: datetime | None = None, history: dict | None = None) -> tuple[str, float, float, float]:
        start_time = time.time()
        prompt = self._build_prompt(user_query, rewritten_queries, ranked_comments,
                                    summaries, need_retrieval, today, history)

        stream = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            stream=True,
        )

        response_content = ""
        ttft_model = 0
        subsequent_time = 0
        first_token_time = 0

        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                if not ttft_model:
                    ttft_model = time.time() - start_time
                    first_token_time = time.time()
                if print_response:
                    print(delta, end="", flush=True)
                response_content += delta

        if print_response and response_content:
            print()

        if ttft_model:
            subsequent_time = time.time() - first_token_time

        generation_time = time.time() - start_time
        return response_content, ttft_model, subsequent_time, generation_time

    def generate_stream(self, user_query: str, rewritten_queries=None, ranked_comments=None,
                        summaries=None, need_retrieval: bool = True,
                        today: datetime | None = None, history: dict | None = None):
        prompt = self._build_prompt(user_query, rewritten_queries, ranked_comments,
                                    summaries, need_retrieval, today, history)

        stream = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            stream=True,
        )

        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
