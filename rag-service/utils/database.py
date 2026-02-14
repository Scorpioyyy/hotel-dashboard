"""Insforge 数据库连接工具"""

import os
import pandas as pd
import requests


def get_all_comments_from_insforge() -> pd.DataFrame:
    """从 Insforge 数据库获取所有评论数据

    返回:
        pandas.DataFrame: 评论数据，以 _id 为索引
    """
    base_url = os.getenv("NEXT_PUBLIC_INSFORGE_BASE_URL")
    anon_key = os.getenv("NEXT_PUBLIC_INSFORGE_ANON_KEY")

    if not base_url or not anon_key:
        raise ValueError("缺少 Insforge 配置环境变量: NEXT_PUBLIC_INSFORGE_BASE_URL / NEXT_PUBLIC_INSFORGE_ANON_KEY")

    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {anon_key}",
        "Content-Type": "application/json"
    }

    all_data = []
    batch_size = 1000
    offset = 0

    print("正在从 Insforge 数据库获取评论数据...")

    while True:
        # Insforge SDK 使用 /api/database/records/{table} 端点
        # PostgREST 风格查询参数: select=*, Range header 分页
        url = f"{base_url}/api/database/records/comments?select=*"
        range_headers = {
            **headers,
            "Range-Unit": "items",
            "Range": f"{offset}-{offset + batch_size - 1}",
            "Prefer": "count=exact"
        }
        response = requests.get(url, headers=range_headers)

        if response.status_code not in (200, 206):
            raise RuntimeError(f"Insforge API 调用失败: {response.status_code} {response.text}")

        data = response.json()
        if not data:
            break

        all_data.extend(data)
        print(f"  已获取 {len(all_data)} 条评论...")

        if len(data) < batch_size:
            break
        offset += batch_size

    df = pd.DataFrame(all_data)

    if '_id' in df.columns:
        df.set_index('_id', inplace=True)

    print(f"✅ 成功加载 {len(df)} 条评论数据")
    return df
