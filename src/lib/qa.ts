// lib/qa.ts - 智能问答服务（调用 Python RAG API）
import { Comment, StandardCategory } from '@/types';

export interface QAResponse {
  answer: string;
  references: Comment[];
}

// 统一流式事件类型
export type StreamEvent =
  | { type: 'intent'; needRetrieval: boolean }
  | { type: 'references'; comments: Comment[] }
  | { type: 'chunk'; content: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

const PYTHON_API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000';

// 统一流式问答（单次 API 调用，返回结构化事件）
export async function* chatStreamEvents(
  question: string,
  signal?: AbortSignal
): AsyncGenerator<StreamEvent, void, unknown> {
  try {
    const response = await fetch(`${PYTHON_API_URL}/api/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: question }),
      signal,
    });

    if (!response.ok) {
      yield { type: 'error', message: '生成回答时出现问题，请稍后重试。' };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', message: '无法读取响应流。' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      if (signal?.aborted) return;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        try {
          const event = JSON.parse(line.slice(6));

          if (event.type === 'intent') {
            yield { type: 'intent', needRetrieval: event.data?.need_retrieval ?? true };
          } else if (event.type === 'references') {
            const rawComments = event.data?.comments || [];
            yield { type: 'references', comments: rawComments.map(mapToComment) };
          } else if (event.type === 'chunk' && event.content) {
            yield { type: 'chunk', content: event.content };
          } else if (event.type === 'error') {
            yield { type: 'error', message: event.message || '出现错误' };
            return;
          } else if (event.type === 'done') {
            yield { type: 'done' };
          }
        } catch {
          // 忽略 JSON 解析失败的行
        }
      }
    }

    // 处理 buffer 中剩余的数据
    if (buffer.startsWith('data: ')) {
      try {
        const event = JSON.parse(buffer.slice(6));
        if (event.type === 'chunk' && event.content) {
          yield { type: 'chunk', content: event.content };
        }
      } catch {
        // 忽略
      }
    }
  } catch (error) {
    if (signal?.aborted) return;
    console.error('RAG API 调用失败:', error);
    yield { type: 'error', message: '生成回答时出现问题，请稍后重试。' };
  }
}

// 非流式问答（保留兼容）
export async function askQuestion(question: string): Promise<QAResponse> {
  try {
    let answer = '';
    const references: Comment[] = [];

    for await (const event of chatStreamEvents(question)) {
      if (event.type === 'chunk') {
        answer += event.content;
      } else if (event.type === 'references') {
        references.push(...event.comments);
      } else if (event.type === 'error') {
        throw new Error(event.message);
      }
    }

    return { answer: answer || '抱歉，生成回答时出现问题，请稍后重试。', references };
  } catch (error) {
    console.error('RAG API 调用失败:', error);
    throw new Error('生成回答失败，请稍后重试');
  }
}

// 将 Python API 返回的评论对象转换为前端 Comment 类型
function mapToComment(raw: Record<string, unknown>): Comment {
  const category1 = (raw.category1 as StandardCategory) || null;
  const category2 = (raw.category2 as StandardCategory) || null;
  const category3 = (raw.category3 as StandardCategory) || null;
  const categories: StandardCategory[] = [category1, category2, category3].filter(
    (c): c is StandardCategory => c !== null
  );

  return {
    _id: String(raw._id || ''),
    comment: String(raw.comment || ''),
    images: (raw.images as string[]) || [],
    score: Number(raw.score || 0),
    star: Number(raw.star || raw.score || 0),
    useful_count: Number(raw.useful_count || 0),
    publish_date: String(raw.publish_date || ''),
    room_type: String(raw.room_type || ''),
    fuzzy_room_type: String(raw.fuzzy_room_type || ''),
    travel_type: String(raw.travel_type || ''),
    review_count: Number(raw.review_count || 0),
    quality_score: Number(raw.quality_score || 0),
    category1,
    category2,
    category3,
    categories,
  };
}
