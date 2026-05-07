import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface LineChartProps {
  data: Array<{ date: string; value: number }>;
  color?: string;
  formatValue?: (v: number) => string;
  height?: number;
}

export function LineChart({ data, color = '#F5A020', formatValue, height = 200 }: LineChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-[12px] text-[#A0929E]">
        No data yet
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#3D2152" strokeOpacity={0.06} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: '#A0929E' }}
          tickFormatter={(d) => d.slice(5)}
          axisLine={false}
          tickLine={false}
          minTickGap={20}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#A0929E' }}
          axisLine={false}
          tickLine={false}
          width={36}
          tickFormatter={(v) => (formatValue ? formatValue(Number(v)) : String(v))}
        />
        <Tooltip
          contentStyle={{
            background: '#FFF9F0',
            border: '1px solid rgba(61,33,82,0.15)',
            borderRadius: 8,
            fontSize: 11,
            fontFamily: 'Montserrat, sans-serif',
            color: '#3D2152',
            padding: '6px 10px',
          }}
          formatter={(v: number | string) => [formatValue ? formatValue(Number(v)) : String(v), '']}
          labelStyle={{ color: '#A0929E', fontSize: 10 }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
