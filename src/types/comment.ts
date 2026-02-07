// types/comment.ts - 评论实体类型定义

export type StandardCategory =
  | '房间设施' | '公共设施' | '餐饮设施'
  | '前台服务' | '客房服务' | '退房/入住效率'
  | '交通便利性' | '周边配套' | '景观/朝向'
  | '性价比' | '价格合理性'
  | '整体满意度' | '安静程度' | '卫生状况';

export type CategoryGroup = '设施类' | '服务类' | '位置类' | '价格类' | '体验类';

export interface Comment {
  _id: string;
  comment: string;
  images: string[];
  score: number;
  star: number;  // 1-5星评分
  useful_count: number;
  publish_date: string;
  room_type: string;
  travel_type: string;
  review_count: number;
  fuzzy_room_type: string;
  quality_score: number;
  // 拆分的类别字段（用于数据库查询）
  category1: StandardCategory | null;
  category2: StandardCategory | null;
  category3: StandardCategory | null;
  // 聚合的类别数组（用于前端展示，从 category1/2/3 派生）
  categories: StandardCategory[];
}

export interface CommentListResponse {
  data: Comment[];
  pagination: Pagination;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
