# TrueTraffic

**Open-source tool that tells website owners what percentage of their traffic is estimated to be human, as AI agents increasingly browse the web disguised as people.**

MIT license · free to use and self-host.

---

## What it does

| Tool | What it measures |
|---|---|
| **Domain checker** (Phase 1, live) | Which AI crawlers your `robots.txt` lets in — instant AI Exposure Grade |
| **JS snippet + collector** (Phase 2) | Human vs. suspected-agent share of *JS-executing* traffic |
| **Dashboard** (Phase 3) | 30-day trend, three-bucket breakdown, embeddable badge |
| **WordPress plugin** (Phase 4) | One-click snippet install from the WP plugin directory |

### Honest limitations

There are three distinct traffic buckets that **require different detection layers**:

| Bucket | Executes JS? | How we detect it |
|---|---|---|
| Declared AI crawlers (GPTBot, ClaudeBot, etc.) | No | robots.txt analysis + server-log parsing |
| Disguised agentic browsers | Yes | JS snippet: behavioral + environment signals |
| Humans | Yes | JS snippet: default bucket when signals look organic |

**The snippet alone cannot see declared crawlers.** The checker alone cannot see disguised agents.
TrueTraffic combines both layers; each is clearly labelled in the UI.

---

## Quickstart (self-host)

```bash
git clone https://github.com/MarmikPrajapati-ML/truetraffic
cd TrueTraffic
docker compose up
# → open http://localhost:8000
```

Or run the checker API directly:

```bash
pip install -r checker/api/requirements.txt
PYTHONPATH=. uvicorn checker.api.main:app --reload
# → http://localhost:8000/?domain=example.com
```

---

## Repo structure

```
TrueTraffic/
├── checker/          # Phase 1: domain checker (FastAPI + static HTML)
│   ├── index.html    # frontend
│   └── api/          # FastAPI app
├── snippet/          # Phase 2: hs.js tracking snippet
├── collector/        # Phase 2: beacon collector + classifier
├── dashboard/        # Phase 3: minimal dashboard UI
├── wordpress-plugin/ # Phase 4: WP plugin wrapper
├── data/
│   └── ai-agents.json   # community-maintained AI crawler list
├── scripts/
│   └── update_agents.py # sync agents list from upstream sources
└── docs/
    └── methodology.md   # every classification rule, openly documented
```

### `data/ai-agents.json`

A community-maintained, MIT-licensed list of known AI crawler `User-agent` tokens and metadata.
Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

To sync from upstream sources:

```bash
pip install httpx
python scripts/update_agents.py
```

---

## Development

```bash
pip install ruff pytest pytest-asyncio
pip install -r checker/api/requirements.txt

# lint
ruff check .

# tests
PYTHONPATH=. pytest
```

---

## Deployment

- **Static frontend**: deploy `checker/index.html` to GitHub Pages or Cloudflare Pages.
- **API**: deploy the FastAPI app to any free-tier host (Cloud Run, Fly.io, Render).
  Set `window.API_BASE = 'https://your-api-host'` in `index.html` or use a reverse proxy.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The most valuable contribution is keeping
`data/ai-agents.json` up to date with new crawlers.

---

## License

MIT © 2026 Marmik. See [LICENSE](LICENSE).
