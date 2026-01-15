// types/stats.ts - 统计数据类型定义

import { StandardCategory, CategoryGroup } from './comment';

export interface DashboardStats {
  scoreDistribution: ScoreDistribution[];
  timeTrend: TimeTrend[];
  roomTypeStats: RoomTypeStats[];
  travelTypeStats: TravelTypeStats[];
  categoryStats: CategoryStats[];
  qualityDistribution: QualityDistribution[];
  userActivityStats: UserActivityStats[];
  totalCount: number;
}

export interface ScoreDistribution {
  score: number;
  count: number;
  percentage: number;
}

export interface TimeTrend {
  date: string;
  count: number;
  avgScore: number;
}

export interface RoomTypeStats {
  roomType: string;
  roomTypeFuzzy: string;
  count: number;
  avgScore: number;
}

export interface TravelTypeStats {
  travelType: string;
  count: number;
  avgScore: number;
}

export interface CategoryStats {
  category: StandardCategory;
  group: CategoryGroup;
  count: number;
  percentage: number;
}

export interface QualityDistribution {
  qualityScore: number;
  count: number;
  percentage: number;
}

export interface UserActivityStats {
  reviewCountRange: string;
  count: number;
  percentage: number;
}
