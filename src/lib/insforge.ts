// lib/insforge.ts - Insforge 客户端封装

import { createClient } from '@insforge/sdk';

// 创建 Insforge 客户端实例
export const insforge = createClient({
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL!,
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
});

// 导出数据库和 AI 客户端
export const db = insforge.database;
export const ai = insforge.ai;
