// ============================================================
// ServiceNow Extractor - Configuration Module
// Loaded first via @require. Establishes the shared namespace
// and all constants used by other modules.
// ============================================================
(function () {
    'use strict';

    const CURRENT_VERSION = '6.0.0';

    // ── Shared Namespace ───────────────────────────────────────
    window.SNExtractor = window.SNExtractor || {};
    const ns = window.SNExtractor;

    ns.VERSION = CURRENT_VERSION;
    ns.GITHUB_VERSION_URL =
        'https://raw.githubusercontent.com/RynAgain/ServiceNow-Extractor/main/ServiceNow%20Ticket%20Data%20Extractor%20V6.0%20-%20Simplified-6.0.0.user.js';
    ns.VERSION_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 h

    // ── Feature Flags ──────────────────────────────────────────
    ns.FEATURE_FLAGS = {
        EXTRACT_CURRENT:    true,
        EXTRACT_QUERY:      true,
        SCTASK_PROCESSING:  true,
        EXPORT_EXCEL:       true,
        COPY_JSON:          true,
        AUTO_DETECT_QUERY:  true,
        CLEAR_DATA:         true,
        UPDATE_CHECKER:     true,
        DEV_MARK:           true
    };

    // ── Mutable State ──────────────────────────────────────────
    ns.state = {
        extractedTickets: [],
        isCollapsed: false,
        isDragging: false,
        dragOffset: { x: 0, y: 0 },
        showSettings: false,
        isProcessing: false,
        processingAborted: false,
        currentAccent: 'blue',
        debugMode: false
    };

    // ── Storage Keys ───────────────────────────────────────────
    ns.SK = {
        POSITION:   'tm_ext_pos',
        COLLAPSED:  'tm_ext_coll',
        STATES:     'tm_ext_states',
        GROUPS:     'tm_ext_groups',
        ASSIGNED:   'tm_ext_assigned',
        MAX:        'tm_ext_max',
        QUERY:      'tm_ext_query',
        TABLE:      'tm_ext_table',
        DEBUG:      'tm_ext_debug',
        SCTASK:     'tm_ext_sctask',
        ACCENT:     'tm_accent_theme',
        VCHECK:     'tm_ext_vcheck',
        VSKIP:      'tm_ext_vskip'
    };

    // ── ServiceNow Config ──────────────────────────────────────
    ns.CONFIG = {
        BASE_URL: window.location.origin,
        TABLE_NAME: 'sc_task',
        PAGE_SIZE: 1000,
        SCTASK_CONCURRENCY: 3,
        SCTASK_DELAY_MS: 50,

        FIELDS: [
            'number', 'short_description', 'description', 'state', 'priority',
            'urgency', 'impact', 'category', 'subcategory', 'u_category',
            'u_subcategory', 'assigned_to', 'assignment_group', 'caller_id',
            'opened_by', 'resolved_by', 'closed_by', 'opened_at', 'updated_at',
            'resolved_at', 'closed_at', 'sys_created_on', 'sys_updated_on',
            'due_date', 'expected_start', 'work_start', 'work_end',
            'calendar_duration', 'business_duration', 'location', 'company',
            'department', 'cost_center', 'cmdb_ci', 'asset', 'configuration_item',
            'problem_id', 'rfc', 'change_request', 'parent_incident',
            'child_incidents', 'contact_type', 'notify', 'hold_reason',
            'close_code', 'resolution_code', 'resolution_notes', 'close_notes',
            'work_notes', 'comments', 'additional_comments', 'business_service',
            'service_offering', 'knowledge', 'skills', 'route_reason',
            'reassignment_count', 'reopen_count', 'sys_id', 'sys_class_name',
            'sys_domain', 'sys_created_by', 'sys_updated_by', 'sys_mod_count',
            'sys_tags', 'approval', 'approval_history', 'approval_set',
            'sla_due', 'business_stc', 'calendar_stc', 'time_worked',
            'watch_list', 'follow_up', 'escalation', 'activity_due', 'active',
            'made_sla', 'correlation_id', 'correlation_display', 'incident_state',
            'severity', 'user_input', 'delivery_plan', 'delivery_task',
            'universal_request', 'task_type', 'request_item', 'request',
            'parent', 'variables'
        ],

        STATES: [
            { value: '1',  label: '1 - New' },
            { value: '2',  label: '2 - In Progress' },
            { value: '3',  label: '3 - Pending' },
            { value: '4',  label: '4 - Resolved' },
            { value: '6',  label: '6 - Closed' },
            { value: '7',  label: '7 - Cancelled' },
            { value: '12', label: '12 - Work in Progress' }
        ],

        ACCENTS: {
            blue: { primary: '#3ea6ff', hover: '#65b8ff' },
            red:  { primary: '#ff0000', hover: '#ff3333' }
        }
    };

    // ── Auth Token (cached once) ───────────────────────────────
    ns.USER_TOKEN =
        window.g_ck ||
        (/g_ck\s*=\s*["']([^"']+)/.exec(document.documentElement.innerHTML) || [])[1] ||
        null;

    // ── Logger ─────────────────────────────────────────────────
    ns.Logger = {
        _p: '[SN-Extractor]',
        info:    (m, d) => console.log(  `${ns.Logger._p} ${m}`, d !== undefined ? d : ''),
        warn:    (m, d) => console.warn( `${ns.Logger._p} ${m}`, d !== undefined ? d : ''),
        error:   (m, e) => console.error(`${ns.Logger._p} ${m}`, e !== undefined ? e : ''),
        success: (m, d) => console.log(  `${ns.Logger._p} [OK] ${m}`, d !== undefined ? d : ''),
        debug:   (m, d) => {
            if (!ns.state.debugMode) return;
            console.debug(`${ns.Logger._p} [DBG] ${m}`, d !== undefined ? d : '');
        }
    };

    // ── SVG Icons (Lucide, ISC License) ────────────────────────
    // Each icon is a 16x16 inline SVG string with stroke="currentColor"
    // so it inherits color from the parent element.
    ns.ICONS = {
        extract:
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
            '<polyline points="14 2 14 8 20 8"/>' +
            '<line x1="16" y1="13" x2="8" y2="13"/>' +
            '<line x1="16" y1="17" x2="8" y2="17"/></svg>',

        search:
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="11" cy="11" r="8"/>' +
            '<line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',

        wrench:
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',

        grid:
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>' +
            '<line x1="3" y1="9" x2="21" y2="9"/>' +
            '<line x1="3" y1="15" x2="21" y2="15"/>' +
            '<line x1="9" y1="3" x2="9" y2="21"/></svg>',

        clipboard:
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>' +
            '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',

        trash:
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<polyline points="3 6 5 6 21 6"/>' +
            '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',

        settings:
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="12" r="3"/>' +
            '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',

        chevDown:
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<polyline points="6 9 12 15 18 9"/></svg>',

        chevUp:
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<polyline points="18 15 12 9 6 15"/></svg>',

        x:
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',

        download:
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
            '<polyline points="7 10 12 15 17 10"/>' +
            '<line x1="12" y1="15" x2="12" y2="3"/></svg>',

        refresh:
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>' +
            '<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',

        crosshair:
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="12" r="10"/>' +
            '<line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/>' +
            '<line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>',

        stop:
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>',

        info:
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="12" r="10"/>' +
            '<line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',

        check:
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<polyline points="20 6 9 17 4 12"/></svg>',

        alertTri:
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
            '<line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',

        xCircle:
            '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="12" r="10"/>' +
            '<line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',

        database:
            '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<ellipse cx="12" cy="5" rx="9" ry="3"/>' +
            '<path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>' +
            '<path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>'
    };

    // ── Utility: debounce ──────────────────────────────────────
    ns.debounce = function (fn, ms) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), ms);
        };
    };

    // ── Utility: auth headers ──────────────────────────────────
    ns.authHeaders = function () {
        return {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(ns.USER_TOKEN && { 'X-UserToken': ns.USER_TOKEN })
        };
    };

    ns.Logger.info('Config module loaded');
})();
