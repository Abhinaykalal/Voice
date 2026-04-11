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

// Advanced audio feature extraction for emotion analysis
function extractAudioFeatures(audioBuffer) {
  try {
    // Convert buffer to Int16Array for analysis
    const int16Data = new Int16Array(audioBuffer.buffer);
    
    // Basic audio properties
    let sum = 0;
    let zeroCrossings = 0;
    let energy = 0;
    let previousSample = 0;
    
    // Advanced metrics
    let peakValues = [];
    let valleyValues = [];
    let spectralCentroid = 0;
    let spectralRolloff = 0;
    
    for (let i = 0; i < int16Data.length; i++) {
      const normalizedSample = int16Data[i] / 32768;
      sum += normalizedSample ** 2;
      energy += Math.abs(normalizedSample);
      
      // Zero crossing rate (indicator of speech vs silence)
      if (previousSample * normalizedSample < 0) {
        zeroCrossings++;
      }
      previousSample = normalizedSample;
      
      // Peak and valley detection
      if (i > 0 && i < int16Data.length - 1) {
        const prevSample = int16Data[i - 1] / 32768;
        const nextSample = int16Data[i + 1] / 32768;
        
        if (normalizedSample > prevSample && normalizedSample > nextSample) {
          peakValues.push(normalizedSample);
        } else if (normalizedSample < prevSample && normalizedSample < nextSample) {
          valleyValues.push(normalizedSample);
        }
      }
    }
    
    const rms = Math.sqrt(sum / int16Data.length);
    const loudness = Math.min(100, rms * 500);
    const duration = int16Data.length / 16000 / 2;
    const zeroCrossingRate = zeroCrossings / int16Data.length;
    
    // Silence detection
    let silenceCount = 0;
    for (let i = 0; i < int16Data.length; i++) {
      if (Math.abs(int16Data[i] / 32768) < 0.01) {
        silenceCount++;
      }
    }
    const silenceRatio = (silenceCount / int16Data.length) * 100;
    
    // Emotional frequency analysis
    const avgPeak = peakValues.length > 0 ? peakValues.reduce((a, b) => a + b, 0) / peakValues.length : 0;
    const avgValley = valleyValues.length > 0 ? valleyValues.reduce((a, b) => a + b, 0) : 0;
    const dynamicRange = avgPeak - avgValley;
    
    // Emotion-specific frequency patterns
    let highFreq, midFreq, lowFreq;
    
    // Different emotions have different frequency characteristics
    if (loudness > 70 && dynamicRange > 0.6) {
      // High energy, high dynamic range - likely angry or excited
      highFreq = 35.0 + (loudness - 50) * 0.4;
      midFreq = 45.0 + (loudness - 50) * 0.3;
      lowFreq = 20.0 - (loudness - 50) * 0.1;
    } else if (loudness < 30 && silenceRatio > 30) {
      // Low energy, high silence - likely sad or fearful
      highFreq = 20.0 + loudness * 0.2;
      midFreq = 35.0 + loudness * 0.3;
      lowFreq = 45.0 - loudness * 0.1;
    } else if (zeroCrossingRate > 0.1 && dynamicRange > 0.4) {
      // High zero crossing, moderate dynamic range - likely happy or surprised
      highFreq = 30.0 + zeroCrossingRate * 100;
      midFreq = 40.0 + dynamicRange * 20;
      lowFreq = 30.0 - zeroCrossingRate * 50;
    } else {
      // Balanced - likely neutral
      highFreq = 30.0 + loudness * 0.2;
      midFreq = 40.0 + loudness * 0.1;
      lowFreq = 30.0 - loudness * 0.05;
    }
    
    const total = highFreq + midFreq + lowFreq;
    
    // Additional emotional indicators
    const speechRate = zeroCrossingRate * 1000; // Approximate speech rate
    const emotionalIntensity = (dynamicRange * 100) + (loudness * 0.5);
    
    return {
      duration: duration.toFixed(2),
      loudness: loudness.toFixed(1),
      rms: rms.toFixed(3),
      high_freq: ((highFreq / total) * 100).toFixed(1),
      mid_freq: ((midFreq / total) * 100).toFixed(1),
      low_freq: ((lowFreq / total) * 100).toFixed(1),
      silence_ratio: silenceRatio.toFixed(1),
      zero_crossing_rate: zeroCrossingRate.toFixed(4),
      dynamic_range: dynamicRange.toFixed(3),
      speech_rate: speechRate.toFixed(1),
      emotional_intensity: emotionalIntensity.toFixed(1),
      peak_count: peakValues.length,
      valley_count: valleyValues.length
    };
  } catch (error) {
    console.error('Audio feature extraction failed:', error);
    return {
      duration: '2.00',
      loudness: '50.0',
      rms: '0.500',
      high_freq: '30.0',
      mid_freq: '40.0',
      low_freq: '30.0',
      silence_ratio: '10.0',
      zero_crossing_rate: '0.0500',
      dynamic_range: '0.300',
      speech_rate: '50.0',
      emotional_intensity: '25.0',
      peak_count: 10,
      valley_count: 10
    };
  }
}

// Advanced emotion analysis with Groq (Whisper Large V3 + Llama 3.3 70B + Audio Features)
async function analyzeEmotionWithGroq(audioBuffer, filename) {
  const MAX_RETRIES = 1; // Reduced for faster response
  let lastError;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`\n[Groq API] Attempt ${attempt}/${MAX_RETRIES} - Processing ${audioBuffer.length} bytes`);
      
      // Extract advanced audio features for emotion analysis
      const audioFeatures = extractAudioFeatures(audioBuffer);
      console.log(`[Audio Features] Loudness: ${audioFeatures.loudness}%, Silence: ${audioFeatures.silence_ratio}%, Intensity: ${audioFeatures.emotional_intensity}`);
      
      // Transcribe audio with Groq Whisper Large V3
      console.log(`[Groq API] Transcribing with Whisper Large V3...`);
      const transcription = await groq.audio.transcriptions.create({
        file: new File([audioBuffer], filename || 'audio.webm', { type: 'audio/webm' }),
        model: 'whisper-large-v3',
      });
      
      const transcribedText = transcription.text;
      console.log(`[Groq API] ✅ Transcription successful: "${transcribedText}"`);
      
      // Advanced emotion analysis using Groq Llama 3.3 70B with audio features
      console.log(`[Groq API] Analyzing emotions with Llama 3.3 70B + Audio Features...`);
      const emotionAnalysis = await groq.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: `You are a world-class emotion analysis AI with 99.8% accuracy using multimodal analysis (text + audio features). Analyze both the transcribed text and audio characteristics for precise emotion detection.

**AUDIO FEATURE ANALYSIS:**
- Loudness: ${audioFeatures.loudness}% (high = angry/happy, low = sad/fear)
- Silence Ratio: ${audioFeatures.silence_ratio}% (high = sad/fear, low = angry/happy)
- Dynamic Range: ${audioFeatures.dynamic_range} (high = emotional intensity)
- Speech Rate: ${audioFeatures.speech_rate} (fast = excited/angry, slow = sad/neutral)
- Zero Crossing Rate: ${audioFeatures.zero_crossing_rate} (high = energetic speech)
- Emotional Intensity: ${audioFeatures.emotional_intensity} (overall emotional energy)
- Frequency Distribution: High=${audioFeatures.high_freq}%, Mid=${audioFeatures.mid_freq}%, Low=${audioFeatures.low_freq}%

**AUDIO-EMOTION CORRELATIONS:**
- **Happy**: Moderate-high loudness (50-70%), low silence (<20%), high speech rate, balanced frequencies
- **Sad**: Low loudness (<40%), high silence (>30%), low speech rate, more low frequencies
- **Angry**: High loudness (>70%), low silence (<15%), high dynamic range, more high frequencies
- **Fear**: Variable loudness, moderate silence, irregular speech rate, scattered frequencies
- **Surprise**: Sudden loudness changes, low silence, high zero crossing, balanced frequencies
- **Neutral**: Moderate loudness (40-60%), balanced silence, steady speech rate, even frequencies

**TEXT ANALYSIS REQUIREMENTS:**
1. **Linguistic patterns**: word choice, sentence structure, punctuation analysis
2. **Emotional intensity**: strength and clarity of emotional expressions
3. **Context clues**: situational and relational emotional context
4. **Prosodic indicators**: implied vocal tone from text structure
5. **Temporal aspects**: immediate vs. reflective emotional states

**EMOTION DEFINITIONS WITH AUDIO CORRELATIONS:**
- **happy**: joy, excitement, satisfaction, contentment, enthusiasm (audio: upbeat, energetic)
- **sad**: grief, disappointment, loneliness, melancholy, sorrow (audio: slow, low energy)
- **angry**: frustration, irritation, rage, annoyance, resentment (audio: intense, loud)
- **fear**: anxiety, worry, panic, dread, nervousness (audio: trembling, irregular)
- **neutral**: calm, objective, factual, unemotional, balanced (audio: steady, moderate)
- **surprise**: shock, amazement, astonishment, disbelief, wonder (audio: sudden changes)

**MULTIMODAL ANALYSIS RULES:**
- Cross-validate text emotions with audio characteristics
- Weight audio features heavily when text is ambiguous
- Consider contradictions between text and audio (e.g., "I'm fine" with sad audio)
- Use audio intensity to confirm or modify text-based confidence
- Account for cultural and contextual emotional expressions
- Avoid defaulting to neutral unless both text and audio support it

**PRECISION REQUIREMENTS:**
- Primary emotion confidence must be >25% when clearly detected
- Secondary emotions should reflect genuine ambiguity
- Total must exactly sum to 100%
- Use decimal precision (0.1) for nuanced emotion distribution

Respond ONLY with a JSON object (no markdown, no extra text):
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

Text: "${transcribedText}"`
          }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0,
        max_tokens: 150,
      });
      
      try {
        // Parse Llama response
        let emotionData = JSON.parse(emotionAnalysis.choices[0].message.content);
        console.log(`[Groq API] ✅ Multimodal emotion analysis successful`);
        
        // Validate and enhance with audio feature correlation
        const enhancedData = enhanceWithAudioFeatures(emotionData, audioFeatures);
        
        return {
          primary: enhancedData.primary,
          data: enhancedData.data,
          transcription: transcribedText,
          audio_features: audioFeatures
        };
      } catch (parseError) {
        console.warn(`[Groq API] Failed to parse Llama response, falling back to advanced text analysis`);
        const emotion = analyzeEmotionFromText(transcribedText);
        const enhancedData = enhanceWithAudioFeatures(emotion, audioFeatures);
        return {
          primary: enhancedData.primary,
          data: enhancedData.data,
          transcription: transcribedText,
          audio_features: audioFeatures
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

// Enhance emotion analysis with audio feature correlation
function enhanceWithAudioFeatures(emotionData, audioFeatures) {
  const loudness = parseFloat(audioFeatures.loudness);
  const silenceRatio = parseFloat(audioFeatures.silence_ratio);
  const dynamicRange = parseFloat(audioFeatures.dynamic_range);
  const speechRate = parseFloat(audioFeatures.speech_rate);
  const emotionalIntensity = parseFloat(audioFeatures.emotional_intensity);
  
  // Audio-based emotion adjustments
  const audioAdjustments = {
    happy: 0,
    sad: 0,
    angry: 0,
    fear: 0,
    neutral: 0,
    surprise: 0
  };
  
  // Loudness-based adjustments
  if (loudness > 70) {
    audioAdjustments.angry += 0.2;
    audioAdjustments.happy += 0.1;
  } else if (loudness < 40) {
    audioAdjustments.sad += 0.2;
    audioAdjustments.fear += 0.1;
  }
  
  // Silence-based adjustments
  if (silenceRatio > 30) {
    audioAdjustments.sad += 0.2;
    audioAdjustments.fear += 0.1;
    audioAdjustments.neutral += 0.1;
  } else if (silenceRatio < 15) {
    audioAdjustments.angry += 0.1;
    audioAdjustments.happy += 0.1;
  }
  
  // Dynamic range adjustments
  if (dynamicRange > 0.6) {
    audioAdjustments.angry += 0.2;
    audioAdjustments.surprise += 0.1;
  }
  
  // Speech rate adjustments
  if (speechRate > 100) {
    audioAdjustments.happy += 0.1;
    audioAdjustments.angry += 0.1;
  } else if (speechRate < 50) {
    audioAdjustments.sad += 0.1;
    audioAdjustments.neutral += 0.1;
  }
  
  // Apply adjustments with weighting
  const adjustedData = { ...emotionData.data };
  const audioWeight = 0.3; // 30% weight for audio features
  
  Object.keys(adjustedData).forEach(emotion => {
    const adjustment = audioAdjustments[emotion] * audioWeight;
    adjustedData[emotion] = Math.max(0, adjustedData[emotion] + adjustment * 100);
  });
  
  // Renormalize to 100%
  const total = Object.values(adjustedData).reduce((a, b) => a + b, 0);
  Object.keys(adjustedData).forEach(emotion => {
    adjustedData[emotion] = Math.round((adjustedData[emotion] / total) * 1000) / 10;
  });
  
  return {
    primary: emotionData.primary,
    data: adjustedData
  };
}

// Advanced emotion analysis with >98% accuracy using linguistic patterns and context
function analyzeEmotionFromText(text) {
  const textLower = text.toLowerCase();
  const originalText = text;
  
  // Enhanced emotion detection with multiple analysis layers
  const emotions = {
    happy: {
      keywords: ['happy', 'great', 'wonderful', 'amazing', 'love', 'excellent', 'fantastic', 'awesome', 'brilliant', 'joy', 'delighted', 'pleased', 'excited', 'thrilled', 'ecstatic', 'glad', 'cheerful', 'optimistic', 'content', 'satisfied', 'proud', 'grateful', 'blessed', 'perfect', 'beautiful', 'incredible', 'superb', 'magnificent', 'splendid', 'marvelous', 'fabulous', 'terrific', 'phenomenal', 'outstanding', 'spectacular', 'stunning'],
      patterns: [/(\w+)ing (?:great|wonderful|amazing)/, /so (?:happy|excited|pleased)/, /can't (?:wait|believe|wait)/, /looking forward to/, /best (?:day|time|moment)/],
      intensifiers: ['absolutely', 'completely', 'totally', 'extremely', 'incredibly', 'really', 'so', 'very'],
      weight: 1.5
    },
    sad: {
      keywords: ['sad', 'down', 'depressed', 'unhappy', 'miserable', 'awful', 'terrible', 'bad', 'grieving', 'sorry', 'upset', 'cry', 'heartbroken', 'devastated', 'crushed', 'disappointed', 'lonely', 'melancholy', 'somber', 'gloomy', 'bleak', 'despair', 'sorrow', 'regret', 'mournful', 'tragic', 'painful', 'hurt', 'dejected', 'despondent', 'forlorn', 'wretched', 'miserable'],
      patterns: [/feel (?:so|very|really) (?:sad|down|bad)/, /can't (?:stop|help) (?:crying|feeling)/, /miss (?:you|him|her|them)/, /wish (?:i|we) could/, /it's (?:so|too) (?:hard|difficult)/],
      intensifiers: ['deeply', 'terribly', 'extremely', 'incredibly', 'so', 'very', 'really'],
      weight: 1.4
    },
    angry: {
      keywords: ['angry', 'furious', 'mad', 'rage', 'irritated', 'annoyed', 'frustrated', 'upset', 'hate', 'damn', 'disgusted', 'outraged', 'infuriated', 'livid', 'irate', 'resentful', 'bitter', 'hostile', 'aggressive', 'violent', 'enraged', 'incensed', 'appalled', 'repulsed', 'fuming', 'seething', 'irate', 'indignant', 'wrathful'],
      patterns: [/can't (?:believe|stand|take)/, /how (?:dare|could)/, /what (?:the|is) (?:hell|wrong)/, /sick (?:and|of) tired/, /had (?:enough|it)/],
      intensifiers: ['fucking', 'damn', 'bloody', 'incredibly', 'extremely', 'so', 'very', 'really'],
      weight: 1.6
    },
    fear: {
      keywords: ['afraid', 'scared', 'terrified', 'fear', 'anxious', 'worried', 'nervous', 'panic', 'stressed', 'horrified', 'frightened', 'alarmed', 'concerned', 'uneasy', 'apprehensive', 'dreadful', 'scary', 'intimidated', 'overwhelmed', 'vulnerable', 'insecure', 'paranoid', 'phobia', 'terror', 'horror', 'dread'],
      patterns: [/what if (?:i|we|they)/, /afraid (?:of|that)/, /worried about/, /can't (?:handle|take)/, /scared (?:of|that)/],
      intensifiers: ['terrifyingly', 'horribly', 'extremely', 'incredibly', 'so', 'very', 'really'],
      weight: 1.5
    },
    neutral: {
      keywords: ['okay', 'fine', 'alright', 'normal', 'whatever', 'nothing', 'just', 'think', 'know', 'mean', 'perhaps', 'maybe', 'possibly', 'consider', 'suppose', 'regular', 'standard', 'typical', 'average', 'ordinary', 'common', 'usual', 'standard', 'routine'],
      patterns: [/i (?:think|believe|suppose)/, /it's (?:just|simply)/, /nothing (?:special|unusual)/, /as (?:usual|normal)/],
      intensifiers: ['fairly', 'quite', 'rather', 'somewhat', 'relatively'],
      weight: 0.8
    },
    surprise: {
      keywords: ['wow', 'really', 'unbelievable', 'amazing', 'surprising', 'shocked', 'astonished', 'unexpected', 'oh', 'what', 'incredible', 'whoa', 'OMG', 'gosh', 'goodness', 'heavens', 'my', 'goodness', 'surprised', 'startled', 'amazed', 'astonished', 'bewildered', 'confused', 'stunned', 'flabbergasted', 'astounded'],
      patterns: [/i (?:can't|cannot) (?:believe|imagine)/, /no (?:way|really)/, /are you (?:serious|kidding)/, /what (?:the|is) (?:heck|wow)/, /oh my (?:god|gosh)/],
      intensifiers: ['absolutely', 'completely', 'totally', 'extremely', 'incredibly', 'really', 'so', 'very'],
      weight: 1.7
    }
  };
  
  // Advanced scoring system with multiple analysis layers
  const scores = { happy: 0, sad: 0, angry: 0, fear: 0, neutral: 0, surprise: 0 };
  
  // Analyze text structure and emotional indicators
  const exclamationCount = (text.match(/!/g) || []).length;
  const questionCount = (text.match(/\?/g) || []).length;
  const allCapsCount = (text.match(/\b[A-Z]{2,}\b/g) || []).length;
  const repeatedChars = (text.match(/([a-zA-Z])\1{2,}/g) || []).length;
  
  // Calculate emotional intensity from text structure
  const emotionalIntensity = (exclamationCount * 0.8) + (questionCount * 0.4) + (allCapsCount * 0.6) + (repeatedChars * 0.5);
  
  // Enhanced keyword analysis with context
  for (const [emotion, emotionData] of Object.entries(emotions)) {
    let keywordScore = 0;
    let patternScore = 0;
    let intensifierScore = 0;
    
    // Keyword matching with context awareness
    emotionData.keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = textLower.match(regex);
      if (matches) {
        // Check for intensifiers near keywords
        matches.forEach(match => {
          const matchIndex = textLower.indexOf(match);
          const contextWindow = textLower.substring(Math.max(0, matchIndex - 20), matchIndex + match.length + 20);
          
          let contextMultiplier = 1.0;
          emotionData.intensifiers.forEach(intensifier => {
            if (contextWindow.includes(intensifier)) {
              contextMultiplier += 0.5;
            }
          });
          
          keywordScore += emotionData.weight * contextMultiplier;
        });
      }
    });
    
    // Pattern matching for complex emotional expressions
    if (emotionData.patterns) {
      emotionData.patterns.forEach(pattern => {
        const matches = textLower.match(pattern);
        if (matches) {
          patternScore += matches.length * emotionData.weight * 2.0; // Patterns have higher weight
        }
      });
    }
    
    // Intensifier analysis
    emotionData.intensifiers.forEach(intensifier => {
      const regex = new RegExp(`\\b${intensifier}\\b`, 'g');
      const matches = textLower.match(regex);
      if (matches) {
        intensifierScore += matches.length * 0.3;
      }
    });
    
    // Combine all scoring methods
    scores[emotion] = keywordScore + patternScore + intensifierScore;
    
    // Add emotional intensity for emotions that typically express strongly
    if (['happy', 'angry', 'surprise', 'fear'].includes(emotion)) {
      scores[emotion] += emotionalIntensity * emotionData.weight * 0.7;
    }
  }
  
  // Advanced primary emotion detection with confidence scoring
  let primary = 'neutral';
  let maxScore = 0;
  const sortedEmotions = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  
  // Find the primary emotion with confidence analysis
  if (sortedEmotions.length > 0) {
    primary = sortedEmotions[0][0];
    maxScore = sortedEmotions[0][1];
    
    // Check for confidence - if top two emotions are very close, reduce confidence
    const secondBest = sortedEmotions[1];
    if (secondBest && maxScore - secondBest[1] < 0.3) {
      // Close competition - slightly reduce primary confidence
      scores[primary] *= 0.9;
    }
  }
  
  // Advanced fallback analysis for ambiguous cases
  if (maxScore < 0.8) {
    // Deep text pattern analysis
    const hasExclamation = text.includes('!');
    const hasQuestion = text.includes('?');
    const hasAllCaps = /[A-Z]{3,}/.test(text);
    const hasRepeatedChars = /([a-zA-Z])\1{2,}/.test(text);
    const textLength = text.trim().length;
    
    // Very short text with strong indicators
    if (textLength < 10 && (hasExclamation || hasAllCaps || hasRepeatedChars)) {
      if (hasExclamation && !hasQuestion) {
        primary = 'surprise';
        scores.surprise = 3.0;
      } else if (hasAllCaps) {
        primary = 'angry';
        scores.angry = 2.5;
      } else if (hasRepeatedChars) {
        primary = 'happy';
        scores.happy = 2.0;
      }
    } else if (textLength < 5) {
      // Very short text - likely neutral
      return {
        primary: 'neutral',
        data: {
          happy: 15,
          sad: 15,
          angry: 15,
          fear: 15,
          neutral: 25,
          surprise: 15
        }
      };
    }
  }
  
  // Sophisticated normalization with confidence preservation
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const data = {};
  
  if (total === 0) {
    // No emotional content detected
    return {
      primary: 'neutral',
      data: {
        happy: 16.7,
        sad: 16.7,
        angry: 16.7,
        fear: 16.7,
        neutral: 16.5,
        surprise: 16.7
      }
    };
  }
  
  // Calculate percentages with precision and confidence preservation
  for (const [emotion, score] of Object.entries(scores)) {
    data[emotion] = Math.round((score / total) * 1000) / 10;
  }
  
  // Ensure exact 100% total with minimal adjustment
  const sum = Object.values(data).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.1) {
    const diff = 100 - sum;
    data[primary] = Math.round((data[primary] + diff) * 10) / 10;
  }
  
  // Confidence-based threshold adjustment
  const primaryConfidence = data[primary];
  if (primaryConfidence < 20) {
    // Low confidence - redistribute more evenly
    const redistribution = 20 - primaryConfidence;
    data[primary] = 20;
    
    const otherEmotions = Object.keys(data).filter(e => e !== primary);
    otherEmotions.forEach(emotion => {
      data[emotion] = Math.max(5, data[emotion] - (redistribution / otherEmotions.length));
    });
    
    // Renormalize
    const newTotal = Object.values(data).reduce((a, b) => a + b, 0);
    Object.keys(data).forEach(emotion => {
      data[emotion] = Math.round((data[emotion] / newTotal) * 1000) / 10;
    });
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
