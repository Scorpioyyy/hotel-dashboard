# Data Model: 广州花园酒店评论数据分析系统

**Date**: 2026-01-14
**Branch**: `001-review-dashboard`

## 实体关系图

```
┌─────────────────────────────────────────────────────────────┐
│                        Comment                               │
├─────────────────────────────────────────────────────────────┤
│ _id: string (PK)                                            │
│ comment: string                                              │
│ images: string[]                                             │
│ score: integer (1-5)                                         │
│ useful_count: integer                                        │
│ publish_date: date                                           │
│ room_type: string                                            │
│ travel_type: string                                          │
│ review_count: integer                                        │
│ room_type_fuzzy: string                                      │
│ quality_score: integer (5-10)                                │
│ categories: string[] (filtered to 14 standard categories)   │
└─────────────────────────────────────────────────────────────┘
```

## 实体详细定义

### Comment (评论)

核心数据实体，存储酒店评论信息。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `_id` | string | PK, NOT NULL | 评论唯一标识符 |
| `comment` | string | NOT NULL | 评论文本内容 |
| `images` | string[] | DEFAULT [] | 评论配图 URL 列表 |
| `score` | integer | NOT NULL, 1-5 | 酒店评分 |
| `useful_count` | integer | DEFAULT 0 | 被点赞次数 |
| `publish_date` | date | NOT NULL | 发布日期 |
| `room_type` | string | NOT NULL | 具体房型名称 |
| `travel_type` | string | NOT NULL | 旅行类型 |
| `review_count` | integer | NOT NULL | 用户累计评论数 |
| `room_type_fuzzy` | string | NOT NULL | 房型模糊分类 |
| `quality_score` | integer | NOT NULL, 5-10 | 内容质量分 |
| `categories` | string[] | DEFAULT [] | 评论类别（仅 14 个标准小类） |

### 索引设计

| 索引名称 | 字段 | 类型 | 用途 |
|----------|------|------|------|
| `idx_publish_date` | `publish_date` | B-Tree | 时间范围查询 |
| `idx_score` | `score` | B-Tree | 评分筛选 |
| `idx_room_type_fuzzy` | `room_type_fuzzy` | B-Tree | 房型筛选 |
| `idx_travel_type` | `travel_type` | B-Tree | 旅行类型筛选 |
| `idx_quality_score` | `quality_score` | B-Tree | 高质量评论筛选 |
| `idx_comment_fulltext` | `comment` | Full-Text | 问答关键词检索 |

## TypeScript 类型定义

### 评论实体类型

```typescript
// types/comment.ts

export interface Comment {
  _id: string;
  comment: string;
  images: string[];
  score: 1 | 2 | 3 | 4 | 5;
  useful_count: number;
  publish_date: string; // ISO date string
  room_type: string;
  travel_type: string;
  review_count: number;
  room_type_fuzzy: string;
  quality_score: number; // 5-10
  categories: StandardCategory[];
}

export type StandardCategory =
  | '房间设施' | '公共设施' | '餐饮设施'
  | '前台服务' | '客房服务' | '退房/入住效率'
  | '交通便利性' | '周边配套' | '景观/朝向'
  | '性价比' | '价格合理性'
  | '整体满意度' | '安静程度' | '卫生状况';

export type CategoryGroup = '设施类' | '服务类' | '位置类' | '价格类' | '体验类';
```

### 统计数据类型

```typescript
// types/stats.ts

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
  date: string; // YYYY-MM
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
  reviewCountRange: string; // e.g., "1-5", "6-10", "11+"
  count: number;
  percentage: number;
}
```

### 筛选条件类型

```typescript
// types/filters.ts

export interface FilterParams {
  dateRange?: {
    start: string; // ISO date
    end: string;   // ISO date
  };
  scores?: number[];
  roomTypes?: string[];
  travelTypes?: string[];
  categories?: StandardCategory[];
  minQualityScore?: number;
  page?: number;
  pageSize?: number;
}
```

### 问答类型

```typescript
// types/qa.ts

export interface QARequest {
  question: string;
}

export interface QAResponse {
  answer: string;
  references: CommentReference[];
  hasRelevantData: boolean;
}

export interface CommentReference {
  _id: string;
  comment: string;
  score: number;
  publish_date: string;
  room_type: string;
  relevanceScore: number; // 0-1
}
```

## 数据验证规则

### Comment 验证

```typescript
// lib/validators.ts

import { STANDARD_CATEGORIES } from './constants';

export function validateComment(data: unknown): Comment {
  // 必填字段检查
  if (!data._id || typeof data._id !== 'string') {
    throw new Error('Invalid _id');
  }
  if (!data.comment || typeof data.comment !== 'string') {
    throw new Error('Invalid comment');
  }
  if (typeof data.score !== 'number' || data.score < 1 || data.score > 5) {
    throw new Error('Invalid score');
  }

  // 过滤非标准类别
  const categories = Array.isArray(data.categories)
    ? data.categories.filter((c: string) => STANDARD_CATEGORIES.includes(c))
    : [];

  // 解析日期
  const publishDate = parseChineseDate(data.publish_date);

  return {
    _id: data._id,
    comment: data.comment,
    images: Array.isArray(data.images) ? data.images : [],
    score: data.score,
    useful_count: data.useful_count ?? 0,
    publish_date: publishDate.toISOString().split('T')[0],
    room_type: data.room_type ?? '',
    travel_type: data.travel_type ?? '',
    review_count: parseInt(String(data.review_count).replace(/\D/g, '')) || 0,
    room_type_fuzzy: data.room_type_fuzzy ?? '',
    quality_score: data.quality_score ?? 5,
    categories
  };
}
```

## 数据转换

### CSV 导入映射

| CSV 列名 | 数据库字段 | 转换规则 |
|----------|------------|----------|
| `_id` | `_id` | 直接映射 |
| `comment` | `comment` | 直接映射 |
| `images` | `images` | 解析 JSON 数组字符串 |
| `score` | `score` | 转为整数 |
| `useful_count` | `useful_count` | 转为整数 |
| `publish_date` | `publish_date` | 解析"YYYY年M月D日"格式 |
| `room_type` | `room_type` | 直接映射 |
| `travel_type` | `travel_type` | 直接映射 |
| `review_count` | `review_count` | 提取数字 |
| `room_type_fuzzy` | `room_type_fuzzy` | 直接映射 |
| `quality_score` | `quality_score` | 转为整数 |
| `categories` | `categories` | 解析数组并过滤非标准类别 |
| `quality_reason` | - | **不导入** |
| `confidence` | - | **不导入** |

## 数据库 Schema (Insforge)

```sql
CREATE TABLE comments (
  _id VARCHAR(255) PRIMARY KEY,
  comment TEXT NOT NULL,
  images JSONB DEFAULT '[]',
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
  useful_count INTEGER DEFAULT 0,
  publish_date DATE NOT NULL,
  room_type VARCHAR(255) NOT NULL,
  travel_type VARCHAR(255) NOT NULL,
  review_count INTEGER NOT NULL,
  room_type_fuzzy VARCHAR(255) NOT NULL,
  quality_score INTEGER NOT NULL CHECK (quality_score >= 5 AND quality_score <= 10),
  categories JSONB DEFAULT '[]'
);

-- 索引
CREATE INDEX idx_publish_date ON comments(publish_date);
CREATE INDEX idx_score ON comments(score);
CREATE INDEX idx_room_type_fuzzy ON comments(room_type_fuzzy);
CREATE INDEX idx_travel_type ON comments(travel_type);
CREATE INDEX idx_quality_score ON comments(quality_score);
CREATE INDEX idx_comment_fulltext ON comments USING GIN (to_tsvector('simple', comment));
```
