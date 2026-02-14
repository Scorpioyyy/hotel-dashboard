# 酒店评论分析系统（开发模板）

酒店评论分析系统 - 基于真实住客评论的可视化分析与智能问答平台

## 功能特性

### 评论浏览

- 多维度筛选：日期范围、评分、房型、出行类型、话题类别、评论质量
- 关键词搜索：单一关键词整段匹配
- 多种排序方式：时间、评分、质量分、点赞数、回复数
- 评论卡片展示：评分、日期、内容、配图、标签

### 数据看板

- 核心指标展示：评论总数、平均评分、高质量评论占比
- 评分分布柱状图
- 月度趋势折线图（评论数量与平均分）
- 话题类别分布图
- 房型分布与出行类型分布饼图
- 支持点击图中相应位置直接跳转对应筛选条件的评论

### 智能问答

- 基于真实住客评论的 AI 问答系统
- 流式响应，实时输出
- 展示参考评论来源
- 保存当次访问的对话记录
- 支持终止生成与清除对话

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 15 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS |
| 图表 | Recharts |
| 后端 | Insforge (PostgreSQL + AI) |
| AI 模型 | Google Gemini 3 Flash Preview |

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 环境配置

#### 1. 配置 Next.js 应用

复制 `.env.example` 为 `.env` 并填入你的 Insforge 配置：

```bash
cp .env.example .env
```

然后编辑 `.env`，将 `your-insforge-url-here` 和 `your_insforge_anon_key_here` 替换为你的真实值

#### 2. 配置 MCP 服务器

复制 `.mcp.json.example` 为 `.mcp.json` 并填入你的 Insforge Admin 配置：

```bash
cp .mcp.json.example .mcp.json
```

然后编辑 `.mcp.json`，将 `your-admin-api-key-here` 和 `your-insforge-url-here` 替换为你的真实值

#### 3. insforge 数据库

数据库的名称、字段等需要与 `需求文档.md` 中的第二、四点保持一致

### 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

## 项目结构

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
└── package.json                # 项目依赖
```

## 智能问答工作流

1. **类别提取**：基于关键词匹配，从用户问题中识别相关话题类别
2. **评论检索**：从数据库获取匹配类别的高质量评论（10 条）
3. **生成回答**：将评论作为上下文，调用 AI 模型生成回答
4. **展示来源**：在回答下方展示参考的评论原文

注：无意图识别、无上下文记忆、被过度简化的文本检索

## License

MIT
