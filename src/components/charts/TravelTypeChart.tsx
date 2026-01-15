// components/charts/TravelTypeChart.tsx - 出行类型分布图
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

interface TravelTypeData {
  travelType: string;
  count: number;
}

interface Props {
  data: TravelTypeData[];
}

export function TravelTypeChart({ data }: Props) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  const chartData = data.map(d => ({
    name: d.travelType || '未知',
    value: d.count,
    percent: ((d.count / total) * 100).toFixed(1)
  }));

  return (
    <Card title="出行类型" subtitle="不同出行目的的评论分布">
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
              startAngle={0}
              endAngle={-360}
              label={({ name, percent }) => `${name} ${percent}%`}
              labelLine={{ stroke: '#9CA3AF', strokeWidth: 1 }}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={getChartColor(index + 5)} />
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
