// ==UserScript==
// @name         ServiceNow Ticket Data Extractor v4.0 (Modular)
// @namespace    http://tampermonkey.net/
// @version      4.1.003
// @description  Extract ServiceNow ticket metadata to Excel - Modular Version
// @author       Ryan Satterfield
// @match        https://wfmprod.service-now.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// @require      https://raw.githubusercontent.com/RynAgain/Service-Now-Extractor-Project/refs/heads/main/modules/config.js
// @require      https://raw.githubusercontent.com/RynAgain/Service-Now-Extractor-Project/refs/heads/main/modules/storage.js
// @require      https://raw.githubusercontent.com/RynAgain/Service-Now-Extractor-Project/refs/heads/main/modules/utils.js
// @require      https://raw.githubusercontent.com/RynAgain/Service-Now-Extractor-Project/refs/heads/main/modules/api.js
// @require      https://raw.githubusercontent.com/RynAgain/Service-Now-Extractor-Project/refs/heads/main/modules/extractor.js
// @require      https://raw.githubusercontent.com/RynAgain/Service-Now-Extractor-Project/refs/heads/main/modules/excel.js
// @require      https://raw.githubusercontent.com/RynAgain/Service-Now-Extractor-Project/refs/heads/main/modules/ui.js
// @require      https://raw.githubusercontent.com/RynAgain/Service-Now-Extractor-Project/refs/heads/main/modules/events.js
// @require      https://raw.githubusercontent.com/RynAgain/Service-Now-Extractor-Project/refs/heads/main/test-api.js


// @updateURL    https://raw.githubusercontent.com/RynAgain/Service-Now-Extractor-Project/refs/heads/main/main.js
// @downloadURL  https://raw.githubusercontent.com/RynAgain/Service-Now-Extractor-Project/refs/heads/main/main.js
// ==/UserScript==

(function() {
    'use strict';

    // Prevent multiple instances
    if (window.ticketExtractorInstance) {
        console.log('ServiceNow Extractor: Instance already exists');
        return;
    }
    window.ticketExtractorInstance = true;

    // Main application object
    window.SNExtractorMain = {
        // Application state
        extractedTickets: [],
        selectedFields: [],
        selectedTables: ['incident'],
        filters: [],
        currentTheme: 'wholefoodsGreen',

        // Initialize the application
        init: function() {
            try {
                this.loadSettings();
                
                // Wait for DOM to be ready
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => {
                        setTimeout(() => this.createUI(), 1000); // Delay to avoid conflicts
                    });
                } else {
                    setTimeout(() => this.createUI(), 1000);
                }
            } catch (error) {
                console.error('ServiceNow Extractor initialization failed:', error);
            }
        },

        // Load settings from storage
        loadSettings: function() {
            if (window.SNExtractorStorage) {
                const settings = window.SNExtractorStorage.loadSettings();
                this.selectedFields = settings.selectedFields;
                this.selectedTables = settings.selectedTables;
                this.filters = settings.filters;
                this.currentTheme = settings.currentTheme;
            }
        },

        // Save settings to storage
        saveSettings: function() {
            if (window.SNExtractorStorage) {
                window.SNExtractorStorage.saveSettings({
                    selectedFields: this.selectedFields,
                    selectedTables: this.selectedTables,
                    filters: this.filters,
                    currentTheme: this.currentTheme
                });
            }
        },

        // Create and initialize UI
        createUI: function() {
            if (window.SNExtractorUI) {
                window.SNExtractorUI.createUI(this.currentTheme, this.extractedTickets);
                this.updateAllLists();
                this.bindEvents();
            }
        },

        // Bind all event handlers
        bindEvents: function() {
            if (window.SNExtractorEvents) {
                window.SNExtractorEvents.setupGlobalFunctions();
                window.SNExtractorEvents.bindEvents();
                window.SNExtractorEvents.setupKeyboardShortcuts();
                window.SNExtractorEvents.setupContextMenu();
            }
        },

        // Update all UI lists
        updateAllLists: function() {
            if (window.SNExtractorUI) {
                window.SNExtractorUI.updateFieldsList(this.selectedFields);
                window.SNExtractorUI.updateTablesList(this.selectedTables);
                window.SNExtractorUI.updateFiltersList(this.filters);
                window.SNExtractorUI.updateExportButton(this.extractedTickets.length);
            }
        },

        // Get current theme
        getCurrentTheme: function() {
            return this.currentTheme;
        },

        // Change theme
        changeTheme: function(newTheme) {
            this.currentTheme = newTheme;
            this.saveSettings();
            this.createUI();
        },

        // Filter management functions
        updateFilter: function(filterId, property, value) {
            const filter = this.filters.find(f => f.id === filterId);
            if (filter) {
                filter[property] = value;
                this.saveSettings();
            }
        },

        updateDateFilter: function(filterId) {
            const filter = this.filters.find(f => f.id === filterId);
            if (filter && filter.dateStart) {
                if (filter.dateEnd) {
                    filter.value = `javascript:gs.dateGenerate('${filter.dateStart}','00:00:00')^${filter.field}<=javascript:gs.dateGenerate('${filter.dateEnd}','23:59:59')`;
                    filter.operator = '>=';
                } else {
                    filter.value = `javascript:gs.dateGenerate('${filter.dateStart}','00:00:00')`;
                    filter.operator = '>=';
                }
                this.saveSettings();
            }
        },

        removeFilter: function(filterId) {
            this.filters = this.filters.filter(f => f.id !== filterId);
            if (window.SNExtractorUI) {
                window.SNExtractorUI.updateFiltersList(this.filters);
            }
            this.saveSettings();
        },

        addQuickFilter: function(field, operator, value) {
            const filterId = window.SNExtractorUtils ? 
                window.SNExtractorUtils.generateFilterId() : 
                'filter-' + Date.now();
            
            this.filters.push({ 
                id: filterId, 
                field, 
                operator, 
                value, 
                dateStart: '', 
                dateEnd: '' 
            });
            
            if (window.SNExtractorUI) {
                window.SNExtractorUI.updateFiltersList(this.filters);
            }
            this.saveSettings();
        },

        addFilter: function() {
            const filterId = window.SNExtractorUtils ? 
                window.SNExtractorUtils.generateFilterId() : 
                'filter-' + Date.now();
            
            this.filters.push({
                id: filterId,
                field: '',
                value: '',
                operator: 'CONTAINS',
                dateStart: '',
                dateEnd: ''
            });
            
            if (window.SNExtractorUI) {
                window.SNExtractorUI.updateFiltersList(this.filters);
            }
            this.saveSettings();
        },

        // Table management functions
        toggleTable: function(tableKey) {
            if (this.selectedTables.includes(tableKey)) {
                this.selectedTables = this.selectedTables.filter(t => t !== tableKey);
            } else {
                this.selectedTables.push(tableKey);
            }
            this.saveSettings();
        },

        // Field management functions
        toggleField: function(fieldKey) {
            if (this.selectedFields.includes(fieldKey)) {
                this.selectedFields = this.selectedFields.filter(f => f !== fieldKey);
            } else {
                this.selectedFields.push(fieldKey);
            }
            this.saveSettings();
        },

        selectAllFields: function() {
            if (window.SNExtractorConfig) {
                this.selectedFields = Object.keys(window.SNExtractorConfig.AVAILABLE_FIELDS);
                if (window.SNExtractorUI) {
                    window.SNExtractorUI.updateFieldsList(this.selectedFields);
                }
                this.saveSettings();
            }
        },

        clearAllFields: function() {
            this.selectedFields = [];
            if (window.SNExtractorUI) {
                window.SNExtractorUI.updateFieldsList(this.selectedFields);
            }
            this.saveSettings();
        },

        // API connection test with detailed cookie analysis
        testConnection: async function() {
            if (window.SNExtractorAPI && window.SNExtractorUtils) {
                window.SNExtractorUtils.updateStatus('🔗 Testing API connection and session cookies...');
                const result = await window.SNExtractorAPI.testConnection();
                
                if (result.success) {
                    window.SNExtractorUtils.updateStatus(`✅ ${result.message}`);
                    console.log('API Test Success Details:', result);
                } else {
                    window.SNExtractorUtils.updateStatus(`❌ ${result.message}`);
                    console.error('API Test Failure Details:', result);
                    
                    // Show detailed cookie information in case of failure
                    if (result.cookies) {
                        const missingCookies = Object.entries(result.cookies)
                            .filter(([name, value]) => !value)
                            .map(([name]) => name);
                        
                        if (missingCookies.length > 0) {
                            window.SNExtractorUtils.updateStatus(`❌ Missing cookies: ${missingCookies.join(', ')}`);
                        }
                    }
                }
            }
        },

        // Data extraction functions
        extractByQuery: async function() {
            if (window.SNExtractorAPI) {
                const maxRecords = document.getElementById('max-records')?.value || 100;
                const tickets = await window.SNExtractorAPI.extractByQuery(
                    this.selectedTables, 
                    this.filters, 
                    this.selectedFields, 
                    maxRecords
                );
                
                if (tickets.length > 0 && window.SNExtractorUtils) {
                    window.SNExtractorUtils.addTicketsToCollection(tickets, this.extractedTickets, this.selectedFields);
                }
            }
        },

        // Export functions
        exportToExcel: function() {
            if (window.SNExtractorExcel) {
                window.SNExtractorExcel.exportToExcel(
                    this.extractedTickets, 
                    this.selectedFields, 
                    this.selectedTables
                );
            }
        },

        exportWithSummary: function() {
            if (window.SNExtractorExcel) {
                window.SNExtractorExcel.exportWithSummary(
                    this.extractedTickets, 
                    this.selectedFields, 
                    this.selectedTables
                );
            }
        },

        // Data management functions
        clearData: function() {
            this.extractedTickets = [];
            if (window.SNExtractorUI) {
                window.SNExtractorUI.updateExportButton(0);
            }
            if (window.SNExtractorUtils) {
                window.SNExtractorUtils.updateStatus('🗑️ Data cleared');
            }
        },

        // Get available tables from API
        getAvailableTables: async function() {
            if (window.SNExtractorAPI && window.SNExtractorUtils) {
                window.SNExtractorUtils.updateStatus('🔍 Checking available tables...');
                
                const availableTables = [];
                for (const [tableKey, tableInfo] of Object.entries(window.SNExtractorConfig.AVAILABLE_TABLES)) {
                    try {
                        const result = await window.SNExtractorAPI.queryTableSimple(tableKey, '', ['sys_id'], 1);
                        if (result && result.result) {
                            availableTables.push(tableKey);
                        }
                    } catch (error) {
                        console.warn(`Table ${tableKey} not accessible:`, error.message);
                    }
                }
                
                window.SNExtractorUtils.updateStatus(`✅ Found ${availableTables.length} accessible tables`);
                return availableTables;
            }
            return [];
        },

        // Batch operations
        batchExtractFromMultipleTables: async function() {
            if (window.SNExtractorUtils) {
                window.SNExtractorUtils.updateStatus('🔄 Starting batch extraction...');
            }

            const maxRecords = Math.floor((document.getElementById('max-records')?.value || 100) / this.selectedTables.length);
            let totalExtracted = 0;

            for (const table of this.selectedTables) {
                try {
                    if (window.SNExtractorAPI) {
                        const tickets = await window.SNExtractorAPI.extractByQuery(
                            [table], 
                            this.filters, 
                            this.selectedFields, 
                            maxRecords
                        );
                        
                        if (tickets.length > 0 && window.SNExtractorUtils) {
                            const newCount = window.SNExtractorUtils.addTicketsToCollection(
                                tickets, 
                                this.extractedTickets, 
                                this.selectedFields
                            );
                            totalExtracted += newCount;
                        }
                    }
                } catch (error) {
                    console.error(`Batch extraction failed for ${table}:`, error);
                }
            }

            if (window.SNExtractorUtils) {
                window.SNExtractorUtils.updateStatus(`✅ Batch extraction complete: ${totalExtracted} new tickets`);
            }
        },

        // Data validation and cleanup
        validateAndCleanData: function() {
            const originalCount = this.extractedTickets.length;
            
            // Remove duplicates based on sys_id
            const uniqueTickets = [];
            const seenIds = new Set();
            
            this.extractedTickets.forEach(ticket => {
                if (ticket.sys_id && !seenIds.has(ticket.sys_id)) {
                    seenIds.add(ticket.sys_id);
                    uniqueTickets.push(ticket);
                }
            });
            
            this.extractedTickets = uniqueTickets;
            
            if (window.SNExtractorUtils) {
                const removedCount = originalCount - uniqueTickets.length;
                if (removedCount > 0) {
                    window.SNExtractorUtils.updateStatus(`🧹 Cleaned data: removed ${removedCount} duplicates`);
                }
                window.SNExtractorUI.updateExportButton(this.extractedTickets.length);
            }
        },

        // Get application statistics
        getStats: function() {
            return {
                totalTickets: this.extractedTickets.length,
                selectedFields: this.selectedFields.length,
                selectedTables: this.selectedTables.length,
                activeFilters: this.filters.filter(f => f.field && f.value).length,
                currentTheme: this.currentTheme,
                tableBreakdown: this.getTableBreakdown()
            };
        },

        getTableBreakdown: function() {
            const breakdown = {};
            this.extractedTickets.forEach(ticket => {
                const table = ticket._table_type || 'unknown';
                breakdown[table] = (breakdown[table] || 0) + 1;
            });
            return breakdown;
        }
    };

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        window.ticketExtractorInstance = false;
        if (window.SNExtractorEvents) {
            window.SNExtractorEvents.cleanup();
        }
    });

    // Initialize the application
    window.SNExtractorMain.init();

})();