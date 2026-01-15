// app/page.tsx - 数据可视化看板主页
'use client';

import { useEffect, useState } from 'react';
import { StatCard, ChartSkeleton, StatCardSkeleton, ErrorDisplay } from '@/components/ui';
import {
  ScoreDistributionChart,
  MonthlyTrendChart,
  CategoryDistributionChart,
  RoomTypeChart,
  TravelTypeChart
} from '@/components/charts';
import { getStats } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

interface DashboardStats {
  total: number;
  avgScore: number;
  highQualityCount: number;
  scoreDistribution: { score: number; count: number }[];
  monthlyTrend: { month: string; count: number; avgScore: number }[];
  categoryDistribution: { category: string; count: number }[];
  roomTypeDistribution: { roomType: string; count: number }[];
  travelTypeDistribution: { travelType: string; count: number }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        setError(null);
        const data = await getStats();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载数据失败');
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ErrorDisplay
          title="数据加载失败"
          message={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">数据概览</h1>
        <p className="mt-1 text-sm text-gray-500">
          广州花园酒店评论数据分析看板
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : stats ? (
          <>
            <StatCard
              title="评论总数"
              value={formatNumber(stats.total)}
              subtitle="全部评论"
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              }
            />
            <StatCard
              title="平均评分"
              value={stats.avgScore.toFixed(2)}
              subtitle="满分 5 分"
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              }
            />
            <StatCard
              title="高质量评论"
              value={formatNumber(stats.highQualityCount)}
              subtitle={`占比 ${((stats.highQualityCount / stats.total) * 100).toFixed(1)}%`}
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              }
            />
            <StatCard
              title="话题类别"
              value={stats.categoryDistribution.length}
              subtitle="个标签分类"
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              }
            />
          </>
        ) : null}
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {loading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : stats ? (
          <>
            <ScoreDistributionChart data={stats.scoreDistribution} />
            <MonthlyTrendChart data={stats.monthlyTrend} />
          </>
        ) : null}
      </div>

      {/* 类别分布 - 全宽 */}
      <div className="mb-8">
        {loading ? (
          <ChartSkeleton height={400} />
        ) : stats ? (
          <CategoryDistributionChart data={stats.categoryDistribution} />
        ) : null}
      </div>

      {/* 房型和出行类型分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : stats ? (
          <>
            <RoomTypeChart data={stats.roomTypeDistribution} />
            <TravelTypeChart data={stats.travelTypeDistribution} />
          </>
        ) : null}
      </div>
    </div>
  );
}
