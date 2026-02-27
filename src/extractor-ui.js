// ============================================================
// ServiceNow Extractor - UI Module
// All DOM creation, drag-and-drop, toast notifications,
// settings panel, and viewport management.
// ============================================================
(function () {
    'use strict';

    const ns = window.SNExtractor;
    if (!ns) { console.error('[SN-Extractor] Config module not loaded'); return; }

    const { CONFIG, FEATURE_FLAGS, SK, state, Logger, ICONS } = ns;

    // ── Toast System ───────────────────────────────────────────
    function ensureToastContainer() {
        let container = document.getElementById('tm-toast-wrap');
        if (!container) {
            container = document.createElement('div');
            container.id = 'tm-toast-wrap';
            container.className = 'tm-toast-wrap';
            document.body.appendChild(container);
        }
        return container;
    }

    ns.showToast = function (message, type, duration, action) {
        type = type || 'info';
        duration = duration !== undefined ? duration : 3000;

        const container = ensureToastContainer();
        const toast = document.createElement('div');
        const typeClass = {
            info: 'tm-toast-info',
            success: 'tm-toast-ok',
            warning: 'tm-toast-wn',
            error: 'tm-toast-er'
        };
        toast.className = 'tm-toast ' + (typeClass[type] || 'tm-toast-info');

        const iconMap = {
            info: ICONS.info,
            success: ICONS.check,
            warning: ICONS.alertTri,
            error: ICONS.xCircle
        };

        // CR-03: Build toast with textContent for user-facing message to prevent XSS
        const iconSpan = document.createElement('span');
        iconSpan.className = 'tm-toast-i';
        iconSpan.innerHTML = iconMap[type] || iconMap.info;
        toast.appendChild(iconSpan);

        const msgSpan = document.createElement('span');
        msgSpan.className = 'tm-toast-m';
        msgSpan.textContent = message; // Safe: textContent, not innerHTML
        toast.appendChild(msgSpan);

        if (action) {
            const actionBtn = document.createElement('button');
            actionBtn.className = 'tm-toast-a';
            actionBtn.textContent = action.label;
            actionBtn.addEventListener('click', function () {
                action.callback();
                toast.remove();
            });
            toast.appendChild(actionBtn);
        }

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                toast.classList.add('vis');
            });
        });

        // Auto-dismiss
        if (duration > 0) {
            setTimeout(function () {
                toast.classList.remove('vis');
                setTimeout(function () { toast.remove(); }, 250);
            }, duration);
        }
    };

    // ── Status Bar ─────────────────────────────────────────────
    ns.updateStatus = function (message) {
        const el = document.getElementById('tm-status');
        if (el) {
            el.textContent = message;
            Logger.info('Status: ' + message);
        }
    };

    // ── Progress Bar ───────────────────────────────────────────
    ns.updateProgress = function (current, total, message) {
        const container = document.getElementById('tm-prog');
        if (!container) return;

        const pct = total > 0 ? Math.min((current / total) * 100, 100) : 0;
        const bar = container.querySelector('.tm-prog-bar');
        const txt = container.querySelector('.tm-prog-txt');

        if (bar) bar.style.width = pct + '%';
        if (txt) txt.textContent = message || (current + '/' + total + ' (' + Math.round(pct) + '%)');

        if (current >= total && !state.isProcessing) {
            setTimeout(function () { container.style.display = 'none'; }, 2000);
        } else {
            container.style.display = 'block';
        }
    };

    // ── Selected States Helper ─────────────────────────────────
    ns.getSelectedStates = function () {
        const checkboxes = document.querySelectorAll('#tm-states-area input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(function (cb) { return cb.value; });
    };

    // ── Dev Mark ───────────────────────────────────────────────
    function injectDevMark(container) {
        if (!FEATURE_FLAGS.DEV_MARK) return;
        const mark = document.createElement('div');
        mark.className = 'tm-dev';
        mark.innerHTML =
            'Developed by <a href="https://github.com/RynAgain" target="_blank" ' +
            'rel="noopener noreferrer" title="View source on GitHub">Ryan Satterfield</a>' +
            ' - v' + ns.VERSION;
        container.appendChild(mark);
    }

    // ── Toggle Switch Creator ──────────────────────────────────
    function createSwitch(id, initialState) {
        const el = document.createElement('div');
        el.id = id;
        el.className = 'tm-sw' + (initialState ? ' on' : '');
        el.setAttribute('role', 'switch');
        el.setAttribute('aria-checked', String(initialState));
        el.setAttribute('tabindex', '0');
        el.addEventListener('click', function () {
            el.classList.toggle('on');
            el.setAttribute('aria-checked', el.classList.contains('on'));
            ns.debouncedSave();
        });
        el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                el.click();
            }
        });
        return el;
    }

    // ── Settings Load/Save ─────────────────────────────────────
    ns.loadSettings = function () {
        const settings = {
            position:   GM_getValue(SK.POSITION, { x: 10, y: 10 }),
            collapsed:  GM_getValue(SK.COLLAPSED, false),
            states:     GM_getValue(SK.STATES, []),
            groups:     GM_getValue(SK.GROUPS, ''),
            assigned:   GM_getValue(SK.ASSIGNED, ''),
            max:        GM_getValue(SK.MAX, 100),
            query:      GM_getValue(SK.QUERY, ''),
            table:      GM_getValue(SK.TABLE, 'sc_task'),
            debug:      GM_getValue(SK.DEBUG, false),
            sctask:     GM_getValue(SK.SCTASK, true),
            accent:     GM_getValue(SK.ACCENT, 'blue'),
            mode:       GM_getValue(SK.MODE, 'dark')
        };

        state.debugMode = settings.debug;
        state.currentAccent = settings.accent;
        state.currentMode = settings.mode;
        state.isCollapsed = settings.collapsed;
        CONFIG.TABLE_NAME = settings.table;

        Logger.debug('Settings loaded', settings);
        return settings;
    };

    ns.saveSettings = function () {
        try {
            const root = document.getElementById('tm-ext-root');
            if (root) {
                const rect = root.getBoundingClientRect();
                GM_setValue(SK.POSITION, {
                    x: rect.left,
                    y: rect.top + (window.pageYOffset || document.documentElement.scrollTop)
                });
            }

            GM_setValue(SK.COLLAPSED, state.isCollapsed);
            GM_setValue(SK.STATES, ns.getSelectedStates());

            // CR-14: Use let instead of var for consistency
            let el;

            el = document.getElementById('tm-groups');
            if (el) GM_setValue(SK.GROUPS, el.value);

            el = document.getElementById('tm-assigned');
            if (el) GM_setValue(SK.ASSIGNED, el.value);

            el = document.getElementById('tm-max');
            if (el) GM_setValue(SK.MAX, parseInt(el.value, 10) || 100);

            el = document.getElementById('tm-query');
            if (el) GM_setValue(SK.QUERY, el.value);

            el = document.getElementById('tm-table');
            if (el) {
                GM_setValue(SK.TABLE, el.value);
                CONFIG.TABLE_NAME = el.value;
            }

            GM_setValue(SK.ACCENT, state.currentAccent);
            GM_setValue(SK.MODE, state.currentMode);

            el = document.getElementById('tm-sw-debug');
            if (el) {
                const on = el.classList.contains('on');
                GM_setValue(SK.DEBUG, on);
                state.debugMode = on;
            }

            el = document.getElementById('tm-sw-sctask');
            if (el) GM_setValue(SK.SCTASK, el.classList.contains('on'));

            Logger.debug('Settings saved');
        } catch (err) {
            Logger.error('Save settings failed:', err);
        }
    };

    ns.debouncedSave = ns.debounce(ns.saveSettings, 500);

    // ── Detect Current Page Query ──────────────────────────────
    ns.detectCurrentPageQuery = function () {
        const result = ns.parseSnURI();
        const query = typeof result === 'object' ? result.query : result;
        const detectedTable = typeof result === 'object' ? result.table : null;

        if (query) {
            const el = document.getElementById('tm-query');
            if (el) el.value = query;

            // Auto-set table if detected from portal URL
            if (detectedTable) {
                const tableEl = document.getElementById('tm-table');
                if (tableEl) {
                    // Check if detected table is in our options
                    const options = Array.from(tableEl.options).map(function (o) { return o.value; });
                    if (options.includes(detectedTable)) {
                        tableEl.value = detectedTable;
                        CONFIG.TABLE_NAME = detectedTable;
                        ns.showToast('Query detected (table: ' + detectedTable + ')', 'success');
                    } else {
                        ns.showToast('Query detected (table "' + detectedTable + '" not in dropdown, using current)', 'success');
                    }
                } else {
                    ns.showToast('Query detected from current page', 'success');
                }
            } else {
                ns.showToast('Query detected from current page', 'success');
            }

            ns.debouncedSave();
        } else {
            ns.showToast('No query detected on current page', 'warning');
        }
    };

    // ── Viewport Constraints ───────────────────────────────────
    function constrainToViewport(element) {
        const rect = element.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        let newLeft = rect.left;
        let newTop = rect.top + scrollTop;

        if (rect.right > vw) newLeft = vw - rect.width - 10;
        if (newLeft < 10) newLeft = 10;
        if (rect.bottom > vh + scrollTop) newTop = vh + scrollTop - rect.height - 10;
        if (newTop < scrollTop + 10) newTop = scrollTop + 10;

        element.style.left = newLeft + 'px';
        element.style.top = newTop + 'px';
    }

    function setupViewportConstraints() {
        const container = document.getElementById('tm-ext-root');
        if (!container) return;

        const debouncedConstrain = ns.debounce(function () {
            constrainToViewport(container);
        }, 100);

        window.addEventListener('resize', debouncedConstrain);
        window.addEventListener('scroll', debouncedConstrain);
    }

    // ── Drag and Drop ──────────────────────────────────────────
    function setupDragAndDrop() {
        const header = document.getElementById('tm-hdr');
        const container = document.getElementById('tm-ext-root');
        if (!header || !container) return;

        header.addEventListener('mousedown', function (e) {
            // Ignore clicks on buttons inside the header
            if (e.target.closest('button') || e.target.closest('.tm-btn-g')) return;

            state.isDragging = true;
            const rect = container.getBoundingClientRect();
            state.dragOffset.x = e.clientX - rect.left;
            state.dragOffset.y = e.clientY - rect.top;

            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', handleDragEnd);
        });

        function handleDrag(e) {
            if (!state.isDragging) return;

            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const cw = container.offsetWidth;
            const ch = container.offsetHeight;

            let x = e.clientX - state.dragOffset.x;
            let y = e.clientY - state.dragOffset.y;

            x = Math.max(10, Math.min(x, vw - cw - 10));
            y = Math.max(10, Math.min(y, vh - ch - 10));

            container.style.left = x + 'px';
            container.style.top = y + 'px';
        }

        function handleDragEnd() {
            state.isDragging = false;
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', handleDragEnd);
            ns.saveSettings();
        }
    }

    // ── Toggle Collapse ────────────────────────────────────────
    function toggleCollapse() {
        state.isCollapsed = !state.isCollapsed;
        const body = document.getElementById('tm-body');
        const btn = document.getElementById('tm-collapse-btn');

        if (body) body.style.display = state.isCollapsed ? 'none' : 'block';
        if (btn) btn.innerHTML = state.isCollapsed ? ICONS.chevDown : ICONS.chevUp;

        // Close settings when collapsing
        if (state.isCollapsed) {
            state.showSettings = false;
            const stg = document.getElementById('tm-stg');
            if (stg) stg.style.display = 'none';
        }

        setTimeout(function () {
            constrainToViewport(document.getElementById('tm-ext-root'));
        }, 50);
        ns.saveSettings();
    }

    // ── Toggle Settings ────────────────────────────────────────
    function toggleSettings() {
        state.showSettings = !state.showSettings;
        const stg = document.getElementById('tm-stg');
        if (stg) stg.style.display = state.showSettings ? 'block' : 'none';
    }

    // ── Create UI ──────────────────────────────────────────────
    ns.createUI = function () {
        const settings = ns.loadSettings();
        ns.injectStyles();

        const container = document.createElement('div');
        container.id = 'tm-ext-root';
        container.className = 'tm-panel';
        container.style.cssText =
            'position:fixed;' +
            'top:' + settings.position.y + 'px;' +
            'left:' + settings.position.x + 'px;';

        // ── Header ─────────────────────────────────────────
        const headerHTML =
            '<div id="tm-hdr" class="tm-hdr">' +
                '<h3 class="tm-title">' + ICONS.database + ' SN Extractor v' + ns.VERSION + '</h3>' +
                '<div class="tm-hdr-acts">' +
                    '<button class="tm-btn-g" id="tm-settings-btn" title="Settings">' + ICONS.settings + '</button>' +
                    '<button class="tm-btn-g" id="tm-collapse-btn" title="Collapse">' +
                        (state.isCollapsed ? ICONS.chevDown : ICONS.chevUp) +
                    '</button>' +
                '</div>' +
            '</div>';

        // ── Settings Panel ─────────────────────────────────
        const settingsHTML =
            '<div id="tm-stg" class="tm-stg" style="display:none;">' +
                '<div class="tm-stg-title">' +
                    '<span>Settings</span>' +
                    '<button class="tm-btn tm-btn-er tm-btn-xs" id="tm-reset-ui">Reset UI</button>' +
                '</div>' +

                // Table selection
                '<div class="tm-sec">' +
                    '<label class="tm-lbl">Table</label>' +
                    '<select id="tm-table" class="tm-sel">' +
                        '<option value="sc_task"' + (settings.table === 'sc_task' ? ' selected' : '') + '>Service Catalog Tasks (sc_task)</option>' +
                        '<option value="task"' + (settings.table === 'task' ? ' selected' : '') + '>All Tasks (task)</option>' +
                        '<option value="incident"' + (settings.table === 'incident' ? ' selected' : '') + '>Incidents (incident)</option>' +
                        '<option value="sc_req_item"' + (settings.table === 'sc_req_item' ? ' selected' : '') + '>Request Items (sc_req_item)</option>' +
                        '<option value="change_request"' + (settings.table === 'change_request' ? ' selected' : '') + '>Change Requests (change_request)</option>' +
                    '</select>' +
                '</div>' +

                // Accent toggle
                '<div class="tm-sec">' +
                    '<label class="tm-lbl">Accent Color</label>' +
                    '<select id="tm-accent" class="tm-sel">' +
                        '<option value="blue"' + (settings.accent === 'blue' ? ' selected' : '') + '>Blue</option>' +
                        '<option value="red"' + (settings.accent === 'red' ? ' selected' : '') + '>Red</option>' +
                        '<option value="green"' + (settings.accent === 'green' ? ' selected' : '') + '>Green (WFM)</option>' +
                    '</select>' +
                '</div>' +

                // Mode toggle (dark/light)
                '<div class="tm-sec">' +
                    '<label class="tm-lbl">Mode</label>' +
                    '<select id="tm-mode" class="tm-sel">' +
                        '<option value="dark"' + (settings.mode === 'dark' ? ' selected' : '') + '>Dark</option>' +
                        '<option value="light"' + (settings.mode === 'light' ? ' selected' : '') + '>Light</option>' +
                    '</select>' +
                '</div>' +

                // Toggle switches
                '<div class="tm-sec" id="tm-stg-toggles"></div>' +

                // Check for updates
                (FEATURE_FLAGS.UPDATE_CHECKER
                    ? '<div class="tm-sec">' +
                        '<button class="tm-btn tm-btn-s tm-btn-f" id="tm-check-update">' +
                            ICONS.refresh + ' Check for Updates' +
                        '</button>' +
                    '</div>'
                    : ''
                ) +

                // Dev mark
                '<div id="tm-stg-devmark"></div>' +
            '</div>';

        // ── Body ───────────────────────────────────────────
        const sctaskBtnDisplay = settings.sctask && FEATURE_FLAGS.SCTASK_PROCESSING ? '' : 'display:none;';

        const bodyHTML =
            '<div id="tm-body" class="tm-body" style="' + (state.isCollapsed ? 'display:none;' : '') + '">' +

                // Progress bar
                '<div id="tm-prog" style="display:none;">' +
                    '<div class="tm-prog"><div class="tm-prog-bar"></div></div>' +
                    '<div class="tm-prog-txt"></div>' +
                '</div>' +

                // Auto-detect query
                (FEATURE_FLAGS.AUTO_DETECT_QUERY
                    ? '<div class="tm-sec">' +
                        '<div class="tm-hl">' +
                            '<button class="tm-btn tm-btn-p tm-btn-f" id="tm-tool-detect-query">' +
                                ICONS.crosshair + ' Auto-Detect Page Query' +
                            '</button>' +
                            '<div class="tm-hint" style="margin-top:8px;">Extract the query from your current ServiceNow list view</div>' +
                        '</div>' +
                    '</div>'
                    : ''
                ) +

                // States filter
                '<div class="tm-sec">' +
                    '<label class="tm-lbl">States</label>' +
                    '<div id="tm-states-area" class="tm-cb-area">' +
                        CONFIG.STATES.map(function (s) {
                            const checked = settings.states.includes(s.value) ? ' checked' : '';
                            return '<label class="tm-cb-item">' +
                                '<input type="checkbox" value="' + s.value + '"' + checked + '>' +
                                s.label +
                            '</label>';
                        }).join('') +
                    '</div>' +
                '</div>' +

                // Assignment groups
                '<div class="tm-sec">' +
                    '<label class="tm-lbl">Assignment Groups</label>' +
                    '<input type="text" id="tm-groups" class="tm-inp" ' +
                        'value="' + settings.groups.replace(/"/g, '&quot;') + '" ' +
                        'placeholder="e.g., IT Support, Network Team">' +
                    '<div class="tm-hint">Comma-separated group names</div>' +
                '</div>' +

                // Assigned to
                '<div class="tm-sec">' +
                    '<label class="tm-lbl">Assigned To</label>' +
                    '<input type="text" id="tm-assigned" class="tm-inp" ' +
                        'value="' + settings.assigned.replace(/"/g, '&quot;') + '" ' +
                        'placeholder="username or email">' +
                '</div>' +

                // Max records (free-form input, no cap)
                '<div class="tm-sec">' +
                    '<label class="tm-lbl">Max Records</label>' +
                    '<input type="number" id="tm-max" class="tm-inp" ' +
                        'value="' + settings.max + '" min="0" step="1" ' +
                        'placeholder="100">' +
                    '<div class="tm-hint">Set 0 for unlimited (memory dependent)</div>' +
                '</div>' +

                // Custom query
                '<div class="tm-sec">' +
                    '<label class="tm-lbl">ServiceNow Query</label>' +
                    '<textarea id="tm-query" class="tm-ta" ' +
                        'placeholder="assignment_group=...^state=1^ORstate=12">' +
                        settings.query.replace(/</g, '&lt;') +
                    '</textarea>' +
                    '<div class="tm-hint">ServiceNow encoded query (^ for AND, ^OR for OR)</div>' +
                '</div>' +

                '<div class="tm-hr"></div>' +

                // Action buttons
                '<div class="tm-stack">' +
                    (FEATURE_FLAGS.EXTRACT_CURRENT
                        ? '<button class="tm-btn tm-btn-p tm-btn-f" id="tm-tool-extract-current">' +
                            ICONS.extract + ' Extract Current Page</button>'
                        : ''
                    ) +
                    (FEATURE_FLAGS.EXTRACT_QUERY
                        ? '<button class="tm-btn tm-btn-ok tm-btn-f" id="tm-tool-extract-query">' +
                            ICONS.search + ' Extract by Query</button>'
                        : ''
                    ) +
                    (FEATURE_FLAGS.SCTASK_PROCESSING
                        ? '<button class="tm-btn tm-btn-wn tm-btn-f" id="tm-tool-process-sctask" style="' + sctaskBtnDisplay + '">' +
                            ICONS.wrench + ' Process SCTASK Variables</button>'
                        : ''
                    ) +

                    '<div class="tm-btn-row">' +
                        (FEATURE_FLAGS.EXPORT_EXCEL
                            ? '<button class="tm-btn tm-btn-p" id="tm-tool-export-excel" disabled>' +
                                ICONS.grid + ' Excel <span class="tm-badge" id="tm-count-badge">0</span></button>'
                            : ''
                        ) +
                        (FEATURE_FLAGS.EXPORT_CSV
                            ? '<button class="tm-btn tm-btn-s" id="tm-tool-export-csv" disabled title="Export as CSV">' +
                                ICONS.download + ' CSV</button>'
                            : ''
                        ) +
                        (FEATURE_FLAGS.COPY_JSON
                            ? '<button class="tm-btn tm-btn-s" id="tm-tool-copy-json" disabled title="Copy as JSON">' +
                                ICONS.clipboard + '</button>'
                            : ''
                        ) +
                        (FEATURE_FLAGS.CLEAR_DATA
                            ? '<button class="tm-btn tm-btn-er" id="tm-tool-clear-data" title="Clear data">' +
                                ICONS.trash + '</button>'
                            : ''
                        ) +
                    '</div>' +
                    (FEATURE_FLAGS.STREAM_EXPORT
                        ? '<button class="tm-btn tm-btn-s tm-btn-f" id="tm-tool-stream-export" title="Fetch and export directly to Excel without holding in memory">' +
                            ICONS.download + ' Stream Export to Excel</button>'
                        : ''
                    ) +
                '</div>' +

                // Status bar
                '<div id="tm-status" class="tm-status tm-status-top">Ready to extract tickets...</div>' +
            '</div>';

        container.innerHTML = headerHTML + settingsHTML + bodyHTML;
        document.body.appendChild(container);

        // ── Populate toggle switches ───────────────────────
        const togglesArea = document.getElementById('tm-stg-toggles');
        if (togglesArea) {
            // SCTASK toggle
            const sctaskRow = document.createElement('div');
            sctaskRow.className = 'tm-sw-row';
            sctaskRow.innerHTML = '<span class="tm-sw-lbl">SCTASK Variable Processing</span>';
            sctaskRow.appendChild(createSwitch('tm-sw-sctask', settings.sctask));
            togglesArea.appendChild(sctaskRow);

            // Debug toggle
            const debugRow = document.createElement('div');
            debugRow.className = 'tm-sw-row';
            debugRow.innerHTML = '<span class="tm-sw-lbl">Debug Mode (verbose logs)</span>';
            debugRow.appendChild(createSwitch('tm-sw-debug', settings.debug));
            togglesArea.appendChild(debugRow);
        }

        // Dev mark
        const devMarkContainer = document.getElementById('tm-stg-devmark');
        if (devMarkContainer) injectDevMark(devMarkContainer);

        // ── Bind Events ────────────────────────────────────
        bindEvents();
        setupDragAndDrop();

        // Constrain after render
        setTimeout(function () {
            constrainToViewport(container);
            setupViewportConstraints();
        }, 100);

        // Auto-detect query on list pages
        setTimeout(function () {
            var href = window.location.href;
            if (href.includes('list.do') || href.includes('nav_to.do') || href.includes('/wfm')) {
                var result = ns.parseSnURI();
                var autoQuery = result.query || '';
                if (autoQuery && !settings.query) {
                    ns.updateStatus('Auto-detected query: ' + autoQuery.substring(0, 50) + '...');
                }
            }
        }, 1000);

        Logger.success('UI created');
    };

    // ── Event Binding ──────────────────────────────────────────
    function bindEvents() {
        // Header buttons
        addClick('tm-settings-btn', toggleSettings);
        addClick('tm-collapse-btn', toggleCollapse);
        addClick('tm-reset-ui', resetUI);

        // Action buttons (safe - only binds if element exists)
        addClick('tm-tool-detect-query', ns.detectCurrentPageQuery);
        addClick('tm-tool-extract-current', ns.extractCurrentPageTickets);
        addClick('tm-tool-extract-query', ns.extractByQuery);
        addClick('tm-tool-process-sctask', ns.processSCTASKVariables);
        addClick('tm-tool-export-excel', ns.exportToExcel);
        addClick('tm-tool-export-csv', ns.exportToCSV);
        addClick('tm-tool-stream-export', ns.streamExportToExcel);
        // CR-07: Snapshot the array to avoid race with clearData during async clipboard write
        addClick('tm-tool-copy-json', function () {
            ns.copyToClipboard([].concat(state.extractedTickets), 'json');
        });
        addClick('tm-tool-clear-data', ns.clearData);
        addClick('tm-check-update', function () { ns.checkForUpdates(true); });

        // Accent theme change
        var accentEl = document.getElementById('tm-accent');
        if (accentEl) {
            accentEl.addEventListener('change', function (e) {
                state.currentAccent = e.target.value;
                ns.injectStyles();
                ns.saveSettings();
            });
        }

        // Mode change (dark/light)
        var modeEl = document.getElementById('tm-mode');
        if (modeEl) {
            modeEl.addEventListener('change', function (e) {
                state.currentMode = e.target.value;
                ns.injectStyles();
                ns.saveSettings();
            });
        }

        // Table change
        var tableEl = document.getElementById('tm-table');
        if (tableEl) {
            tableEl.addEventListener('change', function (e) {
                CONFIG.TABLE_NAME = e.target.value;
                ns.saveSettings();
            });
        }

        // SCTASK toggle affects button visibility
        var sctaskSwitch = document.getElementById('tm-sw-sctask');
        if (sctaskSwitch) {
            sctaskSwitch.addEventListener('click', function () {
                var btn = document.getElementById('tm-tool-process-sctask');
                if (btn) {
                    btn.style.display = sctaskSwitch.classList.contains('on') ? '' : 'none';
                }
            });
        }

        // Debounced save on text inputs
        ['tm-groups', 'tm-assigned', 'tm-query'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', ns.debouncedSave);
                el.addEventListener('change', ns.saveSettings);
            }
        });

        // Immediate save on selects and number input
        ['tm-max', 'tm-table', 'tm-accent', 'tm-mode'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('change', ns.saveSettings);
        });

        // States checkboxes
        var statesArea = document.getElementById('tm-states-area');
        if (statesArea) statesArea.addEventListener('change', ns.saveSettings);
    }

    // Helper: safely bind click
    function addClick(id, handler) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('click', handler);
    }

    // ── Reset UI ───────────────────────────────────────────────
    // CR-17: Confirm before resetting if user has extracted data
    function resetUI() {
        if (state.extractedTickets.length > 0) {
            var proceed = confirm('You have ' + state.extractedTickets.length + ' extracted tickets. Reset will reload the page and discard them. Continue?');
            if (!proceed) return;
        }
        Logger.info('Resetting UI settings to defaults');
        GM_setValue(SK.POSITION, { x: 10, y: 10 });
        GM_setValue(SK.ACCENT, 'blue');
        GM_setValue(SK.COLLAPSED, false);
        location.reload();
    }

    // ── Save on unload ─────────────────────────────────────────
    window.addEventListener('beforeunload', function () {
        ns.saveSettings();
    });

    // ── CR-19: Keyboard Shortcut (Ctrl+Shift+E) ───────────────
    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && e.shiftKey && e.key === 'E') {
            e.preventDefault();
            const root = document.getElementById('tm-ext-root');
            if (!root) return;

            // If collapsed, expand; if expanded, collapse
            const body = document.getElementById('tm-body');
            if (body) {
                state.isCollapsed = !state.isCollapsed;
                body.style.display = state.isCollapsed ? 'none' : 'block';
                const btn = document.getElementById('tm-collapse-btn');
                if (btn) btn.innerHTML = state.isCollapsed ? ICONS.chevDown : ICONS.chevUp;

                if (state.isCollapsed) {
                    state.showSettings = false;
                    const stg = document.getElementById('tm-stg');
                    if (stg) stg.style.display = 'none';
                }
                ns.saveSettings();
            }
        }
    });

    // ── CR-22: Query History ───────────────────────────────────
    const QUERY_HISTORY_KEY = 'tm_ext_query_history';
    const QUERY_HISTORY_MAX = 10;

    ns.saveQueryToHistory = function (query) {
        if (!query || !query.trim()) return;
        let history = GM_getValue(QUERY_HISTORY_KEY, []);
        // Remove duplicate if exists
        history = history.filter(function (q) { return q !== query; });
        // Add to front
        history.unshift(query);
        // Trim to max
        if (history.length > QUERY_HISTORY_MAX) history = history.slice(0, QUERY_HISTORY_MAX);
        GM_setValue(QUERY_HISTORY_KEY, history);
        Logger.debug('Query saved to history', { count: history.length });
    };

    ns.getQueryHistory = function () {
        return GM_getValue(QUERY_HISTORY_KEY, []);
    };

    // Hook into extractByQuery to auto-save queries
    const _origExtractByQuery = ns.extractByQuery;
    if (typeof _origExtractByQuery === 'function') {
        ns.extractByQuery = async function () {
            // Save the current query before executing
            const queryEl = document.getElementById('tm-query');
            if (queryEl && queryEl.value.trim()) {
                ns.saveQueryToHistory(queryEl.value.trim());
            } else {
                // Build the query from UI and save that
                const built = ns.buildQuery();
                if (built) ns.saveQueryToHistory(built);
            }
            return _origExtractByQuery.apply(this, arguments);
        };
    }

    // Add query history dropdown to settings if not already present
    ns.renderQueryHistory = function () {
        const history = ns.getQueryHistory();
        if (history.length === 0) return;

        let historyArea = document.getElementById('tm-query-history');
        if (!historyArea) {
            // Insert after the query textarea section
            const queryEl = document.getElementById('tm-query');
            if (!queryEl) return;
            const querySection = queryEl.closest('.tm-sec');
            if (!querySection) return;

            historyArea = document.createElement('div');
            historyArea.id = 'tm-query-history';
            historyArea.className = 'tm-sec';
            querySection.parentNode.insertBefore(historyArea, querySection.nextSibling);
        }

        historyArea.innerHTML = '';

        const label = document.createElement('label');
        label.className = 'tm-lbl';
        label.textContent = 'Recent Queries';
        historyArea.appendChild(label);

        const select = document.createElement('select');
        select.className = 'tm-sel';
        select.innerHTML = '<option value="">-- Select a recent query --</option>';
        history.forEach(function (q) {
            const opt = document.createElement('option');
            opt.value = q;
            opt.textContent = q.length > 60 ? q.substring(0, 57) + '...' : q;
            opt.title = q;
            select.appendChild(opt);
        });

        select.addEventListener('change', function () {
            if (select.value) {
                const queryInput = document.getElementById('tm-query');
                if (queryInput) queryInput.value = select.value;
                ns.debouncedSave();
                select.selectedIndex = 0; // Reset dropdown
            }
        });

        historyArea.appendChild(select);
    };

    // Render query history after UI is built (called from createUI flow)
    setTimeout(function () { ns.renderQueryHistory(); }, 200);

    Logger.info('UI module loaded');

    // CR-16: Export for testing
    try { module.exports = { showToast: ns.showToast, updateStatus: ns.updateStatus, createUI: ns.createUI, saveSettings: ns.saveSettings, loadSettings: ns.loadSettings, saveQueryToHistory: ns.saveQueryToHistory, getQueryHistory: ns.getQueryHistory }; } catch (e) { /* browser */ }
})();
