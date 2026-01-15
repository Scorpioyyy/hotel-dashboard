// lib/utils.ts - 工具函数

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// 合并 Tailwind 类名
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 格式化日期
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// 格式化日期为 YYYY-MM-DD
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

// 获取相对时间
export function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`;
  return `${Math.floor(diffDays / 365)}年前`;
}

// 截断文本
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

// 生成评分星星
export function getScoreStars(score: number): string {
  return '★'.repeat(score) + '☆'.repeat(5 - score);
}

// 获取评分颜色类名
export function getScoreColor(score: number): string {
  if (score >= 4) return 'text-green-600';
  if (score >= 3) return 'text-yellow-600';
  return 'text-red-600';
}

// 获取质量分颜色类名
export function getQualityColor(qualityScore: number): string {
  if (qualityScore >= 8) return 'text-green-600 bg-green-50';
  if (qualityScore >= 6) return 'text-yellow-600 bg-yellow-50';
  return 'text-gray-600 bg-gray-50';
}

// 格式化数字（添加千分位）
export function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN');
}

// 格式化百分比
export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%';
  return ((value / total) * 100).toFixed(1) + '%';
}

// 防抖函数
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// 生成唯一 ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// 解析查询参数
export function parseQueryParams<T extends Record<string, string>>(
  searchParams: URLSearchParams,
  defaults: T
): T {
  const result = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const value = searchParams.get(key);
    if (value !== null) {
      (result as Record<string, string>)[key] = value;
    }
  }
  return result;
}

// 构建查询字符串
export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  return searchParams.toString();
}

// 图表颜色配置
export const CHART_COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
  '#F97316', // orange-500
  '#6366F1', // indigo-500
  '#14B8A6', // teal-500
  '#A855F7', // purple-500
  '#F43F5E', // rose-500
  '#22C55E', // green-500
];

// 获取图表颜色
export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
