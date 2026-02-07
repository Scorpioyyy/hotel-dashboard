// app/page.tsx - 评论浏览页面（首页）
'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CommentCard, CommentFilters, Pagination } from '@/components/comments';
import { ListSkeleton, ErrorDisplay, EmptyState } from '@/components/ui';
import { getComments } from '@/lib/api';
import { Comment, CommentFilters as Filters, StandardCategory } from '@/types';
import { formatNumber } from '@/lib/utils';

function CommentsPageContent() {
  const searchParams = useSearchParams();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [keyword, setKeyword] = useState('');

  // 从 URL 参数初始化过滤条件
  const getInitialFilters = useCallback((): Filters => {
    const initialFilters: Filters = {};

    // 日期范围
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    if (startDate || endDate) {
      initialFilters.dateRange = {
        start: startDate || '',
        end: endDate || '',
      };
    }

    // 评分（支持单个或多个，用逗号分隔）
    const scoresParam = searchParams.get('scores');
    if (scoresParam) {
      initialFilters.scores = scoresParam.split(',').map(Number);
    }

    // 类别
    const category = searchParams.get('category');
    if (category) {
      initialFilters.categories = [category as StandardCategory];
    }

    // 房型
    const roomType = searchParams.get('roomType');
    if (roomType) {
      initialFilters.roomTypes = [roomType];
    }

    // 出行类型
    const travelType = searchParams.get('travelType');
    if (travelType) {
      initialFilters.travelTypes = [travelType];
    }

    return initialFilters;
  }, [searchParams]);

  const [filters, setFilters] = useState<Filters>(() => getInitialFilters());

  // 当 URL 参数变化时更新过滤条件
  useEffect(() => {
    setFilters(getInitialFilters());
    setPage(1);
  }, [getInitialFilters]);

  // 加载评论
  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getComments(filters, page, 10);
      setComments(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载评论失败');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // 防抖搜索
  const debouncedSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeywordChange = (value: string) => {
    setKeyword(value);
    if (debouncedSearchRef.current) {
      clearTimeout(debouncedSearchRef.current);
    }
    debouncedSearchRef.current = setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        keyword: value || undefined
      }));
      setPage(1);
    }, 500);
  };

  const handleFiltersChange = (newFilters: Filters) => {
    // 如果清空了所有筛选条件，同时清空搜索框
    if (Object.keys(newFilters).length === 0) {
      setKeyword('');
      if (debouncedSearchRef.current) {
        clearTimeout(debouncedSearchRef.current);
      }
    }
    setFilters(newFilters);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    // 滚动 main 元素到顶部（因为 body 设置了 overflow-hidden）
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.scrollTop = 0;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">评论浏览</h1>
        <p className="mt-1 text-sm text-gray-500">
          浏览和筛选酒店评论，共 {formatNumber(total)} 条评论
        </p>
      </div>

      <div className="flex gap-8">
        {/* 左侧筛选栏 */}
        <div className="w-72 flex-shrink-0 hidden lg:block">
          <CommentFilters
            filters={filters}
            onChange={handleFiltersChange}
          />
        </div>

        {/* 右侧评论列表 */}
        <div className="flex-1 min-w-0">
          {/* 搜索和排序 */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            {/* 搜索框 */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={keyword}
                onChange={(e) => handleKeywordChange(e.target.value)}
                placeholder="搜索评论内容..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* 排序选择 */}
            <select
              value={`${filters.sortBy || 'publish_date'}-${filters.sortOrder || 'desc'}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split('-') as [Filters['sortBy'], Filters['sortOrder']];
                setFilters((prev) => ({ ...prev, sortBy, sortOrder }));
                setPage(1); // 切换排序时重置到第一页
              }}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="publish_date-desc">最新发布</option>
              <option value="publish_date-asc">最早发布</option>
              <option value="score-desc">评分最高</option>
              <option value="score-asc">评分最低</option>
              <option value="quality_score-desc">质量最高</option>
              <option value="useful_count-desc">点赞最多</option>
              <option value="review_count-desc">回复最多</option>
            </select>
          </div>

          {/* 评论列表 */}
          {error ? (
            <ErrorDisplay
              title="加载失败"
              message={error}
              onRetry={loadComments}
            />
          ) : loading ? (
            <ListSkeleton count={5} />
          ) : comments.length === 0 ? (
            <EmptyState
              title="暂无评论"
              message="没有找到符合条件的评论，请尝试调整筛选条件"
            />
          ) : (
            <>
              <div className="space-y-4 mb-8">
                {comments.map((comment) => (
                  <CommentCard key={comment._id} comment={comment} />
                ))}
              </div>

              {/* 分页 */}
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CommentsPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"><ListSkeleton count={5} /></div>}>
      <CommentsPageContent />
    </Suspense>
  );
}
