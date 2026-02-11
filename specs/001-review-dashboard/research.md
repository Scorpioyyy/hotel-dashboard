# Research: 花园酒店评论分析系统

**Date**: 2026-01-14
**Branch**: `001-review-dashboard`

## 技术决策摘要

### 1. 图表库选择

**Decision**: 使用 Recharts

**Rationale**:
- 基于 React 构建，与 Next.js 无缝集成
- 声明式 API，学习曲线平缓
- 支持响应式设计，适配移动端
- 内置中文支持，无需额外配置
- 轻量级，不会显著增加打包体积

**Alternatives Considered**:
| 库 | 优点 | 缺点 | 结论 |
|----|------|------|------|
| ECharts | 功能强大，图表类型丰富 | 体积大，非 React 原生 | 功能过剩 |
| Chart.js | 轻量，广泛使用 | 需要 React 包装器 | 集成不如 Recharts 顺畅 |
| Nivo | 美观，React 原生 | API 复杂，学习成本高 | 过度设计 |
| Victory | React 原生，D3 驱动 | 文档较少，社区较小 | 不够成熟 |

### 2. 数据库方案

**Decision**: 使用 Insforge（通过 MCP 调用）

**Rationale**:
- 项目需求文档明确指定
- MCP 已配置完成，可直接使用
- 支持 SQL 查询，满足复杂筛选需求
- 内置全文检索能力，支持问答功能的评论检索

**数据导入策略**:
1. 使用 Insforge MCP 的 `bulk-upsert` 工具导入 CSV 数据
2. 数据处理要求：
   - 保留所有原始字段（comment_len, log_* 等统计字段）
   - 将 `categories` 数组拆分为 `category1`, `category2`, `category3` 三个字段
   - 新增 `star` 字段：将 `score` 浮点数转换为 1-5 整数
   - 保留原始 `score` 浮点数用于精确计算

**关键字段说明**:
- `score`: 0.5-5.0 浮点数（原始评分）
- `star`: 1-5 整数（转换后的星级，用于筛选）
- `fuzzy_room_type`: 房型模糊分类（注意不是 room_type_fuzzy）
- `category1/2/3`: 拆分后的类别字段，便于 SQL 查询

### 3. AI 问答实现

**Decision**: 使用 Insforge AI SDK 调用 `google/gemini-3-flash-preview` 模型

**Rationale**:
- 需求文档指定使用 Gemini 3 Flash Preview
- 通过 Insforge AI SDK 统一调用，无需单独配置 Gemini API 密钥
- 支持流式响应，用户体验更好
- 响应速度快，符合 5 秒内响应的要求

**实现方案**:
```
用户问题 → 关键词提取 → Insforge 全文检索 → 召回 Top-N 评论 → Insforge AI SDK (gemini-3-flash-preview) → 生成回答
```

**代码示例**:
```typescript
import { createInsforgeClient } from '@insforge/sdk';

const insforge = createInsforgeClient({ ... });

const completion = await insforge.ai.chat.completions.create({
  model: 'google/gemini-3-flash-preview',
  messages: [
    { role: 'system', content: '你是酒店评论分析助手...' },
    { role: 'user', content: `基于以下评论回答问题:\n${reviews}\n\n问题: ${question}` }
  ],
  stream: true // 支持流式响应
});
```

**关键词提取策略**:
- 基于问题内容提取相关类别（如"早餐"→"餐饮设施"）
- 使用预定义的类别关键词映射表
- 检索高质量评论（quality_score ≥ 8）
- 每次检索最多返回 10 条评论

### 4. 状态管理

**Decision**: 使用 React Context + URL 状态

**Rationale**:
- 项目规模较小，无需 Redux/Zustand 等重型方案
- 筛选条件通过 URL 参数持久化，支持分享和刷新保持
- 符合宪法原则 V（简洁实用）

**状态分布**:
| 状态类型 | 存储位置 | 原因 |
|----------|----------|------|
| 筛选条件 | URL 参数 + 本地 state | 可分享、刷新保持 |
| 图表数据 | 本地 state | 客户端获取 |
| 加载状态 | 本地 state | 仅 UI 需要 |
| 问答会话 | sessionStorage | 页面刷新后可恢复 |
| 活动流状态 | sessionStorage + 全局变量 | 支持页面切换时继续生成 |

### 5. 样式方案

**Decision**: 使用 Tailwind CSS

**Rationale**:
- Next.js 官方推荐
- 原子化 CSS，开发效率高
- 内置响应式支持
- 无需维护单独的样式文件

### 6. 数据获取模式

**Decision**: 使用 Client Components + 直接调用 Insforge

**Rationale**:
- 所有页面使用 Client Components，通过 `lib/api.ts` 直接调用 Insforge SDK
- 无需独立的 API Routes，减少架构复杂度
- 问答功能通过后台流式服务（`lib/qa-background.ts`）实现，支持页面切换时继续接收输出

**数据流设计**:
```
┌──────────────────┐      ┌────────────────┐      ┌─────────────┐
│ Client Component │────▶│ lib/api.ts     │────▶│ Insforge SDK│
└──────────────────┘      └────────────────┘      └─────────────┘

智能问答特殊流程：
┌────────────────┐      ┌─────────────────────┐      ┌─────────────┐
│ QA Page        │────▶│ qa-background.ts    │────▶│ Insforge AI │
└────────────────┘      └─────────────────────┘      └─────────────┘
                                 │
                                 ▼
                           sessionStorage
                      （保存对话历史和活动流状态）
```

**后台流式服务特性**:
- 使用全局变量管理 AbortController，支持跨组件卸载继续处理
- 使用 sessionStorage 持久化对话历史和流式状态
- 页面切换后返回可恢复对话和正在生成的回答
- 支持终止正在生成的回答

## 14 个标准小类定义

基于 `categories.json` 分析，确认标准小类如下：

| 大类 | 小类 |
|------|------|
| 设施类 | 房间设施、公共设施、餐饮设施 |
| 服务类 | 前台服务、客房服务、退房/入住效率 |
| 位置类 | 交通便利性、周边配套、景观/朝向 |
| 价格类 | 性价比、价格合理性 |
| 体验类 | 整体满意度、安静程度、卫生状况 |

**代码常量定义**:
```typescript
export const STANDARD_CATEGORIES = [
  '房间设施', '公共设施', '餐饮设施',
  '前台服务', '客房服务', '退房/入住效率',
  '交通便利性', '周边配套', '景观/朝向',
  '性价比', '价格合理性',
  '整体满意度', '安静程度', '卫生状况'
] as const;

export const CATEGORY_GROUPS = {
  '设施类': ['房间设施', '公共设施', '餐饮设施'],
  '服务类': ['前台服务', '客房服务', '退房/入住效率'],
  '位置类': ['交通便利性', '周边配套', '景观/朝向'],
  '价格类': ['性价比', '价格合理性'],
  '体验类': ['整体满意度', '安静程度', '卫生状况']
} as const;
```

## 日期格式处理

**原始格式**: `"YYYY年M月D日"` (如 "2025年4月5日")

**解析函数**:
```typescript
function parseChineseDate(dateStr: string): Date {
  const match = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!match) throw new Error(`Invalid date format: ${dateStr}`);
  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}
```

## 性能优化策略

1. **数据库索引**:
   - `publish_date` - 时间范围查询
   - `score` - 评分筛选
   - `room_type_fuzzy` - 房型筛选
   - `travel_type` - 旅行类型筛选
   - `quality_score` - 高质量评论筛选
   - `comment` (全文索引) - 问答检索

2. **前端优化**:
   - 图表懒加载（仅可视区域内渲染）
   - 评论列表虚拟滚动（数据量大时）
   - 图片懒加载

3. **API 优化**:
   - 聚合查询一次性返回多维度统计数据
   - 分页加载评论列表
   - 问答流式响应

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Insforge MCP 调用延迟 | 影响页面加载 | 使用缓存，SSR 预取 |
| Insforge AI 响应超时 | 问答体验差 | 5 秒超时处理，流式响应，友好提示 |
| 图片 URL 失效 | 展示不完整 | 占位图，错误处理 |
| 类别数据不规范 | 图表数据错误 | 严格过滤非标准类别 |
