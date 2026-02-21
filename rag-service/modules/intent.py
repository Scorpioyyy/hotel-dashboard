"""意图处理模块：识别、检测、扩展、HyDE 生成"""

import json
import time
from dashscope import Generation


class IntentRecognizer:
    """意图识别器：判断问题是否需要检索知识库"""

    def __init__(self, api_key: str, model: str = "tongyi-intent-detect-v3"):
        self.api_key = api_key
        self.model = model

        self.intent_dict = {
            "RETRIEVAL": "需要检索酒店评论知识库才能回答的问题（如询问酒店设施、服务、位置、价格等具体信息）",
            "DIRECT": "可以直接回答的通用问题（如问候、闲聊、常识性问题等，不涉及酒店具体信息）"
        }

    def recognize(self, query: str) -> str:
        """识别用户意图，返回 True 表示需要检索"""
        intent_string = json.dumps(self.intent_dict, ensure_ascii=False)
        system_prompt = f"""You are Qwen, created by Alibaba Cloud. You are a helpful assistant.
You should choose one tag from the tag list:
{intent_string}
Just reply with the chosen tag."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": query}
        ]

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
                if i < 1:
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
                if i < 1:
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
                if i < 1:
                    time.sleep(0.1)
                    continue

        print("假设性回复生成失败，已返回原查询")
        return [query]
