"""LLM 与 Embedding 客户端封装"""

from dashscope import Generation, TextEmbedding


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
