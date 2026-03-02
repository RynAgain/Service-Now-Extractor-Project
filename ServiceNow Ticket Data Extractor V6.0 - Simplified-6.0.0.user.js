// ==UserScript==
// @name         ServiceNow Ticket Data Extractor V6.0 - Simplified
// @namespace    http://tampermonkey.net/
// @version      6.0.7
// @description  Extract ServiceNow ticket metadata - full redesign with dark UI, toolbox architecture, paginated fetching, unlimited records
// @author       Ryan Satterfield
// @match        https://wfmprod.service-now.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// @require      https://raw.githubusercontent.com/RynAgain/Service-Now-Extractor-Project/main/src/extractor-config.js?v=6.0.7
// @require      https://raw.githubusercontent.com/RynAgain/Service-Now-Extractor-Project/main/src/extractor-styles.js?v=6.0.7
// @require      https://raw.githubusercontent.com/RynAgain/Service-Now-Extractor-Project/main/src/extractor-api.js?v=6.0.7
// @require      https://raw.githubusercontent.com/RynAgain/Service-Now-Extractor-Project/main/src/extractor-sctask.js?v=6.0.7
// @require      https://raw.githubusercontent.com/RynAgain/Service-Now-Extractor-Project/main/src/extractor-export.js?v=6.0.7
// @require      https://raw.githubusercontent.com/RynAgain/Service-Now-Extractor-Project/main/src/extractor-update.js?v=6.0.7
// @require      https://raw.githubusercontent.com/RynAgain/Service-Now-Extractor-Project/main/src/extractor-ui.js?v=6.0.7
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/RynAgain/Service-Now-Extractor-Project/main/ServiceNow%20Ticket%20Data%20Extractor%20V6.0%20-%20Simplified-6.0.0.user.js
// @downloadURL  https://raw.githubusercontent.com/RynAgain/Service-Now-Extractor-Project/main/ServiceNow%20Ticket%20Data%20Extractor%20V6.0%20-%20Simplified-6.0.0.user.js
// ==/UserScript==

(function () {
    'use strict';

    // ── Verify modules loaded ──────────────────────────────────
    const ns = window.SNExtractor;
    if (!ns) {
        console.error('[SN-Extractor] Failed to load - config module missing. Check @require directives.');
        return;
    }

    const { Logger } = ns;

    // ── Verify all critical functions exist ─────────────────────
    const requiredFunctions = [
        'injectStyles',     // styles module
        'snFetch',          // api module
        'extractByQuery',   // api module
        'processSCTASKVariables', // sctask module
        'exportToExcel',    // export module
        'checkForUpdates',  // update module
        'createUI'          // ui module
    ];

    const missing = requiredFunctions.filter(function (fn) {
        return typeof ns[fn] !== 'function';
    });

    if (missing.length > 0) {
        console.error(
            '[SN-Extractor] Missing functions from modules: ' + missing.join(', ') +
            '. Some @require files may have failed to load.'
        );
        // Continue anyway - partial functionality is better than none
    }

    // ── Initialize ─────────────────────────────────────────────
    function init() {
        Logger.info('ServiceNow Ticket Data Extractor v' + ns.VERSION + ' initializing...');

        if (typeof ns.createUI === 'function') {
            ns.createUI();
        } else {
            Logger.error('UI module not loaded - cannot create interface');
            return;
        }

        // Start version checking (background, non-blocking)
        if (typeof ns.startVersionChecking === 'function') {
            ns.startVersionChecking();
        }

        Logger.success('Initialization complete');
    }

    // ── Wait for DOM ───────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
