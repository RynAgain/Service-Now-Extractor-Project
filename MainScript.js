// ==UserScript==
// @name         ServiceNow Ticket Data Extractor v3.3
// @namespace    http://tampermonkey.net/
// @version      3.3
// @description  Extract ServiceNow ticket metadata to Excel
// @author       You
// @match        https://wfmprod.service-now.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// ==/UserScript==

(function() {
    'use strict';

    // Prevent multiple instances
    if (window.ticketExtractorInstance) {
        console.log('ServiceNow Extractor: Instance already exists');
        return;
    }
    window.ticketExtractorInstance = true;

    // Configuration
    const CONFIG = {
        BASE_URL: window.location.origin,

        AVAILABLE_TABLES: {
            'incident': {
                name: 'Incidents',
                description: 'IT service disruptions and issues'
            },
            'sc_request': {
                name: 'Service Requests',
                description: 'User requests for services or items'
            },
            'sc_task': {
                name: 'Catalog Tasks',
                description: 'Tasks created from service requests'
            },
            'change_request': {
                name: 'Change Requests',
                description: 'Changes to IT infrastructure'
            },
            'problem': {
                name: 'Problems',
                description: 'Root cause of incidents'
            }
        },

        AVAILABLE_FIELDS: {
            'number': {
                name: 'Ticket Number',
                description: 'Unique identifier (e.g., INC0001234)'
            },
            'short_description': {
                name: 'Short Description',
                description: 'Brief summary of the issue'
            },
            'description': {
                name: 'Description',
                description: 'Detailed description of the issue'
            },
            'state': {
                name: 'State',
                description: 'Current status of the ticket'
            },
            'priority': {
                name: 'Priority',
                description: 'Business priority level'
            },
            'urgency': {
                name: 'Urgency',
                description: 'How quickly resolution is needed'
            },
            'impact': {
                name: 'Impact',
                description: 'Business impact level'
            },
            'category': {
                name: 'Category',
                description: 'Primary classification'
            },
            'subcategory': {
                name: 'Subcategory',
                description: 'Secondary classification'
            },
            'assigned_to': {
                name: 'Assigned To',
                description: 'Person responsible for resolution'
            },
            'assignment_group': {
                name: 'Assignment Group',
                description: 'Team responsible for resolution'
            },
            'opened_at': {
                name: 'Opened At',
                description: 'When the ticket was created'
            },
            'updated_at': {
                name: 'Updated At',
                description: 'Last modification time'
            },
            'sys_created_on': {
                name: 'Created On',
                description: 'System creation timestamp'
            },
            'caller_id': {
                name: 'Caller',
                description: 'Person who reported the issue'
            },
            'sys_id': {
                name: 'System ID',
                description: 'Internal database identifier'
            },
            'close_code': {
                name: 'Close Code',
                description: 'Resolution classification'
            },
            'close_notes': {
                name: 'Close Notes',
                description: 'Resolution details'
            },
            'work_notes': {
                name: 'Work Notes',
                description: 'Internal work documentation'
            },
            'business_service': {
                name: 'Business Service',
                description: 'Affected service'
            },
            'cmdb_ci': {
                name: 'Configuration Item',
                description: 'Affected infrastructure component'
            },
            'location': {
                name: 'Location',
                description: 'Physical location'
            },
            'company': {
                name: 'Company',
                description: 'Requesting organization'
            }
        },

        FILTER_OPTIONS: {
            'assigned_to': {
                name: 'Assigned To',
                description: 'Filter by assignee',
                type: 'user',
                examples: ['javascript:gs.getUserID()', 'admin', 'john.doe']
            },
            'assignment_group': {
                name: 'Assignment Group',
                description: 'Filter by assignment group',
                type: 'reference',
                examples: ['IT Support', 'Network Team', 'Service Desk']
            },
            'state': {
                name: 'State',
                description: 'Current ticket status',
                type: 'choice',
                values: {
                    '1': 'New',
                    '2': 'In Progress',
                    '3': 'On Hold',
                    '4': 'Resolved',
                    '6': 'Resolved',
                    '7': 'Closed',
                    '8': 'Canceled'
                }
            },
            'priority': {
                name: 'Priority',
                description: 'Business priority level',
                type: 'choice',
                values: {
                    '1': 'Critical',
                    '2': 'High',
                    '3': 'Moderate',
                    '4': 'Low',
                    '5': 'Planning'
                }
            },
            'urgency': {
                name: 'Urgency',
                description: 'Speed of resolution needed',
                type: 'choice',
                values: {
                    '1': 'High',
                    '2': 'Medium',
                    '3': 'Low'
                }
            },
            'impact': {
                name: 'Impact',
                description: 'Business impact level',
                type: 'choice',
                values: {
                    '1': 'High',
                    '2': 'Medium',
                    '3': 'Low'
                }
            },
            'category': {
                name: 'Category',
                description: 'Primary classification',
                type: 'string',
                examples: ['Hardware', 'Software', 'Network', 'Security']
            },
            'caller_id': {
                name: 'Caller',
                description: 'Person who reported the issue',
                type: 'user',
                examples: ['javascript:gs.getUserID()', 'john.doe']
            },
            'opened_at': {
                name: 'Opened Date',
                description: 'When ticket was created',
                type: 'date',
                examples: ['2024-01-01', 'javascript:gs.daysAgoStart(7)']
            },
            'sys_created_on': {
                name: 'Created Date',
                description: 'System creation date',
                type: 'date',
                examples: ['2024-01-01', 'javascript:gs.daysAgoStart(30)']
            },
            'number': {
                name: 'Ticket Number',
                description: 'Specific ticket number',
                type: 'string',
                examples: ['INC0001234', 'REQ0005678']
            },
            'short_description': {
                name: 'Short Description',
                description: 'Search in summary text',
                type: 'string',
                examples: ['password', 'network', 'email']
            }
        },

        THEMES: {
            'wholefoodsGreen': {
                name: 'Whole Foods Green',
                primary: '#004e36',
                secondary: '#006b4a',
                accent: '#00a86b',
                light: '#e8f5f0'
            },
            'servicenowBlue': {
                name: 'ServiceNow Blue',
                primary: '#0073e7',
                secondary: '#0056b3',
                accent: '#4da6ff',
                light: '#e6f3ff'
            },
            'corporateGray': {
                name: 'Corporate Gray',
                primary: '#343a40',
                secondary: '#495057',
                accent: '#6c757d',
                light: '#f8f9fa'
            }
        }
    };

    // Global state
    let extractedTickets = [];
    let selectedFields = [];
    let selectedTables = ['incident'];
    let filters = [];
    let currentTheme = 'wholefoodsGreen';
    let isMinimized = false;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    // Load saved settings
    function loadSettings() {
        try {
            selectedFields = JSON.parse(GM_getValue('selectedFields', '[]'));
            if (selectedFields.length === 0) {
                selectedFields = ['number', 'short_description', 'state', 'priority', 'assigned_to', 'assignment_group', 'opened_at', 'sys_id'];
            }

            selectedTables = JSON.parse(GM_getValue('selectedTables', '["incident"]'));
            filters = JSON.parse(GM_getValue('filters', '[]'));
            currentTheme = GM_getValue('currentTheme', 'wholefoodsGreen');
        } catch (e) {
            console.warn('Failed to load settings:', e);
            selectedFields = ['number', 'short_description', 'state', 'priority', 'assigned_to', 'assignment_group', 'opened_at', 'sys_id'];
            selectedTables = ['incident'];
            filters = [];
            currentTheme = 'wholefoodsGreen';
        }
    }

    // Save settings
    function saveSettings() {
        try {
            GM_setValue('selectedFields', JSON.stringify(selectedFields));
            GM_setValue('selectedTables', JSON.stringify(selectedTables));
            GM_setValue('filters', JSON.stringify(filters));
            GM_setValue('currentTheme', currentTheme);
        } catch (e) {
            console.warn('Failed to save settings:', e);
        }
    }

    // Get current theme colors
    function getThemeColors() {
        return CONFIG.THEMES[currentTheme] || CONFIG.THEMES.wholefoodsGreen;
    }

    // Enhanced API call with better error handling and longer timeout
    async function fetchWithTimeout(url, options, timeout = 30000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout - try reducing max records or using "Extract Current Page"');
            }
            throw error;
        }
    }

    // Improved API call method with multiple attempts
    async function queryTableSimple(tableName, query, fields, limit) {
        const attempts = [
            // Attempt 1: Basic REST API
            async () => {
                let url = `${CONFIG.BASE_URL}/api/now/table/${tableName}`;
                const params = new URLSearchParams();

                if (fields && fields.length > 0) {
                    params.append('sysparm_fields', fields.join(','));
                }
                if (limit) {
                    params.append('sysparm_limit', Math.min(limit, 500).toString()); // Limit to 500 max
                }
                if (query) {
                    params.append('sysparm_query', query);
                }

                if (params.toString()) {
                    url += '?' + params.toString();
                }

                const response = await fetchWithTimeout(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'include'
                }, 30000);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                return await response.json();
            },

            // Attempt 2: JSON API endpoint
            async () => {
                let url = `${CONFIG.BASE_URL}/${tableName}.do`;
                const params = new URLSearchParams({
                    JSONv2: '',
                    sysparm_action: 'getRecords',
                    sysparm_max_records: Math.min(limit || 100, 500).toString()
                });

                if (fields && fields.length > 0) {
                    params.append('sysparm_fields', fields.join(','));
                }
                if (query) {
                    params.append('sysparm_query', query);
                }

                url += '?' + params.toString();

                const response = await fetchWithTimeout(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'include'
                }, 30000);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                return { result: data.records || [] };
            }
        ];

        let lastError;
        for (let i = 0; i < attempts.length; i++) {
            try {
                updateStatus(`🔍 Querying ${tableName} (attempt ${i + 1})...`);
                const result = await attempts[i]();
                return result;
            } catch (error) {
                lastError = error;
                console.warn(`Attempt ${i + 1} failed for ${tableName}:`, error);
                if (i < attempts.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between attempts
                }
            }
        }

        throw new Error(`All API attempts failed: ${lastError.message}`);
    }

    // Create the main UI
    function createUI() {
        const existing = document.getElementById('ticket-extractor-ui');
        if (existing) {
            existing.remove();
        }

        const colors = getThemeColors();
        const container = document.createElement('div');
        container.id = 'ticket-extractor-ui';
        container.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #fff;
            border: 2px solid ${colors.primary};
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            min-width: 400px;
            max-width: 500px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            user-select: none;
            max-height: 90vh;
            overflow: hidden;
        `;

        container.innerHTML = createUIHTML();
        document.body.appendChild(container);

        bindEvents();
        setupGlobalFunctions(); // NEW: Setup global functions
        updateFieldsList();
        updateTablesList();
        updateFiltersList();
        updateExportButton();
    }

    // NEW: Setup global functions properly
    function setupGlobalFunctions() {
        // Filter management functions
        window.SNExtractor_updateFilter = function(filterId, property, value) {
            const filter = filters.find(f => f.id === filterId);
            if (filter) {
                filter[property] = value;
                saveSettings();
            }
        };

        window.SNExtractor_updateDateFilter = function(filterId) {
            const filter = filters.find(f => f.id === filterId);
            if (filter && filter.dateStart) {
                if (filter.dateEnd) {
                    filter.value = `javascript:gs.dateGenerate('${filter.dateStart}','00:00:00')^${filter.field}<=javascript:gs.dateGenerate('${filter.dateEnd}','23:59:59')`;
                    filter.operator = '>=';
                } else {
                    filter.value = `javascript:gs.dateGenerate('${filter.dateStart}','00:00:00')`;
                    filter.operator = '>=';
                }
                saveSettings();
            }
        };

        window.SNExtractor_removeFilter = function(filterId) {
            filters = filters.filter(f => f.id !== filterId);
            updateFiltersList();
            saveSettings();
        };

        window.SNExtractor_addQuickFilter = function(field, operator, value) {
            const filterId = 'filter-' + Date.now();
            filters.push({ id: filterId, field, operator, value, dateStart: '', dateEnd: '' });
            updateFiltersList();
            saveSettings();
        };

        // Table management functions
        window.SNExtractor_toggleTable = function(tableKey) {
            if (selectedTables.includes(tableKey)) {
                selectedTables = selectedTables.filter(t => t !== tableKey);
            } else {
                selectedTables.push(tableKey);
            }
            saveSettings();
        };

        // Field management functions
        window.SNExtractor_toggleField = function(fieldKey) {
            if (selectedFields.includes(fieldKey)) {
                selectedFields = selectedFields.filter(f => f !== fieldKey);
            } else {
                selectedFields.push(fieldKey);
            }
            saveSettings();
        };
    }

    // Create the HTML structure (using new function names)
    function createUIHTML() {
        const colors = getThemeColors();
        const userInfo = getUserInfo();

        return `
            <div id="extractor-header" style="
                background: ${colors.primary};
                color: white;
                padding: 12px 15px;
                border-radius: 6px 6px 0 0;
                cursor: move;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h3 style="margin: 0; font-size: 14px; font-weight: 600;">ServiceNow Ticket Extractor</h3>
                <div>
                    <button id="settings-btn" style="
                        background: rgba(255,255,255,0.2);
                        border: none;
                        color: white;
                        cursor: pointer;
                        font-size: 14px;
                        margin-right: 8px;
                        padding: 4px 8px;
                        border-radius: 3px;
                    " title="Settings">⚙</button>
                    <button id="minimize-btn" style="
                        background: none;
                        border: none;
                        color: white;
                        cursor: pointer;
                        font-size: 16px;
                        margin-right: 5px;
                        padding: 2px 6px;
                    " title="Minimize">−</button>
                    <button id="close-btn" style="
                        background: none;
                        border: none;
                        color: white;
                        cursor: pointer;
                        font-size: 16px;
                        padding: 2px 6px;
                    " title="Close">×</button>
                </div>
            </div>

            <div id="extractor-content" style="
                padding: 15px;
                max-height: calc(90vh - 60px);
                overflow-y: auto;
            ">
                <!-- Tabs -->
                <div id="tabs" style="
                    display: flex;
                    border-bottom: 2px solid ${colors.light};
                    margin-bottom: 15px;
                ">
                    <button class="tab-btn active" data-tab="extract" style="
                        flex: 1;
                        padding: 8px;
                        border: none;
                        background: ${colors.primary};
                        color: white;
                        cursor: pointer;
                        font-size: 12px;
                    ">Extract</button>
                    <button class="tab-btn" data-tab="filters" style="
                        flex: 1;
                        padding: 8px;
                        border: none;
                        background: ${colors.light};
                        color: ${colors.primary};
                        cursor: pointer;
                        font-size: 12px;
                    ">Filters</button>
                    <button class="tab-btn" data-tab="tables" style="
                        flex: 1;
                        padding: 8px;
                        border: none;
                        background: ${colors.light};
                        color: ${colors.primary};
                        cursor: pointer;
                        font-size: 12px;
                    ">Tables</button>
                    <button class="tab-btn" data-tab="fields" style="
                        flex: 1;
                        padding: 8px;
                        border: none;
                        background: ${colors.light};
                        color: ${colors.primary};
                        cursor: pointer;
                        font-size: 12px;
                    ">Fields</button>
                </div>

                <!-- Extract Tab -->
                <div id="tab-extract" class="tab-content">
                    <div style="margin-bottom: 15px;">
                        <div style="background: ${colors.light}; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
                            <div style="font-size: 11px; color: #666;">
                                <strong>User:</strong> ${userInfo.username}<br>
                                <strong>URL:</strong> ${window.location.hostname}<br>
                                <strong>Page:</strong> ${getCurrentPageType()}
                            </div>
                        </div>

                        <label style="font-size: 12px; color: #666;">Max Records (API only):</label>
                        <input type="number" id="max-records" value="100" min="1" max="500"
                               style="width: 100%; padding: 6px; margin-top: 4px; font-size: 12px; border: 1px solid #ddd; border-radius: 4px;">
                        <div style="font-size: 10px; color: #666; margin-top: 2px;">
                            Max 500 records to avoid timeouts
                        </div>
                    </div>

                    <button id="extract-current" style="
                        width: 100%;
                        padding: 12px;
                        margin: 8px 0;
                        background: ${colors.primary};
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 500;
                    ">📋 Extract Current Page</button>

                    <div style="font-size: 10px; color: #666; margin: 4px 0 12px 0; text-align: center;">
                        Best for: Currently visible list or form (Recommended)
                    </div>

                    <button id="extract-query" style="
                        width: 100%;
                        padding: 12px;
                        margin: 8px 0;
                        background: ${colors.secondary};
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 500;
                    ">🔍 Extract by API Query</button>

                    <div style="font-size: 10px; color: #666; margin: 4px 0 12px 0; text-align: center;">
                        Uses REST API with your filters (slower, may timeout)
                    </div>

                    <button id="export-excel" style="
                        width: 100%;
                        padding: 12px;
                        margin: 16px 0 8px 0;
                        background: #ffc107;
                        color: #000;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: 500;
                    " disabled>📊 Export to Excel (0 tickets)</button>

                    <button id="clear-data" style="
                        width: 100%;
                        padding: 8px;
                        margin: 8px 0;
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">🗑️ Clear Data</button>
                </div>

                <!-- Filters Tab -->
                <div id="tab-filters" class="tab-content" style="display: none;">
                    <div style="margin-bottom: 15px;">
                        <div id="filters-container"></div>
                        <button id="add-filter" style="
                            width: 100%;
                            padding: 8px;
                            background: ${colors.secondary};
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 12px;
                            margin-top: 8px;
                        ">+ Add Filter</button>
                        <div style="font-size: 10px; color: #666; margin-top: 5px; text-align: center;">
                            Filters only apply to API queries
                        </div>
                    </div>
                </div>

                <!-- Tables Tab -->
                <div id="tab-tables" class="tab-content" style="display: none;">
                    <div style="margin-bottom: 15px;">
                        <h4 style="margin: 0 0 10px 0; font-size: 12px; color: #666; text-transform: uppercase;">Select Tables for API Query</h4>
                        <div id="tables-container"></div>
                        <div style="font-size: 10px; color: #666; margin-top: 8px;">
                            Multiple tables will create separate Excel sheets
                        </div>
                    </div>
                </div>

                <!-- Fields Tab -->
                <div id="tab-fields" class="tab-content" style="display: none;">
                    <div style="margin-bottom: 15px;">
                        <h4 style="margin: 0 0 10px 0; font-size: 12px; color: #666; text-transform: uppercase;">Export Fields</h4>
                        <div id="fields-container" style="
                            max-height: 200px;
                            overflow-y: auto;
                            border: 1px solid #ddd;
                            padding: 8px;
                            border-radius: 4px;
                            background: #f9f9f9;
                        "></div>
                        <div style="margin-top: 8px;">
                            <button id="select-all-fields" style="
                                font-size: 11px;
                                padding: 4px 8px;
                                margin-right: 5px;
                                background: ${colors.accent};
                                color: white;
                                border: none;
                                border-radius: 3px;
                                cursor: pointer;
                            ">Select All</button>
                            <button id="clear-all-fields" style="
                                font-size: 11px;
                                padding: 4px 8px;
                                background: #dc3545;
                                color: white;
                                border: none;
                                border-radius: 3px;
                                cursor: pointer;
                            ">Clear All</button>
                        </div>
                    </div>
                </div>

                <!-- Status -->
                <div id="status" style="
                    margin-top: 15px;
                    font-size: 11px;
                    color: #666;
                    padding: 8px;
                    background: ${colors.light};
                    border-radius: 4px;
                    border-left: 3px solid ${colors.primary};
                    min-height: 16px;
                ">Ready - ${extractedTickets.length} tickets loaded</div>
            </div>

            <!-- Settings Modal -->
            <div id="settings-modal" style="
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 10001;
            ">
                <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    width: 300px;
                ">
                    <h3 style="margin: 0 0 15px 0;">Settings</h3>
                    <div style="margin-bottom: 15px;">
                        <label style="font-size: 12px; color: #666;">Theme:</label>
                        <select id="theme-select" style="width: 100%; padding: 6px; margin-top: 4px;">
                            ${Object.entries(CONFIG.THEMES).map(([key, theme]) =>
                                `<option value="${key}" ${currentTheme === key ? 'selected' : ''}>${theme.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div style="text-align: right;">
                        <button id="settings-close" style="
                            padding: 8px 16px;
                            background: ${colors.primary};
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                        ">Close</button>
                    </div>
                </div>
            </div>
        `;
    }

    // Get user info safely
    function getUserInfo() {
        return {
            username: (window.g_user && window.g_user.userName) || 'Unknown',
            userID: (window.g_user && window.g_user.userID) || '',
            hasSession: !!window.g_ck
        };
    }

    // Detect current page type
    function getCurrentPageType() {
        if (window.location.href.includes('_list.do')) {
            return 'List View';
        } else if (window.location.href.includes('.do')) {
            return 'Form View';
        } else {
            return 'Other';
        }
    }

    // Bind all event listeners
    function bindEvents() {
        // Window controls
        document.getElementById('close-btn').addEventListener('click', closeExtractor);
        document.getElementById('minimize-btn').addEventListener('click', toggleMinimize);
        document.getElementById('settings-btn').addEventListener('click', openSettings);

        // Settings modal
        document.getElementById('settings-close').addEventListener('click', closeSettings);
        document.getElementById('theme-select').addEventListener('change', changeTheme);
        document.getElementById('settings-modal').addEventListener('click', (e) => {
            if (e.target.id === 'settings-modal') closeSettings();
        });

        // Dragging functionality
        const header = document.getElementById('extractor-header');
        header.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);

        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        // Filter management
        document.getElementById('add-filter').addEventListener('click', addFilter);

        // Field selection
        document.getElementById('select-all-fields').addEventListener('click', selectAllFields);
        document.getElementById('clear-all-fields').addEventListener('click', clearAllFields);

        // Action buttons
        document.getElementById('extract-current').addEventListener('click', extractCurrentPageTickets);
        document.getElementById('extract-query').addEventListener('click', extractByQuery);
        document.getElementById('export-excel').addEventListener('click', exportToExcel);
        document.getElementById('clear-data').addEventListener('click', clearData);
    }

    // Tab switching
    function switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            const colors = getThemeColors();
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
                btn.style.background = colors.primary;
                btn.style.color = 'white';
            } else {
                btn.classList.remove('active');
                btn.style.background = colors.light;
                btn.style.color = colors.primary;
            }
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });
        document.getElementById(`tab-${tabName}`).style.display = 'block';
    }

    // Settings functions
    function openSettings() {
        document.getElementById('settings-modal').style.display = 'block';
    }

    function closeSettings() {
        document.getElementById('settings-modal').style.display = 'none';
    }

    function changeTheme() {
        currentTheme = document.getElementById('theme-select').value;
        saveSettings();
        createUI();
    }

    // Window control functions
    function closeExtractor() {
        const container = document.getElementById('ticket-extractor-ui');
        if (container) container.remove();
        window.ticketExtractorInstance = false;
    }

    function toggleMinimize() {
        const content = document.getElementById('extractor-content');
        const button = document.getElementById('minimize-btn');

        if (isMinimized) {
            content.style.display = 'block';
            button.textContent = '−';
            button.title = 'Minimize';
        } else {
            content.style.display = 'none';
            button.textContent = '+';
            button.title = 'Expand';
        }
        isMinimized = !isMinimized;
    }

    // Dragging functionality
    function startDrag(e) {
        if (e.target.tagName === 'BUTTON') return;

        isDragging = true;
        const container = document.getElementById('ticket-extractor-ui');
        const rect = container.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        e.preventDefault();
    }

    function drag(e) {
        if (!isDragging) return;

        const container = document.getElementById('ticket-extractor-ui');
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;

        const maxX = window.innerWidth - container.offsetWidth;
        const maxY = window.innerHeight - container.offsetHeight;

        container.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
        container.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';
        container.style.right = 'auto';
    }

    function stopDrag() {
        isDragging = false;
    }

    // Tables management (using new global function names)
    function updateTablesList() {
        const container = document.getElementById('tables-container');

        container.innerHTML = Object.entries(CONFIG.AVAILABLE_TABLES).map(([key, table]) => `
            <div style="margin-bottom: 8px; padding: 8px; border: 1px solid #e0e0e0; border-radius: 4px;">
                <label style="display: flex; align-items: flex-start; font-size: 12px; cursor: pointer;">
                    <input type="checkbox"
                           value="${key}"
                           ${selectedTables.includes(key) ? 'checked' : ''}
                           onchange="SNExtractor_toggleTable('${key}')"
                           style="margin-right: 8px; margin-top: 2px;">
                    <div>
                        <div style="font-weight: 500;">${table.name}</div>
                        <div style="color: #666; font-size: 11px; margin-top: 2px;">${table.description}</div>
                    </div>
                </label>
            </div>
        `).join('');
    }

    // Filter management
    function addFilter() {
        const filterId = 'filter-' + Date.now();
        filters.push({
            id: filterId,
            field: '',
            value: '',
            operator: 'CONTAINS',
            dateStart: '',
            dateEnd: ''
        });
        updateFiltersList();
        saveSettings();
    }

    function updateFiltersList() {
        const container = document.getElementById('filters-container');

        if (filters.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                    <p>No filters set. Click "Add Filter" to get started.</p>
                    <div style="margin-top: 10px;">
                        <strong>Quick Start:</strong><br>
                        <button onclick="SNExtractor_addQuickFilter('assigned_to', '=', 'javascript:gs.getUserID()')"
                                style="font-size: 10px; padding: 4px 8px; margin: 2px; background: ${getThemeColors().accent}; color: white; border: none; border-radius: 3px; cursor: pointer;">My Tickets</button>
                        <button onclick="SNExtractor_addQuickFilter('state', '!=', '6^state!=7')"
                                style="font-size: 10px; padding: 4px 8px; margin: 2px; background: ${getThemeColors().accent}; color: white; border: none; border-radius: 3px; cursor: pointer;">Open Only</button>
                        <button onclick="SNExtractor_addQuickFilter('priority', '<=', '2')"
                                style="font-size: 10px; padding: 4px 8px; margin: 2px; background: ${getThemeColors().accent}; color: white; border: none; border-radius: 3px; cursor: pointer;">High Priority</button>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = filters.map(filter => createFilterHTML(filter)).join('');
    }

    function createFilterHTML(filter) {
        const fieldConfig = CONFIG.FILTER_OPTIONS[filter.field];
        const colors = getThemeColors();

        let valueInput = '';

        if (fieldConfig) {
            if (fieldConfig.type === 'choice' && fieldConfig.values) {
                valueInput = `
                    <select onchange="SNExtractor_updateFilter('${filter.id}', 'value', this.value)" style="
                        flex: 1;
                        padding: 6px;
                        font-size: 11px;
                        border: 1px solid #ddd;
                        border-radius: 3px;
                    ">
                        <option value="">Select...</option>
                        ${Object.entries(fieldConfig.values).map(([key, label]) =>
                            `<option value="${key}" ${filter.value === key ? 'selected' : ''}>${key} - ${label}</option>`
                        ).join('')}
                    </select>
                `;
            } else if (fieldConfig.type === 'date') {
                valueInput = `
                    <div style="flex: 1; display: flex; gap: 4px;">
                        <input type="date"
                               value="${filter.dateStart || ''}"
                               onchange="SNExtractor_updateFilter('${filter.id}', 'dateStart', this.value); SNExtractor_updateDateFilter('${filter.id}')"
                               style="flex: 1; padding: 4px; font-size: 11px; border: 1px solid #ddd; border-radius: 3px;"
                               title="Start date">
                        <input type="date"
                               value="${filter.dateEnd || ''}"
                               onchange="SNExtractor_updateFilter('${filter.id}', 'dateEnd', this.value); SNExtractor_updateDateFilter('${filter.id}')"
                               style="flex: 1; padding: 4px; font-size: 11px; border: 1px solid #ddd; border-radius: 3px;"
                               title="End date (optional)">
                    </div>
                `;
            } else {
                valueInput = `
                    <input type="text"
                           placeholder="${fieldConfig.examples ? fieldConfig.examples[0] : 'Value...'}"
                           value="${filter.value}"
                           onchange="SNExtractor_updateFilter('${filter.id}', 'value', this.value)"
                           style="flex: 1; padding: 6px; font-size: 11px; border: 1px solid #ddd; border-radius: 3px;">
                `;
            }
        } else {
            valueInput = `
                <input type="text"
                       placeholder="Value..."
                       value="${filter.value}"
                       onchange="SNExtractor_updateFilter('${filter.id}', 'value', this.value)"
                       style="flex: 1; padding: 6px; font-size: 11px; border: 1px solid #ddd; border-radius: 3px;">
            `;
        }

        return `
            <div class="filter-row" style="
                margin-bottom: 12px;
                padding: 10px;
                border: 1px solid #e0e0e0;
                border-radius: 6px;
                background: #fafafa;
            ">
                <div style="display: flex; gap: 6px; margin-bottom: 8px; align-items: center;">
                    <select onchange="SNExtractor_updateFilter('${filter.id}', 'field', this.value); updateFiltersList();" style="
                        flex: 2;
                        padding: 6px;
                        font-size: 11px;
                        border: 1px solid #ddd;
                        border-radius: 3px;
                    ">
                        <option value="">Select Field...</option>
                        ${Object.entries(CONFIG.FILTER_OPTIONS).map(([key, config]) =>
                            `<option value="${key}" ${filter.field === key ? 'selected' : ''}>${config.name}</option>`
                        ).join('')}
                    </select>

                    <select onchange="SNExtractor_updateFilter('${filter.id}', 'operator', this.value)" style="
                        flex: 1;
                        padding: 6px;
                        font-size: 11px;
                        border: 1px solid #ddd;
                        border-radius: 3px;
                    ">
                        <option value="CONTAINS" ${filter.operator === 'CONTAINS' ? 'selected' : ''}>Contains</option>
                        <option value="=" ${filter.operator === '=' ? 'selected' : ''}>Equals</option>
                        <option value="!=" ${filter.operator === '!=' ? 'selected' : ''}>Not Equal</option>
                        <option value="STARTSWITH" ${filter.operator === 'STARTSWITH' ? 'selected' : ''}>Starts With</option>
                        <option value=">" ${filter.operator === '>' ? 'selected' : ''}>Greater Than</option>
                        <option value="<" ${filter.operator === '<' ? 'selected' : ''}>Less Than</option>
                        <option value=">=" ${filter.operator === '>=' ? 'selected' : ''}>Greater/Equal</option>
                        <option value="<=" ${filter.operator === '<=' ? 'selected' : ''}>Less/Equal</option>
                    </select>

                    <button onclick="SNExtractor_removeFilter('${filter.id}')" style="
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 3px;
                        cursor: pointer;
                        padding: 6px 8px;
                        font-size: 11px;
                    " title="Remove filter">×</button>
                </div>

                <div style="display: flex; gap: 6px;">
                    ${valueInput}
                </div>

                ${fieldConfig ? `
                    <div style="margin-top: 6px; font-size: 10px; color: #666;">
                        ${fieldConfig.description}
                        ${fieldConfig.examples ? `<br><strong>Examples:</strong> ${fieldConfig.examples.join(', ')}` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Field selection management (using new global function names)
    function updateFieldsList() {
        const container = document.getElementById('fields-container');

        container.innerHTML = Object.entries(CONFIG.AVAILABLE_FIELDS).map(([key, config]) => `
            <div style="margin-bottom: 6px;">
                <label style="display: flex; align-items: flex-start; font-size: 11px; cursor: pointer;">
                    <input type="checkbox"
                           value="${key}"
                           ${selectedFields.includes(key) ? 'checked' : ''}
                           onchange="SNExtractor_toggleField('${key}')"
                           style="margin-right: 8px; margin-top: 2px;">
                    <div>
                        <div style="font-weight: 500;">${config.name}</div>
                        <div style="color: #666; font-size: 10px; margin-top: 1px;">${config.description}</div>
                    </div>
                </label>
            </div>
        `).join('');
    }

    function selectAllFields() {
        selectedFields = Object.keys(CONFIG.AVAILABLE_FIELDS);
        updateFieldsList();
        saveSettings();
    }

    function clearAllFields() {
        selectedFields = [];
        updateFieldsList();
        saveSettings();
    }

    // Build query string from filters
    function buildQueryString() {
        return filters
            .filter(f => f.field && f.value)
            .map(f => {
                let query = f.field;
                switch(f.operator) {
                    case 'CONTAINS':
                        query += 'LIKE' + f.value;
                        break;
                    case 'STARTSWITH':
                        query += 'STARTSWITH' + f.value;
                        break;
                    default:
                        query += f.operator + f.value;
                }
                return query;
            })
            .join('^');
    }

    // Extract tickets from current page - SAFE METHOD
    function extractCurrentPageTickets() {
        updateStatus('📋 Extracting tickets from current page...');

        try {
            // Method 1: Try ServiceNow list view
            let rows = document.querySelectorAll('tr[sys_id], tr[data-sys-id], tr.list_row');

            if (rows.length === 0) {
                // Method 2: Try different selectors
                rows = document.querySelectorAll('tbody tr');
                rows = Array.from(rows).filter(row => {
                    return row.querySelector('td') &&
                           (row.getAttribute('sys_id') ||
                            row.querySelector('[sys_id]') ||
                            row.textContent.match(/INC\d+|REQ\d+|CHG\d+|PRB\d+/));
                });
            }

            if (rows.length > 0) {
                extractFromListView(rows);
                return;
            }

            // Method 3: Try form view
            const formData = extractFromFormView();
            if (formData) {
                return;
            }

            updateStatus('❌ No ticket data found on current page. Try navigating to a list view or ticket form.');

        } catch (error) {
            console.error('Current page extraction failed:', error);
            updateStatus(`❌ Extraction failed: ${error.message}`);
        }
    }

    // Extract from ServiceNow list view - SAFE METHOD
    function extractFromListView(rows) {
        const tickets = [];

        rows.forEach((row, index) => {
            try {
                const ticket = {};

                // Extract sys_id first
                ticket.sys_id = row.getAttribute('sys_id') ||
                               row.getAttribute('data-sys-id') ||
                               (row.querySelector('[sys_id]')?.getAttribute('sys_id')) ||
                               (row.querySelector('[data-sys-id]')?.getAttribute('data-sys-id')) ||
                               `row_${index}`;

                // Extract field data from cells
                selectedFields.forEach(field => {
                    // Try multiple selectors for each field
                    const selectors = [
                        `td[name="${field}"]`,
                        `td[data-field="${field}"]`,
                        `.${field}`,
                        `td[class*="${field}"]`,
                        `[data-column="${field}"]`
                    ];

                    let value = '';
                    for (const selector of selectors) {
                        const element = row.querySelector(selector);
                        if (element) {
                            value = element.textContent.trim() || element.getAttribute('title') || '';
                            if (value) break;
                        }
                    }

                    // If no specific field found, try to extract from ticket number pattern
                    if (!value && field === 'number') {
                        const numberMatch = row.textContent.match(/(INC|REQ|CHG|PRB|TASK)\d{7,}/);
                        if (numberMatch) {
                            value = numberMatch[0];
                        }
                    }

                    ticket[field] = value;
                });

                // Only add ticket if it has meaningful data
                const meaningfulFields = Object.values(ticket).filter(v => v && v !== '').length;
                if (meaningfulFields > 1) {
                    tickets.push(ticket);
                }

            } catch (error) {
                console.warn(`Failed to extract row ${index}:`, error);
            }
        });

        if (tickets.length > 0) {
            addTicketsToCollection(tickets);
            updateStatus(`✅ Extracted ${tickets.length} tickets from list view`);
        } else {
            updateStatus('⚠️ No ticket data could be extracted from visible rows');
        }
    }

    // Extract from form view - SAFE METHOD
    function extractFromFormView() {
        try {
            const ticket = {};

            selectedFields.forEach(field => {
                // Try multiple selectors for form fields
                const selectors = [
                    `[name="${field}"]`,
                    `#${field}`,
                    `[data-field="${field}"]`,
                    `#sys_display\\.${field}`,
                    `[id*="${field}"]`,
                    `[name*="${field}"]`
                ];

                let value = '';
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element) {
                        value = element.value || element.textContent.trim() || element.getAttribute('title') || '';
                        if (value) break;
                    }
                }

                ticket[field] = value;
            });

            // Check if we got meaningful data
            const meaningfulFields = Object.values(ticket).filter(v => v && v !== '').length;
            if (meaningfulFields > 0) {
                addTicketsToCollection([ticket]);
                updateStatus(`✅ Extracted 1 ticket from form view`);
                return true;
            }

            return false;

        } catch (error) {
            console.warn('Form extraction failed:', error);
            return false;
        }
    }

    // Extract tickets using API - WITH BETTER ERROR HANDLING
    async function extractByQuery() {
        const queryString = buildQueryString();
        const maxRecords = Math.min(document.getElementById('max-records').value, 500); // Limit to 500

        updateStatus('🔍 Extracting tickets via API...');

        if (selectedTables.length === 0) {
            updateStatus('❌ No tables selected. Please select tables in the Tables tab.');
            return;
        }

        try {
            const allTickets = [];

            for (const tableName of selectedTables) {
                try {
                    const data = await queryTableSimple(tableName, queryString, selectedFields, maxRecords);

                    if (data.result && data.result.length > 0) {
                        // Add table type to each ticket
                        data.result.forEach(ticket => {
                            ticket._table_type = tableName;
                        });

                        allTickets.push(...data.result);
                        updateStatus(`✅ Got ${data.result.length} tickets from ${tableName}`);
                    } else {
                        updateStatus(`⚠️ No tickets found in ${tableName}`);
                    }

                } catch (error) {
                    console.error(`Failed to query ${tableName}:`, error);
                    updateStatus(`❌ Failed ${tableName}: ${error.message.substring(0, 50)}...`);
                }
            }

            if (allTickets.length > 0) {
                addTicketsToCollection(allTickets);
                updateStatus(`✅ API extraction complete: ${allTickets.length} tickets from ${selectedTables.length} table(s)`);
            } else {
                updateStatus(`⚠️ No tickets extracted via API. Try "Extract Current Page" if you're viewing a list.`);
            }

        } catch (error) {
            console.error('API extraction failed:', error);
            updateStatus(`❌ API extraction failed: ${error.message.substring(0, 50)}...`);
        }
    }

    // Add tickets to collection (avoiding duplicates)
    function addTicketsToCollection(tickets) {
        const existingIds = new Set(extractedTickets.map(t => t.sys_id));
        let newCount = 0;

        tickets.forEach(ticket => {
            if (!existingIds.has(ticket.sys_id)) {
                const cleanTicket = cleanTicketData(ticket);
                extractedTickets.push(cleanTicket);
                existingIds.add(ticket.sys_id);
                newCount++;
            }
        });

        updateExportButton();
        if (newCount > 0) {
            updateStatus(`✅ Added ${newCount} new tickets (${extractedTickets.length} total)`);
        } else if (tickets.length > 0) {
            updateStatus(`ℹ️ All ${tickets.length} tickets were duplicates (${extractedTickets.length} total)`);
        }
    }

    // Clean and format ticket data
    function cleanTicketData(ticket) {
        const clean = {};

        selectedFields.forEach(field => {
            let value = ticket[field] || '';

            // Handle ServiceNow object format
            if (typeof value === 'object' && value !== null) {
                value = value.display_value || value.value || '';
            }

            // Clean up formatting
            if (typeof value === 'string') {
                value = value.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            }

            clean[field] = value;
        });

        // Add table type if available
        if (ticket._table_type) {
            clean._table_type = ticket._table_type;
        }

        return clean;
    }

    // Export to Excel
    function exportToExcel() {
        if (extractedTickets.length === 0) {
            updateStatus('❌ No tickets to export');
            return;
        }

        updateStatus('📊 Generating Excel file...');

        try {
            // Create workbook
            const wb = XLSX.utils.book_new();

            // Group by table type if multiple tables
            if (selectedTables.length > 1) {
                const groupedTickets = {};
                extractedTickets.forEach(ticket => {
                    const tableType = ticket._table_type || 'unknown';
                    if (!groupedTickets[tableType]) {
                        groupedTickets[tableType] = [];
                    }
                    groupedTickets[tableType].push(ticket);
                });

                // Create separate sheet for each table
                Object.entries(groupedTickets).forEach(([tableType, tickets]) => {
                    const exportData = tickets.map(ticket => {
                        const row = {};
                        selectedFields.forEach(field => {
                            const header = CONFIG.AVAILABLE_FIELDS[field]?.name || field;
                            row[header] = ticket[field] || '';
                        });
                        return row;
                    });

                    const ws = XLSX.utils.json_to_sheet(exportData);
                    const tableName = CONFIG.AVAILABLE_TABLES[tableType]?.name || tableType;
                    XLSX.utils.book_append_sheet(wb, ws, tableName);
                });
            } else {
                // Single sheet for single table
                const exportData = extractedTickets.map(ticket => {
                    const row = {};
                    selectedFields.forEach(field => {
                        const header = CONFIG.AVAILABLE_FIELDS[field]?.name || field;
                        row[header] = ticket[field] || '';
                    });
                    return row;
                });

                const ws = XLSX.utils.json_to_sheet(exportData);

                // Auto-size columns
                const colWidths = selectedFields.map(field => {
                    const header = CONFIG.AVAILABLE_FIELDS[field]?.name || field;
                    const maxLength = Math.max(
                        header.length,
                        ...extractedTickets.map(ticket =>
                            String(ticket[field] || '').length
                        )
                    );
                    return { wch: Math.min(maxLength + 2, 50) };
                });
                ws['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(wb, ws, 'ServiceNow Tickets');
            }

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const tableNames = selectedTables.map(t => CONFIG.AVAILABLE_TABLES[t]?.name || t).join('-');
            const filename = `servicenow-${tableNames}-${timestamp}.xlsx`;

            // Save file
            XLSX.writeFile(wb, filename);

            updateStatus(`✅ Exported ${extractedTickets.length} tickets to ${filename}`);

        } catch (error) {
            console.error('Export failed:', error);
            updateStatus(`❌ Export failed: ${error.message}`);
        }
    }

    // Clear collected data
    function clearData() {
        extractedTickets = [];
        updateExportButton();
        updateStatus('🗑️ Data cleared');
    }

    // Update export button state
    function updateExportButton() {
        const button = document.getElementById('export-excel');
        if (button) {
            button.textContent = `📊 Export to Excel (${extractedTickets.length} tickets)`;
            button.disabled = extractedTickets.length === 0;
        }
    }

    // Update status message
    function updateStatus(message) {
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = message;
            console.log('ServiceNow Extractor:', message);
        }
    }

    // Safe initialization
    function init() {
        try {
            loadSettings();

            // Simple ready check
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    setTimeout(createUI, 1000); // Delay to avoid conflicts
                });
            } else {
                setTimeout(createUI, 1000);
            }
        } catch (error) {
            console.error('ServiceNow Extractor initialization failed:', error);
        }
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        window.ticketExtractorInstance = false;
        // Clean up global functions
        if (window.SNExtractor_updateFilter) delete window.SNExtractor_updateFilter;
        if (window.SNExtractor_updateDateFilter) delete window.SNExtractor_updateDateFilter;
        if (window.SNExtractor_removeFilter) delete window.SNExtractor_removeFilter;
        if (window.SNExtractor_addQuickFilter) delete window.SNExtractor_addQuickFilter;
        if (window.SNExtractor_toggleTable) delete window.SNExtractor_toggleTable;
        if (window.SNExtractor_toggleField) delete window.SNExtractor_toggleField;
    });

    // Start the script
    init();

})();