// components/qa/ChatInput.tsx - 聊天输入组件
'use client';

import { useState, useEffect, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isGenerating?: boolean;
  placeholder?: string;
  prefillText?: string; // 预填充文本（终止后回填用户问题）
}

// 预设问题
const PRESET_QUESTIONS = [
  '酒店的早餐怎么样?',
  '房间设施如何?',
  '服务态度好吗?',
  '交通方便吗?',
  '性价比高吗?'
];

export function ChatInput({ onSend, onStop, disabled, isGenerating, placeholder = '输入您的问题...', prefillText }: Props) {
  const [message, setMessage] = useState('');

  // 当 prefillText 变化时，填充到输入框
  useEffect(() => {
    if (prefillText) {
      setMessage(prefillText);
    }
  }, [prefillText]);

  const handleSend = () => {
    const trimmed = message.trim();
    // 只有在有内容、未禁用、且不在生成中时才能发送
    if (trimmed && !disabled && !isGenerating) {
      onSend(trimmed);
      setMessage('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePresetClick = (question: string) => {
    // 只有在未禁用且不在生成中时才能发送预设问题
    if (!disabled && !isGenerating) {
      setMessage(''); // 清空输入框（包括预填充的文本）
      onSend(question);
    }
  };

  return (
    <div className="border-t bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      {/* 预设问题 */}
      <div className="flex flex-wrap gap-2 mb-3">
        {PRESET_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => handlePresetClick(q)}
            disabled={disabled || isGenerating}
            className={cn(
              'px-3 py-1 text-sm rounded-full transition-colors',
              disabled || isGenerating
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
            )}
          >
            {q}
          </button>
        ))}
      </div>

      {/* 输入区域 */}
      <div className="flex gap-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            'flex-1 resize-none px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500',
            disabled && 'bg-gray-100 cursor-not-allowed'
          )}
          style={{ minHeight: '48px', maxHeight: '120px' }}
        />
        {isGenerating ? (
          <button
            onClick={onStop}
            className="px-6 py-3 rounded-xl font-medium transition-colors bg-red-500 text-white hover:bg-red-600"
          >
            终止
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            className={cn(
              'px-6 py-3 rounded-xl font-medium transition-colors',
              disabled || !message.trim()
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            )}
          >
            发送
          </button>
        )}
      </div>

      <p className="mt-2 text-xs text-gray-400 text-center">
        回答基于真实住客评论生成，仅供参考
      </p>
      </div>
    </div>
  );
}
