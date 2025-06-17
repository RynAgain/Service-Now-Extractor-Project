// ==UserScript==
// @name         ServiceNow Extractor - Events Module
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Event handlers and user interactions for ServiceNow Ticket Extractor
// @author       You
// @match        https://wfmprod.service-now.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Events management object
    window.SNExtractorEvents = {
        // State variables
        isMinimized: false,
        isDragging: false,
        dragOffset: { x: 0, y: 0 },

        // Bind all event listeners
        bindEvents: function() {
            // Window controls
            this.bindElement('close-btn', 'click', this.closeExtractor);
            this.bindElement('minimize-btn', 'click', this.toggleMinimize.bind(this));
            this.bindElement('settings-btn', 'click', this.openSettings);

            // Settings modal
            this.bindElement('settings-close', 'click', this.closeSettings);
            this.bindElement('theme-select', 'change', this.changeTheme);
            this.bindElement('settings-modal', 'click', (e) => {
                if (e.target.id === 'settings-modal') this.closeSettings();
            });

            // Dragging functionality
            const header = document.getElementById('extractor-header');
            if (header) {
                header.addEventListener('mousedown', this.startDrag.bind(this));
                document.addEventListener('mousemove', this.drag.bind(this));
                document.addEventListener('mouseup', this.stopDrag.bind(this));
            }

            // Tabs
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
            });

            // Filter management
            this.bindElement('add-filter', 'click', this.addFilter);

            // Field selection
            this.bindElement('select-all-fields', 'click', this.selectAllFields);
            this.bindElement('clear-all-fields', 'click', this.clearAllFields);

            // Action buttons
            this.bindElement('extract-current', 'click', this.extractCurrentPageTickets);
            this.bindElement('extract-query', 'click', this.extractByQuery);
            this.bindElement('export-excel', 'click', this.exportToExcel);
            this.bindElement('clear-data', 'click', this.clearData);
        },

        // Helper to safely bind events
        bindElement: function(id, event, handler) {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
            }
        },

        // Setup global functions for inline event handlers
        setupGlobalFunctions: function() {
            // Filter management functions
            window.SNExtractor_updateFilter = (filterId, property, value) => {
                if (window.SNExtractorMain && window.SNExtractorMain.updateFilter) {
                    window.SNExtractorMain.updateFilter(filterId, property, value);
                }
            };

            window.SNExtractor_updateDateFilter = (filterId) => {
                if (window.SNExtractorMain && window.SNExtractorMain.updateDateFilter) {
                    window.SNExtractorMain.updateDateFilter(filterId);
                }
            };

            window.SNExtractor_removeFilter = (filterId) => {
                if (window.SNExtractorMain && window.SNExtractorMain.removeFilter) {
                    window.SNExtractorMain.removeFilter(filterId);
                }
            };

            window.SNExtractor_addQuickFilter = (field, operator, value) => {
                if (window.SNExtractorMain && window.SNExtractorMain.addQuickFilter) {
                    window.SNExtractorMain.addQuickFilter(field, operator, value);
                }
            };

            // Table management functions
            window.SNExtractor_toggleTable = (tableKey) => {
                if (window.SNExtractorMain && window.SNExtractorMain.toggleTable) {
                    window.SNExtractorMain.toggleTable(tableKey);
                }
            };

            // Field management functions
            window.SNExtractor_toggleField = (fieldKey) => {
                if (window.SNExtractorMain && window.SNExtractorMain.toggleField) {
                    window.SNExtractorMain.toggleField(fieldKey);
                }
            };
        },

        // Window control functions
        closeExtractor: function() {
            const container = document.getElementById('ticket-extractor-ui');
            if (container) container.remove();
            window.ticketExtractorInstance = false;
        },

        toggleMinimize: function() {
            const content = document.getElementById('extractor-content');
            const button = document.getElementById('minimize-btn');

            if (this.isMinimized) {
                content.style.display = 'block';
                button.textContent = '−';
                button.title = 'Minimize';
            } else {
                content.style.display = 'none';
                button.textContent = '+';
                button.title = 'Expand';
            }
            this.isMinimized = !this.isMinimized;
        },

        // Settings functions
        openSettings: function() {
            const modal = document.getElementById('settings-modal');
            if (modal) modal.style.display = 'block';
        },

        closeSettings: function() {
            const modal = document.getElementById('settings-modal');
            if (modal) modal.style.display = 'none';
        },

        changeTheme: function() {
            const themeSelect = document.getElementById('theme-select');
            if (themeSelect && window.SNExtractorMain && window.SNExtractorMain.changeTheme) {
                window.SNExtractorMain.changeTheme(themeSelect.value);
            }
        },

        // Dragging functionality
        startDrag: function(e) {
            if (e.target.tagName === 'BUTTON') return;

            this.isDragging = true;
            const container = document.getElementById('ticket-extractor-ui');
            if (container) {
                const rect = container.getBoundingClientRect();
                this.dragOffset.x = e.clientX - rect.left;
                this.dragOffset.y = e.clientY - rect.top;
            }
            e.preventDefault();
        },

        drag: function(e) {
            if (!this.isDragging) return;

            const container = document.getElementById('ticket-extractor-ui');
            if (!container) return;

            const newX = e.clientX - this.dragOffset.x;
            const newY = e.clientY - this.dragOffset.y;

            const maxX = window.innerWidth - container.offsetWidth;
            const maxY = window.innerHeight - container.offsetHeight;

            container.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
            container.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';
            container.style.right = 'auto';
        },

        stopDrag: function() {
            this.isDragging = false;
        },

        // Tab switching
        switchTab: function(tabName) {
            if (window.SNExtractorUI && window.SNExtractorMain) {
                window.SNExtractorUI.switchTab(tabName, window.SNExtractorMain.getCurrentTheme());
            }
        },

        // Filter management
        addFilter: function() {
            if (window.SNExtractorMain && window.SNExtractorMain.addFilter) {
                window.SNExtractorMain.addFilter();
            }
        },

        // Field selection
        selectAllFields: function() {
            if (window.SNExtractorMain && window.SNExtractorMain.selectAllFields) {
                window.SNExtractorMain.selectAllFields();
            }
        },

        clearAllFields: function() {
            if (window.SNExtractorMain && window.SNExtractorMain.clearAllFields) {
                window.SNExtractorMain.clearAllFields();
            }
        },

        // Action buttons
        extractCurrentPageTickets: function() {
            if (window.SNExtractorMain && window.SNExtractorMain.extractCurrentPageTickets) {
                window.SNExtractorMain.extractCurrentPageTickets();
            }
        },

        extractByQuery: function() {
            if (window.SNExtractorMain && window.SNExtractorMain.extractByQuery) {
                window.SNExtractorMain.extractByQuery();
            }
        },

        exportToExcel: function() {
            if (window.SNExtractorMain && window.SNExtractorMain.exportToExcel) {
                window.SNExtractorMain.exportToExcel();
            }
        },

        clearData: function() {
            if (window.SNExtractorMain && window.SNExtractorMain.clearData) {
                window.SNExtractorMain.clearData();
            }
        },

        // Keyboard shortcuts
        setupKeyboardShortcuts: function() {
            document.addEventListener('keydown', (e) => {
                // Only handle shortcuts when the extractor is visible
                const container = document.getElementById('ticket-extractor-ui');
                if (!container) return;

                // Ctrl/Cmd + E: Extract current page
                if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                    e.preventDefault();
                    this.extractCurrentPageTickets();
                }

                // Ctrl/Cmd + Q: Extract by query
                if ((e.ctrlKey || e.metaKey) && e.key === 'q') {
                    e.preventDefault();
                    this.extractByQuery();
                }

                // Ctrl/Cmd + S: Export to Excel
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    this.exportToExcel();
                }

                // Escape: Close settings modal or minimize
                if (e.key === 'Escape') {
                    const modal = document.getElementById('settings-modal');
                    if (modal && modal.style.display === 'block') {
                        this.closeSettings();
                    } else {
                        this.toggleMinimize();
                    }
                }

                // F1: Open settings
                if (e.key === 'F1') {
                    e.preventDefault();
                    this.openSettings();
                }
            });
        },

        // Context menu for additional options
        setupContextMenu: function() {
            const container = document.getElementById('ticket-extractor-ui');
            if (!container) return;

            container.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                
                // Create context menu
                const menu = document.createElement('div');
                menu.style.cssText = `
                    position: fixed;
                    top: ${e.clientY}px;
                    left: ${e.clientX}px;
                    background: white;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                    z-index: 10002;
                    min-width: 150px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 12px;
                `;

                const menuItems = [
                    { text: 'Extract Current Page', action: () => this.extractCurrentPageTickets() },
                    { text: 'Extract by Query', action: () => this.extractByQuery() },
                    { text: 'Export to Excel', action: () => this.exportToExcel() },
                    { text: '---', action: null },
                    { text: 'Settings', action: () => this.openSettings() },
                    { text: 'Clear Data', action: () => this.clearData() },
                    { text: '---', action: null },
                    { text: 'Close Extractor', action: () => this.closeExtractor() }
                ];

                menuItems.forEach(item => {
                    if (item.text === '---') {
                        const separator = document.createElement('div');
                        separator.style.cssText = 'height: 1px; background: #eee; margin: 4px 0;';
                        menu.appendChild(separator);
                    } else {
                        const menuItem = document.createElement('div');
                        menuItem.textContent = item.text;
                        menuItem.style.cssText = `
                            padding: 8px 12px;
                            cursor: pointer;
                            transition: background-color 0.2s;
                        `;
                        
                        menuItem.addEventListener('mouseenter', () => {
                            menuItem.style.backgroundColor = '#f0f0f0';
                        });
                        
                        menuItem.addEventListener('mouseleave', () => {
                            menuItem.style.backgroundColor = 'transparent';
                        });
                        
                        menuItem.addEventListener('click', () => {
                            if (item.action) item.action();
                            document.body.removeChild(menu);
                        });
                        
                        menu.appendChild(menuItem);
                    }
                });

                document.body.appendChild(menu);

                // Remove menu when clicking elsewhere
                const removeMenu = (event) => {
                    if (!menu.contains(event.target)) {
                        document.body.removeChild(menu);
                        document.removeEventListener('click', removeMenu);
                    }
                };
                
                setTimeout(() => {
                    document.addEventListener('click', removeMenu);
                }, 100);
            });
        },

        // Cleanup event listeners
        cleanup: function() {
            // Remove global functions
            if (window.SNExtractor_updateFilter) delete window.SNExtractor_updateFilter;
            if (window.SNExtractor_updateDateFilter) delete window.SNExtractor_updateDateFilter;
            if (window.SNExtractor_removeFilter) delete window.SNExtractor_removeFilter;
            if (window.SNExtractor_addQuickFilter) delete window.SNExtractor_addQuickFilter;
            if (window.SNExtractor_toggleTable) delete window.SNExtractor_toggleTable;
            if (window.SNExtractor_toggleField) delete window.SNExtractor_toggleField;

            // Reset state
            this.isMinimized = false;
            this.isDragging = false;
            this.dragOffset = { x: 0, y: 0 };
        }
    };

})();