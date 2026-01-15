// app/qa/page.tsx - 智能问答页面
'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage, ChatInput } from '@/components/qa';
import { getReferencesForQuestion, askQuestionStream } from '@/lib/qa';
import { Comment } from '@/types';
import { generateId } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  references?: Comment[];
  loading?: boolean;
  streaming?: boolean;
}

const SESSION_STORAGE_KEY = 'qa-chat-history';

export default function QAPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLDivElement>(null);
  const referencesAnchorRef = useRef<HTMLParagraphElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const shouldScrollToEndRef = useRef(true);
  const isRestoredFromStorageRef = useRef(false);

  // 从 sessionStorage 恢复对话记录
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setMessages(parsed);
        if (parsed.length > 0) {
          isRestoredFromStorageRef.current = true;
        }
      }
    } catch (e) {
      console.error('Failed to restore chat history:', e);
    }
  }, []);

  // 保存对话记录到 sessionStorage
  useEffect(() => {
    if (messages.length > 0) {
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(messages));
      } catch (e) {
        console.error('Failed to save chat history:', e);
      }
    }
  }, [messages]);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 滚动到最后一条消息的引用标题位置
  const scrollToLastMessageReferences = () => {
    if (referencesAnchorRef.current) {
      referencesAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  // 滚动到最后一条用户消息（留出顶部间距）
  const scrollToLastUserMessage = () => {
    if (lastUserMessageRef.current) {
      const container = lastUserMessageRef.current.closest('.overflow-y-auto') as HTMLElement;
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = lastUserMessageRef.current.getBoundingClientRect();
        const currentScrollTop = container.scrollTop;
        const relativeTop = elementRect.top - containerRect.top + currentScrollTop;
        const offset = 16; // 顶部留出 16px 间距
        container.scrollTo({ top: relativeTop - offset, behavior: 'auto' });
      }
    }
  };

  // 从 sessionStorage 恢复后滚动到最后一条用户消息
  useEffect(() => {
    if (isRestoredFromStorageRef.current && messages.length > 0) {
      // 延迟执行以确保 DOM 已更新
      setTimeout(() => {
        scrollToLastUserMessage();
        isRestoredFromStorageRef.current = false;
      }, 50);
    }
  }, [messages]);

  useEffect(() => {
    // 只在需要滚动时滚动（非恢复场景）
    if (!isRestoredFromStorageRef.current && shouldScrollToEndRef.current && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      // 如果最后一条是用户消息或正在加载/流式输出，滚动到底部
      if (lastMsg.role === 'user' || lastMsg.loading || lastMsg.streaming) {
        scrollToBottom();
      }
    }
  }, [messages]);

  // 清除对话记录
  const handleClearHistory = () => {
    if (isGenerating) {
      handleStop();
    }
    setMessages([]);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  };

  // 终止当前对话
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setIsGenerating(false);
    // 更新最后一条助手消息的状态
    setMessages((prev) =>
      prev.map((msg, idx) =>
        idx === prev.length - 1 && msg.role === 'assistant'
          ? { ...msg, loading: false, streaming: false }
          : msg
      )
    );
  };

  const handleSend = async (question: string) => {
    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // 添加用户消息
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: question
    };
    setMessages((prev) => [...prev, userMessage]);

    // 添加加载中的助手消息
    const assistantMessageId = generateId();
    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        loading: true
      }
    ]);
    setLoading(true);
    setIsGenerating(true);

    try {
      // 先获取相关评论
      const references = await getReferencesForQuestion(question);

      // 检查是否已被终止
      if (signal.aborted) return;

      // 开始流式输出，更新状态（先不显示references）
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, loading: false, streaming: true }
            : msg
        )
      );

      // 流式接收回复
      let fullContent = '';
      for await (const chunk of askQuestionStream(question, references)) {
        // 检查是否已被终止
        if (signal.aborted) break;

        fullContent += chunk;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: fullContent }
              : msg
          )
        );
      }

      // 如果未被终止，流式结束后再显示references
      if (!signal.aborted) {
        shouldScrollToEndRef.current = false; // 禁止自动滚动到最底部
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, streaming: false, references }
              : msg
          )
        );
        // 延迟滚动到参考评论标题处
        setTimeout(() => {
          scrollToLastMessageReferences();
          shouldScrollToEndRef.current = true; // 恢复
        }, 100);
      }
    } catch (error) {
      // 如果是终止导致的错误，不显示错误消息
      if (signal.aborted) return;

      // 更新为错误消息
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: error instanceof Error ? error.message : '抱歉，出现了错误，请稍后重试。',
                loading: false,
                streaming: false
              }
            : msg
        )
      );
    } finally {
      if (!signal.aborted) {
        setLoading(false);
        setIsGenerating(false);
      }
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-50">
      {/* 标题栏 */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">智能问答</h1>
            <p className="text-sm text-gray-500">基于真实住客评论，为您解答关于酒店的各种问题</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              清除对话
            </button>
          )}
        </div>
      </div>

      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-gray-900 mb-2">欢迎使用智能问答</h2>
              <p className="text-gray-500 mb-6">您可以询问关于酒店设施、服务、位置等方面的问题</p>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">酒店早餐</span>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">房间设施</span>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">服务质量</span>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">交通位置</span>
                <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">性价比</span>
              </div>
            </div>
          ) : (
            (() => {
              // 找到最后一条用户消息的索引
              const lastUserIdx = messages.reduce((acc, m, i) => m.role === 'user' ? i : acc, -1);
              return messages.map((msg, idx) => {
                const isLastAssistant = idx === messages.length - 1 && msg.role === 'assistant';
                const isLastUser = idx === lastUserIdx;
                return (
                  <div
                    key={msg.id}
                    ref={isLastAssistant ? lastMessageRef : isLastUser ? lastUserMessageRef : undefined}
                  >
                    <ChatMessage
                      role={msg.role}
                      content={msg.content}
                      references={msg.references}
                      loading={msg.loading}
                      streaming={msg.streaming}
                      referencesAnchorRef={isLastAssistant ? referencesAnchorRef : undefined}
                    />
                  </div>
                );
              });
            })()
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入区域 */}
      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        disabled={loading}
        isGenerating={isGenerating}
      />
    </div>
  );
}
