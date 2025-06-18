// ==UserScript==
// @name         ServiceNow Extractor - UI Module
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  User interface creation and management for ServiceNow Ticket Extractor
// @author       You
// @match        https://wfmprod.service-now.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // UI management object
    window.SNExtractorUI = {
        // Create the main UI
        createUI: function(currentTheme, extractedTickets) {
            const existing = document.getElementById('ticket-extractor-ui');
            if (existing) {
                existing.remove();
            }

            const colors = window.SNExtractorUtils ? 
                window.SNExtractorUtils.getThemeColors(currentTheme) :
                window.SNExtractorConfig.THEMES[currentTheme] || window.SNExtractorConfig.THEMES.wholefoodsGreen;

            const container = document.createElement('div');
            container.id = 'ticket-extractor-ui';
            container.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: #fff;
                border: 2px solid ${colors.primary};
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                min-width: 400px;
                max-width: 500px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                user-select: none;
                max-height: 90vh;
                overflow: hidden;
            `;

            container.innerHTML = this.createUIHTML(currentTheme, extractedTickets);
            document.body.appendChild(container);

            return container;
        },

        // Create the HTML structure
        createUIHTML: function(currentTheme, extractedTickets) {
            const colors = window.SNExtractorUtils ? 
                window.SNExtractorUtils.getThemeColors(currentTheme) :
                window.SNExtractorConfig.THEMES[currentTheme] || window.SNExtractorConfig.THEMES.wholefoodsGreen;

            const userInfo = window.SNExtractorUtils ? 
                window.SNExtractorUtils.getUserInfo() : 
                { username: 'Unknown', userID: '', hasSession: false };

            const currentPageType = window.SNExtractorUtils ? 
                window.SNExtractorUtils.getCurrentPageType() : 
                'Unknown';

            return `
                <div id="extractor-header" style="
                    background: ${colors.primary};
                    color: white;
                    padding: 12px 15px;
                    border-radius: 6px 6px 0 0;
                    cursor: move;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <h3 style="margin: 0; font-size: 14px; font-weight: 600;">ServiceNow Ticket Extractor</h3>
                    <div>
                        <button id="settings-btn" style="
                            background: rgba(255,255,255,0.2);
                            border: none;
                            color: white;
                            cursor: pointer;
                            font-size: 14px;
                            margin-right: 8px;
                            padding: 4px 8px;
                            border-radius: 3px;
                        " title="Settings">⚙</button>
                        <button id="minimize-btn" style="
                            background: none;
                            border: none;
                            color: white;
                            cursor: pointer;
                            font-size: 16px;
                            margin-right: 5px;
                            padding: 2px 6px;
                        " title="Minimize">−</button>
                        <button id="close-btn" style="
                            background: none;
                            border: none;
                            color: white;
                            cursor: pointer;
                            font-size: 16px;
                            padding: 2px 6px;
                        " title="Close">×</button>
                    </div>
                </div>

                <div id="extractor-content" style="
                    padding: 15px;
                    max-height: calc(90vh - 60px);
                    overflow-y: auto;
                ">
                    <!-- Tabs -->
                    <div id="tabs" style="
                        display: flex;
                        border-bottom: 2px solid ${colors.light};
                        margin-bottom: 15px;
                    ">
                        <button class="tab-btn active" data-tab="extract" style="
                            flex: 1;
                            padding: 8px;
                            border: none;
                            background: ${colors.primary};
                            color: white;
                            cursor: pointer;
                            font-size: 12px;
                        ">Extract</button>
                        <button class="tab-btn" data-tab="filters" style="
                            flex: 1;
                            padding: 8px;
                            border: none;
                            background: ${colors.light};
                            color: ${colors.primary};
                            cursor: pointer;
                            font-size: 12px;
                        ">Filters</button>
                        <button class="tab-btn" data-tab="tables" style="
                            flex: 1;
                            padding: 8px;
                            border: none;
                            background: ${colors.light};
                            color: ${colors.primary};
                            cursor: pointer;
                            font-size: 12px;
                        ">Tables</button>
                        <button class="tab-btn" data-tab="fields" style="
                            flex: 1;
                            padding: 8px;
                            border: none;
                            background: ${colors.light};
                            color: ${colors.primary};
                            cursor: pointer;
                            font-size: 12px;
                        ">Fields</button>
                    </div>

                    <!-- Extract Tab -->
                    <div id="tab-extract" class="tab-content">
                        <div style="margin-bottom: 15px;">
                            <div style="background: ${colors.light}; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
                                <div style="font-size: 11px; color: #666;">
                                    <strong>User:</strong> ${userInfo.username}<br>
                                    <strong>Instance:</strong> ${window.location.hostname}<br>
                                    <strong>Mode:</strong> API-Only Extraction
                                </div>
                            </div>

                            <label style="font-size: 12px; color: #666;">Max Records per Table:</label>
                            <input type="number" id="max-records" value="100" min="1" max="1000"
                                   style="width: 100%; padding: 6px; margin-top: 4px; font-size: 12px; border: 1px solid #ddd; border-radius: 4px;">
                            <div style="font-size: 10px; color: #666; margin-top: 2px;">
                                Recommended: 100-500 records. Max 1000 per table.
                            </div>
                        </div>

                        <button id="test-connection" style="
                            width: 100%;
                            padding: 8px;
                            margin: 8px 0;
                            background: ${colors.accent};
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 12px;
                            font-weight: 500;
                        ">🔗 Test API Connection</button>

                        <button id="extract-query" style="
                            width: 100%;
                            padding: 12px;
                            margin: 8px 0;
                            background: ${colors.primary};
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 13px;
                            font-weight: 500;
                        ">🔍 Extract via API</button>

                        <div style="font-size: 10px; color: #666; margin: 4px 0 12px 0; text-align: center;">
                            Uses ServiceNow REST API with your selected filters and tables
                        </div>

                        <button id="get-available-tables" style="
                            width: 100%;
                            padding: 8px;
                            margin: 8px 0;
                            background: ${colors.secondary};
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 12px;
                            font-weight: 500;
                        ">📋 Check Available Tables</button>

                        <div style="font-size: 10px; color: #666; margin: 4px 0 12px 0; text-align: center;">
                            Verify which tables you have access to
                        </div>

                        <button id="export-excel" style="
                            width: 100%;
                            padding: 12px;
                            margin: 16px 0 8px 0;
                            background: #ffc107;
                            color: #000;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 13px;
                            font-weight: 500;
                        " disabled>📊 Export to Excel (${extractedTickets ? extractedTickets.length : 0} tickets)</button>

                        <button id="clear-data" style="
                            width: 100%;
                            padding: 8px;
                            margin: 8px 0;
                            background: #dc3545;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 12px;
                        ">🗑️ Clear Data</button>
                    </div>

                    <!-- Filters Tab -->
                    <div id="tab-filters" class="tab-content" style="display: none;">
                        <div style="margin-bottom: 15px;">
                            <div id="filters-container"></div>
                            <button id="add-filter" style="
                                width: 100%;
                                padding: 8px;
                                background: ${colors.secondary};
                                color: white;
                                border: none;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 12px;
                                margin-top: 8px;
                            ">+ Add Filter</button>
                            <div style="font-size: 10px; color: #666; margin-top: 5px; text-align: center;">
                                Filters only apply to API queries
                            </div>
                        </div>
                    </div>

                    <!-- Tables Tab -->
                    <div id="tab-tables" class="tab-content" style="display: none;">
                        <div style="margin-bottom: 15px;">
                            <h4 style="margin: 0 0 10px 0; font-size: 12px; color: #666; text-transform: uppercase;">Select Tables for API Query</h4>
                            <div id="tables-container"></div>
                            <div style="font-size: 10px; color: #666; margin-top: 8px;">
                                Multiple tables will create separate Excel sheets
                            </div>
                        </div>
                    </div>

                    <!-- Fields Tab -->
                    <div id="tab-fields" class="tab-content" style="display: none;">
                        <div style="margin-bottom: 15px;">
                            <h4 style="margin: 0 0 10px 0; font-size: 12px; color: #666; text-transform: uppercase;">Export Fields</h4>
                            <div id="fields-container" style="
                                max-height: 200px;
                                overflow-y: auto;
                                border: 1px solid #ddd;
                                padding: 8px;
                                border-radius: 4px;
                                background: #f9f9f9;
                            "></div>
                            <div style="margin-top: 8px;">
                                <button id="select-all-fields" style="
                                    font-size: 11px;
                                    padding: 4px 8px;
                                    margin-right: 5px;
                                    background: ${colors.accent};
                                    color: white;
                                    border: none;
                                    border-radius: 3px;
                                    cursor: pointer;
                                ">Select All</button>
                                <button id="clear-all-fields" style="
                                    font-size: 11px;
                                    padding: 4px 8px;
                                    background: #dc3545;
                                    color: white;
                                    border: none;
                                    border-radius: 3px;
                                    cursor: pointer;
                                ">Clear All</button>
                            </div>
                        </div>
                    </div>

                    <!-- Status -->
                    <div id="status" style="
                        margin-top: 15px;
                        font-size: 11px;
                        color: #666;
                        padding: 8px;
                        background: ${colors.light};
                        border-radius: 4px;
                        border-left: 3px solid ${colors.primary};
                        min-height: 16px;
                    ">Ready - ${extractedTickets ? extractedTickets.length : 0} tickets loaded</div>
                </div>

                <!-- Settings Modal -->
                <div id="settings-modal" style="
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    z-index: 10001;
                ">
                    <div style="
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        background: white;
                        padding: 20px;
                        border-radius: 8px;
                        width: 300px;
                    ">
                        <h3 style="margin: 0 0 15px 0;">Settings</h3>
                        <div style="margin-bottom: 15px;">
                            <label style="font-size: 12px; color: #666;">Theme:</label>
                            <select id="theme-select" style="width: 100%; padding: 6px; margin-top: 4px;">
                                ${Object.entries(window.SNExtractorConfig.THEMES).map(([key, theme]) =>
                                    `<option value="${key}" ${currentTheme === key ? 'selected' : ''}>${theme.name}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div style="text-align: right;">
                            <button id="settings-close" style="
                                padding: 8px 16px;
                                background: ${colors.primary};
                                color: white;
                                border: none;
                                border-radius: 4px;
                                cursor: pointer;
                            ">Close</button>
                        </div>
                    </div>
                </div>
            `;
        },

        // Update tables list
        updateTablesList: function(selectedTables) {
            const container = document.getElementById('tables-container');
            if (!container) return;

            container.innerHTML = Object.entries(window.SNExtractorConfig.AVAILABLE_TABLES).map(([key, table]) => `
                <div style="margin-bottom: 8px; padding: 8px; border: 1px solid #e0e0e0; border-radius: 4px;">
                    <label style="display: flex; align-items: flex-start; font-size: 12px; cursor: pointer;">
                        <input type="checkbox"
                               value="${key}"
                               ${selectedTables.includes(key) ? 'checked' : ''}
                               onchange="SNExtractor_toggleTable('${key}')"
                               style="margin-right: 8px; margin-top: 2px;">
                        <div>
                            <div style="font-weight: 500;">${table.name}</div>
                            <div style="color: #666; font-size: 11px; margin-top: 2px;">${table.description}</div>
                        </div>
                    </label>
                </div>
            `).join('');
        },

        // Update fields list
        updateFieldsList: function(selectedFields) {
            const container = document.getElementById('fields-container');
            if (!container) return;

            container.innerHTML = Object.entries(window.SNExtractorConfig.AVAILABLE_FIELDS).map(([key, config]) => `
                <div style="margin-bottom: 6px;">
                    <label style="display: flex; align-items: flex-start; font-size: 11px; cursor: pointer;">
                        <input type="checkbox"
                               value="${key}"
                               ${selectedFields.includes(key) ? 'checked' : ''}
                               onchange="SNExtractor_toggleField('${key}')"
                               style="margin-right: 8px; margin-top: 2px;">
                        <div>
                            <div style="font-weight: 500;">${config.name}</div>
                            <div style="color: #666; font-size: 10px; margin-top: 1px;">${config.description}</div>
                        </div>
                    </label>
                </div>
            `).join('');
        },

        // Update filters list
        updateFiltersList: function(filters) {
            const container = document.getElementById('filters-container');
            if (!container) return;

            if (filters.length === 0) {
                const colors = window.SNExtractorUtils ? 
                    window.SNExtractorUtils.getThemeColors(window.currentTheme || 'wholefoodsGreen') :
                    window.SNExtractorConfig.THEMES.wholefoodsGreen;

                container.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
                        <p>No filters set. Click "Add Filter" to get started.</p>
                        <div style="margin-top: 10px;">
                            <strong>Quick Start:</strong><br>
                            <button onclick="SNExtractor_addQuickFilter('assigned_to', '=', 'javascript:gs.getUserID()')"
                                    style="font-size: 10px; padding: 4px 8px; margin: 2px; background: ${colors.accent}; color: white; border: none; border-radius: 3px; cursor: pointer;">My Tickets</button>
                            <button onclick="SNExtractor_addQuickFilter('state', '!=', '6^state!=7')"
                                    style="font-size: 10px; padding: 4px 8px; margin: 2px; background: ${colors.accent}; color: white; border: none; border-radius: 3px; cursor: pointer;">Open Only</button>
                            <button onclick="SNExtractor_addQuickFilter('priority', '<=', '2')"
                                    style="font-size: 10px; padding: 4px 8px; margin: 2px; background: ${colors.accent}; color: white; border: none; border-radius: 3px; cursor: pointer;">High Priority</button>
                        </div>
                    </div>
                `;
                return;
            }

            container.innerHTML = filters.map(filter => this.createFilterHTML(filter)).join('');
        },

        // Create filter HTML
        createFilterHTML: function(filter) {
            const fieldConfig = window.SNExtractorConfig.FILTER_OPTIONS[filter.field];
            const colors = window.SNExtractorUtils ? 
                window.SNExtractorUtils.getThemeColors(window.currentTheme || 'wholefoodsGreen') :
                window.SNExtractorConfig.THEMES.wholefoodsGreen;

            let valueInput = '';

            if (fieldConfig) {
                if (fieldConfig.type === 'choice' && fieldConfig.values) {
                    valueInput = `
                        <select onchange="SNExtractor_updateFilter('${filter.id}', 'value', this.value)" style="
                            flex: 1;
                            padding: 6px;
                            font-size: 11px;
                            border: 1px solid #ddd;
                            border-radius: 3px;
                        ">
                            <option value="">Select...</option>
                            ${Object.entries(fieldConfig.values).map(([key, label]) =>
                                `<option value="${key}" ${filter.value === key ? 'selected' : ''}>${key} - ${label}</option>`
                            ).join('')}
                        </select>
                    `;
                } else if (fieldConfig.type === 'date') {
                    valueInput = `
                        <div style="flex: 1; display: flex; gap: 4px;">
                            <input type="date"
                                   value="${filter.dateStart || ''}"
                                   onchange="SNExtractor_updateFilter('${filter.id}', 'dateStart', this.value); SNExtractor_updateDateFilter('${filter.id}')"
                                   style="flex: 1; padding: 4px; font-size: 11px; border: 1px solid #ddd; border-radius: 3px;"
                                   title="Start date">
                            <input type="date"
                                   value="${filter.dateEnd || ''}"
                                   onchange="SNExtractor_updateFilter('${filter.id}', 'dateEnd', this.value); SNExtractor_updateDateFilter('${filter.id}')"
                                   style="flex: 1; padding: 4px; font-size: 11px; border: 1px solid #ddd; border-radius: 3px;"
                                   title="End date (optional)">
                        </div>
                    `;
                } else {
                    valueInput = `
                        <input type="text"
                               placeholder="${fieldConfig.examples ? fieldConfig.examples[0] : 'Value...'}"
                               value="${filter.value}"
                               onchange="SNExtractor_updateFilter('${filter.id}', 'value', this.value)"
                               style="flex: 1; padding: 6px; font-size: 11px; border: 1px solid #ddd; border-radius: 3px;">
                    `;
                }
            } else {
                valueInput = `
                    <input type="text"
                           placeholder="Value..."
                           value="${filter.value}"
                           onchange="SNExtractor_updateFilter('${filter.id}', 'value', this.value)"
                           style="flex: 1; padding: 6px; font-size: 11px; border: 1px solid #ddd; border-radius: 3px;">
                `;
            }

            return `
                <div class="filter-row" style="
                    margin-bottom: 12px;
                    padding: 10px;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    background: #fafafa;
                ">
                    <div style="display: flex; gap: 6px; margin-bottom: 8px; align-items: center;">
                        <select onchange="SNExtractor_updateFilter('${filter.id}', 'field', this.value); updateFiltersList();" style="
                            flex: 2;
                            padding: 6px;
                            font-size: 11px;
                            border: 1px solid #ddd;
                            border-radius: 3px;
                        ">
                            <option value="">Select Field...</option>
                            ${Object.entries(window.SNExtractorConfig.FILTER_OPTIONS).map(([key, config]) =>
                                `<option value="${key}" ${filter.field === key ? 'selected' : ''}>${config.name}</option>`
                            ).join('')}
                        </select>

                        <select onchange="SNExtractor_updateFilter('${filter.id}', 'operator', this.value)" style="
                            flex: 1;
                            padding: 6px;
                            font-size: 11px;
                            border: 1px solid #ddd;
                            border-radius: 3px;
                        ">
                            <option value="CONTAINS" ${filter.operator === 'CONTAINS' ? 'selected' : ''}>Contains</option>
                            <option value="=" ${filter.operator === '=' ? 'selected' : ''}>Equals</option>
                            <option value="!=" ${filter.operator === '!=' ? 'selected' : ''}>Not Equal</option>
                            <option value="STARTSWITH" ${filter.operator === 'STARTSWITH' ? 'selected' : ''}>Starts With</option>
                            <option value=">" ${filter.operator === '>' ? 'selected' : ''}>Greater Than</option>
                            <option value="<" ${filter.operator === '<' ? 'selected' : ''}>Less Than</option>
                            <option value=">=" ${filter.operator === '>=' ? 'selected' : ''}>Greater/Equal</option>
                            <option value="<=" ${filter.operator === '<=' ? 'selected' : ''}>Less/Equal</option>
                        </select>

                        <button onclick="SNExtractor_removeFilter('${filter.id}')" style="
                            background: #dc3545;
                            color: white;
                            border: none;
                            border-radius: 3px;
                            cursor: pointer;
                            padding: 6px 8px;
                            font-size: 11px;
                        " title="Remove filter">×</button>
                    </div>

                    <div style="display: flex; gap: 6px;">
                        ${valueInput}
                    </div>

                    ${fieldConfig ? `
                        <div style="margin-top: 6px; font-size: 10px; color: #666;">
                            ${fieldConfig.description}
                            ${fieldConfig.examples ? `<br><strong>Examples:</strong> ${fieldConfig.examples.join(', ')}` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        },

        // Update export button state
        updateExportButton: function(ticketCount) {
            const button = document.getElementById('export-excel');
            if (button) {
                button.textContent = `📊 Export to Excel (${ticketCount} tickets)`;
                button.disabled = ticketCount === 0;
            }
        },

        // Switch tab
        switchTab: function(tabName, currentTheme) {
            const colors = window.SNExtractorUtils ? 
                window.SNExtractorUtils.getThemeColors(currentTheme) :
                window.SNExtractorConfig.THEMES[currentTheme] || window.SNExtractorConfig.THEMES.wholefoodsGreen;

            document.querySelectorAll('.tab-btn').forEach(btn => {
                if (btn.dataset.tab === tabName) {
                    btn.classList.add('active');
                    btn.style.background = colors.primary;
                    btn.style.color = 'white';
                } else {
                    btn.classList.remove('active');
                    btn.style.background = colors.light;
                    btn.style.color = colors.primary;
                }
            });

            document.querySelectorAll('.tab-content').forEach(content => {
                content.style.display = 'none';
            });
            
            const targetTab = document.getElementById(`tab-${tabName}`);
            if (targetTab) {
                targetTab.style.display = 'block';
            }
        }
    };

})();