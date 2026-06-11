import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';

interface Props { pct: number | null }

export function HumanGauge({ pct }: Props) {
  const value = pct ?? 0;
  const color = value >= 70 ? '#16a34a' : value >= 40 ? '#d97706' : '#dc2626';

  return (
    <div style={{ textAlign: 'center' }}>
      <RadialBarChart
        width={220} height={220}
        cx={110} cy={110}
        innerRadius={72} outerRadius={100}
        startAngle={90} endAngle={-270}
        data={[{ value, fill: color }]}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar dataKey="value" background={{ fill: '#f1f5f9' }} cornerRadius={6} />
      </RadialBarChart>
      <div style={{ marginTop: -110, marginBottom: 90 }}>
        <div style={{ fontSize: 42, fontWeight: 800, color, lineHeight: 1 }}>
          {pct !== null ? `${pct.toFixed(0)}%` : '—'}
        </div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>estimated human</div>
      </div>
    </div>
  );
}
