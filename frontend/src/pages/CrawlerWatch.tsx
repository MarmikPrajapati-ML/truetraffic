import { useEffect, useState } from "react";

const COLLECTOR_URL = import.meta.env.VITE_COLLECTOR_URL ?? "http://localhost:8001";

interface ChangelogEntry {
  changed_at: string;
  added: string[];
  removed: string[];
}

export default function CrawlerWatch() {
  const [email, setEmail] = useState("");
  const [subStatus, setSubStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [subMsg, setSubMsg] = useState("");
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [changelogLoading, setChangelogLoading] = useState(true);

  useEffect(() => {
    fetch(`${COLLECTOR_URL}/crawlerwatch/changelog`)
      .then((r) => r.json())
      .then((d) => setChangelog(d.entries ?? []))
      .catch(() => {})
      .finally(() => setChangelogLoading(false));
  }, []);

  async function handleSubscribe() {
    if (!email.trim()) return;
    setSubStatus("loading");
    setSubMsg("");
    try {
      const res = await fetch(`${COLLECTOR_URL}/crawlerwatch/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSubStatus("ok");
        setSubMsg(data.message ?? "Subscribed.");
        setEmail("");
      } else {
        throw new Error(data.detail ?? "Subscription failed");
      }
    } catch (e: unknown) {
      setSubStatus("error");
      setSubMsg(e instanceof Error ? e.message : "Subscription failed");
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 16px", fontFamily: "sans-serif" }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Crawler Watch</h2>
      <p style={{ color: "#6b7280", marginBottom: 28 }}>
        Get notified when new AI crawlers are added to the community list.
        Free, plain-text emails, one-click unsubscribe.
      </p>

      {/* Subscribe card */}
      <div style={{
        border: "1px solid #e5e7eb", borderRadius: 12, padding: 24,
        background: "#fafafa", marginBottom: 32,
      }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Get alerts</div>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 14, marginTop: 0 }}>
          Opt-in only. We store your email only to send alerts.
          Every email contains a one-click unsubscribe link.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubscribe()}
            disabled={subStatus === "ok"}
            style={{
              flex: 1, padding: "9px 14px",
              border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14,
            }}
          />
          <button
            onClick={handleSubscribe}
            disabled={subStatus === "loading" || subStatus === "ok"}
            style={{
              background: subStatus === "ok" ? "#16a34a" : subStatus === "loading" ? "#9ca3af" : "#2563eb",
              color: "white", border: "none", borderRadius: 8,
              padding: "9px 22px", fontWeight: 600, fontSize: 14,
              cursor: subStatus === "loading" || subStatus === "ok" ? "not-allowed" : "pointer",
            }}
          >
            {subStatus === "ok" ? "Subscribed" : subStatus === "loading" ? "..." : "Subscribe"}
          </button>
        </div>

        {subMsg && (
          <div style={{
            marginTop: 12, padding: "10px 14px", borderRadius: 8, fontSize: 13,
            background: subStatus === "ok" ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${subStatus === "ok" ? "#bbf7d0" : "#fca5a5"}`,
            color: subStatus === "ok" ? "#15803d" : "#dc2626",
          }}>
            {subMsg}
          </div>
        )}
      </div>

      {/* Changelog */}
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Crawler changelog</h3>
        {changelogLoading && <p style={{ color: "#9ca3af" }}>Loading...</p>}
        {!changelogLoading && changelog.length === 0 && (
          <div style={{
            border: "1px solid #e5e7eb", borderRadius: 10, padding: "28px 24px",
            textAlign: "center", color: "#9ca3af",
          }}>
            No changes recorded yet. The list is synced daily.
          </div>
        )}
        {changelog.map((entry, i) => (
          <ChangelogCard key={i} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function ChangelogCard({ entry }: { entry: ChangelogEntry }) {
  const date = new Date(entry.changed_at).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });

  return (
    <div style={{
      border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px",
      marginBottom: 12, background: "white",
    }}>
      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 10 }}>{date}</div>
      {entry.added.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <span style={{
            background: "#dcfce7", color: "#15803d",
            borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 600, marginRight: 8,
          }}>
            + Added
          </span>
          {entry.added.map((name) => (
            <span key={name} style={{
              display: "inline-block", background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 4, padding: "2px 8px", fontSize: 12, marginRight: 4, marginTop: 4,
            }}>
              {name}
            </span>
          ))}
        </div>
      )}
      {entry.removed.length > 0 && (
        <div>
          <span style={{
            background: "#fee2e2", color: "#dc2626",
            borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 600, marginRight: 8,
          }}>
            − Removed
          </span>
          {entry.removed.map((name) => (
            <span key={name} style={{
              display: "inline-block", background: "#fef2f2", border: "1px solid #fca5a5",
              borderRadius: 4, padding: "2px 8px", fontSize: 12, marginRight: 4, marginTop: 4,
            }}>
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
