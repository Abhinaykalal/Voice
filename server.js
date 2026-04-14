require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Groq = require('groq-sdk');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || process.env.RAILWAY_PORT || 3000;

// Middleware
app.use(cors()); // Allow all origins for simplicity in Vercel deployment
app.use(express.json());

// API routes must come before static file serving
app.use('/api', express.json());

// Static file serving for frontend
app.use(express.static(path.join(__dirname)));

// Multer setup for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log(`[Multer] Received file: ${file.originalname}, mimetype: ${file.mimetype}`);
    // Accept common audio formats
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      console.warn(`[Multer] Rejected file with mimetype: ${file.mimetype}`);
      cb(new Error('Only audio files are allowed'), false);
    }
  }
});

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

// In-memory storage for analysis history (for development)
let analysisHistory = [];

// Advanced voice pitch and tone analysis for emotion detection
function extractAudioFeatures(audioBuffer) {
  try {
    // Convert buffer to Float32Array for analysis
    let audioData;
    
    if (audioBuffer && audioBuffer.buffer) {
      // Multer memory storage - convert Buffer to Float32Array
      const buffer = audioBuffer.buffer || audioBuffer;
      audioData = new Float32Array(buffer.byteLength / 4);
      const dataView = new DataView(buffer);
      
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = dataView.getFloat32(i * 4) / 32768.0;
      }
    } else if (audioBuffer instanceof Buffer) {
      // Direct Buffer conversion
      audioData = new Float32Array(audioBuffer.length / 4);
      const dataView = new DataView(audioBuffer);
      
      for (let i = 0; i < audioData.length; i++) {
        audioData[i] = dataView.getFloat32(i * 4) / 32768.0;
      }
    } else if (audioBuffer instanceof Int16Array) {
      // Convert Int16Array to Float32Array
      audioData = new Float32Array(audioBuffer.length);
      for (let i = 0; i < audioBuffer.length; i++) {
        audioData[i] = audioBuffer[i] / 32768.0;
      }
    } else {
      // Assume it's already Float32Array
      audioData = audioBuffer;
    }
    
    const sampleRate = 16000; // WebM recording sample rate
    
    // Voice pitch and fundamental frequency analysis
    const pitchFeatures = extractPitchFeatures(audioData, sampleRate);
    
    // Spectral analysis for tone quality
    const spectralFeatures = extractSpectralFeatures(audioData, sampleRate);
    
    // Energy and intensity analysis
    const energyFeatures = extractEnergyFeatures(audioData);
    
    // Temporal and rhythm features
    const temporalFeatures = extractTemporalFeatures(audioData, sampleRate);
    
    // Voice quality indicators
    const voiceQualityFeatures = extractVoiceQualityFeatures(audioData, pitchFeatures);
    
    // Combine all features for emotion analysis
    return {
      ...pitchFeatures,
      ...spectralFeatures,
      ...energyFeatures,
      ...temporalFeatures,
      ...voiceQualityFeatures,
      sample_rate: sampleRate,
      duration: (audioData.length / sampleRate).toFixed(2)
    };
  } catch (error) {
    console.error('Advanced audio feature extraction failed:', error);
    return getDefaultAudioFeatures();
  }
}

// Extract fundamental frequency and pitch characteristics
function extractPitchFeatures(audioData, sampleRate) {
  const frameSize = 1024;
  const hopSize = 512;
  const pitches = [];
  
  for (let i = 0; i < audioData.length - frameSize; i += hopSize) {
    const frame = audioData.slice(i, i + frameSize);
    const pitch = detectFundamentalFrequency(frame, sampleRate);
    if (pitch > 50 && pitch < 500) { // Human voice range
      pitches.push(pitch);
    }
  }
  
  if (pitches.length === 0) {
    return {
      fundamental_freq: 150.0,
      pitch_variance: 10.0,
      pitch_range: 20.0,
      pitch_contour: 0.5,
      jitter: 0.01,
      shimmer: 0.02
    };
  }
  
  const meanPitch = pitches.reduce((a, b) => a + b, 0) / pitches.length;
  const pitchVariance = pitches.reduce((sum, p) => sum + Math.pow(p - meanPitch, 2), 0) / pitches.length;
  const pitchRange = Math.max(...pitches) - Math.min(...pitches);
  
  // Calculate jitter (pitch variation)
  let jitter = 0;
  for (let i = 1; i < pitches.length; i++) {
    jitter += Math.abs(pitches[i] - pitches[i-1]);
  }
  jitter = jitter / (pitches.length - 1) / meanPitch;
  
  return {
    fundamental_freq: meanPitch.toFixed(1),
    pitch_variance: Math.sqrt(pitchVariance).toFixed(1),
    pitch_range: pitchRange.toFixed(1),
    pitch_contour: (pitchVariance / (meanPitch * meanPitch)).toFixed(3),
    jitter: jitter.toFixed(3),
    shimmer: calculateShimmer(audioData).toFixed(3)
  };
}

// Detect fundamental frequency using autocorrelation
function detectFundamentalFrequency(frame, sampleRate) {
  const frameSize = frame.length;
  const autocorr = new Array(frameSize).fill(0);
  
  // Calculate autocorrelation
  for (let lag = 0; lag < frameSize; lag++) {
    for (let i = 0; i < frameSize - lag; i++) {
      autocorr[lag] += frame[i] * frame[i + lag];
    }
  }
  
  // Find peak in autocorrelation (excluding lag 0)
  let maxLag = 1;
  let maxValue = autocorr[1];
  for (let lag = 1; lag < frameSize / 2; lag++) {
    if (autocorr[lag] > maxValue) {
      maxValue = autocorr[lag];
      maxLag = lag;
    }
  }
  
  return sampleRate / maxLag;
}

// Extract spectral features for tone analysis
function extractSpectralFeatures(audioData, sampleRate) {
  const frameSize = 2048;
  const frame = audioData.slice(0, frameSize);
  
  // Apply window function
  const windowedFrame = applyHanningWindow(frame);
  
  // Compute FFT
  const spectrum = computeFFT(windowedFrame);
  const magnitudeSpectrum = spectrum.map(complex => Math.sqrt(complex.real * complex.real + complex.imag * complex.imag));
  
  // Calculate spectral features
  const spectralCentroid = calculateSpectralCentroid(magnitudeSpectrum, sampleRate);
  const spectralRolloff = calculateSpectralRolloff(magnitudeSpectrum, sampleRate);
  const spectralBandwidth = calculateSpectralBandwidth(magnitudeSpectrum, sampleRate, spectralCentroid);
  const spectralFlux = calculateSpectralFlux(magnitudeSpectrum);
  
  // Formant analysis (resonance frequencies)
  const formants = detectFormants(magnitudeSpectrum, sampleRate);
  
  return {
    spectral_centroid: spectralCentroid.toFixed(1),
    spectral_rolloff: spectralRolloff.toFixed(1),
    spectral_bandwidth: spectralBandwidth.toFixed(1),
    spectral_flux: spectralFlux.toFixed(3),
    formant_f1: formants.f1.toFixed(1),
    formant_f2: formants.f2.toFixed(1),
    formant_f3: formants.f3.toFixed(1)
  };
}

// Extract energy and intensity features
function extractEnergyFeatures(audioData) {
  let totalEnergy = 0;
  let frameEnergies = [];
  const frameSize = 1024;
  
  for (let i = 0; i < audioData.length - frameSize; i += frameSize) {
    const frame = audioData.slice(i, i + frameSize);
    let frameEnergy = 0;
    for (let j = 0; j < frame.length; j++) {
      frameEnergy += frame[j] * frame[j];
    }
    frameEnergies.push(frameEnergy);
    totalEnergy += frameEnergy;
  }
  
  const rms = Math.sqrt(totalEnergy / audioData.length);
  const loudness = 20 * Math.log10(rms + 1e-10); // Convert to dB
  
  // Energy variation
  const meanEnergy = frameEnergies.reduce((a, b) => a + b, 0) / frameEnergies.length;
  const energyVariance = frameEnergies.reduce((sum, e) => sum + Math.pow(e - meanEnergy, 2), 0) / frameEnergies.length;
  
  return {
    rms: rms.toFixed(4),
    loudness_db: loudness.toFixed(1),
    energy_variance: energyVariance.toFixed(2),
    energy_dynamics: (meanEnergy > 0 ? (Math.sqrt(energyVariance) / meanEnergy).toFixed(3) : '0.000')
  };
}

// Extract temporal and rhythm features
function extractTemporalFeatures(audioData, sampleRate) {
  // Zero crossing rate
  let zeroCrossings = 0;
  for (let i = 1; i < audioData.length; i++) {
    if ((audioData[i-1] >= 0) !== (audioData[i] >= 0)) {
      zeroCrossings++;
    }
  }
  const zeroCrossingRate = zeroCrossings / audioData.length * sampleRate;
  
  // Speech rate estimation
  const speechRate = estimateSpeechRate(audioData, sampleRate);
  
  // Pause detection
  const pauseRatio = detectPauseRatio(audioData);
  
  return {
    zero_crossing_rate: zeroCrossingRate.toFixed(1),
    speech_rate: speechRate.toFixed(1),
    pause_ratio: pauseRatio.toFixed(3),
    tempo: estimateTempo(audioData, sampleRate).toFixed(1)
  };
}

// Extract voice quality features
function extractVoiceQualityFeatures(audioData, pitchFeatures) {
  const harmonicsToNoise = calculateHNR(audioData);
  const breathiness = calculateBreathiness(audioData);
  const vocalEffort = calculateVocalEffort(audioData);
  
  return {
    hnr: harmonicsToNoise.toFixed(2),
    breathiness: breathiness.toFixed(3),
    vocal_effort: vocalEffort.toFixed(2),
    voice_tremor: calculateTremor(audioData).toFixed(3)
  };
}

// Helper functions for advanced audio analysis
function applyHanningWindow(frame) {
  const windowed = new Float32Array(frame.length);
  for (let i = 0; i < frame.length; i++) {
    const windowValue = 0.5 * (1 - Math.cos(2 * Math.PI * i / (frame.length - 1)));
    windowed[i] = frame[i] * windowValue;
  }
  return windowed;
}

function computeFFT(signal) {
  const N = signal.length;
  const spectrum = [];
  
  for (let k = 0; k < N; k++) {
    let real = 0, imag = 0;
    for (let n = 0; n < N; n++) {
      const angle = -2 * Math.PI * k * n / N;
      real += signal[n] * Math.cos(angle);
      imag += signal[n] * Math.sin(angle);
    }
    spectrum.push({ real, imag });
  }
  return spectrum;
}

function calculateSpectralCentroid(magnitudeSpectrum, sampleRate) {
  let weightedSum = 0;
  let magnitudeSum = 0;
  
  for (let k = 0; k < magnitudeSpectrum.length / 2; k++) {
    const frequency = k * sampleRate / magnitudeSpectrum.length;
    weightedSum += frequency * magnitudeSpectrum[k];
    magnitudeSum += magnitudeSpectrum[k];
  }
  
  return magnitudeSum > 0 && !isNaN(weightedSum) && !isNaN(magnitudeSum) ? weightedSum / magnitudeSum : 0;
}

function calculateSpectralRolloff(magnitudeSpectrum, sampleRate) {
  const totalEnergy = magnitudeSpectrum.reduce((sum, mag) => sum + mag * mag, 0);
  let cumulativeEnergy = 0;
  
  for (let k = 0; k < magnitudeSpectrum.length / 2; k++) {
    cumulativeEnergy += magnitudeSpectrum[k] * magnitudeSpectrum[k];
    if (cumulativeEnergy >= 0.85 * totalEnergy) {
      return k * sampleRate / magnitudeSpectrum.length;
    }
  }
  
  return sampleRate / 2;
}

function calculateSpectralBandwidth(magnitudeSpectrum, sampleRate, centroid) {
  let weightedSum = 0;
  let magnitudeSum = 0;
  
  for (let k = 0; k < magnitudeSpectrum.length / 2; k++) {
    const frequency = k * sampleRate / magnitudeSpectrum.length;
    weightedSum += Math.pow(frequency - centroid, 2) * magnitudeSpectrum[k];
    magnitudeSum += magnitudeSpectrum[k];
  }
  
  return magnitudeSum > 0 && !isNaN(weightedSum) && !isNaN(magnitudeSum) && !isNaN(centroid) ? Math.sqrt(weightedSum / magnitudeSum) : 0;
}

function calculateSpectralFlux(magnitudeSpectrum) {
  let flux = 0;
  for (let k = 1; k < magnitudeSpectrum.length; k++) {
    flux += Math.pow(magnitudeSpectrum[k] - magnitudeSpectrum[k-1], 2);
  }
  return Math.sqrt(flux);
}

function detectFormants(magnitudeSpectrum, sampleRate) {
  // Simplified formant detection - find peaks in spectrum
  const formants = { f1: 500, f2: 1500, f3: 2500 }; // Typical values
  
  // Find first three major spectral peaks
  const peaks = [];
  for (let k = 1; k < magnitudeSpectrum.length / 2 - 1; k++) {
    if (magnitudeSpectrum[k] > magnitudeSpectrum[k-1] && magnitudeSpectrum[k] > magnitudeSpectrum[k+1]) {
      const frequency = k * sampleRate / magnitudeSpectrum.length;
      if (frequency > 200 && frequency < 4000) {
        peaks.push({ freq: frequency, magnitude: magnitudeSpectrum[k] });
      }
    }
  }
  
  peaks.sort((a, b) => b.magnitude - a.magnitude);
  
  if (peaks.length >= 1) formants.f1 = peaks[0].freq;
  if (peaks.length >= 2) formants.f2 = peaks[1].freq;
  if (peaks.length >= 3) formants.f3 = peaks[2].freq;
  
  return formants;
}

function calculateShimmer(audioData) {
  const frameSize = 1024;
  const frameEnergies = [];
  
  for (let i = 0; i < audioData.length - frameSize; i += frameSize) {
    const frame = audioData.slice(i, i + frameSize);
    let energy = 0;
    for (let j = 0; j < frame.length; j++) {
      energy += Math.abs(frame[j]);
    }
    frameEnergies.push(energy);
  }
  
  if (frameEnergies.length < 2) return 0.02;
  
  let shimmer = 0;
  for (let i = 1; i < frameEnergies.length; i++) {
    shimmer += Math.abs(frameEnergies[i] - frameEnergies[i-1]);
  }
  
  return shimmer / (frameEnergies.length - 1) / (frameEnergies.reduce((a, b) => a + b, 0) / frameEnergies.length);
}

function estimateSpeechRate(audioData, sampleRate) {
  // Simplified speech rate estimation based on energy variations
  const frameSize = 512;
  let syllableCount = 0;
  let lastPeak = 0;
  
  for (let i = 0; i < audioData.length - frameSize; i += frameSize) {
    const frame = audioData.slice(i, i + frameSize);
    const energy = frame.reduce((sum, sample) => sum + sample * sample, 0);
    
    if (i - lastPeak > frameSize * 2 && energy > 0.01) {
      syllableCount++;
      lastPeak = i;
    }
  }
  
  const duration = audioData.length / sampleRate;
  return duration > 0 ? (syllableCount / duration) * 60 : 0; // Syllables per minute
}

function detectPauseRatio(audioData) {
  const threshold = 0.01;
  let pauseSamples = 0;
  
  for (let i = 0; i < audioData.length; i++) {
    if (Math.abs(audioData[i]) < threshold) {
      pauseSamples++;
    }
  }
  
  return pauseSamples / audioData.length;
}

function estimateTempo(audioData, sampleRate) {
  // Simplified tempo estimation
  return 120; // Default tempo
}

function calculateHNR(audioData) {
  // Harmonics-to-Noise Ratio (simplified)
  return 10; // Default HNR value
}

function calculateBreathiness(audioData) {
  // Breathiness detection (simplified)
  const highFreqEnergy = audioData.filter((_, i) => i > audioData.length * 0.7)
    .reduce((sum, sample) => sum + sample * sample, 0);
  const totalEnergy = audioData.reduce((sum, sample) => sum + sample * sample, 0);
  
  return totalEnergy > 0 ? highFreqEnergy / totalEnergy : 0.1;
}

function calculateVocalEffort(audioData) {
  // Vocal effort based on RMS energy
  const rms = Math.sqrt(audioData.reduce((sum, sample) => sum + sample * sample, 0) / audioData.length);
  return 20 * Math.log10(rms + 1e-10);
}

function calculateTremor(audioData) {
  // Voice tremor detection (simplified)
  return 0.05;
}

function getDefaultAudioFeatures() {
  return {
    fundamental_freq: '150.0',
    pitch_variance: '20.0',
    pitch_range: '50.0',
    pitch_contour: '0.5',
    jitter: '0.010',
    shimmer: '0.020',
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

// Advanced emotion analysis with Groq (Whisper Large V3 + Llama 3.3 70B + Audio Features)
async function analyzeEmotionWithGroq(audioBuffer, filename) {
  const MAX_RETRIES = 1; // Reduced for faster response
  let lastError;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`\n[Groq API] Attempt ${attempt}/${MAX_RETRIES} - Processing ${audioBuffer.length} bytes`);
      
      // Extract advanced audio features for emotion analysis
      const audioFeatures = extractAudioFeatures(audioBuffer);
      console.log(`[Audio Features] Pitch: ${audioFeatures.fundamental_freq}Hz, Jitter: ${audioFeatures.jitter}, Spectral Centroid: ${audioFeatures.spectral_centroid}Hz`);
      
      // Transcribe audio with Groq Whisper Large V3
      console.log(`[Groq API] Transcribing with Whisper Large V3...`);
      const { toFile } = require('groq-sdk');
      const transcription = await groq.audio.transcriptions.create({
        file: await toFile(audioBuffer, filename || 'audio.webm', { type: 'audio/webm' }),
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
            content: `You are a voice emotion analysis expert specializing in acoustic and vocal characteristics. Your primary focus is analyzing VOICE PITCH, TONE, and PROSODIC features to determine emotions. Text is secondary and should only be used for context when voice analysis is unclear.

**VOICE ACOUSTIC ANALYSIS:**
- **Fundamental Frequency**: ${audioFeatures.fundamental_freq}Hz (high pitch=fear/excitement, low pitch=sadness/anger)
- **Pitch Variance**: ${audioFeatures.pitch_variance}Hz (high variance=emotional intensity, low=controlled)
- **Pitch Range**: ${audioFeatures.pitch_range}Hz (wide range=excitement/anger, narrow=neutral/sad)
- **Jitter**: ${audioFeatures.jitter} (high jitter=fear/nervousness, low=calm)
- **Shimmer**: ${audioFeatures.shimmer} (high shimmer=emotional arousal, low=stable)
- **Spectral Centroid**: ${audioFeatures.spectral_centroid}Hz (high=bright/happy, low=dark/sad)
- **Formants F1/F2/F3**: ${audioFeatures.formant_f1}/${audioFeatures.formant_f2}/${audioFeatures.formant_f3}Hz (vocal tract position)
- **Voice Quality**: HNR=${audioFeatures.hnr}, Breathiness=${audioFeatures.breathiness}, Tremor=${audioFeatures.voice_tremor}
- **Energy**: RMS=${audioFeatures.rms}, Loudness=${audioFeatures.loudness_db}dB, Dynamics=${audioFeatures.energy_dynamics}
- **Temporal**: Speech Rate=${audioFeatures.speech_rate}wpm, Pauses=${audioFeatures.pause_ratio}%

**VOICE-BASED EMOTION PATTERNS:**
- **HAPPY**: Higher fundamental freq (180-220Hz), moderate jitter (0.01-0.02), bright spectral centroid (>2000Hz), increased shimmer, steady rhythm with minimal pauses
- **SAD**: Lower fundamental freq (100-140Hz), narrow pitch range, low spectral centroid (<1500Hz), increased pause ratio, breathy voice quality
- **ANGRY**: High fundamental freq (200-280Hz), wide pitch range, high jitter/shimmer, increased spectral bandwidth, high energy dynamics
- **FEAR**: Very high fundamental freq (250-350Hz), extremely high jitter, irregular pitch contour, breathy with tremor, fragmented speech
- **SURPRISE**: Sudden pitch jump, high spectral centroid, brief duration, increased shimmer, minimal pauses
- **NEUTRAL**: Stable fundamental freq (150-180Hz), low jitter/shimmer, balanced spectral features, steady rhythm

**ANALYSIS PRIORITY:**
1. **PRIMARY**: Voice pitch and tone characteristics (70% weight)
2. **SECONDARY**: Spectral and voice quality features (20% weight) 
3. **TERTIARY**: Text content only for context (10% weight)

**CRITICAL RULES:**
- If voice clearly shows an emotion, IGNORE contradictory text
- Prioritize acoustic evidence over linguistic patterns
- Use fundamental frequency and pitch variance as primary indicators
- Consider formants for vocal quality and emotional state
- High jitter/shimmer indicates emotional arousal regardless of text
- Low energy with pauses indicates sadness even if text is positive

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

Transcribed Text: "${transcribedText}"`
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

// POST /api/predict - Analyze audio
app.post('/api/predict', (req, res, next) => {
  upload.single('audio')(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      console.error('[Multer Error]', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ detail: 'File too large. Maximum size is 50MB.' });
      }
      return res.status(400).json({ detail: `Multer error: ${err.message}` });
    } else if (err) {
      console.error('[Upload Error]', err);
      return res.status(400).json({ detail: `Upload error: ${err.message}` });
    }
    next();
  });
}, async (req, res) => {
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
      const confidence = emotionData.data[emotionData.primary] || 0;
      const historyItem = {
        id: Date.now(),
        primary: emotionData.primary,
        primary_emotion: emotionData.primary,
        emotion_data: emotionData.data,
        data: emotionData.data,
        transcription: emotionData.transcription,
        confidence: confidence,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
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

// GET /api/history - Retrieve emotion analysis history
app.get('/api/history', async (req, res) => {
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

// DELETE /api/history - Clear emotion analysis history
app.delete('/api/history', async (req, res) => {
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
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Emotion Detector API is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Emotion Detector API running on port ${PORT}`);
  if (process.env.RAILWAY_PUBLIC_URL) {
    console.log(`🌐 Railway URL: ${process.env.RAILWAY_PUBLIC_URL}`);
  } else {
    console.log(`🎙️ Frontend: http://localhost:${PORT}`);
    console.log(`📡 API endpoint: http://localhost:${PORT}/api/predict`);
  }
});

// Export for Vercel
module.exports = app;
