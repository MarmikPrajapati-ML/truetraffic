import { useState } from 'react';
import { fetchStats, registerSite, type StatsResponse } from './api';
import { HumanGauge } from './components/HumanGauge';
import { BucketBar } from './components/BucketBar';
import { TrendChart } from './components/TrendChart';
import LogAnalyzer from './pages/LogAnalyzer';
import PolicyManager from './pages/PolicyManager';
import CrawlerWatch from './pages/CrawlerWatch';

export type Tab = 'dashboard' | 'logs' | 'policy' | 'watch';

const COLLECTOR = import.meta.env.VITE_COLLECTOR_URL || 'http://localhost:8001';
const CHECKER = import.meta.env.VITE_CHECKER_URL || 'http://localhost:8000';

const GRADE_COLOR: Record<string, string> = {
  A: '#16a34a', B: '#65a30d', C: '#d97706', D: '#ea580c', F: '#dc2626', 'N/A': '#9ca3af',
};
const GRADE_LABEL: Record<string, string> = {
  A: 'Well protected', B: 'Mostly protected', C: 'Partially open',
  D: 'Mostly open', F: 'Fully open', 'N/A': 'No data',
};
const STATUS_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  disallowed: { bg: '#dcfce7', color: '#15803d', label: 'Blocked' },
  allowed:    { bg: '#fef2f2', color: '#dc2626', label: 'Allowed' },
  not_mentioned: { bg: '#fef3c7', color: '#92400e', label: 'Open' },
};

interface CheckerCrawler {
  name: string; vendor: string; category: string; status: string;
}
interface CheckerResult {
  domain: string; grade: string; robots_txt_found: boolean; llms_txt_found: boolean;
  crawlers: CheckerCrawler[];
  summary: { allowed: number; not_mentioned: number; disallowed: number; total: number };
}

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [analyzedDomain, setAnalyzedDomain] = useState('');

  // Site report state
  const [inputDomain, setInputDomain] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [checkerResult, setCheckerResult] = useState<CheckerResult | null>(null);

  // Traffic / site key state
  const [siteKey, setSiteKey] = useState(localStorage.getItem('tt_site_key') || '');
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [regError, setRegError] = useState('');

  // Inline subscribe state
  const [subEmail, setSubEmail] = useState('');
  const [subStatus, setSubStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [subMsg, setSubMsg] = useState('');

  async function handleAnalyze() {
    const domain = inputDomain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!domain) return;
    setAnalyzing(true);
    setAnalyzeError('');
    setCheckerResult(null);

    const checkerPromise = fetch(`${CHECKER}/check?domain=${encodeURIComponent(domain)}`)
      .then(r => r.json());

    const statsPromise = siteKey
      ? fetchStats(siteKey).catch(() => null)
      : Promise.resolve(null);

    try {
      const [checker, statsData] = await Promise.all([checkerPromise, statsPromise]);
      setCheckerResult(checker);
      setAnalyzedDomain(domain);
      if (statsData) setStats(statsData);
    } catch (e: unknown) {
      setAnalyzeError(e instanceof Error ? e.message : 'Analysis failed. Check the domain and try again.');
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleRegister() {
    const domain = analyzedDomain || inputDomain.trim();
    if (!domain) return;
    setRegLoading(true);
    setRegError('');
    try {
      const res = await registerSite(domain);
      setNewKey(res.site_key);
      setSiteKey(res.site_key);
      localStorage.setItem('tt_site_key', res.site_key);
      setStatsLoading(true);
      const s = await fetchStats(res.site_key);
      setStats(s);
    } catch (e: unknown) {
      setRegError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setRegLoading(false);
      setStatsLoading(false);
    }
  }

  async function handleLoadKey() {
    if (!siteKey) return;
    setStatsLoading(true);
    try {
      const s = await fetchStats(siteKey);
      setStats(s);
      localStorage.setItem('tt_site_key', siteKey);
    } finally {
      setStatsLoading(false);
    }
  }

  async function handleSubscribe() {
    if (!subEmail.trim()) return;
    setSubStatus('loading');
    try {
      const res = await fetch(`${COLLECTOR}/crawlerwatch/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: subEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSubStatus('ok');
        setSubMsg(data.message ?? 'Subscribed.');
        setSubEmail('');
      } else {
        throw new Error(data.detail ?? 'Subscription failed');
      }
    } catch (e: unknown) {
      setSubStatus('error');
      setSubMsg(e instanceof Error ? e.message : 'Subscription failed');
    }
  }

  function goToPolicy() {
    setAnalyzedDomain(analyzedDomain || inputDomain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
    setTab('policy');
  }

  const s = stats;

  return (
    <div style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Nav */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 28px', height: 56, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          onClick={() => setTab('dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginRight: 8 }}
        >
          <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14 }}>T</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>TrueTraffic</span>
        </div>
        {([
          ['dashboard', 'Site Report'],
          ['logs', 'Log Analyzer'],
          ['policy', 'Policy Manager'],
          ['watch', 'Crawler Watch'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontWeight: tab === t ? 700 : 400,
            color: tab === t ? '#6366f1' : '#64748b',
            fontSize: 14,
            borderBottom: tab === t ? '2px solid #6366f1' : '2px solid transparent',
            padding: '4px 2px',
          }}>
            {label}
          </button>
        ))}
      </nav>

      {/* Page content */}
      {tab === 'logs'   && <LogAnalyzer onNavigate={setTab} />}
      {tab === 'policy' && <PolicyManager onNavigate={setTab} defaultDomain={analyzedDomain} />}
      {tab === 'watch'  && <CrawlerWatch onNavigate={setTab} />}

      {tab === 'dashboard' && (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 80px' }}>

          {/* Hero */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 10px', color: '#0f172a' }}>
              How is AI traffic affecting your website?
            </h1>
            <p style={{ color: '#64748b', fontSize: 15, margin: '0 0 24px' }}>
              Enter your domain to get a complete picture — AI exposure grade, live traffic, and your crawler policy.
            </p>
            <div style={{ display: 'flex', gap: 8, maxWidth: 540, margin: '0 auto' }}>
              <input
                value={inputDomain}
                onChange={e => setInputDomain(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                placeholder="yourdomain.com"
                style={{ flex: 1, border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '11px 16px', fontSize: 15, outline: 'none', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}
              />
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                style={{ background: analyzing ? '#9ca3af' : '#6366f1', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontWeight: 700, fontSize: 15, cursor: analyzing ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
              >
                {analyzing ? 'Analyzing…' : 'Analyze →'}
              </button>
            </div>
            {analyzeError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 10 }}>{analyzeError}</p>}
          </div>

          {/* How it works — shown before first analysis */}
          {!checkerResult && !analyzing && (
            <div style={{ marginBottom: 40 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textAlign: 'center', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>How it works</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
                {[
                  { n: '1', icon: '🔍', title: 'Check AI exposure', desc: 'See your grade and which AI crawlers can access your site right now.', tab: null },
                  { n: '2', icon: '📊', title: 'Track live traffic', desc: 'Measure the real human vs. bot split from JS-executing visitors.', tab: null },
                  { n: '3', icon: '📋', title: 'Analyze server logs', desc: 'Upload nginx or Cloudflare logs for a full historical bot audit.', tab: 'logs' as Tab },
                  { n: '4', icon: '🔒', title: 'Set your policy', desc: 'Generate robots.txt rules to allow or block specific AI crawlers.', tab: 'policy' as Tab },
                  { n: '5', icon: '🔔', title: 'Stay updated', desc: 'Get email alerts when new AI crawlers appear in the wild.', tab: 'watch' as Tab },
                ].map(step => (
                  <div
                    key={step.n}
                    onClick={() => step.tab && setTab(step.tab)}
                    style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px', cursor: step.tab ? 'pointer' : 'default', transition: 'border-color .15s' }}
                    onMouseEnter={e => step.tab && ((e.currentTarget as HTMLDivElement).style.borderColor = '#6366f1')}
                    onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0')}
                  >
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{step.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: '#0f172a' }}>
                      <span style={{ color: '#6366f1', marginRight: 4 }}>{step.n}.</span>{step.title}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{step.desc}</div>
                    {step.tab && <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600, marginTop: 8 }}>Open →</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Exposure section */}
          {checkerResult && (
            <Section title="AI Exposure" icon="🔍">
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {/* Grade ring */}
                <div style={{ textAlign: 'center', minWidth: 100 }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%', margin: '0 auto 8px',
                    border: `6px solid ${GRADE_COLOR[checkerResult.grade] ?? '#9ca3af'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, fontWeight: 800, color: GRADE_COLOR[checkerResult.grade] ?? '#9ca3af',
                  }}>
                    {checkerResult.grade}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: GRADE_COLOR[checkerResult.grade] ?? '#9ca3af' }}>
                    {GRADE_LABEL[checkerResult.grade] ?? ''}
                  </div>
                </div>

                {/* Status + summary */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                    <Pill ok={checkerResult.robots_txt_found} label="robots.txt" />
                    <Pill ok={checkerResult.llms_txt_found} label="llms.txt" />
                    <span style={{ background: '#f1f5f9', color: '#475569', borderRadius: 20, padding: '3px 10px', fontSize: 12 }}>
                      {checkerResult.summary.disallowed} blocked · {checkerResult.summary.allowed + checkerResult.summary.not_mentioned} accessible · {checkerResult.summary.total} total
                    </span>
                  </div>

                  {/* Crawler grid */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {checkerResult.crawlers.map(c => {
                      const st = STATUS_COLOR[c.status] ?? STATUS_COLOR.not_mentioned;
                      return (
                        <div key={c.name} style={{ background: st.bg, borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</span>
                          <span style={{ marginLeft: 6, color: st.color, fontWeight: 600 }}>{st.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                <ActionButton label="Customize policy →" onClick={goToPolicy} primary />
                <ActionButton label="Upload server logs →" onClick={() => setTab('logs')} />
              </div>
            </Section>
          )}

          {/* Live Traffic section */}
          {checkerResult && (
            <Section title="Live Traffic" icon="📊">
              {s ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>
                    <div style={{ textAlign: 'center' }}>
                      <HumanGauge pct={s.human_pct} />
                      <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{s.domain}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{s.total_sessions} sessions · {s.period_days}d</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#475569' }}>Traffic breakdown</div>
                        <BucketBar human={s.counts.human} suspected_agent={s.counts.suspected_agent} unknown={s.counts.unknown} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#475569' }}>30-day trend</div>
                        <TrendChart daily={s.daily} />
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 14, background: '#f8fafc', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
                    <strong>Badge embed:</strong>
                    <img src={`${COLLECTOR}/badge/${s.site_key}.svg`} alt="human share" style={{ display: 'block', margin: '6px 0' }} />
                    <code style={{ color: '#6366f1', fontSize: 11 }}>{`<img src="${COLLECTOR}/badge/${s.site_key}.svg" alt="human share">`}</code>
                  </div>
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, marginBottom: 0 }}>{s.note}</p>
                </>
              ) : (
                <div>
                  <p style={{ color: '#64748b', fontSize: 14, marginTop: 0 }}>
                    Add the TrueTraffic snippet to your site to measure real human vs. bot traffic from JavaScript-executing visitors.
                  </p>

                  {!newKey && !showKeyInput && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={handleRegister}
                        disabled={regLoading}
                        style={{ background: regLoading ? '#9ca3af' : '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 600, fontSize: 14, cursor: regLoading ? 'not-allowed' : 'pointer' }}
                      >
                        {regLoading ? 'Registering…' : `Register ${analyzedDomain || 'site'}`}
                      </button>
                      <button
                        onClick={() => setShowKeyInput(true)}
                        style={{ background: 'white', color: '#6366f1', border: '1px solid #6366f1', borderRadius: 8, padding: '9px 16px', fontSize: 14, cursor: 'pointer' }}
                      >
                        I have a site key
                      </button>
                    </div>
                  )}

                  {showKeyInput && !newKey && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input
                        value={siteKey}
                        onChange={e => setSiteKey(e.target.value)}
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        style={{ flex: 1, border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontFamily: 'monospace', outline: 'none' }}
                      />
                      <button
                        onClick={handleLoadKey}
                        disabled={statsLoading}
                        style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {statsLoading ? '…' : 'Load'}
                      </button>
                    </div>
                  )}

                  {regError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{regError}</p>}

                  {newKey && (
                    <div style={{ marginTop: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', fontSize: 13 }}>
                      <strong>Your site key:</strong> <code style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: 4 }}>{newKey}</code>
                      <div style={{ marginTop: 8, color: '#64748b' }}>
                        Paste into your HTML:
                        <pre style={{ background: '#0f172a', color: '#7dd3fc', padding: 12, borderRadius: 6, marginTop: 6, fontSize: 11, overflow: 'auto' }}>{`<script src="hs.js"\n  data-site-key="${newKey}"\n  data-collector="${COLLECTOR}"\n></script>`}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Section>
          )}

          {/* Quick Actions */}
          {checkerResult && (
            <Section title="Explore tools" icon="🛠️">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                {[
                  { icon: '📋', title: 'Log Analyzer', desc: 'Upload nginx or Cloudflare logs to audit historical bot traffic and estimate bandwidth cost.', tab: 'logs' as Tab },
                  { icon: '🔒', title: 'Policy Manager', desc: 'Generate a robots.txt block and llms.txt file to control exactly which crawlers are allowed.', tab: 'policy' as Tab },
                  { icon: '🔔', title: 'Crawler Watch', desc: 'Subscribe to email alerts when new AI crawlers are added to the community list.', tab: 'watch' as Tab },
                ].map(tool => (
                  <div
                    key={tool.tab}
                    onClick={() => setTab(tool.tab)}
                    style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#6366f1'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0'}
                  >
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{tool.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: '#0f172a' }}>{tool.title}</div>
                    <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{tool.desc}</div>
                    <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 600, marginTop: 10 }}>Open →</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Inline subscribe */}
          {checkerResult && (
            <Section title="Get crawler alerts" icon="🔔">
              <p style={{ color: '#64748b', fontSize: 14, marginTop: 0, marginBottom: 14 }}>
                The AI crawler landscape changes weekly. Get a plain-text email whenever a new crawler is added to the community list. One-click unsubscribe.
              </p>
              {subStatus !== 'ok' ? (
                <div style={{ display: 'flex', gap: 8, maxWidth: 420 }}>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={subEmail}
                    onChange={e => setSubEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubscribe()}
                    style={{ flex: 1, padding: '9px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' }}
                  />
                  <button
                    onClick={handleSubscribe}
                    disabled={subStatus === 'loading'}
                    style={{ background: subStatus === 'loading' ? '#9ca3af' : '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {subStatus === 'loading' ? '…' : 'Subscribe'}
                  </button>
                </div>
              ) : (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#15803d' }}>
                  {subMsg}
                </div>
              )}
              {subStatus === 'error' && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{subMsg}</p>}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '22px 24px', marginBottom: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span>{title}
      </div>
      {children}
    </div>
  );
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{
      background: ok ? '#f0fdf4' : '#f1f5f9',
      color: ok ? '#15803d' : '#94a3b8',
      border: `1px solid ${ok ? '#bbf7d0' : '#e2e8f0'}`,
      borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600,
    }}>
      {ok ? '✓' : '–'} {label}
    </span>
  );
}

function ActionButton({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick} style={{
      background: primary ? '#6366f1' : 'white',
      color: primary ? 'white' : '#6366f1',
      border: `1px solid ${primary ? '#6366f1' : '#6366f1'}`,
      borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
    }}>
      {label}
    </button>
  );
}
