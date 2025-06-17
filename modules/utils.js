// ==UserScript==
// @name         ServiceNow Extractor - Utils Module
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Utility functions for ServiceNow Ticket Extractor
// @author       You
// @match        https://wfmprod.service-now.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Utility functions object
    window.SNExtractorUtils = {
        // Get user info safely
        getUserInfo: function() {
            return {
                username: (window.g_user && window.g_user.userName) || 'Unknown',
                userID: (window.g_user && window.g_user.userID) || '',
                hasSession: !!window.g_ck
            };
        },

        // Detect current page type
        getCurrentPageType: function() {
            if (window.location.href.includes('_list.do')) {
                return 'List View';
            } else if (window.location.href.includes('.do')) {
                return 'Form View';
            } else {
                return 'Other';
            }
        },

        // Get current theme colors
        getThemeColors: function(currentTheme) {
            return window.SNExtractorConfig.THEMES[currentTheme] || window.SNExtractorConfig.THEMES.wholefoodsGreen;
        },

        // Update status message
        updateStatus: function(message) {
            const statusEl = document.getElementById('status');
            if (statusEl) {
                statusEl.textContent = message;
                console.log('ServiceNow Extractor:', message);
            }
        },

        // Clean and format ticket data
        cleanTicketData: function(ticket, selectedFields) {
            const clean = {};

            selectedFields.forEach(field => {
                let value = ticket[field] || '';

                // Handle ServiceNow object format
                if (typeof value === 'object' && value !== null) {
                    value = value.display_value || value.value || '';
                }

                // Clean up formatting
                if (typeof value === 'string') {
                    value = value.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                }

                clean[field] = value;
            });

            // Add table type if available
            if (ticket._table_type) {
                clean._table_type = ticket._table_type;
            }

            return clean;
        },

        // Add tickets to collection (avoiding duplicates)
        addTicketsToCollection: function(tickets, extractedTickets, selectedFields) {
            const existingIds = new Set(extractedTickets.map(t => t.sys_id));
            let newCount = 0;

            tickets.forEach(ticket => {
                if (!existingIds.has(ticket.sys_id)) {
                    const cleanTicket = this.cleanTicketData(ticket, selectedFields);
                    extractedTickets.push(cleanTicket);
                    existingIds.add(ticket.sys_id);
                    newCount++;
                }
            });

            if (window.SNExtractorUI && window.SNExtractorUI.updateExportButton) {
                window.SNExtractorUI.updateExportButton(extractedTickets.length);
            }

            if (newCount > 0) {
                this.updateStatus(`✅ Added ${newCount} new tickets (${extractedTickets.length} total)`);
            } else if (tickets.length > 0) {
                this.updateStatus(`ℹ️ All ${tickets.length} tickets were duplicates (${extractedTickets.length} total)`);
            }

            return newCount;
        },

        // Generate unique filter ID
        generateFilterId: function() {
            return 'filter-' + Date.now();
        },

        // Validate filter configuration
        validateFilter: function(filter) {
            return filter.field && filter.value && filter.operator;
        },

        // Format date for ServiceNow queries
        formatDateForQuery: function(dateStart, dateEnd) {
            if (dateEnd) {
                return `javascript:gs.dateGenerate('${dateStart}','00:00:00')^${filter.field}<=javascript:gs.dateGenerate('${dateEnd}','23:59:59')`;
            } else {
                return `javascript:gs.dateGenerate('${dateStart}','00:00:00')`;
            }
        },

        // Debounce function for performance
        debounce: function(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        // Safe element query with fallback
        safeQuerySelector: function(selector, fallback = null) {
            try {
                return document.querySelector(selector) || fallback;
            } catch (e) {
                console.warn(`Invalid selector: ${selector}`, e);
                return fallback;
            }
        },

        // Safe element query all with fallback
        safeQuerySelectorAll: function(selector, fallback = []) {
            try {
                return Array.from(document.querySelectorAll(selector));
            } catch (e) {
                console.warn(`Invalid selector: ${selector}`, e);
                return fallback;
            }
        },

        // Extract text content safely
        extractTextContent: function(element, attribute = null) {
            if (!element) return '';
            
            if (attribute) {
                return element.getAttribute(attribute) || '';
            }
            
            return element.textContent?.trim() || element.innerText?.trim() || '';
        },

        // Check if element is visible
        isElementVisible: function(element) {
            if (!element) return false;
            
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && 
                   style.visibility !== 'hidden' && 
                   style.opacity !== '0';
        },

        // Generate filename with timestamp
        generateFilename: function(selectedTables, prefix = 'servicenow') {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const tableNames = selectedTables.map(t => 
                window.SNExtractorConfig.AVAILABLE_TABLES[t]?.name || t
            ).join('-');
            return `${prefix}-${tableNames}-${timestamp}.xlsx`;
        },

        // Log with timestamp
        log: function(message, level = 'info') {
            const timestamp = new Date().toISOString();
            const logMessage = `[${timestamp}] ServiceNow Extractor: ${message}`;
            
            switch (level) {
                case 'error':
                    console.error(logMessage);
                    break;
                case 'warn':
                    console.warn(logMessage);
                    break;
                default:
                    console.log(logMessage);
            }
        },

        // Performance timing helper
        startTimer: function(name) {
            if (window.performance && window.performance.mark) {
                window.performance.mark(`${name}-start`);
            }
            return Date.now();
        },

        endTimer: function(name, startTime) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            if (window.performance && window.performance.mark && window.performance.measure) {
                window.performance.mark(`${name}-end`);
                window.performance.measure(name, `${name}-start`, `${name}-end`);
            }
            
            this.log(`${name} completed in ${duration}ms`);
            return duration;
        }
    };

})();