# ServiceNow API Troubleshooting Guide

## 🍪 Cookie Authentication Issues

### Required ServiceNow Cookies
The following cookies are essential for ServiceNow SSO authentication:

| Cookie Name | Purpose | Critical |
|-------------|---------|----------|
| `JSESSIONID` | Main session identifier | ✅ **CRITICAL** |
| `glide_sso_id` | SSO session token | ✅ **CRITICAL** |
| `glide_user_route` | User routing information | ⚠️ Important |
| `glide_node_id_for_js` | Node identification | ⚠️ Important |
| `BIGipServerpool_wfmprod` | Load balancer session | ⚠️ Important |
| `glide_user_activity` | User activity tracking | ℹ️ Optional |
| `glide_session_store` | Session storage | ℹ️ Optional |
| `__CJ_g_startTime` | Session start time | ℹ️ Optional |

### Common Issues & Solutions

#### ❌ Missing JSESSIONID or glide_sso_id
**Symptoms:** API returns 401/403 errors, "Authentication required" messages
**Solutions:**
1. **Log out and log back in** to ServiceNow
2. **Clear browser cookies** for the ServiceNow domain and re-login
3. **Check if SSO is working** - try accessing ServiceNow normally first
4. **Verify domain** - ensure you're on the correct ServiceNow instance

#### ❌ API Returns "Invalid Session" 
**Symptoms:** 401 errors with session-related messages
**Solutions:**
1. **Refresh the page** to get new session cookies
2. **Check session timeout** - ServiceNow sessions expire after inactivity
3. **Re-authenticate** if session has expired

#### ❌ CORS or Cross-Origin Issues
**Symptoms:** Network errors, blocked requests
**Solutions:**
1. **Ensure same origin** - script must run on the ServiceNow domain
2. **Check Tampermonkey settings** - ensure script matches correct domain
3. **Verify @match directive** in script header

## 🔧 Debugging Steps

### 1. Use the Test Script
Install and run [`test-api.js`](test-api.js) first:
```javascript
// This will show detailed cookie analysis and API testing
```

### 2. Check Browser Console
Look for these log messages:
- `✅ All ServiceNow session cookies present` - Good!
- `❌ Missing critical cookies: JSESSIONID, glide_sso_id` - Need to re-login
- `API Request:` - Shows request details
- `API Response:` - Shows response status and headers

### 3. Network Tab Analysis
In browser DevTools > Network:
1. **Filter by XHR/Fetch** requests
2. **Look for API calls** to `/api/now/table/`
3. **Check Request Headers** - should include all cookies
4. **Check Response** - 200 = success, 401/403 = auth issues

### 4. Manual Cookie Check
In browser console:
```javascript
// Check if critical cookies exist
console.log('JSESSIONID:', document.cookie.includes('JSESSIONID'));
console.log('glide_sso_id:', document.cookie.includes('glide_sso_id'));

// See all cookies
console.log(document.cookie);
```

## 🚨 Error Codes & Meanings

| Status Code | Meaning | Solution |
|-------------|---------|----------|
| **200** | Success | ✅ Working correctly |
| **401** | Unauthorized | Re-login to ServiceNow |
| **403** | Forbidden | Check user permissions |
| **404** | Not Found | Verify table name/endpoint |
| **429** | Rate Limited | Reduce request frequency |
| **500** | Server Error | ServiceNow internal issue |

## 🔍 Advanced Debugging

### Enable Detailed Logging
The enhanced API module now includes detailed logging:
- Session cookie analysis
- Request/response headers
- Authentication status
- Missing cookie detection

### Check ServiceNow User Permissions
Ensure your ServiceNow user has:
- **REST API access** (rest_api_explorer role)
- **Read access** to target tables (incident, sc_request, etc.)
- **Active user account** (not locked/disabled)

### Test Different API Endpoints
The script tries multiple endpoints:
1. `/api/now/table/` (Modern REST API)
2. `/api/now/v1/table/` (V1 REST API) 
3. `/{table}.do?JSONv2=` (Legacy JSON API)

### ServiceNow Instance Specific Issues
Some ServiceNow instances have:
- **Custom authentication** requirements
- **Additional security headers** needed
- **Modified API endpoints**
- **Restricted API access**

## 📞 Getting Help

### Information to Collect
When reporting issues, include:
1. **Browser console logs** (especially cookie analysis)
2. **Network tab screenshots** showing failed requests
3. **ServiceNow instance URL** (without sensitive info)
4. **User role/permissions** in ServiceNow
5. **Specific error messages**

### Quick Test Commands
Run these in browser console on ServiceNow:
```javascript
// Test basic API access
fetch('/api/now/table/incident?sysparm_limit=1', {
    credentials: 'include',
    headers: {'X-Requested-With': 'XMLHttpRequest'}
}).then(r => console.log('Status:', r.status));

// Check session cookies
console.log('Cookies:', document.cookie.split(';').filter(c => 
    c.includes('JSESSIONID') || c.includes('glide_sso_id')
));
```

## ✅ Success Indicators

You should see:
- ✅ All 8 ServiceNow cookies present (or at least JSESSIONID + glide_sso_id)
- ✅ API test returns 200 status
- ✅ "API connection successful" message
- ✅ Console shows successful cookie analysis
- ✅ Network tab shows requests with proper cookies

---

*This troubleshooting guide helps diagnose and fix ServiceNow API authentication issues, particularly those related to SSO cookies.*