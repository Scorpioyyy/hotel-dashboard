"""RAG 系统模块化拆分验证脚本

验证所有模块导入正常、类实例化正常。
运行方式: cd rag-service && python test_rag.py
"""

import os
import sys
from pathlib import Path

# 确保从 rag-service 目录运行
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv()


def test_imports():
    """验证所有模块可以正常导入"""
    print("=" * 50)
    print("1. 测试模块导入")
    print("=" * 50)

    from config import TODAY, EXACT_ROOM_TYPES, FUZZY_ROOM_TYPES
    print(f"  ✅ config: TODAY={TODAY}, {len(EXACT_ROOM_TYPES)} 精确房型, {len(FUZZY_ROOM_TYPES)} 模糊房型")

    from modules.clients import LLMClient, EmbeddingClient
    print(f"  ✅ clients: LLMClient, EmbeddingClient")

    from modules.index import InvertedIndex
    print(f"  ✅ index: InvertedIndex")

    from modules.intent import IntentRecognizer, IntentDetector, IntentExpander, HyDEGenerator
    print(f"  ✅ intent: IntentRecognizer, IntentDetector, IntentExpander, HyDEGenerator")

    from modules.retriever import HybridRetriever
    print(f"  ✅ retriever: HybridRetriever")

    from modules.ranker import Reranker, MultiFactorRanker
    print(f"  ✅ ranker: Reranker, MultiFactorRanker")

    from modules.generator import ResponseGenerator
    print(f"  ✅ generator: ResponseGenerator")

    from modules.rag_system import HotelReviewRAG
    print(f"  ✅ rag_system: HotelReviewRAG")

    from utils.formatting import print_retrieval_results, print_rag_result
    print(f"  ✅ formatting: print_retrieval_results, print_rag_result")

    from utils.database import get_all_comments_from_insforge
    print(f"  ✅ database: get_all_comments_from_insforge")

    print(f"\n  所有模块导入成功！")
    return True


def test_rag_system():
    """验证 RAG 系统初始化和查询"""
    print("\n" + "=" * 50)
    print("2. 测试 RAG 系统初始化与查询")
    print("=" * 50)

    api_key = os.getenv("DASHSCOPE_API_KEY")
    dashvector_api_key = os.getenv("DASHVECTOR_API_KEY")
    dashvector_endpoint = os.getenv("DASHVECTOR_HOTEL_ENDPOINT")

    if not all([api_key, dashvector_api_key, dashvector_endpoint]):
        print("  ⚠️ 缺少 API Key 环境变量，跳过系统测试")
        return False

    data_dir = Path(__file__).parent / "data"

    if not (data_dir / "inverted_index.pkl").exists():
        print("  ⚠️ 倒排索引文件不存在，跳过系统测试")
        return False

    if not (data_dir / "chroma_db").exists():
        print("  ⚠️ ChromaDB 数据目录不存在，跳过系统测试")
        return False

    from modules.rag_system import HotelReviewRAG
    from utils.formatting import print_rag_result

    print("  正在初始化 RAG 系统...")
    rag = HotelReviewRAG(
        api_key=api_key,
        dashvector_api_key=dashvector_api_key,
        dashvector_endpoint=dashvector_endpoint,
        data_dir=data_dir
    )
    print("  ✅ RAG 系统初始化成功！")

    # 测试查询
    test_query = "酒店的早餐怎么样？"
    print(f"\n  测试查询: {test_query}")
    print("-" * 50)

    result = rag.query(
        test_query,
        enable_hyde=False,
        print_response=True
    )

    print("-" * 50)
    print_rag_result(result)

    print(f"\n  ✅ RAG 查询测试完成！")
    return True


if __name__ == "__main__":
    success = test_imports()

    if success and "--full" in sys.argv:
        test_rag_system()
    elif success:
        print("\n💡 运行 `python test_rag.py --full` 进行完整 RAG 系统测试")
