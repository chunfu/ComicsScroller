# ComicsScroller MV3 Restoration Notes

Record of the 2026-04 restoration effort.

## Goal

Bring ComicsScroller — a Chrome extension that turns paginated manga chapter pages on dm5.com / sfacg.com / comicbus.com into a single-page infinite-scroll reader — back to a working state after it stopped loading in modern Chrome. Primary success criterion: view `https://www.dm5.com/m830996/` end-to-end with infinite scroll.

## What was changed

**Kept unchanged** — Webpack 3, Babel 6, React 16, RxJS 5, Redux 3, Redux-Observable 0.18. No dependency modernization. The old toolchain still builds on Node 22 (with `yarn install --ignore-engines`).

### Manifest V2 → V3

- `src/extensions/manifest.json` — `manifest_version: 3`, `action` replaces `browser_action`, `background.service_worker: "js/background.js"` replaces `background.page`, permissions split into `permissions` + `host_permissions`, CSP switched to MV3 object form (`script-src 'self'`), sandbox page declared, WAR rewritten in object form, `declarativeNetRequestWithHostAccess` permission added, `webRequest`/`webRequestBlocking` removed.
- `src/extensions/rules.json` (new) — declarativeNetRequest rules that set `Referer: https://www.dm5.com/m` on chapterfun + cdndm5 xhr, and `Referer: https://comic.sfacg.com/HTML/` on sfacg requests. Replaces the runtime `chrome.webRequest.onBeforeSendHeaders` listeners.
- `src/extensions/sandbox.html` (new) — null-origin sandboxed page that `eval()`s the obfuscated `chapterfun.ashx` responses (and sfacg's packed script, and comicbus's `#Form1 > script`) to extract image URLs. Required because MV3 extension pages cannot use `unsafe-eval` but sandboxed pages can.

### Service worker

- `src/js/background.js` — fully rewritten as a service worker. Drops the old `chrome.webRequest` listeners (now done via dNR), the persistent GA snippet (breaks in SW), and the Observable.ajax-based subscription poller. Uses a one-line data-driven `SITES` lookup for the dm5/sfacg/comicbus redirect. Sets `isAdult=1` cookie via `chrome.cookies.set` on install (one-year expiration). Subscription polling for dm5 is re-implemented with plain `fetch()` + regex scraping (no DOMParser in SW).
- Keeps `chrome.webNavigation.onBeforeNavigate` as the redirect trigger (no URL filter — it was easier to hand-filter in the callback).

### Reader-side adapters

- `src/js/container/App/reducers/dm5Epic.js`, `sfEpic.js`, `comicBusEpic.js`, `getAction.js` — HTTPS base URLs, `chrome.browserAction.setBadgeText` → `chrome.action.setBadgeText`, inline `eval(response)` replaced with `evalInSandbox(kind, payload)` calls that postMessage to the sandbox iframe.
- `src/js/util/sandbox.js` (new) — lazy singleton iframe loader + request-id tracked postMessage wrapper with 15 s timeout.
- `src/js/component/ComicCard/index.jsx`, `src/js/container/PopUpApp/index.jsx` — `chrome.browserAction` → `chrome.action` (caught by Codex review; would have thrown on remove-card / import / reset).

### Removed

- `src/extensions/background.html` — unused under MV3.
- `src/extensions/app_dev.html`, `src/extensions/popup_dev.html`, `webpack.config.dev.js`, `server.js` — the `npm start` hot-reload flow loaded scripts from `http://localhost:8000/`, which MV3 forbids in extension pages (not just a CSP knob — Chrome blocks remote scripts in extension pages outright). Better to delete the dead scaffolding than let someone waste time on it.
- Matching `start`, `copy:dev`, `set:dev`, and `betterScripts.start` entries in `package.json`. README "Run dev server" section replaced with "Load unpacked" instructions.

## Lessons learned

### Manifest V3 constraints that bit us

1. **`chrome.webRequest` blocking is gone.** Header modification has to go through declarativeNetRequest. For the `isAdult=1` cookie, `chrome.cookies.set` was simpler than trying to `append` via dNR.
2. **`unsafe-eval` is disallowed in extension pages.** The canonical workaround is a sandboxed page declared in `manifest.sandbox.pages` — it runs in a null origin, has no chrome.* access, but can `eval()`. The app page talks to it via `postMessage` on a hidden iframe. This is exactly what the dm5 `chapterfun.ashx` unpacking needs.
3. **Service workers cannot import modules with module-evaluation side effects that don't work in a worker context.** The old `background.js` imported `fetchChapterPage$` from the three epics, which transitively pulled in `rxjs/add/observable/dom/ajax` + the whole lodash-webpack-plugin machinery. **In the Webpack 3 bundle, this chain silently broke SW evaluation** — no exception surfaced, the SW target existed but never evaluated, listeners never registered, no events fired. Bisecting by stripping imports one at a time is what found it. **Takeaway: keep the SW's direct and transitive imports as small and SW-safe as possible.** Inlining a tiny `fetch()` + regex scraper was cheaper than rewiring the bundler.
4. **`chrome.extension.getURL` → `chrome.runtime.getURL`.** Easy miss.
5. **`chrome.browserAction` → `chrome.action`** everywhere, including popup components. The first review pass missed the popup/ComicCard call sites; Codex's second pass caught them.

### Chrome 147+ killed `--load-extension`

Google Chrome Stable 147 silently ignores `--load-extension` on the command line (logs `WARNING: --load-extension is not allowed in Google Chrome, ignoring.`). Even `--disable-features=DisableLoadExtensionCommandLineSwitch` does not revive it. Chrome for Testing / Canary / Dev still honor it. For automated end-to-end testing with Puppeteer, install Chrome for Testing via `npx @puppeteer/browsers install chrome@stable` and point `executablePath` at it. Also pass `ignoreDefaultArgs: ['--disable-extensions', '--disable-component-extensions-with-background-pages']` so Puppeteer doesn't override the load.

### Testing the SW itself

MV3 service workers go dormant between events, which makes "attach early enough to see the startup log" a race. Reliable ways to observe SW state during tests:
- Write sentinel flags to `chrome.storage.local` at the very top of `background.js` and read them from a popup page. If storage is untouched, the SW is silently failing at module eval.
- Force-boot the SW with `chrome.developerPrivate.reload(extId, ...)` from a `chrome://extensions/` page (caveat: this invalidates the inspecting page, so you need a separate tab).
- Attach via Puppeteer's `browser.on('targetcreated', ...)` **before** any navigation, and resolve `await target.worker()` early; but console messages emitted *before* you attach are lost.

### dm5.com scraping is still valid

The chapter page still embeds `DM5_IMAGE_COUNT`, `DM5_CID`, `DM5_CURL`, `DM5_MID`, `DM5_VIEWSIGN`, `DM5_VIEWSIGN_DT` in a head `<script>`. The comic landing page still exposes `#chapterlistload li > a`, `.info .title`, `.cover > img`. No scraper code changes were needed for dm5. The `chapterfun.ashx` response is still an obfuscated JS blob that needs `eval()`.

## Verification

- Loaded unpacked `./ComicsScroller/` into Chrome for Testing 148 via Puppeteer.
- Navigating to `https://www.dm5.com/m830996/` auto-redirects to `chrome-extension://<id>/app.html?site=dm5&chapter=m830996`.
- Reader renders "BLUE 第1话 梦 （75P）", first image loads, scroll progressively loads more images, hitting the bottom auto-advances to the next chapter (`m864416` / `第2话 入學 (78P)`). Screenshots captured under `/tmp/cs-test/shots/`.

Artifacts at repo root:
- `ComicsScroller/` — unpacked, load via `chrome://extensions` → "Load unpacked"
- `ComicsScroller.zip` (~216 KB)

## Out of scope / known limitations

- **sfacg + comicbus subscription polling** is not re-implemented in the SW (`src/js/background.js` `comicsQuery` skips non-dm5 entries). The chapter-reading path works for all three sites via the epics; only the background *update* poller is dm5-only. Re-adding requires regex scrapers for those two site landing pages (they use DOM structures that were not validated in this restoration).
- **sfacg + comicbus end-to-end reading** was not runtime-verified. Code changes follow the same patterns as dm5 and the bundle builds, but live HTML may have drifted.
- **Dev hot-reload flow** is permanently gone. MV3 does not allow loading scripts from `http://localhost:8000/` into extension pages; a modern dev flow would need to emit bundled scripts into the extension directory on every change (e.g., webpack `--watch` writing to `./ComicsScroller/js/`). Out of scope.
- **Dependency modernization** (React 16 → 18, RxJS 5 → 7, Webpack 3 → 5, Babel 6 → 7) — deliberately skipped. Separate, much larger project.
- **Chrome Web Store publishing** — the zip is suitable for local unpacked install only; the extension has not been submitted for review.
