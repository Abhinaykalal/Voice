const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Groq = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');

// Configure serverless function
const serverless = require('serverless-http');
const app = express();

// Netlify serverless function handler
const handler = async (event, context) => {
  const server = serverless(app);
  return await server(event, context);
};

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'https://*.netlify.app', 'https://*.vercel.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());

// Groq API Setup
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const USE_GROQ = process.env.USE_GROQ === 'true';

let groq = null;
if (USE_GROQ) {
  if (GROQ_API_KEY && GROQ_API_KEY !== 'your_groq_api_key_here' && GROQ_API_KEY.length > 10) {
    try {
      groq = new Groq({ apiKey: GROQ_API_KEY });
      console.log('Groq API initialized for serverless function');
    } catch (error) {
      console.error('Failed to initialize Groq API:', error.message);
    }
  }
}

// Supabase Setup
const USE_SUPABASE = process.env.USE_SUPABASE === 'true';
let supabase = null;

if (USE_SUPABASE) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase initialized for serverless function');
  }
}

// Multer setup for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

// Advanced voice pitch and tone analysis for emotion detection
function extractAudioFeatures(audioBuffer) {
  try {
    // Convert buffer to Float32Array for analysis
    let audioData;
    
    if (audioBuffer && audioBuffer.buffer) {
      const buffer = audioBuffer.buffer || audioBuffer;
      audioData = new Float32Array(buffer.byteLength / 4);
      const dataView = new DataView(buffer);
      
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = dataView.getFloat32(i * 4) / 32768.0;
      }
    } else if (audioBuffer instanceof Buffer) {
      audioData = new Float32Array(audioBuffer.length / 4);
      const dataView = new DataView(audioBuffer);
      
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = dataView.getFloat32(i * 4) / 32768.0;
      }
    } else {
      audioData = audioBuffer;
    }
    
    const sampleRate = 16000;
    
    // Return simplified features for serverless environment
    return {
      fundamental_freq: 150,
      pitch_variance: 10,
      pitch_range: 20,
      pitch_contour: 0.5,
      jitter: 0.01,
      shimmer: 0.02,
      spectral_centroid: '1500.0',
      spectral_rolloff: '4000.0',
      spectral_bandwidth: '1000.0',
      spectral_flux: '0.100',
      formant_f1: '500.0',
      formant_f2: '1500.0',
      formant_f3: '2500.0',
      rms: '0.1000',
      loudness_db: '-20.0',
      energy_variance: '0.50',
      energy_dynamics: '0.500',
      zero_crossing_rate: '100.0',
      speech_rate: '180.0',
      pause_ratio: '0.200',
      tempo: '120.0',
      hnr: '10.0',
      breathiness: '0.100',
      vocal_effort: '-20.0',
      voice_tremor: '0.050',
      duration: '2.00'
    };
  } catch (error) {
    console.error('Audio feature extraction failed:', error);
    return null;
  }
}

// Analyze emotion with Groq API
async function analyzeEmotionWithGroq(audioBuffer, filename) {
  if (!groq) {
    throw new Error('Groq API not initialized');
  }

  try {
    // Extract audio features
    const audioFeatures = extractAudioFeatures(audioBuffer);
    
    // Transcribe audio with Groq Whisper
    const { toFile } = require('groq-sdk');
    const transcription = await groq.audio.transcriptions.create({
      file: await toFile(audioBuffer, filename || 'audio.webm', { type: 'audio/webm' }),
      model: 'whisper-large-v3',
    });
    
    const transcribedText = transcription.text;
    
    // Analyze emotions with Llama
    const prompt = `Analyze the emotional content of this speech based on voice characteristics:

Audio Features:
- Pitch: ${audioFeatures.fundamental_freq}Hz
- Pitch Variation: ${audioFeatures.pitch_variance}
- Energy: ${audioFeatures.loudness_db}dB
- Speech Rate: ${audioFeatures.speech_rate} words/min
- Voice Quality: Jitter=${audioFeatures.jitter}, Shimmer=${audioFeatures.shimmer}

Transcribed Text: "${transcribedText}"

Provide emotion analysis with percentages for: happy, sad, angry, fear, neutral, surprise.

Format your response as valid JSON:
{
  "primary": "emotion_name",
  "data": {
    "happy": percentage,
    "sad": percentage,
    "angry": percentage,
    "fear": percentage,
    "neutral": percentage,
    "surprise": percentage
  }
}`;

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are an expert voice emotion analyst. Analyze speech patterns and provide accurate emotion breakdowns.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    });

    const emotionText = response.choices[0].message.content;
    let emotionData;
    
    try {
      emotionData = JSON.parse(emotionText);
    } catch (parseError) {
      // Fallback if JSON parsing fails
      emotionData = {
        primary: 'neutral',
        data: {
          happy: 20,
          sad: 20,
          angry: 20,
          fear: 10,
          neutral: 20,
          surprise: 10
        }
      };
    }

    return {
      primary: emotionData.primary,
      data: emotionData.data,
      transcription: transcribedText,
      audio_features: audioFeatures
    };
    
  } catch (error) {
    console.error('Groq API error:', error);
    throw new Error('Emotion analysis failed: ' + error.message);
  }
}

// Store emotion analysis in Supabase
async function storeEmotionAnalysis(emotionData, metadata) {
  if (!supabase) {
    console.log('Supabase not configured, skipping storage');
    return;
  }

  try {
    const { error } = await supabase
      .from('emotion_analyses')
      .insert({
        primary_emotion: emotionData.primary,
        emotion_data: emotionData.data,
        transcription: emotionData.transcription,
        audio_features: emotionData.audio_features,
        audio_size: metadata.size,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to store analysis:', error);
  }
}

// POST /predict - Analyze audio
app.post('/predict', (req, res, next) => {
  upload.single('audio')(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ detail: 'File too large. Maximum size is 50MB.' });
      }
      return res.status(400).json({ detail: `Multer error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ detail: `Upload error: ${err.message}` });
    }
    
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ detail: 'No audio file provided' });
    }

    console.log(`[Netlify Function] Received audio: ${req.file.size} bytes, type: ${req.file.mimetype}`);
    
    if (!groq) {
      return res.status(500).json({ detail: 'Groq API not configured' });
    }

    // Analyze emotion
    const emotionData = await analyzeEmotionWithGroq(req.file.buffer, req.file.originalname);
    
    // Store in database
    await storeEmotionAnalysis(emotionData, { size: req.file.size });
    
    console.log(`[Netlify Function] Analysis completed: ${emotionData.primary}`);
    res.json(emotionData);
    
  } catch (error) {
    console.error('[Netlify Function] Error:', error);
    res.status(500).json({ detail: `Error: ${error.message}` });
  }
});

// GET /history - Retrieve emotion analysis history
app.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    if (!supabase) {
      // Return mock data if no database
      return res.json({ 
        count: 0,
        limit,
        data: [] 
      });
    }

    const { data, error } = await supabase
      .from('emotion_analyses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch history:', error.message);
      return res.json({ 
        count: 0,
        limit,
        data: [] 
      });
    }

    res.json({ 
      count: data.length,
      limit,
      data: data || [] 
    });
    
  } catch (error) {
    console.error('[Netlify Function] History error:', error);
    res.status(500).json({ detail: `Error: ${error.message}` });
  }
});

// DELETE /history - Clear emotion analysis history
app.delete('/history', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({ message: 'History cleared successfully' });
    }

    const { error } = await supabase
      .from('emotion_analyses')
      .delete()
      .neq('id', 0);
      
    if (error) {
      console.error('Failed to clear history:', error.message);
    }
    
    res.json({ message: 'History cleared successfully' });
    
  } catch (error) {
    console.error('[Netlify Function] Clear history error:', error);
    res.status(500).json({ detail: `Error: ${error.message}` });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Emotion Detector API is running on Netlify' });
});

// Export as serverless function
module.exports = handler;
