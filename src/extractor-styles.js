// ============================================================
// ServiceNow Extractor - Styles Module
// Injects all CSS as a single <style> block using CSS custom
// properties for theming. Dark-mode-first per style guide.
// ============================================================
(function () {
    'use strict';

    const ns = window.SNExtractor;
    if (!ns) { console.error('[SN-Extractor] Config module not loaded'); return; }

    /**
     * Injects or re-injects the full CSS stylesheet.
     * Call once at init, and again if accent theme changes.
     */
    ns.injectStyles = function () {
        let el = document.getElementById('tm-ext-css');
        if (el) el.remove();

        const accent = ns.CONFIG.ACCENTS[ns.state.currentAccent] || ns.CONFIG.ACCENTS.blue;
        const isLight = ns.state.currentMode === 'light';

        // Mode-dependent color values
        const bg = isLight
            ? { primary: '#ffffff', secondary: '#f5f5f5', tertiary: '#e8e8e8', elevated: '#f0f0f0' }
            : { primary: '#0f0f0f', secondary: '#1a1a1a', tertiary: '#242424', elevated: '#2d2d2d' };
        const text = isLight
            ? { primary: '#1a1a1a', secondary: '#555555', disabled: '#999999' }
            : { primary: '#f1f1f1', secondary: '#aaaaaa', disabled: '#717171' };
        const border = isLight
            ? { subtle: '#e0e0e0', def: '#cccccc', strong: '#aaaaaa' }
            : { subtle: '#303030', def: '#3f3f3f', strong: '#525252' };

        const style = document.createElement('style');
        style.id = 'tm-ext-css';
        style.textContent = `
/* ── CSS Custom Properties ─────────────────────────────── */
#tm-ext-root {
    --tm-bg-primary:    ${bg.primary};
    --tm-bg-secondary:  ${bg.secondary};
    --tm-bg-tertiary:   ${bg.tertiary};
    --tm-bg-elevated:   ${bg.elevated};

    --tm-text-primary:  ${text.primary};
    --tm-text-secondary:${text.secondary};
    --tm-text-disabled: ${text.disabled};

    --tm-border-subtle: ${border.subtle};
    --tm-border-default:${border.def};
    --tm-border-strong: ${border.strong};

    --tm-accent-primary:${accent.primary};
    --tm-accent-hover:  ${accent.hover};
    --tm-accent-success:#2e7d32;
    --tm-accent-warning:#f9a825;
    --tm-accent-error:  #d32f2f;

    --tm-space-1: 4px;
    --tm-space-2: 8px;
    --tm-space-3: 12px;
    --tm-space-4: 16px;
    --tm-space-5: 20px;
    --tm-space-6: 24px;

    --tm-font-xs:  11px;
    --tm-font-sm:  12px;
    --tm-font-base:14px;
    --tm-font-md:  16px;
    --tm-font-lg:  18px;

    --tm-radius-sm: 4px;
    --tm-radius-md: 8px;
    --tm-radius-lg: 12px;

    --tm-fast:   100ms ease;
    --tm-normal: 150ms ease;
    --tm-slow:   250ms ease-out;

    font-family: 'Roboto', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* ── Panel Container ───────────────────────────────────── */
.tm-panel {
    position: fixed;
    z-index: 9999;
    font-size: var(--tm-font-base);
    color: var(--tm-text-primary);
    background: var(--tm-bg-secondary);
    border: 1px solid var(--tm-border-subtle);
    border-radius: var(--tm-radius-md);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    min-width: 280px;
    max-width: 400px;
    max-height: 90vh;
    overflow: hidden;
    user-select: none;
    font-family: inherit;
}

/* ── Collapsed Toggle ──────────────────────────────────── */
.tm-toggle-btn {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--tm-bg-secondary);
    border: 1px solid var(--tm-border-subtle);
    border-radius: var(--tm-radius-md);
    cursor: grab;
    color: var(--tm-text-secondary);
    transition: background var(--tm-fast);
}
.tm-toggle-btn:hover {
    background: var(--tm-bg-tertiary);
    color: var(--tm-text-primary);
}
.tm-toggle-btn:active { cursor: grabbing; }

/* ── Header ────────────────────────────────────────────── */
.tm-hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--tm-space-3) var(--tm-space-4);
    background: var(--tm-bg-tertiary);
    border-bottom: 1px solid var(--tm-border-subtle);
    cursor: grab;
    border-radius: var(--tm-radius-md) var(--tm-radius-md) 0 0;
}
.tm-hdr:active { cursor: grabbing; }
.tm-title {
    font-size: var(--tm-font-sm);
    font-weight: 600;
    color: var(--tm-text-primary);
    margin: 0;
    display: flex;
    align-items: center;
    gap: var(--tm-space-2);
}
.tm-title svg { color: var(--tm-accent-primary); }
.tm-hdr-acts {
    display: flex;
    align-items: center;
    gap: var(--tm-space-1);
}

/* ── Content ───────────────────────────────────────────── */
.tm-body {
    padding: var(--tm-space-3);
    max-height: calc(90vh - 48px);
    overflow-y: auto;
    overflow-x: hidden;
    user-select: text;
}
.tm-body::-webkit-scrollbar { width: 6px; }
.tm-body::-webkit-scrollbar-track { background: var(--tm-bg-primary); }
.tm-body::-webkit-scrollbar-thumb {
    background: var(--tm-border-default);
    border-radius: 3px;
}
.tm-body::-webkit-scrollbar-thumb:hover { background: var(--tm-border-strong); }

/* ── Buttons ───────────────────────────────────────────── */
.tm-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--tm-space-2);
    padding: var(--tm-space-2) var(--tm-space-4);
    font-size: var(--tm-font-sm);
    font-weight: 500;
    font-family: inherit;
    border-radius: var(--tm-radius-sm);
    cursor: pointer;
    transition: background var(--tm-fast), color var(--tm-fast);
    min-height: 32px;
    border: none;
    line-height: 1;
    color: var(--tm-text-primary);
}
.tm-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
}
.tm-btn-p {
    background: var(--tm-accent-primary);
    color: var(--tm-bg-primary);
}
.tm-btn-p:hover:not(:disabled) { background: var(--tm-accent-hover); }

.tm-btn-s {
    background: transparent;
    color: var(--tm-accent-primary);
    border: 1px solid var(--tm-accent-primary);
}
/* CR-09: Use accent-aware alpha for hover */
.tm-btn-s:hover:not(:disabled) { background: color-mix(in srgb, var(--tm-accent-primary) 10%, transparent); }

.tm-btn-g {
    background: transparent;
    color: var(--tm-text-secondary);
    padding: var(--tm-space-2);
    min-width: 32px;
    min-height: 32px;
    border: none;
}
.tm-btn-g:hover:not(:disabled) {
    color: var(--tm-text-primary);
    background: var(--tm-bg-tertiary);
}

.tm-btn-ok { background: var(--tm-accent-success); color: var(--tm-text-primary); }
.tm-btn-ok:hover:not(:disabled) { background: #388e3c; }

.tm-btn-wn { background: var(--tm-accent-warning); color: var(--tm-bg-primary); }
.tm-btn-wn:hover:not(:disabled) { background: #fbc02d; }

.tm-btn-er { background: var(--tm-accent-error); color: var(--tm-text-primary); }
.tm-btn-er:hover:not(:disabled) { background: #e53935; }

.tm-btn-f { width: 100%; }

/* ── Form Inputs ───────────────────────────────────────── */
.tm-inp, .tm-sel, .tm-ta {
    background: var(--tm-bg-primary);
    color: var(--tm-text-primary);
    border: 1px solid var(--tm-border-default);
    border-radius: var(--tm-radius-sm);
    padding: var(--tm-space-2) var(--tm-space-3);
    font-size: var(--tm-font-sm);
    font-family: inherit;
    width: 100%;
    box-sizing: border-box;
    transition: border-color var(--tm-fast);
}
.tm-inp:focus, .tm-sel:focus, .tm-ta:focus {
    outline: none;
    border-color: var(--tm-accent-primary);
}
.tm-inp::placeholder, .tm-ta::placeholder { color: var(--tm-text-disabled); }
.tm-ta { resize: vertical; min-height: 60px; }
.tm-sel { cursor: pointer; }

/* ── Labels & Hints ────────────────────────────────────── */
.tm-lbl {
    display: block;
    font-size: var(--tm-font-xs);
    font-weight: 500;
    color: var(--tm-text-secondary);
    margin-bottom: var(--tm-space-1);
}
.tm-hint {
    font-size: var(--tm-font-xs);
    color: var(--tm-text-disabled);
    margin-top: var(--tm-space-1);
}

/* ── Sections & Dividers ───────────────────────────────── */
.tm-sec { margin-bottom: var(--tm-space-3); }
.tm-sec:last-child { margin-bottom: 0; }
.tm-hr {
    height: 1px;
    background: var(--tm-border-subtle);
    margin: var(--tm-space-3) 0;
    border: none;
}

/* ── Checkbox Area ─────────────────────────────────────── */
.tm-cb-area {
    max-height: 100px;
    overflow-y: auto;
    border: 1px solid var(--tm-border-subtle);
    border-radius: var(--tm-radius-sm);
    padding: var(--tm-space-2);
    background: var(--tm-bg-primary);
}
.tm-cb-item {
    display: flex;
    align-items: center;
    gap: var(--tm-space-2);
    padding: 2px 0;
    font-size: var(--tm-font-xs);
    color: var(--tm-text-secondary);
    cursor: pointer;
}
.tm-cb-item:hover { color: var(--tm-text-primary); }
.tm-cb-item input[type="checkbox"] {
    accent-color: var(--tm-accent-primary);
    margin: 0;
}

/* ── Toggle Switch ─────────────────────────────────────── */
.tm-sw {
    position: relative;
    width: 36px;
    height: 20px;
    background: var(--tm-border-default);
    border-radius: 10px;
    cursor: pointer;
    transition: background var(--tm-fast);
    flex-shrink: 0;
}
.tm-sw.on { background: var(--tm-accent-primary); }
.tm-sw::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: var(--tm-text-primary);
    border-radius: 50%;
    transition: transform var(--tm-fast);
}
.tm-sw.on::after { transform: translateX(16px); }

.tm-sw-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--tm-space-3);
    padding: var(--tm-space-1) 0;
}
.tm-sw-lbl {
    font-size: var(--tm-font-xs);
    font-weight: 500;
    color: var(--tm-text-secondary);
}

/* ── Progress Bar ──────────────────────────────────────── */
.tm-prog {
    width: 100%;
    height: 4px;
    background: var(--tm-bg-primary);
    border-radius: 2px;
    overflow: hidden;
    margin: var(--tm-space-2) 0;
}
.tm-prog-bar {
    height: 100%;
    background: var(--tm-accent-success);
    border-radius: 2px;
    transition: width 250ms ease;
    width: 0%;
}
.tm-prog-txt {
    font-size: var(--tm-font-xs);
    text-align: center;
    color: var(--tm-text-disabled);
}

/* ── Status Bar ────────────────────────────────────────── */
.tm-status {
    padding: var(--tm-space-2) var(--tm-space-3);
    background: var(--tm-bg-primary);
    border-radius: var(--tm-radius-sm);
    font-size: var(--tm-font-xs);
    color: var(--tm-text-secondary);
    min-height: 18px;
    word-wrap: break-word;
}

/* ── Layout Helpers ────────────────────────────────────── */
.tm-btn-row { display: flex; gap: var(--tm-space-2); }
.tm-btn-row > * { flex: 1; }
.tm-stack { display: flex; flex-direction: column; gap: var(--tm-space-2); }

/* ── Settings Panel ────────────────────────────────────── */
.tm-stg {
    padding: var(--tm-space-3);
    border-bottom: 1px solid var(--tm-border-subtle);
    background: var(--tm-bg-primary);
    max-height: 50vh;
    overflow-y: auto;
}
.tm-stg-title {
    font-size: var(--tm-font-xs);
    font-weight: 600;
    color: var(--tm-text-primary);
    margin: 0 0 var(--tm-space-3) 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

/* ── Toast Notifications ───────────────────────────────── */
/* CR-10: Use CSS custom properties with fallbacks for elements outside #tm-ext-root */
.tm-toast-wrap {
    --tm-bg-elevated: ${bg.elevated};
    --tm-border-subtle: ${border.subtle};
    --tm-text-primary: ${text.primary};
    --tm-accent-primary: ${accent.primary};
    --tm-accent-success: #2e7d32;
    --tm-accent-warning: #f9a825;
    --tm-accent-error: #d32f2f;
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
    font-family: 'Roboto', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
}
.tm-toast {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--tm-bg-elevated);
    border: 1px solid var(--tm-border-subtle);
    border-radius: 8px;
    font-size: 12px;
    color: var(--tm-text-primary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    opacity: 0;
    transform: translateX(20px);
    transition: opacity 250ms ease-out, transform 250ms ease-out;
    pointer-events: auto;
    max-width: 360px;
}
.tm-toast.vis { opacity: 1; transform: translateX(0); }
.tm-toast-i { flex-shrink: 0; }
.tm-toast-info .tm-toast-i { color: var(--tm-accent-primary); }
.tm-toast-ok .tm-toast-i   { color: var(--tm-accent-success); }
.tm-toast-wn .tm-toast-i   { color: var(--tm-accent-warning); }
.tm-toast-er .tm-toast-i   { color: var(--tm-accent-error); }
.tm-toast-m { flex: 1; }
.tm-toast-a {
    background: transparent;
    border: none;
    color: var(--tm-accent-primary);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
    font-family: inherit;
    white-space: nowrap;
}
.tm-toast-a:hover { background: color-mix(in srgb, var(--tm-accent-primary) 10%, transparent); }

/* ── Update Modal ──────────────────────────────────────── */
/* CR-10: Duplicate CSS vars for elements outside #tm-ext-root */
.tm-modal-bg {
    --tm-bg-primary: ${bg.primary};
    --tm-bg-secondary: ${bg.secondary};
    --tm-border-subtle: ${border.subtle};
    --tm-text-primary: ${text.primary};
    --tm-text-secondary: ${text.secondary};
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 9995;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Roboto', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
}
.tm-modal {
    background: var(--tm-bg-secondary);
    border: 1px solid var(--tm-border-subtle);
    border-radius: 8px;
    padding: 24px;
    max-width: 360px;
    width: 90%;
    color: var(--tm-text-primary);
}
.tm-modal h3 { font-size: 16px; font-weight: 600; margin: 0 0 16px 0; }
.tm-modal p  { font-size: 12px; color: var(--tm-text-secondary); margin: 0 0 12px 0; line-height: 1.5; }
.tm-modal-ver {
    display: flex;
    justify-content: space-between;
    padding: 12px;
    background: var(--tm-bg-primary);
    border-radius: 4px;
    margin-bottom: 16px;
    font-size: 12px;
}
.tm-modal-acts { display: flex; flex-direction: column; gap: 8px; }

/* ── Developer Attribution ─────────────────────────────── */
.tm-dev {
    text-align: center;
    padding: var(--tm-space-2) 0;
    font-size: var(--tm-font-xs);
    color: var(--tm-text-disabled);
}
.tm-dev a { color: #58a6ff; text-decoration: none; }
.tm-dev a:hover { text-decoration: underline; }

/* ── Focus Ring ────────────────────────────────────────── */
#tm-ext-root *:focus-visible {
    outline: 2px solid var(--tm-accent-primary);
    outline-offset: 2px;
}

/* ── Highlight Block ───────────────────────────────────── */
.tm-hl {
    background: var(--tm-bg-primary);
    border-left: 3px solid var(--tm-accent-primary);
    border-radius: var(--tm-radius-sm);
    padding: var(--tm-space-3);
}

/* ── Utility Classes ───────────────────────────────────── */
/* CR-11: Small button variant for Reset UI */
.tm-btn-xs { padding: 2px 8px; font-size: 10px; min-height: 20px; }
/* CR-12: Status top margin */
.tm-status-top { margin-top: var(--tm-space-3); }

/* ── Badge ─────────────────────────────────────────────── */
.tm-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    background: var(--tm-accent-primary);
    color: var(--tm-bg-primary);
    font-size: 10px;
    font-weight: 600;
    padding: 0 4px;
}
        `;
        document.head.appendChild(style);
    };

    ns.Logger.info('Styles module loaded');

    // CR-16: Export for testing
    try { module.exports = { injectStyles: ns.injectStyles }; } catch (e) { /* browser */ }
})();
