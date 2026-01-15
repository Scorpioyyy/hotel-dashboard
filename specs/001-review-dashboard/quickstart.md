# Quickstart: 广州花园酒店评论数据分析系统

**Date**: 2026-01-14
**Branch**: `001-review-dashboard`

## 前置条件

- Node.js 18+ 已安装
- Insforge MCP 已配置（AI 集成已内置 Gemini 模型）

## 快速开始

### 1. 创建项目

```bash
# 使用 Insforge 模板创建 Next.js 项目
# (通过 MCP 工具 mcp__insforge__download-template)

# 安装依赖
npm install

# 安装图表库
npm install recharts
```

### 2. 环境配置

创建 `.env.local` 文件：

```env
# Insforge 配置（MCP 会自动处理）
NEXT_PUBLIC_INSFORGE_URL=your_insforge_url
INSFORGE_API_KEY=your_api_key

# AI 模型通过 Insforge AI SDK 调用，无需额外配置
# 可用模型: google/gemini-3-flash-preview
```

### 3. 导入数据

```bash
# 使用 Insforge MCP 工具导入 CSV 数据
# 调用 mcp__insforge__bulk-upsert 工具
# 参数: table="comments", filePath="public/enriched_comments.csv"
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 查看看板。

## 核心功能验证

### 验证看板功能

1. 访问首页，确认 7 个图表正确渲染
2. 使用筛选器，确认图表联动更新
3. 切换时间范围，确认数据响应

### 验证评论浏览

1. 访问 `/comments`，确认评论列表展示
2. 筛选高质量评论（quality_score ≥ 8）
3. 点击图片查看大图

### 验证智能问答

1. 访问 `/qa`
2. 输入问题如"顾客对早餐的评价如何"
3. 确认回答附带 3-5 条引用评论

## 目录结构

```
hotel-dashboard/
├── src/
│   ├── app/                    # 页面和 API 路由
│   │   ├── page.tsx           # 看板首页
│   │   ├── comments/page.tsx  # 评论列表
│   │   ├── qa/page.tsx        # 智能问答
│   │   └── api/               # API 接口
│   ├── components/            # 组件库
│   │   ├── charts/           # 图表组件
│   │   ├── comments/         # 评论组件
│   │   ├── filters/          # 筛选器
│   │   └── qa/               # 问答组件
│   ├── lib/                  # 工具库
│   │   ├── insforge.ts       # Insforge 客户端（含 AI 集成）
│   │   └── constants.ts      # 常量
│   └── types/                # 类型定义
├── public/
│   ├── enriched_comments.csv  # 评论数据
│   └── categories.json        # 类别定义
├── specs/001-review-dashboard/
│   ├── spec.md               # 功能规格
│   ├── plan.md               # 实施计划
│   ├── research.md           # 技术研究
│   ├── data-model.md         # 数据模型
│   ├── contracts/api.yaml    # API 契约
│   └── quickstart.md         # 本文件
└── package.json
```

## 常用命令

```bash
# 开发
npm run dev          # 启动开发服务器

# 构建
npm run build        # 生产构建
npm run start        # 启动生产服务器

# 代码质量
npm run lint         # ESLint 检查
npm run type-check   # TypeScript 类型检查
```

## 关键配置

### 14 个标准小类

```typescript
// lib/constants.ts
export const STANDARD_CATEGORIES = [
  '房间设施', '公共设施', '餐饮设施',
  '前台服务', '客房服务', '退房/入住效率',
  '交通便利性', '周边配套', '景观/朝向',
  '性价比', '价格合理性',
  '整体满意度', '安静程度', '卫生状况'
] as const;
```

### 高质量评论阈值

```typescript
// quality_score >= 8 视为高质量评论
const HIGH_QUALITY_THRESHOLD = 8;
```

## 故障排除

| 问题 | 解决方案 |
|------|----------|
| Insforge 连接失败 | 检查 MCP 配置和 API 密钥 |
| 图表不显示数据 | 确认数据已导入，检查浏览器控制台 |
| 问答响应超时 | 检查 Insforge 连接，确认网络正常 |
| 类别数据异常 | 确认 categories.json 正确，检查过滤逻辑 |

## 下一步

完成基础搭建后，使用 `/speckit.tasks` 命令生成详细任务列表。
