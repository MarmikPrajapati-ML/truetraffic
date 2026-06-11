/* TrueTraffic snippet v0.2 — <5 KB gzipped, no cookies, no PII, fail silent.
 * Usage: <script src="hs.js" data-site-key="YOUR_KEY" data-collector="https://api.example.com"></script>
 *
 * Signals collected (all boolean/numeric, no identifiers):
 *   webdriver, headless_ua, languages_empty, plugins_empty,
 *   had_pointer, pointer_count, scroll_depth_pct, time_to_first_scroll_ms,
 *   paint_to_interaction_ms, viewport_w/h, screen_w/h, screen_viewport_ratio_ok
 */
(function () {
  'use strict';

  var script = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();

  var SITE_KEY = script && script.getAttribute('data-site-key');
  var COLLECTOR = (script && script.getAttribute('data-collector') || '').replace(/\/$/, '');

  if (!SITE_KEY || !COLLECTOR) return;

  var nav = navigator;
  var win = window;
  var scr = screen;

  var signals = {
    site_key: SITE_KEY,
    webdriver: !!nav.webdriver,
    headless_ua: /headless/i.test(nav.userAgent),
    languages_empty: !nav.languages || nav.languages.length === 0,
    plugins_empty: nav.plugins ? nav.plugins.length === 0 : true,
    had_pointer: false,
    pointer_count: 0,
    scroll_depth_pct: 0,
    time_to_first_scroll_ms: null,
    paint_to_interaction_ms: null,
    viewport_w: win.innerWidth || null,
    viewport_h: win.innerHeight || null,
    screen_w: scr.width || null,
    screen_h: scr.height || null,
    screen_viewport_ratio_ok: (scr.width >= win.innerWidth) && (scr.height >= win.innerHeight),
    ts: Date.now()
  };

  // FCP baseline for paint_to_interaction_ms
  var fcpTime = null;
  try {
    var paints = performance.getEntriesByType('paint');
    for (var i = 0; i < paints.length; i++) {
      if (paints[i].name === 'first-contentful-paint') { fcpTime = paints[i].startTime; break; }
    }
  } catch (_) {}

  var start = Date.now();
  var POINTER_WINDOW = 5000;

  function onPointer() {
    var elapsed = Date.now() - start;
    if (elapsed < POINTER_WINDOW) {
      signals.had_pointer = true;
      signals.pointer_count = (signals.pointer_count + 1);
      if (fcpTime !== null && signals.paint_to_interaction_ms === null) {
        try {
          signals.paint_to_interaction_ms = performance.now() - fcpTime;
        } catch (_) {}
      }
    }
  }

  document.addEventListener('mousemove', onPointer, { passive: true });
  document.addEventListener('touchstart', onPointer, { passive: true });

  var scrolled = false;
  function onScroll() {
    if (!scrolled) {
      scrolled = true;
      signals.time_to_first_scroll_ms = Date.now() - start;
    }
    var docH = Math.max(
      document.body ? document.body.scrollHeight : 0,
      document.documentElement.scrollHeight
    );
    signals.scroll_depth_pct = docH > 0
      ? Math.min(100, Math.round(((win.scrollY + win.innerHeight) / docH) * 100))
      : 0;
  }

  win.addEventListener('scroll', onScroll, { passive: true });

  var sent = false;
  function send() {
    if (sent || !nav.sendBeacon) return;
    sent = true;
    try {
      nav.sendBeacon(COLLECTOR + '/beacon', JSON.stringify(signals));
    } catch (_) {}
  }

  win.addEventListener('pagehide', send);
  win.addEventListener('beforeunload', send);
})();
