from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import json
import time
import os
import numpy as np
from database import get_db, DetectionHistory, engine, Base

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="VoiceAI Emotion API", version="1.0.0")

# Allow requests from the local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:8000",
        "http://127.0.0.1",
        "http://127.0.0.1:8000",
        "http://127.0.0.1:5500", # Live server
        "*"
    ],
    allow_credentials=False, # Must be false if origins contains '*' in some strict browsers
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/predict")
async def process_audio(audio: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Receives an audio file, analyzes it with Groq AI,
    saves the history to SQLite, and returns the emotion analysis.
    """
    start_time = time.time()
    
    try:
        # 1. Read file bytes
        file_bytes = await audio.read()
        
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Empty file sent.")

        # 2. Analyze audio using Groq API
        result_payload = await analyze_emotion_with_groq(file_bytes, audio.filename)
        primary = result_payload["primary"]
        data_dict = result_payload["data"]
        confidence = data_dict[primary]
        
        # 3. Log to SQLite database
        history_record = DetectionHistory(
            filename=audio.filename,
            primary_emotion=primary,
            confidence=confidence,
            probability_json=json.dumps(data_dict)
        )
        db.add(history_record)
        db.commit()
        db.refresh(history_record)
            
        return result_payload
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def analyze_emotion_with_groq(audio_bytes: bytes, filename: str):
    """
    Analyze audio using Google Gemini AI
    """
    try:
        # Import Gemini inside function
        import google.generativeai as genai
        GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', 'AIzaSyClgLopxgSkme137iAs_GXhkslggsbLZr8')
        genai.configure(api_key=GEMINI_API_KEY)
        
        # Extract basic audio features
        audio_features = extract_audio_features(audio_bytes)
        
        # Call Gemini API with audio analysis
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(f"""Based on these audio characteristics, determine the speaker's emotion. 
                    
Audio Analysis from '{filename}':
- Duration: {audio_features['duration']:.2f} seconds
- Loudness (RMS): {audio_features['loudness']:.1f}%
- High Frequency Energy: {audio_features['high_freq']:.1f}%
- Mid Frequency Energy: {audio_features['mid_freq']:.1f}%
- Low Frequency Energy: {audio_features['low_freq']:.1f}%
- Silence Ratio: {audio_features['silence_ratio']:.1f}%

Return ONLY this JSON with no other text:
{{
  "primary": "emotion_name",
  "data": {{
    "happy": number,
    "sad": number,
    "angry": number,
    "fear": number,
    "neutral": number,
    "surprise": number
  }}
}}

Rules:
- primary must be one of: happy, sad, angry, fear, neutral, surprise
- All percentages must sum to 100
- High loudness + high frequency = happy/angry
- Low loudness + low frequency = sad/fear
- Balanced = neutral
- Variation in pitch = surprise
- Return ONLY JSON, no markdown or code blocks""")
        
        response_text = response.text.strip()
        
        # Parse JSON response, handling potential markdown formatting
        if "```" in response_text:
            response_text = response_text.split("```")[1].replace("json", "").strip()
        
        emotion_data = json.loads(response_text)
        
        # Validate response
        if not emotion_data.get("primary") or not emotion_data.get("data"):
            raise ValueError("Invalid response format from Gemini API")
        
        return emotion_data
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse Gemini response: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")


def extract_audio_features(audio_bytes: bytes) -> dict:
    """Extract audio features from raw bytes"""
    try:
        # Simple audio feature extraction
        import wave
        import io
        
        # Try to decode different audio formats
        try:
            with wave.open(io.BytesIO(audio_bytes), 'rb') as wav_file:
                frames = wav_file.readframes(wav_file.getnframes())
                sample_width = wav_file.getsampwidth()
                duration = wav_file.getnframes() / wav_file.getframerate()
        except:
            # If WAV fails, estimate from filesize
            duration = len(audio_bytes) / 16000 / 2  # Rough estimate
            frames = audio_bytes
            sample_width = 2
        
        # Convert bytes to numpy array
        audio_data = np.frombuffer(frames, dtype=np.int16).astype(float)
        
        if len(audio_data) == 0:
            audio_data = np.array([0])
        
        # Normalize
        if np.max(np.abs(audio_data)) > 0:
            audio_data = audio_data / np.max(np.abs(audio_data))
        
        # Calculate features
        rms = np.sqrt(np.mean(audio_data ** 2))
        loudness = min(100, rms * 500)
        
        # Frequency distribution (simple analysis)
        silence_ratio = np.sum(np.abs(audio_data) < 0.01) / len(audio_data) * 100
        
        # Rough frequency estimation
        high_freq = 25.0 + (loudness * 0.3)
        mid_freq = 40.0 + (loudness * 0.2)
        low_freq = 35.0 - (loudness * 0.1)
        
        # Normalize frequencies to sum to 100
        total = high_freq + mid_freq + low_freq
        high_freq = (high_freq / total) * 100
        mid_freq = (mid_freq / total) * 100
        low_freq = (low_freq / total) * 100
        
        return {
            "duration": duration,
            "loudness": loudness,
            "rms": rms,
            "high_freq": high_freq,
            "mid_freq": mid_freq,
            "low_freq": low_freq,
            "silence_ratio": silence_ratio
        }
    except Exception as e:
        # Return default features if extraction fails
        return {
            "duration": 2.0,
            "loudness": 50.0,
            "rms": 0.5,
            "high_freq": 30.0,
            "mid_freq": 40.0,
            "low_freq": 30.0,
            "silence_ratio": 10.0
        }

@app.get("/history")
def get_history(limit: int = 10, db: Session = Depends(get_db)):
    """
    Optional endpoint: Retrieve detection history.
    """
    history = db.query(DetectionHistory).order_by(DetectionHistory.timestamp.desc()).limit(limit).all()
    # Convert probability_json string back to dict for the response payload
    results = []
    for h in history:
        record = h.__dict__.copy()
        if "_sa_instance_state" in record:
            del record["_sa_instance_state"]
        record["probability_json"] = json.loads(record["probability_json"])
        results.append(record)
    return results

if __name__ == "__main__":
    import uvicorn
    # Make sure this runs on port 8000
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
