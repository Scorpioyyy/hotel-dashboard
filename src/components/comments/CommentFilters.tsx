// components/comments/CommentFilters.tsx - 评论筛选组件
'use client';

import { Card, DateRangePicker } from '@/components/ui';
import { STANDARD_CATEGORIES, CATEGORY_GROUPS } from '@/lib/constants';
import { CommentFilters as Filters } from '@/types';
import { cn } from '@/lib/utils';

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  roomTypes: string[];
  travelTypes: string[];
}

export function CommentFilters({ filters, onChange, roomTypes, travelTypes }: Props) {
  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const handleCategoryToggle = (category: string) => {
    const current = filters.categories || [];
    const newCategories = current.includes(category as never)
      ? current.filter((c) => c !== category)
      : [...current, category as never];
    updateFilter('categories', newCategories.length > 0 ? newCategories : undefined);
  };

  const handleScoreToggle = (score: number) => {
    const currentMin = filters.scoreRange?.min || 1;
    const currentMax = filters.scoreRange?.max || 5;

    if (score === currentMin && score === currentMax) {
      // 取消选择
      updateFilter('scoreRange', undefined);
    } else if (!filters.scoreRange) {
      // 首次选择
      updateFilter('scoreRange', { min: score, max: score });
    } else if (score < currentMin) {
      updateFilter('scoreRange', { min: score, max: currentMax });
    } else if (score > currentMax) {
      updateFilter('scoreRange', { min: currentMin, max: score });
    } else {
      // 点击中间的分数，设置为单选
      updateFilter('scoreRange', { min: score, max: score });
    }
  };

  const handleRoomTypeToggle = (roomType: string) => {
    const current = filters.roomTypes || [];
    const newRoomTypes = current.includes(roomType)
      ? current.filter((r) => r !== roomType)
      : [...current, roomType];
    updateFilter('roomTypes', newRoomTypes.length > 0 ? newRoomTypes : undefined);
  };

  const handleTravelTypeToggle = (travelType: string) => {
    const current = filters.travelTypes || [];
    const newTravelTypes = current.includes(travelType)
      ? current.filter((t) => t !== travelType)
      : [...current, travelType];
    updateFilter('travelTypes', newTravelTypes.length > 0 ? newTravelTypes : undefined);
  };

  const clearFilters = () => {
    onChange({});
  };

  const hasFilters = Object.keys(filters).length > 0;

  // 过滤掉"其他"
  const filteredTravelTypes = travelTypes.filter(t => t !== '其他');

  return (
    <Card title="筛选条件">
      <div className="space-y-6">
        {/* 清除按钮 */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="w-full px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            清除所有筛选
          </button>
        )}

        {/* 日期范围 */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">发布日期</h4>
          <DateRangePicker
            value={filters.dateRange}
            onChange={(range) => updateFilter('dateRange', range)}
          />
        </div>

        {/* 评分筛选 */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">评分</h4>
          <div className="flex gap-2">
            {[5, 4, 3, 2, 1].map((score) => {
              const isSelected =
                filters.scoreRange &&
                score >= filters.scoreRange.min &&
                score <= filters.scoreRange.max;
              return (
                <button
                  key={score}
                  onClick={() => handleScoreToggle(score)}
                  className={cn(
                    'flex-1 py-2 text-sm rounded-lg transition-colors',
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  {score}分
                </button>
              );
            })}
          </div>
        </div>

        {/* 房型筛选 */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">房型</h4>
          <div className="flex flex-wrap gap-2">
            {roomTypes.map((roomType) => (
              <button
                key={roomType}
                onClick={() => handleRoomTypeToggle(roomType)}
                className={cn(
                  'px-3 py-1 text-sm rounded-full transition-colors',
                  filters.roomTypes?.includes(roomType)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                {roomType || '未知'}
              </button>
            ))}
          </div>
        </div>

        {/* 出行类型 */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">出行类型</h4>
          <div className="flex flex-wrap gap-2">
            {filteredTravelTypes.map((travelType) => (
              <button
                key={travelType}
                onClick={() => handleTravelTypeToggle(travelType)}
                className={cn(
                  'px-3 py-1 text-sm rounded-full transition-colors',
                  filters.travelTypes?.includes(travelType)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                {travelType || '未知'}
              </button>
            ))}
          </div>
        </div>

        {/* 类别筛选 */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">话题类别</h4>
          {Object.entries(CATEGORY_GROUPS).map(([group, categories]) => (
            <div key={group} className="mb-3">
              <p className="text-sm text-gray-500 mb-1">{group}</p>
              <div className="flex flex-wrap gap-1">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => handleCategoryToggle(category)}
                    className={cn(
                      'px-2 py-1 text-sm rounded-full transition-colors',
                      filters.categories?.includes(category as never)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    )}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 高质量筛选 */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">质量筛选</h4>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.qualityScoreMin === 8}
              onChange={(e) =>
                updateFilter('qualityScoreMin', e.target.checked ? 8 : undefined)
              }
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">仅显示高质量评论</span>
          </label>
        </div>
      </div>
    </Card>
  );
}
