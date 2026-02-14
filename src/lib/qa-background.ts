// lib/qa-background.ts - 后台问答服务（支持页面切换时继续接收输出）

import { Comment } from '@/types';
import { chatStreamEvents } from './qa';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  references?: Comment[];
  loading?: boolean;
  loadingText?: string; // 动态加载状态文本（"思考中"/"检索中"）
  streaming?: boolean;
}

interface ActiveStream {
  messageId: string;
  content: string;
  references: Comment[];
  isComplete: boolean;
  loadingText?: string; // 当前加载状态文本
  error?: string;
}

const SESSION_STORAGE_KEY = 'qa-chat-history';
const ACTIVE_STREAM_KEY = 'qa-active-stream';

// 全局变量，用于在组件卸载后继续处理流式响应
let activeAbortController: AbortController | null = null;
let activeStreamPromise: Promise<void> | null = null;

// 保存消息到 sessionStorage
function saveMessages(messages: Message[]) {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(messages));
  } catch (e) {
    console.error('Failed to save messages:', e);
  }
}

// 读取消息
export function loadMessages(): Message[] {
  try {
    const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load messages:', e);
  }
  return [];
}

// 保存活动流状态
function saveActiveStream(stream: ActiveStream | null) {
  try {
    if (stream) {
      sessionStorage.setItem(ACTIVE_STREAM_KEY, JSON.stringify(stream));
    } else {
      sessionStorage.removeItem(ACTIVE_STREAM_KEY);
    }
  } catch (e) {
    console.error('Failed to save active stream:', e);
  }
}

// 读取活动流状态
export function loadActiveStream(): ActiveStream | null {
  try {
    const saved = sessionStorage.getItem(ACTIVE_STREAM_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load active stream:', e);
  }
  return null;
}

// 清除活动流状态
export function clearActiveStream() {
  sessionStorage.removeItem(ACTIVE_STREAM_KEY);
}

// 检查是否有活动的流式请求
export function hasActiveStream(): boolean {
  return activeStreamPromise !== null || loadActiveStream() !== null;
}

// 终止当前流式请求
export function abortCurrentStream(): { content: string; hadContent: boolean } {
  const result = { content: '', hadContent: false };

  if (activeAbortController) {
    // 获取当前内容
    const activeStream = loadActiveStream();
    if (activeStream) {
      result.content = activeStream.content;
      result.hadContent = activeStream.content.trim() !== '';
    }

    activeAbortController.abort();
    activeAbortController = null;
    activeStreamPromise = null;
    clearActiveStream();
  }

  return result;
}

// 生成唯一ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// 启动后台流式问答
export function startBackgroundStream(
  question: string,
  existingMessages: Message[],
  onUpdate?: (messages: Message[], isComplete: boolean) => void
): { userMessageId: string; assistantMessageId: string } {
  // 如果有正在进行的流，先终止
  if (activeAbortController) {
    activeAbortController.abort();
  }

  const userMessageId = generateId();
  const assistantMessageId = generateId();

  const userMessage: Message = {
    id: userMessageId,
    role: 'user',
    content: question
  };

  const assistantMessage: Message = {
    id: assistantMessageId,
    role: 'assistant',
    content: '',
    loading: true,
    loadingText: '思考中'
  };

  // 初始化消息列表
  const initialMessages = [...existingMessages, userMessage, assistantMessage];
  saveMessages(initialMessages);

  // 初始化活动流状态
  saveActiveStream({
    messageId: assistantMessageId,
    content: '',
    references: [],
    isComplete: false,
    loadingText: '思考中'
  });

  // 创建新的 AbortController
  activeAbortController = new AbortController();
  const signal = activeAbortController.signal;

  // 辅助函数：更新消息中的助手消息
  const updateAssistantMessage = (updates: Partial<Message>) => {
    let messages = loadMessages();
    messages = messages.map(msg =>
      msg.id === assistantMessageId ? { ...msg, ...updates } : msg
    );
    saveMessages(messages);
    return messages;
  };

  // 启动后台流式处理（单次 API 调用）
  activeStreamPromise = (async () => {
    try {
      let references: Comment[] = [];
      let fullContent = '';

      for await (const event of chatStreamEvents(question, signal)) {
        if (signal.aborted) break;

        if (event.type === 'intent') {
          if (event.needRetrieval) {
            // 意图识别结果：需要检索 → 显示"检索中"
            saveActiveStream({
              messageId: assistantMessageId,
              content: '',
              references: [],
              isComplete: false,
              loadingText: '检索中'
            });
            const messages = updateAssistantMessage({ loadingText: '检索中' });
            onUpdate?.(messages, false);
          } else {
            // 意图识别结果：不需要检索 → 保持"思考中"直到第一个 chunk 到来
            saveActiveStream({
              messageId: assistantMessageId,
              content: '',
              references: [],
              isComplete: false,
              loadingText: '思考中'
            });
            const messages = updateAssistantMessage({ loadingText: '思考中' });
            onUpdate?.(messages, false);
          }

        } else if (event.type === 'references') {
          references = event.comments;
          // 检索+重排完成 → 回到"思考中"，等待模型生成第一个 token
          saveActiveStream({
            messageId: assistantMessageId,
            content: '',
            references,
            isComplete: false,
            loadingText: '思考中'
          });
          const messages = updateAssistantMessage({ loadingText: '思考中' });
          onUpdate?.(messages, false);

        } else if (event.type === 'chunk') {
          fullContent += event.content;
          saveActiveStream({
            messageId: assistantMessageId,
            content: fullContent,
            references,
            isComplete: false,
            loadingText: undefined
          });
          // 第一个 chunk 到来时切换为流式输出状态
          const messages = updateAssistantMessage({
            content: fullContent, loading: false, loadingText: undefined, streaming: true
          });
          onUpdate?.(messages, false);

        } else if (event.type === 'error') {
          fullContent = `抱歉，${event.message}`;
          const messages = updateAssistantMessage({
            content: fullContent, loading: false, loadingText: undefined, streaming: false
          });
          saveMessages(messages);
          clearActiveStream();
          onUpdate?.(messages, true);
          return;

        } else if (event.type === 'done') {
          // 流式完成
        }
      }

      // 流式完成
      if (!signal.aborted) {
        saveActiveStream({
          messageId: assistantMessageId,
          content: fullContent,
          references,
          isComplete: true,
          loadingText: undefined
        });
        const messages = updateAssistantMessage({ streaming: false, references });
        onUpdate?.(messages, true);
      }
    } catch (error) {
      if (signal.aborted) return;

      const errorMessage = error instanceof Error ? error.message : '抱歉，出现了错误，请稍后重试。';
      const messages = updateAssistantMessage({
        content: errorMessage, loading: false, loadingText: undefined, streaming: false
      });
      saveMessages(messages);
      clearActiveStream();
      onUpdate?.(messages, true);
    } finally {
      if (!signal.aborted) {
        activeAbortController = null;
        activeStreamPromise = null;
      }
    }
  })();

  return { userMessageId, assistantMessageId };
}

// 同步活动流状态到消息列表（页面恢复时调用）
export function syncActiveStreamToMessages(): Message[] {
  const messages = loadMessages();
  const activeStream = loadActiveStream();

  if (!activeStream) {
    return messages;
  }

  // 如果流已完成，更新消息并清除活动流
  if (activeStream.isComplete) {
    const updatedMessages = messages.map(msg =>
      msg.id === activeStream.messageId
        ? { ...msg, content: activeStream.content, streaming: false, loading: false, loadingText: undefined, references: activeStream.references }
        : msg
    );
    saveMessages(updatedMessages);
    clearActiveStream();
    return updatedMessages;
  }

  // 如果流还在进行中，根据 loadingText 恢复状态
  const isLoading = !!activeStream.loadingText;
  const updatedMessages = messages.map(msg =>
    msg.id === activeStream.messageId
      ? {
          ...msg,
          content: activeStream.content,
          streaming: !isLoading,
          loading: isLoading,
          loadingText: activeStream.loadingText
        }
      : msg
  );

  return updatedMessages;
}

// 清除所有数据
export function clearAllData() {
  abortCurrentStream();
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  clearActiveStream();
}
