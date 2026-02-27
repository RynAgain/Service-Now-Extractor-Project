// ============================================================
// ServiceNow Extractor - API Module
// Handles all ServiceNow REST API communication, including
// paginated fetching for unlimited record counts.
// ============================================================
(function () {
    'use strict';

    const ns = window.SNExtractor;
    if (!ns) { console.error('[SN-Extractor] Config module not loaded'); return; }

    const { CONFIG, state, Logger, authHeaders } = ns;

    // ── Low-level fetch wrapper ────────────────────────────────
    ns.snFetch = async function (url, label) {
        const t0 = performance.now();
        try {
            const r = await fetch(url, { headers: authHeaders(), credentials: 'include' });
            if (!r.ok) {
                const body = await r.text();
                Logger.error(`${label}: HTTP ${r.status}`, body);
                return [];
            }
            const body = await r.json();
            const count = (body.result || []).length;
            Logger.debug(`${label} -> ${count} rows (${Math.round(performance.now() - t0)} ms)`);
            return body.result || [];
        } catch (err) {
            Logger.error(`${label} failed:`, err);
            return [];
        }
    };

    // ── Clean ticket data ──────────────────────────────────────
    // Normalizes reference fields and flattens objects.
    ns.cleanTicket = function (ticket) {
        const clean = {};
        const refFields = [
            'request_item', 'request', 'parent', 'cmdb_ci',
            'assigned_to', 'assignment_group', 'caller_id',
            'opened_by', 'resolved_by', 'closed_by'
        ];

        Object.keys(ticket).forEach(field => {
            let value = ticket[field];

            // Reference fields: keep both sys_id and display value
            if (refFields.includes(field) && typeof value === 'object' && value !== null) {
                clean[field] = value.value || null;
                clean[`${field}_dv`] = value.display_value || '';
                return;
            }

            // Other objects: extract display_value or value
            if (typeof value === 'object' && value !== null) {
                if (value.display_value !== undefined) {
                    value = value.display_value;
                } else if (value.value !== undefined) {
                    value = value.value;
                } else {
                    value = JSON.stringify(value);
                }
            }

            // Clean up strings
            if (typeof value === 'string') {
                value = value.replace(/\n/g, ' ').trim();
            }

            clean[field] = value;
        });

        return clean;
    };

    // ── Parse ServiceNow URI ───────────────────────────────────
    ns.parseSnURI = function (uri) {
        uri = uri || window.location.href;
        try {
            let query = '';
            if (uri.includes('nav_to.do')) {
                const params = new URLSearchParams(uri.split('?')[1]);
                const inner = params.get('uri');
                if (inner) {
                    const match = decodeURIComponent(inner).match(/sysparm_query=([^&]+)/);
                    if (match) query = decodeURIComponent(match[1]);
                }
            } else {
                query = new URLSearchParams(uri.split('?')[1]).get('sysparm_query') || '';
            }
            return query;
        } catch (e) {
            return '';
        }
    };

    // ── Build query from UI inputs ─────────────────────────────
    ns.buildQuery = function () {
        const customEl = document.getElementById('tm-query');
        const custom = customEl ? customEl.value.trim() : '';
        if (custom) return custom;

        const parts = [];

        // States
        const states = ns.getSelectedStates ? ns.getSelectedStates() : [];
        if (states.length === 1) {
            parts.push(`state=${states[0]}`);
        } else if (states.length > 1) {
            parts.push(`stateIN${states.join(',')}`);
        }

        // Assignment groups
        const groupsEl = document.getElementById('tm-groups');
        const groupsVal = groupsEl ? groupsEl.value.trim() : '';
        if (groupsVal) {
            const groups = groupsVal.split(',').map(s => s.trim()).filter(Boolean);
            if (groups.length === 1) {
                parts.push(`assignment_group.name=${groups[0]}`);
            } else if (groups.length > 1) {
                parts.push(`assignment_group.nameIN${groups.join(',')}`);
            }
        }

        // Assigned to
        const assignedEl = document.getElementById('tm-assigned');
        const assigned = assignedEl ? assignedEl.value.trim() : '';
        if (assigned) {
            parts.push(`assigned_to.user_name=${assigned}`);
        }

        return parts.join('^');
    };

    // ── Paginated API extraction ───────────────────────────────
    // Fetches records in pages of CONFIG.PAGE_SIZE until the
    // requested count is reached or no more records exist.
    // Supports abort, progress updates, and memory warnings.
    ns.extractByQuery = async function () {
        if (state.isProcessing) {
            Logger.warn('Extraction already in progress');
            return;
        }

        const query = ns.buildQuery();
        const maxEl = document.getElementById('tm-max');
        const maxVal = maxEl ? (parseInt(maxEl.value, 10) || 100) : 100;
        const tableEl = document.getElementById('tm-table');
        const table = tableEl ? tableEl.value : CONFIG.TABLE_NAME;

        if (!query) {
            ns.showToast('Specify at least one filter or query', 'warning');
            return;
        }

        state.isProcessing = true;
        state.processingAborted = false;

        // Swap button to abort mode
        const extractBtn = document.getElementById('tm-tool-extract-query');
        if (extractBtn) {
            extractBtn.innerHTML = `${ns.ICONS.stop} <span>Abort</span>`;
            extractBtn.className = 'tm-btn tm-btn-er tm-btn-f';
            extractBtn.onclick = function () {
                state.processingAborted = true;
                ns.showToast('Aborting extraction...', 'warning');
            };
        }

        try {
            ns.updateStatus('Extracting via API...');
            const fields = CONFIG.FIELDS.join(',');
            const targetCount = maxVal === 0 ? Infinity : maxVal;
            const pageSize = CONFIG.PAGE_SIZE;
            let offset = 0;
            let totalFetched = 0;
            let allTickets = [];

            ns.updateProgress(0, targetCount === Infinity ? 1 : targetCount, 'Starting extraction...');

            while (totalFetched < targetCount) {
                if (state.processingAborted) break;

                const batchSize = targetCount === Infinity
                    ? pageSize
                    : Math.min(pageSize, targetCount - totalFetched);

                const url =
                    `${CONFIG.BASE_URL}/api/now/table/${table}` +
                    `?sysparm_query=${encodeURIComponent(query)}` +
                    `&sysparm_fields=${fields}` +
                    `&sysparm_limit=${batchSize}` +
                    `&sysparm_offset=${offset}` +
                    `&sysparm_display_value=all` +
                    `&sysparm_exclude_reference_link=true`;

                const resp = await fetch(url, {
                    method: 'GET',
                    headers: authHeaders(),
                    credentials: 'include'
                });

                if (!resp.ok) {
                    if (resp.status === 401 || resp.status === 403) {
                        ns.showToast('Session expired - please re-authenticate', 'error', 5000);
                    }
                    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
                }

                const data = await resp.json();
                const batch = data.result || [];
                if (batch.length === 0) break;

                allTickets = allTickets.concat(batch.map(t => ns.cleanTicket(t)));
                totalFetched += batch.length;
                offset += batch.length;

                // Memory check
                if (window.performance && performance.memory) {
                    const usedMB = Math.round(performance.memory.usedJSHeapSize / 1048576);
                    const limitMB = Math.round(performance.memory.jsHeapSizeLimit / 1048576);
                    if (usedMB / limitMB > 0.8) {
                        ns.showToast(
                            `Memory high: ${usedMB}MB / ${limitMB}MB. Consider exporting.`,
                            'warning', 5000
                        );
                    }
                }

                ns.updateProgress(
                    totalFetched,
                    targetCount === Infinity ? totalFetched + pageSize : targetCount,
                    `Fetched ${totalFetched} records...`
                );
                ns.updateStatus(`Fetched ${totalFetched} records (page ${Math.ceil(offset / pageSize)})...`);

                // Reached end of data
                if (batch.length < batchSize) break;

                // Delay between pages
                await new Promise(r => setTimeout(r, 100));
            }

            if (state.processingAborted) {
                ns.showToast(`Aborted after ${totalFetched} records`, 'warning');
                ns.updateStatus(`Aborted after ${totalFetched} records`);
            }

            // Deduplicate and merge
            const existingIds = new Set(state.extractedTickets.map(t => t.sys_id));
            let newCount = 0;
            allTickets.forEach(t => {
                if (!existingIds.has(t.sys_id)) {
                    state.extractedTickets.push(t);
                    existingIds.add(t.sys_id);
                    newCount++;
                }
            });

            ns.updateExportBtns();
            if (!state.processingAborted) {
                ns.showToast(`Extracted ${newCount} new tickets (${totalFetched} total fetched)`, 'success');
                ns.updateStatus(`Extracted ${newCount} new tickets via API`);
            }

        } catch (err) {
            Logger.error('API extraction failed:', err);
            ns.showToast(`Extraction failed: ${err.message}`, 'error');
            ns.updateStatus(`Failed: ${err.message}`);
        } finally {
            state.isProcessing = false;
            state.processingAborted = false;
            // Restore button
            if (extractBtn) {
                extractBtn.innerHTML = `${ns.ICONS.search} <span>Extract by Query</span>`;
                extractBtn.className = 'tm-btn tm-btn-ok tm-btn-f';
                extractBtn.onclick = ns.extractByQuery;
            }
        }
    };

    // ── Extract from current page DOM ──────────────────────────
    ns.extractCurrentPageTickets = function () {
        ns.updateStatus('Extracting from current page...');
        const rows = document.querySelectorAll(
            'tr[data-list_id], tr.list_row, tr[sys_id]:not([sys_id=""])'
        );
        if (rows.length > 0) {
            ns.extractFromList(rows);
        } else {
            ns.extractFromForm();
        }
    };

    ns.extractFromList = function (rows) {
        const tickets = [];
        rows.forEach(row => {
            const ticket = {};
            ticket.sys_id =
                row.getAttribute('sys_id') ||
                row.getAttribute('data-sys_id') ||
                (row.querySelector('input[name="sys_id"]') || {}).value || '';

            row.querySelectorAll('td').forEach(cell => {
                const fieldName =
                    cell.getAttribute('name') ||
                    cell.getAttribute('data-field') || '';
                if (fieldName && CONFIG.FIELDS.includes(fieldName)) {
                    const link = cell.querySelector('a:not(.icon)');
                    if (link && link.textContent.trim() && !link.classList.contains('icon')) {
                        ticket[fieldName] = link.textContent.trim();
                    } else if (cell.textContent.trim()) {
                        ticket[fieldName] = cell.textContent.trim();
                    }
                }
            });

            if (!ticket.number) {
                const a = row.querySelector('td a:not(.icon)');
                if (a && a.textContent.match(/\w+\d+/)) {
                    ticket.number = a.textContent.trim();
                }
            }

            if (Object.keys(ticket).length > 1) tickets.push(ticket);
        });

        ns.addTickets(tickets);
        ns.showToast(`Extracted ${tickets.length} tickets from list view`, 'success');
        ns.updateStatus(`Extracted ${tickets.length} tickets from list view`);
    };

    ns.extractFromForm = function () {
        const ticket = {};
        CONFIG.FIELDS.forEach(field => {
            const el =
                document.querySelector(`[name="${field}"]`) ||
                document.querySelector(`#${field}`) ||
                document.querySelector(`[data-field="${field}"]`);
            if (el) ticket[field] = el.value || el.textContent.trim();
        });

        if (Object.keys(ticket).length > 0) {
            ns.addTickets([ticket]);
            ns.showToast('Extracted 1 ticket from form view', 'success');
            ns.updateStatus('Extracted 1 ticket from form view');
        } else {
            ns.showToast('No ticket data found on current page', 'warning');
            ns.updateStatus('No ticket data found');
        }
    };

    // ── Add tickets with dedup ─────────────────────────────────
    ns.addTickets = function (tickets) {
        const ids = new Set(state.extractedTickets.map(t => t.sys_id));
        tickets.forEach(t => {
            const clean = typeof t.sys_id === 'object' ? ns.cleanTicket(t) : t;
            if (!ids.has(clean.sys_id)) {
                state.extractedTickets.push(clean);
                ids.add(clean.sys_id);
            }
        });
        ns.updateExportBtns();
    };

    Logger.info('API module loaded');
})();
