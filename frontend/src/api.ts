const BASE = import.meta.env.VITE_COLLECTOR_URL || 'http://localhost:8001';

export interface StatsResponse {
  site_key: string;
  domain: string;
  period_days: number;
  total_sessions: number;
  human_pct: number | null;
  suspected_agent_pct: number | null;
  unknown_pct: number | null;
  counts: { human: number; suspected_agent: number; unknown: number };
  daily: Record<string, { human: number; suspected_agent: number; unknown: number; total: number }>;
  note: string;
}

export async function fetchStats(siteKey: string, days = 30): Promise<StatsResponse> {
  const res = await fetch(`${BASE}/stats/${siteKey}?days=${days}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function registerSite(domain: string): Promise<{ site_key: string; domain: string }> {
  const res = await fetch(`${BASE}/sites?domain=${encodeURIComponent(domain)}`, { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
