// ==UserScript==
// @name         ServiceNow Ticket Data Extractor V2.3
// @namespace    http://tampermonkey.net/
// @version      6.0.047a
// @description  Extract ServiceNow ticket metadata to Excel with auto-scrolling UI
// @author       You
// @match        https://wfmprod.service-now.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        BASE_URL: window.location.origin,
        TABLE_NAME: 'task',
        FIELDS: [
            // Core ticket fields
            'number',
            'short_description',
            'description',
            'state',
            'priority',
            'urgency',
            'impact',
            'category',
            'subcategory',
            'u_category',
            'u_subcategory',

            // Assignment fields
            'assigned_to',
            'assignment_group',
            'caller_id',
            'opened_by',
            'resolved_by',
            'closed_by',

            // Time fields
            'opened_at',
            'updated_at',
            'resolved_at',
            'closed_at',
            'sys_created_on',
            'sys_updated_on',
            'due_date',
            'expected_start',
            'work_start',
            'work_end',
            'calendar_duration',
            'business_duration',

            // Location and company fields
            'location',
            'company',
            'department',
            'cost_center',

            // CI and asset fields
            'cmdb_ci',
            'asset',
            'configuration_item',

            // Problem and change fields
            'problem_id',
            'rfc',
            'change_request',
            'parent_incident',
            'child_incidents',

            // Contact and communication fields
            'contact_type',
            'notify',
            'hold_reason',
            'close_code',
            'resolution_code',
            'resolved_at',
            'resolution_notes',
            'close_notes',
            'work_notes',
            'comments',
            'additional_comments',

            // Business fields
            'business_service',
            'service_offering',
            'knowledge',
            'skills',
            'route_reason',
            'reassignment_count',
            'reopen_count',

            // System fields
            'sys_id',
            'sys_class_name',
            'sys_domain',
            'sys_created_by',
            'sys_updated_by',
            'sys_mod_count',
            'sys_tags',

            // Approval fields
            'approval',
            'approval_history',
            'approval_set',

            // SLA fields
            'sla_due',
            'business_stc',
            'calendar_stc',
            'time_worked',

            // Watch list and follow up
            'watch_list',
            'follow_up',
            'escalation',

            // Activity fields
            'activity_due',
            'active',
            'made_sla',
            'correlation_id',
            'correlation_display',

            // Additional incident/task specific fields
            'incident_state',
            'severity',
            'user_input',
            'delivery_plan',
            'delivery_task',
            'universal_request',
            'task_type',
            'request_item',
            'variables'
        ],
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
        ]
    };

    // Ticket data storage
    let extractedTickets = [];
    let isCollapsed = false;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    // Persistent storage keys
    const STORAGE_KEYS = {
        POSITION: 'extractor_position',
        COLLAPSED: 'extractor_collapsed',
        STATES: 'extractor_states',
        ASSIGNMENT_GROUPS: 'extractor_assignment_groups',
        ASSIGNED_TO: 'extractor_assigned_to',
        MAX_RECORDS: 'extractor_max_records',
        CUSTOM_QUERY: 'extractor_custom_query'
    };

    // Utility function to keep UI within viewport bounds
    function constrainToViewport(element) {
        const rect = element.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        let newLeft = rect.left;
        let newTop = rect.top + scrollTop;

        // Constrain horizontally
        if (rect.right > viewportWidth) {
            newLeft = viewportWidth - rect.width - 10; // 10px margin
        }
        if (newLeft < 10) {
            newLeft = 10; // 10px margin from left
        }

        // Constrain vertically
        if (rect.bottom > viewportHeight + scrollTop) {
            newTop = viewportHeight + scrollTop - rect.height - 10; // 10px margin
        }
        if (newTop < scrollTop + 10) {
            newTop = scrollTop + 10; // 10px margin from top
        }

        element.style.left = newLeft + 'px';
        element.style.top = newTop + 'px';
    }

    // Auto-adjust UI position on window events
    function setupViewportConstraints() {
        const container = document.getElementById('ticket-extractor-ui');
        if (!container) return;

        // Debounce function to limit how often we recalculate
        let timeout;
        const debouncedConstrain = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => constrainToViewport(container), 100);
        };

        // Listen for various events that might cause the UI to go off-screen
        window.addEventListener('resize', debouncedConstrain);
        window.addEventListener('scroll', debouncedConstrain);

        // Also check when the content changes (expand/collapse)
        const observer = new MutationObserver(debouncedConstrain);
        observer.observe(container, {
            childList: true,
            subtree: true,
            attributes: true,
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
            saveSettings();
        } else {
            updateStatus('No query detected on current page');
        }
    }

    // Load saved settings
    function loadSettings() {
        return {
            position: GM_getValue(STORAGE_KEYS.POSITION, { x: 10, y: 10 }),
            collapsed: GM_getValue(STORAGE_KEYS.COLLAPSED, false),
            states: GM_getValue(STORAGE_KEYS.STATES, []),
            assignmentGroups: GM_getValue(STORAGE_KEYS.ASSIGNMENT_GROUPS, ''),
            assignedTo: GM_getValue(STORAGE_KEYS.ASSIGNED_TO, ''),
            maxRecords: GM_getValue(STORAGE_KEYS.MAX_RECORDS, 100),
            customQuery: GM_getValue(STORAGE_KEYS.CUSTOM_QUERY, '')
        };
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
    }

    // Get selected states
    function getSelectedStates() {
        const checkboxes = document.querySelectorAll('#states-container input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    // Get authentication headers with improved token handling
    function getAuthHeaders() {
        // 1️⃣ try the global var
        let token = window.g_ck;

        // 2️⃣ fall back to a script tag (works in Workspace/LWS)
        if (!token) {
            const m = /g_ck\s*=\s*['"]([^'"]+)/.exec(document.documentElement.innerHTML);
            token = m ? m[1] : null;
        }

        if (!token) {
            console.warn('No g_ck token found – API call will fail.');
        }

        return {
            'Accept': 'application/json',
            ...(token && { 'X-UserToken': token })
        };
    }

    // Helper function to get cookie value
    function getCookieValue(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    // Create UI elements
    function createUI() {
        const settings = loadSettings();
        isCollapsed = settings.collapsed;

        const container = document.createElement('div');
        container.id = 'ticket-extractor-ui';
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
            <div id="extractor-header" style="
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
                <h3 style="margin: 0; font-size: 14px;">ServiceNow Ticket Extractor</h3>
                <div>
                    <button id="collapse-btn" style="
                        background: none;
                        border: none;
                        color: white;
                        cursor: pointer;
                        padding: 2px 6px;
                        margin-right: 5px;
                        border-radius: 3px;
                        font-size: 12px;
                    ">${isCollapsed ? '+' : '-'}</button>
                </div>
            </div>
            <div id="extractor-content" style="
                padding: 15px;
                display: ${isCollapsed ? 'none' : 'block'};
                max-height: calc(90vh - 50px);
                overflow-y: auto;
                overflow-x: hidden;
            ">
                <!-- Auto-detect current page query -->
                <div style="margin-bottom: 15px; padding: 10px; background: #e8f4fd; border-radius: 4px; border-left: 4px solid #0073e7;">
                    <button id="detect-query" style="
                        width: 100%;
                        padding: 8px 12px;
                        background: #17a2b8;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                        font-weight: bold;
                    ">🔍 Auto-Detect Current Page Query</button>
                    <small style="display: block; margin-top: 5px; color: #666; font-size: 10px;">
                        Click to automatically extract the query from your current ServiceNow list view
                    </small>
                </div>

                <!-- States Filter -->
                <div style="margin-bottom: 15px;">
                    <label style="font-weight: bold; font-size: 12px; color: #333;">States:</label>
                    <div id="states-container" style="
                        max-height: 120px;
                        overflow-y: auto;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        padding: 8px;
                        margin-top: 5px;
                        background: #f9f9f9;
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
                    <input type="text" id="assignment-groups" value="${settings.assignmentGroups}"
                           placeholder="e.g., IT Support, Network Team"
                           style="width: 100%; padding: 6px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; box-sizing: border-box;">
                    <small style="color: #666; font-size: 10px;">Comma-separated group names</small>
                </div>

                <!-- Assigned To -->
                <div style="margin-bottom: 12px;">
                    <label style="font-weight: bold; font-size: 12px; color: #333;">Assigned To:</label>
                    <input type="text" id="assigned-to" value="${settings.assignedTo}"
                           placeholder="username or email"
                           style="width: 100%; padding: 6px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; box-sizing: border-box;">
                </div>

                <!-- Max Records -->
                <div style="margin-bottom: 12px;">
                    <label style="font-weight: bold; font-size: 12px; color: #333;">Max Records:</label>
                    <select id="max-records" style="width: 100%; padding: 6px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; box-sizing: border-box;">
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
                    <textarea id="custom-query" placeholder="assignment_group=807ef9f0db32481069ee1329689619b6^state=1^ORstate=12"
                              style="width: 100%; height: 80px; padding: 6px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; resize: vertical; box-sizing: border-box;">${settings.customQuery}</textarea>
                    <small style="color: #666; font-size: 10px;">ServiceNow query format (use ^ for AND, ^OR for OR)</small>
                </div>

                <!-- Action Buttons -->
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <button id="extract-current" style="
                        padding: 8px 12px;
                        background: #0073e7;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                        font-weight: bold;
                    ">📄 Extract Current Page</button>

                    <button id="extract-query" style="
                        padding: 8px 12px;
                        background: #28a745;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                        font-weight: bold;
                    ">🔍 Extract by Query/Filters</button>

                    <div style="display: flex; gap: 5px;">
                        <button id="export-excel" style="
                            flex: 1;
                            padding: 8px 12px;
                            background: #ffc107;
                            color: black;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 12px;
                            font-weight: bold;
                        " disabled>📊 Export Excel (0)</button>

                        <button id="clear-data" style="
                            padding: 8px 12px;
                            background: #dc3545;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 12px;
                            font-weight: bold;
                        ">🗑️ Clear</button>
                    </div>
                </div>

                <div id="status" style="
                    margin-top: 12px;
                    padding: 8px;
                    background: #f8f9fa;
                    border-radius: 4px;
                    font-size: 11px;
                    color: #666;
                    min-height: 20px;
                    word-wrap: break-word;
                ">Ready to extract tickets...</div>
            </div>
        `;

        document.body.appendChild(container);

        // Ensure UI is within viewport after creation
        setTimeout(() => {
            constrainToViewport(container);
            setupViewportConstraints();
        }, 100);

        bindEvents();
        setupDragAndDrop();

        // Auto-detect query on page load if we're on a list page
        setTimeout(() => {
            if (window.location.href.includes('list.do') || window.location.href.includes('nav_to.do')) {
                const autoQuery = parseServiceNowURI();
                if (autoQuery && !settings.customQuery) {
                    updateStatus(`Auto-detected query: ${autoQuery.substring(0, 50)}...`);
                }
            }
        }, 1000);
    }

    // Setup drag and drop functionality with viewport constraints
    function setupDragAndDrop() {
        const header = document.getElementById('extractor-header');
        const container = document.getElementById('ticket-extractor-ui');

        header.addEventListener('mousedown', (e) => {
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

            // Constrain to viewport bounds with margins
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
        document.getElementById('export-excel').addEventListener('click', exportToExcel);
        document.getElementById('clear-data').addEventListener('click', clearData);
        document.getElementById('detect-query').addEventListener('click', detectCurrentPageQuery);

        document.getElementById('collapse-btn').addEventListener('click', toggleCollapse);

        const inputs = ['assignment-groups', 'assigned-to', 'max-records', 'custom-query'];
        inputs.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', saveSettings);
                element.addEventListener('input', saveSettings);
            }
        });

        document.getElementById('states-container').addEventListener('change', saveSettings);
    }

    // Toggle collapse/expand with viewport constraint
    function toggleCollapse() {
        isCollapsed = !isCollapsed;
        const content = document.getElementById('extractor-content');
        const btn = document.getElementById('collapse-btn');
        const container = document.getElementById('ticket-extractor-ui');

        content.style.display = isCollapsed ? 'none' : 'block';
        btn.textContent = isCollapsed ? '+' : '-';

        // Re-constrain to viewport after size change
        setTimeout(() => {
            constrainToViewport(container);
        }, 50);

        saveSettings();
    }

    // Build query from UI inputs
    function buildQueryFromUI() {
        const customQuery = document.getElementById('custom-query').value.trim();
        if (customQuery) {
            return customQuery;
        }

        const queryParts = [];

        const selectedStates = getSelectedStates();
        if (selectedStates.length > 0) {
            if (selectedStates.length === 1) {
                queryParts.push(`state=${selectedStates[0]}`);
            } else {
                const stateQueries = selectedStates.map(state => `state=${state}`);
                queryParts.push(stateQueries.join('^OR'));
            }
        }

        const assignmentGroups = document.getElementById('assignment-groups').value.trim();
        if (assignmentGroups) {
            const groups = assignmentGroups.split(',').map(g => g.trim()).filter(g => g);
            if (groups.length === 1) {
                queryParts.push(`assignment_group.name=${groups[0]}`);
            } else if (groups.length > 1) {
                const groupQueries = groups.map(group => `assignment_group.name=${group}`);
                queryParts.push(`(${groupQueries.join('^OR')})`);
            }
        }

        const assignedTo = document.getElementById('assigned-to').value.trim();
        if (assignedTo) {
            queryParts.push(`assigned_to.user_name=${assignedTo}`);
        }

        return queryParts.join('^');
    }

    // Extract tickets from current page (list view)
    function extractCurrentPageTickets() {
        updateStatus('Extracting tickets from current page...');

        const listRows = document.querySelectorAll('tr[data-list_id], tr.list_row');

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
                                cell.className.replace('list_decoration_cell ', '');

                if (fieldName && CONFIG.FIELDS.includes(fieldName)) {
                    const textContent = cell.textContent.trim();
                    const linkElement = cell.querySelector('a');

                    if (linkElement && linkElement.textContent.trim()) {
                        ticket[fieldName] = linkElement.textContent.trim();
                    } else if (textContent) {
                        ticket[fieldName] = textContent;
                    }
                }
            });

            if (!ticket.number) {
                const firstCell = row.querySelector('td a');
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

    // Extract tickets using ServiceNow API with human-readable labels
    async function extractByQuery() {
        const query = buildQueryFromUI();
        const maxRecords = document.getElementById('max-records').value;

        if (!query) {
            updateStatus('Please specify at least one filter or use the ServiceNow query field');
            return;
        }

        updateStatus('Extracting tickets via API...');

        try {
            const url = `${CONFIG.BASE_URL}/api/now/table/${CONFIG.TABLE_NAME}` +
                       `?sysparm_query=${encodeURIComponent(query)}` +
                       `&sysparm_fields=${CONFIG.FIELDS.join(',')}` +
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
            addTicketsToCollection(data.result || []);
            updateStatus(`Extracted ${(data.result || []).length} tickets via API`);

        } catch (error) {
            console.error('API extraction failed:', error);
            updateStatus(`API extraction failed: ${error.message}. Try using 'Extract Current Page' instead.`);
        }
    }

    // Add tickets to collection (avoiding duplicates)
    function addTicketsToCollection(tickets) {
        const existingIds = new Set(extractedTickets.map(t => t.sys_id));

        tickets.forEach(ticket => {
            if (!existingIds.has(ticket.sys_id)) {
                const cleanTicket = cleanTicketData(ticket);
                extractedTickets.push(cleanTicket);
                existingIds.add(ticket.sys_id);
            }
        });

        updateExportButton();
    }

    // Clean and format ticket data
    function cleanTicketData(ticket) {
        const clean = {};

        CONFIG.FIELDS.forEach(field => {
            let value = ticket[field] || '';

            if (typeof value === 'object' && value.display_value) {
                value = value.display_value;
            } else if (typeof value === 'object' && value.value) {
                value = value.value;
            }

            if (typeof value === 'string') {
                value = value.replace(/\n/g, ' ').trim();
            }

            clean[field] = value;
        });

        return clean;
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
            const ws = XLSX.utils.json_to_sheet(extractedTickets);

            const colWidths = CONFIG.FIELDS.map(field => {
                const maxLength = Math.max(
                    field.length,
                    ...extractedTickets.map(ticket =>
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
        const button = document.getElementById('export-excel');
        button.textContent = `📊 Export Excel (${extractedTickets.length})`;
        button.disabled = extractedTickets.length === 0;
    }

    // Update status message
    function updateStatus(message) {
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = message;
            console.log('ServiceNow Extractor:', message);
        }
    }

    // Initialize when page loads
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createUI);
        } else {
            createUI();
        }
    }

    // Save settings before page unload
    window.addEventListener('beforeunload', saveSettings);

    // Start the script
    init();

})();