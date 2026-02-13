// components/qa/ChatMessage.tsx - 聊天消息组件
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Markdown from 'react-markdown';
import { Comment } from '@/types';
import { cn, formatDate } from '@/lib/utils';
import { StarRating } from '@/components/ui';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  references?: Comment[];
  loading?: boolean;
  loadingText?: string; // 动态加载状态文本（"思考中"/"检索中"）
  streaming?: boolean;
  referencesAnchorRef?: React.RefObject<HTMLParagraphElement | null>;
  skipReferencesDelay?: boolean; // 跳过参考评论延迟显示（用于历史记录恢复）
}

interface GalleryState {
  commentId: string;
  images: string[];
  selectedIndex: number;
}

// 默认展示的评论条数（超参数）
const DEFAULT_VISIBLE_COUNT = 3;
// 参考评论内容延迟显示时间（毫秒）
const REFERENCES_CONTENT_DELAY = 500;

export function ChatMessage({ role, content, references, loading, loadingText, streaming, referencesAnchorRef, skipReferencesDelay }: Props) {
  const isUser = role === 'user';
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [gallery, setGallery] = useState<GalleryState | null>(null);
  const [showAllReferences, setShowAllReferences] = useState(false);
  // 如果跳过延迟，初始就显示；否则初始隐藏
  const [showReferencesContent, setShowReferencesContent] = useState(skipReferencesDelay || false);
  const [lastReferencesLength, setLastReferencesLength] = useState(skipReferencesDelay ? (references?.length || 0) : 0);

  // 当 references 首次出现或数量变化时，延迟显示内容（跳过延迟时不执行）
  useEffect(() => {
    if (skipReferencesDelay) return;

    const currentLength = references?.length || 0;

    // 如果 references 刚出现（从无到有）
    if (currentLength > 0 && lastReferencesLength === 0) {
      setShowReferencesContent(false);
      const timer = setTimeout(() => {
        setShowReferencesContent(true);
      }, REFERENCES_CONTENT_DELAY);
      return () => clearTimeout(timer);
    }

    // 更新记录的长度
    setLastReferencesLength(currentLength);
  }, [references?.length, lastReferencesLength, skipReferencesDelay]);

  // 计算可见和折叠的评论
  const totalReferences = references?.length || 0;
  const hasCollapsedReferences = totalReferences > DEFAULT_VISIBLE_COUNT;
  const collapsedCount = hasCollapsedReferences ? totalReferences - DEFAULT_VISIBLE_COUNT : 0;
  const visibleReferences = showAllReferences
    ? references
    : references?.slice(0, DEFAULT_VISIBLE_COUNT);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // 打开图片画廊
  const openGallery = (commentId: string, images: string[], index: number) => {
    setGallery({ commentId, images, selectedIndex: index });
  };

  // 关闭画廊
  const closeGallery = () => {
    setGallery(null);
  };

  // 键盘导航
  useEffect(() => {
    if (!gallery) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeGallery();
      if (e.key === 'ArrowLeft' && gallery.selectedIndex > 0) {
        setGallery({ ...gallery, selectedIndex: gallery.selectedIndex - 1 });
      }
      if (e.key === 'ArrowRight' && gallery.selectedIndex < gallery.images.length - 1) {
        setGallery({ ...gallery, selectedIndex: gallery.selectedIndex + 1 });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [gallery]);

  return (
    <div className={cn('flex gap-4', isUser && 'flex-row-reverse')}>
      {/* 头像 */}
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
          isUser ? 'bg-blue-600' : 'bg-gray-100'
        )}
      >
        {isUser ? (
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ) : (
          /* 客服头像 - 简洁耳麦图标 */
          <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {/* 耳机头带 */}
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            {/* 左耳机 */}
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z" />
            {/* 右耳机 */}
            <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
          </svg>
        )}
      </div>

      {/* 消息内容 */}
      <div className={cn('flex-1 max-w-[80%]', isUser && 'text-right')}>
        <div
          className={cn(
            'inline-block rounded-2xl px-4 py-3 text-left',
            isUser
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-200'
          )}
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm text-gray-500">{loadingText || '思考中'}</span>
            </div>
          ) : isUser ? (
            <p className="text-white whitespace-pre-wrap">{content}</p>
          ) : (
            <div className="prose prose-sm max-w-none text-gray-700">
              {(() => {
                // 解析终止消息标签
                const stoppedMatch = content.match(/<stopped>(.*?)<\/stopped>/);
                const mainContent = content.replace(/<stopped>.*?<\/stopped>/, '').trimEnd();
                const stoppedMessage = stoppedMatch ? stoppedMatch[1] : null;

                return (
                  <>
                    {mainContent && (
                      <Markdown
                        components={{
                          // 自定义样式
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                          li: ({ children }) => <li className="mb-1">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-2 border-gray-300 pl-3 italic text-gray-600 my-2">
                              {children}
                            </blockquote>
                          ),
                        }}
                      >
                        {mainContent}
                      </Markdown>
                    )}
                    {stoppedMessage && (
                      <p className={cn('text-gray-400 italic', mainContent && 'mt-4')}>
                        {stoppedMessage}
                      </p>
                    )}
                  </>
                );
              })()}
              {streaming && (
                <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
              )}
            </div>
          )}
        </div>

        {/* 引用评论 */}
        {references && references.length > 0 && !loading && (
          <div className="mt-3 space-y-2">
            <p ref={referencesAnchorRef} className="text-xs text-gray-500">参考了以下 {totalReferences} 条评论：</p>
            {showReferencesContent && (
            <div className="space-y-2">
              {visibleReferences?.map((ref, idx) => {
                const isExpanded = expandedIds.has(ref._id);
                return (
                  <div
                    key={ref._id}
                    className="bg-gray-50 rounded-lg p-3 text-left border border-gray-100"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-500">#{idx + 1}</span>
                        <StarRating star={ref.star} size="sm" />
                        <span className="text-xs text-gray-400">{formatDate(ref.publish_date)}</span>
                        <span className="text-xs text-gray-400">{ref.room_type}</span>
                        {/* 点赞数 */}
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                          </svg>
                          {ref.useful_count}
                        </span>
                        {/* 回复数 */}
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          {ref.review_count}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleExpand(ref._id)}
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 flex-shrink-0"
                      >
                        {isExpanded ? '收起' : '展开详情'}
                        <svg
                          className={cn('w-3 h-3 transition-transform', isExpanded && 'rotate-180')}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    <p className={cn('text-sm text-gray-600', !isExpanded && 'line-clamp-3')}>
                      {ref.comment}
                    </p>
                    {isExpanded && ref.images && ref.images.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {ref.images.map((img, imgIdx) => (
                          <Image
                            key={imgIdx}
                            src={img}
                            alt={`评论配图 ${imgIdx + 1}`}
                            width={80}
                            height={80}
                            unoptimized
                            className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity cursor-pointer"
                            onClick={() => openGallery(ref._id, ref.images, imgIdx)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* 展开/收起更多评论按钮 */}
              {hasCollapsedReferences && (
                <button
                  onClick={() => setShowAllReferences(!showAllReferences)}
                  className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors flex items-center justify-center gap-1"
                >
                  {showAllReferences ? (
                    <>
                      收起更多评论
                      <svg className="w-4 h-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  ) : (
                    <>
                      展开剩余 {collapsedCount} 条评论
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  )}
                </button>
              )}
            </div>
            )}
          </div>
        )}

        {/* 图片画廊弹窗 */}
        {gallery && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex flex-col"
            onClick={closeGallery}
          >
            {/* 顶部工具栏 */}
            <div className="flex items-center justify-between p-4 text-white">
              <span className="text-sm">
                {gallery.selectedIndex + 1} / {gallery.images.length}
              </span>
              <button
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                onClick={closeGallery}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 主图区域 */}
            <div className="flex-1 flex items-center justify-center p-4 min-h-0 relative">
              <Image
                src={gallery.images[gallery.selectedIndex]}
                alt={`评论图片 ${gallery.selectedIndex + 1}`}
                fill
                unoptimized
                className="object-contain"
                onClick={(e) => e.stopPropagation()}
              />

              {/* 左箭头 */}
              {gallery.selectedIndex > 0 && (
                <button
                  className="absolute left-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setGallery({ ...gallery, selectedIndex: gallery.selectedIndex - 1 });
                  }}
                >
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}

              {/* 右箭头 */}
              {gallery.selectedIndex < gallery.images.length - 1 && (
                <button
                  className="absolute right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setGallery({ ...gallery, selectedIndex: gallery.selectedIndex + 1 });
                  }}
                >
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>

            {/* 缩略图列表 */}
            <div className="p-4 bg-black/50">
              <div className="flex gap-2 overflow-x-auto justify-center pb-2">
                {gallery.images.map((url, idx) => (
                  <Image
                    key={idx}
                    src={url}
                    alt={`缩略图 ${idx + 1}`}
                    width={64}
                    height={64}
                    unoptimized
                    className={cn(
                      'w-16 h-16 object-cover rounded cursor-pointer flex-shrink-0 transition-all',
                      idx === gallery.selectedIndex
                        ? 'ring-2 ring-white opacity-100'
                        : 'opacity-50 hover:opacity-75'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setGallery({ ...gallery, selectedIndex: idx });
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
