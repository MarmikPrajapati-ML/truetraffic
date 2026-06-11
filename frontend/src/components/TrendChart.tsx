import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DayData { date: string; human: number; suspected_agent: number; unknown: number; total: number }

interface Props {
  daily: Record<string, { human: number; suspected_agent: number; unknown: number; total: number }>;
}

export function TrendChart({ daily }: Props) {
  const data: DayData[] = Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date: date.slice(5), ...d }));

  if (data.length === 0) {
    return <div style={{ color: '#94a3b8', fontSize: 14, padding: '24px 0' }}>No data yet — embed the snippet to start collecting.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="human" stroke="#16a34a" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="suspected_agent" stroke="#dc2626" dot={false} strokeWidth={2} name="suspected agent" />
        <Line type="monotone" dataKey="unknown" stroke="#94a3b8" dot={false} strokeWidth={1.5} />
      </LineChart>
    </ResponsiveContainer>
  );
}
