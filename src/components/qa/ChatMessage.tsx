// components/qa/ChatMessage.tsx - 聊天消息组件
'use client';

import { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import { Comment } from '@/types';
import { cn, formatDate, getScoreStars, getScoreColor } from '@/lib/utils';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  references?: Comment[];
  loading?: boolean;
  streaming?: boolean;
  referencesAnchorRef?: React.RefObject<HTMLParagraphElement | null>;
}

interface GalleryState {
  commentId: string;
  images: string[];
  selectedIndex: number;
}

export function ChatMessage({ role, content, references, loading, streaming, referencesAnchorRef }: Props) {
  const isUser = role === 'user';
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [gallery, setGallery] = useState<GalleryState | null>(null);

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
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
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
              <span className="text-sm text-gray-500">检索中</span>
            </div>
          ) : isUser ? (
            <p className="text-white whitespace-pre-wrap">{content}</p>
          ) : (
            <div className="prose prose-sm max-w-none text-gray-700">
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
                {content}
              </Markdown>
              {streaming && (
                <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
              )}
            </div>
          )}
        </div>

        {/* 引用评论 */}
        {references && references.length > 0 && !loading && (
          <div className="mt-3 space-y-2">
            <p ref={referencesAnchorRef} className="text-xs text-gray-500">参考了以下 {references.length} 条评论:</p>
            <div className="space-y-2">
              {references.map((ref, idx) => {
                const isExpanded = expandedIds.has(ref._id);
                return (
                  <div
                    key={ref._id}
                    className="bg-gray-50 rounded-lg p-3 text-left border border-gray-100"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">#{idx + 1}</span>
                        <span className={cn('text-xs', getScoreColor(ref.score))}>
                          {getScoreStars(ref.score)}
                        </span>
                        <span className="text-xs text-gray-400">{formatDate(ref.publish_date)}</span>
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                          </svg>
                          {ref.useful_count}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleExpand(ref._id)}
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
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
                          <img
                            key={imgIdx}
                            src={img}
                            alt={`评论配图 ${imgIdx + 1}`}
                            className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity cursor-pointer"
                            onClick={() => openGallery(ref._id, ref.images, imgIdx)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
            <div className="flex-1 flex items-center justify-center p-4 min-h-0">
              <img
                src={gallery.images[gallery.selectedIndex]}
                alt={`评论图片 ${gallery.selectedIndex + 1}`}
                className="max-w-full max-h-full object-contain"
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
                  <img
                    key={idx}
                    src={url}
                    alt={`缩略图 ${idx + 1}`}
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
