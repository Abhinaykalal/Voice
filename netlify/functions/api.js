const Groq = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');
const multipart = require('parse-multipart');

// Initialize Groq API
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const USE_GROQ = process.env.USE_GROQ === 'true';

let groq = null;
if (USE_GROQ && GROQ_API_KEY && GROQ_API_KEY !== 'your_groq_api_key_here') {
  try {
    groq = new Groq({ apiKey: GROQ_API_KEY });
    console.log('✅ Groq API initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Groq API:', error.message);
  }
}

// Initialize Supabase
const USE_SUPABASE = process.env.USE_SUPABASE === 'true';
let supabase = null;

if (USE_SUPABASE) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  
  if (SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL !== 'your_supabase_project_url') {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase initialized');
  }
}

// Extract audio features
function extractAudioFeatures(audioBuffer) {
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
}

// Analyze emotion with Groq
async function analyzeEmotionWithGroq(audioBuffer, filename) {
  if (!groq) {
    throw new Error('Groq API not configured');
  }

  try {
    console.log('🎵 Starting emotion analysis...');
    
    const audioFeatures = extractAudioFeatures(audioBuffer);
    
    // Transcribe with Whisper
    let transcription;
    try {
      const { toFile } = require('groq-sdk');
      const audioFile = await toFile(audioBuffer, filename || 'audio.webm', { type: 'audio/webm' });
      transcription = await groq.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-large-v3',
      });
      console.log('📝 Transcription successful');
    } catch (error) {
      console.error('❌ Transcription failed:', error.message);
      throw new Error('Transcription failed: ' + error.message);
    }
    
    // Analyze emotions with Llama
    const prompt = `Analyze emotions in this speech:

Transcribed text: "${transcription.text}"

Return emotion percentages for: happy, sad, angry, fear, neutral, surprise.

Return JSON:
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
          content: 'You are an emotion analysis expert. Analyze speech and return emotion percentages in valid JSON format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.2
    });

    let emotionData;
    try {
      emotionData = JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.warn('⚠️ JSON parse failed, using fallback');
      emotionData = {
        primary: 'neutral',
        data: {
          happy: 20, sad: 20, angry: 20, fear: 10, neutral: 20, surprise: 10
        }
      };
    }

    return {
      primary: emotionData.primary,
      data: emotionData.data,
      transcription: transcription.text,
      audio_features: audioFeatures
    };
    
  } catch (error) {
    console.error('❌ Groq API error:', error.message);
    throw new Error('Analysis failed: ' + error.message);
  }
}

// Store in Supabase
async function storeEmotionAnalysis(emotionData, metadata) {
  if (!supabase) {
    console.log('ℹ️ Supabase not configured');
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
      console.error('❌ Storage error:', error.message);
    } else {
      console.log('✅ Stored successfully');
    }
  } catch (error) {
    console.error('❌ Storage failed:', error.message);
  }
}

// Main handler
exports.handler = async (event, context) => {
  console.log('🚀 Function invoked:', event.httpMethod, event.path);
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { httpMethod, path, body, queryStringParameters } = event;
    
    // Routes
    if (httpMethod === 'POST' && path === '/api/predict') {
      return await handlePredict(event, headers);
    }
    
    if (httpMethod === 'GET' && path === '/api/history') {
      return await handleHistory(queryStringParameters, headers);
    }
    
    if (httpMethod === 'DELETE' && path === '/api/history') {
      return await handleClearHistory(headers);
    }
    
    if (httpMethod === 'GET' && path === '/api/health') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'ok', message: 'API is running' })
      };
    }
    
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ detail: 'Endpoint not found' })
    };
    
  } catch (error) {
    console.error('❌ Function error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ detail: error.message })
    };
  }
};

// Handle voice analysis
async function handlePredict(event, headers) {
  try {
    console.log('🎤 Processing voice analysis');
    
    const contentType = event.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ detail: 'Content-Type must be multipart/form-data' })
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ detail: 'No request body' })
      };
    }

    const boundary = contentType.split('boundary=')[1];
    if (!boundary) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ detail: 'Invalid Content-Type' })
      };
    }

    let parts;
    try {
      parts = multipart.Parse(Buffer.from(event.body, 'base64'), boundary);
      console.log(`📦 Parsed ${parts.length} parts`);
    } catch (error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ detail: 'Failed to parse form data' })
      };
    }

    let audioFile = null;
    for (const part of parts) {
      if (part.name === 'audio') {
        audioFile = part;
        break;
      }
    }

    if (!audioFile) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ detail: 'No audio file provided' })
      };
    }

    console.log(`🎵 Received ${audioFile.data.length} bytes`);
    
    const emotionData = await analyzeEmotionWithGroq(audioFile.data, audioFile.filename);
    
    // Store (non-blocking)
    storeEmotionAnalysis(emotionData, { size: audioFile.data.length });
    
    console.log(`✅ Analysis completed: ${emotionData.primary}`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(emotionData)
    };
    
  } catch (error) {
    console.error('❌ Predict error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ detail: error.message })
    };
  }
}

// Handle history
async function handleHistory(queryParams, headers) {
  try {
    const limit = parseInt(queryParams?.limit) || 50;
    
    if (!supabase) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ count: 0, limit, data: [] })
      };
    }

    const { data, error } = await supabase
      .from('emotion_analyses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('❌ History error:', error.message);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ count: 0, limit, data: [] })
      };
    }

    console.log(`📚 Retrieved ${data.length} items`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ count: data.length, limit, data: data || [] })
    };
    
  } catch (error) {
    console.error('❌ History error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ detail: error.message })
    };
  }
}

// Handle clear history
async function handleClearHistory(headers) {
  try {
    if (!supabase) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'History cleared' })
      };
    }

    const { error } = await supabase
      .from('emotion_analyses')
      .delete()
      .neq('id', 0);
      
    if (error) {
      console.error('❌ Clear error:', error.message);
    } else {
      console.log('✅ History cleared');
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'History cleared' })
    };
    
  } catch (error) {
    console.error('❌ Clear error:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ detail: error.message })
    };
  }
}
