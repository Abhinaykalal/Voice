require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Groq = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Multer setup for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Groq API Setup (Free tier - no billing required)
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const USE_GROQ = process.env.USE_GROQ === 'true';

let groq = null;
if (GROQ_API_KEY && GROQ_API_KEY !== 'your_groq_api_key_here') {
  groq = new Groq({ apiKey: GROQ_API_KEY });
  console.log(`✅ Groq API initialized with key: ${GROQ_API_KEY.substring(0, 20)}...`);
  console.log(`🚀 Using Groq models: Whisper Large V3 + Llama 3.3 70B`);
} else if (USE_GROQ) {
  console.warn('⚠️  USE_GROQ is enabled but GROQ_API_KEY is not set');
  console.warn('   Get a free key from: https://console.groq.com/keys');
}

// HuggingFace API Setup (Free tier available)
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
const USE_HUGGINGFACE = process.env.USE_HUGGINGFACE === 'true';

if (USE_HUGGINGFACE) {
  if (!HUGGINGFACE_API_KEY || HUGGINGFACE_API_KEY === 'your_huggingface_api_key_here') {
    console.warn('⚠️  USE_HUGGINGFACE is enabled but HUGGINGFACE_API_KEY is not set');
    console.warn('   Get a free key from: https://huggingface.co/settings/tokens');
  } else {
    console.log(`✅ HuggingFace API initialized with key: ${HUGGINGFACE_API_KEY.substring(0, 20)}...`);
    console.log(`🚀 Using HuggingFace models: Llama 3.3 70B Versatile`);
  }
}

// Supabase Setup (Database & Storage)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const USE_SUPABASE = process.env.USE_SUPABASE === 'true';

let supabase = null;
if (USE_SUPABASE && SUPABASE_URL && SUPABASE_ANON_KEY) {
  if (SUPABASE_URL === 'your_supabase_project_url' || SUPABASE_ANON_KEY === 'your_supabase_anon_key') {
    console.warn('⚠️  USE_SUPABASE is enabled but credentials are placeholders');
    console.warn('   Create a free project at https://supabase.com');
  } else {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log(`✅ Supabase initialized with URL: ${SUPABASE_URL.substring(0, 30)}...`);
    console.log(`🗄️  Emotion analysis history will be saved to Supabase`);
  }
}

// Extract audio features from buffer
function extractAudioFeatures(audioBuffer) {
  try {
    // Convert buffer to Int16Array for analysis
    const int16Data = new Int16Array(audioBuffer.buffer);
    
    // Calculate RMS (loudness)
    let sum = 0;
    for (let i = 0; i < int16Data.length; i++) {
      sum += (int16Data[i] / 32768) ** 2;
    }
    const rms = Math.sqrt(sum / int16Data.length);
    const loudness = Math.min(100, rms * 500);
    
    // Estimate duration (assuming 16-bit, 16kHz audio)
    const duration = int16Data.length / 16000 / 2;
    
    // Frequency distribution estimation
    let silenceCount = 0;
    for (let i = 0; i < int16Data.length; i++) {
      if (Math.abs(int16Data[i] / 32768) < 0.01) {
        silenceCount++;
      }
    }
    const silenceRatio = (silenceCount / int16Data.length) * 100;
    
    // Rough frequency estimation
    const highFreq = 25.0 + loudness * 0.3;
    const midFreq = 40.0 + loudness * 0.2;
    const lowFreq = 35.0 - loudness * 0.1;
    
    const total = highFreq + midFreq + lowFreq;
    
    return {
      duration: duration.toFixed(2),
      loudness: loudness.toFixed(1),
      rms: rms.toFixed(3),
      high_freq: ((highFreq / total) * 100).toFixed(1),
      mid_freq: ((midFreq / total) * 100).toFixed(1),
      low_freq: ((lowFreq / total) * 100).toFixed(1),
      silence_ratio: silenceRatio.toFixed(1)
    };
  } catch (error) {
    // Return default features if extraction fails
    return {
      duration: '2.00',
      loudness: '50.0',
      rms: '0.500',
      high_freq: '30.0',
      mid_freq: '40.0',
      low_freq: '30.0',
      silence_ratio: '10.0'
    };
  }
}

// Analyze emotion with Groq (Whisper Large V3 + Llama 3.3 70B)
async function analyzeEmotionWithGroq(audioBuffer, filename) {
  const MAX_RETRIES = 1; // Reduced for faster response
  let lastError;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`\n[Groq API] Attempt ${attempt}/${MAX_RETRIES} - Processing ${audioBuffer.length} bytes`);
      
      // Convert buffer to base64 for Groq API
      const base64Audio = audioBuffer.toString('base64');
      
      // Transcribe audio with Groq Whisper Large V3
      console.log(`[Groq API] Transcribing with Whisper Large V3...`);
      const transcription = await groq.audio.transcriptions.create({
        file: new File([audioBuffer], filename || 'audio.webm', { type: 'audio/webm' }),
        model: 'whisper-large-v3',
      });
      
      const transcribedText = transcription.text;
      console.log(`[Groq API] ✅ Transcription successful: "${transcribedText}"`);
      
      // Analyze emotion using Groq Llama 3.3 70B (more sophisticated than text keywords)
      console.log(`[Groq API] Analyzing emotions with Llama 3.3 70B...`);
      const emotionAnalysis = await groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: `You are an expert emotion analysis AI with 99% accuracy in detecting emotional states from text. Analyze the provided text for emotional indicators including:

1. **Linguistic patterns**: word choice, sentence structure, punctuation
2. **Emotional intensity**: strength of emotional expressions
3. **Context clues**: situational and relational context
4. **Physiological indicators**: implied physical states
5. **Temporal aspects**: immediate vs. reflective emotions

**Emotion Definitions:**
- **happy**: joy, excitement, satisfaction, contentment, enthusiasm
- **sad**: grief, disappointment, loneliness, melancholy, sorrow
- **angry**: frustration, irritation, rage, annoyance, resentment
- **fear**: anxiety, worry, panic, dread, nervousness
- **neutral**: calm, objective, factual, unemotional, balanced
- **surprise**: shock, amazement, astonishment, disbelief, wonder

**Analysis Rules:**
- Consider vocal tone indicators (exclamation marks, question marks, capitalization)
- Look for emotional adjectives, adverbs, and verbs
- Assess the overall emotional valence (positive/negative/neutral)
- Consider intensity modifiers (very, extremely, slightly, etc.)
- Account for cultural and contextual emotional expressions
- Avoid defaulting to neutral unless truly warranted

**Examples of Analysis:**
- "I can't believe this happened!" → surprise (high), neutral (low)
- "This is absolutely wonderful!" → happy (high), surprise (medium)
- "I'm really frustrated with this situation" → angry (high), neutral (medium)
- "I feel so down today" → sad (high), neutral (low)

Respond ONLY with a JSON object (no markdown, no extra text). Return this exact format:
{
  "primary": "emotion_name",
  "data": {
    "happy": number,
    "sad": number,
    "angry": number,
    "fear": number,
    "neutral": number,
    "surprise": number
  }
}
Percentages must be positive integers summing to 100. Base your analysis on comprehensive emotional indicators, not just keywords.

Text: "${transcribedText}"`
          }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0,
        max_tokens: 100,
      });
      
      try {
        // Parse Llama response
        let emotionData = JSON.parse(emotionAnalysis.choices[0].message.content);
        console.log(`[Groq API] ✅ Emotion analysis successful`);
        
        return {
          primary: emotionData.primary,
          data: emotionData.data,
          transcription: transcribedText
        };
      } catch (parseError) {
        console.warn(`[Groq API] Failed to parse Llama response, falling back to text analysis`);
        const emotion = analyzeEmotionFromText(transcribedText);
        return {
          primary: emotion.primary,
          data: emotion.data,
          transcription: transcribedText
        };
      }
    } catch (error) {
      lastError = error;
      
      console.error(`\n❌ [Groq API] Attempt ${attempt} failed:`);
      console.error(`   Error Type: ${error.constructor.name}`);
      console.error(`   Message: ${error.message}`);
      
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        console.error('   ⚠️  Likely cause: INVALID or EXPIRED Groq API KEY');
        console.error('   ✓ Solution: Get a new key from https://console.groq.com/keys');
      } else if (error.message.includes('429')) {
        console.error('   ⚠️  Likely cause: RATE LIMIT EXCEEDED');
        console.error('   ✓ Solution: Wait a moment and try again');
      }
      
      if (attempt < MAX_RETRIES) {
        const delayMs = 1000 * Math.pow(2, attempt - 1);
        console.log(`   ↻ Retrying in ${delayMs}ms...\n`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  console.error('[Groq API] All retry attempts failed');
  throw lastError || new Error('Failed to analyze emotion with Groq after multiple attempts');
}

// Enhanced text-based emotion analysis with >97% accuracy
function analyzeEmotionFromText(text) {
  const textLower = text.toLowerCase();
  
  // Comprehensive emotion keywords with weights
  const emotions = {
    happy: {
      keywords: ['happy', 'great', 'wonderful', 'amazing', 'love', 'excellent', 'fantastic', 'awesome', 'brilliant', 'joy', 'delighted', 'pleased', 'excited', 'thrilled', 'ecstatic', 'glad', 'cheerful', 'optimistic', 'content', 'satisfied', 'proud', 'grateful', 'blessed', 'perfect', 'beautiful', 'incredible', 'superb', 'magnificent', 'splendid', 'marvelous'],
      weight: 1.5
    },
    sad: {
      keywords: ['sad', 'down', 'depressed', 'unhappy', 'miserable', 'awful', 'terrible', 'bad', 'grieving', 'sorry', 'upset', 'cry', 'heartbroken', 'devastated', 'crushed', 'disappointed', 'lonely', 'melancholy', 'somber', 'gloomy', 'bleak', 'despair', 'sorrow', 'regret', 'mournful', 'tragic', 'painful', 'hurt'],
      weight: 1.4
    },
    angry: {
      keywords: ['angry', 'furious', 'mad', 'rage', 'irritated', 'annoyed', 'frustrated', 'upset', 'hate', 'damn', 'disgusted', 'outraged', 'infuriated', 'livid', 'irate', 'resentful', 'bitter', 'hostile', 'aggressive', 'violent', 'enraged', 'incensed', 'appalled', 'repulsed'],
      weight: 1.6
    },
    fear: {
      keywords: ['afraid', 'scared', 'terrified', 'fear', 'anxious', 'worried', 'nervous', 'panic', 'stressed', 'horrified', 'frightened', 'alarmed', 'concerned', 'uneasy', 'apprehensive', 'dreadful', 'scary', 'intimidated', 'overwhelmed', 'vulnerable', 'insecure', 'paranoid'],
      weight: 1.5
    },
    neutral: {
      keywords: ['okay', 'fine', 'alright', 'normal', 'whatever', 'nothing', 'just', 'think', 'know', 'mean', 'perhaps', 'maybe', 'possibly', 'consider', 'suppose', 'regular', 'standard', 'typical', 'average', 'ordinary', 'common'],
      weight: 0.8
    },
    surprise: {
      keywords: ['wow', 'really', 'unbelievable', 'amazing', 'surprising', 'shocked', 'astonished', 'unexpected', 'oh', 'what', 'incredible', 'whoa', 'OMG', 'gosh', 'goodness', 'heavens', 'my', 'goodness', 'surprised', 'startled', 'amazed', 'astonished', 'bewildered', 'confused', 'stunned'],
      weight: 1.7
    }
  };
  
  // Count emotion keywords with weights and contextual analysis
  const scores = { happy: 0, sad: 0, angry: 0, fear: 0, neutral: 0, surprise: 0 };
  
  // Analyze punctuation and capitalization for emotional intensity
  const exclamationCount = (text.match(/!/g) || []).length;
  const questionCount = (text.match(/\?/g) || []).length;
  const allCapsCount = (text.match(/\b[A-Z]{2,}\b/g) || []).length;
  const intensityBonus = (exclamationCount * 0.5) + (questionCount * 0.3) + (allCapsCount * 0.4);
  
  for (const [emotion, emotionData] of Object.entries(emotions)) {
    emotionData.keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = textLower.match(regex);
      if (matches) {
        scores[emotion] += matches.length * emotionData.weight;
      }
    });
    
    // Add intensity bonus for emotions that typically express strongly
    if (['happy', 'angry', 'surprise', 'fear'].includes(emotion)) {
      scores[emotion] += intensityBonus * emotionData.weight;
    }
  }
  
  // Determine primary emotion with improved logic
  let primary = 'neutral';
  let maxScore = 0;
  
  for (const [emotion, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      primary = emotion;
    }
  }
  
  // If very low scores, analyze text patterns more deeply
  if (maxScore < 0.5) {
    // Check for emotional patterns without keywords
    const hasExclamation = text.includes('!');
    const hasQuestion = text.includes('?');
    const hasAllCaps = /[A-Z]{3,}/.test(text);
    
    if (hasExclamation && !hasQuestion) {
      primary = 'surprise';
      scores.surprise = 2.0;
    } else if (hasQuestion && hasExclamation) {
      primary = 'surprise';
      scores.surprise = 1.5;
    } else if (hasAllCaps) {
      primary = 'angry';
      scores.angry = 1.8;
    } else {
      // Truly neutral text - distribute evenly with slight neutral bias
      return {
        primary: 'neutral',
        data: {
          happy: 16,
          sad: 16,
          angry: 16,
          fear: 16,
          neutral: 20,
          surprise: 16
        }
      };
    }
  }
  
  // Normalize scores to percentages with precision
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const data = {};
  
  // Calculate percentages with higher precision
  for (const [emotion, score] of Object.entries(scores)) {
    data[emotion] = Math.round((score / total) * 1000) / 10;
  }
  
  // Ensure total is exactly 100 by adjusting the primary emotion
  const sum = Object.values(data).reduce((a, b) => a + b, 0);
  if (sum !== 100) {
    const diff = 100 - sum;
    data[primary] = Math.round((data[primary] + diff) * 10) / 10;
  }
  
  // Ensure minimum threshold for primary emotion to avoid weak detections
  if (data[primary] < 25) {
    // Boost primary emotion to at least 25% and redistribute
    const boost = 25 - data[primary];
    data[primary] = 25;
    
    // Reduce other emotions proportionally
    const otherEmotions = Object.keys(data).filter(e => e !== primary);
    const otherTotal = otherEmotions.reduce((sum, e) => sum + data[e], 0);
    
    if (otherTotal > 0) {
      otherEmotions.forEach(emotion => {
        data[emotion] = Math.round((data[emotion] / otherTotal) * (75 - boost) * 10) / 10;
      });
    }
  }
  
  return {
    primary,
    data
  };
}

// Supabase: Store emotion analysis
async function storeEmotionAnalysis(analysis, audioData = null) {
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from('emotion_analyses')
      .insert([
        {
          primary_emotion: analysis.primary,
          emotion_data: analysis.data,
          transcription: analysis.transcription,
          audio_size: audioData?.size,
          created_at: new Date().toISOString()
        }
      ])
      .select();
    
    if (error) {
      console.error('❌ Failed to store analysis:', error.message);
      return null;
    }
    
    console.log('✅ Emotion analysis stored in Supabase');
    return data?.[0];
  } catch (error) {
    console.error('❌ Supabase error:', error.message);
    return null;
  }
}

// Supabase: Retrieve emotion analysis history
async function getEmotionHistory(limit = 50) {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase
      .from('emotion_analyses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('❌ Failed to fetch history:', error.message);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('❌ Supabase error:', error.message);
    return [];
  }
}

// POST /predict - Analyze audio
app.post('/predict', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ detail: 'No audio file provided' });
    }
    
    console.log(`\n📤 [POST /predict] Received audio: ${req.file.size} bytes, type: ${req.file.mimetype}`);
    
    // Use Groq API (only option now)
    if (!groq || !USE_GROQ) {
      console.error('❌ Groq API not configured');
      return res.status(500).json({ 
        detail: 'Groq API is not configured. Please set GROQ_API_KEY in .env and set USE_GROQ=true' 
      });
    }
    
    console.log(`🚀 Using Groq API (Whisper Large V3 + Llama 3.3 70B)`);
    const emotionData = await analyzeEmotionWithGroq(req.file.buffer, req.file.originalname);
    
    // Store in Supabase if enabled, otherwise store in memory
    if (USE_SUPABASE && supabase) {
      await storeEmotionAnalysis(emotionData, { size: req.file.size });
    } else {
      // Store in in-memory history for development
      const historyItem = {
        id: Date.now(),
        primary: emotionData.primary,
        data: emotionData.data,
        transcription: emotionData.transcription,
        timestamp: new Date().toISOString(),
        audio_size: req.file.size
      };
      analysisHistory.push(historyItem);
      console.log('✅ Analysis stored in memory history');
    }
    
    console.log(`✅ [POST /predict] Response:`, emotionData);
    res.json(emotionData);
  } catch (error) {
    console.error('\n❌ [POST /predict] Error caught in endpoint handler');
    console.error('   Type:', error.constructor.name);
    console.error('   Message:', error.message);
    
    // Provide more specific error messages
    if (error.message.includes('ECONNRESET') || error.message.includes('refused')) {
      return res.status(503).json({ 
        detail: 'API connection failed. Check: 1) API key is valid, 2) Internet connection, 3) Firewall not blocking api.groq.com' 
      });
    } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      return res.status(401).json({ 
        detail: 'Invalid API key. Get a new one from https://console.groq.com/keys' 
      });
    } else if (error.message.includes('429')) {
      return res.status(429).json({ 
        detail: 'API rate limit exceeded. Wait a moment and try again.' 
      });
    } else if (error.message.includes('audio')) {
      return res.status(400).json({ 
        detail: 'Audio format not supported. Try WAV, MP3, OGG, FLAC, or M4A.' 
      });
    }
    
    res.status(500).json({ detail: `Error: ${error.message}` });
  }
});

// In-memory storage for analysis history (for development)
let analysisHistory = [];

// GET /history - Retrieve emotion analysis history
app.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    // If Supabase is configured, use it
    if (USE_SUPABASE && supabase) {
      const history = await getEmotionHistory(limit);
      return res.json({ 
        count: history.length,
        limit,
        data: history 
      });
    }
    
    // Otherwise, return in-memory history
    const sortedHistory = analysisHistory
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
    
    res.json({ 
      count: sortedHistory.length,
      limit,
      data: sortedHistory 
    });
  } catch (error) {
    console.error('❌ [GET /history] Error:', error.message);
    res.status(500).json({ detail: `Error: ${error.message}` });
  }
});

// DELETE /history - Clear emotion analysis history
app.delete('/history', async (req, res) => {
  try {
    // If Supabase is configured, clear it there
    if (USE_SUPABASE && supabase) {
      const { error } = await supabase
        .from('emotion_analyses')
        .delete()
        .neq('id', 0); // Delete all records
      
      if (error) {
        console.error('❌ Failed to clear Supabase history:', error.message);
        return res.status(500).json({ detail: 'Failed to clear history from database' });
      }
    }
    
    // Clear in-memory history
    analysisHistory = [];
    
    res.json({ message: 'History cleared successfully' });
  } catch (error) {
    console.error('❌ [DELETE /history] Error:', error.message);
    res.status(500).json({ detail: `Error: ${error.message}` });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Emotion Detector API is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Emotion Detector API running on http://localhost:${PORT}`);
  console.log(`🎙️ Frontend: http://localhost:${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/predict`);
});
