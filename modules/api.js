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
        // Get ServiceNow session cookies for debugging
        getSessionCookies: function() {
            const cookies = document.cookie.split(';').reduce((acc, cookie) => {
                const [name, value] = cookie.trim().split('=');
                acc[name] = value;
                return acc;
            }, {});

            const snCookies = {
                glide_sso_id: cookies.glide_sso_id,
                BIGipServerpool_wfmprod: cookies.BIGipServerpool_wfmprod,
                glide_user_route: cookies.glide_user_route,
                glide_node_id_for_js: cookies.glide_node_id_for_js,
                JSESSIONID: cookies.JSESSIONID,
                glide_user_activity: cookies.glide_user_activity,
                glide_session_store: cookies.glide_session_store,
                __CJ_g_startTime: cookies.__CJ_g_startTime
            };

            return snCookies;
        },

        // Enhanced fetch with timeout and ServiceNow cookie debugging
        fetchWithTimeout: async function(url, options, timeout = 30000) {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);

            // Log session cookies for debugging
            const sessionCookies = this.getSessionCookies();
            console.log('ServiceNow Session Cookies:', sessionCookies);
            
            // Check for critical cookies
            const criticalCookies = ['JSESSIONID', 'glide_sso_id', 'glide_user_route'];
            const missingCookies = criticalCookies.filter(cookie => !sessionCookies[cookie]);
            
            if (missingCookies.length > 0) {
                console.warn('Missing critical ServiceNow cookies:', missingCookies);
            }

            try {
                // Ensure we're sending all cookies and proper headers
                const enhancedOptions = {
                    ...options,
                    signal: controller.signal,
                    credentials: 'include', // This should include all cookies
                    headers: {
                        ...options.headers,
                        // Add ServiceNow-specific headers
                        'X-UserToken': window.g_ck || ''  // Add this line
                        //'X-Transaction-Source': 'Tampermonkey Script' // this seems wrong, we are trying to piggy back here so we wouldn't want to announce a different source
                    }
                };

                console.log('API Request:', {
                    url: url,
                    method: enhancedOptions.method,
                    headers: enhancedOptions.headers,
                    credentials: enhancedOptions.credentials
                });

                const response = await fetch(url, enhancedOptions);
                clearTimeout(id);
                
                // Log response details
                console.log('API Response:', {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries())
                });

                return response;
            } catch (error) {
                clearTimeout(id);
                if (error.name === 'AbortError') {
                    throw new Error('Request timeout - try reducing max records');
                }
                throw error;
            }
        },

        // Enhanced ServiceNow API query with better error handling and authentication
        queryTableSimple: async function(tableName, query, fields, limit) {
            const attempts = [
                // Attempt 1: Modern REST API with proper authentication
                async () => {
                    let url = `${window.SNExtractorConfig.BASE_URL}/api/now/table/${tableName}`;
                    const params = new URLSearchParams();

                    if (fields && fields.length > 0) {
                        params.append('sysparm_fields', fields.join(','));
                    }
                    if (limit) {
                        params.append('sysparm_limit', Math.min(limit, 1000).toString()); // Increased limit
                    }
                    if (query) {
                        params.append('sysparm_query', query);
                    }
                    
                    // Add display values for better data quality
                    params.append('sysparm_display_value', 'all');
                    params.append('sysparm_exclude_reference_link', 'true');

                    if (params.toString()) {
                        url += '?' + params.toString();
                    }

                    console.log(`REST API Request: ${url}`);

                    const response = await this.fetchWithTimeout(url, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            'X-UserToken': window.g_ck || '',  // Add this line
                            'X-Requested-With': 'XMLHttpRequest',
                            'Cache-Control': 'no-cache',
                            'X-WantSessionNotificationMessages': 'true'
                        },
                        credentials: 'include'
                    }, 45000); // Increased timeout

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`REST API Error: ${response.status} - ${errorText}`);
                        throw new Error(`REST API ${response.status}: ${response.statusText} - ${errorText.substring(0, 100)}`);
                    }

                    const data = await response.json();
                    console.log(`REST API Success: ${data.result?.length || 0} records from ${tableName}`);
                    return data;
                },

                // Attempt 2: Legacy JSON API endpoint
                async () => {
                    let url = `${window.SNExtractorConfig.BASE_URL}/${tableName}.do`;
                    const params = new URLSearchParams({
                        JSONv2: '',
                        sysparm_action: 'getRecords',
                        sysparm_max_records: Math.min(limit || 100, 1000).toString()
                    });

                    if (fields && fields.length > 0) {
                        params.append('sysparm_fields', fields.join(','));
                    }
                    if (query) {
                        params.append('sysparm_query', query);
                    }

                    url += '?' + params.toString();
                    console.log(`Legacy API Request: ${url}`);

                    const response = await this.fetchWithTimeout(url, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'X-UserToken': window.g_ck || '',  // Add this line
                            'X-Requested-With': 'XMLHttpRequest',
                            'Cache-Control': 'no-cache',
                            'X-WantSessionNotificationMessages': 'true'
                        },
                        credentials: 'include'
                    }, 45000);

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`Legacy API Error: ${response.status} - ${errorText}`);
                        throw new Error(`Legacy API ${response.status}: ${response.statusText}`);
                    }

                    const data = await response.json();
                    console.log(`Legacy API Success: ${data.records?.length || 0} records from ${tableName}`);
                    return { result: data.records || [] };
                },

                // Attempt 3: Table API with different parameters
                async () => {
                    let url = `${window.SNExtractorConfig.BASE_URL}/api/now/v1/table/${tableName}`;
                    const params = new URLSearchParams();

                    if (fields && fields.length > 0) {
                        params.append('sysparm_fields', fields.join(','));
                    }
                    if (limit) {
                        params.append('sysparm_limit', Math.min(limit, 1000).toString());
                    }
                    if (query) {
                        params.append('sysparm_query', query);
                    }

                    if (params.toString()) {
                        url += '?' + params.toString();
                    }

                    console.log(`V1 API Request: ${url}`);

                    const response = await this.fetchWithTimeout(url, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'X-UserToken': window.g_ck || '',  // Add this line
                            'X-Requested-With': 'XMLHttpRequest',
                            'X-WantSessionNotificationMessages': 'true'
                        },
                        credentials: 'include'
                    }, 45000);

                    if (!response.ok) {
                        throw new Error(`V1 API ${response.status}: ${response.statusText}`);
                    }

                    const data = await response.json();
                    console.log(`V1 API Success: ${data.result?.length || 0} records from ${tableName}`);
                    return data;
                }
            ];

            let lastError;
            for (let i = 0; i < attempts.length; i++) {
                try {
                    if (window.SNExtractorUtils && window.SNExtractorUtils.updateStatus) {
                        window.SNExtractorUtils.updateStatus(`🔍 Querying ${tableName} (method ${i + 1}/3)...`);
                    }
                    const result = await attempts[i]();
                    
                    // Validate result structure
                    if (!result || (!result.result && !result.records)) {
                        throw new Error('Invalid response structure - no result data');
                    }
                    
                    return result;
                } catch (error) {
                    lastError = error;
                    console.warn(`API Method ${i + 1} failed for ${tableName}:`, error.message);
                    if (i < attempts.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between attempts
                    }
                }
            }

            throw new Error(`All API methods failed for ${tableName}: ${lastError.message}`);
        },

        // Enhanced query string builder with proper ServiceNow syntax
        buildQueryString: function(filters) {
            if (!filters || filters.length === 0) {
                return '';
            }

            return filters
                .filter(f => f.field && f.value)
                .map(f => {
                    let query = f.field;
                    const value = f.value.toString();
                    
                    switch(f.operator) {
                        case 'CONTAINS':
                            query += 'LIKE' + value;
                            break;
                        case 'STARTSWITH':
                            query += 'STARTSWITH' + value;
                            break;
                        case 'ENDSWITH':
                            query += 'ENDSWITH' + value;
                            break;
                        case 'IN':
                            query += 'IN' + value;
                            break;
                        case 'NOT IN':
                            query += 'NOT IN' + value;
                            break;
                        case 'ISEMPTY':
                            query += 'ISEMPTY';
                            break;
                        case 'ISNOTEMPTY':
                            query += 'ISNOTEMPTY';
                            break;
                        default:
                            query += f.operator + value;
                    }
                    return query;
                })
                .join('^');
        },

        // Test API connectivity with detailed cookie analysis
        testConnection: async function() {
            try {
                // First, check session cookies
                const sessionCookies = this.getSessionCookies();
                console.log('Session Analysis:', sessionCookies);
                
                const criticalCookies = ['JSESSIONID', 'glide_sso_id'];
                const missingCritical = criticalCookies.filter(cookie => !sessionCookies[cookie]);
                
                if (missingCritical.length > 0) {
                    return {
                        success: false,
                        message: `Missing critical cookies: ${missingCritical.join(', ')}. Please ensure you're logged into ServiceNow.`
                    };
                }

                const response = await this.fetchWithTimeout(
                    `${window.SNExtractorConfig.BASE_URL}/api/now/table/sys_user?sysparm_limit=1`,
                    {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'X-UserToken': window.g_ck || '',  // Add this line
                            'X-Requested-With': 'XMLHttpRequest',
                            'X-WantSessionNotificationMessages': 'true'
                        },
                        credentials: 'include'
                    },
                    10000
                );

                if (response.ok) {
                    const data = await response.json();
                    return {
                        success: true,
                        message: `API connection successful. Session cookies: ${Object.keys(sessionCookies).filter(k => sessionCookies[k]).length}/8`,
                        userCount: data.result?.length || 0,
                        cookies: sessionCookies
                    };
                } else {
                    const errorText = await response.text();
                    return {
                        success: false,
                        message: `API test failed: ${response.status} ${response.statusText}`,
                        details: errorText.substring(0, 200),
                        cookies: sessionCookies
                    };
                }
            } catch (error) {
                return {
                    success: false,
                    message: `API test error: ${error.message}`,
                    cookies: this.getSessionCookies()
                };
            }
        },

        // Get table schema information
        getTableSchema: async function(tableName) {
            try {
                const response = await this.fetchWithTimeout(
                    `${window.SNExtractorConfig.BASE_URL}/api/now/table/sys_dictionary?sysparm_query=name=${tableName}&sysparm_fields=element,column_label,internal_type`,
                    {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'X-UserToken': window.g_ck || '',  // Add this line
                            'X-Requested-With': 'XMLHttpRequest'
                        },
                        credentials: 'include'
                    },
                    15000
                );

                if (response.ok) {
                    const data = await response.json();
                    return data.result || [];
                } else {
                    console.warn(`Could not get schema for ${tableName}: ${response.status}`);
                    return [];
                }
            } catch (error) {
                console.warn(`Schema lookup failed for ${tableName}:`, error);
                return [];
            }
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
                        window.SNExtractorUtils.updateStatus(`⚠️ No tickets extracted via API. Check your filters or table permissions.`);
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