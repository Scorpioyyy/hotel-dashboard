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

interface ChartDataItem {
  fullMonth: string;
  month: string;
  year: string;
  count: number;
  avgScore: number;
}

interface Props {
  data: MonthlyData[];
  onBarClick?: (month: string) => void;
  onLineClick?: (month: string) => void;
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

export function MonthlyTrendChart({ data, onBarClick, onLineClick }: Props) {
  // 保留完整日期用于提取年份
  const chartData = data.map(d => ({
    fullMonth: d.month,
    month: d.month.substring(5), // MM
    year: d.month.substring(0, 4), // YYYY
    count: d.count,
    avgScore: Number(d.avgScore.toFixed(2))
  }));

  return (
    <Card title="月度趋势" subtitle="评论数量与平均评分的月度变化趋势">
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
              wrapperStyle={{ paddingTop: 15 }}
              content={({ payload }) => {
                // 自定义图例顺序：评论数在前，平均分在后
                const sortedPayload = payload ? [...payload].sort((a, b) => {
                  if (a.dataKey === 'count') return -1;
                  if (b.dataKey === 'count') return 1;
                  return 0;
                }) : [];
                return (
                  <div className="flex justify-center gap-6">
                    {sortedPayload.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2">
                        {entry.dataKey === 'count' ? (
                          // 评论数：矩形色块
                          <div className="w-3 h-3" style={{ backgroundColor: entry.color }} />
                        ) : (
                          // 平均分：线条带圆点
                          <svg width="20" height="14" viewBox="0 0 20 14">
                            <line x1="0" y1="7" x2="20" y2="7" stroke={entry.color} strokeWidth="2" />
                            <circle cx="10" cy="7" r="4" fill={entry.color} />
                          </svg>
                        )}
                        <span className="text-sm text-gray-600">
                          {entry.dataKey === 'count' ? '评论数' : '平均分'}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Bar
              yAxisId="left"
              dataKey="count"
              fill="#3B82F6"
              radius={[4, 4, 0, 0]}
              name="count"
              legendType="rect"
              cursor={onBarClick ? 'pointer' : 'default'}
              onClick={(data) => onBarClick?.((data as unknown as ChartDataItem).fullMonth)}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgScore"
              stroke="#F59E0B"
              strokeWidth={2}
              legendType="line"
              dot={(props: { cx?: number; cy?: number; payload?: ChartDataItem }) => {
                const { cx, cy, payload } = props;
                if (cx === undefined || cy === undefined) return <></>;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill="#F59E0B"
                    cursor={onLineClick ? 'pointer' : 'default'}
                    onClick={() => {
                      if (onLineClick && payload?.fullMonth) {
                        onLineClick(payload.fullMonth);
                      }
                    }}
                  />
                );
              }}
              activeDot={(props: { cx?: number; cy?: number; payload?: ChartDataItem }) => {
                const { cx, cy, payload } = props;
                if (cx === undefined || cy === undefined) return <></>;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={6}
                    fill="#F59E0B"
                    cursor={onLineClick ? 'pointer' : 'default'}
                    onClick={() => {
                      if (onLineClick && payload?.fullMonth) {
                        onLineClick(payload.fullMonth);
                      }
                    }}
                  />
                );
              }}
              name="avgScore"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
