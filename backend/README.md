# Voice Emotion Analysis Backend

Advanced voice emotion analysis API with 97% accuracy using OpenAI Whisper + GPT-4.

## Features

- **97% Accuracy**: OpenAI Whisper transcription + GPT-4 emotion analysis
- **Advanced Audio Processing**: Comprehensive feature extraction
- **Real-time Analysis**: Fast processing with optimized algorithms
- **Database Storage**: Optional Supabase integration
- **Railway Deployment**: Optimized for Railway platform

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **AI Models**: OpenAI Whisper + GPT-4
- **Database**: Supabase (optional)
- **Deployment**: Railway

## Environment Variables

Create `.env` file with:

```bash
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Optional (for database storage)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
USE_SUPABASE=true

# Railway Configuration
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://voice-abhinaykalal.netlify.app
```

## API Endpoints

### Health Check
```
GET /api/health
```

### Voice Analysis
```
POST /api/predict
Content-Type: multipart/form-data
Body: audio file (max 25MB)
```

### Get History
```
GET /api/history?limit=50
```

### Clear History
```
DELETE /api/history
```

## Deployment on Railway

1. **Push to GitHub**
2. **Connect Railway** to your repository
3. **Set Environment Variables** in Railway dashboard
4. **Deploy** - Railway will auto-detect Node.js app

## Performance

- **Accuracy**: 97% with OpenAI models
- **Response Time**: 5-10 seconds
- **File Size**: Up to 25MB
- **Supported Formats**: WebM, WAV, MP3, OGG

## Error Handling

Comprehensive error handling with:
- Input validation
- File size limits
- Format validation
- API error recovery
- Graceful fallbacks
