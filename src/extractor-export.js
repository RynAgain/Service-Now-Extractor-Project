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
    ns.copyToClipboard = function (data, format) {
        format = format || 'json';
        Logger.info(`Copying ${state.extractedTickets.length} tickets as ${format.toUpperCase()}`);

        try {
            const content = format === 'json'
                ? JSON.stringify(data, null, 2)
                : String(data);

            navigator.clipboard.writeText(content).then(function () {
                ns.showToast(
                    `Copied ${format.toUpperCase()} to clipboard (${content.length} chars)`,
                    'success'
                );
                Logger.success('Clipboard copy successful', {
                    records: Array.isArray(data) ? data.length : 1,
                    size: content.length
                });
            }).catch(function (err) {
                throw err;
            });
        } catch (err) {
            Logger.error('Clipboard copy failed', err);
            ns.showToast(`Copy failed: ${err.message}`, 'error');
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
})();
