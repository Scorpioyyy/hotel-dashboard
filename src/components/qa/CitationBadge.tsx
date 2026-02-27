'use client';

import { useState } from 'react';

interface CitationBadgeProps {
  refs: number[];
  onClickRef?: (refNum: number) => void;
  disabled?: boolean; // 流式输出中禁用交互
  hasMore?: boolean; // 是否有更多引用（显示"等"）
}

export function CitationBadge({ refs, onClickRef, disabled, hasMore }: CitationBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const label = refs.join(',');
  const suffix = hasMore ? ' 等' : '';
  const tooltipText = refs.length === 1 && !hasMore
    ? `引用评论 ${refs[0]}`
    : `引用评论 ${refs.join(', ')}${suffix}`;

  const handleClick = () => {
    if (disabled) return;
    onClickRef?.(refs[0]);
  };

  return (
    <span className="relative inline-flex items-baseline">
      <button
        type="button"
        className={`inline-flex items-center justify-center
          min-w-[1.1rem] h-[1.1rem] px-1
          text-[10px] font-medium leading-none
          text-blue-600 bg-blue-50 border border-blue-200
          rounded-full transition-colors
          align-super -translate-y-1
          ${disabled ? 'cursor-default' : 'cursor-pointer hover:bg-blue-100 hover:border-blue-300'}`}
        onClick={handleClick}
        onMouseEnter={() => !disabled && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label={tooltipText}
      >
        {label}
      </button>
      {showTooltip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5
          px-2 py-1 text-xs text-white bg-gray-800 rounded
          whitespace-nowrap pointer-events-none z-10">
          {tooltipText}
        </span>
      )}
    </span>
  );
}
