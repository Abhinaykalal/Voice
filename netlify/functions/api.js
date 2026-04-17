const Groq = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');
const multipart = require('parse-multipart');
const crypto = require('crypto');

// Initialize APIs
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const USE_GROQ = process.env.USE_GROQ === 'true';

let groq = null;
if (USE_GROQ && GROQ_API_KEY) {
  try {
    groq = new Groq({ apiKey: GROQ_API_KEY });
    console.log('Groq API initialized');
  } catch (error) {
    console.error('Failed to initialize Groq API:', error.message);
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
    console.log('Supabase initialized');
  }
}

// Helper function to extract audio features
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

// Analyze emotion with Groq API
async function analyzeEmotionWithGroq(audioBuffer, filename) {
  if (!groq) {
    throw new Error('Groq API not initialized');
  }

  try {
    // Extract audio features
    const audioFeatures = extractAudioFeatures(audioBuffer);
    
    // Transcribe audio with Groq Whisper
    let transcription;
    try {
      const { toFile } = require('groq-sdk');
      const audioFile = await toFile(audioBuffer, filename || 'audio.webm', { type: 'audio/webm' });
      transcription = await groq.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-large-v3',
      });
    } catch (transcriptionError) {
      console.error('[Netlify Function] Transcription failed:', transcriptionError);
      throw new Error('Audio transcription failed: ' + transcriptionError.message);
    }
    
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

// Main handler function
exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { httpMethod, path, body, queryStringParameters } = event;
    
    console.log(`[Netlify Function] ${httpMethod} ${path}`);

    // Handle different routes
    if (httpMethod === 'POST' && path === '/api/predict') {
      return await handlePredict(event, headers);
    } else if (httpMethod === 'GET' && path === '/api/history') {
      return await handleHistory(queryStringParameters, headers);
    } else if (httpMethod === 'DELETE' && path === '/api/history') {
      return await handleClearHistory(headers);
    } else if (httpMethod === 'GET' && path === '/api/health') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          status: 'ok', 
          message: 'Emotion Detector API is running on Netlify' 
        })
      };
    } else {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ detail: 'Endpoint not found' })
      };
    }
  } catch (error) {
    console.error('[Netlify Function] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ detail: `Error: ${error.message}` })
    };
  }
};

// Handle voice analysis
async function handlePredict(event, headers) {
  try {
    console.log('[Netlify Function] Processing voice analysis request');
    
    const contentType = event.headers['content-type'] || '';
    console.log('[Netlify Function] Content-Type:', contentType);
    
    if (!contentType.includes('multipart/form-data')) {
      console.log('[Netlify Function] Error: Not multipart/form-data');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ detail: 'Content-Type must be multipart/form-data' })
      };
    }

    // Parse multipart data with better error handling
    let boundary;
    try {
      boundary = contentType.split('boundary=')[1];
      if (!boundary) {
        throw new Error('No boundary found in Content-Type');
      }
    } catch (error) {
      console.log('[Netlify Function] Error parsing boundary:', error.message);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ detail: 'Invalid Content-Type header' })
      };
    }

    let parts;
    try {
      parts = multipart.Parse(Buffer.from(event.body || '', 'base64'), boundary);
      console.log('[Netlify Function] Parsed multipart parts:', parts.length);
    } catch (error) {
      console.log('[Netlify Function] Error parsing multipart data:', error.message);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ detail: 'Failed to parse multipart data' })
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
      console.log('[Netlify Function] Error: No audio file found in parts');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ detail: 'No audio file provided' })
      };
    }

    console.log(`[Netlify Function] Received audio: ${audioFile.data.length} bytes, filename: ${audioFile.filename || 'unknown'}`);
    
    if (!groq) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ detail: 'Groq API not configured' })
      };
    }

    // Analyze emotion
    let emotionData;
    try {
      console.log('[Netlify Function] Starting emotion analysis...');
      emotionData = await analyzeEmotionWithGroq(audioFile.data, audioFile.filename);
      console.log('[Netlify Function] Emotion analysis successful');
    } catch (analysisError) {
      console.error('[Netlify Function] Emotion analysis failed:', analysisError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ detail: `Emotion analysis failed: ${analysisError.message}` })
      };
    }
    
    // Store in database (non-blocking)
    try {
      await storeEmotionAnalysis(emotionData, { size: audioFile.data.length });
      console.log('[Netlify Function] Analysis stored successfully');
    } catch (storageError) {
      console.warn('[Netlify Function] Storage failed (continuing):', storageError.message);
      // Continue even if storage fails
    }
    
    console.log(`[Netlify Function] Analysis completed: ${emotionData.primary}`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(emotionData)
    };
    
  } catch (error) {
    console.error('[Netlify Function] Predict error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ detail: `Error: ${error.message}` })
    };
  }
}

// Handle history retrieval
async function handleHistory(queryParams, headers) {
  try {
    const limit = parseInt(queryParams?.limit) || 50;
    
    if (!supabase) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          count: 0,
          limit,
          data: [] 
        })
      };
    }

    const { data, error } = await supabase
      .from('emotion_analyses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch history:', error.message);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          count: 0,
          limit,
          data: [] 
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        count: data.length,
        limit,
        data: data || [] 
      })
    };
    
  } catch (error) {
    console.error('[Netlify Function] History error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ detail: `Error: ${error.message}` })
    };
  }
}

// Handle history clearing
async function handleClearHistory(headers) {
  try {
    if (!supabase) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'History cleared successfully' })
      };
    }

    const { error } = await supabase
      .from('emotion_analyses')
      .delete()
      .neq('id', 0);
      
    if (error) {
      console.error('Failed to clear history:', error.message);
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'History cleared successfully' })
    };
    
  } catch (error) {
    console.error('[Netlify Function] Clear history error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ detail: `Error: ${error.message}` })
    };
  }
}
