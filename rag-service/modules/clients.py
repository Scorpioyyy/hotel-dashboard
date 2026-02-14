"""LLM 与 Embedding 客户端封装"""

from dashscope import Generation, TextEmbedding

# DashScope 国际版（新加坡）OpenAI 兼容端点
DASHSCOPE_INTL_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"


class LLMClient:
    """Qwen 客户端封装（北京端点，dashscope SDK）"""

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


class EmbeddingClient:
    """文本嵌入客户端封装（北京端点，dashscope SDK）"""

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


# ─── 国际版客户端（新加坡端点，OpenAI 兼容接口） ───

class IntlLLMClient:
    """国际版 LLM 客户端（新加坡端点，OpenAI 兼容接口）"""

    def __init__(self, api_key: str, model: str = "qwen-plus", json: bool = False):
        from openai import OpenAI, NOT_GIVEN
        self.client = OpenAI(api_key=api_key, base_url=DASHSCOPE_INTL_BASE_URL)
        self.model = model
        self.json = json
        self._NOT_GIVEN = NOT_GIVEN

    def generate(self, prompt: str, temperature: float = 0.7) -> str:
        """生成文本（接口与 LLMClient 一致）"""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            response_format={"type": "json_object"} if self.json else self._NOT_GIVEN,
        )
        return response.choices[0].message.content.strip()


class IntlEmbeddingClient:
    """国际版 Embedding 客户端（新加坡端点，OpenAI 兼容接口）"""

    def __init__(self, api_key: str, model: str = "text-embedding-v4", dimension: int = 1024):
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key, base_url=DASHSCOPE_INTL_BASE_URL)
        self.model = model
        self.dimension = dimension

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """批量生成 embedding（接口与 EmbeddingClient 一致）"""
        response = self.client.embeddings.create(
            model=self.model,
            input=texts,
            dimensions=self.dimension,
        )
        return [item.embedding for item in response.data]
