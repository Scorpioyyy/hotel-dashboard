// app/comments/page.tsx - 评论浏览页面
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { CommentCard, CommentFilters, Pagination } from '@/components/comments';
import { ListSkeleton, ErrorDisplay, EmptyState } from '@/components/ui';
import { getComments, getStats } from '@/lib/api';
import { Comment, CommentFilters as Filters } from '@/types';
import { formatNumber } from '@/lib/utils';

export default function CommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [keyword, setKeyword] = useState('');

  // 获取筛选选项
  const [roomTypes, setRoomTypes] = useState<string[]>([]);
  const [travelTypes, setTravelTypes] = useState<string[]>([]);

  // 加载筛选选项
  useEffect(() => {
    async function loadOptions() {
      try {
        const stats = await getStats();
        setRoomTypes(stats.roomTypeDistribution.map((r) => r.roomType));
        setTravelTypes(stats.travelTypeDistribution.map((t) => t.travelType));
      } catch (err) {
        console.error('加载筛选选项失败:', err);
      }
    }
    loadOptions();
  }, []);

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
    setFilters(newFilters);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
            roomTypes={roomTypes}
            travelTypes={travelTypes}
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
              }}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="publish_date-desc">最新发布</option>
              <option value="publish_date-asc">最早发布</option>
              <option value="score-desc">评分最高</option>
              <option value="score-asc">评分最低</option>
              <option value="quality_score-desc">质量最高</option>
              <option value="useful_count-desc">最有帮助</option>
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
