# TrueTraffic — Project Overview

## What is TrueTraffic?

TrueTraffic is an **open-source website traffic analysis tool** that answers one question every website owner should be asking right now:

> **How much of my traffic is actually human?**

The internet in 2024–2025 is crawled by dozens of AI systems — training crawlers that scrape your content to build datasets, search agents that summarise your pages without sending a visitor, and agentic browsers that execute JavaScript as if they were a person. Most analytics tools count all of these as "sessions" or "pageviews", inflating your traffic numbers and making your audience look larger and more engaged than it really is.

TrueTraffic separates these into three clearly labelled buckets:

| Bucket | Description |
|--------|-------------|
| **Human** | Strong evidence of real human behaviour (pointer events, natural scroll timing, genuine browser environment) |
| **Suspected agent** | Strong evidence of automation (webdriver flag, headless browser signature, bot User-Agent, instant full-page scroll) |
| **Unknown** | Ambiguous signal — could be a bot that mimics humans, or a human with unusual browser settings. Treated conservatively and never mislabelled. |

---

## The Problem TrueTraffic Solves

### AI crawlers are invisible to most analytics

Declared AI crawlers (GPTBot, ClaudeBot, etc.) do not execute JavaScript. They hit your server, grab the HTML, and leave. Google Analytics, Mixpanel, and every other JS-based analytics tool **cannot see them at all**. Your server logs show them; your dashboard does not.

### Disguised agents hide inside JS traffic

Agentic browsers — AI systems that control a real browser (Playwright, Puppeteer, CDP-based agents) — do execute JavaScript. They appear in every analytics tool as a regular visit. Without behavioural analysis of the session itself, they are indistinguishable from a human user.

### robots.txt is advisory, not enforced

You can write `Disallow: /` for every AI crawler and some will ignore it. You also cannot know which crawlers you have already addressed vs. which ones have open access — because robots.txt has no dashboard.

### The result

Website owners are:
1. Paying for hosting bandwidth consumed by bots, not people
2. Making content and product decisions based on inflated pageview numbers
3. Unaware that their content is being scraped and used to train AI models
4. Unable to quickly generate the robots.txt rules that would limit this exposure

TrueTraffic addresses all four of these problems.

---

## What Makes TrueTraffic Different

| Feature | TrueTraffic | Google Analytics | Cloudflare | robots.txt |
|---------|-------------|-----------------|-----------|------------|
| Detects declared AI crawlers | Yes (robots.txt + server logs) | No | Partial | Advisory only |
| Detects disguised AI agents | Yes (behavioural JS signals) | No | Partial (WAF rules) | No |
| Grades your AI exposure | Yes (A–F scale) | No | No | No |
| Generates robots.txt/llms.txt | Yes | No | No | N/A |
| Alerts you to new crawlers | Yes (email) | No | No | No |
| Analyses historical server logs | Yes (nginx/Apache/Cloudflare) | No | No | No |
| Open source, self-hostable | Yes | No | No | N/A |
| No cookies, no PII | Yes | No | N/A | N/A |

---

## Core Benefits

### 1. Accurate audience picture
Stop counting bots as readers. Know your real human audience size. Make content, advertising, and product decisions on real data.

### 2. Bandwidth cost visibility
AI crawlers consume real bandwidth. TrueTraffic estimates the dollar cost of bot-generated bandwidth from your server logs (at your configurable CDN rate per GB), so you can see exactly how much infrastructure spend is going to non-human traffic.

### 3. AI exposure grade
A single letter grade (A–F) tells you at a glance whether your content is open to AI training crawlers. A = fully protected, F = fully open. No configuration knowledge required to understand the result.

### 4. One-click policy generation
Rather than hand-editing robots.txt, TrueTraffic shows you every AI crawler with an on/off toggle and generates the exact robots.txt block to paste into your site — plus an optional llms.txt file that gives AI systems structured context about your policy.

### 5. Proactive crawler monitoring
The AI crawler landscape changes weekly. New bots appear, old ones change names. TrueTraffic pulls from a community-maintained list and emails you the moment a new crawler appears, so your policy stays current without manual monitoring.

### 6. Privacy by design
The JS snippet collects only anonymous behavioural signals — no cookies, no user IDs, no IP addresses, no PII of any kind. It is GDPR-friendly by architecture, not by policy.

### 7. Self-hostable, open source
No vendor lock-in, no SaaS subscription, no data leaving your infrastructure. The full stack — snippet, collector, checker, dashboard — runs on a single `docker compose up`.

---

## Who Benefits from TrueTraffic

### Independent publishers and bloggers
You write for human readers. AI crawlers consume your content for training datasets, contributing zero human readers in return. TrueTraffic shows you what fraction of your "traffic" is actually bots and helps you decide whether to allow or block AI training access.

**Specific benefit:** Know whether your traffic growth is real audience growth or just increased bot crawling.

### E-commerce store owners
Bot traffic inflates session counts, skews conversion rates, and burns server capacity. A store reporting 10,000 monthly sessions might have 3,000 real potential customers. Advertising decisions, A/B test sample sizes, and CRO work all become more accurate with bot traffic separated out.

**Specific benefit:** Cleaner conversion rate data and accurate attribution.

### Content teams and SEO professionals
Understanding which pages get the most AI crawler attention vs. human interest reveals which content is being harvested vs. read. SEO signals are affected when bots inflate dwell-time or pageview numbers.

**Specific benefit:** Identify high-value content (high human ratio) vs. content primarily consumed by scrapers.

### Web developers and platform engineers
Server log analysis shows bandwidth consumed per bot, which crawlers are most aggressive, and which pages are most scraped. This directly informs infrastructure decisions, CDN configuration, and rate-limiting rules.

**Specific benefit:** Quantify the infrastructure cost of AI traffic; justify bot-blocking investment to stakeholders.

### Media companies and news organisations
Publishers licensing their content to AI companies (or explicitly not licensing it) need to verify whether crawlers are respecting their stated policy. TrueTraffic tells you which AI crawlers have open access under your current robots.txt — and which you have explicitly addressed.

**Specific benefit:** Compliance verification — confirm your robots.txt reflects your actual licensing intent.

### WordPress site owners
The TrueTraffic WordPress plugin installs the snippet with zero code editing. Site owners who have never touched a configuration file can get live human vs. bot split in minutes, without leaving the WordPress admin panel.

**Specific benefit:** No-code setup for the world's most popular CMS.

### Security and infrastructure teams
Bot traffic analysis from server logs reveals patterns: which bots ignore crawl delays, which hit at unusual hours, which request paths indicate scraping rather than organic browsing. This data feeds into WAF rules and rate limiting decisions.

**Specific benefit:** Evidence-based bot mitigation, not guesswork.

### Researchers and academics
Open-source, self-hosted, methodologically transparent. Every classification rule is documented and auditable. Researchers studying the AI web can use TrueTraffic as a baseline measurement tool without trusting a black-box SaaS.

**Specific benefit:** Reproducible, auditable traffic measurement for academic work.

---

## Architecture Overview

TrueTraffic has five components that work together:

```
Browser visitor
     │
     │  hs.js sends signals on page leave
     ▼
Collector API (port 8001)          ◄── Server logs (nginx/Apache/Cloudflare CSV)
  • Classifies visits                    (uploaded via Log Analyzer)
  • Stores in SQLite DB
  • Serves /stats, /badge
     │
     ▼
React Dashboard (port 5174)
  • Site Report (grade + live traffic)
  • Log Analyzer
  • Policy Manager
  • Crawler Watch
     ▲
     │  checks robots.txt remotely
Checker API (port 8000)
  • Fetches domain's robots.txt via SSRF-safe HTTP
  • Grades exposure A–F
  • Lists per-crawler status
```

The two layers are complementary and address different bot populations:

| Layer | What it catches | What it misses |
|-------|----------------|----------------|
| **Checker (robots.txt)** | Declared crawlers that follow robots.txt | Disguised agents, bots that ignore robots.txt |
| **JS Snippet (behavioural)** | Disguised agentic browsers executing JS | Declared crawlers that skip JS execution |
| **Log Analyzer (server logs)** | All declared crawlers (User-Agent matching) | Disguised agents using human UAs |

Using all three layers together gives the most complete picture.

---

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Collector API | Python 3.11, FastAPI, SQLAlchemy, SQLite (WAL mode) |
| Checker API | Python 3.11, FastAPI, urllib.robotparser |
| JS Snippet | Vanilla JavaScript (ES5-compatible), <5 KB gzipped |
| Dashboard | React 18, TypeScript, Vite, Recharts |
| WordPress Plugin | PHP 7.4+, WordPress 5.0+ |
| Rate Limiting | slowapi (per-IP, configurable) |
| Email Alerts | Resend API (optional; falls back to log-only) |
| Deployment | Docker Compose (3 services) |

---

## Data Privacy Commitment

- The JS snippet collects **zero PII**: no names, emails, IP addresses, cookies, or user identifiers.
- All signals are anonymous and behavioural (scroll speed, pointer presence, viewport size).
- Email addresses for Crawler Watch alerts are stored **only** with explicit opt-in and include a one-click unsubscribe link in every message.
- Server log uploads are processed in memory, never persisted to disk beyond the analysis window, and temp files are deleted immediately after processing.
- The product is self-hostable — no data ever has to leave your own infrastructure.
