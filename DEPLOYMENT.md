# Deployment Guide

## Separate Frontend & Backend Deployment

This guide explains how to deploy your Emotion AI application with frontend on Vercel and backend on Railway.

---

## 📋 Prerequisites

- Node.js 18+ installed
- Railway account (free tier available)
- Vercel account (free tier available)
- Git repository with your code

---

## 🚀 Frontend Deployment (Vercel)

### Step 1: Build Frontend
```bash
npm run build:frontend
```

### Step 2: Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy frontend
vercel --prod
```

### Step 3: Update Frontend URL
After deployment, update `script.js` with your Vercel URL:
```javascript
// Replace this line in script.js:
const response = await fetch('https://your-vercel-app-url.vercel.app/predict', {
```

---

## 🚂 Backend Deployment (Railway)

### Step 1: Setup Environment
Copy `.env.example` to `.env` and add your API keys:
```bash
cp .env.example .env
```

Add your actual values:
- `GROQ_API_KEY`: Get from https://console.groq.com/keys
- `SUPABASE_URL`: Your Supabase project URL (optional)
- `SUPABASE_ANON_KEY`: Your Supabase anon key (optional)

### Step 2: Deploy to Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Deploy backend
railway up
```

### Step 3: Configure Railway
In Railway dashboard:
1. Set environment variables from your `.env` file
2. Ensure health check path is `/health`
3. Set restart policy to "ON_FAILURE"

---

## 🔗 Configuration Files

### Vercel Configuration (`vercel.json`)
- Frontend only deployment
- Static file serving
- Proper routing configuration

### Railway Configuration (`railway.json`)
- Node.js build with NIXPACKS
- Health checks enabled
- Auto-restart on failure

---

## ✅ Testing

### Frontend Tests
```bash
# Test build
npm run build:frontend

# Test locally
npm run dev
```

### Backend Tests
```bash
# Test locally
npm run start:backend

# Test health endpoint
curl https://your-railway-app-url.railway.app/health
```

---

## 🌐 Live URLs

After deployment:
- **Frontend**: `https://your-vercel-app-url.vercel.app`
- **Backend**: `https://your-railway-app-url.railway.app`
- **API Docs**: `https://your-railway-app-url.railway.app/health`

---

## 🔧 Troubleshooting

### CORS Issues
If you get CORS errors, ensure your Railway backend CORS includes your Vercel URL.

### Environment Variables
Make sure all required environment variables are set in Railway dashboard.

### Build Failures
Check that all dependencies are installed and Node.js version is 18+.

---

## 📞 Support

For deployment issues:
- Vercel: https://vercel.com/docs
- Railway: https://docs.railway.app
- This project: Check the configuration files in this repository
