import { useState } from 'react';
import { fetchStats, registerSite, type StatsResponse } from './api';
import { HumanGauge } from './components/HumanGauge';
import { BucketBar } from './components/BucketBar';
import { TrendChart } from './components/TrendChart';
import LogAnalyzer from './pages/LogAnalyzer';

type Tab = 'dashboard' | 'logs';

const COLLECTOR = import.meta.env.VITE_COLLECTOR_URL || 'http://localhost:8001';

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [siteKey, setSiteKey] = useState(localStorage.getItem('tt_site_key') || '');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [regDomain, setRegDomain] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [newKey, setNewKey] = useState('');

  async function load(key: string) {
    setLoading(true);
    setError('');
    try {
      const data = await fetchStats(key);
      setStats(data);
      localStorage.setItem('tt_site_key', key);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }

  async function register() {
    if (!regDomain.trim()) return;
    setRegLoading(true);
    try {
      const res = await registerSite(regDomain.trim());
      setNewKey(res.site_key);
      setSiteKey(res.site_key);
      localStorage.setItem('tt_site_key', res.site_key);
      await load(res.site_key);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setRegLoading(false);
    }
  }

  const s = stats;

  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14 }}>T</div>
        <span style={{ fontWeight: 700, fontSize: 16, marginRight: 8 }}>TrueTraffic</span>
        {(['dashboard', 'logs'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: tab === t ? 700 : 400,
            color: tab === t ? '#6366f1' : '#64748b',
            fontSize: 14,
            borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent',
            padding: '4px 2px',
          }}>
            {t === 'dashboard' ? 'Dashboard' : 'Log Analyzer'}
          </button>
        ))}
      </nav>

      {tab === 'logs' && <LogAnalyzer />}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 80px', display: tab === 'dashboard' ? 'block' : 'none' }}>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>Register your website</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={regDomain} onChange={e => setRegDomain(e.target.value)} placeholder="yourdomain.com"
              onKeyDown={e => e.key === 'Enter' && register()}
              style={{ flex: 1, border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 14px', fontSize: 14, outline: 'none' }} />
            <button onClick={register} disabled={regLoading}
              style={{ background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, cursor: 'pointer' }}>
              {regLoading ? '…' : 'Get site key'}
            </button>
          </div>
          {newKey && (
            <div style={{ marginTop: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
              <strong>Your site key:</strong> <code style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: 4 }}>{newKey}</code>
              <div style={{ marginTop: 8, color: '#64748b' }}>
                Add to your site:
                <pre style={{ background: '#0f172a', color: '#7dd3fc', padding: 12, borderRadius: 6, marginTop: 6, fontSize: 12, overflow: 'auto' }}>{`<script src="hs.js"\n  data-site-key="${newKey}"\n  data-collector="${COLLECTOR}"\n></script>`}</pre>
              </div>
            </div>
          )}
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', marginBottom: 32 }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>View dashboard</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={siteKey} onChange={e => setSiteKey(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              onKeyDown={e => e.key === 'Enter' && load(siteKey)}
              style={{ flex: 1, border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontFamily: 'monospace', outline: 'none' }} />
            <button onClick={() => load(siteKey)} disabled={loading}
              style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, cursor: 'pointer' }}>
              {loading ? 'Loading…' : 'Load stats'}
            </button>
          </div>
        </div>

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 18px', color: '#dc2626', marginBottom: 20 }}>{error}</div>}

        {s && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, marginBottom: 20, alignItems: 'start' }}>
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 16px', textAlign: 'center' }}>
                <HumanGauge pct={s.human_pct} />
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{s.domain}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{s.total_sessions} sessions · {s.period_days}d</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
                  <div style={{ fontWeight: 700, marginBottom: 14 }}>Traffic breakdown</div>
                  <BucketBar human={s.counts.human} suspected_agent={s.counts.suspected_agent} unknown={s.counts.unknown} />
                </div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
                  <div style={{ fontWeight: 700, marginBottom: 14 }}>30-day trend</div>
                  <TrendChart daily={s.daily} />
                </div>
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Embeddable badge</div>
              <img src={`${COLLECTOR}/badge/${s.site_key}.svg`} alt="human share badge" style={{ display: 'block', marginBottom: 10 }} />
              <pre style={{ background: '#0f172a', color: '#7dd3fc', padding: 12, borderRadius: 6, fontSize: 12, overflow: 'auto' }}>{`<img src="${COLLECTOR}/badge/${s.site_key}.svg" alt="human share">`}</pre>
            </div>

            <p style={{ fontSize: 12, color: '#94a3b8' }}>{s.note}</p>
          </>
        )}
      </div>
    </div>
  );
}
