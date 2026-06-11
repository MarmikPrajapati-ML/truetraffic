# TrueTraffic — Complete Feature Reference

Every feature in the app, organised by tool. Includes what it does, how to use it, the underlying behaviour, and any constraints.

---

## Feature Index

1. [Site Report Hub](#1-site-report-hub)
2. [AI Exposure Checker](#2-ai-exposure-checker)
3. [Live Traffic Monitor](#3-live-traffic-monitor)
4. [Site Registration](#4-site-registration)
5. [Log Analyzer](#5-log-analyzer)
6. [Policy Manager](#6-policy-manager)
7. [Crawler Watch](#7-crawler-watch)
8. [Embeddable Badge](#8-embeddable-badge)
9. [WordPress Plugin](#9-wordpress-plugin)
10. [API Endpoints Reference](#10-api-endpoints-reference)
11. [JS Snippet Reference](#11-js-snippet-reference)

---

## 1. Site Report Hub

**Location:** Dashboard tab (default view)

The Site Report is the central hub that connects all tools. Enter a domain once and get a consolidated view without switching tabs.

### Features

| Feature | Description |
|---------|-------------|
| **Domain input** | Accepts `yourdomain.com`, `https://yourdomain.com`, or any URL — strips scheme and path automatically |
| **Parallel analysis** | Checker + traffic stats fetched simultaneously via `Promise.all` for fastest results |
| **Analyzing spinner** | Button turns grey and shows "Analyzing…" while requests are in flight |
| **Error display** | If the checker or network fails, a red error message appears below the input |
| **"How it works" pre-analysis state** | Before the first analysis, 5 numbered cards explain the product and link to the relevant tool page |

### "How it works" cards

| Card | Clickable? | Navigates to |
|------|-----------|-------------|
| 1. Check AI exposure | No | (performed here) |
| 2. Track live traffic | No | (performed here) |
| 3. Analyze server logs | Yes | Log Analyzer tab |
| 4. Set your policy | Yes | Policy Manager tab |
| 5. Stay updated | Yes | Crawler Watch tab |

---

## 2. AI Exposure Checker

**Location:** Site Report → AI Exposure section (appears after analysis)

**Backend:** `GET /check?domain=...` on the Checker API (port 8000)

Checks which of the 20 tracked AI crawlers can currently access your site based on your robots.txt.

### Grade ring

A coloured ring showing your overall AI exposure grade:

| Grade | Colour | Fraction of crawlers with open access |
|-------|--------|--------------------------------------|
| A | `#16a34a` (green) | 0% |
| B | `#65a30d` (yellow-green) | 1–25% |
| C | `#d97706` (amber) | 26–50% |
| D | `#ea580c` (orange) | 51–75% |
| F | `#dc2626` (red) | 76–100% |

Below the ring: plain-English label ("Well protected", "Mostly protected", "Partially open", "Mostly open", "Fully open").

### Status pills

Three pills below the grade:
- **robots.txt ✓** (green when found) / **robots.txt –** (grey when not found)
- **llms.txt ✓** (green when found) / **llms.txt –** (grey when not found)
- Summary count: "{n} blocked · {n} accessible · {total} total"

### Crawler grid

Each of the 20 tracked AI crawlers shown as a colour-coded card:

| Status | Card background | Pill text | Pill colour |
|--------|----------------|-----------|------------|
| `disallowed` | Green tint (`#dcfce7`) | "Blocked" | Green (`#15803d`) |
| `allowed` | Red tint (`#fef2f2`) | "Allowed" | Red (`#dc2626`) |
| `not_mentioned` | Amber tint (`#fef3c7`) | "Open" | Amber (`#92400e`) |

### Action buttons

- **Customize policy →** (primary, indigo) — navigates to Policy Manager with domain pre-filled; Policy Manager auto-triggers robots.txt prefill
- **Upload server logs →** (secondary) — navigates to Log Analyzer tab

### Tracked crawlers (20 total)

| Crawler | Vendor | Category |
|---------|--------|----------|
| GPTBot | OpenAI | training |
| ChatGPT-User | OpenAI | browsing |
| OAI-SearchBot | OpenAI | search |
| ClaudeBot | Anthropic | training |
| anthropic-ai | Anthropic | training |
| Claude-Web | Anthropic | browsing |
| CCBot | Common Crawl | training |
| PerplexityBot | Perplexity AI | search |
| Google-Extended | Google | training |
| Bytespider | ByteDance | training |
| FacebookBot | Meta | training |
| Applebot-Extended | Apple | training |
| cohere-ai | Cohere | training |
| Omgilibot | Webz.io | training |
| Webzio-Extended | Webz.io | training |
| YouBot | You.com | search |
| Diffbot | Diffbot | training |
| Amazonbot | Amazon | training |
| img2dataset | LAION | training |
| Timpibot | Timpi.io | search |

All 20 are in `data/ai-agents.json`. The list syncs weekly from the ai-robots-txt community project via Crawler Watch.

---

## 3. Live Traffic Monitor

**Location:** Site Report → Live Traffic section (appears after analysis)

**Backend:** `GET /stats/{site_key}?days=30` on the Collector API (port 8001)

Shows real-time human vs. suspected-agent share from the JS snippet, with a 30-day historical trend.

### States

**No site key (new site):**
- "Add the TrueTraffic snippet" message
- **Register {domain}** button → calls `/sites?domain=...`; shows embed code on success
- **I have a site key** link → shows a UUID input + **Load** button

**Loading stats:**
- "Loading traffic data…" spinner shown while fetching (prevents jarring empty state flash)

**Stats loaded:**

| Component | Description |
|-----------|-------------|
| **Human Gauge** | Radial bar chart showing estimated human %. Green ≥70%, amber 40–69%, red <40%. |
| **Domain label** | The registered domain name below the gauge |
| **Session count** | Total sessions in the period (e.g. "1,432 sessions · 30d") |
| **Traffic breakdown bar** | Horizontal 3-segment bar: green (human), red (suspected agent), grey (unknown). Each segment's width = its share. Hover for exact %. |
| **Breakdown legend** | Three rows showing label, colour, and percentage for each bucket |
| **30-day trend chart** | Line chart with three series (human/suspected_agent/unknown). X-axis = date (MM-DD). Responsive, no dots, 200px height. |
| **Badge embed** | SVG badge preview + copyable `<img>` tag |
| **Note** | Small text explaining the conservative classification policy |

### Period

Default: 30 days. Maximum configurable via `?days=90`.

### Data update frequency

Visits are stored as they arrive. The stats endpoint aggregates on-demand — data is up-to-date within seconds of a visitor arriving.

---

## 4. Site Registration

**Location:** Site Report → Live Traffic section; also exposed as API endpoint

**Backend:** `POST /sites?domain={domain}`

Creates a site record in the database and returns a UUID site key that links the JS snippet to your dashboard.

### Behaviour

- Domain is lowercased and stripped of `www.` prefix before storage
- Domain is validated against a DNS-label regex (rejects invalid formats)
- Returns: `{ "site_key": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", "domain": "example.com" }`
- Site key is stored in `localStorage` under `tt_site_key` for persistence between sessions

### Embed code displayed after registration

```html
<script src="hs.js"
  data-site-key="YOUR-SITE-KEY"
  data-collector="http://localhost:8001"
></script>
```

Paste this into the `<head>` of every page. For production, replace the collector URL with your deployed API URL.

### Constraints

- Rate limit: 20 registrations per IP per minute
- Domain max length: 255 characters
- Any domain can register multiple times (each gets a different site key)

---

## 5. Log Analyzer

**Location:** Log Analyzer tab

**Backend:** `POST /logs/upload` + `GET /logs/report/{id}`

Accepts server access log files and identifies AI crawler traffic.

### Upload

| Field | Description |
|-------|-------------|
| **Log file** | nginx/Apache combined log or Cloudflare CSV export. Max 100 MB. |
| **Site key** | Optional UUID. Links the analysis report to your dashboard. |

**Supported file extensions:** `.log`, `.txt`, `.csv`, `.gz`

**Format auto-detection:** First line checked for Cloudflare CSV headers (`ClientRequestUserAgent`, `ClientIP`). Anything else treated as combined log format.

### Processing

Uploaded files are:
1. Written to a temp file with restricted permissions (mode 0o600)
2. Queued as a background task
3. Parsed line by line (streaming — no full-file load into memory)
4. Temp file deleted immediately after parsing (regardless of success or failure)

The upload endpoint returns a `report_id` immediately. The frontend polls `GET /logs/report/{report_id}` every 2 seconds.

### Report states

| Status | Meaning |
|--------|---------|
| `pending` | Still parsing in background |
| `done` | Analysis complete; full report in response |
| `error` | Parsing failed; `error` field contains message |

### Result metrics

| Metric | Description |
|--------|-------------|
| `format_detected` | `combined` or `cloudflare_csv` |
| `total_lines` | Lines processed |
| `malformed_lines` | Lines the parser could not parse |
| `total_requests` | Parseable HTTP requests |
| `bot_requests` | Requests matched to a known AI crawler UA |
| `human_requests` | `total_requests − bot_requests` |
| `bot_pct` | Bot requests as % of total |
| `total_bytes` | Total response bytes |
| `bot_bytes` | Bytes served to AI crawlers |
| `estimated_bot_cost_usd` | `bot_bytes / 1GB × cost_per_gb` |
| `cost_per_gb` | CDN rate used (default $0.09) |
| `ai_referral_hits` | Requests with an AI platform in the Referer header |
| `bot_breakdown` | List of crawlers: name, vendor, category, hits, bytes |
| `top_pages` | Top pages by bot hits: path, total_hits, bot_hits, bot_ratio |
| `timed_out` | True if parsing hit the 120-second wall-clock limit |

### Limits

| Limit | Default | Env var |
|-------|---------|---------|
| Max file size | 100 MB | `LOG_MAX_UPLOAD_BYTES` |
| Max lines | 10,000,000 | `LOG_MAX_LINES` |
| Wall-clock timeout | 120 seconds | `LOG_PARSE_TIMEOUT` |

### Next step card

After results appear: "Set your AI crawler policy →" navigates to Policy Manager.

---

## 6. Policy Manager

**Location:** Policy Manager tab

**Backend:** `/policy/agents`, `/policy/prefill`, `/policy/generate`

Generates robots.txt blocks and llms.txt scaffolds based on per-crawler decisions.

### Pre-fill from robots.txt

| Field | Description |
|-------|-------------|
| **Domain input** | Enter your domain (or auto-filled from Site Report) |
| **Pre-fill button** | Fetches your robots.txt and maps each known crawler to block/allow/inherit |

Auto-fill trigger: when navigating from Site Report → Policy Manager via "Customize policy →", the domain is pre-filled and the prefill is automatically triggered after the agent list loads (50ms delay to allow state settlement).

### Per-crawler toggles

Each of the 20 crawlers shows as a card with three buttons:

| Button | Generated output |
|--------|-----------------|
| **block** | `User-agent: {token}\nDisallow: /` |
| **allow** | `User-agent: {token}\nAllow: /` |
| **inherit** | *(omitted — crawler follows wildcard rules)* |

Card visual state:
- Block selected: red border + red background
- Allow selected: green border + green background
- Inherit: white background, grey border

### Category bulk actions

Each category header (AI Training / AI Search / AI Browsing) has three group buttons:
- **All block** — sets every crawler in the category to block
- **All allow** — sets every crawler in the category to allow
- **All inherit** — resets every crawler in the category to inherit

### Generate policy files

Click **Generate Policy Files** to call `/policy/generate` with the current decisions.

**robots.txt block output:**
- Header comment: `# Block/allow AI crawlers (generated by TrueTraffic)`
- One `User-agent:` + `Disallow:/Allow:` block per crawler with a non-inherit decision
- Formatted for copy-paste into existing robots.txt
- Copy button with 2-second "Copied!" confirmation

**llms.txt scaffold output:**
- Header with domain name and generation date
- Three sections: blocked crawlers, allowed crawlers, inheriting crawlers
- Copy button with 2-second confirmation

### Next step card

After policy files appear: "Get alerts when new crawlers appear →" navigates to Crawler Watch.

---

## 7. Crawler Watch

**Location:** Crawler Watch tab

**Backend:** `/crawlerwatch/subscribe`, `/crawlerwatch/unsubscribe/{token}`, `/crawlerwatch/changelog`

Monitors the community AI crawler list and emails subscribers when it changes.

### Email subscription

| Field | Constraint |
|-------|-----------|
| Email address | RFC-compatible format, max 255 chars, stored lowercased |
| Rate limit | 5 subscriptions per IP per minute |

**Duplicate handling:** If you subscribe with an email already in the database, the response is `"Already subscribed"` — no duplicate record is created.

**Privacy:** Email is stored only for alert delivery. No marketing use. Every email includes a one-click unsubscribe link.

### Unsubscribe

`GET /crawlerwatch/unsubscribe/{token}` — returns an HTML confirmation page. The token is a UUID generated at subscription time and embedded in all email footers.

Rate limit: 10 unsubscribes per IP per minute (prevents enumeration attacks).

### Changelog display

The changelog section loads `GET /crawlerwatch/changelog` on page load. Each entry shows:
- Date of change (human-readable: "Jun 11, 2026")
- Green "+ Added" pill with crawler names (new bots)
- Red "− Removed" pill with crawler names (deprecated bots)

Empty state: "No changes recorded yet. The list is synced daily."

### Sync schedule

The sync endpoint `POST /crawlerwatch/sync` must be called by an external scheduler (cron job, GitHub Actions, etc.) to run the daily update. It requires the `X-Sync-Secret` header to match the `SYNC_SECRET` environment variable. The endpoint is disabled (returns 403) if `SYNC_SECRET` is not set.

**Recommended cron:** Run once per day. The sync is idempotent — running it multiple times on the same day updates the snapshot in place without creating duplicate changelog entries.

### Next step card (after subscribe)

"Back to your site report →" navigates to Site Report tab.

### Inline subscribe on Site Report

The Crawler Watch subscribe form also appears at the bottom of the Site Report tab, so users can subscribe without leaving the hub view.

---

## 8. Embeddable Badge

**Location:** Site Report → Live Traffic section (after stats load); also available via API

**API:** `GET /badge/{site_key}.svg`

An SVG badge that displays your current human traffic share. Updates in real time as new visits are processed.

### Badge appearance

| Human share | Badge colour | Label |
|-------------|-------------|-------|
| ≥ 70% | Green (`#16a34a`) | "{n}% human" |
| 40–69% | Amber (`#d97706`) | "{n}% human" |
| < 40% | Red (`#dc2626`) | "{n}% human" |
| No data | Grey (`#6b7280`) | "no data yet" |

### Embed code

```html
<img src="https://your-collector-url/badge/YOUR-SITE-KEY.svg" alt="human share">
```

The badge is served with `Cache-Control: no-cache` headers so it reflects current data without stale caching. Width adjusts automatically to fit the label text.

### Rate limit

60 badge requests per IP per minute.

---

## 9. WordPress Plugin

**Location:** `wordpress-plugin/truetraffic/`

**WordPress version:** 5.0+  
**PHP version:** 7.4+  
**License:** GPLv2 or later

### Settings page

**Location in WP admin:** Settings → TrueTraffic

| Field | Description | Validation |
|-------|-------------|-----------|
| Site Key | UUID from TrueTraffic dashboard | Must match `[0-9a-f-]{36}` |
| Collector URL | URL of your collector API | `esc_url_raw()` + trailing slash stripped |

Form is protected with a WordPress nonce. Submission goes through `options.php` (standard WP settings API). Saving requires `manage_options` capability (admin only).

### Snippet injection

When Site Key is configured, the plugin hooks into `wp_head` and injects:

```html
<script src="{collector_url}/hs.js"
  data-site-key="{site_key}"
  data-collector="{collector_url}"
  defer>
</script>
```

The `defer` attribute ensures the snippet does not block page rendering.

### Admin notice

If the plugin is activated but the Site Key is not configured, a yellow admin notice appears on all admin pages (except the TrueTraffic settings page itself) with a link to the settings. The notice is dismissible.

### Status display

The settings page shows:
- **Green checkmark + "Snippet is active"** when Site Key is configured
- **Snippet preview** (HTML code showing what will be injected)
- **Yellow warning + "No Site Key configured"** when not configured

---

## 10. API Endpoints Reference

### Checker API (port 8000)

| Method | Path | Rate limit | Description |
|--------|------|-----------|-------------|
| GET | `/health` | 60/min | Health check — returns `{"status":"ok"}` |
| GET | `/check?domain=...` | 30/min | Analyze domain robots.txt — returns grade, crawler statuses |
| GET | `/` | — | Serve legacy checker HTML frontend |

**`/check` response shape:**
```json
{
  "domain": "example.com",
  "grade": "B",
  "robots_txt_found": true,
  "llms_txt_found": false,
  "crawlers": [
    { "name": "GPTBot", "vendor": "OpenAI", "category": "training", "status": "disallowed", "declared": true }
  ],
  "summary": { "allowed": 0, "not_mentioned": 4, "disallowed": 16, "total": 20 },
  "suggested_robots_block": "# Block AI crawlers...\nUser-agent: ..."
}
```

### Collector API (port 8001)

| Method | Path | Rate limit | Auth | Description |
|--------|------|-----------|------|-------------|
| GET | `/health` | 60/min | — | DB health check |
| POST | `/sites?domain=...` | 20/min | — | Register site, get site key |
| POST | `/beacon` | 120/min | — | Ingest JS snippet beacon |
| GET | `/stats/{site_key}` | 60/min | — | Get 30-day traffic stats |
| GET | `/badge/{site_key}.svg` | 60/min | — | Embeddable SVG badge |
| POST | `/logs/upload` | 5/min | — | Upload server log for analysis |
| GET | `/logs/report/{id}` | 30/min | — | Poll log analysis status |
| GET | `/policy/agents` | 60/min | — | List known AI crawlers by category |
| POST | `/policy/prefill` | 10/min | — | Parse domain robots.txt into decisions |
| POST | `/policy/generate` | 30/min | — | Generate robots.txt + llms.txt |
| POST | `/crawlerwatch/subscribe` | 5/min | — | Subscribe email to alerts |
| GET | `/crawlerwatch/unsubscribe/{token}` | 10/min | — | One-click unsubscribe |
| GET | `/crawlerwatch/changelog` | 30/min | — | List recent crawler list changes |
| POST | `/crawlerwatch/sync` | 1/hour | `X-Sync-Secret` header | Trigger upstream sync |

---

## 11. JS Snippet Reference

**File:** `snippet/hs.js`  
**Size:** < 5 KB gzipped  
**Compatibility:** ES5 (IE 11+, all modern browsers)  
**Dependencies:** None  

### Configuration attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-site-key` | Yes | UUID from site registration |
| `data-collector` | Yes | Base URL of collector API (no trailing slash) |

### Collected signals

| Signal | Type | Range | Description |
|--------|------|-------|-------------|
| `webdriver` | bool | — | `navigator.webdriver` value |
| `headless_ua` | bool | — | "headless" found in navigator.userAgent |
| `languages_empty` | bool | — | `navigator.languages` empty or missing |
| `plugins_empty` | bool | — | `navigator.plugins.length === 0` |
| `had_pointer` | bool | — | Any mouse/touch event in first 5s |
| `pointer_count` | int | 0–10000 | Pointer events in first 5s |
| `scroll_depth_pct` | int | 0–100 | Max scroll depth reached |
| `time_to_first_scroll_ms` | float\|null | 0–3,600,000 | Time to first scroll from page load |
| `paint_to_interaction_ms` | float\|null | 0–3,600,000 | FCP to first pointer event |
| `viewport_w` | int\|null | 0–20000 | `window.innerWidth` |
| `viewport_h` | int\|null | 0–20000 | `window.innerHeight` |
| `screen_w` | int\|null | 0–20000 | `screen.width` |
| `screen_h` | int\|null | 0–20000 | `screen.height` |
| `screen_viewport_ratio_ok` | bool | — | screen ≥ viewport in both dimensions |
| `ts` | int | — | Unix timestamp (ms) at page load |

### Delivery

- **Method:** `navigator.sendBeacon()` — non-blocking, fires in background
- **Trigger:** `pagehide` event (tab close, navigate away) OR `beforeunload`
- **Fallback:** If `sendBeacon` is not available, signal is silently dropped
- **Deduplication:** `sent` flag ensures the beacon fires exactly once per page load
- **Failure mode:** All errors caught and suppressed — the snippet never throws

### Privacy properties

- No cookies read or written
- No localStorage read or written
- No external resources loaded
- No user identifiers of any kind
- No IP address collected (IP is not in the payload — only the server sees it, and it is not stored)
- All signals are non-identifying when taken individually or together
