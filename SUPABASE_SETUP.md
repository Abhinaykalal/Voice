# Supabase Setup Guide

## What is Supabase?

Supabase is a free, open-source Firebase alternative that provides:
- PostgreSQL database for storing emotion analysis history
- Real-time subscriptions
- User authentication (optional)
- File storage (optional)

## Setup Steps

### Step 1: Create Free Supabase Account

1. Go to https://supabase.com
2. Click "Sign up"
3. Create an account (free tier available)

### Step 2: Create a New Project

1. In Supabase dashboard, click "New Project"
2. Give it a name: `emotion-detector`
3. Set a strong password
4. Choose a region closest to you
5. Click "Create new project" (waits 2-3 minutes)

### Step 3: Create the `emotion_analyses` Table

1. In your Supabase project, go to **SQL Editor**
2. Click **New Query**
3. Paste this SQL:

```sql
CREATE TABLE emotion_analyses (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  primary_emotion VARCHAR(50) NOT NULL,
  emotion_data JSONB NOT NULL,
  transcription TEXT,
  audio_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_emotion_analyses_created_at 
ON emotion_analyses(created_at DESC);

-- Enable RLS (Row Level Security) for public access
ALTER TABLE emotion_analyses ENABLE ROW LEVEL SECURITY;

-- Allow public read/write
CREATE POLICY "Allow public access" 
ON emotion_analyses FOR ALL 
USING (true) 
WITH CHECK (true);
```

4. Click **Run** (Execute button)

### Step 4: Get Your Credentials

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** (under `API`)
   - **anon public key** (under `API`)

3. Update your `.env` file:

```env
SUPABASE_URL=your_project_url_here
SUPABASE_ANON_KEY=your_anon_key_here
USE_SUPABASE=true
```

### Step 5: Restart Server

```powershell
cd "d:\emotion detector"
npm install
npm start
```

You should see:
```
✅ Supabase initialized with URL: https://...
🗄️  Emotion analysis history will be saved to Supabase
```

## Using Supabase Features

### Auto-Save Emotion Analysis

When you record/upload audio and click "Analyze", the results are automatically saved to Supabase:

```json
{
  "id": "uuid...",
  "primary_emotion": "happy",
  "emotion_data": {
    "happy": 65.2,
    "sad": 10.1,
    "angry": 5.2,
    "fear": 2.3,
    "neutral": 12.4,
    "surprise": 4.8
  },
  "transcription": "I'm so excited about this project!",
  "audio_size": 45230,
  "created_at": "2026-04-09T17:30:00.000Z"
}
```

### Retrieve History via API

```bash
# Get last 50 analyses
curl http://localhost:3000/history

# Get last 10 analyses
curl http://localhost:3000/history?limit=10
```

Response:
```json
{
  "count": 5,
  "limit": 50,
  "data": [
    {
      "id": "uuid...",
      "primary_emotion": "happy",
      ...
    }
  ]
}
```

### View Data in Supabase Dashboard

1. Open your Supabase project
2. Go to **Table Editor**
3. Click on **emotion_analyses** table
4. See all your emotion analyses as they come in!

## Troubleshooting

**Error: "Supabase is not configured"**
- Make sure `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in `.env`
- Make sure `USE_SUPABASE=true`
- Restart the server

**Error: "Failed to store analysis"**
- Check your Supabase project is active
- Verify the table was created correctly
- Check RLS (Row Level Security) policies

**No data appearing in Supabase?**
- Make sure `USE_SUPABASE=true` in `.env`
- Check server console for errors
- Reload the table editor page

## Next Steps

- You can add more columns to `emotion_analyses` as needed
- Add authentication to track users
- Create dashboards to visualize emotion trends
- Export data to CSV from Supabase dashboard
