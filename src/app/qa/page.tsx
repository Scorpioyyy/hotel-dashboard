// app/qa/page.tsx - 智能问答页面
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, ChatInput } from '@/components/qa';
import {
  Message,
  loadMessages,
  loadActiveStream,
  clearActiveStream,
  syncActiveStreamToMessages,
  startBackgroundStream,
  abortCurrentStream,
  clearAllData
} from '@/lib/qa-background';

export default function QAPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prefillQuestion, setPrefillQuestion] = useState('');
  const [isReady, setIsReady] = useState(false);
  // 数据是否已加载（用于触发滚动处理）
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  // 底部填充高度，用于确保用户消息可以滚动到顶部
  const [bottomPadding, setBottomPadding] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<HTMLDivElement>(null);
  const referencesAnchorRef = useRef<HTMLParagraphElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastUserQuestionRef = useRef<string>('');
  const isStreamingRef = useRef(false);
  const currentAssistantIdRef = useRef<string | null>(null);
  // 标记是否需要在下次渲染后滚动
  const needsScrollRef = useRef<'user' | 'complete' | null>(null);
  // 防止初始化时的重复操作
  const hasInitializedRef = useRef(false);
  // 发送问题后短暂禁止流式滚动，确保用户消息能置顶
  const blockStreamScrollUntilRef = useRef<number>(0);
  // 跟踪组件是否挂载
  const isMountedRef = useRef(true);
  // 是否是页面初始加载（用于跳过参考评论延迟）
  const isInitialLoadRef = useRef(true);

  // 计算让用户消息置顶所需的底部填充高度
  // 返回 { padding, isContentLong }
  const calculatePaddingForUserMessage = useCallback(() => {
    if (!messagesContainerRef.current || !lastUserMessageRef.current || !messagesEndRef.current) {
      return { padding: 0, isContentLong: false };
    }

    const container = messagesContainerRef.current;
    const userMsg = lastUserMessageRef.current;
    const endMarker = messagesEndRef.current;

    const containerHeight = container.clientHeight;
    const containerRect = container.getBoundingClientRect();

    // 用户消息相对于容器内容顶部的绝对位置
    const userMsgRect = userMsg.getBoundingClientRect();
    const userMsgAbsoluteTop = userMsgRect.top - containerRect.top + container.scrollTop;

    // 内容底部的绝对位置（不包含当前填充）
    const endRect = endMarker.getBoundingClientRect();
    const contentAbsoluteBottom = endRect.top - containerRect.top + container.scrollTop;

    // 用户消息置顶时（留24px间距），从用户消息到内容底部的距离
    const contentHeightBelowUserMsg = contentAbsoluteBottom - (userMsgAbsoluteTop - 24);

    // 如果这个距离已经超过容器高度，说明内容足够长，不需要填充
    const isContentLong = contentHeightBelowUserMsg >= containerHeight;

    if (isContentLong) {
      return { padding: 0, isContentLong: true };
    }

    // 内容不足，需要填充
    const neededPadding = containerHeight - contentHeightBelowUserMsg;
    return { padding: Math.max(0, neededPadding), isContentLong: false };
  }, []);

  // 滚动到用户消息位置（置顶，留24px间距）
  const scrollToUserMessage = useCallback((animated: boolean = true) => {
    if (!lastUserMessageRef.current || !messagesContainerRef.current) return;

    const container = messagesContainerRef.current;
    const userMsg = lastUserMessageRef.current;
    const containerRect = container.getBoundingClientRect();
    const userMsgRect = userMsg.getBoundingClientRect();
    const relativeTop = userMsgRect.top - containerRect.top + container.scrollTop;
    const targetScroll = Math.max(0, relativeTop - 24);

    if (animated) {
      container.scrollTo({ top: targetScroll, behavior: 'smooth' });
    } else {
      container.scrollTop = targetScroll;
    }
  }, []);

  // 滚动到参考评论位置
  const scrollToReferences = useCallback(() => {
    if (!referencesAnchorRef.current || !messagesContainerRef.current || !lastUserMessageRef.current) return;

    const container = messagesContainerRef.current;
    const anchor = referencesAnchorRef.current;
    const userMsg = lastUserMessageRef.current;
    const containerRect = container.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const userMsgRect = userMsg.getBoundingClientRect();

    // 计算让参考评论标题出现在视口底部的滚动位置（距离下边界9px）
    const anchorRelativeTop = anchorRect.top - containerRect.top + container.scrollTop;
    const targetScroll = anchorRelativeTop - containerRect.height + anchorRect.height + 9;

    // 用户消息的最小滚动位置（保持用户消息可见，留24px间距）
    const userMsgRelativeTop = userMsgRect.top - containerRect.top + container.scrollTop;
    const userMsgMinScroll = userMsgRelativeTop - 24;

    // 如果滚动到参考评论会让用户消息滚出视图，就不滚动
    if (targetScroll < userMsgMinScroll) {
      return;
    }

    container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
  }, []);

  // 流式输出时滚动到底部
  const scrollToBottom = useCallback(() => {
    if (!messagesEndRef.current || !messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    const endRect = messagesEndRef.current.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const relativeBottom = endRect.bottom - containerRect.top + container.scrollTop;
    const targetScroll = relativeBottom - containerRect.height + 20;

    if (targetScroll > container.scrollTop) {
      container.scrollTop = targetScroll;
    }
  }, []);

  // 组件卸载时标记
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 初始化：恢复消息和活动流状态
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const restoredMessages = syncActiveStreamToMessages();
    const activeStream = loadActiveStream();

    if (restoredMessages.length > 0) {
      setMessages(restoredMessages);
      if (activeStream && !activeStream.isComplete) {
        setIsGenerating(true);
        isStreamingRef.current = true;
        currentAssistantIdRef.current = activeStream.messageId;
      }
      // 有消息时，标记数据已加载，等待滚动完成后再显示
      setIsDataLoaded(true);
    } else {
      // 没有消息时，直接显示
      setIsReady(true);
    }
  }, []);

  // 数据加载后处理滚动，滚动完成后才显示内容
  useEffect(() => {
    if (!isDataLoaded || isReady) return;

    // 如果没有消息，直接显示
    if (messages.length === 0) {
      setIsReady(true);
      return;
    }

    // 如果正在流式输出，滚动到底部后显示
    if (isStreamingRef.current) {
      setBottomPadding(0);
      requestAnimationFrame(() => {
        scrollToBottom();
        setIsReady(true);
      });
      return;
    }

    // 不在流式输出，计算填充并滚动到用户消息，完成后显示
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const { padding } = calculatePaddingForUserMessage();
        setBottomPadding(padding);
        requestAnimationFrame(() => {
          scrollToUserMessage(false);
          // 滚动完成后才显示内容
          setIsReady(true);
        });
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDataLoaded, isReady, messages.length]);

  // 监听后台流更新（用于页面切换后恢复）
  useEffect(() => {
    if (!isReady) return;

    const checkActiveStream = () => {
      const activeStream = loadActiveStream();
      if (!activeStream || currentAssistantIdRef.current !== activeStream.messageId) return;

      // 如果流已完成，先设置 ref，确保 effect 能检测到
      if (activeStream.isComplete) {
        needsScrollRef.current = 'complete';
        setIsGenerating(false);
        isStreamingRef.current = false;
        currentAssistantIdRef.current = null;
        clearActiveStream();
      }

      setMessages(prev => prev.map(msg =>
        msg.id === activeStream.messageId
          ? {
              ...msg,
              content: activeStream.content,
              streaming: !activeStream.isComplete,
              loading: false,
              references: activeStream.isComplete ? activeStream.references : msg.references
            }
          : msg
      ));
    };

    const interval = setInterval(checkActiveStream, 100);
    return () => clearInterval(interval);
  }, [isReady]);

  // 处理消息变化后的滚动和填充
  useEffect(() => {
    if (!isReady || messages.length === 0) return;

    // 场景1：发送新问题后，滚动到用户消息
    if (needsScrollRef.current === 'user') {
      needsScrollRef.current = null;
      // 阻止流式滚动一段时间，确保用户消息能置顶
      blockStreamScrollUntilRef.current = Date.now() + 800;
      // 直接计算新填充并设置（不先清除，避免闪烁）
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const { padding } = calculatePaddingForUserMessage();
          setBottomPadding(padding);
          requestAnimationFrame(() => {
            scrollToUserMessage(true);
          });
        });
      });
      return;
    }

    // 场景2：回答完成后
    if (needsScrollRef.current === 'complete') {
      needsScrollRef.current = null;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // 计算填充（如果内容长则为0，否则为需要的填充）
          const { padding, isContentLong } = calculatePaddingForUserMessage();
          setBottomPadding(padding);

          requestAnimationFrame(() => {
            if (isContentLong) {
              // 内容足够长，滚动到参考评论
              scrollToReferences();
            }
            // 内容不足一页，保持用户消息在顶部，不额外滚动
          });
        });
      });
      return;
    }

    // 场景3：流式输出时自动滚动到底部
    if (isStreamingRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.streaming) {
        // 如果在阻止时间内，不执行流式滚动（让用户消息保持置顶）
        if (Date.now() < blockStreamScrollUntilRef.current) {
          return;
        }
        // 检查内容是否足够长，只有足够长时才滚动到底部
        const { isContentLong } = calculatePaddingForUserMessage();
        if (isContentLong) {
          // 内容足够长，清除填充并滚动到底部
          if (bottomPadding > 0) {
            setBottomPadding(0);
          }
          scrollToBottom();
        }
        // 内容不够长时，保持用户消息在顶部，不滚动
      }
    }
  }, [messages, isReady, bottomPadding, calculatePaddingForUserMessage, scrollToUserMessage, scrollToReferences, scrollToBottom]);

  // 清除对话
  const handleClearHistory = () => {
    if (isGenerating) {
      handleStop();
    }
    clearAllData();
    setMessages([]);
    setBottomPadding(0);
  };

  // 终止回答
  const handleStop = () => {
    abortCurrentStream();
    isStreamingRef.current = false;
    currentAssistantIdRef.current = null;
    setIsGenerating(false);

    if (lastUserQuestionRef.current) {
      setPrefillQuestion(lastUserQuestionRef.current);
    }

    const STOP_MESSAGE = '<stopped>您已让系统停止这条回答</stopped>';
    setMessages(prev => {
      const updated = prev.map((msg, idx) => {
        if (idx === prev.length - 1 && msg.role === 'assistant') {
          const newContent = msg.content.trim() === ''
            ? STOP_MESSAGE
            : `${msg.content}\n\n${STOP_MESSAGE}`;
          return { ...msg, content: newContent, loading: false, streaming: false };
        }
        return msg;
      });
      try {
        sessionStorage.setItem('qa-chat-history', JSON.stringify(updated));
      } catch { /* ignore */ }
      return updated;
    });

    // 终止后重新计算填充
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const { padding } = calculatePaddingForUserMessage();
        setBottomPadding(padding);
      });
    });
  };

  // 发送消息
  const handleSend = (question: string) => {
    lastUserQuestionRef.current = question;
    setPrefillQuestion('');
    // 发送新消息后，不再是初始加载状态
    isInitialLoadRef.current = false;

    const { assistantMessageId } = startBackgroundStream(
      question,
      messages,
      (updatedMessages, isComplete) => {
        // 如果组件已卸载，不执行任何操作，让新组件的 checkActiveStream 处理
        if (!isMountedRef.current) return;

        setMessages(updatedMessages);
        if (isComplete) {
          setIsGenerating(false);
          isStreamingRef.current = false;
          currentAssistantIdRef.current = null;
          clearActiveStream();
          needsScrollRef.current = 'complete';
        }
      }
    );

    currentAssistantIdRef.current = assistantMessageId;
    needsScrollRef.current = 'user';
    setMessages(loadMessages());
    setIsGenerating(true);
    isStreamingRef.current = true;
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      {/* 标题栏 */}
      <div className="bg-white border-b flex-shrink-0">
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

      {/* 消息区域 - 使用 overflow-y-scroll 确保滚动条始终存在，避免内容宽度变化 */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-scroll"
        style={{ visibility: isReady ? 'visible' : 'hidden' }}
      >
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
              const lastUserIdx = messages.reduce((acc, m, i) => m.role === 'user' ? i : acc, -1);
              return messages.map((msg, idx) => {
                const isLastUser = idx === lastUserIdx;
                const isLastAssistant = idx === messages.length - 1 && msg.role === 'assistant';
                return (
                  <div
                    key={msg.id}
                    ref={isLastUser ? lastUserMessageRef : undefined}
                  >
                    <ChatMessage
                      role={msg.role}
                      content={msg.content}
                      references={msg.references}
                      loading={msg.loading}
                      streaming={msg.streaming}
                      referencesAnchorRef={isLastAssistant ? referencesAnchorRef : undefined}
                      skipReferencesDelay={!isLastAssistant || isInitialLoadRef.current}
                    />
                  </div>
                );
              });
            })()
          )}
          {/* 滚动锚点 */}
          <div ref={messagesEndRef} />
          {/* 底部填充 - 确保用户消息可以滚动到顶部 */}
          {bottomPadding > 0 && (
            <div style={{ height: bottomPadding }} aria-hidden="true" />
          )}
        </div>
      </div>

      {/* 输入区域 */}
      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        disabled={false}
        isGenerating={isGenerating}
        prefillText={prefillQuestion}
      />
    </div>
  );
}
