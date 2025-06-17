// ==UserScript==
// @name         ServiceNow Extractor - API Module
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  ServiceNow API calls and data fetching
// @author       You
// @match        https://wfmprod.service-now.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // API management object
    window.SNExtractorAPI = {
        // Enhanced fetch with timeout
        fetchWithTimeout: async function(url, options, timeout = 30000) {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });
                clearTimeout(id);
                return response;
            } catch (error) {
                clearTimeout(id);
                if (error.name === 'AbortError') {
                    throw new Error('Request timeout - try reducing max records or using "Extract Current Page"');
                }
                throw error;
            }
        },

        // Query ServiceNow table with multiple fallback methods
        queryTableSimple: async function(tableName, query, fields, limit) {
            const attempts = [
                // Attempt 1: Basic REST API
                async () => {
                    let url = `${window.SNExtractorConfig.BASE_URL}/api/now/table/${tableName}`;
                    const params = new URLSearchParams();

                    if (fields && fields.length > 0) {
                        params.append('sysparm_fields', fields.join(','));
                    }
                    if (limit) {
                        params.append('sysparm_limit', Math.min(limit, 500).toString()); // Limit to 500 max
                    }
                    if (query) {
                        params.append('sysparm_query', query);
                    }

                    if (params.toString()) {
                        url += '?' + params.toString();
                    }

                    const response = await this.fetchWithTimeout(url, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        credentials: 'include'
                    }, 30000);

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    return await response.json();
                },

                // Attempt 2: JSON API endpoint
                async () => {
                    let url = `${window.SNExtractorConfig.BASE_URL}/${tableName}.do`;
                    const params = new URLSearchParams({
                        JSONv2: '',
                        sysparm_action: 'getRecords',
                        sysparm_max_records: Math.min(limit || 100, 500).toString()
                    });

                    if (fields && fields.length > 0) {
                        params.append('sysparm_fields', fields.join(','));
                    }
                    if (query) {
                        params.append('sysparm_query', query);
                    }

                    url += '?' + params.toString();

                    const response = await this.fetchWithTimeout(url, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        credentials: 'include'
                    }, 30000);

                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    const data = await response.json();
                    return { result: data.records || [] };
                }
            ];

            let lastError;
            for (let i = 0; i < attempts.length; i++) {
                try {
                    if (window.SNExtractorUtils && window.SNExtractorUtils.updateStatus) {
                        window.SNExtractorUtils.updateStatus(`🔍 Querying ${tableName} (attempt ${i + 1})...`);
                    }
                    const result = await attempts[i]();
                    return result;
                } catch (error) {
                    lastError = error;
                    console.warn(`Attempt ${i + 1} failed for ${tableName}:`, error);
                    if (i < attempts.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between attempts
                    }
                }
            }

            throw new Error(`All API attempts failed: ${lastError.message}`);
        },

        // Build query string from filters
        buildQueryString: function(filters) {
            return filters
                .filter(f => f.field && f.value)
                .map(f => {
                    let query = f.field;
                    switch(f.operator) {
                        case 'CONTAINS':
                            query += 'LIKE' + f.value;
                            break;
                        case 'STARTSWITH':
                            query += 'STARTSWITH' + f.value;
                            break;
                        default:
                            query += f.operator + f.value;
                    }
                    return query;
                })
                .join('^');
        },

        // Extract tickets using API with better error handling
        extractByQuery: async function(selectedTables, filters, selectedFields, maxRecords) {
            const queryString = this.buildQueryString(filters);
            const limitedMaxRecords = Math.min(maxRecords, 500); // Limit to 500

            if (window.SNExtractorUtils && window.SNExtractorUtils.updateStatus) {
                window.SNExtractorUtils.updateStatus('🔍 Extracting tickets via API...');
            }

            if (selectedTables.length === 0) {
                if (window.SNExtractorUtils && window.SNExtractorUtils.updateStatus) {
                    window.SNExtractorUtils.updateStatus('❌ No tables selected. Please select tables in the Tables tab.');
                }
                return [];
            }

            try {
                const allTickets = [];

                for (const tableName of selectedTables) {
                    try {
                        const data = await this.queryTableSimple(tableName, queryString, selectedFields, limitedMaxRecords);

                        if (data.result && data.result.length > 0) {
                            // Add table type to each ticket
                            data.result.forEach(ticket => {
                                ticket._table_type = tableName;
                            });

                            allTickets.push(...data.result);
                            if (window.SNExtractorUtils && window.SNExtractorUtils.updateStatus) {
                                window.SNExtractorUtils.updateStatus(`✅ Got ${data.result.length} tickets from ${tableName}`);
                            }
                        } else {
                            if (window.SNExtractorUtils && window.SNExtractorUtils.updateStatus) {
                                window.SNExtractorUtils.updateStatus(`⚠️ No tickets found in ${tableName}`);
                            }
                        }

                    } catch (error) {
                        console.error(`Failed to query ${tableName}:`, error);
                        if (window.SNExtractorUtils && window.SNExtractorUtils.updateStatus) {
                            window.SNExtractorUtils.updateStatus(`❌ Failed ${tableName}: ${error.message.substring(0, 50)}...`);
                        }
                    }
                }

                if (allTickets.length > 0) {
                    if (window.SNExtractorUtils && window.SNExtractorUtils.updateStatus) {
                        window.SNExtractorUtils.updateStatus(`✅ API extraction complete: ${allTickets.length} tickets from ${selectedTables.length} table(s)`);
                    }
                } else {
                    if (window.SNExtractorUtils && window.SNExtractorUtils.updateStatus) {
                        window.SNExtractorUtils.updateStatus(`⚠️ No tickets extracted via API. Try "Extract Current Page" if you're viewing a list.`);
                    }
                }

                return allTickets;

            } catch (error) {
                console.error('API extraction failed:', error);
                if (window.SNExtractorUtils && window.SNExtractorUtils.updateStatus) {
                    window.SNExtractorUtils.updateStatus(`❌ API extraction failed: ${error.message.substring(0, 50)}...`);
                }
                return [];
            }
        }
    };

})();