import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';

interface BarChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  color?: string;
  height?: number;
  horizontal?: boolean;
}

export function BarChart({ data, color = '#3D2152', height = 240, horizontal = false }: BarChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-[240px] flex items-center justify-center text-[12px] text-[#A0929E]">
        No data yet
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 8, right: 12, left: horizontal ? 80 : 0, bottom: 0 }}
      >
        <CartesianGrid stroke="#3D2152" strokeOpacity={0.06} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 10, fill: '#A0929E' }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 10, fill: '#3D2152' }}
              axisLine={false}
              tickLine={false}
              width={120}
            />
          </>
        ) : (
          <>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#A0929E' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#A0929E' }} axisLine={false} tickLine={false} width={36} />
          </>
        )}
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
          cursor={{ fill: 'rgba(245,160,32,0.08)' }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? color} />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
