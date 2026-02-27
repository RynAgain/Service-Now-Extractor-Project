// ==UserScript==
// @name         ServiceNow Ticket Data Extractor V5.0 - Simplified
// @namespace    http://tampermonkey.net/
// @version      5.0.4
// @description  Extract ServiceNow ticket metadata - simplified version with SCTASK processing
// @author       You
// @match        https://wfmprod.service-now.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// ==/UserScript==

(function() {
    'use strict';

    // Global debug mode toggle
    let DEBUG_MODE = false;

    // Enhanced logging utility
    const Logger = {
        prefix: '[ServiceNow Extractor]',
        info: (message, data = null) => console.log(`${Logger.prefix} ℹ️ ${message}`, data || ''),
        warn: (message, data = null) => console.warn(`${Logger.prefix} ⚠️ ${message}`, data || ''),
        error: (message, error = null) => console.error(`${Logger.prefix} ❌ ${message}`, error || ''),
        success: (message, data = null) => console.log(`${Logger.prefix} ✅ ${message}`, data || ''),
        debug: (message, data = null) => {
            if (!DEBUG_MODE) return;
            console.debug(`${Logger.prefix} 🔍 ${message}`, data || '');
        }
    };

    // Configuration
    const CONFIG = {
        BASE_URL: window.location.origin,
        TABLE_NAME: 'sc_task',
        FIELDS: [...new Set([
            'number', 'short_description', 'description', 'state', 'priority', 'urgency', 'impact',
            'category', 'subcategory', 'u_category', 'u_subcategory',
            'assigned_to', 'assignment_group', 'caller_id', 'opened_by', 'resolved_by', 'closed_by',
            'opened_at', 'updated_at', 'resolved_at', 'closed_at', 'sys_created_on', 'sys_updated_on',
            'due_date', 'expected_start', 'work_start', 'work_end', 'calendar_duration', 'business_duration',
            'location', 'company', 'department', 'cost_center',
            'cmdb_ci', 'asset', 'configuration_item',
            'problem_id', 'rfc', 'change_request', 'parent_incident', 'child_incidents',
            'contact_type', 'notify', 'hold_reason', 'close_code', 'resolution_code',
            'resolution_notes', 'close_notes', 'work_notes', 'comments', 'additional_comments',
            'business_service', 'service_offering', 'knowledge', 'skills', 'route_reason',
            'reassignment_count', 'reopen_count',
            'sys_id', 'sys_class_name', 'sys_domain', 'sys_created_by', 'sys_updated_by',
            'sys_mod_count', 'sys_tags',
            'approval', 'approval_history', 'approval_set',
            'sla_due', 'business_stc', 'calendar_stc', 'time_worked',
            'watch_list', 'follow_up', 'escalation',
            'activity_due', 'active', 'made_sla', 'correlation_id', 'correlation_display',
            'incident_state', 'severity', 'user_input', 'delivery_plan', 'delivery_task',
            'universal_request', 'task_type', 'request_item', 'request', 'parent', 'variables'
        ])],

        STATES: [
            { value: '1', label: '1 - New' },
            { value: '2', label: '2 - In Progress' },
            { value: '3', label: '3 - Pending' },
            { value: '4', label: '4 - Resolved' },
            { value: '6', label: '6 - Closed' },
            { value: '7', label: '7 - Cancelled' },
            { value: '12', label: '12 - Work in Progress' }
        ],

        PRIORITIES: [
            { value: '1', label: '1 - Critical' },
            { value: '2', label: '2 - High' },
            { value: '3', label: '3 - Moderate' },
            { value: '4', label: '4 - Low' },
            { value: '5', label: '5 - Planning' }
        ],

        THEMES: {
            servicenow: {
                name: 'ServiceNow Blue',
                primary: '#0073e7', secondary: '#17a2b8', background: '#fff',
                text: '#333', border: '#ddd', lightBg: '#e8f4fd', accent: '#f0f8ff'
            },
            wholefoods: {
                name: 'Whole Foods Green',
                primary: '#00674a', secondary: '#8bc34a', background: '#fff',
                text: '#2e2e2e', border: '#c8e6c9', lightBg: '#e8f5e8', accent: '#f1f8e9'
            },
            dark: {
                name: 'Dark Mode',
                primary: '#2196f3', secondary: '#03dac6', background: '#1e1e1e',
                text: '#ffffff', border: '#444', lightBg: '#2d2d2d', accent: '#333'
            },
            blackred: {
                name: 'Black & Red',
                primary: '#dc3545', secondary: '#fd7e14', background: '#000000',
                text: '#ffffff', border: '#666', lightBg: '#1a1a1a', accent: '#2a0a0a'
            }
        }
    };

    // Ticket data storage
    let extractedTickets = [];
    let isCollapsed = false;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let currentTheme = 'servicenow';
    let showSettings = false;
    let isProcessing = false;
    let processingAborted = false;

    // Persistent storage keys
    const STORAGE_KEYS = {
        POSITION: 'extractor_position',
        COLLAPSED: 'extractor_collapsed',
        STATES: 'extractor_states',
        ASSIGNMENT_GROUPS: 'extractor_assignment_groups',
        ASSIGNED_TO: 'extractor_assigned_to',
        MAX_RECORDS: 'extractor_max_records',
        CUSTOM_QUERY: 'extractor_custom_query',
        THEME: 'extractor_theme',
        TABLE_NAME: 'extractor_table_name',
        DEBUG_MODE: 'extractor_debug',
        SCTASK_PROCESSING: 'extractor_sctask_processing'
    };

    // CSS-based theming
    function injectThemeCSS() {
        const existingStyle = document.getElementById('extractor-theme-css');
        if (existingStyle) existingStyle.remove();

        const style = document.createElement('style');
        style.id = 'extractor-theme-css';
        style.textContent = `
            .extractor-container { transition: all 0.3s ease; }
            .extractor-header { transition: background-color 0.3s ease; }
            .extractor-input { transition: all 0.3s ease; }
            .extractor-button { transition: all 0.3s ease; }
            .extractor-highlight { transition: all 0.3s ease; }
            .extractor-status { transition: all 0.3s ease; }
            .extractor-scroll-area { transition: all 0.3s ease; }
            .extractor-progress {
                width: 100%; height: 4px; background: #e0e0e0; border-radius: 2px;
                overflow: hidden; margin: 5px 0;
            }
            .extractor-progress-bar {
                height: 100%; background: linear-gradient(90deg, #4caf50, #8bc34a);
                border-radius: 2px; transition: width 0.3s ease;
            }
            .extractor-button:disabled {
                opacity: 0.6; cursor: not-allowed;
            }
            .abort-button {
                background: #dc3545 !important;
                animation: pulse 1s infinite;
            }
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.7; }
                100% { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    // Apply theme
    function applyTheme(themeName) {
        const theme = CONFIG.THEMES[themeName];
        if (!theme) return;

        Logger.debug(`Applying theme: ${theme.name}`);
        currentTheme = themeName;
        const container = document.getElementById('ticket-extractor-ui');
        if (!container) return;

        container.style.setProperty('--primary-color', theme.primary);
        container.style.setProperty('--secondary-color', theme.secondary);
        container.style.setProperty('--background-color', theme.background);
        container.style.setProperty('--text-color', theme.text);
        container.style.setProperty('--border-color', theme.border);
        container.style.setProperty('--light-bg', theme.lightBg);
        container.style.setProperty('--accent-color', theme.accent);

        const style = document.getElementById('extractor-theme-css');
        if (style) {
            style.textContent += `
                #ticket-extractor-ui {
                    background: var(--background-color) !important;
                    border-color: var(--primary-color) !important;
                    color: var(--text-color) !important;
                }
                #ticket-extractor-ui .extractor-header {
                    background: var(--primary-color) !important;
                    color: white !important;
                }
                #ticket-extractor-ui .extractor-input {
                    background: var(--background-color) !important;
                    color: var(--text-color) !important;
                    border-color: var(--border-color) !important;
                }
                #ticket-extractor-ui .extractor-highlight {
                    background: var(--light-bg) !important;
                    border-left-color: var(--primary-color) !important;
                }
                #ticket-extractor-ui .extractor-status {
                    background: var(--light-bg) !important;
                    color: var(--text-color) !important;
                }
                #ticket-extractor-ui .extractor-scroll-area {
                    background: var(--accent-color) !important;
                }
            `;
        }
    }

    // Debounced settings save
    const debouncedSaveSettings = (() => {
        let timeout;
        return () => {
            clearTimeout(timeout);
            timeout = setTimeout(saveSettings, 500);
        };
    })();

    // Progress bar management
    function updateProgress(current, total, message = '') {
        const progressContainer = document.getElementById('progress-container');
        if (!progressContainer) return;

        const percentage = total > 0 ? Math.min((current / total) * 100, 100) : 0;
        const progressBar = progressContainer.querySelector('.extractor-progress-bar');
        const progressText = progressContainer.querySelector('.progress-text');

        if (progressBar) progressBar.style.width = `${percentage}%`;
        if (progressText) {
            progressText.textContent = message || `${current}/${total} (${Math.round(percentage)}%)`;
        }

        if (current >= total && !isProcessing) {
            setTimeout(() => {
                progressContainer.style.display = 'none';
            }, 2000);
        } else {
            progressContainer.style.display = 'block';
        }
    }

    // Authentication headers with cached token
    const USER_TOKEN = window.g_ck || (/g_ck\s*=\s*["']([^"']+)/.exec(document.documentElement.innerHTML)||[])[1] || null;
    function getAuthHeaders(){
        return {
            'Accept':'application/json',
            'Content-Type': 'application/json',
            ...(USER_TOKEN && {'X-UserToken': USER_TOKEN})
        };
    }

    // SCTASK Processing Functions
    const toPlain = v =>
        v == null             ? ''
      : typeof v === 'string' ? v
      : Array.isArray(v)      ? v.map(toPlain).join(', ')
      : typeof v === 'object' ? toPlain(v.display_value ?? v.value ?? JSON.stringify(v))
      : String(v);

    async function snFetch(url, label) {
        const t0 = performance.now();
        try {
            const r = await fetch(url, { headers: getAuthHeaders(), credentials: 'include' });
            const ok = r.ok;
            const body = ok ? await r.json() : await r.text();

            if (!ok) {
                Logger.error(`${label}:`, body);
                return [];
            }

            const duration = Math.round(performance.now() - t0);
            Logger.debug(`${label} → ${(body.result || []).length} rows (${duration} ms)`);
            return body.result || [];
        } catch (error) {
            Logger.error(`${label} failed:`, error);
            return [];
        }
    }

    // Resolve task number → RITM sys_id
    const taskToRITM = async nbr => {
        const rows = await snFetch(
            `${CONFIG.BASE_URL}/api/now/table/sc_task?sysparm_query=number=${encodeURIComponent(nbr)}` +
            `&sysparm_fields=request_item&sysparm_limit=1`,
            'sc_task lookup'
        );
        return rows[0]?.request_item?.value || null;
    };

    // Pull MTOM rows including dot-walked question text/name
    const loadMTOM = ritm => snFetch(
        `${CONFIG.BASE_URL}/api/now/table/sc_item_option_mtom?sysparm_query=request_item=${ritm}` +
        `&sysparm_fields=sc_item_option.item_option_new.question_text,` +
                           `sc_item_option.item_option_new.name,` +
                           `sc_item_option.question,` +
                           `sc_item_option.value,sc_item_option.display_value` +
        `&sysparm_display_value=all&sysparm_exclude_reference_link=true&sysparm_limit=1000`,
        'sc_item_option_mtom'
    );

    // Extract one Q-A pair from a row
    const getQA = row => {
        const qRaw =
             row['sc_item_option.item_option_new.question_text'] ||
             row['sc_item_option.item_option_new.name'] ||
             row['sc_item_option.question'] ||
             '';
        const q = toPlain(qRaw).trim();
        const a = toPlain(row['sc_item_option.display_value'] ?? row['sc_item_option.value']).trim();
        return q && a ? [q, a] : null;
    };

    const fold = rows => rows.reduce((out, row) => {
        const qa = getQA(row);
        if (qa) out[`var_${qa[0].replace(/[^a-zA-Z0-9]/g, '_')}`] = qa[1];
        return out;
    }, {});

    // Main SCTASK variable extraction function
    async function getTaskVariables(taskNbr) {
        if (processingAborted) return {};

        Logger.debug(`Processing ${taskNbr}...`);

        const ritm = await taskToRITM(taskNbr);
        if (!ritm) {
            Logger.warn(`Task ${taskNbr} not found or has no RITM`);
            return {};
        }

        const rows = await loadMTOM(ritm);
        const vars = fold(rows);

        Logger.debug(`Task ${taskNbr} → ${Object.keys(vars).length} variables`);
        return vars;
    }

    // Process all SCTASK tickets for variables
    async function processSCTASKVariables() {
        if (isProcessing) return;

        const sctaskTickets = extractedTickets.filter(ticket =>
            ticket.number && ticket.number.startsWith('SCTASK')
        );

        if (sctaskTickets.length === 0) {
            updateStatus('No SCTASK tickets found to process');
            return;
        }

        isProcessing = true;
        processingAborted = false;

        // Update button to show abort option
        const processBtn = document.getElementById('process-sctask');
        if (processBtn) {
            processBtn.textContent = '⏹️ Abort SCTASK Processing';
            processBtn.className += ' abort-button';
            processBtn.onclick = () => {
                processingAborted = true;
                Logger.warn('SCTASK processing aborted by user');
                updateStatus('SCTASK processing aborted by user');
                resetSCTASKProcessingState();
            };
        }

        try {
            updateStatus(`Processing ${sctaskTickets.length} SCTASK tickets for variables...`);
            updateProgress(0, sctaskTickets.length, 'Starting SCTASK processing...');

            let processed = 0;
            let variablesFound = 0;

            for (const ticket of sctaskTickets) {
                if (processingAborted) break;

                try {
                    const variables = await getTaskVariables(ticket.number);

                    // Add variables to the ticket
                    Object.assign(ticket, variables);
                    variablesFound += Object.keys(variables).length;

                } catch (error) {
                    Logger.error(`Failed to process ${ticket.number}:`, error);
                }

                processed++;
                updateProgress(processed, sctaskTickets.length,
                    `Processed ${processed}/${sctaskTickets.length} tickets (${variablesFound} variables found)`);

                // Small delay to prevent overwhelming the server
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            if (!processingAborted) {
                updateStatus(`SCTASK processing complete: ${processed} tickets processed, ${variablesFound} variables found`);
                Logger.success(`SCTASK processing complete`, {
                    ticketsProcessed: processed,
                    variablesFound: variablesFound
                });
            }

        } catch (error) {
            Logger.error('SCTASK processing failed:', error);
            updateStatus(`SCTASK processing failed: ${error.message}`);
        } finally {
            resetSCTASKProcessingState();
        }
    }

    // Reset SCTASK processing state
    function resetSCTASKProcessingState() {
        isProcessing = false;
        processingAborted = false;

        const processBtn = document.getElementById('process-sctask');
        if (processBtn) {
            processBtn.textContent = '🔧 Process SCTASK Variables';
            processBtn.className = processBtn.className.replace(' abort-button', '');
            processBtn.onclick = processSCTASKVariables;
        }
    }

    // Copy to clipboard functionality
    function copyToClipboard(data, format = 'json') {
        Logger.info(`Copying ${extractedTickets.length} tickets to clipboard as ${format.toUpperCase()}`);

        try {
            let content;
            if (format === 'json') {
                content = JSON.stringify(data, null, 2);
            } else {
                content = data;
            }

            navigator.clipboard.writeText(content).then(() => {
                Logger.success(`Successfully copied ${format.toUpperCase()} to clipboard`, {
                    records: Array.isArray(data) ? data.length : 1,
                    size: `${content.length} characters`
                });
                updateStatus(`Copied ${format.toUpperCase()} to clipboard!`);
            });
        } catch (error) {
            Logger.error('Failed to copy to clipboard', error);
            updateStatus(`Failed to copy: ${error.message}`);
        }
    }

    // Reset UI settings
    function resetUISettings() {
        Logger.info('Resetting UI settings to defaults');
        if (confirm('Reset UI position and theme to defaults?')) {
            GM_setValue(STORAGE_KEYS.POSITION, { x: 10, y: 10 });
            GM_setValue(STORAGE_KEYS.THEME, 'servicenow');
            Logger.success('UI settings reset, reloading page');
            location.reload();
        }
    }

    // Toggle settings panel
    function toggleSettings() {
        showSettings = !showSettings;
        const settingsPanel = document.getElementById('settings-panel');
        const settingsBtn = document.getElementById('settings-btn');

        if (settingsPanel) {
            settingsPanel.style.display = showSettings ? 'block' : 'none';
            settingsBtn.style.background = showSettings ? 'rgba(255,255,255,0.3)' : 'none';
        }

        Logger.debug(`Settings panel ${showSettings ? 'opened' : 'closed'}`);
    }

    // Utility function to keep UI within viewport bounds
    function constrainToViewport(element) {
        const rect = element.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        let newLeft = rect.left;
        let newTop = rect.top + scrollTop;

        if (rect.right > viewportWidth) {
            newLeft = viewportWidth - rect.width - 10;
        }
        if (newLeft < 10) {
            newLeft = 10;
        }

        if (rect.bottom > viewportHeight + scrollTop) {
            newTop = viewportHeight + scrollTop - rect.height - 10;
        }
        if (newTop < scrollTop + 10) {
            newTop = scrollTop + 10;
        }

        element.style.left = newLeft + 'px';
        element.style.top = newTop + 'px';
    }

    // Auto-adjust UI position on window events
    function setupViewportConstraints() {
        const container = document.getElementById('ticket-extractor-ui');
        if (!container) return;

        let timeout;
        const debouncedConstrain = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => constrainToViewport(container), 100);
        };

        window.addEventListener('resize', debouncedConstrain);
        window.addEventListener('scroll', debouncedConstrain);

        const observer = new MutationObserver(debouncedConstrain);
        observer.observe(container, {
            childList: true, subtree: true, attributes: true,
            attributeFilter: ['style']
        });
    }

    // Parse ServiceNow URI to extract query parameters
    function parseServiceNowURI(uri = window.location.href) {
        try {
            let query = '';

            if (uri.includes('nav_to.do')) {
                const urlParams = new URLSearchParams(uri.split('?')[1]);
                const innerUri = urlParams.get('uri');
                if (innerUri) {
                    const decodedUri = decodeURIComponent(innerUri);
                    const match = decodedUri.match(/sysparm_query=([^&]+)/);
                    if (match) {
                        query = decodeURIComponent(match[1]);
                    }
                }
            } else {
                const urlParams = new URLSearchParams(uri.split('?')[1]);
                query = urlParams.get('sysparm_query') || '';
            }

            return query;
        } catch (error) {
            console.error('Error parsing URI:', error);
            return '';
        }
    }

    // Auto-detect current page query
    function detectCurrentPageQuery() {
        const currentQuery = parseServiceNowURI();
        if (currentQuery) {
            document.getElementById('custom-query').value = currentQuery;
            updateStatus(`Detected query from current page: ${currentQuery.substring(0, 100)}${currentQuery.length > 100 ? '...' : ''}`);
            debouncedSaveSettings();
        } else {
            updateStatus('No query detected on current page');
        }
    }

    // Load saved settings
    function loadSettings() {
        const settings = {
            position: GM_getValue(STORAGE_KEYS.POSITION, { x: 10, y: 10 }),
            collapsed: GM_getValue(STORAGE_KEYS.COLLAPSED, false),
            states: GM_getValue(STORAGE_KEYS.STATES, []),
            assignmentGroups: GM_getValue(STORAGE_KEYS.ASSIGNMENT_GROUPS, ''),
            assignedTo: GM_getValue(STORAGE_KEYS.ASSIGNED_TO, ''),
            maxRecords: GM_getValue(STORAGE_KEYS.MAX_RECORDS, 100),
            customQuery: GM_getValue(STORAGE_KEYS.CUSTOM_QUERY, ''),
            theme: GM_getValue(STORAGE_KEYS.THEME, 'servicenow'),
            tableName: GM_getValue(STORAGE_KEYS.TABLE_NAME, 'sc_task'),
            debugMode: GM_getValue(STORAGE_KEYS.DEBUG_MODE, false),
            sctaskProcessing: GM_getValue(STORAGE_KEYS.SCTASK_PROCESSING, true)
        };

        // Set debug mode
        DEBUG_MODE = settings.debugMode;

        Logger.debug('Settings loaded', settings);
        return settings;
    }

    // Save settings
    function saveSettings() {
        const container = document.getElementById('ticket-extractor-ui');
        if (container) {
            const rect = container.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            GM_setValue(STORAGE_KEYS.POSITION, {
                x: rect.left,
                y: rect.top + scrollTop
            });
        }
        GM_setValue(STORAGE_KEYS.COLLAPSED, isCollapsed);
        GM_setValue(STORAGE_KEYS.STATES, getSelectedStates());
        GM_setValue(STORAGE_KEYS.ASSIGNMENT_GROUPS, document.getElementById('assignment-groups')?.value || '');
        GM_setValue(STORAGE_KEYS.ASSIGNED_TO, document.getElementById('assigned-to')?.value || '');
        GM_setValue(STORAGE_KEYS.MAX_RECORDS, document.getElementById('max-records')?.value || 100);
        GM_setValue(STORAGE_KEYS.CUSTOM_QUERY, document.getElementById('custom-query')?.value || '');
        GM_setValue(STORAGE_KEYS.THEME, document.getElementById('theme-select')?.value || 'servicenow');
        GM_setValue(STORAGE_KEYS.TABLE_NAME, document.getElementById('table-select')?.value || 'sc_task');
        GM_setValue(STORAGE_KEYS.DEBUG_MODE, document.getElementById('debug-mode')?.checked || false);
        GM_setValue(STORAGE_KEYS.SCTASK_PROCESSING, document.getElementById('sctask-processing')?.checked || false);

        // Update DEBUG_MODE immediately
        DEBUG_MODE = document.getElementById('debug-mode')?.checked || false;

        Logger.debug('Settings saved');
    }

    // Get selected states
    function getSelectedStates() {
        const checkboxes = document.querySelectorAll('#states-container input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    // Create UI elements
    function createUI() {
        const settings = loadSettings();
        isCollapsed = settings.collapsed;
        currentTheme = settings.theme;

        injectThemeCSS();

        const container = document.createElement('div');
        container.id = 'ticket-extractor-ui';
        container.className = 'extractor-container';
        container.style.cssText = `
            position: fixed;
            top: ${settings.position.y}px;
            left: ${settings.position.x}px;
            background: #fff;
            border: 2px solid #0073e7;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            min-width: 320px;
            max-width: 420px;
            max-height: 90vh;
            font-family: Arial, sans-serif;
            user-select: none;
            overflow: hidden;
        `;

        container.innerHTML = `
            <div id="extractor-header" class="extractor-header" style="
                background: #0073e7;
                color: white;
                padding: 10px 15px;
                cursor: move;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-radius: 6px 6px 0 0;
                flex-shrink: 0;
            ">
                <h3 style="margin: 0; font-size: 14px;">ServiceNow Extractor v4.0</h3>
                <div>
                    <button id="settings-btn" style="
                        background: none; border: none; color: white; cursor: pointer;
                        padding: 4px 6px; margin-right: 5px; border-radius: 3px; font-size: 14px;
                    " title="Settings">⚙️</button>
                    <button id="collapse-btn" style="
                        background: none; border: none; color: white; cursor: pointer;
                        padding: 2px 6px; border-radius: 3px; font-size: 12px;
                    ">${isCollapsed ? '+' : '-'}</button>
                </div>
            </div>

            <!-- Settings Panel -->
            <div id="settings-panel" style="
                display: none;
                padding: 15px;
                border-bottom: 1px solid #ddd;
                background: #f8f9fa;
                max-height: 60vh;
                overflow-y: auto;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h4 style="margin: 0; font-size: 12px;">Settings</h4>
                    <button id="reset-ui" style="
                        background: #dc3545; color: white; border: none; padding: 2px 6px;
                        border-radius: 3px; font-size: 10px; cursor: pointer;
                    " title="Reset position and theme">Reset</button>
                </div>

                <!-- Table Selection -->
                <div style="margin-bottom: 12px;">
                    <label style="font-weight: bold; font-size: 11px; color: #333;">Table:</label>
                    <select id="table-select" class="extractor-input" style="width: 100%; padding: 4px; margin-top: 3px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; box-sizing: border-box;">
                        <option value="sc_task" ${settings.tableName === 'sc_task' ? 'selected' : ''}>Service Catalog Tasks (sc_task)</option>
                        <option value="task" ${settings.tableName === 'task' ? 'selected' : ''}>All Tasks (task)</option>
                        <option value="incident" ${settings.tableName === 'incident' ? 'selected' : ''}>Incidents (incident)</option>
                        <option value="sc_req_item" ${settings.tableName === 'sc_req_item' ? 'selected' : ''}>Request Items (sc_req_item)</option>
                        <option value="change_request" ${settings.tableName === 'change_request' ? 'selected' : ''}>Change Requests (change_request)</option>
                    </select>
                </div>

                <!-- Theme Selection -->
                <div style="margin-bottom: 12px;">
                    <label style="font-weight: bold; font-size: 11px; color: #333;">Theme:</label>
                    <select id="theme-select" class="extractor-input" style="width: 100%; padding: 4px; margin-top: 3px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; box-sizing: border-box;">
                        ${Object.entries(CONFIG.THEMES).map(([key, theme]) =>
                            `<option value="${key}" ${settings.theme === key ? 'selected' : ''}>${theme.name}</option>`
                        ).join('')}
                    </select>
                </div>

                <!-- SCTASK Processing Option -->
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 11px; cursor: pointer; display: flex; align-items: center;">
                        <input type="checkbox" id="sctask-processing" ${settings.sctaskProcessing ? 'checked' : ''} style="margin-right: 8px;">
                        <strong>🔧 Enable SCTASK Variable Processing</strong>
                    </label>
                    <small style="display: block; margin-top: 5px; color: #666; font-size: 10px;">
                        Extract catalog variables for SCTASK tickets (adds processing time)
                    </small>
                </div>

                <!-- Debug Mode -->
                <div style="margin-bottom: 12px;">
                    <label style="font-size: 11px; cursor: pointer; display: flex; align-items: center;">
                        <input type="checkbox" id="debug-mode" ${settings.debugMode ? 'checked' : ''} style="margin-right: 8px;">
                        <strong>🔍 Debug Mode (verbose console logs)</strong>
                    </label>
                </div>
            </div>

            <div id="extractor-content" style="
                padding: 15px;
                display: ${isCollapsed ? 'none' : 'block'};
                max-height: calc(90vh - 50px);
                overflow-y: auto;
                overflow-x: hidden;
            ">
                <!-- Progress Bar -->
                <div id="progress-container" style="display: none; margin-bottom: 10px;">
                    <div class="extractor-progress">
                        <div class="extractor-progress-bar" style="width: 0%;"></div>
                    </div>
                    <div class="progress-text" style="font-size: 10px; text-align: center; color: #666;"></div>
                </div>

                <!-- Auto-detect current page query -->
                <div class="extractor-highlight" style="margin-bottom: 15px; padding: 10px; background: #e8f4fd; border-radius: 4px; border-left: 4px solid #0073e7;">
                    <button id="detect-query" class="extractor-button" style="
                        width: 100%; padding: 8px 12px; background: #17a2b8; color: white;
                        border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;
                    ">🔍 Auto-Detect Current Page Query</button>
                    <small style="display: block; margin-top: 5px; color: #666; font-size: 10px;">
                        Click to automatically extract the query from your current ServiceNow list view
                    </small>
                </div>

                <!-- States Filter -->
                <div style="margin-bottom: 15px;">
                    <label style="font-weight: bold; font-size: 12px; color: #333;">States:</label>
                    <div id="states-container" class="extractor-scroll-area" style="
                        max-height: 120px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px;
                        padding: 8px; margin-top: 5px; background: #f9f9f9;
                    ">
                        ${CONFIG.STATES.map(state => `
                            <div style="margin: 3px 0;">
                                <label style="font-size: 11px; cursor: pointer;">
                                    <input type="checkbox" value="${state.value}" ${settings.states.includes(state.value) ? 'checked' : ''}>
                                    ${state.label}
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Assignment Groups -->
                <div style="margin-bottom: 12px;">
                    <label style="font-weight: bold; font-size: 12px; color: #333;">Assignment Groups:</label>
                    <input type="text" id="assignment-groups" class="extractor-input" value="${settings.assignmentGroups}"
                           placeholder="e.g., IT Support, Network Team"
                           style="width: 100%; padding: 6px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; box-sizing: border-box;">
                    <small style="color: #666; font-size: 10px;">Comma-separated group names</small>
                </div>

                <!-- Assigned To -->
                <div style="margin-bottom: 12px;">
                    <label style="font-weight: bold; font-size: 12px; color: #333;">Assigned To:</label>
                    <input type="text" id="assigned-to" class="extractor-input" value="${settings.assignedTo}"
                           placeholder="username or email"
                           style="width: 100%; padding: 6px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; box-sizing: border-box;">
                </div>

                <!-- Max Records -->
                <div style="margin-bottom: 12px;">
                    <label style="font-weight: bold; font-size: 12px; color: #333;">Max Records:</label>
                    <select id="max-records" class="extractor-input" style="width: 100%; padding: 6px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; box-sizing: border-box;">
                        <option value="10" ${settings.maxRecords == 10 ? 'selected' : ''}>10</option>
                        <option value="50" ${settings.maxRecords == 50 ? 'selected' : ''}>50</option>
                        <option value="100" ${settings.maxRecords == 100 ? 'selected' : ''}>100</option>
                        <option value="250" ${settings.maxRecords == 250 ? 'selected' : ''}>250</option>
                        <option value="500" ${settings.maxRecords == 500 ? 'selected' : ''}>500</option>
                        <option value="1000" ${settings.maxRecords == 1000 ? 'selected' : ''}>1000</option>
                    </select>
                </div>

                <!-- Custom Query -->
                <div style="margin-bottom: 15px;">
                    <label style="font-weight: bold; font-size: 12px; color: #333;">ServiceNow Query:</label>
                    <textarea id="custom-query" class="extractor-input" placeholder="assignment_group=807ef9f0db32481069ee1329689619b6^state=1^ORstate=12"
                              style="width: 100%; height: 80px; padding: 6px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; resize: vertical; box-sizing: border-box;">${settings.customQuery}</textarea>
                    <small style="color: #666; font-size: 10px;">ServiceNow query format (use ^ for AND, ^OR for OR)</small>
                </div>

                <!-- Action Buttons -->
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <button id="extract-current" class="extractor-button" style="
                        padding: 8px 12px; background: #0073e7; color: white; border: none;
                        border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;
                    ">📄 Extract Current Page</button>

                    <button id="extract-query" class="extractor-button" style="
                        padding: 8px 12px; background: #28a745; color: white; border: none;
                        border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;
                    ">🔍 Extract by Query/Filters</button>

                    <button id="process-sctask" class="extractor-button" style="
                        padding: 8px 12px; background: #fd7e14; color: white; border: none;
                        border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;
                        display: ${settings.sctaskProcessing ? 'block' : 'none'};
                    ">🔧 Process SCTASK Variables</button>

                    <div style="display: flex; gap: 5px;">
                        <button id="export-excel" class="extractor-button" style="
                            flex: 1; padding: 8px 12px; background: #ffc107; color: black; border: none;
                            border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;
                        " disabled>📊 Excel (0)</button>

                        <button id="copy-json" class="extractor-button" style="
                            padding: 8px 12px; background: #6f42c1; color: white; border: none;
                            border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;
                        " disabled title="Copy as JSON">📋</button>

                        <button id="clear-data" class="extractor-button" style="
                            padding: 8px 12px; background: #dc3545; color: white; border: none;
                            border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;
                        ">🗑️</button>
                    </div>
                </div>

                <div id="status" class="extractor-status" style="
                    margin-top: 12px; padding: 8px; background: #f8f9fa; border-radius: 4px;
                    font-size: 11px; color: #666; min-height: 20px; word-wrap: break-word;
                ">Ready to extract tickets...</div>
            </div>
        `;

        document.body.appendChild(container);

        applyTheme(currentTheme);

        container.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            resetUISettings();
        });

        setTimeout(() => {
            constrainToViewport(container);
            setupViewportConstraints();
        }, 100);

        bindEvents();
        setupDragAndDrop();

        setTimeout(() => {
            if (window.location.href.includes('list.do') || window.location.href.includes('nav_to.do')) {
                const autoQuery = parseServiceNowURI();
                if (autoQuery && !settings.customQuery) {
                    updateStatus(`Auto-detected query: ${autoQuery.substring(0, 50)}...`);
                }
            }
        }, 1000);
    }

    // Setup drag and drop functionality
    function setupDragAndDrop() {
        const header = document.getElementById('extractor-header');
        const container = document.getElementById('ticket-extractor-ui');

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('#settings-btn') || e.target.closest('#collapse-btn')) return;

            isDragging = true;
            const rect = container.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;

            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', handleDragEnd);
        });

        function handleDrag(e) {
            if (!isDragging) return;

            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const containerWidth = container.offsetWidth;
            const containerHeight = container.offsetHeight;

            let x = e.clientX - dragOffset.x;
            let y = e.clientY - dragOffset.y;

            x = Math.max(10, Math.min(x, viewportWidth - containerWidth - 10));
            y = Math.max(10, Math.min(y, viewportHeight - containerHeight - 10));

            container.style.left = x + 'px';
            container.style.top = y + 'px';
        }

        function handleDragEnd() {
            isDragging = false;
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', handleDragEnd);
            saveSettings();
        }
    }

    // Bind event listeners
    function bindEvents() {
        document.getElementById('extract-current').addEventListener('click', extractCurrentPageTickets);
        document.getElementById('extract-query').addEventListener('click', extractByQuery);
        document.getElementById('process-sctask').addEventListener('click', processSCTASKVariables);
        document.getElementById('export-excel').addEventListener('click', exportToExcel);
        document.getElementById('copy-json').addEventListener('click', () => copyToClipboard(extractedTickets, 'json'));
        document.getElementById('clear-data').addEventListener('click', clearData);
        document.getElementById('detect-query').addEventListener('click', detectCurrentPageQuery);
        document.getElementById('collapse-btn').addEventListener('click', toggleCollapse);
        document.getElementById('settings-btn').addEventListener('click', toggleSettings);
        document.getElementById('reset-ui').addEventListener('click', resetUISettings);

        document.getElementById('theme-select').addEventListener('change', (e) => {
            applyTheme(e.target.value);
            saveSettings();
        });

        document.getElementById('table-select').addEventListener('change', (e) => {
            CONFIG.TABLE_NAME = e.target.value;
            saveSettings();
        });

        document.getElementById('debug-mode').addEventListener('change', (e) => {
            DEBUG_MODE = e.target.checked;
            saveSettings();
        });

        document.getElementById('sctask-processing').addEventListener('change', (e) => {
            const isEnabled = e.target.checked;
            const processBtn = document.getElementById('process-sctask');
            processBtn.style.display = isEnabled ? 'block' : 'none';
            saveSettings();
        });

        const debouncedInputs = ['assignment-groups', 'assigned-to', 'custom-query'];
        const immediateInputs = ['max-records', 'theme-select', 'table-select', 'debug-mode', 'sctask-processing'];

        debouncedInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', debouncedSaveSettings);
                element.addEventListener('change', saveSettings);
            }
        });

        immediateInputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', saveSettings);
            }
        });

        document.getElementById('states-container').addEventListener('change', saveSettings);
    }

    // Toggle collapse/expand
    function toggleCollapse() {
        isCollapsed = !isCollapsed;
        const content = document.getElementById('extractor-content');
        const btn = document.getElementById('collapse-btn');

        content.style.display = isCollapsed ? 'none' : 'block';
        btn.textContent = isCollapsed ? '+' : '-';

        if (isCollapsed) {
            showSettings = false;
            document.getElementById('settings-panel').style.display = 'none';
            document.getElementById('settings-btn').style.background = 'none';
        }

        setTimeout(() => constrainToViewport(document.getElementById('ticket-extractor-ui')), 50);
        saveSettings();
    }

    // Build query from UI inputs
    function buildQueryFromUI() {
        const customQuery = document.getElementById('custom-query').value.trim();
        if (customQuery) return customQuery;

        const queryParts = [];
        const selectedStates = getSelectedStates();

        if (selectedStates.length > 0) {
            if (selectedStates.length === 1) {
                queryParts.push(`state=${selectedStates[0]}`);
            } else {
                queryParts.push(`stateIN${selectedStates.join(',')}`);
            }
        }

        const assignmentGroups = document.getElementById('assignment-groups').value.trim();
        if (assignmentGroups) {
            const groups = assignmentGroups.split(',').map(g => g.trim()).filter(g => g);
            if (groups.length === 1) {
                queryParts.push(`assignment_group.name=${groups[0]}`);
            } else if (groups.length > 1) {
                queryParts.push(`assignment_group.nameIN${groups.join(',')}`);
            }
        }

        const assignedTo = document.getElementById('assigned-to').value.trim();
        if (assignedTo) {
            queryParts.push(`assigned_to.user_name=${assignedTo}`);
        }

        return queryParts.join('^');
    }

    // Extract tickets from current page
    function extractCurrentPageTickets() {
        updateStatus('Extracting tickets from current page...');

        const listRows = document.querySelectorAll('tr[data-list_id], tr.list_row, tr[sys_id]:not([sys_id=""])');

        if (listRows.length > 0) {
            extractFromListView(listRows);
        } else {
            extractFromFormView();
        }
    }

    // Extract from ServiceNow list view
    function extractFromListView(rows) {
        const tickets = [];

        rows.forEach(row => {
            const ticket = {};
            const cells = row.querySelectorAll('td');

            ticket.sys_id = row.getAttribute('sys_id') ||
                           row.getAttribute('data-sys_id') ||
                           row.querySelector('input[name="sys_id"]')?.value ||
                           '';

            cells.forEach(cell => {
                const fieldName = cell.getAttribute('name') ||
                                cell.getAttribute('data-field') ||
                                cell.className.replace(/list_decoration_cell\s*/g, '');

                if (fieldName && CONFIG.FIELDS.includes(fieldName)) {
                    const textContent = cell.textContent.trim();
                    const linkElement = cell.querySelector('a:not(.icon)');

                    if (linkElement && linkElement.textContent.trim() && !linkElement.classList.contains('icon')) {
                        ticket[fieldName] = linkElement.textContent.trim();
                    } else if (textContent) {
                        ticket[fieldName] = textContent;
                    }
                }
            });

            if (!ticket.number) {
                const firstCell = row.querySelector('td a:not(.icon)');
                if (firstCell && firstCell.textContent.match(/\w+\d+/)) {
                    ticket.number = firstCell.textContent.trim();
                }
            }

            if (Object.keys(ticket).length > 1) {
                tickets.push(ticket);
            }
        });

        addTicketsToCollection(tickets);
        updateStatus(`Extracted ${tickets.length} tickets from list view`);
    }

    // Extract from ServiceNow form view
    function extractFromFormView() {
        const ticket = {};

        CONFIG.FIELDS.forEach(field => {
            const element = document.querySelector(`[name="${field}"]`) ||
                          document.querySelector(`#${field}`) ||
                          document.querySelector(`[data-field="${field}"]`);

            if (element) {
                ticket[field] = element.value || element.textContent.trim();
            }
        });

        if (Object.keys(ticket).length > 0) {
            addTicketsToCollection([ticket]);
            updateStatus('Extracted 1 ticket from form view');
        } else {
            updateStatus('No ticket data found on current page');
        }
    }

    // Clean ticket data - preserves reference sys_ids
    function cleanTicketData(ticket) {
        const clean = {};

        Object.keys(ticket).forEach(field => {
            let value = ticket[field];

            // For reference fields keep the sys_id, but also keep the label for readability
            const refFields = ['request_item', 'request', 'parent', 'cmdb_ci', 'assigned_to', 'assignment_group', 'caller_id', 'opened_by', 'resolved_by', 'closed_by'];
            if (refFields.includes(field) && typeof value === 'object' && value !== null) {
                clean[field] = value.value || null;              // sys_id
                clean[`${field}_dv`] = value.display_value || ''; // label
                return;
            }

            // Handle other object types
            if (typeof value === 'object' && value !== null) {
                if (value.display_value !== undefined) {
                    value = value.display_value;
                } else if (value.value !== undefined) {
                    value = value.value;
                } else {
                    value = JSON.stringify(value);
                }
            }

            if (typeof value === 'string') {
                value = value.replace(/\n/g, ' ').trim();
            }

            clean[field] = value;
        });

        return clean;
    }

    // Extract tickets using ServiceNow API
    async function extractByQuery() {
        // Prevent multiple simultaneous extractions
        if (isProcessing) {
            Logger.warn('Extraction already in progress');
            return;
        }

        const query = buildQueryFromUI();
        const maxRecords = document.getElementById('max-records').value;
        const tableName = document.getElementById('table-select')?.value || CONFIG.TABLE_NAME;

        if (!query) {
            updateStatus('Please specify at least one filter or use the ServiceNow query field');
            return;
        }

        isProcessing = true;
        updateStatus('Extracting tickets via API...');

        try {
            const fieldsParam = CONFIG.FIELDS.join(',');

            const url = `${CONFIG.BASE_URL}/api/now/table/${tableName}` +
                       `?sysparm_query=${encodeURIComponent(query)}` +
                       `&sysparm_fields=${fieldsParam}` +
                       `&sysparm_limit=${maxRecords}` +
                       `&sysparm_display_value=all` +
                       `&sysparm_exclude_reference_link=true`;

            const response = await fetch(url, {
                method: 'GET',
                headers: getAuthHeaders(),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            let rawTickets = data.result || [];

            if (rawTickets.length === 0) {
                updateStatus('No tickets found matching your criteria');
                return;
            }

            let tickets = rawTickets.map(ticket => cleanTicketData(ticket));

            const existingIds = new Set(extractedTickets.map(t => t.sys_id));
            let newTicketCount = 0;

            tickets.forEach(ticket => {
                if (!existingIds.has(ticket.sys_id)) {
                    extractedTickets.push(ticket);
                    existingIds.add(ticket.sys_id);
                    newTicketCount++;
                }
            });

            updateExportButton();
            updateStatus(`Extracted ${newTicketCount} tickets via API`);

        } catch (error) {
            Logger.error('API extraction failed:', error);
            updateStatus(`API extraction failed: ${error.message}. Try using 'Extract Current Page' instead.`);
        } finally {
            isProcessing = false;
        }
    }

    // Add tickets to collection
    function addTicketsToCollection(tickets) {
        const existingIds = new Set(extractedTickets.map(t => t.sys_id));

        tickets.forEach(ticket => {
            if (!existingIds.has(ticket.sys_id)) {
                const cleanTicket = (typeof ticket.sys_id === 'object') ? cleanTicketData(ticket) : ticket;
                extractedTickets.push(cleanTicket);
                existingIds.add(cleanTicket.sys_id);
            }
        });

        updateExportButton();
    }

    // Export to Excel
    function exportToExcel() {
        if (extractedTickets.length === 0) {
            updateStatus('No tickets to export');
            return;
        }

        updateStatus('Generating Excel file...');

        try {
            const wb = XLSX.utils.book_new();

            // Clean all data before export
            const cleanedForExport = extractedTickets.map(ticket => {
                const cleaned = {};
                Object.keys(ticket).forEach(key => {
                    let value = ticket[key];
                    if (value === null || value === undefined) {
                        cleaned[key] = '';
                    } else if (typeof value === 'object') {
                        cleaned[key] = JSON.stringify(value);
                    } else {
                        cleaned[key] = String(value);
                    }
                });
                return cleaned;
            });

            const ws = XLSX.utils.json_to_sheet(cleanedForExport);

            const allColumns = new Set();
            cleanedForExport.forEach(ticket => {
                Object.keys(ticket).forEach(key => allColumns.add(key));
            });

            const colWidths = Array.from(allColumns).map(field => {
                const maxLength = Math.max(
                    field.length,
                    ...cleanedForExport.map(ticket =>
                        String(ticket[field] || '').length
                    )
                );
                return { wch: Math.min(maxLength + 2, 50) };
            });
            ws['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(wb, ws, 'ServiceNow Tickets');

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `servicenow-tickets-${timestamp}.xlsx`;

            XLSX.writeFile(wb, filename);

            updateStatus(`Exported ${extractedTickets.length} tickets to ${filename}`);

            setTimeout(() => {
                if (confirm('Export successful! Clear the extracted data to free up memory?')) {
                    clearData();
                }
            }, 1000);

        } catch (error) {
            console.error('Export failed:', error);
            updateStatus(`Export failed: ${error.message}`);
        }
    }

    // Clear collected data
    function clearData() {
        extractedTickets = [];
        updateExportButton();
        updateStatus('Data cleared - Ready to extract tickets...');
    }

    // Update export button state
    function updateExportButton() {
        const excelBtn = document.getElementById('export-excel');
        const jsonBtn = document.getElementById('copy-json');

        excelBtn.textContent = `📊 Excel (${extractedTickets.length})`;
        excelBtn.disabled = extractedTickets.length === 0;
        jsonBtn.disabled = extractedTickets.length === 0;
    }

    // Update status message
    function updateStatus(message) {
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = message;
            Logger.info(`Status: ${message}`);
        }
    }

    // Initialize when page loads
    function init() {
        Logger.info('Starting application initialization');

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                Logger.info('DOM loaded, creating UI');
                createUI();
            });
        } else {
            Logger.info('DOM already loaded, creating UI immediately');
            createUI();
        }
    }

    window.addEventListener('beforeunload', () => {
        Logger.info('Page unloading, saving settings');
        saveSettings();
    });

    Logger.info('ServiceNow Ticket Data Extractor v4.0.4 initializing...');
    init();

})();