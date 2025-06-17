// ==UserScript==
// @name         ServiceNow Extractor - Data Extraction Module
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Data extraction logic for ServiceNow Ticket Extractor
// @author       You
// @match        https://wfmprod.service-now.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Data extraction object
    window.SNExtractorData = {
        // Extract tickets from current page - SAFE METHOD
        extractCurrentPageTickets: function(selectedFields, extractedTickets) {
            if (window.SNExtractorUtils) {
                window.SNExtractorUtils.updateStatus('📋 Extracting tickets from current page...');
            }

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
                    this.extractFromListView(rows, selectedFields, extractedTickets);
                    return;
                }

                // Method 3: Try form view
                const formData = this.extractFromFormView(selectedFields, extractedTickets);
                if (formData) {
                    return;
                }

                if (window.SNExtractorUtils) {
                    window.SNExtractorUtils.updateStatus('❌ No ticket data found on current page. Try navigating to a list view or ticket form.');
                }

            } catch (error) {
                console.error('Current page extraction failed:', error);
                if (window.SNExtractorUtils) {
                    window.SNExtractorUtils.updateStatus(`❌ Extraction failed: ${error.message}`);
                }
            }
        },

        // Extract from ServiceNow list view - SAFE METHOD
        extractFromListView: function(rows, selectedFields, extractedTickets) {
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
                if (window.SNExtractorUtils) {
                    window.SNExtractorUtils.addTicketsToCollection(tickets, extractedTickets, selectedFields);
                    window.SNExtractorUtils.updateStatus(`✅ Extracted ${tickets.length} tickets from list view`);
                }
            } else {
                if (window.SNExtractorUtils) {
                    window.SNExtractorUtils.updateStatus('⚠️ No ticket data could be extracted from visible rows');
                }
            }
        },

        // Extract from form view - SAFE METHOD
        extractFromFormView: function(selectedFields, extractedTickets) {
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
                    if (window.SNExtractorUtils) {
                        window.SNExtractorUtils.addTicketsToCollection([ticket], extractedTickets, selectedFields);
                        window.SNExtractorUtils.updateStatus(`✅ Extracted 1 ticket from form view`);
                    }
                    return true;
                }

                return false;

            } catch (error) {
                console.warn('Form extraction failed:', error);
                return false;
            }
        },

        // Enhanced list view extraction with better field detection
        extractFromEnhancedListView: function(selectedFields, extractedTickets) {
            const tickets = [];
            
            // Try to find the main table
            const tables = document.querySelectorAll('table.list_table, table[id*="list"], .list2_body table');
            
            for (const table of tables) {
                const headerRow = table.querySelector('thead tr, tr.list_header_row');
                const dataRows = table.querySelectorAll('tbody tr, tr.list_row');
                
                if (!headerRow || dataRows.length === 0) continue;
                
                // Map field names to column indices
                const fieldMap = this.buildFieldMap(headerRow, selectedFields);
                
                // Extract data from each row
                dataRows.forEach((row, index) => {
                    const ticket = this.extractRowData(row, fieldMap, selectedFields, index);
                    if (ticket && this.isValidTicket(ticket)) {
                        tickets.push(ticket);
                    }
                });
                
                if (tickets.length > 0) break; // Use first successful table
            }
            
            if (tickets.length > 0 && window.SNExtractorUtils) {
                window.SNExtractorUtils.addTicketsToCollection(tickets, extractedTickets, selectedFields);
                window.SNExtractorUtils.updateStatus(`✅ Enhanced extraction: ${tickets.length} tickets from list view`);
            }
            
            return tickets.length > 0;
        },

        // Build field mapping from header row
        buildFieldMap: function(headerRow, selectedFields) {
            const fieldMap = {};
            const headers = headerRow.querySelectorAll('th, td');
            
            headers.forEach((header, index) => {
                const headerText = header.textContent.trim().toLowerCase();
                const headerClass = header.className.toLowerCase();
                const headerName = header.getAttribute('name') || '';
                
                // Try to match with selected fields
                selectedFields.forEach(field => {
                    const fieldConfig = window.SNExtractorConfig.AVAILABLE_FIELDS[field];
                    if (!fieldConfig) return;
                    
                    const fieldName = fieldConfig.name.toLowerCase();
                    
                    // Match by text content, class, or name attribute
                    if (headerText.includes(fieldName) || 
                        headerClass.includes(field) || 
                        headerName === field ||
                        headerText === field) {
                        fieldMap[field] = index;
                    }
                });
            });
            
            return fieldMap;
        },

        // Extract data from a single row
        extractRowData: function(row, fieldMap, selectedFields, rowIndex) {
            const ticket = {};
            const cells = row.querySelectorAll('td');
            
            // Extract sys_id
            ticket.sys_id = row.getAttribute('sys_id') ||
                           row.getAttribute('data-sys-id') ||
                           `enhanced_row_${rowIndex}`;
            
            // Extract field data using field map
            selectedFields.forEach(field => {
                let value = '';
                
                if (fieldMap[field] !== undefined && cells[fieldMap[field]]) {
                    const cell = cells[fieldMap[field]];
                    value = this.extractCellValue(cell, field);
                } else {
                    // Fallback to original selectors
                    value = this.extractFieldFromRow(row, field);
                }
                
                ticket[field] = value;
            });
            
            return ticket;
        },

        // Extract value from a table cell
        extractCellValue: function(cell, field) {
            // Try different extraction methods
            const methods = [
                () => cell.querySelector('a')?.textContent?.trim(),
                () => cell.querySelector('span')?.textContent?.trim(),
                () => cell.textContent?.trim(),
                () => cell.getAttribute('title'),
                () => cell.getAttribute('data-value')
            ];
            
            for (const method of methods) {
                const value = method();
                if (value) return value;
            }
            
            return '';
        },

        // Extract field from row using original selectors
        extractFieldFromRow: function(row, field) {
            const selectors = [
                `td[name="${field}"]`,
                `td[data-field="${field}"]`,
                `.${field}`,
                `td[class*="${field}"]`,
                `[data-column="${field}"]`
            ];

            for (const selector of selectors) {
                const element = row.querySelector(selector);
                if (element) {
                    const value = element.textContent.trim() || element.getAttribute('title') || '';
                    if (value) return value;
                }
            }

            // Special handling for ticket numbers
            if (field === 'number') {
                const numberMatch = row.textContent.match(/(INC|REQ|CHG|PRB|TASK)\d{7,}/);
                if (numberMatch) return numberMatch[0];
            }

            return '';
        },

        // Validate if ticket has meaningful data
        isValidTicket: function(ticket) {
            const meaningfulFields = Object.values(ticket).filter(v => v && v !== '').length;
            return meaningfulFields > 1;
        }
    };

})();