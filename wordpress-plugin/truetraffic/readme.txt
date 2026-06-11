=== TrueTraffic ===
Contributors:      marmikprajapati
Tags:              analytics, traffic, ai, bots, monitoring
Requires at least: 5.0
Tested up to:      6.5
Requires PHP:      7.4
Stable tag:        1.0.0
License:           GPLv2 or later
License URI:       https://www.gnu.org/licenses/gpl-2.0.html

Measures the real human vs. AI-agent share of your traffic using a lightweight, privacy-respecting JavaScript snippet.

== Description ==

TrueTraffic tells you what percentage of your visitors are real humans vs. AI agents browsing or scraping your content.

Unlike server-side log analysis, TrueTraffic detects *disguised* AI agents — bots that execute JavaScript but behave differently from human visitors. It does this using a lightweight snippet that collects behavioral signals (pointer activity, scroll timing, browser environment) without storing any personally identifiable information.

**Features:**

* Zero-config snippet injection — just paste your Site Key.
* Detects declared crawlers (GPTBot, ClaudeBot, etc.) via robots.txt analysis.
* Detects disguised agentic browsers via JS behavioral signals.
* No cookies. No PII. GDPR-friendly by design.
* Embeddable human-share badge for your site.
* 30-day trend chart and traffic breakdown in the TrueTraffic dashboard.

**How it works:**

1. The plugin injects a tiny script (`hs.js`) into your page `<head>`.
2. The script collects ~13 anonymous behavioral signals and sends them to your TrueTraffic collector when the visitor leaves the page.
3. The collector classifies each session as `human`, `suspected_agent`, or `unknown` using a conservative rule set.
4. Your dashboard shows the live human share, a 30-day trend, and an embeddable badge.

**Self-host or use the cloud version:**

TrueTraffic is fully open-source. You can run the collector yourself or point the plugin at the hosted version.

Source code: https://github.com/MarmikPrajapati-ML/truetraffic

== Installation ==

1. Upload the `truetraffic` folder to `/wp-content/plugins/`.
2. Activate the plugin through the **Plugins** menu in WordPress.
3. Go to **Settings → TrueTraffic**.
4. Paste your Site Key (get one free from the TrueTraffic dashboard by registering your domain).
5. Optionally set a custom Collector URL if you are self-hosting.

The snippet is injected automatically on every page once the Site Key is saved.

== Frequently Asked Questions ==

= Where do I get a Site Key? =

Open the TrueTraffic dashboard (https://github.com/MarmikPrajapati-ML/truetraffic), enter your domain, and click "Register site". You'll receive a UUID Site Key instantly — no account required.

= Does this plugin collect personal data? =

No. The snippet collects only anonymous behavioral signals: whether the browser has a pointer device, scroll timing, viewport size, and a few browser environment flags. No IP addresses, no cookies, no user identifiers of any kind are stored.

= Can I self-host the collector? =

Yes. Clone the repo and run `docker compose up`. Then set the Collector URL in the plugin settings to your own deployment.

= Will this slow down my site? =

The snippet is loaded with `defer` and fires on `pagehide`/`beforeunload`, so it does not block page rendering. The payload is under 1 KB.

== Screenshots ==

1. Settings page — paste your Site Key here.
2. TrueTraffic dashboard — human share gauge, 30-day trend, and traffic breakdown.

== Changelog ==

= 1.0.0 =
* Initial release.
* Settings page with Site Key and Collector URL fields.
* Automatic snippet injection via `wp_head`.
* Admin notice when plugin is installed but not configured.
* Input sanitization and nonce-protected settings form.
