# Feature Tracker -- ServiceNow Ticket Data Extractor v6.0

> Full facelift of v5.0.4. This tracker covers every planned change from style compliance through performance overhaul.
> Each item references the governing doc and maps to an implementation phase.

---
dont' forget to bump version in relation to features and bug fixes
## Legend

| Status | Meaning |
|--------|---------|
| `[ ]`  | Not started |
| `[-]`  | In progress |
| `[x]`  | Complete |
| `[!]`  | Blocked / needs decision |

---
## known bugs , asks, concerns,
- [ ] green wfm accent color,
- [ ] light mode
- [ ] improved query extraction from URL, doens't work on all pages right now
    - example url https://wfmprod.service-now.com/wfm?id=list&table=task&filter=assignment_group%3D807ef9f0db32481069ee1329689619b6%5Esys_created_on%3E%3Djavascript:gs.dateGenerate(%272026-01-05%27,%2700:00:00%27)&sys_id=&v=
- [ ] varible fields can be wide ranging in names, but everytime we extract them they appear in a new order. a system to help standarize this would be awesome
- [ ] SCTASK is our main focus with all the variables but other ticket types would be nice to have if possible.
- [ ] UI/UX improvments

## Phase 1 -- Style Guide Compliance

Ref: [Anti-AI Style Guide](Anti-AI_Style-Guide.md)

### Colors and Theming

- [x] Replace all hardcoded light-mode colors with CSS custom properties (`--tm-*` tokens)
- [x] Implement dark-mode-first design using approved palette (`#0f0f0f` bg, `#f1f1f1` text)
- [x] Remove all purple theme colors (blackred theme keeps red, but no purple anywhere)
- [x] Remove all gradient usage (progress bar `linear-gradient` -> flat color)
- [x] Strip the four-theme system; replace with single dark base + accent toggle (blue / red)
- [x] Accent toggle: `--tm-accent-primary` switches between `#3ea6ff` (blue) and `#ff0000` (red)
- [x] Persist accent choice via `GM_setValue('tm_accent_theme', choice)`
- [x] Apply semantic state colors: success `#2e7d32`, warning `#f9a825`, error `#d32f2f`

### Typography

- [x] Set font stack: `'Roboto', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif`
- [x] Apply font scale: xs=11px, sm=12px, base=14px, md=16px, lg=18px
- [x] Use font weights 400/500/600 only
- [x] Remove all `Arial, sans-serif` references

### Iconography

- [x] Remove every emoji from UI text and button labels
- [x] Replace with inline SVG icons (Lucide, ISC license)
- [x] Icon sizes: 16px, 20px only (as needed)
- [x] Icons default to `--tm-text-secondary`, hover to `--tm-text-primary` (via `currentColor`)

### Components

- [x] Restyle floating panel per `.tm-panel` spec (dark bg, 1px subtle border, 8px radius)
- [x] Collapsed state: toggle via header button
- [x] Expanded state: min-width 280px, max-width 400px, max-height 90vh
- [x] Panel open/close: 150ms/250ms ease transitions
- [x] Buttons: primary (filled accent), secondary (outlined accent), ghost (text only)
- [x] Inputs: dark bg `#0f0f0f`, border `#3f3f3f`, focus ring accent
- [x] Toggles: replace checkbox+label pairs with CSS toggle switches (36x20px)
- [x] Progress bar: flat color `--tm-accent-success`, no gradient

### Spacing and Layout

- [x] Adopt 4px-increment spacing system (`--tm-space-1` through `--tm-space-6`)
- [x] Consistent padding: 12px section, 16px card

### Transitions

- [x] Fast hover: 100ms ease
- [x] Standard transitions: 150ms ease
- [x] Panel open/close: 250ms ease-out
- [x] Remove all bounce/spring/pulse animations (abort button `pulse` keyframe)
- [x] No animation delays over 50ms

### Accessibility

- [x] Add `:focus-visible` ring (`2px solid accent`, offset 2px) to all interactive elements
- [x] Minimum 40x40px touch targets on toggle button
- [x] Toggle switches have `role="switch"`, `aria-checked`, keyboard support

### CSS Architecture

- [x] Prefix all classes with `tm-` to avoid host site collision
- [x] Move all inline `style=""` attributes to a single injected `<style>` block
- [x] Use CSS custom properties for all themeable values
- [x] Z-index scale: panel 9999, modal 9995, toast 10000

### Anti-Patterns Removed

- [x] Remove `box-shadow` with colored tints (using `rgba(0,0,0,.4)` only)
- [x] Remove border-radius values over 12px
- [x] Remove exclamation marks from UI copy
- [x] Remove "fun" loading messages
- [x] Restore `user-select: text` on content areas (only header is `user-select: none`)

---

## Phase 2 -- Toolbox Architecture

Ref: [Toolbox Design](TOOLBOX_DESIGN.md)

### Feature Flags

- [x] Create `FEATURE_FLAGS` object at top of config module
- [x] Flags: `EXTRACT_CURRENT`, `EXTRACT_QUERY`, `SCTASK_PROCESSING`, `EXPORT_EXCEL`, `COPY_JSON`, `AUTO_DETECT_QUERY`, `CLEAR_DATA`, `UPDATE_CHECKER`, `DEV_MARK`
- [x] Gate each tool behind its flag (conditional rendering in UI module)
- [x] New tools ship disabled by default (pattern established)

### Tool Registry

- [x] All actions registered as identifiable buttons with `id="tm-tool-{name}"`
- [x] Tools: detect-query, extract-current, extract-query, process-sctask, export-excel, copy-json, clear-data
- [x] Renderer iterates flags and conditionally includes buttons

### Toolbar States

- [x] Collapsed: header only, body hidden
- [x] Expanded: full tool panel
- [x] Persist collapsed/expanded via `GM_setValue`

### Toast Notifications

- [x] Implement `showToast(message, type, duration, action)` function
- [x] Types: info, success, warning, error (with distinct icon colors)
- [x] Auto-dismiss with configurable duration
- [x] Optional action button (e.g., "Clear data" after export)
- [x] Position: bottom-right, z-index 10000
- [x] Slide-in animation (250ms ease-out)

---

## Phase 3 -- Update System

Ref: [Update System Documentation](Update%20System%20Documentation.md)

### Version Checking

- [x] Define `CURRENT_VERSION` constant (`6.0.0`)
- [x] Define `GITHUB_VERSION_URL` pointing to raw GitHub file
- [x] Implement `isNewerVersion(latest, current)` with semantic comparison
- [x] 24-hour check interval with `GM_setValue('tm_ext_vcheck', timestamp)`
- [x] Rate limiting: skip check if within interval (unless manual)
- [x] Use `GM_xmlhttpRequest` for cross-origin GitHub fetch

### Notification Modal

- [x] Create update notification modal following style guide (dark theme)
- [x] Show current vs. latest version
- [x] Three actions: Update Now, Remind Later, Skip This Version
- [x] Persist skipped version via `GM_setValue('tm_ext_vskip', ver)`
- [x] "Remind Later" resets check timer
- [x] Close on backdrop click

### Manual Check

- [x] Add "Check for Updates" button in settings panel
- [x] Show toast feedback for all outcomes (up-to-date, error, update available)

---

## Phase 4 -- Developer Attribution

Ref: [MyDevMark](MyDevMark.md)

- [x] Add dev mark to bottom of settings panel
- [x] Text: "Developed by Ryan Satterfield"
- [x] Link: https://github.com/RynAgain (opens in new tab)
- [x] Style: 11px, muted gray `#717171`, link color `#58a6ff`
- [x] Use `injectDevMark(container)` helper for consistency
- [x] Append script version from `ns.VERSION`

---

## Phase 5 -- Performance and Unlimited Records

Ref: [Network Token Scanning Performance](Network%20Token%20Scanning%20Performance.md) + user requirement

### Max Record Cap Removal

- [x] Replace the `<select>` dropdown (10/50/100/250/500/1000) with `<input type="number">`
- [x] Default value: 100
- [x] No hard upper limit - accepts any positive integer
- [x] Helper text: "Set 0 for unlimited (memory dependent)"
- [x] Validates via HTML `min="0" step="1"`

### Paginated API Fetching

- [x] Implement chunked fetching using `sysparm_offset` + `sysparm_limit`
- [x] Page size: 1000 per request (`CONFIG.PAGE_SIZE`)
- [x] Accumulate results across pages
- [x] Update progress bar per page
- [x] Support abort mid-pagination (button swaps to "Abort")
- [x] Show running count in status: "Fetched 3000 records (page 3)..."

### Memory Management

- [x] After each page, check `performance.memory` if available
- [x] Warn user via toast if approaching 80% of heap limit

### SCTASK Processing Performance

- [x] Batch SCTASK variable lookups with `Promise.allSettled`
- [x] Configurable concurrency (`CONFIG.SCTASK_CONCURRENCY = 3`)
- [x] Delay between batches (`CONFIG.SCTASK_DELAY_MS = 50`)
- [x] Show per-ticket progress during batch processing

---

## Phase 6 -- Modularization

Ref: [Multi-Tampermonkey Guide](multi-tampermonkey-guide.md)

### Module Split

- [x] `src/extractor-config.js` -- shared namespace, CONFIG, FLAGS, ICONS, SK, Logger, utils
- [x] `src/extractor-styles.js` -- CSS injection via single `<style>` block
- [x] `src/extractor-api.js` -- snFetch, cleanTicket, paginated extraction, DOM extraction
- [x] `src/extractor-sctask.js` -- SCTASK variable extraction (RITM, MTOM, QA parsing)
- [x] `src/extractor-export.js` -- Excel export, JSON clipboard, data clearing
- [x] `src/extractor-update.js` -- version checking, update modal
- [x] `src/extractor-ui.js` -- DOM creation, drag-drop, toast, settings, events

### Module Communication

- [x] Shared state via `window.SNExtractor` namespace
- [x] Each module wrapped in IIFE with `'use strict'`
- [x] Guard clause at top of each module verifying config loaded

### Main Orchestrator

- [x] `ServiceNow Ticket Data Extractor V6.0 - Simplified-6.0.0.user.js`
- [x] `@require` in load order: config -> styles -> api -> sctask -> export -> update -> ui
- [x] Verifies all critical functions exist before init
- [x] `@updateURL` / `@downloadURL` for auto-updates

---

## Phase 7 -- Bug Fixes and Cleanup

### Version String Consistency

- [x] Fix header: `@version 6.0.0`
- [x] Fix UI title: "SN Extractor v6.0.0"
- [x] Fix Logger init message to match version

### Settings Panel

- [x] Table selection lives in settings panel only (not duplicated)
- [x] Removed right-click hijack (no more overriding native context menu)

### Query Builder

- [x] `buildQuery()` properly combines custom query with filter selections
- [x] Custom query takes priority when non-empty

### Error Handling

- [x] All DOM operations wrapped safely (null checks on getElementById)
- [x] Graceful fallback if XLSX library fails to load (error message in toast)
- [x] Handle ServiceNow session timeout (401/403) with toast prompt

---

## Milestone Summary

| Phase | Scope | Priority | Status |
|-------|-------|----------|--------|
| 1 | Style Guide Compliance | High | Complete |
| 2 | Toolbox Architecture | High | Complete |
| 3 | Update System | Medium | Complete |
| 4 | Developer Attribution | Low | Complete |
| 5 | Performance / Unlimited Records | High | Complete |
| 6 | Modularization | High | Complete |
| 7 | Bug Fixes / Cleanup | High | Complete |

---

## Phase 8 -- Code Review Findings (v6.0.2)

> Full review of all 8 files on 2026-02-27. Findings organized by severity.

### Critical -- Logic Bugs

- [x] **CR-01** `extractor-export.js:106` -- `throw err` inside `.catch()` callback is swallowed silently because it is inside a `.then()` chain with no outer `.catch()`. The `copyToClipboard` outer try/catch will not catch a rejected promise. Fix: chain `.catch()` on the clipboard promise instead of re-throwing.
- [x] **CR-02** `extractor-api.js:274` -- After abort, the extract button `onclick` is reassigned to `ns.extractByQuery`, but the `extractBtn` reference may be stale if the DOM was rebuilt (e.g., SPA navigation on ServiceNow). Fix: re-query the DOM in `finally` instead of using the captured closure variable.
- [x] **CR-03** `extractor-ui.js:52-55` -- Toast `message` is injected via `innerHTML` without sanitization. If a ServiceNow API error message contains HTML, it could cause XSS. Fix: use `textContent` for the message span, or escape HTML entities before insertion.

### High -- Robustness

- [x] **CR-04** `extractor-api.js:147` -- `parseInt(maxEl.value, 10) || 100` treats `0` (unlimited) as falsy, defaulting to 100. Users who enter 0 will get 100 instead of unlimited. Fix: use explicit null check: `const raw = parseInt(maxEl.value, 10); const maxVal = (isNaN(raw) ? 100 : raw);`
- [x] **CR-05** `extractor-sctask.js:13` -- Destructures `snFetch` at module load time, but `snFetch` is defined on `ns` by the API module. If modules load out of order (race condition), `snFetch` will be `undefined`. Fix: reference `ns.snFetch` at call time instead of destructuring at top.
- [x] **CR-06** `extractor-update.js:12` -- Same issue: destructures `ICONS` at load time. If config module is slow, `ICONS` could be undefined. Less risky since config loads first, but inconsistent with other modules that reference `ns.ICONS`. Fix: use `ns.ICONS` inline.
- [x] **CR-07** `extractor-ui.js:601` -- `ns.copyToClipboard(state.extractedTickets, 'json')` passes a live reference to the array. If the user clears data while the async clipboard write is in flight, they get an empty export. Fix: snapshot the array: `ns.copyToClipboard([...state.extractedTickets], 'json')`.
- [x] **CR-08** `extractor-config.js:117` -- Token extraction regex scans `document.documentElement.innerHTML` which serializes the entire DOM to a string on every page load. On large pages this can be expensive (100ms+). Fix: limit to `document.querySelector('script')` or first 10KB.

### Medium -- Style Guide Compliance Gaps

- [x] **CR-09** `extractor-styles.js:186` -- `.tm-btn-s:hover` uses hardcoded `rgba(62, 166, 255, 0.1)` which won't adapt to the red accent. Fix: use `color-mix()` or define a `--tm-accent-alpha` variable.
- [x] **CR-10** `extractor-styles.js:392-458` -- Toast and modal CSS uses hardcoded color values (`#2d2d2d`, `#303030`, `#3ea6ff`) instead of `var(--tm-*)` tokens. These elements are outside `#tm-ext-root` so CSS vars don't cascade. Fix: either scope toasts inside `#tm-ext-root`, or duplicate the vars on `.tm-toast-wrap` and `.tm-modal-bg`.
- [x] **CR-11** `extractor-ui.js:380` -- Reset UI button has inline `style="padding:2px 8px;font-size:10px;"`. Per style guide, all styles should be in the CSS module. Fix: add a `.tm-btn-xs` class.
- [x] **CR-12** `extractor-ui.js:536` -- Status bar has inline `style="margin-top:12px;"`. Fix: add margin to `.tm-status` in CSS or use a utility class.

### Low -- Code Quality

- [x] **CR-13** `extractor-config.js:73-96` -- FIELDS array is no longer deduplicated with `new Set()` (was in v5.0.4). Not currently a problem since there are no duplicates, but the safety net was removed. Fix: wrap in `[...new Set([...])]` again, or add a comment confirming no dupes.
- [x] **CR-14** `extractor-ui.js:192` -- Uses `var el;` (ES5 style) in `saveSettings` while the rest of the codebase uses `const/let`. Inconsistent. Fix: use `let el;`.
- [x] **CR-15** `extractor-update.js:166` -- `setInterval` with `VERSION_CHECK_INTERVAL` (24h) will drift and stack if the tab stays open for weeks. Fix: use `setTimeout` with recursive scheduling, or check timestamp in the callback before re-scheduling.
- [ ] **CR-16** All modules -- No `try { module.exports = ... } catch (e) {}` pattern for testability (documented in [multi-tampermonkey-guide.md](multi-tampermonkey-guide.md)). Fix: add export blocks to each module for future unit testing.
- [x] **CR-17** `extractor-ui.js:664-669` -- `resetUI()` calls `location.reload()` without confirming. The user might have unsaved extracted data. Fix: add a confirmation check `if (state.extractedTickets.length > 0)` before reload, or auto-clear with warning.
- [x] **CR-18** `extractor-api.js:12` -- Destructures `{ CONFIG, state, Logger, authHeaders }` from `ns` at module load. `CONFIG` and `state` are mutable objects so this works (reference semantics), but `authHeaders` is a function that could be reassigned. Minor risk. Fix: document the convention or reference `ns.*` directly.

### Enhancement Requests (from review)

- [ ] **CR-19** Add keyboard shortcut to toggle panel visibility (e.g., `Ctrl+Shift+E`)
- [ ] **CR-20** Add CSV export option alongside Excel (lighter weight, no XLSX dependency)
- [ ] **CR-21** Add "Export as you fetch" streaming mode for very large record sets (write to Excel per page instead of accumulating all in memory)
- [ ] **CR-22** Add a "Query History" feature that saves the last 10 queries in GM storage

---

## Milestone Summary

| Phase | Scope | Priority | Status |
|-------|-------|----------|--------|
| 1 | Style Guide Compliance | High | Complete |
| 2 | Toolbox Architecture | High | Complete |
| 3 | Update System | Medium | Complete |
| 4 | Developer Attribution | Low | Complete |
| 5 | Performance / Unlimited Records | High | Complete |
| 6 | Modularization | High | Complete |
| 7 | Bug Fixes / Cleanup | High | Complete |
| 8 | Code Review Fixes | High | 17/18 done (CR-16 deferred) |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-27 | Initial feature tracker created from v5.0.4 audit |
| 2.0 | 2026-02-27 | All phases implemented - v6.0.0 complete |
| 3.0 | 2026-02-27 | Phase 8 added - code review with 18 actionable findings + 4 enhancements |
| 4.0 | 2026-02-27 | 17/18 CR items fixed in v6.0.3. CR-16 (test exports) deferred. Version check interval changed to 1 min. |
