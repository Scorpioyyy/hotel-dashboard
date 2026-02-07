// components/charts/RoomTypeChart.tsx - 房型分布饼图
'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Card } from '@/components/ui';
import { getChartColor } from '@/lib/utils';

interface RoomTypeData {
  roomType: string;
  count: number;
}

interface Props {
  data: RoomTypeData[];
  onSliceClick?: (roomType: string) => void;
}

export function RoomTypeChart({ data, onSliceClick }: Props) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  // 按比例从高到低排序
  const sortedData = [...data].sort((a, b) => b.count - a.count);

  const chartData = sortedData.map(d => ({
    name: d.roomType || '未知',
    value: d.count,
    percent: ((d.count / total) * 100).toFixed(1)
  }));

  return (
    <Card title="房型分布" subtitle="各房型的评论占比">
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 20, right: 80, bottom: 20, left: 80 }}>
            <Pie
              data={chartData}
              cx="50%"
              cy="45%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              label={({ name, percent }) => `${name} ${percent}%`}
              labelLine={{ stroke: '#9CA3AF', strokeWidth: 1 }}
              cursor={onSliceClick ? 'pointer' : 'default'}
              onClick={(data) => onSliceClick?.(data.name)}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={getChartColor(index)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
              formatter={(value, name) => [`${value} 条 (${((Number(value) / total) * 100).toFixed(1)}%)`, name]}
            />
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              content={() => (
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
                  {chartData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1.5">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: getChartColor(index) }}
                      />
                      <span className="text-sm text-gray-600">{entry.name}</span>
                    </div>
                  ))}
                </div>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
