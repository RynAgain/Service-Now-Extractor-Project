# Guide: Intercepting Network Requests to Capture Data Without Killing Performance

## Overview

This guide explains how to intercept network requests in userscripts or browser extensions to capture various types of data—authentication tokens, CSRF tokens, API keys, session IDs, user data, cookies, and more—without degrading page performance.

## What You Can Capture

This technique can be applied to capture virtually any data flowing through HTTP requests:

### From Request Headers
| Data Type | Common Header Names | Example Use Case |
|-----------|---------------------|------------------|
| CSRF Tokens | `X-CSRF-Token`, `X-XSRF-Token`, `anti-csrftoken-a2z` | Automating form submissions |
| Auth Tokens | `Authorization`, `X-Auth-Token`, `Bearer` | Making authenticated API calls |
| API Keys | `X-API-Key`, `Api-Key`, `X-Api-Key` | Reusing API access |
| Session IDs | `X-Session-Id`, `Session-Token` | Session management |
| Custom Headers | Any `X-*` header | Application-specific data |

### From Request Body
| Data Type | Where to Find | Example Use Case |
|-----------|---------------|------------------|
| Form Data | POST body | Capturing submitted form values |
| JSON Payloads | Request body | Extracting API request parameters |
| User Credentials | Login requests | Debugging auth flows |

### From Response Data
| Data Type | Where to Find | Example Use Case |
|-----------|---------------|------------------|
| User Info | JSON response body | Displaying user context |
| Store/Location Data | API responses | Location-aware features |
| Configuration | Config endpoints | Adapting to app settings |
| Tokens in Body | JSON response | Some APIs return tokens in body |

## The Problem

Many web applications include important data in request/response headers and bodies. You may need to capture this data for:
- Automating authenticated API calls
- Store/session switching functionality
- Debugging or monitoring purposes
- Building browser extensions that enhance functionality
- Extracting configuration or user context

**Naive approaches** like DOM polling or continuous scanning are inefficient and can slow down the page significantly.

## The Solution: API Monkey-Patching

Instead of polling, intercept network requests at the source by overriding the native browser APIs. This covers **all** request types:

| API | What It Covers |
|-----|----------------|
| `XMLHttpRequest` | Classic AJAX calls (XHR) |
| `fetch` | Modern promise-based requests |
| `navigator.sendBeacon` | Analytics pings, logging beacons |
| `EventSource` | Server-Sent Events (SSE) |
| `WebSocket` | Persistent bidirectional connections |
| Dynamic elements | `<img>`, `<script>`, `<link>` resource loads |

All overrides are applied **once** at script startup.

---

## Implementation Guide

### 1. Set Up Global State

Create variables to store captured data and prevent duplicate initialization:

```javascript
// Global state
let capturedToken = null;
let interceptionActive = false;

// Optional: Use persistent storage (Tampermonkey/Greasemonkey)
// GM_setValue('capturedToken', value);
// GM_getValue('capturedToken', null);
```

### 2. Intercept XMLHttpRequest

Override the `setRequestHeader` method to capture headers as they're set:

```javascript
function interceptXHR() {
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    
    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        // Check for your target header (customize this condition)
        if (name === 'Authorization' || name === 'X-CSRF-Token') {
            // Optional: Validate token format/length
            if (value && value.length > 10) {
                capturedToken = value;
                console.log('Captured token from XHR:', value);
                
                // Optional: Persist to storage
                // GM_setValue('capturedToken', value);
                // GM_setValue('capturedTimestamp', Date.now());
            }
        }
        
        // Always call the original method
        return originalSetRequestHeader.call(this, name, value);
    };
}
```

### 3. Intercept Fetch API

Override `window.fetch` to capture headers from fetch requests:

```javascript
function interceptFetch() {
    const originalFetch = window.fetch;
    
    window.fetch = function(url, options) {
        // Capture tokens from request headers
        if (options && options.headers) {
            const headers = options.headers;
            let token = null;
            
            // Handle different header formats
            if (headers['Authorization']) {
                token = headers['Authorization'];
            } else if (headers instanceof Headers) {
                token = headers.get('Authorization');
            } else if (typeof headers.get === 'function') {
                token = headers.get('Authorization');
            }
            
            if (token && token.length > 10) {
                capturedToken = token;
                console.log('Captured token from fetch:', token);
            }
        }
        
        // Call original fetch and get the promise
        const fetchPromise = originalFetch.apply(this, arguments);
        
        // Optional: Intercept responses (non-blocking)
        interceptResponse(url, fetchPromise);
        
        // Return the original promise immediately
        return fetchPromise;
    };
}
```

### 4. Intercept `navigator.sendBeacon`

`sendBeacon` is used for fire-and-forget requests (analytics pings, logging). Override it to capture URL parameters and body payloads:

```javascript
function interceptSendBeacon() {
    const originalSendBeacon = navigator.sendBeacon.bind(navigator);
    
    navigator.sendBeacon = function(url, data) {
        console.log('sendBeacon URL:', url);
        
        // Capture URL parameters (tokens sometimes live in query strings)
        try {
            const parsed = new URL(url, location.origin);
            const token = parsed.searchParams.get('token') || parsed.searchParams.get('auth');
            if (token) {
                capturedToken = token;
                console.log('Captured token from sendBeacon URL:', token);
            }
        } catch (e) {}
        
        // Capture body payload
        if (data) {
            try {
                let bodyString = '';
                if (typeof data === 'string') {
                    bodyString = data;
                } else if (data instanceof Blob) {
                    // Blob reading is async — fire-and-forget log only
                    data.text().then(text => {
                        console.log('sendBeacon Blob body:', text);
                    }).catch(() => {});
                } else if (data instanceof FormData) {
                    for (const [key, value] of data.entries()) {
                        console.log(`sendBeacon FormData: ${key}=${value}`);
                    }
                } else if (data instanceof URLSearchParams) {
                    bodyString = data.toString();
                }
                
                if (bodyString) {
                    console.log('sendBeacon body:', bodyString);
                }
            } catch (e) {}
        }
        
        // Always call the original
        return originalSendBeacon(url, data);
    };
}
```

### 5. Intercept XHR `open` and `send` (URL and Body Capture)

`setRequestHeader` only captures headers. To capture the request URL and body, also override `open` and `send`:

```javascript
function interceptXHRFull() {
    // --- Capture URL from open() ---
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        // Store method and URL on the instance for later inspection
        this._interceptedMethod = method;
        this._interceptedURL = url;
        console.log(`XHR open: ${method} ${url}`);
        return originalOpen.call(this, method, url, ...rest);
    };
    
    // --- Capture body from send() ---
    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(body) {
        if (body) {
            try {
                let parsed = null;
                if (typeof body === 'string') {
                    parsed = JSON.parse(body);
                } else if (body instanceof FormData) {
                    parsed = {};
                    for (const [key, value] of body.entries()) {
                        parsed[key] = value;
                    }
                }
                
                if (parsed) {
                    console.log('XHR send body:', parsed);
                    // Extract specific fields as needed
                    if (parsed.storeId) {
                        GM_setValue('lastStoreId', parsed.storeId);
                    }
                }
            } catch (e) {
                // Not JSON — ignore
            }
        }
        
        return originalSend.call(this, body);
    };
    
    // --- Capture headers (existing pattern) ---
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        if (name === 'Authorization' || name === 'X-CSRF-Token') {
            if (value && value.length > 10) {
                capturedToken = value;
                console.log('Captured token from XHR header:', value);
            }
        }
        return originalSetRequestHeader.call(this, name, value);
    };
}
```

### 6. Intercept EventSource (Server-Sent Events)

`EventSource` opens a persistent HTTP connection for server-pushed messages. Override the constructor to capture the URL (which often contains auth tokens as query parameters):

```javascript
function interceptEventSource() {
    const OriginalEventSource = window.EventSource;
    
    window.EventSource = function(url, config) {
        console.log('EventSource opened:', url);
        
        // Capture tokens from URL parameters
        try {
            const parsed = new URL(url, location.origin);
            const token = parsed.searchParams.get('token')
                       || parsed.searchParams.get('access_token')
                       || parsed.searchParams.get('auth');
            if (token) {
                capturedToken = token;
                console.log('Captured token from EventSource URL:', token);
            }
        } catch (e) {}
        
        // Create the real EventSource
        const instance = new OriginalEventSource(url, config);
        
        // Optional: tap into incoming messages
        const originalAddEventListener = instance.addEventListener.bind(instance);
        instance.addEventListener = function(type, listener, options) {
            const wrappedListener = function(event) {
                // Log or process SSE messages
                if (event.data) {
                    try {
                        const data = JSON.parse(event.data);
                        console.log(`SSE [${type}]:`, data);
                    } catch (e) {
                        // Not JSON
                    }
                }
                return listener.call(this, event);
            };
            return originalAddEventListener(type, wrappedListener, options);
        };
        
        return instance;
    };
    
    // Preserve prototype chain and constants
    window.EventSource.prototype = OriginalEventSource.prototype;
    window.EventSource.CONNECTING = OriginalEventSource.CONNECTING;
    window.EventSource.OPEN = OriginalEventSource.OPEN;
    window.EventSource.CLOSED = OriginalEventSource.CLOSED;
}
```

### 7. Intercept WebSocket

Override the `WebSocket` constructor to capture connection URLs and tap into messages:

```javascript
function interceptWebSocket() {
    const OriginalWebSocket = window.WebSocket;
    
    window.WebSocket = function(url, protocols) {
        console.log('WebSocket opened:', url);
        
        // Capture tokens from the connection URL
        try {
            const parsed = new URL(url);
            const token = parsed.searchParams.get('token')
                       || parsed.searchParams.get('access_token');
            if (token) {
                capturedToken = token;
                console.log('Captured token from WebSocket URL:', token);
            }
        } catch (e) {}
        
        // Create the real WebSocket
        const ws = protocols
            ? new OriginalWebSocket(url, protocols)
            : new OriginalWebSocket(url);
        
        // Tap into outgoing messages
        const originalSend = ws.send.bind(ws);
        ws.send = function(data) {
            try {
                const parsed = JSON.parse(data);
                console.log('WebSocket send:', parsed);
                
                // Capture auth tokens sent over WS
                if (parsed.token || parsed.authToken) {
                    capturedToken = parsed.token || parsed.authToken;
                    console.log('Captured token from WebSocket message');
                }
            } catch (e) {
                // Binary or non-JSON data
            }
            return originalSend(data);
        };
        
        // Tap into incoming messages
        ws.addEventListener('message', function(event) {
            try {
                const data = JSON.parse(event.data);
                console.log('WebSocket recv:', data);
            } catch (e) {
                // Binary or non-JSON data
            }
        });
        
        return ws;
    };
    
    // Preserve prototype chain and constants
    window.WebSocket.prototype = OriginalWebSocket.prototype;
    window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
    window.WebSocket.OPEN = OriginalWebSocket.OPEN;
    window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
    window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
}
```

### 8. Intercept Dynamic Resource Elements

Some applications load data via dynamically created `<img>`, `<script>`, or `<link>` elements (e.g., JSONP, tracking pixels). Use a `MutationObserver` scoped to network-relevant elements only:

```javascript
function interceptDynamicElements() {
    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;
                
                const tag = node.tagName;
                const src = node.src || node.href || '';
                
                if (!src) continue;
                
                if (tag === 'SCRIPT' || tag === 'IMG' || tag === 'LINK' || tag === 'IFRAME') {
                    console.log(`Dynamic ${tag} loaded:`, src);
                    
                    // Capture tokens from query strings
                    try {
                        const parsed = new URL(src, location.origin);
                        const token = parsed.searchParams.get('token')
                                   || parsed.searchParams.get('key')
                                   || parsed.searchParams.get('access_token');
                        if (token) {
                            capturedToken = token;
                            console.log(`Captured token from dynamic ${tag}:`, token);
                        }
                    } catch (e) {}
                }
            }
        }
    });
    
    // Only observe childList on the document — lightweight
    observer.observe(document.documentElement, { childList: true, subtree: true });
}
```

### 9. Non-Blocking Response Interception (Optional)

If you need to capture data from responses, use `.clone()` to avoid blocking:

```javascript
function interceptResponse(url, fetchPromise) {
    // Safely extract URL string
    let urlString = '';
    try {
        if (typeof url === 'string') {
            urlString = url;
        } else if (url instanceof Request) {
            urlString = url.url;
        } else {
            urlString = String(url);
        }
    } catch (error) {
        return; // Fail silently
    }
    
    // Only process specific endpoints
    if (!urlString.includes('/api/session') && !urlString.includes('/api/user')) {
        return;
    }
    
    // Process response asynchronously (non-blocking)
    fetchPromise
        .then(response => {
            if (response.ok) {
                // Clone the response so original can still be used
                response.clone().json()
                    .then(data => {
                        // Process the response data
                        if (data && data.sessionId) {
                            console.log('Captured session data:', data);
                        }
                    })
                    .catch(() => {}); // Ignore JSON parse errors
            }
        })
        .catch(() => {}); // Ignore network errors
}
```

### 10. Initialize with Guard Flag

Prevent duplicate initialization. Call **all** interceptors here:

```javascript
function startNetworkInterception() {
    if (interceptionActive) {
        console.log('Network interception already active');
        return;
    }
    
    console.log('Starting network interception...');
    interceptionActive = true;
    
    interceptXHR();           // or interceptXHRFull() for URL + body capture
    interceptFetch();
    interceptSendBeacon();
    interceptEventSource();
    interceptWebSocket();
    interceptDynamicElements();
    
    console.log('Network interception active — all request types covered');
}

// Call once at script startup
startNetworkInterception();
```

### 11. Token Retrieval with Caching

Implement lazy retrieval with age validation:

```javascript
function getCapturedToken(maxAgeHours = 24) {
    const token = GM_getValue('capturedToken', null);
    const timestamp = GM_getValue('capturedTimestamp', 0);
    const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
    
    if (token && ageHours < maxAgeHours) {
        return token;
    }
    
    // Token is stale or doesn't exist
    return null;
}
```

---

## Complete Template

```javascript
// ==UserScript==
// @name         Network Request Interceptor Template
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Capture data from ALL network request types
// @match        https://example.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    
    // ── Configuration ──────────────────────────────────────────
    const TARGET_HEADERS = ['Authorization', 'X-CSRF-Token', 'X-Auth-Token'];
    const TARGET_URL_PARAMS = ['token', 'access_token', 'auth', 'key'];
    const MIN_TOKEN_LENGTH = 10;
    const TOKEN_MAX_AGE_HOURS = 24;
    
    // ── State ──────────────────────────────────────────────────
    let capturedToken = null;
    let interceptionActive = false;
    
    function saveToken(value, source) {
        if (!value || value.length < MIN_TOKEN_LENGTH) return;
        capturedToken = value;
        GM_setValue('capturedToken', value);
        GM_setValue('capturedTimestamp', Date.now());
        console.log(`[Interceptor] Captured token from ${source}`);
    }
    
    function extractTokenFromURL(urlString) {
        try {
            const parsed = new URL(urlString, location.origin);
            for (const param of TARGET_URL_PARAMS) {
                const val = parsed.searchParams.get(param);
                if (val) return val;
            }
        } catch (e) {}
        return null;
    }
    
    // ── 1. XHR (headers, URL, body) ───────────────────────────
    function interceptXHR() {
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;
        const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;
        
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this._iMethod = method;
            this._iURL = url;
            const token = extractTokenFromURL(String(url));
            if (token) saveToken(token, 'XHR URL');
            return origOpen.call(this, method, url, ...rest);
        };
        
        XMLHttpRequest.prototype.send = function(body) {
            if (body && typeof body === 'string') {
                try {
                    const parsed = JSON.parse(body);
                    if (parsed.token) saveToken(parsed.token, 'XHR body');
                } catch (e) {}
            }
            return origSend.call(this, body);
        };
        
        XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
            if (TARGET_HEADERS.includes(name)) saveToken(value, `XHR header ${name}`);
            return origSetHeader.call(this, name, value);
        };
    }
    
    // ── 2. Fetch (headers, URL, body, response) ───────────────
    function interceptFetch() {
        const original = window.fetch;
        window.fetch = function(url, options) {
            // URL params
            const urlStr = typeof url === 'string' ? url : (url.url || String(url));
            const urlToken = extractTokenFromURL(urlStr);
            if (urlToken) saveToken(urlToken, 'fetch URL');
            
            if (options) {
                // Headers
                if (options.headers) {
                    for (const header of TARGET_HEADERS) {
                        let token = null;
                        if (options.headers instanceof Headers) {
                            token = options.headers.get(header);
                        } else if (options.headers[header]) {
                            token = options.headers[header];
                        }
                        if (token) { saveToken(token, `fetch header ${header}`); break; }
                    }
                }
                // Body
                if (options.body && typeof options.body === 'string') {
                    try {
                        const parsed = JSON.parse(options.body);
                        if (parsed.token) saveToken(parsed.token, 'fetch body');
                    } catch (e) {}
                }
            }
            return original.apply(this, arguments);
        };
    }
    
    // ── 3. navigator.sendBeacon ────────────────────────────────
    function interceptSendBeacon() {
        if (!navigator.sendBeacon) return;
        const original = navigator.sendBeacon.bind(navigator);
        navigator.sendBeacon = function(url, data) {
            const token = extractTokenFromURL(String(url));
            if (token) saveToken(token, 'sendBeacon URL');
            if (data && typeof data === 'string') {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.token) saveToken(parsed.token, 'sendBeacon body');
                } catch (e) {}
            }
            return original(url, data);
        };
    }
    
    // ── 4. EventSource (SSE) ──────────────────────────────────
    function interceptEventSource() {
        if (!window.EventSource) return;
        const Original = window.EventSource;
        window.EventSource = function(url, config) {
            const token = extractTokenFromURL(String(url));
            if (token) saveToken(token, 'EventSource URL');
            return new Original(url, config);
        };
        window.EventSource.prototype = Original.prototype;
        window.EventSource.CONNECTING = Original.CONNECTING;
        window.EventSource.OPEN = Original.OPEN;
        window.EventSource.CLOSED = Original.CLOSED;
    }
    
    // ── 5. WebSocket ──────────────────────────────────────────
    function interceptWebSocket() {
        if (!window.WebSocket) return;
        const Original = window.WebSocket;
        window.WebSocket = function(url, protocols) {
            const token = extractTokenFromURL(String(url));
            if (token) saveToken(token, 'WebSocket URL');
            const ws = protocols ? new Original(url, protocols) : new Original(url);
            const origSend = ws.send.bind(ws);
            ws.send = function(data) {
                if (typeof data === 'string') {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.token || parsed.authToken) {
                            saveToken(parsed.token || parsed.authToken, 'WebSocket message');
                        }
                    } catch (e) {}
                }
                return origSend(data);
            };
            return ws;
        };
        window.WebSocket.prototype = Original.prototype;
        window.WebSocket.CONNECTING = Original.CONNECTING;
        window.WebSocket.OPEN = Original.OPEN;
        window.WebSocket.CLOSING = Original.CLOSING;
        window.WebSocket.CLOSED = Original.CLOSED;
    }
    
    // ── 6. Dynamic resource elements ──────────────────────────
    function interceptDynamicElements() {
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (!(node instanceof HTMLElement)) continue;
                    const src = node.src || node.href || '';
                    if (src && /^(SCRIPT|IMG|LINK|IFRAME)$/.test(node.tagName)) {
                        const token = extractTokenFromURL(src);
                        if (token) saveToken(token, `dynamic <${node.tagName.toLowerCase()}>`);
                    }
                }
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    
    // ── Initialization ────────────────────────────────────────
    function startInterception() {
        if (interceptionActive) return;
        interceptionActive = true;
        interceptXHR();
        interceptFetch();
        interceptSendBeacon();
        interceptEventSource();
        interceptWebSocket();
        interceptDynamicElements();
        console.log('[Interceptor] All request types covered');
    }
    
    function getToken() {
        const token = GM_getValue('capturedToken', null);
        const timestamp = GM_getValue('capturedTimestamp', 0);
        const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
        return (token && ageHours < TOKEN_MAX_AGE_HOURS) ? token : null;
    }
    
    // Initialize
    startInterception();
    
    // Export for use elsewhere in script
    window.TokenInterceptor = { getToken, startInterception };
})();
```

---

## Advanced Examples: Capturing Different Data Types

### Example 1: Capturing Multiple Header Types

```javascript
// Configuration for multiple data types
const CAPTURE_CONFIG = {
    headers: {
        'Authorization': { key: 'authToken', minLength: 10 },
        'X-CSRF-Token': { key: 'csrfToken', minLength: 20 },
        'X-API-Key': { key: 'apiKey', minLength: 16 },
        'X-Session-Id': { key: 'sessionId', minLength: 8 }
    }
};

// Captured data store
const capturedData = {};

function interceptXHRMultiple() {
    const original = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        const config = CAPTURE_CONFIG.headers[name];
        if (config && value && value.length >= config.minLength) {
            capturedData[config.key] = value;
            GM_setValue(config.key, value);
            GM_setValue(`${config.key}_timestamp`, Date.now());
            console.log(`Captured ${config.key}:`, value.substring(0, 20) + '...');
        }
        return original.call(this, name, value);
    };
}
```

### Example 2: Capturing Request Body Data

```javascript
function interceptFetchWithBody() {
    const original = window.fetch;
    
    window.fetch = function(url, options) {
        // Capture data from request body
        if (options && options.body) {
            try {
                let bodyData = null;
                
                // Handle JSON body
                if (typeof options.body === 'string') {
                    bodyData = JSON.parse(options.body);
                } else if (options.body instanceof FormData) {
                    // Convert FormData to object
                    bodyData = {};
                    for (const [key, value] of options.body.entries()) {
                        bodyData[key] = value;
                    }
                }
                
                // Extract specific fields
                if (bodyData) {
                    if (bodyData.storeId) {
                        GM_setValue('lastStoreId', bodyData.storeId);
                        console.log('Captured storeId from request:', bodyData.storeId);
                    }
                    if (bodyData.userId) {
                        GM_setValue('lastUserId', bodyData.userId);
                        console.log('Captured userId from request:', bodyData.userId);
                    }
                }
            } catch (e) {
                // Not JSON or parsing failed - ignore
            }
        }
        
        return original.apply(this, arguments);
    };
}
```

### Example 3: Capturing Response Data by Endpoint

```javascript
// Configuration for response interception
const RESPONSE_ENDPOINTS = {
    '/api/user/profile': {
        key: 'userProfile',
        extract: (data) => ({
            id: data.id,
            name: data.name,
            email: data.email
        })
    },
    '/api/store/info': {
        key: 'storeInfo',
        extract: (data) => ({
            storeId: data.storeId,
            storeName: data.displayName,
            location: data.address
        })
    },
    '/api/config': {
        key: 'appConfig',
        extract: (data) => data // Capture entire response
    }
};

function interceptResponseByEndpoint(url, fetchPromise) {
    let urlString = '';
    try {
        urlString = typeof url === 'string' ? url : url.url || String(url);
    } catch (e) {
        return;
    }
    
    // Find matching endpoint configuration
    const matchingEndpoint = Object.keys(RESPONSE_ENDPOINTS).find(
        endpoint => urlString.includes(endpoint)
    );
    
    if (!matchingEndpoint) return;
    
    const config = RESPONSE_ENDPOINTS[matchingEndpoint];
    
    fetchPromise
        .then(response => {
            if (response.ok) {
                response.clone().json()
                    .then(data => {
                        const extracted = config.extract(data);
                        GM_setValue(config.key, JSON.stringify(extracted));
                        GM_setValue(`${config.key}_timestamp`, Date.now());
                        console.log(`Captured ${config.key}:`, extracted);
                    })
                    .catch(() => {});
            }
        })
        .catch(() => {});
}
```

### Example 4: Capturing Cookies from Set-Cookie Headers

```javascript
function interceptResponseForCookies(url, fetchPromise) {
    fetchPromise
        .then(response => {
            // Note: Set-Cookie headers are often not accessible due to browser security
            // This works for custom cookie-like headers
            const customCookie = response.headers.get('X-Custom-Session');
            if (customCookie) {
                GM_setValue('customSession', customCookie);
                console.log('Captured custom session cookie:', customCookie);
            }
            
            // Alternative: Parse cookies from response body if API returns them
            if (response.ok) {
                response.clone().json()
                    .then(data => {
                        if (data.sessionCookie) {
                            GM_setValue('sessionCookie', data.sessionCookie);
                        }
                    })
                    .catch(() => {});
            }
        })
        .catch(() => {});
}
```

### Example 5: Capturing GraphQL Queries and Responses

```javascript
function interceptGraphQL() {
    const original = window.fetch;
    
    window.fetch = function(url, options) {
        const fetchPromise = original.apply(this, arguments);
        
        // Check if this is a GraphQL request
        let urlString = typeof url === 'string' ? url : url.url || '';
        if (!urlString.includes('/graphql')) {
            return fetchPromise;
        }
        
        // Capture query from request
        if (options && options.body) {
            try {
                const body = JSON.parse(options.body);
                if (body.operationName) {
                    console.log('GraphQL operation:', body.operationName);
                    
                    // Capture specific operations
                    if (body.operationName === 'GetUserData') {
                        GM_setValue('lastUserQuery', JSON.stringify(body.variables));
                    }
                }
            } catch (e) {}
        }
        
        // Capture response data
        fetchPromise
            .then(response => {
                if (response.ok) {
                    response.clone().json()
                        .then(data => {
                            if (data.data && data.data.user) {
                                GM_setValue('graphqlUserData', JSON.stringify(data.data.user));
                                console.log('Captured GraphQL user data');
                            }
                        })
                        .catch(() => {});
                }
            })
            .catch(() => {});
        
        return fetchPromise;
    };
}
```

### Example 6: Capturing WebSocket-like Polling Data

```javascript
// For APIs that use long-polling instead of WebSockets
function interceptPollingEndpoints() {
    const original = window.fetch;
    const POLLING_ENDPOINTS = ['/api/notifications', '/api/updates', '/api/events'];
    
    window.fetch = function(url, options) {
        const fetchPromise = original.apply(this, arguments);
        
        let urlString = typeof url === 'string' ? url : url.url || '';
        const isPolling = POLLING_ENDPOINTS.some(ep => urlString.includes(ep));
        
        if (isPolling) {
            fetchPromise
                .then(response => {
                    if (response.ok) {
                        response.clone().json()
                            .then(data => {
                                // Accumulate polling data
                                const existing = JSON.parse(GM_getValue('pollingData', '[]'));
                                existing.push({
                                    timestamp: Date.now(),
                                    endpoint: urlString,
                                    data: data
                                });
                                // Keep only last 100 entries
                                if (existing.length > 100) existing.shift();
                                GM_setValue('pollingData', JSON.stringify(existing));
                            })
                            .catch(() => {});
                    }
                })
                .catch(() => {});
        }
        
        return fetchPromise;
    };
}
```

---

## Performance Best Practices

| Practice | Why It Matters |
|----------|----------------|
| **One-time setup** | Override APIs once at startup, not repeatedly |
| **Early returns** | Skip processing when conditions aren't met |
| **Simple conditionals** | Use O(1) operations like string comparison and length checks |
| **Non-blocking response handling** | Use `.clone()` and async callbacks |
| **Guard flags** | Prevent duplicate initialization |
| **Persistent caching** | Avoid redundant captures across page loads |
| **Graceful error handling** | Catch errors silently to prevent crashes |

---

## Performance Comparison

| Approach | CPU Impact | Memory Impact | Reliability |
|----------|-----------|---------------|-------------|
| **API Interception** | Minimal | Low | High |
| DOM Polling | High | Medium | Low |
| MutationObserver | High | High | Medium |
| Service Worker | Medium | Medium | High (complex) |

---

## Common Pitfalls

1. **Forgetting to call the original method** — Always return `original.call(this, ...)` or `original.apply(this, arguments)`

2. **Blocking the response** — Never `await` or synchronously process responses; use `.then()` with `.clone()`

3. **Not handling all header formats** — Headers can be plain objects, `Headers` instances, or have a `.get()` method

4. **Missing error handling** — Wrap URL extraction and JSON parsing in try-catch blocks

5. **Overwriting tokens too aggressively** — Consider only updating if the new token is different or newer

6. **Breaking the prototype chain** — When overriding constructors (`WebSocket`, `EventSource`), copy over the prototype and static constants so `instanceof` checks and `readyState` comparisons still work

7. **Ignoring `sendBeacon` and resource elements** — These are easy to overlook but commonly carry tokens in query strings

8. **Not guarding for missing APIs** — Always check `if (!window.WebSocket) return;` before overriding; some environments (e.g., Node-based SSR) may lack browser APIs

---

## When to Use This Pattern

✅ **Good use cases:**
- Capturing CSRF tokens for authenticated requests
- Session management in SPAs
- Debugging authentication flows
- Automating API interactions
- Monitoring WebSocket or SSE message streams
- Capturing analytics beacon payloads
- Intercepting JSONP or tracking-pixel URLs

❌ **Not recommended for:**
- High-frequency token rotation (consider Service Workers)
- Binary WebSocket frames (e.g., Protobuf) — parsing overhead may not be worth it
- Cross-origin requests where browser security blocks header access

---

## Summary

Network interception via API monkey-patching provides an efficient, non-intrusive way to capture data from **all** browser request types. By setting up the interception once and using simple conditional checks, you can passively capture:

- **Authentication tokens** (CSRF, JWT, API keys) from XHR and fetch headers
- **Session identifiers** and user context
- **Request body data** (form submissions, JSON payloads) from XHR, fetch, and sendBeacon
- **Response data** (user profiles, configuration, store info) via fetch response cloning
- **GraphQL queries and responses**
- **Polling/real-time data**
- **WebSocket connection URLs and messages** (auth tokens, real-time payloads)
- **EventSource (SSE) stream URLs** (access tokens in query parameters)
- **sendBeacon payloads** (analytics and logging data)
- **Dynamic resource element URLs** (`<img>`, `<script>`, `<link>`, `<iframe>` token parameters)

All of this happens as network requests naturally occur — adding negligible overhead to page performance while providing reliable access to data flowing through **every** network channel the browser offers.
