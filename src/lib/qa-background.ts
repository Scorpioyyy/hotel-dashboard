// lib/qa-background.ts - 后台问答服务（支持页面切换时继续接收输出）

import { Comment } from '@/types';
import { getReferencesForQuestion, askQuestionStream } from './qa';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  references?: Comment[];
  loading?: boolean;
  streaming?: boolean;
}

interface ActiveStream {
  messageId: string;
  content: string;
  references: Comment[];
  isComplete: boolean;
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
    loading: true
  };

  // 初始化消息列表
  const initialMessages = [...existingMessages, userMessage, assistantMessage];
  saveMessages(initialMessages);

  // 初始化活动流状态
  saveActiveStream({
    messageId: assistantMessageId,
    content: '',
    references: [],
    isComplete: false
  });

  // 创建新的 AbortController
  activeAbortController = new AbortController();
  const signal = activeAbortController.signal;

  // 启动后台流式处理
  activeStreamPromise = (async () => {
    try {
      // 获取相关评论
      const references = await getReferencesForQuestion(question);

      if (signal.aborted) return;

      // 更新活动流状态
      saveActiveStream({
        messageId: assistantMessageId,
        content: '',
        references,
        isComplete: false
      });

      // 更新消息状态为流式中
      let messages = loadMessages();
      messages = messages.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, loading: false, streaming: true }
          : msg
      );
      saveMessages(messages);
      onUpdate?.(messages, false);

      // 流式接收回复
      let fullContent = '';
      for await (const chunk of askQuestionStream(question, references, signal)) {
        if (signal.aborted) break;

        fullContent += chunk;

        // 更新活动流状态
        saveActiveStream({
          messageId: assistantMessageId,
          content: fullContent,
          references,
          isComplete: false
        });

        // 更新消息
        messages = loadMessages();
        messages = messages.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: fullContent }
            : msg
        );
        saveMessages(messages);
        onUpdate?.(messages, false);
      }

      // 流式完成
      if (!signal.aborted) {
        // 标记完成（不要立即清除 activeStream，让页面的轮询能检测到完成状态）
        saveActiveStream({
          messageId: assistantMessageId,
          content: fullContent,
          references,
          isComplete: true
        });

        messages = loadMessages();
        messages = messages.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, streaming: false, references }
            : msg
        );
        saveMessages(messages);
        // 注意：这里不调用 clearActiveStream()，由页面的 checkActiveStream 检测到完成后清除
        onUpdate?.(messages, true);
      }
    } catch (error) {
      if (signal.aborted) return;

      const errorMessage = error instanceof Error ? error.message : '抱歉，出现了错误，请稍后重试。';

      // 更新为错误状态
      let messages = loadMessages();
      messages = messages.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: errorMessage, loading: false, streaming: false }
          : msg
      );
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
        ? { ...msg, content: activeStream.content, streaming: false, loading: false, references: activeStream.references }
        : msg
    );
    saveMessages(updatedMessages);
    clearActiveStream();
    return updatedMessages;
  }

  // 如果流还在进行中，更新消息内容
  const updatedMessages = messages.map(msg =>
    msg.id === activeStream.messageId
      ? { ...msg, content: activeStream.content, streaming: true, loading: false }
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
