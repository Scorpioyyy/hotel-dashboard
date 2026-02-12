# Quickstart: 花园酒店评论分析系统

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
```

### 2. 环境配置

#### 2.1 配置 Next.js 应用

复制 `env.example` 为 `.env` 并填入你的 Insforge 配置：

```bash
cp env.example .env
```

然后编辑 `.env`，将 `your-insforge-url-here` 和 `your_insforge_anon_key_here` 替换为你的真实值

#### 2.2 配置 MCP 服务器

复制 `.mcp.json.example` 为 `.mcp.json` 并填入你的 Insforge Admin 配置：

```bash
cp .mcp.json.example .mcp.json
```

然后编辑 `.mcp.json`，将 `your-admin-api-key-here` 和 `your-insforge-url-here` 替换为你的真实值

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

访问 http://localhost:3000 查看评论浏览页。

## 核心功能验证

### 验证评论浏览（首页）

1. 访问首页 `/`，确认评论列表正确展示
2. 使用筛选器筛选评论（星级、房型、出行类型、类别）
3. 使用搜索框搜索评论内容
4. 切换排序方式（最新发布、评分最高等）
5. 点击图片查看大图

### 验证看板功能

1. 访问 `/dashboard`，确认图表正确渲染
2. 点击图表元素（如评分、类别等），确认跳转到首页并自动应用筛选
3. 查看各维度统计数据

### 验证智能问答

1. 访问 `/qa`
2. 输入问题如"顾客对早餐的评价如何"
3. 确认回答流式显示（逐字输出）
4. 确认回答完成后展示引用的原始评论
5. 测试终止功能：在回答生成过程中点击"终止"按钮
6. 测试页面切换：在回答生成过程中切换到其他页面，再返回 `/qa`，确认回答继续生成
7. 刷新页面，确认对话历史被恢复

## 目录结构

```
hotel-dashboard/
├── src/
│   ├── app/                    # 页面路由
│   │   ├── page.tsx            # 评论浏览页（首页）
│   │   ├── dashboard/page.tsx  # 数据看板
│   │   └── qa/page.tsx         # 智能问答
│   ├── components/             # 组件库
│   │   ├── charts/             # 图表组件
│   │   ├── comments/           # 评论组件
│   │   ├── qa/                 # 问答组件
│   │   └── ui/                 # UI 组件
│   ├── lib/                    # 工具库
│   │   ├── insforge.ts         # Insforge 客户端（含 AI 集成）
│   │   ├── api.ts              # API 客户端封装
│   │   ├── qa.ts               # 智能问答服务
│   │   ├── qa-background.ts    # 后台问答服务
│   │   ├── constants.ts        # 常量
│   │   └── utils.ts            # 工具函数
│   └── types/                  # 类型定义
├── public/
│   ├── enriched_comments.csv   # 评论数据
│   └── categories.json         # 类别定义
├── specs/001-review-dashboard/
│   ├── spec.md                 # 功能规格
│   ├── plan.md                 # 实施计划
│   ├── research.md             # 技术研究
│   ├── data-model.md           # 数据模型
│   ├── contracts/api.yaml      # API 契约
│   └── quickstart.md           # 本文件
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
