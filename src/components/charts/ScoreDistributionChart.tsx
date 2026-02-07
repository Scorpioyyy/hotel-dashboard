// components/charts/ScoreDistributionChart.tsx - 评分分布图
'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { Card } from '@/components/ui';

interface ScoreData {
  score: number;
  count: number;
}

interface Props {
  data: ScoreData[];
  onBarClick?: (score: number) => void;
}

interface ChartDataItem {
  name: string;
  value: number;
  score: number;
}

const COLORS = ['#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E'];

export function ScoreDistributionChart({ data, onBarClick }: Props) {
  const chartData = data.map(d => ({
    name: `${d.score}星`,
    value: d.count,
    score: d.score
  }));

  return (
    <Card title="评分分布" subtitle="各评分等级的评论数量">
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
              formatter={(value) => [`${value} 条`, '评论数']}
            />
            <Bar
              dataKey="value"
              radius={[4, 4, 0, 0]}
              cursor={onBarClick ? 'pointer' : 'default'}
              onClick={(data) => onBarClick?.((data as unknown as ChartDataItem).score)}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[entry.score - 1]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
