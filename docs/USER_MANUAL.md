# TrueTraffic — User Manual

This guide walks through every feature of the TrueTraffic dashboard from the perspective of a first-time user. No technical background is required.

---

## Getting Started

### Option A — Docker (recommended, one command)

```bash
git clone https://github.com/MarmikPrajapati-ML/truetraffic
cd truetraffic
docker compose up
```

Then open **http://localhost:3000** in your browser.

### Option B — Run services manually

```bash
# Terminal 1 — Checker API (AI exposure grading)
PYTHONPATH=. uvicorn checker.api.main:app --port 8000 --reload

# Terminal 2 — Collector API (traffic data + all tools)
PYTHONPATH=. uvicorn collector.api.main:app --port 8001 --reload

# Terminal 3 — Frontend dashboard
cd frontend && npm install && npm run dev
# Opens at http://localhost:5173 (or 5174 if that port is taken)
```

---

## The Dashboard — Five Tools in One

The navigation bar at the top of the page has four tabs:

| Tab | What it does |
|-----|-------------|
| **Site Report** | Your homepage — enter a domain to see everything at once |
| **Log Analyzer** | Upload server access logs for historical bot analysis |
| **Policy Manager** | Generate robots.txt and llms.txt for your site |
| **Crawler Watch** | Subscribe to email alerts for new AI crawlers |

---

## Tab 1 — Site Report

The Site Report is the starting point. Enter your domain once and get a complete view.

### Step 1: Enter your domain

Type your domain in the input box (e.g. `example.com` — no `https://` needed) and click **Analyze →** or press Enter.

What happens behind the scenes:
- The checker API fetches your `robots.txt` and `llms.txt` from your server
- Your live traffic data is loaded (if you have a site key)
- Both happen in parallel, so results appear quickly

### Step 2: Read your AI Exposure grade

Once the analysis runs, you will see a coloured ring with a letter grade:

| Grade | Colour | Meaning |
|-------|--------|---------|
| **A** | Green | 0% of tracked AI crawlers have open access |
| **B** | Yellow-green | 1–25% of crawlers can access your site |
| **C** | Amber | 26–50% open access |
| **D** | Orange | 51–75% open access |
| **F** | Red | 76–100% of crawlers have open access |

Below the grade ring you will see:
- **robots.txt found ✓** — whether a robots.txt file was detected
- **llms.txt found ✓** — whether an llms.txt file was detected (optional emerging standard)
- A count: e.g. "3 blocked · 17 accessible · 20 total"

### Step 3: Read the crawler grid

Below the grade, every tracked AI crawler is shown as a small card with a colour-coded status pill:

| Pill colour | Status | Meaning |
|-------------|--------|---------|
| Green — **Blocked** | `disallowed` | Your robots.txt explicitly blocks this crawler, or a wildcard rule blocks all unnamed crawlers |
| Red — **Allowed** | `allowed` | Your robots.txt explicitly allows this crawler |
| Amber — **Open** | `not_mentioned` | This crawler is not addressed in your robots.txt and no wildcard rule blocks it — it can access your site |

**Note:** "Blocked" means your robots.txt says not to crawl — it does not mean the crawler is technically prevented. The robots.txt protocol is advisory.

### Step 4: Act on the results

Two buttons appear below the crawler grid:
- **Customize policy →** — opens the Policy Manager with your domain pre-filled and your existing robots.txt automatically loaded
- **Upload server logs →** — opens the Log Analyzer

### Step 5: Live Traffic section

This section shows your real-time human vs. bot split from your JS snippet data.

**If you do not have a site key yet:**

Click **Register {yourdomain}** to get a site key instantly. You will then see an HTML code snippet:

```html
<script src="hs.js"
  data-site-key="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  data-collector="http://localhost:8001"
></script>
```

Paste this into the `<head>` of every page you want to track. Once visitors start arriving, data will appear here.

**If you already have a site key:**

Click **I have a site key**, paste your UUID, and click **Load**. Your dashboard appears immediately.

**Reading the live traffic display:**

- **The gauge** (large percentage ring): your estimated human share. Green = mostly human. Amber = mixed. Red = predominantly bots.
- **Traffic breakdown bar**: a horizontal bar split into three coloured segments — green (human), red (suspected agent), grey (unknown).
- **30-day trend chart**: three lines over time showing how each bucket has changed day by day.

**Badge embed:** A small embeddable SVG badge is shown at the bottom of the live traffic section. Copy the `<img>` tag and paste it anywhere on your site to publicly display your human share.

### Step 6: Quick Actions row

Three cards link to the detailed tool pages:
- **Log Analyzer** — historical bot audit from server logs
- **Policy Manager** — generate robots.txt / llms.txt
- **Crawler Watch** — subscribe to new-crawler alerts

### Step 7: Inline subscribe

At the bottom of the Site Report, there is an email subscribe form for Crawler Watch alerts. You do not need to go to a separate page — enter your email and click Subscribe.

---

## Tab 2 — Log Analyzer

The Log Analyzer ingests your web server's access logs and shows which AI crawlers hit your site, how much bandwidth they consumed, and which pages they scraped most.

### What log formats are supported?

| Format | How to get it |
|--------|--------------|
| **nginx combined log** | `/var/log/nginx/access.log` |
| **Apache combined log** | `/var/log/apache2/access.log` |
| **Cloudflare CSV export** | Cloudflare dashboard → Analytics → Logs → Export |

The format is detected automatically — you do not need to specify it.

### Step-by-step

**Step 1:** Click **Choose File** and select your log file. Maximum size is 100 MB. For larger logs, split them first: `split -l 1000000 access.log chunk_`.

**Step 2 (optional):** Enter your Site Key to link the analysis report to your dashboard. This is not required for the analysis to run.

**Step 3:** Click **Analyze Log**. The file is uploaded and parsed in the background. A report ID appears below the button. The page polls every 2 seconds for the result.

**Step 4:** Read the results.

#### Summary metrics

| Metric | What it means |
|--------|--------------|
| **Total requests** | All HTTP requests in the log |
| **Bot requests** | Requests matched to a known AI crawler User-Agent |
| **Bot share** | Bot requests as a percentage of total |
| **Bot bandwidth** | Total bytes transferred to AI crawlers |
| **Est. bot bandwidth cost** | Bot bytes × your CDN rate (default $0.09/GB) |
| **AI referral signals** | Requests where the Referer header contained an AI platform domain (chat.openai.com, claude.ai, etc.) — indicates AI-generated organic traffic |
| **Malformed lines** | Lines the parser could not parse (usually partial writes at log rotation) |
| **Format detected** | Whether combined log or Cloudflare CSV was auto-detected |

A **parse timed out** warning appears if the file was large enough to hit the 120-second wall clock limit. Results are still shown; they cover the lines parsed before timeout.

#### AI crawlers found (table)

Lists every AI crawler that appeared in the log:

| Column | Meaning |
|--------|---------|
| **Bot** | Crawler name (from ai-agents.json) |
| **Vendor** | Company that operates the crawler |
| **Category** | training / search / browsing |
| **Requests** | Number of requests from this crawler |
| **Bandwidth** | Bytes served to this crawler |

#### Most scraped pages (table)

Top pages by bot hit count:

| Column | Meaning |
|--------|---------|
| **Page** | URL path |
| **Total hits** | All requests (human + bot) to this page |
| **Bot hits** | Requests from known AI crawlers |
| **Bot ratio** | Bot hits as a fraction of total, visualised as a coloured bar |

### Next step

After reviewing log results, a **Set your AI crawler policy →** card appears. Click it to jump to Policy Manager with your domain pre-filled.

---

## Tab 3 — Policy Manager

The Policy Manager lets you decide which AI crawlers can access your site and generates the exact robots.txt text and optional llms.txt to implement that decision.

### Step 1: Pre-fill from your existing robots.txt (optional)

If your domain already has a robots.txt, enter it in the **Pre-fill from existing robots.txt** field and click **Pre-fill**. The Policy Manager will:
1. Fetch your current robots.txt
2. Parse it against the known crawler list
3. Set each crawler's toggle to reflect what your robots.txt already says

This means you start from your current state, not a blank slate.

### Step 2: Set per-crawler decisions

Each AI crawler appears as a card with three buttons:

| Button | Meaning |
|--------|---------|
| **block** | Add `User-agent: {name}` + `Disallow: /` to your robots.txt |
| **allow** | Add `User-agent: {name}` + `Allow: /` (explicit permission) |
| **inherit** | Do not mention this crawler — it will follow your wildcard `User-agent: *` rule |

The card's background turns red when a crawler is set to block, green when set to allow, and white when inheriting.

Crawlers are grouped into three categories:

| Category | What these bots do |
|----------|-------------------|
| **AI Training** | Crawl your content to build training datasets for LLMs |
| **AI Search** | Index your content for AI-powered search results (e.g. Perplexity, You.com) |
| **AI Browsing / Agents** | Real-time browsing agents that visit pages on behalf of AI products (e.g. ChatGPT browsing) |

### Step 3: Use bulk actions

At the top right of each category group are three buttons: **All block**, **All allow**, **All inherit**. Clicking one sets all crawlers in that category at once.

**Common policy choices:**

| Goal | Recommended settings |
|------|---------------------|
| Block all AI training, allow search | AI Training → All block; AI Search → All allow |
| Block everything | All categories → All block |
| Open access (default) | All categories → All inherit |
| Block only the biggest | Toggle GPTBot, ClaudeBot, Bytespider → block individually |

### Step 4: Generate your files

Click **Generate Policy Files**. Two output boxes appear:

**robots.txt block**

This is a text block to paste into your existing `/robots.txt`. Example:

```
# Block AI training crawlers (generated by TrueTraffic)
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Bytespider
Disallow: /
```

**⚠ Important:** This is a block to add to your existing robots.txt — do not replace the entire file. The generated block only covers the crawlers you explicitly set. All other existing rules remain in your file.

**llms.txt scaffold**

An optional file to place at `https://yourdomain.com/llms.txt`. This is an emerging standard (similar to robots.txt, but designed for AI systems that read it to understand your content policy). The generated scaffold includes:

- A header with your domain name
- Lists of blocked, allowed, and unlisted (inherited) crawlers
- A timestamp

### Step 5: Copy and deploy

Each output box has a **Copy** button. Once copied:
1. Open your robots.txt file (usually in your site root or web server config)
2. Paste the block at the end of the file
3. Save and deploy

For llms.txt: create a new file at your domain root named `llms.txt` and paste the entire scaffold.

---

## Tab 4 — Crawler Watch

Crawler Watch monitors a community-maintained list of AI crawlers and sends you an email when a new one appears.

### Why this matters

New AI companies and products launch every week. Each one may deploy a crawler with a new User-Agent string that your current robots.txt does not address. Without monitoring, you will not know that a new bot has open access to your site until you manually re-run a check.

### Step 1: Subscribe

Enter your email address and click **Subscribe** (or press Enter). You will receive a confirmation message. Your email is stored only to send you alerts — no marketing, no sharing.

Every alert email includes a **one-click unsubscribe link** in the body. One click removes you permanently with no confirmation steps.

### Step 2: Receive alerts

When the community crawler list changes (new crawlers added, old ones removed), you receive a plain-text email listing:
- Which crawlers were **added**
- Which crawlers were **removed**
- A link back to the Policy Manager so you can update your rules

### Crawler changelog

Below the subscribe form, a changelog shows all historical changes to the crawler list. Each entry shows the date and which crawlers were added or removed. If no changes have been recorded yet, the list shows "No changes recorded yet. The list is synced daily."

---

## WordPress Plugin

For WordPress site owners who want to skip all command-line setup:

### Installation

1. Download or clone the plugin folder at `wordpress-plugin/truetraffic/`
2. Upload it to `/wp-content/plugins/truetraffic/` on your WordPress server
3. In the WordPress admin panel, go to **Plugins → Installed Plugins**
4. Find **TrueTraffic** and click **Activate**

### Configuration

1. Go to **Settings → TrueTraffic**
2. Paste your **Site Key** (get one from the TrueTraffic dashboard by registering your domain)
3. Set your **Collector URL** — the URL of your running TrueTraffic collector API (default: `http://localhost:8001`; in production, the URL of your deployed collector)
4. Click **Save Settings**

Once saved, the TrueTraffic snippet is automatically injected into every page's `<head>`. A green status indicator confirms it is active.

If you have not yet configured a Site Key, a yellow notice appears in the WordPress admin to remind you.

---

## Embeddable Badge

After registering your site and getting your first traffic data, you can display a public badge on your website showing your current human share percentage.

Copy the `<img>` tag shown in the Live Traffic section:

```html
<img src="http://localhost:8001/badge/YOUR-SITE-KEY.svg" alt="human share">
```

The badge is an SVG that updates in real time. Colour coding:
- **Green badge**: ≥70% human
- **Amber badge**: 40–69% human
- **Red badge**: <40% human

---

## Frequently Asked Questions

**Q: Will blocking AI crawlers hurt my SEO?**
No. Google's core search crawler (Googlebot) is not in TrueTraffic's AI crawler list. Search engine crawlers and AI training/search crawlers are separate. Blocking GPTBot does not affect your Google ranking.

**Q: If I block a crawler in robots.txt, is it actually blocked?**
No. robots.txt is an advisory protocol — it is a polite request, not a technical barrier. Well-behaved crawlers (most major AI companies) respect it. Rogue scrapers may ignore it. For technical enforcement you need server-side rules (WAF, .htaccess, Nginx deny directives).

**Q: How accurate is the human/bot classification?**
The JS snippet is conservative by design — when the evidence is ambiguous, sessions are labelled "unknown" rather than "agent". This means the snippet has a low false-positive rate (real humans are almost never wrongly labelled as bots) but will miss sophisticated bots that perfectly mimic human behaviour. See [HOW_IT_WORKS.md](HOW_IT_WORKS.md) for the full accuracy discussion.

**Q: Does the snippet affect my page load speed?**
No. The script loads with `defer` (WordPress plugin) and sends data using `navigator.sendBeacon` only when the user leaves the page. It adds zero blocking time to your page render.

**Q: What happens to my uploaded log files?**
Log files are written to a temporary location on disk (with restricted 0o600 permissions), parsed in a background worker, and then permanently deleted. The raw log content is never stored in the database — only the aggregated statistics.

**Q: Can I self-host this without Docker?**
Yes. Run the two Python services with `uvicorn` and serve the frontend with any static file server or `npm run dev`. See the README.md for the exact commands.

**Q: Is this GDPR-compliant?**
The JS snippet collects no personal data. There is no legal basis question for anonymous, non-identifiable behavioural signals. The email address collected for Crawler Watch alerts is stored with explicit consent (opt-in) and can be deleted in one click (unsubscribe). Consult your legal counsel for your specific jurisdiction.
