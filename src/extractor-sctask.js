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

    const { CONFIG, state, Logger, snFetch } = ns;

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
        const rows = await snFetch(
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
        return snFetch(
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
        if (state.processingAborted) return {};
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
        updateSCTASKButton(true);

        try {
            ns.updateStatus(`Processing ${tasks.length} SCTASK tickets...`);
            ns.updateProgress(0, tasks.length, 'Starting SCTASK processing...');

            let processed = 0;
            let variablesFound = 0;

            for (let i = 0; i < tasks.length; i += CONFIG.SCTASK_CONCURRENCY) {
                if (state.processingAborted) break;

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

            if (!state.processingAborted) {
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
                ns.showToast('Aborting SCTASK processing...', 'warning');
            };
        } else {
            btn.innerHTML = `${ns.ICONS.wrench} <span>Process SCTASK Variables</span>`;
            btn.className = 'tm-btn tm-btn-wn tm-btn-f';
            btn.onclick = ns.processSCTASKVariables;
        }
    }

    Logger.info('SCTASK module loaded');
})();
