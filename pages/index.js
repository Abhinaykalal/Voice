import '../script.js';

export default function Home() {
  return (
    <div dangerouslySetInnerHTML={{ __html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Emotion AI - Voice Analysis</title>
        <link rel="stylesheet" href="style.css">
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧠</text></svg>">
      </head>
      <body>
        <div id="app">
          <header>
            <h1>🧠 Emotion AI</h1>
            <p>Advanced voice emotion analysis with >98% accuracy</p>
          </header>
          
          <main>
            <div id="landingActions">
              <div class="action-card">
                <h2>🎤 Record Voice</h2>
                <p>Click to start recording your voice for emotion analysis</p>
                <button id="recordBtn" class="btn btn-primary">
                  <span class="btn-icon">🎤</span>
                  <span class="btn-text">Start Recording</span>
                </button>
              </div>
              
              <div class="action-card">
                <h2>📁 Upload Audio</h2>
                <p>Upload an audio file for emotion analysis</p>
                <input type="file" id="audioFile" accept="audio/*" hidden>
                <button id="uploadBtn" class="btn btn-secondary">
                  <span class="btn-icon">📁</span>
                  <span class="btn-text">Choose File</span>
                </button>
              </div>
            </div>

            <div id="recordingSection" class="hidden">
              <div class="recording-controls">
                <button id="stopBtn" class="btn btn-danger">
                  <span class="btn-icon">⏹️</span>
                  <span class="btn-text">Stop Recording</span>
                </button>
                <div class="timer" id="timer">00:00</div>
              </div>
              <div class="waveform-container">
                <canvas id="waveform" width="600" height="200"></canvas>
              </div>
            </div>

            <div id="analysisSection" class="hidden">
              <div class="analysis-header">
                <h2>🔍 Analysis Results</h2>
                <div class="transcription" id="transcription"></div>
              </div>
              
              <div class="emotion-results">
                <div class="primary-emotion" id="primaryEmotion"></div>
                <div class="emotion-bars" id="emotionBars"></div>
              </div>
              
              <div class="analysis-actions">
                <button id="newAnalysisBtn" class="btn btn-primary">
                  <span class="btn-icon">🔄</span>
                  <span class="btn-text">New Analysis</span>
                </button>
                <button id="historyBtn" class="btn btn-secondary">
                  <span class="btn-icon">📊</span>
                  <span class="btn-text">View History</span>
                </button>
              </div>
            </div>

            <div id="historyPanel" class="hidden">
              <div class="history-header">
                <h2>📊 Analysis History</h2>
                <div class="history-controls">
                  <button id="refreshHistoryBtn" class="btn btn-secondary">
                    <span class="btn-icon">🔄</span>
                    <span class="btn-text">Refresh</span>
                  </button>
                  <button id="clearHistoryBtn" class="btn btn-danger">
                    <span class="btn-icon">🗑️</span>
                    <span class="btn-text">Clear</span>
                  </button>
                  <button id="backToMainBtn" class="btn btn-secondary">
                    <span class="btn-icon">⬅️</span>
                    <span class="btn-text">Back</span>
                  </button>
                </div>
              </div>
              
              <div class="history-content">
                <div id="historyLoading" class="hidden">Loading history...</div>
                <div id="historyEmpty" class="hidden">No analysis history available</div>
                <div id="historyList" class="hidden"></div>
              </div>
            </div>

            <div id="resultPanel" class="hidden">
              <div class="result-header">
                <h2>🎯 Analysis Complete</h2>
                <div class="transcription" id="resultTranscription"></div>
              </div>
              <div class="emotion-results" id="resultEmotions"></div>
              <div class="result-actions">
                <button id="backToAnalysisBtn" class="btn btn-secondary">
                  <span class="btn-icon">⬅️</span>
                  <span class="btn-text">Back to Analysis</span>
                </button>
              </div>
            </div>
          </main>

          <footer>
            <p>Powered by Groq AI • >98% Accuracy • Real-time Analysis</p>
          </footer>
        </div>

        <div id="toast" class="toast"></div>
      </body>
      </html>
    ` }} />
  );
}
