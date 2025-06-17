// ==UserScript==
// @name         ServiceNow Extractor - Excel Export Module
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Excel export functionality for ServiceNow Ticket Extractor
// @author       You
// @match        https://wfmprod.service-now.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Excel export object
    window.SNExtractorExcel = {
        // Export tickets to Excel
        exportToExcel: function(extractedTickets, selectedFields, selectedTables) {
            if (extractedTickets.length === 0) {
                if (window.SNExtractorUtils) {
                    window.SNExtractorUtils.updateStatus('❌ No tickets to export');
                }
                return;
            }

            if (window.SNExtractorUtils) {
                window.SNExtractorUtils.updateStatus('📊 Generating Excel file...');
            }

            try {
                // Create workbook
                const wb = XLSX.utils.book_new();

                // Group by table type if multiple tables
                if (selectedTables.length > 1) {
                    this.createMultiTableWorkbook(wb, extractedTickets, selectedFields, selectedTables);
                } else {
                    this.createSingleTableWorkbook(wb, extractedTickets, selectedFields);
                }

                // Generate filename with timestamp
                const filename = window.SNExtractorUtils ? 
                    window.SNExtractorUtils.generateFilename(selectedTables) :
                    this.generateDefaultFilename(selectedTables);

                // Save file
                XLSX.writeFile(wb, filename);

                if (window.SNExtractorUtils) {
                    window.SNExtractorUtils.updateStatus(`✅ Exported ${extractedTickets.length} tickets to ${filename}`);
                }

            } catch (error) {
                console.error('Export failed:', error);
                if (window.SNExtractorUtils) {
                    window.SNExtractorUtils.updateStatus(`❌ Export failed: ${error.message}`);
                }
            }
        },

        // Create workbook with multiple sheets for different tables
        createMultiTableWorkbook: function(wb, extractedTickets, selectedFields, selectedTables) {
            const groupedTickets = {};
            
            // Group tickets by table type
            extractedTickets.forEach(ticket => {
                const tableType = ticket._table_type || 'unknown';
                if (!groupedTickets[tableType]) {
                    groupedTickets[tableType] = [];
                }
                groupedTickets[tableType].push(ticket);
            });

            // Create separate sheet for each table
            Object.entries(groupedTickets).forEach(([tableType, tickets]) => {
                const exportData = this.prepareExportData(tickets, selectedFields);
                const ws = XLSX.utils.json_to_sheet(exportData);
                
                // Apply formatting
                this.formatWorksheet(ws, selectedFields, tickets);
                
                const tableName = window.SNExtractorConfig.AVAILABLE_TABLES[tableType]?.name || tableType;
                XLSX.utils.book_append_sheet(wb, ws, tableName);
            });
        },

        // Create workbook with single sheet
        createSingleTableWorkbook: function(wb, extractedTickets, selectedFields) {
            const exportData = this.prepareExportData(extractedTickets, selectedFields);
            const ws = XLSX.utils.json_to_sheet(exportData);

            // Apply formatting
            this.formatWorksheet(ws, selectedFields, extractedTickets);

            XLSX.utils.book_append_sheet(wb, ws, 'ServiceNow Tickets');
        },

        // Prepare data for export with proper headers
        prepareExportData: function(tickets, selectedFields) {
            return tickets.map(ticket => {
                const row = {};
                selectedFields.forEach(field => {
                    const header = window.SNExtractorConfig.AVAILABLE_FIELDS[field]?.name || field;
                    row[header] = this.formatCellValue(ticket[field], field);
                });
                return row;
            });
        },

        // Format cell value based on field type
        formatCellValue: function(value, field) {
            if (!value) return '';

            // Handle different field types
            switch (field) {
                case 'opened_at':
                case 'updated_at':
                case 'sys_created_on':
                    return this.formatDate(value);
                case 'priority':
                case 'urgency':
                case 'impact':
                case 'state':
                    return this.formatChoiceField(value, field);
                default:
                    return String(value).trim();
            }
        },

        // Format date values
        formatDate: function(dateValue) {
            if (!dateValue) return '';
            
            try {
                const date = new Date(dateValue);
                if (isNaN(date.getTime())) return dateValue;
                
                return date.toLocaleString();
            } catch (e) {
                return dateValue;
            }
        },

        // Format choice field values (add readable labels)
        formatChoiceField: function(value, field) {
            if (!value) return '';
            
            const fieldConfig = window.SNExtractorConfig.FILTER_OPTIONS[field];
            if (fieldConfig && fieldConfig.values && fieldConfig.values[value]) {
                return `${value} - ${fieldConfig.values[value]}`;
            }
            
            return value;
        },

        // Format worksheet with auto-sizing and styling
        formatWorksheet: function(ws, selectedFields, tickets) {
            // Auto-size columns
            const colWidths = selectedFields.map(field => {
                const header = window.SNExtractorConfig.AVAILABLE_FIELDS[field]?.name || field;
                const maxLength = Math.max(
                    header.length,
                    ...tickets.map(ticket => {
                        const value = this.formatCellValue(ticket[field], field);
                        return String(value || '').length;
                    })
                );
                return { wch: Math.min(maxLength + 2, 50) };
            });
            ws['!cols'] = colWidths;

            // Add header styling if supported
            if (ws['!ref']) {
                const range = XLSX.utils.decode_range(ws['!ref']);
                
                // Style header row
                for (let col = range.s.c; col <= range.e.c; col++) {
                    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
                    if (ws[cellAddress]) {
                        ws[cellAddress].s = {
                            font: { bold: true },
                            fill: { fgColor: { rgb: "CCCCCC" } }
                        };
                    }
                }
            }
        },

        // Generate default filename if utils not available
        generateDefaultFilename: function(selectedTables) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const tableNames = selectedTables.map(t => 
                window.SNExtractorConfig.AVAILABLE_TABLES[t]?.name || t
            ).join('-');
            return `servicenow-${tableNames}-${timestamp}.xlsx`;
        },

        // Export filtered data
        exportFilteredData: function(extractedTickets, selectedFields, selectedTables, filterCriteria) {
            const filteredTickets = this.applyClientSideFilters(extractedTickets, filterCriteria);
            this.exportToExcel(filteredTickets, selectedFields, selectedTables);
        },

        // Apply client-side filters for export
        applyClientSideFilters: function(tickets, filterCriteria) {
            if (!filterCriteria || filterCriteria.length === 0) {
                return tickets;
            }

            return tickets.filter(ticket => {
                return filterCriteria.every(filter => {
                    const fieldValue = String(ticket[filter.field] || '').toLowerCase();
                    const filterValue = String(filter.value || '').toLowerCase();

                    switch (filter.operator) {
                        case 'CONTAINS':
                            return fieldValue.includes(filterValue);
                        case '=':
                            return fieldValue === filterValue;
                        case '!=':
                            return fieldValue !== filterValue;
                        case 'STARTSWITH':
                            return fieldValue.startsWith(filterValue);
                        case '>':
                            return fieldValue > filterValue;
                        case '<':
                            return fieldValue < filterValue;
                        case '>=':
                            return fieldValue >= filterValue;
                        case '<=':
                            return fieldValue <= filterValue;
                        default:
                            return true;
                    }
                });
            });
        },

        // Export summary statistics
        exportWithSummary: function(extractedTickets, selectedFields, selectedTables) {
            if (extractedTickets.length === 0) return;

            try {
                const wb = XLSX.utils.book_new();

                // Create main data sheet
                if (selectedTables.length > 1) {
                    this.createMultiTableWorkbook(wb, extractedTickets, selectedFields, selectedTables);
                } else {
                    this.createSingleTableWorkbook(wb, extractedTickets, selectedFields);
                }

                // Create summary sheet
                const summaryData = this.generateSummaryData(extractedTickets, selectedFields);
                const summaryWs = XLSX.utils.json_to_sheet(summaryData);
                XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

                // Generate filename
                const filename = window.SNExtractorUtils ? 
                    window.SNExtractorUtils.generateFilename(selectedTables, 'servicenow-summary') :
                    this.generateDefaultFilename(selectedTables).replace('servicenow-', 'servicenow-summary-');

                XLSX.writeFile(wb, filename);

                if (window.SNExtractorUtils) {
                    window.SNExtractorUtils.updateStatus(`✅ Exported ${extractedTickets.length} tickets with summary to ${filename}`);
                }

            } catch (error) {
                console.error('Summary export failed:', error);
                if (window.SNExtractorUtils) {
                    window.SNExtractorUtils.updateStatus(`❌ Summary export failed: ${error.message}`);
                }
            }
        },

        // Generate summary statistics
        generateSummaryData: function(tickets, selectedFields) {
            const summary = [
                { Metric: 'Total Tickets', Value: tickets.length },
                { Metric: 'Export Date', Value: new Date().toLocaleString() }
            ];

            // Count by state
            if (selectedFields.includes('state')) {
                const stateCounts = {};
                tickets.forEach(ticket => {
                    const state = ticket.state || 'Unknown';
                    stateCounts[state] = (stateCounts[state] || 0) + 1;
                });

                Object.entries(stateCounts).forEach(([state, count]) => {
                    summary.push({ Metric: `State: ${state}`, Value: count });
                });
            }

            // Count by priority
            if (selectedFields.includes('priority')) {
                const priorityCounts = {};
                tickets.forEach(ticket => {
                    const priority = ticket.priority || 'Unknown';
                    priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
                });

                Object.entries(priorityCounts).forEach(([priority, count]) => {
                    summary.push({ Metric: `Priority: ${priority}`, Value: count });
                });
            }

            // Count by table type
            const tableCounts = {};
            tickets.forEach(ticket => {
                const tableType = ticket._table_type || 'Unknown';
                tableCounts[tableType] = (tableCounts[tableType] || 0) + 1;
            });

            Object.entries(tableCounts).forEach(([table, count]) => {
                const tableName = window.SNExtractorConfig.AVAILABLE_TABLES[table]?.name || table;
                summary.push({ Metric: `Table: ${tableName}`, Value: count });
            });

            return summary;
        }
    };

})();