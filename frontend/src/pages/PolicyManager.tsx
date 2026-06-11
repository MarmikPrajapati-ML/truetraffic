import { useEffect, useState } from "react";
import type { Tab } from "../App";

const COLLECTOR_URL = import.meta.env.VITE_COLLECTOR_URL ?? "http://localhost:8001";

type Decision = "block" | "allow" | "inherit";

interface AgentInfo {
  name: string;
  vendor: string;
  category: string;
  robots_txt_token: string;
}

interface AgentGroups {
  [category: string]: AgentInfo[];
}

const CATEGORY_LABELS: Record<string, string> = {
  training: "AI Training",
  search: "AI Search",
  browsing: "AI Browsing / Agents",
};

const DECISION_COLORS: Record<Decision, string> = {
  block: "#dc2626",
  allow: "#16a34a",
  inherit: "#6b7280",
};

export default function PolicyManager({
  onNavigate,
  defaultDomain = "",
}: {
  onNavigate: (tab: Tab) => void;
  defaultDomain?: string;
}) {
  const [groups, setGroups] = useState<AgentGroups>({});
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [domain, setDomain] = useState(defaultDomain);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefillMsg, setPrefillMsg] = useState("");
  const [robotsBlock, setRobotsBlock] = useState("");
  const [llmsTxt, setLlmsTxt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copiedRobots, setCopiedRobots] = useState(false);
  const [copiedLlms, setCopiedLlms] = useState(false);

  useEffect(() => {
    fetch(`${COLLECTOR_URL}/policy/agents`)
      .then((r) => r.json())
      .then((data) => {
        const g: AgentGroups = data.groups ?? {};
        setGroups(g);
        const initial: Record<string, Decision> = {};
        Object.values(g)
          .flat()
          .forEach((a) => (initial[a.name] = "inherit"));
        setDecisions(initial);
        if (defaultDomain) {
          setDomain(defaultDomain);
          setTimeout(() => handlePrefillFor(defaultDomain), 50);
        }
      })
      .catch(() => setPrefillMsg("Failed to load agent list."));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePrefillFor(d: string) {
    if (!d.trim()) return;
    setPrefillLoading(true);
    setPrefillMsg("");
    try {
      const res = await fetch(`${COLLECTOR_URL}/policy/prefill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: d.trim() }),
      });
      const data = await res.json();
      if (data.decisions) {
        setDecisions((prev) => ({ ...prev, ...data.decisions }));
        setPrefillMsg("Pre-filled from current robots.txt.");
      }
    } catch {
      setPrefillMsg("Could not fetch robots.txt — decisions unchanged.");
    } finally {
      setPrefillLoading(false);
    }
  }

  async function handlePrefill() {
    await handlePrefillFor(domain);
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`${COLLECTOR_URL}/policy/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions, domain: domain.trim() }),
      });
      const data = await res.json();
      setRobotsBlock(data.robots_block ?? "");
      setLlmsTxt(data.llms_txt ?? "");
    } finally {
      setGenerating(false);
    }
  }

  function setGroupDecision(category: string, decision: Decision) {
    const agents = groups[category] ?? [];
    setDecisions((prev) => {
      const next = { ...prev };
      agents.forEach((a) => (next[a.name] = decision));
      return next;
    });
  }

  function copy(text: string, which: "robots" | "llms") {
    navigator.clipboard.writeText(text).then(() => {
      if (which === "robots") { setCopiedRobots(true); setTimeout(() => setCopiedRobots(false), 2000); }
      else { setCopiedLlms(true); setTimeout(() => setCopiedLlms(false), 2000); }
    });
  }

  const allAgents = Object.values(groups).flat();

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 16px", fontFamily: "sans-serif" }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Policy Manager</h2>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>
        Choose which AI crawlers can access your site, then copy the generated
        robots.txt block and optional llms.txt scaffold.
      </p>

      {/* Domain prefill */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, background: "#fafafa", marginBottom: 24 }}>
        <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>
          Pre-fill from existing robots.txt <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span>
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="yourdomain.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePrefill()}
            style={{ flex: 1, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14 }}
          />
          <button
            onClick={handlePrefill}
            disabled={prefillLoading}
            style={{
              background: prefillLoading ? "#9ca3af" : "#0f172a",
              color: "white", border: "none", borderRadius: 8,
              padding: "8px 18px", fontWeight: 600, cursor: prefillLoading ? "not-allowed" : "pointer",
            }}
          >
            {prefillLoading ? "Fetching..." : "Pre-fill"}
          </button>
        </div>
        {prefillMsg && <p style={{ marginTop: 8, fontSize: 13, color: "#6b7280" }}>{prefillMsg}</p>}
      </div>

      {/* Per-bot toggles */}
      {Object.entries(groups).map(([cat, agents]) => (
        <div key={cat} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
              {CATEGORY_LABELS[cat] ?? cat}
            </h3>
            <div style={{ display: "flex", gap: 6 }}>
              {(["block", "allow", "inherit"] as Decision[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setGroupDecision(cat, d)}
                  style={{
                    background: d === "block" ? "#fef2f2" : d === "allow" ? "#f0fdf4" : "#f9fafb",
                    color: DECISION_COLORS[d],
                    border: `1px solid ${d === "block" ? "#fca5a5" : d === "allow" ? "#86efac" : "#d1d5db"}`,
                    borderRadius: 6,
                    padding: "3px 10px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  All {d}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {agents.map((agent) => (
              <AgentToggle
                key={agent.name}
                agent={agent}
                decision={decisions[agent.name] ?? "inherit"}
                onChange={(d) => setDecisions((p) => ({ ...p, [agent.name]: d }))}
              />
            ))}
          </div>
        </div>
      ))}

      {allAgents.length > 0 && (
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            background: generating ? "#9ca3af" : "#2563eb",
            color: "white", border: "none", borderRadius: 8,
            padding: "12px 28px", fontWeight: 700, fontSize: 15,
            cursor: generating ? "not-allowed" : "pointer",
            marginBottom: 28,
          }}
        >
          {generating ? "Generating..." : "Generate Policy Files"}
        </button>
      )}

      {/* Output */}
      {robotsBlock && (
        <>
          <OutputBox
            title="robots.txt block"
            subtitle="Copy and paste into your existing /robots.txt"
            content={robotsBlock}
            copied={copiedRobots}
            onCopy={() => copy(robotsBlock, "robots")}
          />
          <OutputBox
            title="/llms.txt scaffold"
            subtitle="Save as /llms.txt on your server to disclose AI policy to models"
            content={llmsTxt}
            copied={copiedLlms}
            onCopy={() => copy(llmsTxt, "llms")}
          />
          <NextStepCard
            title="Get alerts when new crawlers appear"
            body="The AI crawler landscape changes fast. Subscribe to be notified automatically when new bots are added to the community list."
            buttonLabel="Open Crawler Watch →"
            onClick={() => onNavigate("watch")}
          />
        </>
      )}
    </div>
  );
}

function AgentToggle({
  agent,
  decision,
  onChange,
}: {
  agent: AgentInfo;
  decision: Decision;
  onChange: (d: Decision) => void;
}) {
  return (
    <div style={{
      border: `1.5px solid ${decision === "block" ? "#fca5a5" : decision === "allow" ? "#86efac" : "#e5e7eb"}`,
      borderRadius: 8,
      padding: "10px 12px",
      background: decision === "block" ? "#fef2f2" : decision === "allow" ? "#f0fdf4" : "white",
    }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{agent.name}</div>
      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>{agent.vendor}</div>
      <div style={{ display: "flex", gap: 4 }}>
        {(["block", "allow", "inherit"] as Decision[]).map((d) => (
          <button
            key={d}
            onClick={() => onChange(d)}
            style={{
              flex: 1,
              background: decision === d ? (d === "block" ? "#dc2626" : d === "allow" ? "#16a34a" : "#6b7280") : "white",
              color: decision === d ? "white" : "#6b7280",
              border: "1px solid #e5e7eb",
              borderRadius: 5,
              padding: "3px 0",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

function OutputBox({
  title, subtitle, content, copied, onCopy,
}: {
  title: string;
  subtitle: string;
  content: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
          <span style={{ color: "#9ca3af", fontSize: 12, marginLeft: 10 }}>{subtitle}</span>
        </div>
        <button
          onClick={onCopy}
          style={{
            background: copied ? "#16a34a" : "#f3f4f6",
            color: copied ? "white" : "#374151",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            padding: "4px 14px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre style={{
        background: "#0f172a", color: "#7dd3fc",
        padding: 16, borderRadius: 8,
        fontSize: 12, overflow: "auto",
        whiteSpace: "pre-wrap", wordBreak: "break-all",
        margin: 0, maxHeight: 320,
      }}>
        {content}
      </pre>
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
