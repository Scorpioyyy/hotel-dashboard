"""格式化输出函数"""


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
            print(f"  评分: {comment['metadata']['score']:.1f} | 质量: {comment['metadata']['quality_score']} | 评论: {comment['metadata']['review_count']} | 点赞: {comment['metadata']['useful_count']} | 发布: {comment['metadata']['publish_date']}")
            print(f"  内容: {comment['comment']}")

            print(f"  召回路由:")
            route_list = []
            for route, hits in comment['route_ranks'].items():
                if not hits:
                    continue
                best_rank_in_route = min(hit['rank'] for hit in hits)
                route_list.append((best_rank_in_route, route, hits))
            route_list.sort(key=lambda x: x[0])

            for _, route, hits in route_list:
                route_name = {'bm25': '文本', 'vector': '向量', 'reverse': '反向', 'hyde': 'HyDE'}.get(route, route)
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
            print(f"  • 排序: {rk['total']:.3f}s（Rerank {rk['rerank']:.3f}s + 排序 {rk['scoring']:.3f}s）")
        else:
            print(f"  • 排序: 0.000s")

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

            if 'final_rank' in comment:
                print(f"  综合排名: #{comment['final_rank']:>2} | 综合得分: {comment['final_score']:.4f}")
                print(f"  检索排名: #{comment['rrf_rank']:>2} | 检索得分: {comment['rrf_score']:.4f} | Rerank排名: #{comment['rerank_rank']:>2} | Rerank得分: {comment['rerank_score']:.4f}")
            else:
                print(f"  检索排名: #{comment['rrf_rank']:>2} | 检索得分: {comment['rrf_score']:.4f}")

            print(f"  评论ID: {comment['comment_id']}")
            print(f"  房型: {comment['metadata']['room_type']}（{comment['metadata']['fuzzy_room_type']}）")
            print(f"  评分: {comment['metadata']['score']:.1f} | 质量: {comment['metadata']['quality_score']} | 评论: {comment['metadata']['review_count']} | 点赞: {comment['metadata']['useful_count']} | 发布: {comment['metadata']['publish_date']}")
            if 'final_rank' in comment:
                feature = comment['feature_scores']
                print(f"  排序: {comment['final_score']:.4f} = 0.4 * {feature['relevance']:.3f}（相关）+ 0.25 * {feature['quality']:.3f}（质量）+ 0.05 * {feature['log_comment_len']:.3f}（长度）+ 0.05 * {feature['log_review_count']:.3f}（评论）+ 0.05 * {feature['log_useful_count']:.3f}（点赞）+ 0.2 * {feature['recency']:.3f}（时效）")
            print(f"  内容: {comment['comment']}")

            print(f"  召回路由:")
            route_list = []
            for route, hits in comment['route_ranks'].items():
                if not hits:
                    continue
                best_rank_in_route = min(hit['rank'] for hit in hits)
                route_list.append((best_rank_in_route, route, hits))
            route_list.sort(key=lambda x: x[0])

            for _, route, hits in route_list:
                route_name = {'bm25': '文本', 'vector': '向量', 'reverse': '反向', 'hyde': 'HyDE'}.get(route, route)
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
