# Railway Deployment Guide

## Prerequisites
- Railway account connected to your GitHub repository
- All code pushed to GitHub repository

## Environment Variables Required
Set these in Railway dashboard:

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

### Railway Environment
```
NODE_ENV=production
PORT=3000
```

## Deployment Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Ready for Railway deployment"
git push origin main
```

### 2. Connect to Railway
1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your Voice repository
4. Railway will automatically detect and deploy

### 3. Configure Environment Variables
1. In Railway dashboard, go to "Variables" tab
2. Add all required environment variables from above
3. Railway will restart with new variables

### 4. Access Your Application
- Frontend: `https://your-app-name.up.railway.app`
- API Health: `https://your-app-name.up.railway.app/api/health`
- API Endpoints: `https://your-app-name.up.railway.app/api/predict`

## Railway Configuration Files

### railway.toml
- Configures deployment settings
- Sets health check path to `/api/health`
- Defines restart policy and timeout

### Dockerfile
- Multi-stage Node.js build
- Copies all necessary files (frontend + backend)
- Exposes port 3000
- Health check uses correct API endpoint

## Troubleshooting

### Application Not Starting
- Check environment variables in Railway dashboard
- Verify GROQ_API_KEY is valid
- Check Railway logs for errors

### API Not Working
- Ensure all environment variables are set
- Check health endpoint: `/api/health`
- Verify Railway is using correct port

### Database Issues
- Verify Supabase credentials
- Check Supabase project settings
- Ensure `USE_SUPABASE=true` if using database

## Features Working on Railway
✅ Voice recording and analysis
✅ Advanced pitch and tone detection
✅ Emotion history storage
✅ API endpoints with `/api/` prefix
✅ Health monitoring
✅ Automatic restarts on failure
