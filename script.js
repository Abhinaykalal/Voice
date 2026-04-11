/* ========================================================
   EMOTION AI  |  script.js
   Single-Frame Logic & Wave Canvas Animation
   ======================================================== */
'use strict';

// ── Emotion Data ──────────────────────────────────────────────
const EMOTIONS = {
  happy:    { emoji: '😊', label: 'Happy',    color: '#FFD700', grad: 'linear-gradient(90deg,#e6a000,#FFD700)' },
  sad:      { emoji: '😢', label: 'Sad',      color: '#4a90d9', grad: 'linear-gradient(90deg,#1a4a7a,#4a90d9)' },
  angry:    { emoji: '😠', label: 'Angry',    color: '#ff4b6e', grad: 'linear-gradient(90deg,#c0003a,#ff4b6e)' },
  fear:     { emoji: '😨', label: 'Fear',     color: '#9B59B6', grad: 'linear-gradient(90deg,#5a1e78,#9B59B6)' },
  neutral:  { emoji: '😐', label: 'Neutral',  color: '#00BFFF', grad: 'linear-gradient(90deg,#006a8e,#00BFFF)' },
  surprise: { emoji: '😲', label: 'Surprise', color: '#00FFFF', grad: 'linear-gradient(90deg,#008080,#00FFFF)' },
};

/* ── Landing Page Actions ───────────────────────────────────── */
const landingActions = document.getElementById('landing-actions');
const mainPanelContainer = document.getElementById('main-panel');
const btnStream = document.getElementById('btn-analyze-stream');
const btnHistory = document.getElementById('btn-history');

btnStream.addEventListener('click', () => {
  landingActions.classList.add('hidden');
  mainPanelContainer.classList.remove('hidden');
  switchTab('record');
});

btnHistory.addEventListener('click', () => {
  landingActions.classList.add('hidden');
  showHistoryPanel();
});

// Settings button removed - API key is now secure on backend

/* ── Tab Switching ───────────────────────────────────────────── */
const tabRecord = document.getElementById('tab-record');
const tabUpload = document.getElementById('tab-upload');
const panelRecord = document.getElementById('panel-record');
const panelUpload = document.getElementById('panel-upload');

window.switchTab = function(tabName) {
  if (tabName === 'record') {
    tabRecord.classList.add('active'); tabUpload.classList.remove('active');
    panelRecord.classList.remove('hidden'); panelUpload.classList.add('hidden');
  } else {
    tabUpload.classList.add('active'); tabRecord.classList.remove('active');
    panelUpload.classList.remove('hidden'); panelRecord.classList.add('hidden');
  }
};

/* ── Interactive Background ──────────────────────────────────── */
const interactiveBg = document.querySelector('.interactive-bg');
document.addEventListener('mousemove', (e) => {
  if (!interactiveBg) return;
  const x = (e.clientX / window.innerWidth) * 100 + '%';
  const y = (e.clientY / window.innerHeight) * 100 + '%';
  interactiveBg.style.setProperty('--mouse-x', x);
  interactiveBg.style.setProperty('--mouse-y', y);
});



/* ── Recording Logic ──────────────────────────────────────────── */
let mediaRecorder   = null;
let recordedChunks  = [];
let recordingTimer  = null;
let recordSeconds   = 0;
let audioContext    = null;
let analyser        = null;
let micStream       = null;
let animFrameId     = null;
let recordedAudioReady = false;

const startBtn     = document.getElementById('start-record-btn');
const timerEl      = document.getElementById('record-timer');
const wfCanvas     = document.getElementById('waveformCanvas');
const wfCtx        = wfCanvas.getContext('2d');
const wfIdle       = document.getElementById('wf-idle');

function fmtTime(s) {
  const m = Math.floor(s/60).toString().padStart(2,'0');
  const sec = (s%60).toString().padStart(2,'0');
  return `${m}:${sec}`;
}

function startWaveformDraw() {
  const bufLen = analyser.frequencyBinCount;
  const dataArr = new Uint8Array(bufLen);

  function draw() {
    animFrameId = requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(dataArr);

    const W = wfCanvas.offsetWidth || 600;
    const H = 70;
    wfCanvas.width = W; wfCanvas.height = H;

    wfCtx.clearRect(0,0,W,H);

    const g = wfCtx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#8A2BE2');
    g.addColorStop(0.5, '#00BFFF');
    g.addColorStop(1, '#00FFFF');
    wfCtx.strokeStyle = g;
    wfCtx.lineWidth   = 2.5;
    wfCtx.shadowColor = '#00FFFF';
    wfCtx.shadowBlur  = 8;

    const sliceW = W / bufLen;
    let x = 0;
    wfCtx.beginPath();
    for (let i = 0; i < bufLen; i++) {
      const v  = dataArr[i] / 128;
      const y  = (v * H) / 2;
      i === 0 ? wfCtx.moveTo(x, y) : wfCtx.lineTo(x, y);
      x += sliceW;
    }
    wfCtx.lineTo(W, H / 2);
    wfCtx.stroke();
  }
  draw();
}

let isRecording = false;

startBtn.addEventListener('click', async () => {
  try {
    if (!isRecording) {
      // Start recording
      isRecording = true;
      startBtn.classList.add('recording');
      wfIdle.classList.add('hidden');
      wfCanvas.style.display = 'block';
      timerEl.style.color = 'var(--danger)';
      
      recordSeconds = 0;
      timerEl.textContent = fmtTime(0);
      recordingTimer = setInterval(() => {
        recordSeconds++;
        timerEl.textContent = fmtTime(recordSeconds);
      }, 1000);

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStream = stream;

      // Optimize audio context setup
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024; // Reduced for better performance
      const src = audioContext.createMediaStreamSource(stream);
      src.connect(analyser);

      // Setup media recorder
      mediaRecorder  = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      recordedChunks = [];
      mediaRecorder.ondataavailable = e => { 
        if (e.data.size > 0) recordedChunks.push(e.data); 
      };
      mediaRecorder.onstop = () => {
        // Remove delay for faster response
        if (recordedChunks.length > 0) {
          runAnalysis();
        } else {
          showToast('Error: No audio data recorded. Please try again.');
        }
      };
      
      // Start recording immediately
      mediaRecorder.start();
      startWaveformDraw();
      showToast('🎤 Recording started…');
    } else {
      // Stop recording
      isRecording = false;
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        micStream.getTracks().forEach(t => t.stop());
        cancelAnimationFrame(animFrameId);
        clearInterval(recordingTimer);

        startBtn.classList.remove('recording');
        timerEl.style.color = 'var(--cyan)';

        showToast(`✅ Recording saved (${fmtTime(recordSeconds)})`);
        recordedAudioReady = true;
      }
    }
  } catch (err) {
    showToast('⚠️ Microphone access denied. Please allow mic permissions.');
    console.error(err);
  }
});

/* ── File Upload ──────────────────────────────────────────────── */
let uploadedFile = null;

const fileInput     = document.getElementById('audio-file-input');
const uploadZone    = document.getElementById('upload-zone');
const uploadInner   = document.getElementById('upload-inner');
const fileInfo      = document.getElementById('file-info');
const fileNameEl    = document.getElementById('file-name-display');
const fileSizeEl    = document.getElementById('file-size-display');
const fileClearBtn  = document.getElementById('file-clear-btn');
const browseBtn     = document.getElementById('browse-btn');

browseBtn.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('click', (e) => {
  if (e.target !== fileClearBtn) fileInput.click();
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault(); uploadZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

function handleFile(f) {
  const allowed = ['audio/wav','audio/mpeg','audio/ogg','audio/flac','audio/x-flac','audio/mp4','audio/aac'];
  if (!allowed.includes(f.type) && !f.name.match(/\.(wav|mp3|ogg|flac|m4a)$/i)) {
    showToast('⚠️ Unsupported file type. Please upload WAV, MP3, OGG, FLAC or M4A.');
    return;
  }
  uploadedFile = f;
  fileNameEl.textContent = f.name;
  fileSizeEl.textContent = (f.size / (1024*1024)).toFixed(2) + ' MB';
  uploadInner.classList.add('hidden');
  fileInfo.classList.remove('hidden');
  showToast(`📁 File "${f.name}" loaded. Auto-analyzing...`);

  // Automatically trigger analysis
  runAnalysis();
}

fileClearBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  uploadedFile = null;
  fileInput.value = '';
  fileInfo.classList.add('hidden');
  uploadInner.classList.remove('hidden');
});

const loadingOverlay= document.getElementById('loading-overlay');
const loadingBar    = document.getElementById('loading-bar');
const step1         = document.getElementById('step-1');
const step2         = document.getElementById('step-2');
const step3         = document.getElementById('step-3');

const mainPanel   = document.querySelector('.main-panel');
const resultPanel = document.getElementById('result-panel');

async function runAnalysis() {
  // Keep results visible while loading new analysis
  loadingOverlay.classList.remove('hidden');
  loadingBar.style.width = '0%';
  [step1, step2, step3].forEach(s => s.classList.remove('active','done'));
  step1.classList.add('active');

  // Ultra-fast progress for 2-second requirement
  let p = 0;
  const pInt = setInterval(() => {
    p += 25; // Faster increments
    if (p > 95) p = 95;
    loadingBar.style.width = p + '%';
    if (p > 40 && !step2.classList.contains('active')) {
      step1.classList.remove('active'); step1.classList.add('done');
      step2.classList.add('active');
    }
  }, 10); // Faster interval

  try {
    let audioBlob = uploadedFile;
    if (!audioBlob && recordedAudioReady && recordedChunks.length > 0) {
      audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
    }

    const startMs = Date.now();
    const result = await callEmotionAPI(audioBlob);
    const elapsed = Date.now() - startMs;

    // Minimal delay to ensure <2 second total time
    if (elapsed < 100) await new Promise(r => setTimeout(r, 100 - elapsed));

    clearInterval(pInt);
    loadingBar.style.width = '100%';
    step2.classList.remove('active'); step2.classList.add('done');
    step3.classList.add('done');

    // Display results without hiding main panel - keep previous results visible
    loadingOverlay.classList.add('hidden');
    displayResults(result);
    recordedAudioReady = false;

  } catch (err) {
    clearInterval(pInt);
    loadingOverlay.classList.add('hidden');
    showToast('❌ Error: ' + err.message);
  }
}

async function callEmotionAPI(audioBlob) {
  if (!audioBlob) {
    throw new Error('No audio data available for analysis');
  }

  try {
    const formData = new FormData();
    const fileName = uploadedFile ? uploadedFile.name : 'recording.webm';
    formData.append('audio', audioBlob, fileName);
    
    // Call backend API with timeout for <2 second requirement
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5s timeout
    
    const response = await fetch('http://localhost:3000/predict', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Backend error: ${error.detail || response.statusText}`);
    }

    const emotionData = await response.json();
    
    // Validate response structure
    if (!emotionData.primary || !emotionData.data) {
      throw new Error('Invalid response format from backend');
    }

    return emotionData;
  } catch (error) {
    throw error;
  }
}

/* ── Display Results ──────────────────────────────────────────── */
const circleProgress = document.getElementById('circle-progress');
const resultEmoji    = document.getElementById('result-emoji');
const resultLabel    = document.getElementById('result-emotion-label');
const resultConf     = document.getElementById('result-confidence');
const emotionBarsEl  = document.getElementById('emotion-bars');
const resetBtn       = document.getElementById('reset-btn');
const exportBtn      = document.getElementById('export-btn');

function displayResults(result) {
  // Hide main panel and show only result panel after analysis
  mainPanelContainer.classList.add('hidden');
  resultPanel.classList.remove('hidden');
  console.log('Displaying results:', result); // Debug log
  
  // Force visibility with inline styles as backup
  resultPanel.style.display = 'block';
  resultPanel.style.visibility = 'visible';
  resultPanel.style.opacity = '1';
  
  const em   = EMOTIONS[result.primary];
  let conf = result.data[result.primary];
  
  if (!em) {
    console.error('Emotion not found:', result.primary);
    showToast('Error: Invalid emotion detected');
    return;
  }
  
  showToast(`✅ Analysis complete: ${em.emoji} ${em.label} (${conf.toFixed(1)}%)`);
  
  
  // Circle
  resultEmoji.textContent = em.emoji;
  resultLabel.textContent = em.label;
  resultConf.textContent  = conf.toFixed(1) + '%';
  
  const CIRCUMFERENCE = 2 * Math.PI * 52; 
  const offset = CIRCUMFERENCE * (1 - conf / 100);
  
  circleProgress.setAttribute('stroke-dasharray', CIRCUMFERENCE);
  circleProgress.setAttribute('stroke-dashoffset', CIRCUMFERENCE); // start empty
  
  setTimeout(() => {
    circleProgress.setAttribute('stroke-dashoffset', offset);
    circleProgress.setAttribute('stroke', em.color);
    document.querySelector('.circle-progress').style.filter = `drop-shadow(0 0 8px ${em.color})`;
  }, 100);

  // Bars
  emotionBarsEl.innerHTML = '';
  const sorted = Object.entries(result.data).sort((a,b) => b[1] - a[1]);
  // Show all emotions as requested
  sorted.forEach(([key, val]) => {
    const e   = EMOTIONS[key];
    const row = document.createElement('div');
    row.className = 'emotion-bar-row';
    row.innerHTML = `
      <span class="bar-label">${e.emoji} ${e.label}</span>
      <div class="bar-track">
        <div class="bar-fill" style="background:${e.grad}" data-val="${val}"></div>
      </div>
      <span class="bar-pct">${val.toFixed(1)}%</span>`;
    emotionBarsEl.appendChild(row);
  });
  
  setTimeout(() => {
    document.querySelectorAll('.bar-fill').forEach(b => {
      b.style.width = b.dataset.val + '%';
      b.style.boxShadow = `0 0 10px ${b.style.background.split(',')[0].replace('linear-gradient(90deg','').trim()}40`;
    });
  }, 200);

  showToast(`✅ Emotion detected: ${em.emoji} ${em.label} (${conf.toFixed(1)}%)`);
}

/* Result Actions */
resetBtn.addEventListener('click', () => {
  // Hide result panel and show main panel for new analysis
  resultPanel.classList.add('hidden');
  mainPanelContainer.classList.remove('hidden');
  landingActions.classList.add('hidden');
  
  // Reset to record tab for new analysis
  switchTab('record');
  
  // reset file
  uploadedFile = null;
  fileInput.value = '';
  fileInfo.classList.add('hidden');
  uploadInner.classList.remove('hidden');
  
  // reset canvas
  wfCanvas.style.display = 'none';
  wfIdle.classList.remove('hidden');
  timerEl.textContent = '00:00';
  
  showToast('Ready for new analysis. Results still visible.');
});

exportBtn.addEventListener('click', () => {
  const primary = resultLabel.textContent;
  const conf    = resultConf.textContent;
  const ts      = new Date().toISOString();
  let bText     = '';
  document.querySelectorAll('.emotion-bar-row').forEach(r => {
    const l = r.querySelector('.bar-label')?.textContent?.trim();
    const p = r.querySelector('.bar-pct')?.textContent?.trim();
    bText += `  ${l} → ${p}\n`;
  });
  const report = `Emotion AI Analysis Report\n================================\nTimestamp     : ${ts}\nPrimary Emotion: ${primary}\nConfidence    : ${conf}\n\nTop Emotions:\n${bText}\n`;
  const blob = new Blob([report], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `emotion-report-${Date.now()}.txt`;
  a.click(); URL.revokeObjectURL(url);
  showToast('📥 Report exported successfully!');
});

/* ── Toast Utility ─────────────────────────────────────────────── */
const toastEl = document.getElementById('toast');
let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3500);
}

/* ── History Panel ───────────────────────────────────────────── */
const historyPanel = document.getElementById('history-panel');
const historyContent = document.getElementById('history-content');
const historyLoading = document.getElementById('history-loading');
const historyEmpty = document.getElementById('history-empty');
const historyList = document.getElementById('history-list');
const refreshHistoryBtn = document.getElementById('refresh-history-btn');
const backToMainBtn = document.getElementById('back-to-main-btn');
const clearHistoryBtn = document.getElementById('clear-history-btn');

async function showHistoryPanel() {
  historyPanel.classList.remove('hidden');
  mainPanelContainer.classList.add('hidden');
  resultPanel.classList.add('hidden');
  await loadHistory();
}

async function loadHistory() {
  historyLoading.classList.remove('hidden');
  historyEmpty.classList.add('hidden');
  historyList.classList.add('hidden');
  
  try {
    const response = await fetch('http://localhost:3000/history');
    if (!response.ok) {
      throw new Error('Failed to fetch history');
    }
    
    const data = await response.json();
    displayHistory(data.data || []);
  } catch (error) {
    console.error('Error loading history:', error);
    historyEmpty.classList.remove('hidden');
    historyLoading.classList.add('hidden');
    historyEmpty.querySelector('p').textContent = 'Failed to load history';
    historyEmpty.querySelector('.empty-sub').textContent = error.message;
  }
}

function displayHistory(historyData) {
  historyLoading.classList.add('hidden');
  
  if (!historyData || historyData.length === 0) {
    historyEmpty.classList.remove('hidden');
    historyList.classList.add('hidden');
    return;
  }
  
  historyEmpty.classList.add('hidden');
  historyList.classList.remove('hidden');
  historyList.innerHTML = '';
  
  historyData.forEach((item, index) => {
    const historyItem = createHistoryItem(item, index);
    historyList.appendChild(historyItem);
  });
}

function createHistoryItem(item, index) {
  const div = document.createElement('div');
  div.className = 'history-item';
  
  const timestamp = new Date(item.created_at || item.timestamp).toLocaleString();
  const emotion = item.primary_emotion || item.primary;
  const confidence = item.confidence || (item.probability_json ? item.probability_json[emotion] : 0);
  const emotionData = item.probability_json || item.data || {};
  
  const emotionInfo = EMOTIONS[emotion] || EMOTIONS.neutral;
  
  div.innerHTML = `
    <div class="history-item-header">
      <div class="history-emotion">
        <span class="history-emoji">${emotionInfo.emoji}</span>
        <span>${emotionInfo.label}</span>
      </div>
      <div class="history-confidence">${confidence.toFixed(1)}%</div>
    </div>
    <div class="history-timestamp">📅 ${timestamp}</div>
    ${item.transcription ? `<div class="history-transcription">💬 "${item.transcription}"</div>` : ''}
    <div class="history-details">
      ${Object.entries(EMOTIONS).map(([key, info]) => {
        const value = emotionData[key] || 0;
        return `
          <div class="history-bar">
            <div class="history-bar-label">${info.emoji} ${info.label}</div>
            <div class="history-bar-value">${value.toFixed(1)}%</div>
            <div class="history-bar-track">
              <div class="history-bar-fill" style="width: ${value}%; background: ${info.color}"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  div.addEventListener('click', () => {
    // Show detailed view or replay analysis
    showToast(`📊 Analysis from ${timestamp}`);
  });
  
  return div;
}

refreshHistoryBtn.addEventListener('click', () => {
  loadHistory();
  showToast('🔄 Refreshing history...');
});

backToMainBtn.addEventListener('click', () => {
  historyPanel.classList.add('hidden');
  landingActions.classList.remove('hidden');
});

clearHistoryBtn.addEventListener('click', async () => {
  if (confirm('Are you sure you want to clear all history? This action cannot be undone.')) {
    try {
      const response = await fetch('http://localhost:3000/history', { method: 'DELETE' });
      if (response.ok) {
        showToast('🗑️ History cleared successfully');
        loadHistory();
      } else {
        throw new Error('Failed to clear history');
      }
    } catch (error) {
      showToast('❌ Failed to clear history: ' + error.message);
    }
  }
});

console.log('%c🧠 Emotion AI Front-End Ready', 'color:#00FFFF;font-weight:bold;');
