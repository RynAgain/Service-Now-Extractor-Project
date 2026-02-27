// ============================================================
// ServiceNow Extractor - Export Module
// Excel export via SheetJS, JSON clipboard copy, data clearing.
// ============================================================
(function () {
    'use strict';

    const ns = window.SNExtractor;
    if (!ns) { console.error('[SN-Extractor] Config module not loaded'); return; }

    const { state, Logger } = ns;

    // ── Export to Excel ────────────────────────────────────────
    ns.exportToExcel = function () {
        if (state.extractedTickets.length === 0) {
            ns.showToast('No tickets to export', 'warning');
            return;
        }

        ns.updateStatus('Generating Excel file...');

        try {
            if (typeof XLSX === 'undefined') {
                throw new Error('XLSX library not loaded. Check @require directive.');
            }

            const wb = XLSX.utils.book_new();

            // Flatten all values to strings for Excel
            const cleaned = state.extractedTickets.map(function (ticket) {
                const row = {};
                Object.keys(ticket).forEach(function (key) {
                    const value = ticket[key];
                    if (value === null || value === undefined) {
                        row[key] = '';
                    } else if (typeof value === 'object') {
                        row[key] = JSON.stringify(value);
                    } else {
                        row[key] = String(value);
                    }
                });
                return row;
            });

            const ws = XLSX.utils.json_to_sheet(cleaned);

            // Auto-size columns
            const allColumns = new Set();
            cleaned.forEach(function (ticket) {
                Object.keys(ticket).forEach(function (key) {
                    allColumns.add(key);
                });
            });

            ws['!cols'] = Array.from(allColumns).map(function (field) {
                const maxLen = Math.max(
                    field.length,
                    ...cleaned.map(function (ticket) {
                        return String(ticket[field] || '').length;
                    })
                );
                return { wch: Math.min(maxLen + 2, 50) };
            });

            XLSX.utils.book_append_sheet(wb, ws, 'ServiceNow Tickets');

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `servicenow-tickets-${timestamp}.xlsx`;
            XLSX.writeFile(wb, filename);

            ns.showToast(
                `Exported ${state.extractedTickets.length} tickets to ${filename}`,
                'success',
                5000,
                { label: 'Clear data', callback: ns.clearData }
            );
            ns.updateStatus(`Exported ${state.extractedTickets.length} tickets`);
            Logger.success(`Exported to ${filename}`, { count: state.extractedTickets.length });

        } catch (err) {
            Logger.error('Export failed:', err);
            ns.showToast(`Export failed: ${err.message}`, 'error');
            ns.updateStatus(`Export failed: ${err.message}`);
        }
    };

    // ── Copy to Clipboard ──────────────────────────────────────
    // CR-01: Fixed - use .catch() on the promise instead of re-throwing
    ns.copyToClipboard = function (data, format) {
        format = format || 'json';
        Logger.info('Copying ' + (Array.isArray(data) ? data.length : 1) + ' records as ' + format.toUpperCase());

        try {
            const content = format === 'json'
                ? JSON.stringify(data, null, 2)
                : String(data);

            navigator.clipboard.writeText(content).then(function () {
                ns.showToast(
                    'Copied ' + format.toUpperCase() + ' to clipboard (' + content.length + ' chars)',
                    'success'
                );
                Logger.success('Clipboard copy successful', {
                    records: Array.isArray(data) ? data.length : 1,
                    size: content.length
                });
            }).catch(function (clipErr) {
                Logger.error('Clipboard write rejected', clipErr);
                ns.showToast('Copy failed: ' + clipErr.message, 'error');
            });
        } catch (err) {
            Logger.error('Clipboard copy failed', err);
            ns.showToast('Copy failed: ' + err.message, 'error');
        }
    };

    // ── CR-20: Export to CSV ───────────────────────────────────
    ns.exportToCSV = function () {
        if (state.extractedTickets.length === 0) {
            ns.showToast('No tickets to export', 'warning');
            return;
        }

        ns.updateStatus('Generating CSV file...');

        try {
            // Collect all unique column headers
            const allCols = [];
            const colSet = new Set();
            state.extractedTickets.forEach(function (ticket) {
                Object.keys(ticket).forEach(function (key) {
                    if (!colSet.has(key)) { colSet.add(key); allCols.push(key); }
                });
            });

            // Escape CSV value
            function csvEscape(val) {
                if (val === null || val === undefined) return '';
                var str = String(val);
                if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
                    return '"' + str.replace(/"/g, '""') + '"';
                }
                return str;
            }

            // Build CSV string
            var lines = [];
            lines.push(allCols.map(csvEscape).join(','));

            state.extractedTickets.forEach(function (ticket) {
                var row = allCols.map(function (col) {
                    return csvEscape(ticket[col]);
                });
                lines.push(row.join(','));
            });

            var csvContent = lines.join('\n');
            var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            var url = URL.createObjectURL(blob);

            var timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            var filename = 'servicenow-tickets-' + timestamp + '.csv';

            var link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            ns.showToast('Exported ' + state.extractedTickets.length + ' tickets as CSV', 'success', 5000,
                { label: 'Clear data', callback: ns.clearData });
            ns.updateStatus('Exported ' + state.extractedTickets.length + ' tickets to ' + filename);
            Logger.success('CSV exported: ' + filename, { count: state.extractedTickets.length });

        } catch (err) {
            Logger.error('CSV export failed:', err);
            ns.showToast('CSV export failed: ' + err.message, 'error');
        }
    };

    // ── CR-21: Streaming Export (export per page during fetch) ──
    // This function is designed to be called from extractByQuery
    // as an alternative to accumulating all records in memory.
    ns.streamExportToExcel = async function () {
        if (state.isProcessing) {
            Logger.warn('Already processing');
            return;
        }

        var query = ns.buildQuery();
        var maxEl = document.getElementById('tm-max');
        var rawMax = maxEl ? parseInt(maxEl.value, 10) : 100;
        var maxVal = isNaN(rawMax) ? 100 : rawMax;
        var tableEl = document.getElementById('tm-table');
        var table = tableEl ? tableEl.value : ns.CONFIG.TABLE_NAME;

        if (!query) {
            ns.showToast('Specify at least one filter or query', 'warning');
            return;
        }

        state.isProcessing = true;
        state.processingAborted = false;

        try {
            if (typeof XLSX === 'undefined') {
                throw new Error('XLSX library not loaded');
            }

            ns.updateStatus('Starting streaming export...');
            var fields = ns.CONFIG.FIELDS.join(',');
            var targetCount = maxVal === 0 ? Infinity : maxVal;
            var pageSize = ns.CONFIG.PAGE_SIZE;
            var offset = 0;
            var totalFetched = 0;
            var allRows = [];

            ns.updateProgress(0, targetCount === Infinity ? 1 : targetCount, 'Starting streaming export...');

            while (totalFetched < targetCount) {
                if (state.processingAborted) break;

                var batchSize = targetCount === Infinity
                    ? pageSize
                    : Math.min(pageSize, targetCount - totalFetched);

                var url =
                    ns.CONFIG.BASE_URL + '/api/now/table/' + table +
                    '?sysparm_query=' + encodeURIComponent(query) +
                    '&sysparm_fields=' + fields +
                    '&sysparm_limit=' + batchSize +
                    '&sysparm_offset=' + offset +
                    '&sysparm_display_value=all' +
                    '&sysparm_exclude_reference_link=true';

                var resp = await fetch(url, {
                    method: 'GET',
                    headers: ns.authHeaders(),
                    credentials: 'include'
                });

                if (!resp.ok) {
                    if (resp.status === 401 || resp.status === 403) {
                        ns.showToast('Session expired', 'error', 5000);
                    }
                    throw new Error('HTTP ' + resp.status + ': ' + resp.statusText);
                }

                var data = await resp.json();
                var batch = data.result || [];
                if (batch.length === 0) break;

                // Clean and accumulate
                batch.forEach(function (t) {
                    var clean = ns.cleanTicket(t);
                    var row = {};
                    Object.keys(clean).forEach(function (k) {
                        var v = clean[k];
                        if (v === null || v === undefined) row[k] = '';
                        else if (typeof v === 'object') row[k] = JSON.stringify(v);
                        else row[k] = String(v);
                    });
                    allRows.push(row);
                });

                totalFetched += batch.length;
                offset += batch.length;

                ns.updateProgress(
                    totalFetched,
                    targetCount === Infinity ? totalFetched + pageSize : targetCount,
                    'Fetched ' + totalFetched + ' records for export...'
                );
                ns.updateStatus('Streaming export: ' + totalFetched + ' records (page ' + Math.ceil(offset / pageSize) + ')...');

                if (batch.length < batchSize) break;
                await new Promise(function (r) { setTimeout(r, 100); });
            }

            if (state.processingAborted) {
                ns.showToast('Streaming export aborted after ' + totalFetched + ' records', 'warning');
                ns.updateStatus('Export aborted');
                return;
            }

            // Build Excel from accumulated rows
            var wb = XLSX.utils.book_new();
            var ws = XLSX.utils.json_to_sheet(allRows);
            XLSX.utils.book_append_sheet(wb, ws, 'Tickets');

            var timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            var filename = 'servicenow-stream-' + timestamp + '.xlsx';
            XLSX.writeFile(wb, filename);

            ns.showToast('Streamed ' + totalFetched + ' records to ' + filename, 'success', 5000);
            ns.updateStatus('Streaming export complete: ' + totalFetched + ' records');
            Logger.success('Streaming export: ' + filename, { count: totalFetched });

        } catch (err) {
            Logger.error('Streaming export failed:', err);
            ns.showToast('Streaming export failed: ' + err.message, 'error');
            ns.updateStatus('Streaming export failed: ' + err.message);
        } finally {
            state.isProcessing = false;
            state.processingAborted = false;
        }
    };

    // ── Clear Data ─────────────────────────────────────────────
    ns.clearData = function () {
        const previousCount = state.extractedTickets.length;
        state.extractedTickets = [];
        ns.updateExportBtns();
        ns.updateStatus('Data cleared');
        ns.showToast(`Cleared ${previousCount} tickets`, 'info');
        Logger.info(`Cleared ${previousCount} tickets`);
    };

    // ── Export Button State ────────────────────────────────────
    ns.updateExportBtns = function () {
        const count = state.extractedTickets.length;
        const excelBtn = document.getElementById('tm-tool-export-excel');
        const jsonBtn = document.getElementById('tm-tool-copy-json');
        const badge = document.getElementById('tm-count-badge');

        if (excelBtn) excelBtn.disabled = count === 0;
        if (jsonBtn) jsonBtn.disabled = count === 0;
        if (badge) badge.textContent = String(count);
    };

    Logger.info('Export module loaded');

    // CR-16: Export for testing
    try { module.exports = { exportToExcel: ns.exportToExcel, exportToCSV: ns.exportToCSV, streamExportToExcel: ns.streamExportToExcel, copyToClipboard: ns.copyToClipboard, clearData: ns.clearData, updateExportBtns: ns.updateExportBtns }; } catch (e) { /* browser */ }
})();
