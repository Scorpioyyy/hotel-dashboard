// types/filters.ts - 筛选条件类型定义

import { StandardCategory } from './comment';

export interface FilterParams {
  dateRange?: {
    start: string;
    end: string;
  };
  scores?: number[];
  roomTypes?: string[];
  travelTypes?: string[];
  categories?: StandardCategory[];
  minQualityScore?: number;
  page?: number;
  pageSize?: number;
}

export interface FilterOptions {
  roomTypes: string[];
  travelTypes: string[];
  categories: StandardCategory[];
  dateRange: {
    min: string;
    max: string;
  };
}

// API 筛选参数类型
export interface CommentFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  scoreRange?: {
    min: number;
    max: number;
  };
  roomTypes?: string[];
  travelTypes?: string[];
  categories?: StandardCategory[];
  qualityScoreMin?: number;
  keyword?: string;
  sortBy?: 'publish_date' | 'score' | 'quality_score' | 'useful_count';
  sortOrder?: 'asc' | 'desc';
}

// 分页响应类型
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
