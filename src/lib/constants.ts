// lib/constants.ts - 常量定义

import { StandardCategory, CategoryGroup } from '@/types/comment';

// 14 个标准小类
export const STANDARD_CATEGORIES: StandardCategory[] = [
  '房间设施', '公共设施', '餐饮设施',
  '前台服务', '客房服务', '退房/入住效率',
  '交通便利性', '周边配套', '景观/朝向',
  '性价比', '价格合理性',
  '整体满意度', '安静程度', '卫生状况'
] as const;

// 类别分组映射
export const CATEGORY_GROUPS: Record<CategoryGroup, StandardCategory[]> = {
  '设施类': ['房间设施', '公共设施', '餐饮设施'],
  '服务类': ['前台服务', '客房服务', '退房/入住效率'],
  '位置类': ['交通便利性', '周边配套', '景观/朝向'],
  '价格类': ['价格合理性', '性价比'],
  '体验类': ['整体满意度', '安静程度', '卫生状况']
};

// 获取类别所属的大类
export function getCategoryGroup(category: StandardCategory): CategoryGroup {
  for (const [group, categories] of Object.entries(CATEGORY_GROUPS)) {
    if (categories.includes(category)) {
      return group as CategoryGroup;
    }
  }
  return '体验类'; // 默认
}

// 房型列表
export const ROOM_TYPES = [
  '大床房',
  '双床房',
  '套房',
  '主题房'
] as const;

// 出行类型列表（不包含"其他"）
export const TRAVEL_TYPES = [
  '家庭亲子',
  '商务出差',
  '朋友出游',
  '情侣出游',
  '独自旅行',
  '代人预订'
] as const;

// 高质量评论阈值
export const HIGH_QUALITY_THRESHOLD = 8;

// 分页默认值
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// 问答引用评论数量
export const QA_REFERENCE_MIN = 3;
export const QA_REFERENCE_MAX = 5;

// 评分范围
export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

// 质量分范围
export const QUALITY_SCORE_MIN = 5;
export const QUALITY_SCORE_MAX = 10;
