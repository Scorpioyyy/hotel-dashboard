// components/comments/CommentCard.tsx - 评论卡片组件
'use client';

import { useState, useEffect } from 'react';
import { Comment } from '@/types';
import { Card, StarRating } from '@/components/ui';
import { formatDate, cn } from '@/lib/utils';

interface Props {
  comment: Comment;
  onClick?: () => void;
}

export function CommentCard({ comment, onClick }: Props) {
  const [showFullText, setShowFullText] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const isLongText = comment.comment.length > 200;

  // 打开图片画廊
  const openGallery = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImageIndex(index);
    setShowGallery(true);
  };

  // 关闭画廊
  const closeGallery = () => {
    setShowGallery(false);
  };

  // 键盘导航
  useEffect(() => {
    if (!showGallery) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeGallery();
      if (e.key === 'ArrowLeft' && selectedImageIndex > 0) {
        setSelectedImageIndex(selectedImageIndex - 1);
      }
      if (e.key === 'ArrowRight' && selectedImageIndex < comment.images.length - 1) {
        setSelectedImageIndex(selectedImageIndex + 1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [showGallery, selectedImageIndex, comment.images.length]);

  return (
    <Card
      className={cn(
        'hover:shadow-md transition-shadow cursor-pointer',
        onClick && 'hover:border-blue-300'
      )}
      padding="md"
    >
      <div onClick={onClick}>
        {/* 头部信息 */}
        <div className="flex items-center justify-between mb-2">
          {/* 评分 */}
          <StarRating star={comment.star} size="md" />
          {/* 日期 */}
          <span className="text-sm text-gray-500">{formatDate(comment.publish_date)}</span>
        </div>

        {/* 评论内容 */}
        <div className="mb-3">
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">
            {isLongText && !showFullText
              ? comment.comment.slice(0, 200) + '...'
              : comment.comment}
          </p>
          {isLongText && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFullText(!showFullText);
              }}
              className="text-blue-600 text-sm mt-1 hover:underline"
            >
              {showFullText ? '收起' : '展开全文'}
            </button>
          )}
        </div>

        {/* 图片预览 */}
        {comment.images && comment.images.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto">
            {comment.images.slice(0, 4).map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt={`评论图片 ${idx + 1}`}
                className="w-16 h-16 object-cover rounded-lg flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={(e) => openGallery(idx, e)}
              />
            ))}
            {comment.images.length > 4 && (
              <button
                className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-gray-200 transition-colors"
                onClick={(e) => openGallery(4, e)}
              >
                <span className="text-sm text-gray-500">+{comment.images.length - 4}</span>
              </button>
            )}
          </div>
        )}

        {/* 标签和元信息 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 类别标签 */}
          {comment.categories.slice(0, 5).map((cat) => (
            <span
              key={cat}
              className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
            >
              {cat}
            </span>
          ))}
          {comment.categories.length > 5 && (
            <span className="text-xs text-gray-500">
              +{comment.categories.length - 5}
            </span>
          )}

          {/* 分隔 */}
          <span className="text-gray-300">|</span>

          {/* 元信息 */}
          <span className="text-xs text-gray-500">{comment.room_type}</span>
          {comment.travel_type && comment.travel_type !== '其他' && (
            <span className="text-xs text-gray-500">{comment.travel_type}</span>
          )}

          {/* 分隔 */}
          <span className="text-gray-300">|</span>

          {/* 点赞数 */}
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            {comment.useful_count}
          </span>

          {/* 回复数 */}
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {comment.review_count}
          </span>
        </div>
      </div>

      {/* 图片画廊弹窗 */}
      {showGallery && comment.images && comment.images.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onClick={closeGallery}
        >
          {/* 顶部工具栏 */}
          <div className="flex items-center justify-between p-4 text-white">
            <span className="text-sm">
              {selectedImageIndex + 1} / {comment.images.length}
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
              src={comment.images[selectedImageIndex]}
              alt={`评论图片 ${selectedImageIndex + 1}`}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {/* 左箭头 */}
            {selectedImageIndex > 0 && (
              <button
                className="absolute left-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImageIndex(selectedImageIndex - 1);
                }}
              >
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* 右箭头 */}
            {selectedImageIndex < comment.images.length - 1 && (
              <button
                className="absolute right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImageIndex(selectedImageIndex + 1);
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
              {comment.images.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`缩略图 ${idx + 1}`}
                  className={cn(
                    'w-16 h-16 object-cover rounded cursor-pointer flex-shrink-0 transition-all',
                    idx === selectedImageIndex
                      ? 'ring-2 ring-white opacity-100'
                      : 'opacity-50 hover:opacity-75'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImageIndex(idx);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
