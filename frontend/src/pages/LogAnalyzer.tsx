import { useRef, useState } from "react";
import type { Tab } from "../App";

const COLLECTOR_URL = import.meta.env.VITE_COLLECTOR_URL ?? "http://localhost:8001";

interface BotEntry {
  name: string;
  vendor: string;
  category: string;
  hits: number;
  bytes: number;
}

interface PageEntry {
  path: string;
  total_hits: number;
  bot_hits: number;
  bot_ratio: number;
}

interface ReportData {
  format_detected: string;
  total_lines: number;
  malformed_lines: number;
  total_requests: number;
  bot_requests: number;
  non_ai_crawler_requests: number;
  bot_pct: number;
  total_bytes: number;
  bot_bytes: number;
  estimated_bot_cost_usd: number;
  cost_per_gb: number;
  ai_referral_hits: number;
  bot_breakdown: BotEntry[];
  top_pages: PageEntry[];
  timed_out: boolean;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1_073_741_824) return `${(n / 1_048_576).toFixed(1)} MB`;
  return `${(n / 1_073_741_824).toFixed(2)} GB`;
}

function fmtNum(n: number): string {
  return n.toLocaleString();
}

export default function LogAnalyzer({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [siteKey, setSiteKey] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "polling" | "done" | "error">("idle");
  const [reportId, setReportId] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function pollReport(id: string) {
    try {
      const res = await fetch(`${COLLECTOR_URL}/logs/report/${id}`);
      const data = await res.json();
      if (data.status === "done") {
        stopPoll();
        setReport(data.data as ReportData);
        setStatus("done");
      } else if (data.status === "error") {
        stopPoll();
        setErrorMsg(data.error ?? "Unknown error");
        setStatus("error");
      }
    } catch {
      stopPoll();
      setErrorMsg("Lost connection while polling. Please try again.");
      setStatus("error");
    }
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    const MAX = 100 * 1024 * 1024;
    if (file.size > MAX) {
      setErrorMsg("File exceeds 100 MB limit.");
      setStatus("error");
      return;
    }

    setStatus("uploading");
    setReport(null);
    setErrorMsg("");

    const fd = new FormData();
    fd.append("file", file);
    if (siteKey.trim()) fd.append("site_key", siteKey.trim());

    try {
      const res = await fetch(`${COLLECTOR_URL}/logs/upload`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? "Upload failed");
      }
      const { report_id } = await res.json();
      setReportId(report_id);
      setStatus("polling");
      pollRef.current = setInterval(() => pollReport(report_id), 2000);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Upload failed");
      setStatus("error");
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 16px", fontFamily: "sans-serif" }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Log Analyzer</h2>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>
        Upload your server access log (nginx/Apache combined format) or a Cloudflare CSV export
        to see which AI crawlers are hitting your site and how much bandwidth they consume.
      </p>

      {/* Upload card */}
      <div style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 24,
        background: "#fafafa",
        marginBottom: 24,
      }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 8 }}>
          Log file <span style={{ fontWeight: 400, color: "#9ca3af" }}>(nginx/Apache combined log or Cloudflare CSV, max 100 MB)</span>
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".log,.txt,.csv,.gz"
          style={{ marginBottom: 16 }}
        />

        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>
          Site key <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional — links report to your dashboard)</span>
        </label>
        <input
          type="text"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          value={siteKey}
          onChange={(e) => setSiteKey(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            fontSize: 14,
            marginBottom: 16,
            boxSizing: "border-box",
          }}
        />

        <button
          onClick={handleUpload}
          disabled={status === "uploading" || status === "polling"}
          style={{
            background: status === "uploading" || status === "polling" ? "#9ca3af" : "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 8,
            padding: "10px 24px",
            fontWeight: 600,
            fontSize: 15,
            cursor: status === "uploading" || status === "polling" ? "not-allowed" : "pointer",
          }}
        >
          {status === "uploading" ? "Uploading..." : status === "polling" ? "Analyzing..." : "Analyze Log"}
        </button>
      </div>

      {/* States */}
      {status === "error" && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 16, color: "#dc2626", marginBottom: 24 }}>
          {errorMsg}
        </div>
      )}

      {(status === "uploading" || status === "polling") && (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>&#8987;</div>
          {status === "uploading" ? "Uploading file..." : "Parsing log... this may take a moment for large files."}
          {reportId && <div style={{ fontSize: 12, marginTop: 8, color: "#9ca3af" }}>report id: {reportId}</div>}
        </div>
      )}

      {/* Results */}
      {status === "done" && report && (
        <>
          <Results report={report} />
          <NextStepCard
            title="Set your AI crawler policy"
            body="You can see which bots are hitting you. Now control what they're allowed to do — generate a robots.txt block in minutes."
            buttonLabel="Open Policy Manager →"
            onClick={() => onNavigate("policy")}
          />
        </>
      )}
    </div>
  );
}

function Results({ report }: { report: ReportData }) {
  const botPct = report.bot_pct;
  const color = botPct > 50 ? "#dc2626" : botPct > 20 ? "#d97706" : "#16a34a";

  return (
    <div>
      {report.timed_out && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 12, marginBottom: 16, color: "#92400e" }}>
          Parse timed out — results below are partial (first {fmtNum(report.total_lines)} lines).
        </div>
      )}

      {/* Summary row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Total requests" value={fmtNum(report.total_requests)} />
        <StatCard label="Bot requests" value={fmtNum(report.bot_requests)} accent={color} />
        <StatCard label="Bot share" value={`${botPct}%`} accent={color} />
        <StatCard label="Est. bot bandwidth cost" value={`$${report.estimated_bot_cost_usd.toFixed(4)}`} sub={`@ $${report.cost_per_gb}/GB`} />
        <StatCard label="Bot bandwidth" value={fmtBytes(report.bot_bytes)} />
        <StatCard label="AI referral signals" value={fmtNum(report.ai_referral_hits)} />
        <StatCard label="Malformed lines" value={fmtNum(report.malformed_lines)} />
        <StatCard label="Format detected" value={report.format_detected === "cloudflare_csv" ? "Cloudflare CSV" : "Combined log"} />
      </div>

      {/* Bot breakdown */}
      {report.bot_breakdown.length > 0 && (
        <Section title="AI crawlers found">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                {["Bot", "Vendor", "Category", "Requests", "Bandwidth"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.bot_breakdown.map((b, i) => (
                <tr key={b.name} style={{ background: i % 2 === 0 ? "white" : "#f9fafb" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 600 }}>{b.name}</td>
                  <td style={{ padding: "8px 12px", color: "#6b7280" }}>{b.vendor}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{
                      background: b.category === "search" ? "#dbeafe" : "#fef3c7",
                      color: b.category === "search" ? "#1d4ed8" : "#92400e",
                      borderRadius: 4,
                      padding: "2px 6px",
                      fontSize: 12,
                    }}>{b.category}</span>
                  </td>
                  <td style={{ padding: "8px 12px" }}>{fmtNum(b.hits)}</td>
                  <td style={{ padding: "8px 12px" }}>{fmtBytes(b.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Top pages */}
      {report.top_pages.length > 0 && (
        <Section title="Most scraped pages">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                {["Page", "Total hits", "Bot hits", "Bot ratio"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.top_pages.map((p, i) => (
                <tr key={p.path} style={{ background: i % 2 === 0 ? "white" : "#f9fafb" }}>
                  <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 13 }}>{p.path}</td>
                  <td style={{ padding: "8px 12px" }}>{fmtNum(p.total_hits)}</td>
                  <td style={{ padding: "8px 12px", color: "#dc2626" }}>{fmtNum(p.bot_hits)}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <BotBar ratio={p.bot_ratio} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}

function StatCard({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div style={{
      background: "white",
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      padding: "14px 16px",
    }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent ?? "#111827" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, borderBottom: "1px solid #e5e7eb", paddingBottom: 8 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function NextStepCard({ title, body, buttonLabel, onClick }: { title: string; body: string; buttonLabel: string; onClick: () => void }) {
  return (
    <div style={{ borderLeft: "4px solid #6366f1", borderRadius: 10, padding: "20px 24px", marginTop: 32, background: "#f5f3ff" }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: "#0f172a" }}>⟶ {title}</div>
      <p style={{ color: "#6b7280", marginBottom: 14, marginTop: 0, fontSize: 14 }}>{body}</p>
      <button onClick={onClick} style={{ background: "#6366f1", color: "white", border: "none", borderRadius: 8, padding: "10px 22px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
        {buttonLabel}
      </button>
    </div>
  );
}

function BotBar({ ratio }: { ratio: number }) {
  const pct = Math.round(ratio * 100);
  const color = pct > 75 ? "#dc2626" : pct > 30 ? "#d97706" : "#16a34a";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 12, color: "#6b7280", minWidth: 32 }}>{pct}%</span>
    </div>
  );
}
