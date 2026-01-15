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
}

export function RoomTypeChart({ data }: Props) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  const chartData = data.map(d => ({
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
              formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
