// components/ui/DateRangePicker.tsx - 日期范围选择器
'use client';

import { useState, useRef, useEffect } from 'react';
import { cn, formatDateISO } from '@/lib/utils';

interface DateRange {
  start: string;
  end: string;
}

interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
  placeholder?: string;
}

// 预设时间范围
const PRESETS = [
  { label: '最近7天', days: 7 },
  { label: '最近30天', days: 30 },
  { label: '最近90天', days: 90 },
  { label: '最近一年', days: 365 },
];

export function DateRangePicker({
  value,
  onChange,
  className,
  placeholder = '选择日期范围'
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState(value?.start || '');
  const [endDate, setEndDate] = useState(value?.end || '');
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 同步外部值
  useEffect(() => {
    setStartDate(value?.start || '');
    setEndDate(value?.end || '');
  }, [value]);

  const handleApply = () => {
    if (startDate && endDate) {
      onChange({ start: startDate, end: endDate });
    } else {
      onChange(undefined);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    setStartDate('');
    setEndDate('');
    onChange(undefined);
    setIsOpen(false);
  };

  const handlePreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    const range = {
      start: formatDateISO(start),
      end: formatDateISO(end)
    };
    setStartDate(range.start);
    setEndDate(range.end);
    onChange(range);
    setIsOpen(false);
  };

  const displayValue = value
    ? `${value.start} ~ ${value.end}`
    : placeholder;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full px-3 py-2 text-left text-sm border rounded-lg',
          'bg-white hover:border-gray-400 transition-colors',
          'flex items-center justify-between gap-2',
          value ? 'text-gray-900' : 'text-gray-500'
        )}
      >
        <span className="truncate">{displayValue}</span>
        <svg
          className="h-4 w-4 text-gray-400 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
          {/* 预设选项 */}
          <div className="flex flex-wrap gap-2 mb-4">
            {PRESETS.map((preset) => (
              <button
                key={preset.days}
                type="button"
                onClick={() => handlePreset(preset.days)}
                className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* 自定义日期输入 */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                开始日期
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                结束日期
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              清除
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              应用
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
