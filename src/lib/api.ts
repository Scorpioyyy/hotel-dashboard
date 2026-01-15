// lib/api.ts - API 客户端封装
import { db } from './insforge';
import type { Comment, CommentFilters, PaginatedResponse, StandardCategory } from '@/types';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './constants';

// 获取评论列表（支持筛选和分页）
export async function getComments(
  filters: CommentFilters = {},
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE
): Promise<PaginatedResponse<Comment>> {
  const limit = Math.min(pageSize, MAX_PAGE_SIZE);
  const offset = (page - 1) * limit;

  let query = db.from('comments').select('*', { count: 'exact' });

  // 应用数据库支持的筛选条件
  if (filters.dateRange?.start) {
    query = query.gte('publish_date', filters.dateRange.start);
  }
  if (filters.dateRange?.end) {
    query = query.lte('publish_date', filters.dateRange.end);
  }
  if (filters.scoreRange?.min) {
    query = query.gte('score', filters.scoreRange.min);
  }
  if (filters.scoreRange?.max) {
    query = query.lte('score', filters.scoreRange.max);
  }
  if (filters.roomTypes && filters.roomTypes.length > 0) {
    query = query.in('room_type_fuzzy', filters.roomTypes);
  }
  if (filters.travelTypes && filters.travelTypes.length > 0) {
    query = query.in('travel_type', filters.travelTypes);
  }
  if (filters.qualityScoreMin) {
    query = query.gte('quality_score', filters.qualityScoreMin);
  }
  if (filters.keyword) {
    query = query.ilike('comment', `%${filters.keyword}%`);
  }

  // 类别筛选：使用 OR 条件查询三个字段
  // 构建 OR 条件字符串: category1.in.(cat1,cat2),category2.in.(cat1,cat2),category3.in.(cat1,cat2)
  if (filters.categories && filters.categories.length > 0) {
    const cats = filters.categories.join(',');
    const orCondition = `category1.in.(${cats}),category2.in.(${cats}),category3.in.(${cats})`;
    query = query.or(orCondition);
  }

  // 排序
  const orderField = filters.sortBy || 'publish_date';
  const orderDir = filters.sortOrder || 'desc';
  query = query.order(orderField, { ascending: orderDir === 'asc' });

  // 分页
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`获取评论失败: ${error.message}`);
  }

  const comments = (data || []).map(parseComment);

  return {
    data: comments,
    total: count || 0,
    page,
    pageSize: limit,
    totalPages: Math.ceil((count || 0) / limit)
  };
}

// 获取单条评论
export async function getCommentById(id: string): Promise<Comment | null> {
  const { data, error } = await db
    .from('comments')
    .select('*')
    .eq('_id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`获取评论失败: ${error.message}`);
  }

  return parseComment(data);
}

// 获取高质量评论（用于 AI 问答）
export async function getHighQualityComments(
  categories: string[] = [],
  limit = 5
): Promise<Comment[]> {
  let query = db
    .from('comments')
    .select('*')
    .gte('quality_score', 8)
    .order('quality_score', { ascending: false })
    .limit(limit);

  // 类别筛选
  if (categories.length > 0) {
    const cats = categories.join(',');
    const orCondition = `category1.in.(${cats}),category2.in.(${cats}),category3.in.(${cats})`;
    query = query.or(orCondition);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`获取高质量评论失败: ${error.message}`);
  }

  return (data || []).map(parseComment);
}

// 获取统计数据
export async function getStats() {
  // 分批获取所有数据（绕过默认 1000 条限制）
  const allData: Record<string, unknown>[] = [];
  const batchSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await db
      .from('comments')
      .select('*')
      .range(offset, offset + batchSize - 1);

    if (error) {
      throw new Error(`获取统计数据失败: ${error.message}`);
    }

    if (data && data.length > 0) {
      allData.push(...data);
      offset += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  const comments = allData.map(parseComment);
  return computeStats(comments);
}

// 计算统计数据
function computeStats(comments: Comment[]) {
  const total = comments.length;

  // 评分分布
  const scoreDistribution = [1, 2, 3, 4, 5].map(score => ({
    score,
    count: comments.filter(c => c.score === score).length
  }));

  // 月度趋势
  const monthlyTrend = new Map<string, { count: number; avgScore: number; scores: number[] }>();
  comments.forEach(c => {
    const month = c.publish_date.substring(0, 7);
    if (!monthlyTrend.has(month)) {
      monthlyTrend.set(month, { count: 0, avgScore: 0, scores: [] });
    }
    const entry = monthlyTrend.get(month)!;
    entry.count++;
    entry.scores.push(c.score);
  });
  const monthlyData = Array.from(monthlyTrend.entries())
    .map(([month, data]) => ({
      month,
      count: data.count,
      avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // 类别分布（从三个字段聚合）
  const categoryCount = new Map<string, number>();
  comments.forEach(c => {
    c.categories.forEach(cat => {
      categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1);
    });
  });
  const categoryDistribution = Array.from(categoryCount.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // 房型分布
  const roomTypeCount = new Map<string, number>();
  comments.forEach(c => {
    roomTypeCount.set(c.room_type_fuzzy, (roomTypeCount.get(c.room_type_fuzzy) || 0) + 1);
  });
  const roomTypeDistribution = Array.from(roomTypeCount.entries())
    .map(([roomType, count]) => ({ roomType, count }))
    .sort((a, b) => b.count - a.count);

  // 出行类型分布
  const travelTypeCount = new Map<string, number>();
  comments.forEach(c => {
    travelTypeCount.set(c.travel_type, (travelTypeCount.get(c.travel_type) || 0) + 1);
  });
  const travelTypeDistribution = Array.from(travelTypeCount.entries())
    .map(([travelType, count]) => ({ travelType, count }))
    .sort((a, b) => b.count - a.count);

  // 高质量评论数
  const highQualityCount = comments.filter(c => c.quality_score >= 8).length;

  // 平均分
  const avgScore = comments.reduce((sum, c) => sum + c.score, 0) / total;

  return {
    total,
    avgScore,
    highQualityCount,
    scoreDistribution,
    monthlyTrend: monthlyData,
    categoryDistribution,
    roomTypeDistribution,
    travelTypeDistribution
  };
}

// 解析数据库返回的评论数据
function parseComment(row: Record<string, unknown>): Comment {
  // 从三个字段构建 categories 数组
  const categories: StandardCategory[] = [];
  if (row.category1) categories.push(row.category1 as StandardCategory);
  if (row.category2) categories.push(row.category2 as StandardCategory);
  if (row.category3) categories.push(row.category3 as StandardCategory);

  return {
    _id: row._id as string,
    comment: row.comment as string,
    images: typeof row.images === 'string' ? JSON.parse(row.images) : (row.images as string[]) || [],
    score: row.score as 1 | 2 | 3 | 4 | 5,
    useful_count: row.useful_count as number,
    publish_date: row.publish_date as string,
    room_type: row.room_type as string,
    travel_type: row.travel_type as string,
    review_count: row.review_count as number,
    room_type_fuzzy: row.room_type_fuzzy as string,
    quality_score: row.quality_score as number,
    category1: (row.category1 as StandardCategory) || null,
    category2: (row.category2 as StandardCategory) || null,
    category3: (row.category3 as StandardCategory) || null,
    categories
  };
}
