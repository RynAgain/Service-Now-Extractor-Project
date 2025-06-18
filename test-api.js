// ==UserScript==
// @name         ServiceNow API Test Script
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Test script to verify ServiceNow API functionality
// @author       You
// @match        https://wfmprod.service-now.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Check ServiceNow session cookies
    function checkSessionCookies() {
        console.log('=== ServiceNow Session Cookie Analysis ===');
        
        const cookies = document.cookie.split(';').reduce((acc, cookie) => {
            const [name, value] = cookie.trim().split('=');
            acc[name] = value;
            return acc;
        }, {});

        const requiredCookies = [
            'glide_sso_id',
            'BIGipServerpool_wfmprod',
            'glide_user_route',
            'glide_node_id_for_js',
            'JSESSIONID',
            'glide_user_activity',
            'glide_session_store',
            '__CJ_g_startTime'
        ];

        console.log('All cookies:', Object.keys(cookies));
        
        const cookieStatus = {};
        requiredCookies.forEach(cookieName => {
            const exists = cookies[cookieName] !== undefined;
            cookieStatus[cookieName] = {
                exists: exists,
                value: exists ? cookies[cookieName].substring(0, 20) + '...' : 'MISSING'
            };
            
            if (exists) {
                console.log(`✅ ${cookieName}: ${cookies[cookieName].substring(0, 30)}...`);
            } else {
                console.warn(`❌ ${cookieName}: MISSING`);
            }
        });

        const missingCookies = requiredCookies.filter(name => !cookies[name]);
        if (missingCookies.length > 0) {
            console.error('❌ Missing cookies:', missingCookies);
            console.error('This may cause API authentication issues!');
        } else {
            console.log('✅ All ServiceNow session cookies present');
        }

        return cookieStatus;
    }

    // Simple API test function
    async function testServiceNowAPI() {
        console.log('=== Testing ServiceNow API ===');
        
        // First check cookies
        const cookieStatus = checkSessionCookies();
        
        try {
            // Test basic REST API endpoint with enhanced headers
            console.log('Testing REST API endpoint...');
            const response = await fetch(`${window.location.origin}/api/now/table/incident?sysparm_limit=1`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-WantSessionNotificationMessages': 'true',
                    'Cache-Control': 'no-cache'
                },
                credentials: 'include'
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));

            if (response.ok) {
                const data = await response.json();
                console.log('✅ API Test Success:', data);
                console.log(`Found ${data.result?.length || 0} incident records`);
                
                // Test with fields parameter and display values
                console.log('Testing with field selection and display values...');
                const fieldsResponse = await fetch(`${window.location.origin}/api/now/table/incident?sysparm_limit=1&sysparm_fields=number,short_description,state&sysparm_display_value=all`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-WantSessionNotificationMessages': 'true',
                        'Cache-Control': 'no-cache'
                    },
                    credentials: 'include'
                });

                if (fieldsResponse.ok) {
                    const fieldsData = await fieldsResponse.json();
                    console.log('✅ Fields Test Success:', fieldsData);
                } else {
                    console.warn('⚠️ Fields test failed:', fieldsResponse.status);
                }

            } else {
                console.error('❌ API Test Failed:', response.status, response.statusText);
                const errorText = await response.text();
                console.error('Error details:', errorText.substring(0, 500));
                
                // Check if it's an authentication issue
                if (response.status === 401 || response.status === 403) {
                    console.error('🔒 Authentication issue detected!');
                    console.error('Check if you are properly logged into ServiceNow');
                    console.error('Missing cookies may be the cause');
                }
            }
        } catch (error) {
            console.error('❌ API Test Error:', error);
        }
    }

    // Test query building
    function testQueryBuilder() {
        console.log('=== Testing Query Builder ===');
        
        const filters = [
            { field: 'state', operator: '!=', value: '7' },
            { field: 'priority', operator: '<=', value: '2' },
            { field: 'short_description', operator: 'CONTAINS', value: 'network' }
        ];

        const query = filters
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

        console.log('Generated query:', query);
        console.log('Expected: state!=7^priority<=2^short_descriptionLIKEnetwork');
        
        // Test URL encoding
        const encodedQuery = encodeURIComponent(query);
        console.log('URL encoded query:', encodedQuery);
    }

    // Test different API endpoints
    async function testMultipleEndpoints() {
        console.log('=== Testing Multiple API Endpoints ===');
        
        const endpoints = [
            '/api/now/table/incident?sysparm_limit=1',
            '/api/now/table/sc_request?sysparm_limit=1',
            '/api/now/v1/table/incident?sysparm_limit=1',
            '/incident.do?JSONv2=&sysparm_action=getRecords&sysparm_max_records=1'
        ];

        for (const endpoint of endpoints) {
            try {
                console.log(`Testing: ${endpoint}`);
                const response = await fetch(`${window.location.origin}${endpoint}`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'include'
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log(`✅ ${endpoint}: ${data.result?.length || data.records?.length || 0} records`);
                } else {
                    console.warn(`⚠️ ${endpoint}: ${response.status} ${response.statusText}`);
                }
            } catch (error) {
                console.error(`❌ ${endpoint}: ${error.message}`);
            }
        }
    }

    // Run all tests
    async function runAllTests() {
        console.log('🚀 Starting ServiceNow API Tests...');
        checkSessionCookies();
        testQueryBuilder();
        await testServiceNowAPI();
        await testMultipleEndpoints();
        console.log('✅ All tests completed!');
    }

    // Run tests when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(runAllTests, 2000);
        });
    } else {
        setTimeout(runAllTests, 2000);
    }

    // Add test button to page
    function addTestButton() {
        const button = document.createElement('button');
        button.textContent = 'Test ServiceNow API';
        button.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            z-index: 9999;
            padding: 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        `;
        
        button.addEventListener('click', runAllTests);
        
        document.body.appendChild(button);
    }

    // Add button after page loads
    setTimeout(addTestButton, 1000);

})();