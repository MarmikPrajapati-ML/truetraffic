interface Props {
  human: number;
  suspected_agent: number;
  unknown: number;
}

const SEGMENTS = [
  { key: 'human' as const,           label: 'Human',           color: '#16a34a' },
  { key: 'suspected_agent' as const, label: 'Suspected agent', color: '#dc2626' },
  { key: 'unknown' as const,         label: 'Unknown',         color: '#94a3b8' },
];

export function BucketBar({ human, suspected_agent, unknown }: Props) {
  const vals: Props = { human, suspected_agent, unknown };
  const total = human + suspected_agent + unknown || 1;

  return (
    <div>
      <div style={{ display: 'flex', height: 28, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
        {SEGMENTS.map(s => {
          const pct = (vals[s.key] / total) * 100;
          return pct > 0 ? (
            <div
              key={s.key}
              style={{ width: `${pct}%`, background: s.color, transition: 'width 0.4s' }}
              title={`${s.label}: ${pct.toFixed(1)}%`}
            />
          ) : null;
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
        {SEGMENTS.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: 'inline-block' }} />
            <span style={{ color: '#64748b' }}>{s.label}</span>
            <strong>{((vals[s.key] / total) * 100).toFixed(1)}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
