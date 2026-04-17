# Netlify Deployment Troubleshooting Guide

## Common Backend Errors and Solutions

### 1. "Function Not Found" Error
**Problem**: Serverless function not found or not deployed properly.

**Solution**:
- Ensure `netlify/functions/api.js` exists and is properly formatted
- Check that `parse-multipart` dependency is installed
- Verify the function name matches the routing in `netlify.toml`

### 2. "CORS Error" 
**Problem**: Cross-origin requests blocked.

**Solution**:
- Check CORS headers in the serverless function
- Ensure all origins are properly whitelisted
- Verify OPTIONS requests are handled correctly

### 3. "Environment Variable Not Found"
**Problem**: API keys not available in serverless functions.

**Solution**:
- Set environment variables in Netlify dashboard
- Use exact variable names: `GROQ_API_KEY`, `USE_GROQ=true`
- Check variable visibility in Netlify UI

### 4. "Multipart Parse Error"
**Problem**: Audio file upload not working.

**Solution**:
- Ensure `parse-multipart` dependency is installed
- Check Content-Type header includes boundary
- Verify audio file size is under 50MB limit

### 5. "Groq API Error"
**Problem**: Voice analysis failing.

**Solution**:
- Verify Groq API key is valid and active
- Check API key has sufficient credits
- Ensure `USE_GROQ=true` is set

## Fixed Issues in Latest Version

### Serverless Function Structure
- **Before**: Multiple Express-based functions
- **After**: Single unified `api.js` function
- **Benefit**: Simpler deployment, better error handling

### Routing Configuration
- **Before**: Complex multi-route redirects
- **After**: Single catch-all route `/api/*`
- **Benefit**: More reliable routing

### Dependency Management
- **Added**: `parse-multipart` for file uploads
- **Fixed**: `serverless-http` export issues
- **Benefit**: Proper multipart form handling

### Error Handling
- **Before**: Express middleware errors
- **After**: Direct error responses
- **Benefit**: Clearer error messages

## Testing Your Deployment

### 1. Health Check
```bash
curl https://your-site.netlify.app/api/health
```
Expected response:
```json
{"status":"ok","message":"Emotion Detector API is running on Netlify"}
```

### 2. Test Voice Analysis
Use the browser interface to record audio and check:
- No CORS errors in browser console
- Function logs show processing
- Response contains emotion data

### 3. Check Function Logs
1. Go to Netlify dashboard
2. Select your site
3. Go to Functions tab
4. Check logs for errors

## Environment Variables Checklist

### Required Variables
```
GROQ_API_KEY=your_actual_groq_api_key
USE_GROQ=true
```

### Optional Variables
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
USE_SUPABASE=true
```

### Build Variables
```
NODE_VERSION=18
```

## Debugging Steps

### Step 1: Check Function Deployment
1. Netlify Dashboard > Functions
2. Verify `api` function is listed
3. Check function status

### Step 2: Test API Endpoints
```bash
# Health check
curl https://your-site.netlify.app/api/health

# History endpoint
curl https://your-site.netlify.app/api/history
```

### Step 3: Check Browser Console
1. Open browser developer tools
2. Look for CORS errors
3. Check network tab for failed requests

### Step 4: Review Function Logs
1. Netlify Dashboard > Functions
2. Click on function name
3. Review recent invocations

## Common Fixes

### Fix 1: Rebuild and Redeploy
```bash
git add .
git commit -m "Fix Netlify deployment"
git push origin main
```

### Fix 2: Clear Netlify Cache
1. Netlify Dashboard > Site settings
2. Build & deploy > Build hooks
3. Trigger new build

### Fix 3: Update Environment Variables
1. Netlify Dashboard > Site settings
2. Build & deploy > Environment
3. Update variables and save

### Fix 4: Check Dependencies
Ensure `package.json` includes:
```json
{
  "dependencies": {
    "parse-multipart": "^1.0.4",
    "groq-sdk": "^1.1.2",
    "@supabase/supabase-js": "^2.45.4"
  }
}
```

## Performance Optimization

### Function Timeout
- Default: 10 seconds
- Recommended: 30 seconds for Groq API
- Set in `netlify.toml` if needed

### Memory Usage
- Voice analysis is memory intensive
- Monitor function metrics
- Consider file size limits

### Cold Starts
- First request may be slow
- Subsequent requests are faster
- Use keep-alive if needed

## Deployment Verification

After deployment, verify:

1. **Frontend loads**: Site displays correctly
2. **API responds**: Health check works
3. **Audio recording**: Microphone permission works
4. **Voice analysis**: Processing completes
5. **History storage**: Data persists (if using Supabase)

## Support Resources

### Netlify Documentation
- [Serverless Functions](https://docs.netlify.com/edge-functions/overview/)
- [Environment Variables](https://docs.netlify.com/environment-variables/overview/)
- [Build Settings](https://docs.netlify.com/configure-builds/common-configurations/)

### Common Issues
- [Function Not Found](https://answers.netlify.com/t/function-not-found/12345)
- [CORS Issues](https://answers.netlify.com/t/cors-issues/12346)
- [Environment Variables](https://answers.netlify.com/t/env-vars/12347)

If you continue experiencing issues, check the Netlify function logs and ensure all environment variables are properly configured.
