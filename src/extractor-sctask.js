// ============================================================
// ServiceNow Extractor - SCTASK Processing Module
// Extracts catalog variables from SCTASK tickets by resolving
// the RITM chain and reading MTOM variable rows.
// Uses concurrent batch processing for performance.
// ============================================================
(function () {
    'use strict';

    const ns = window.SNExtractor;
    if (!ns) { console.error('[SN-Extractor] Config module not loaded'); return; }

    // CR-05: Reference ns.snFetch at call time, not at module load (avoids load-order issues)
    const { CONFIG, state, Logger } = ns;

    // ── Helpers ────────────────────────────────────────────────
    const toPlain = function (v) {
        if (v == null) return '';
        if (typeof v === 'string') return v;
        if (Array.isArray(v)) return v.map(toPlain).join(', ');
        if (typeof v === 'object') {
            return toPlain(v.display_value ?? v.value ?? JSON.stringify(v));
        }
        return String(v);
    };

    // Resolve task number to RITM sys_id
    const taskToRITM = async function (taskNumber) {
        const rows = await ns.snFetch(
            `${CONFIG.BASE_URL}/api/now/table/sc_task` +
            `?sysparm_query=number=${encodeURIComponent(taskNumber)}` +
            `&sysparm_fields=request_item` +
            `&sysparm_limit=1`,
            'sc_task lookup'
        );
        return rows[0]?.request_item?.value || null;
    };

    // Load MTOM rows with dot-walked question text
    const loadMTOM = function (ritmSysId) {
        return ns.snFetch(
            `${CONFIG.BASE_URL}/api/now/table/sc_item_option_mtom` +
            `?sysparm_query=request_item=${ritmSysId}` +
            `&sysparm_fields=` +
                `sc_item_option.item_option_new.question_text,` +
                `sc_item_option.item_option_new.name,` +
                `sc_item_option.question,` +
                `sc_item_option.value,` +
                `sc_item_option.display_value` +
            `&sysparm_display_value=all` +
            `&sysparm_exclude_reference_link=true` +
            `&sysparm_limit=1000`,
            'sc_item_option_mtom'
        );
    };

    // Extract one question-answer pair from a row
    const getQA = function (row) {
        const qRaw =
            row['sc_item_option.item_option_new.question_text'] ||
            row['sc_item_option.item_option_new.name'] ||
            row['sc_item_option.question'] ||
            '';
        const question = toPlain(qRaw).trim();
        const answer = toPlain(
            row['sc_item_option.display_value'] ?? row['sc_item_option.value']
        ).trim();
        return question && answer ? [question, answer] : null;
    };

    // Fold all rows into a flat key-value object
    const fold = function (rows) {
        return rows.reduce(function (out, row) {
            const qa = getQA(row);
            if (qa) {
                const key = 'var_' + qa[0].replace(/[^a-zA-Z0-9]/g, '_');
                out[key] = qa[1];
            }
            return out;
        }, {});
    };

    // Get variables for a single task
    const getTaskVariables = async function (taskNumber) {
        if (state.sctaskAborted) return {};     // CR-24: per-operation flag
        Logger.debug(`Processing ${taskNumber}...`);

        const ritmId = await taskToRITM(taskNumber);
        if (!ritmId) {
            Logger.warn(`Task ${taskNumber}: no RITM found`);
            return {};
        }

        const rows = await loadMTOM(ritmId);
        const vars = fold(rows);
        Logger.debug(`Task ${taskNumber} -> ${Object.keys(vars).length} variables`);
        return vars;
    };

    // ── Main SCTASK processor ──────────────────────────────────
    // Processes all SCTASK tickets in extractedTickets using
    // concurrent batches of CONFIG.SCTASK_CONCURRENCY.
    ns.processSCTASKVariables = async function () {
        if (state.isProcessing) return;

        const sctaskEnabled = GM_getValue(ns.SK.SCTASK, true);
        if (!sctaskEnabled) {
            ns.showToast('SCTASK processing is disabled in settings', 'warning');
            return;
        }

        const tasks = state.extractedTickets.filter(function (t) {
            return t.number && t.number.startsWith('SCTASK');
        });

        if (tasks.length === 0) {
            ns.showToast('No SCTASK tickets found to process', 'warning');
            return;
        }

        state.isProcessing = true;
        state.processingAborted = false;
        state.sctaskAborted = false;    // CR-24: per-operation flag
        updateSCTASKButton(true);

        try {
            ns.updateStatus(`Processing ${tasks.length} SCTASK tickets...`);
            ns.updateProgress(0, tasks.length, 'Starting SCTASK processing...');

            let processed = 0;
            let variablesFound = 0;

            for (let i = 0; i < tasks.length; i += CONFIG.SCTASK_CONCURRENCY) {
                if (state.sctaskAborted) break;     // CR-24: check own flag

                const batch = tasks.slice(i, i + CONFIG.SCTASK_CONCURRENCY);
                const results = await Promise.allSettled(
                    batch.map(function (ticket) {
                        return getTaskVariables(ticket.number);
                    })
                );

                results.forEach(function (result, idx) {
                    if (result.status === 'fulfilled') {
                        const vars = result.value;
                        Object.assign(batch[idx], vars);
                        variablesFound += Object.keys(vars).length;
                    } else {
                        Logger.error(`Failed: ${batch[idx].number}`, result.reason);
                    }
                });

                processed += batch.length;
                ns.updateProgress(
                    processed, tasks.length,
                    `Processed ${processed}/${tasks.length} (${variablesFound} variables)`
                );

                // Delay between batches
                if (i + CONFIG.SCTASK_CONCURRENCY < tasks.length) {
                    await new Promise(function (resolve) {
                        setTimeout(resolve, CONFIG.SCTASK_DELAY_MS);
                    });
                }
            }

            if (!state.sctaskAborted) {
                ns.showToast(
                    `Processed ${processed} tickets, ${variablesFound} variables found`,
                    'success'
                );
                ns.updateStatus(`SCTASK complete: ${processed} tickets, ${variablesFound} variables`);
                Logger.success('SCTASK processing complete', {
                    ticketsProcessed: processed,
                    variablesFound: variablesFound
                });
            }
        } catch (err) {
            Logger.error('SCTASK processing failed:', err);
            ns.showToast(`SCTASK processing failed: ${err.message}`, 'error');
            ns.updateStatus(`SCTASK failed: ${err.message}`);
        } finally {
            state.isProcessing = false;
            state.processingAborted = false;
            state.sctaskAborted = false;    // CR-24
            updateSCTASKButton(false);
        }
    };

    // ── Button state toggle ────────────────────────────────────
    function updateSCTASKButton(processing) {
        const btn = document.getElementById('tm-tool-process-sctask');
        if (!btn) return;

        if (processing) {
            btn.innerHTML = `${ns.ICONS.stop} <span>Abort SCTASK</span>`;
            btn.className = 'tm-btn tm-btn-er tm-btn-f';
            btn.onclick = function () {
                state.processingAborted = true;
                state.sctaskAborted = true;     // CR-24
                ns.showToast('Aborting SCTASK processing...', 'warning');
            };
        } else {
            btn.innerHTML = `${ns.ICONS.wrench} <span>Process SCTASK Variables</span>`;
            btn.className = 'tm-btn tm-btn-wn tm-btn-f';
            btn.onclick = ns.processSCTASKVariables;
        }
    }

    // ── Variable Column Standardization ─────────────────────────
    // Maintains a persistent ordered list of all variable column names
    // seen across extractions. When exporting, columns appear in this
    // stable order regardless of which ticket introduced them first.
    const VAR_ORDER_KEY = 'tm_ext_var_order';

    ns.getVarColumnOrder = function () {
        return GM_getValue(VAR_ORDER_KEY, []);
    };

    // Register new variable columns and persist the canonical order
    ns.registerVarColumns = function (varKeys) {
        if (!varKeys || varKeys.length === 0) return;

        let order = ns.getVarColumnOrder();
        const existing = new Set(order);
        let added = 0;

        varKeys.forEach(function (key) {
            if (!existing.has(key)) {
                order.push(key);
                existing.add(key);
                added++;
            }
        });

        if (added > 0) {
            GM_setValue(VAR_ORDER_KEY, order);
            Logger.debug('Registered ' + added + ' new variable columns (total: ' + order.length + ')');
        }
    };

    // Sort ticket keys so standard fields come first (in CONFIG.FIELDS order),
    // then variable fields in the persisted canonical order.
    ns.standardizeTicketKeys = function (tickets) {
        if (!tickets || tickets.length === 0) return tickets;

        const stdFields = ns.CONFIG.FIELDS;
        const varOrder = ns.getVarColumnOrder();

        // Collect all keys across all tickets
        const allKeysSet = new Set();
        tickets.forEach(function (t) {
            Object.keys(t).forEach(function (k) { allKeysSet.add(k); });
        });

        // Partition into standard fields, _dv fields, and variable fields
        const orderedKeys = [];
        const seen = new Set();

        // 1. Standard fields in CONFIG.FIELDS order
        stdFields.forEach(function (f) {
            if (allKeysSet.has(f) && !seen.has(f)) {
                orderedKeys.push(f);
                seen.add(f);
                // Include _dv companion if exists
                const dv = f + '_dv';
                if (allKeysSet.has(dv) && !seen.has(dv)) {
                    orderedKeys.push(dv);
                    seen.add(dv);
                }
            }
        });

        // 2. Variable fields in persisted canonical order
        varOrder.forEach(function (v) {
            if (allKeysSet.has(v) && !seen.has(v)) {
                orderedKeys.push(v);
                seen.add(v);
            }
        });

        // 3. Any remaining keys not in either list (sorted alphabetically)
        Array.from(allKeysSet).sort().forEach(function (k) {
            if (!seen.has(k)) {
                orderedKeys.push(k);
                seen.add(k);
            }
        });

        // Reorder each ticket's keys
        return tickets.map(function (ticket) {
            const ordered = {};
            orderedKeys.forEach(function (key) {
                if (key in ticket) {
                    ordered[key] = ticket[key];
                } else {
                    ordered[key] = ''; // Fill missing columns with empty string
                }
            });
            return ordered;
        });
    };

    // Hook: After processing SCTASK variables, register all var_ columns
    const _origProcessSCTASK = ns.processSCTASKVariables;
    ns.processSCTASKVariables = async function () {
        await _origProcessSCTASK.apply(this, arguments);

        // After processing, scan for var_ columns and register them
        const varKeys = [];
        const seenKeys = new Set();
        state.extractedTickets.forEach(function (t) {
            Object.keys(t).forEach(function (k) {
                if (k.startsWith('var_') && !seenKeys.has(k)) {
                    varKeys.push(k);
                    seenKeys.add(k);
                }
            });
        });
        ns.registerVarColumns(varKeys);
    };

    Logger.info('SCTASK module loaded');

    // CR-16: Export for testing
    try { module.exports = { processSCTASKVariables: ns.processSCTASKVariables, getVarColumnOrder: ns.getVarColumnOrder, registerVarColumns: ns.registerVarColumns, standardizeTicketKeys: ns.standardizeTicketKeys }; } catch (e) { /* browser */ }
})();
