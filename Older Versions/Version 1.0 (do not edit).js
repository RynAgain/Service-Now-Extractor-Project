// ==UserScript==
// @name         ServiceNow Ticket Data Extractor V1
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Extract ServiceNow ticket metadata to Excel
// @author       You
// @match        https://wfmprod.service-now.com/*
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        // Adjust these based on your ServiceNow instance
        BASE_URL: window.location.origin,
        TABLE_NAME: 'incident', // or 'sc_request', 'sc_task', etc.
        FIELDS: [
            'number',
            'short_description',
            'description',
            'state',
            'priority',
            'urgency',
            'category',
            'subcategory',
            'assigned_to',
            'assignment_group',
            'opened_at',
            'updated_at',
            'sys_created_on',
            'caller_id',
            'sys_id'
        ]
    };

    // Ticket data storage
    let extractedTickets = [];

    // Create UI elements
    function createUI() {
        const container = document.createElement('div');
        container.id = 'ticket-extractor-ui';
        container.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #fff;
            border: 2px solid #0073e7;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            z-index: 10000;
            min-width: 300px;
            font-family: Arial, sans-serif;
        `;

        container.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #0073e7;">Ticket Extractor</h3>
            <div style="margin-bottom: 10px;">
                <label>Query Filter:</label>
                <input type="text" id="query-filter" placeholder="e.g., assigned_to=javascript:gs.getUserID()"
                       style="width: 100%; padding: 5px; margin-top: 5px;">
            </div>
            <div style="margin-bottom: 10px;">
                <label>Max Records:</label>
                <input type="number" id="max-records" value="100" min="1" max="1000"
                       style="width: 100%; padding: 5px; margin-top: 5px;">
            </div>
            <button id="extract-current" style="width: 100%; padding: 8px; margin: 5px 0; background: #0073e7; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Extract Current Page Tickets
            </button>
            <button id="extract-query" style="width: 100%; padding: 8px; margin: 5px 0; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Extract by Query
            </button>
            <button id="export-excel" style="width: 100%; padding: 8px; margin: 5px 0; background: #ffc107; color: black; border: none; border-radius: 4px; cursor: pointer;" disabled>
                Export to Excel (0 tickets)
            </button>
            <button id="clear-data" style="width: 100%; padding: 8px; margin: 5px 0; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Clear Data
            </button>
            <div id="status" style="margin-top: 10px; font-size: 12px; color: #666;"></div>
        `;

        document.body.appendChild(container);
        bindEvents();
    }

    // Bind event listeners
    function bindEvents() {
        document.getElementById('extract-current').addEventListener('click', extractCurrentPageTickets);
        document.getElementById('extract-query').addEventListener('click', extractByQuery);
        document.getElementById('export-excel').addEventListener('click', exportToExcel);
        document.getElementById('clear-data').addEventListener('click', clearData);
    }

    // Extract tickets from current page (list view)
    function extractCurrentPageTickets() {
        updateStatus('Extracting tickets from current page...');

        // Method 1: Try to extract from list view
        const listRows = document.querySelectorAll('tr[data-list_id]');

        if (listRows.length > 0) {
            extractFromListView(listRows);
        } else {
            // Method 2: Try to extract from form view
            extractFromFormView();
        }
    }

    // Extract from ServiceNow list view
    function extractFromListView(rows) {
        const tickets = [];

        rows.forEach(row => {
            const ticket = {};
            const cells = row.querySelectorAll('td');

            // Extract sys_id from row attributes
            ticket.sys_id = row.getAttribute('sys_id') || '';

            // Extract visible data from cells
            cells.forEach(cell => {
                const fieldName = cell.getAttribute('name') || cell.getAttribute('data-field');
                if (fieldName && CONFIG.FIELDS.includes(fieldName)) {
                    ticket[fieldName] = cell.textContent.trim();
                }
            });

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

    // Extract tickets using ServiceNow API
    async function extractByQuery() {
        const query = document.getElementById('query-filter').value;
        const maxRecords = document.getElementById('max-records').value;

        updateStatus('Extracting tickets via API...');

        try {
            const url = `${CONFIG.BASE_URL}/api/now/table/${CONFIG.TABLE_NAME}` +
                       `?sysparm_query=${encodeURIComponent(query)}` +
                       `&sysparm_fields=${CONFIG.FIELDS.join(',')}` +
                       `&sysparm_limit=${maxRecords}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-UserToken': getSessionToken() // If required
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            addTicketsToCollection(data.result);
            updateStatus(`Extracted ${data.result.length} tickets via API`);

        } catch (error) {
            console.error('API extraction failed:', error);
            updateStatus(`API extraction failed: ${error.message}`);
        }
    }

    // Get session token (if needed for API calls)
    function getSessionToken() {
        // ServiceNow often uses g_ck for session token
        return window.g_ck || '';
    }

    // Add tickets to collection (avoiding duplicates)
    function addTicketsToCollection(tickets) {
        const existingIds = new Set(extractedTickets.map(t => t.sys_id));

        tickets.forEach(ticket => {
            if (!existingIds.has(ticket.sys_id)) {
                // Clean and format the ticket data
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

            // Handle different field types
            if (typeof value === 'object' && value.display_value) {
                value = value.display_value;
            } else if (typeof value === 'object' && value.value) {
                value = value.value;
            }

            // Clean up common ServiceNow formatting
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
            // Create workbook and worksheet
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(extractedTickets);

            // Auto-size columns
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

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, 'ServiceNow Tickets');

            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `servicenow-tickets-${timestamp}.xlsx`;

            // Save file
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
        updateStatus('Data cleared');
    }

    // Update export button state
    function updateExportButton() {
        const button = document.getElementById('export-excel');
        button.textContent = `Export to Excel (${extractedTickets.length} tickets)`;
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
        // Wait for page to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createUI);
        } else {
            createUI();
        }
    }

    // Start the script
    init();

})();