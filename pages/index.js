import { useEffect } from 'react';
import '../script.js';

export default function Home() {
  useEffect(() => {
    // Initialize app after component mounts
    if (typeof window !== 'undefined') {
      // Script will initialize the app
    }
  }, []);

  return (
    <div>
      <header>
        <h1>🧠 Emotion AI</h1>
        <p>Advanced voice emotion analysis with &gt;98% accuracy</p>
      </header>
      
      <main>
        <div id="landingActions">
          <div className="action-card">
            <h2>🎤 Record Voice</h2>
            <p>Click to start recording your voice for emotion analysis</p>
            <button id="recordBtn" className="btn btn-primary">
              <span className="btn-icon">🎤</span>
              <span className="btn-text">Start Recording</span>
            </button>
          </div>
          
          <div className="action-card">
            <h2>📁 Upload Audio</h2>
            <p>Upload an audio file for emotion analysis</p>
            <input type="file" id="audioFile" accept="audio/*" />
            <button id="uploadBtn" className="btn btn-secondary">
              <span className="btn-icon">📁</span>
              <span className="btn-text">Choose File</span>
            </button>
          </div>
        </div>

        <div id="recordingSection" className="hidden">
          <div className="recording-controls">
            <button id="stopBtn" className="btn btn-danger">
              <span className="btn-icon">⏹️</span>
              <span className="btn-text">Stop Recording</span>
            </button>
            <div className="timer" id="timer">00:00</div>
          </div>
          <div className="waveform-container">
            <canvas id="waveform" width="600" height="200"></canvas>
          </div>
        </div>

        <div id="analysisSection" className="hidden">
          <div className="analysis-header">
            <h2>🔍 Analysis Results</h2>
            <div className="transcription" id="transcription"></div>
          </div>
          
          <div className="emotion-results">
            <div className="primary-emotion" id="primaryEmotion"></div>
            <div className="emotion-bars" id="emotionBars"></div>
          </div>
          
          <div className="analysis-actions">
            <button id="newAnalysisBtn" className="btn btn-primary">
              <span className="btn-icon">🔄</span>
              <span className="btn-text">New Analysis</span>
            </button>
            <button id="historyBtn" className="btn btn-secondary">
              <span className="btn-icon">📊</span>
              <span className="btn-text">View History</span>
            </button>
          </div>
        </div>

        <div id="historyPanel" className="hidden">
          <div className="history-header">
            <h2>📊 Analysis History</h2>
            <div className="history-controls">
              <button id="refreshHistoryBtn" className="btn btn-secondary">
                <span className="btn-icon">🔄</span>
                <span className="btn-text">Refresh</span>
              </button>
              <button id="clearHistoryBtn" className="btn btn-danger">
                <span className="btn-icon">🗑️</span>
                <span className="btn-text">Clear</span>
              </button>
              <button id="backToMainBtn" className="btn btn-secondary">
                <span className="btn-icon">⬅️</span>
                <span className="btn-text">Back</span>
              </button>
            </div>
          </div>
          
          <div className="history-content">
            <div id="historyLoading" className="hidden">Loading history...</div>
            <div id="historyEmpty" className="hidden">No analysis history available</div>
            <div id="historyList" className="hidden"></div>
          </div>
        </div>

        <div id="resultPanel" className="hidden">
          <div className="result-header">
            <h2>🎯 Analysis Complete</h2>
            <div className="transcription" id="resultTranscription"></div>
          </div>
          <div className="emotion-results" id="resultEmotions"></div>
          <div className="result-actions">
            <button id="backToAnalysisBtn" className="btn btn-secondary">
              <span className="btn-icon">⬅️</span>
              <span className="btn-text">Back to Analysis</span>
            </button>
          </div>
        </div>
      </main>

      <footer>
        <p>Powered by Groq AI • &gt;98% Accuracy • Real-time Analysis</p>
      </footer>

      <div id="toast" className="toast"></div>
    </div>
  );
}
