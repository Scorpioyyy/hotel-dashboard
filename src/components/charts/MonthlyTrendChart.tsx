// components/charts/MonthlyTrendChart.tsx - 月度趋势图
'use client';

import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Card } from '@/components/ui';

interface MonthlyData {
  month: string;
  count: number;
  avgScore: number;
}

interface Props {
  data: MonthlyData[];
}

// 自定义X轴刻度组件
interface CustomTickProps {
  x?: number;
  y?: number;
  payload?: { value: string; index: number };
  index?: number;
  visibleTicksCount?: number;
  chartData: Array<{ month: string; year: string }>;
}

function CustomXAxisTick({ x, y, payload, index, chartData }: CustomTickProps) {
  if (!payload || x === undefined || y === undefined || index === undefined) return null;

  const currentYear = chartData[index]?.year || '';
  const month = payload.value;
  const monthNum = parseInt(month, 10);

  // 只显示奇数月
  if (monthNum % 2 === 0) return null;

  // 判断是否是1月（显示年份）
  const isJanuary = month === '01';

  return (
    <g transform={`translate(${x},${y})`}>
      {/* 月份标签 */}
      <text
        x={0}
        y={0}
        dy={14}
        textAnchor="middle"
        fill="#666"
        fontSize={11}
      >
        {month}
      </text>
      {/* 年份标签（仅在1月显示） */}
      {isJanuary && (
        <text
          x={0}
          y={0}
          dy={28}
          textAnchor="middle"
          fill="#666"
          fontSize={11}
          fontWeight={500}
        >
          {currentYear}
        </text>
      )}
    </g>
  );
}

export function MonthlyTrendChart({ data }: Props) {
  // 保留完整日期用于提取年份
  const chartData = data.map(d => ({
    fullMonth: d.month,
    month: d.month.substring(5), // MM
    year: d.month.substring(0, 4), // YYYY
    count: d.count,
    avgScore: Number(d.avgScore.toFixed(2))
  }));

  return (
    <Card title="月度趋势" subtitle="评论数量与平均评分的月度变化">
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 45 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="month"
              tick={(props) => <CustomXAxisTick {...props} chartData={chartData} />}
              tickLine={false}
              interval={0}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              label={{ value: '评论数', angle: -90, position: 'insideLeft', fontSize: 12 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[1, 5]}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              label={{ value: '平均分', angle: 90, position: 'insideRight', fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
              formatter={(value, name) => [
                name === 'count' ? `${value} 条` : Number(value).toFixed(2),
                name === 'count' ? '评论数' : '平均分'
              ]}
            />
            <Legend
              formatter={(value) => (value === 'count' ? '评论数' : '平均分')}
              wrapperStyle={{ paddingTop: 15 }}
            />
            <Bar
              yAxisId="left"
              dataKey="count"
              fill="#3B82F6"
              radius={[4, 4, 0, 0]}
              name="count"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgScore"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={{ fill: '#F59E0B', r: 4 }}
              name="avgScore"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
