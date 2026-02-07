// components/ui/StarRating.tsx - 星级评分组件
'use client';

import { cn } from '@/lib/utils';

interface Props {
  star: number;  // 1-5 星评分
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
};

// 根据星级获取颜色
function getStarColor(star: number): string {
  if (star >= 4) return 'text-green-600';
  if (star >= 3) return 'text-yellow-600';
  return 'text-red-600';
}

export function StarRating({ star, size = 'md', className }: Props) {
  const fullStars = star;
  const emptyStars = 5 - star;

  return (
    <span className={cn('inline-flex items-center', sizeClasses[size], getStarColor(star), 'leading-none', className)} style={{ transform: 'translateY(-1px)' }}>
      {/* 实心星 */}
      {Array.from({ length: fullStars }).map((_, i) => (
        <span key={`full-${i}`}>★</span>
      ))}
      {/* 空心星 */}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <span key={`empty-${i}`} className="text-gray-300">★</span>
      ))}
    </span>
  );
}
