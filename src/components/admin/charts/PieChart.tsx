import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const COLORS = ['#F5A020', '#3D2152', '#0F8B47', '#E8671A', '#6B5A7A', '#A0929E', '#FFC857', '#5BBE7A'];

interface PieChartProps {
  data: Array<{ label: string; value: number }>;
  height?: number;
}

export function PieChart({ data, height = 240 }: PieChartProps) {
  if (data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <div className="h-[240px] flex items-center justify-center text-[12px] text-[#A0929E]">
        No data yet
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          stroke="#FFF9F0"
          strokeWidth={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
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
        />
        <Legend
          verticalAlign="bottom"
          iconSize={8}
          wrapperStyle={{
            fontSize: 11,
            fontFamily: 'Montserrat, sans-serif',
            color: '#3D2152',
          }}
        />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}
