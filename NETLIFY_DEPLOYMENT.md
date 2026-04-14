# Netlify Deployment Guide

## Overview
This guide explains how to deploy the Voice Emotion AI application on Netlify using serverless functions.

## Prerequisites
- Netlify account connected to your GitHub repository
- All code pushed to GitHub repository
- Valid Groq API key

## Environment Variables Required
Set these in Netlify dashboard under Site settings > Build & deploy > Environment:

### Groq API Configuration
```
GROQ_API_KEY=your_groq_api_key_here
USE_GROQ=true
```

### Supabase Database (Optional)
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
USE_SUPABASE=true
```

### Node.js Environment
```
NODE_VERSION=18
```

## Deployment Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Ready for Netlify deployment"
git push origin main
```

### 2. Connect to Netlify
1. Go to [netlify.com](https://netlify.com)
2. Click "Add new site" -> "Import an existing project"
3. Connect to your Git provider (GitHub)
4. Select your Voice repository

### 3. Configure Build Settings
In Netlify build settings:
- **Build command**: `npm run build:netlify`
- **Publish directory**: `public`
- **Functions directory**: `netlify/functions`

### 4. Set Environment Variables
1. Go to Site settings > Build & deploy > Environment
2. Add all required environment variables from above
3. Click "Save"

### 5. Deploy
Netlify will automatically:
- Run the build command
- Deploy static files to CDN
- Deploy serverless functions
- Configure API routes

## Netlify Configuration Files

### netlify.toml
- Configures build settings and redirects
- Maps `/api/*` to serverless functions
- Sets up development environment

### Serverless Functions
- `netlify/functions/predict.js` - Voice analysis API
- `netlify/functions/history.js` - History management API
- Both use serverless-http for Express compatibility

## API Endpoints on Netlify

After deployment, your API endpoints will be available at:
- **Voice Analysis**: `https://your-site.netlify.app/api/predict`
- **Get History**: `https://your-site.netlify.app/api/history`
- **Clear History**: `https://your-site.netlify.app/api/history` (DELETE)
- **Health Check**: `https://your-site.netlify.app/api/health`

## Frontend API Calls
The frontend automatically uses the correct API endpoints:
- `/api/predict` for voice analysis
- `/api/history` for history management

## Features Working on Netlify

### Voice Analysis
- Audio recording with WebM format
- Voice pitch and tone detection
- Emotion analysis using Groq API
- Real-time waveform visualization

### Data Storage
- Supabase integration for history
- In-memory fallback for development
- Complete emotion data storage

### Performance
- CDN for static assets
- Serverless functions for API
- Automatic scaling
- Global edge network

## Troubleshooting

### Build Errors
- Check all dependencies in package.json
- Verify build command: `npm run build:netlify`
- Check Node.js version (18)

### Function Errors
- Verify environment variables in Netlify dashboard
- Check function logs in Netlify
- Ensure serverless-http dependency

### API Not Working
- Check function deployment status
- Verify CORS settings in functions
- Test with Netlify CLI locally

### Database Issues
- Verify Supabase credentials
- Check Supabase project settings
- Ensure `USE_SUPABASE=true` if using database

## Local Development with Netlify CLI

### Install Netlify CLI
```bash
npm install -g netlify-cli
```

### Run Locally
```bash
netlify dev
```

This will:
- Start local development server
- Run serverless functions locally
- Provide hot reload for frontend

## Deployment Benefits

### Performance
- Global CDN distribution
- Edge computing for serverless
- Automatic HTTPS
- Custom domain support

### Scalability
- Automatic scaling
- No server management
- Pay-per-use pricing
- High availability

### Development
- Git-based deployment
- Preview deployments
- Rollback capability
- Form handling

## Cost Considerations

### Free Tier (Netlify)
- 100GB bandwidth/month
- 300 build minutes/month
- Serverless functions (125,000 calls/month)
- Sites: 1 (personal) or 3 (team)

### Groq API Costs
- Free tier available
- Pay-per-use beyond free limits
- Check Groq pricing for details

### Supabase Costs
- Free tier available
- Database storage and bandwidth limits
- Check Supabase pricing for details

## Advanced Configuration

### Custom Domain
1. Go to Site settings > Domain management
2. Add custom domain
3. Configure DNS records

### Environment-Specific Builds
```toml
[context.production]
  command = "npm run build:production"

[context.deploy-preview]
  command = "npm run build:preview"
```

### Headers and Redirects
```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
```

Your Voice Emotion AI application is now fully configured for Netlify deployment!
