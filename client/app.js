
// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION - Global settings for the application
// ═══════════════════════════════════════════════════════════════════════════════

const VERSION = '2.2.0-minerva';

const CONFIG = {
    API_BASE: '/api',
    AUDIO_MIME_TYPE: 'audio/webm;codecs=opus',
    AUDIO_FALLBACK_TYPE: 'audio/webm',
    WAVEFORM_BARS: 32,
    WAVEFORM_COLOR: '#4b0082',
    WAVEFORM_BG: '#e0dce6',
    MAX_RECORDING_SECONDS: 120,
    MOCK_MODE: true,
    MOCK_DELAY_MS: 1500
};


// ═══════════════════════════════════════════════════════════════════════════════
// STATE MANAGEMENT - Central state object tracking all application data
// ═══════════════════════════════════════════════════════════════════════════════

const AppState = {
    currentState: 'idle',           // UI state: 'idle' | 'recording' | 'preview' | 'processing'
    messages: [],                   // Array of message objects
    mediaRecorder: null,            // MediaRecorder instance
    audioChunks: [],                // Recorded audio data chunks
    recordingStartTime: null,       // Timestamp when recording started
    timerInterval: null,            // Interval ID for timer updates
    recordedBlob: null,             // Blob of recorded audio
    recordedUrl: null,              // Object URL for playback
    previewAudio: null,             // Audio element for preview
    previewDuration: 0,             // Duration in seconds
    audioContext: null,             // Web Audio API context
    analyser: null,                 // Analyser node for frequency data
    animationFrameId: null,         // requestAnimationFrame ID
    currentAudio: null,             // Currently playing Audio element
    playingMessageId: null          // ID of message being played
};


// ═══════════════════════════════════════════════════════════════════════════════
// DOM REFERENCES - Cached references to frequently accessed DOM elements
// ═══════════════════════════════════════════════════════════════════════════════

const DOM = {
    // Main containers
    chatMessages: document.getElementById('chat-messages'),
    chatContainer: document.getElementById('chat-container'),
    emptyState: document.getElementById('empty-state'),
    
    // Sidebar elements
    sidebar: document.getElementById('conversations-sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    sidebarClose: document.getElementById('sidebar-close'),
    
    // Settings elements
    settingsBtn: document.getElementById('settings-btn'),
    settingsPopup: document.getElementById('settings-popup'),
    darkModeToggle: document.getElementById('dark-mode-toggle'),
    
    // Input box elements
    chatInputBox: document.getElementById('chat-input-box'),
    textInput: document.getElementById('text-input'),
    
    // Recording overlay states
    recordingState: document.getElementById('recording-state'),
    previewState: document.getElementById('preview-state'),
    processingState: document.getElementById('processing-state'),
    
    // Action buttons
    recordBtn: document.getElementById('record-btn'),
    stopBtn: document.getElementById('stop-btn'),
    newChatBtn: document.getElementById('new-chat-btn'),
    previewPlayBtn: document.getElementById('preview-play-btn'),
    discardBtn: document.getElementById('discard-btn'),
    sendBtn: document.getElementById('send-btn'),
    
    // Recording UI elements
    waveformCanvas: document.getElementById('waveform'),
    timer: document.getElementById('timer'),
    
    // Preview UI elements
    previewProgress: document.getElementById('preview-progress'),
    previewDuration: document.getElementById('preview-duration'),
    
    // Error toast
    errorToast: document.getElementById('error-toast'),
    errorMessage: document.getElementById('error-message')
};


// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS - Helper functions used throughout the application
// ═══════════════════════════════════════════════════════════════════════════════

// Generate unique ID for messages
function generateId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Format seconds as M:SS (e.g., 1:30)
function formatTime(seconds) {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format Date object for message timestamps
function formatTimestamp(date) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// Display error toast notification
function showError(message, duration = 4000) {
    DOM.errorMessage.textContent = message;
    DOM.errorToast.classList.remove('hidden');
    DOM.errorToast.classList.add('visible');
    
    setTimeout(() => {
        DOM.errorToast.classList.remove('visible');
        setTimeout(() => DOM.errorToast.classList.add('hidden'), 250);
    }, duration);
}

// Verify browser supports required APIs
function checkBrowserSupport() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support audio recording');
    }
    if (!window.MediaRecorder) {
        throw new Error('Your browser does not support MediaRecorder');
    }
    if (!window.AudioContext && !window.webkitAudioContext) {
        throw new Error('Your browser does not support Web Audio API');
    }
}

// Toggle watermark visibility based on message count
function updateWatermark() {
    DOM.chatContainer.classList.toggle('has-messages', AppState.messages.length > 0);
}

// Escape HTML to prevent XSS attacks
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


// ═══════════════════════════════════════════════════════════════════════════════
// STATE TRANSITIONS - Manage UI state changes
// ═══════════════════════════════════════════════════════════════════════════════

function setState(newState) {
    AppState.currentState = newState;
    
    // Show/hide appropriate UI elements based on state
    DOM.chatInputBox.classList.toggle('hidden', newState !== 'idle');
    DOM.recordingState.classList.toggle('hidden', newState !== 'recording');
    DOM.previewState.classList.toggle('hidden', newState !== 'preview');
    DOM.processingState.classList.toggle('hidden', newState !== 'processing');
    
    // Update empty state and watermark
    DOM.emptyState.classList.toggle('hidden', AppState.messages.length > 0);
    updateWatermark();
}


// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO RECORDING - Functions for capturing audio from microphone
// ═══════════════════════════════════════════════════════════════════════════════

// Request mic access and start recording
async function startRecording() {
    try {
        checkBrowserSupport();
        
        // Request microphone with noise reduction
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
        });
        
        // Determine best supported MIME type
        let mimeType = CONFIG.AUDIO_MIME_TYPE;
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = CONFIG.AUDIO_FALLBACK_TYPE;
            if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';
        }
        
        // Initialize MediaRecorder
        AppState.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
        AppState.audioChunks = [];
        
        // Collect audio data chunks
        AppState.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) AppState.audioChunks.push(event.data);
        };
        
        AppState.mediaRecorder.onstop = handleRecordingComplete;
        AppState.mediaRecorder.start(100);
        AppState.recordingStartTime = Date.now();
        
        startWaveformVisualization(stream);
        startTimer();
        setState('recording');
        
    } catch (error) {
        console.error('Recording error:', error);
        if (error.name === 'NotAllowedError') {
            showError('Microphone access denied. Please allow microphone access.');
        } else if (error.name === 'NotFoundError') {
            showError('No microphone found. Please connect a microphone.');
        } else {
            showError(error.message || 'Failed to start recording');
        }
    }
}

// Stop current recording
function stopRecording() {
    if (AppState.mediaRecorder && AppState.mediaRecorder.state !== 'inactive') {
        AppState.mediaRecorder.stop();
        AppState.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    stopWaveformVisualization();
    stopTimer();
}

// Process completed recording
async function handleRecordingComplete() {
    const recordingDuration = AppState.recordingStartTime 
        ? (Date.now() - AppState.recordingStartTime) / 1000 : 0;
    
    const audioBlob = new Blob(AppState.audioChunks, { 
        type: AppState.mediaRecorder.mimeType || 'audio/webm'
    });
    
    // Validate recording has content
    if (audioBlob.size < 1000) {
        showError('Recording too short. Please try again.');
        setState('idle');
        return;
    }
    
    AppState.recordedBlob = audioBlob;
    if (AppState.recordedUrl) URL.revokeObjectURL(AppState.recordedUrl);
    AppState.recordedUrl = URL.createObjectURL(audioBlob);
    AppState.previewDuration = recordingDuration;
    DOM.previewDuration.textContent = formatTime(recordingDuration);
    DOM.previewProgress.style.width = '0%';
    resetPreviewPlayButton();
    setState('preview');
}

// Send recorded audio to server
async function sendRecordedAudio() {
    stopPreviewPlayback();
    
    const userAudioUrl = AppState.recordedUrl;
    const userAudioDuration = AppState.previewDuration;
    
    if (!userAudioUrl) {
        showError('No recording found. Please try again.');
        setState('idle');
        return;
    }
    
    setState('processing');
    
    try {
        const result = await sendAudioToServer(AppState.recordedBlob);
        
        // Add user message with recorded audio
        addMessage('user', result.transcript, userAudioUrl);
        AppState.recordedUrl = null;
        AppState.previewDuration = 0;
        
        // Add assistant response
        addMessage('assistant', result.response, result.audioUrl);
        
        if (result.audioUrl) {
            playAudio(result.audioUrl, AppState.messages[AppState.messages.length - 1].id);
        }
    } catch (error) {
        console.error('Processing error:', error);
        showError(error.message || 'Failed to process your message');
        AppState.recordedUrl = userAudioUrl;
        AppState.previewDuration = userAudioDuration;
    }
    
    AppState.recordedBlob = null;
    setState('idle');
}

// Discard recording and return to idle
function discardRecording() {
    stopPreviewPlayback();
    if (AppState.recordedUrl) {
        URL.revokeObjectURL(AppState.recordedUrl);
        AppState.recordedUrl = null;
    }
    AppState.recordedBlob = null;
    setState('idle');
}


// ═══════════════════════════════════════════════════════════════════════════════
// TIMER FUNCTIONS - Recording duration display
// ═══════════════════════════════════════════════════════════════════════════════

function startTimer() {
    updateTimer();
    AppState.timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    const elapsed = Math.floor((Date.now() - AppState.recordingStartTime) / 1000);
    DOM.timer.textContent = formatTime(elapsed);
    
    // Auto-stop at max duration
    if (elapsed >= CONFIG.MAX_RECORDING_SECONDS) {
        stopRecording();
        showError(`Maximum recording time (${formatTime(CONFIG.MAX_RECORDING_SECONDS)}) reached`);
    }
}

function stopTimer() {
    if (AppState.timerInterval) {
        clearInterval(AppState.timerInterval);
        AppState.timerInterval = null;
    }
    DOM.timer.textContent = '0:00';
}


// ═══════════════════════════════════════════════════════════════════════════════
// WAVEFORM VISUALIZATION - Live audio frequency display during recording
// ═══════════════════════════════════════════════════════════════════════════════

function startWaveformVisualization(stream) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    AppState.audioContext = new AudioContext();
    AppState.analyser = AppState.audioContext.createAnalyser();
    AppState.analyser.fftSize = 128;
    AppState.analyser.smoothingTimeConstant = 0.8;
    
    const source = AppState.audioContext.createMediaStreamSource(stream);
    source.connect(AppState.analyser);
    drawWaveform();
}

function drawWaveform() {
    const canvas = DOM.waveformCanvas;
    const ctx = canvas.getContext('2d');
    const analyser = AppState.analyser;
    
    if (!analyser) return;
    
    // Get frequency data
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    // Clear canvas
    ctx.fillStyle = CONFIG.WAVEFORM_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw bars
    const barCount = CONFIG.WAVEFORM_BARS;
    const barWidth = (canvas.width / barCount) - 2;
    const samplesPerBar = Math.floor(bufferLength / barCount);
    
    ctx.fillStyle = CONFIG.WAVEFORM_COLOR;
    
    for (let i = 0; i < barCount; i++) {
        let sum = 0;
        for (let j = 0; j < samplesPerBar; j++) {
            sum += dataArray[i * samplesPerBar + j];
        }
        const average = sum / samplesPerBar;
        const barHeight = Math.max(2, (average / 255) * (canvas.height - 4));
        const x = i * (barWidth + 2);
        const y = (canvas.height - barHeight) / 2;
        
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
    }
    
    AppState.animationFrameId = requestAnimationFrame(drawWaveform);
}

function stopWaveformVisualization() {
    if (AppState.animationFrameId) {
        cancelAnimationFrame(AppState.animationFrameId);
        AppState.animationFrameId = null;
    }
    if (AppState.audioContext) {
        AppState.audioContext.close();
        AppState.audioContext = null;
        AppState.analyser = null;
    }
    
    // Clear canvas
    const ctx = DOM.waveformCanvas.getContext('2d');
    ctx.fillStyle = CONFIG.WAVEFORM_BG;
    ctx.fillRect(0, 0, DOM.waveformCanvas.width, DOM.waveformCanvas.height);
}


// ═══════════════════════════════════════════════════════════════════════════════
// PREVIEW PLAYBACK - Play recorded audio before sending
// ═══════════════════════════════════════════════════════════════════════════════

function togglePreviewPlayback() {
    if (AppState.previewAudio && !AppState.previewAudio.paused) {
        AppState.previewAudio.pause();
        updatePreviewPlayButton(false);
    } else {
        playPreview();
    }
}

function playPreview() {
    if (!AppState.recordedUrl) return;
    
    if (!AppState.previewAudio) {
        AppState.previewAudio = new Audio(AppState.recordedUrl);
        AppState.previewAudio.addEventListener('timeupdate', updatePreviewProgress);
        AppState.previewAudio.addEventListener('ended', () => {
            updatePreviewPlayButton(false);
            DOM.previewProgress.style.width = '0%';
        });
    }
    
    AppState.previewAudio.play().catch(error => {
        console.error('Preview playback error:', error);
        showError('Failed to play recording');
    });
    
    updatePreviewPlayButton(true);
}

function stopPreviewPlayback() {
    if (AppState.previewAudio) {
        AppState.previewAudio.pause();
        AppState.previewAudio.currentTime = 0;
        AppState.previewAudio = null;
    }
    updatePreviewPlayButton(false);
    DOM.previewProgress.style.width = '0%';
}

function updatePreviewProgress() {
    if (!AppState.previewAudio || !AppState.previewDuration) return;
    const progress = (AppState.previewAudio.currentTime / AppState.previewDuration) * 100;
    DOM.previewProgress.style.width = `${Math.min(100, progress)}%`;
}

function updatePreviewPlayButton(isPlaying) {
    const playIcon = DOM.previewPlayBtn.querySelector('.icon-play');
    const pauseIcon = DOM.previewPlayBtn.querySelector('.icon-pause');
    playIcon.classList.toggle('hidden', isPlaying);
    pauseIcon.classList.toggle('hidden', !isPlaying);
}

function resetPreviewPlayButton() {
    const playIcon = DOM.previewPlayBtn.querySelector('.icon-play');
    const pauseIcon = DOM.previewPlayBtn.querySelector('.icon-pause');
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    if (AppState.previewAudio) {
        AppState.previewAudio.pause();
        AppState.previewAudio = null;
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// API COMMUNICATION - Server interactions (mock mode available)
// ═══════════════════════════════════════════════════════════════════════════════

async function sendAudioToServer(audioBlob) {
    if (CONFIG.MOCK_MODE) return mockApiResponse(audioBlob);
    
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    
    const response = await fetch(`${CONFIG.API_BASE}/chat`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Server error');
    }
    
    return response.json();
}

async function resetSession() {
    if (CONFIG.MOCK_MODE) {
        AppState.messages = [];
        renderMessages();
        setState('idle');
        return;
    }
    
    try {
        await fetch(`${CONFIG.API_BASE}/session/reset`, { method: 'POST', credentials: 'include' });
        AppState.messages = [];
        renderMessages();
    } catch (error) {
        console.error('Reset error:', error);
        showError('Failed to start new chat');
    }
}

// Mock API response for testing without backend
async function mockApiResponse(audioBlob) {
    await new Promise(resolve => setTimeout(resolve, CONFIG.MOCK_DELAY_MS));
    
    const responses = [
        { transcript: "What's the weather like today?", response: "I don't have access to real-time weather data, but I can help you find weather information! You could check a weather website or app for your location." },
        { transcript: "Tell me a joke", response: "Why don't scientists trust atoms? Because they make up everything! 😄" },
        { transcript: "What can you help me with?", response: "I can help with a wide variety of tasks! I can answer questions, explain concepts, help with writing, brainstorm ideas, and much more." },
        { transcript: "Hello, how are you?", response: "Hello! I'm doing great, thank you for asking! I'm here and ready to help you with whatever you need." }
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    return { transcript: randomResponse.transcript, response: randomResponse.response, audioUrl: null };
}


// ═══════════════════════════════════════════════════════════════════════════════
// CHAT RENDERING - Display messages in the chat area
// ═══════════════════════════════════════════════════════════════════════════════

function addMessage(role, content, audioUrl = null) {
    const message = {
        id: generateId(),
        role,
        content,
        audioUrl,
        timestamp: new Date()
    };
    
    AppState.messages.push(message);
    DOM.chatMessages.appendChild(createMessageElement(message));
    DOM.emptyState.classList.add('hidden');
    updateWatermark();
    scrollToBottom();
}

function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = `message ${message.role}`;
    div.dataset.messageId = message.id;
    
    // Avatar: "You" for user, microphone icon for assistant
    const avatarIcon = message.role === 'user' 
        ? 'You' 
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
             <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
           </svg>`;
    
    // Play button only if message has audio
    const hasAudio = message.audioUrl && message.audioUrl.length > 0;
    const playButtonHtml = hasAudio ? `
        <button class="btn-play" data-audio-url="${message.audioUrl}" aria-label="Play audio">
            <svg class="icon-play" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <svg class="icon-pause hidden" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
            </svg>
        </button>` : '';
    
    div.innerHTML = `
        <div class="message-avatar">${avatarIcon}</div>
        <div class="message-content">
            <div class="message-bubble">${escapeHtml(message.content)}</div>
            <div class="message-footer">
                ${playButtonHtml}
                <span class="message-time">${formatTimestamp(message.timestamp)}</span>
            </div>
        </div>`;
    
    // Add play button click handler
    const playBtn = div.querySelector('.btn-play');
    if (playBtn) {
        playBtn.addEventListener('click', () => playAudio(playBtn.dataset.audioUrl, message.id));
    }
    
    return div;
}

function renderMessages() {
    DOM.chatMessages.innerHTML = '';
    
    if (AppState.messages.length === 0) {
        DOM.emptyState.classList.remove('hidden');
        updateWatermark();
        return;
    }
    
    DOM.emptyState.classList.add('hidden');
    updateWatermark();
    AppState.messages.forEach(message => DOM.chatMessages.appendChild(createMessageElement(message)));
    scrollToBottom();
}

function scrollToBottom() {
    DOM.chatContainer.scrollTop = DOM.chatContainer.scrollHeight;
}


// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO PLAYBACK - Play message audio (TTS responses or user recordings)
// ═══════════════════════════════════════════════════════════════════════════════

function playAudio(audioUrl, messageId) {
    // Stop current audio if playing
    if (AppState.currentAudio) {
        AppState.currentAudio.pause();
        updatePlayButton(AppState.playingMessageId, false);
    }
    
    // Toggle off if same message clicked
    if (AppState.playingMessageId === messageId) {
        AppState.currentAudio = null;
        AppState.playingMessageId = null;
        return;
    }
    
    // Play new audio
    const audio = new Audio(audioUrl);
    AppState.currentAudio = audio;
    AppState.playingMessageId = messageId;
    
    updatePlayButton(messageId, true);
    
    audio.play().catch(error => {
        console.error('Playback error:', error);
        showError('Failed to play audio');
        updatePlayButton(messageId, false);
    });
    
    audio.onended = () => {
        updatePlayButton(messageId, false);
        AppState.currentAudio = null;
        AppState.playingMessageId = null;
    };
}

function updatePlayButton(messageId, isPlaying) {
    const message = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!message) return;
    
    const playBtn = message.querySelector('.btn-play');
    if (!playBtn) return;
    
    playBtn.classList.toggle('playing', isPlaying);
    const playIcon = playBtn.querySelector('.icon-play');
    const pauseIcon = playBtn.querySelector('.icon-pause');
    if (playIcon && pauseIcon) {
        playIcon.classList.toggle('hidden', isPlaying);
        pauseIcon.classList.toggle('hidden', !isPlaying);
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR TOGGLE - Collapse/expand the conversations sidebar
// ═══════════════════════════════════════════════════════════════════════════════

function openSidebar() {
    DOM.sidebar.classList.remove('collapsed');
    document.body.classList.remove('sidebar-collapsed');
}

function closeSidebar() {
    DOM.sidebar.classList.add('collapsed');
    document.body.classList.add('sidebar-collapsed');
}


// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS & DARK MODE - Theme toggle with localStorage persistence
// ═══════════════════════════════════════════════════════════════════════════════

function toggleSettingsPopup(event) {
    event.stopPropagation();
    DOM.settingsPopup.classList.toggle('hidden');
}

function closeSettingsPopup() {
    DOM.settingsPopup.classList.add('hidden');
}

function toggleDarkMode() {
    const isDark = DOM.darkModeToggle.checked;
    document.body.classList.toggle('dark-mode', isDark);
    localStorage.setItem('minerva-dark-mode', isDark ? 'true' : 'false');
}

function loadDarkModePreference() {
    const savedPreference = localStorage.getItem('minerva-dark-mode');
    if (savedPreference === 'true') {
        document.body.classList.add('dark-mode');
        DOM.darkModeToggle.checked = true;
    }
}

// Close popup when clicking outside
function handleDocumentClick(event) {
    if (!DOM.settingsPopup.classList.contains('hidden')) {
        if (!DOM.settingsPopup.contains(event.target) && event.target !== DOM.settingsBtn) {
            closeSettingsPopup();
        }
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// TEXT INPUT HANDLING - Keyboard input for future text chat feature
// ═══════════════════════════════════════════════════════════════════════════════

function handleTextInput(event) {
    // Placeholder for future enhancements
}

// Enter key handler (dummy for now - text chat not implemented)
function handleTextInputKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const text = DOM.textInput.value.trim();
        if (text) {
            console.log('Text input submitted (dummy):', text);
            DOM.textInput.value = '';
        }
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS - Button clicks and keyboard shortcuts
// ═══════════════════════════════════════════════════════════════════════════════

function handleRecordClick() {
    if (AppState.currentState === 'idle') startRecording();
}

function handleStopClick() {
    if (AppState.currentState === 'recording') stopRecording();
}

function handlePreviewPlayClick() {
    if (AppState.currentState === 'preview') togglePreviewPlayback();
}

function handleSendClick() {
    if (AppState.currentState === 'preview') sendRecordedAudio();
}

function handleDiscardClick() {
    if (AppState.currentState === 'preview') discardRecording();
}

function handleNewChatClick() {
    if (AppState.currentAudio) {
        AppState.currentAudio.pause();
        AppState.currentAudio = null;
        AppState.playingMessageId = null;
    }
    stopPreviewPlayback();
    if (AppState.currentState === 'recording') stopRecording();
    if (AppState.recordedUrl) {
        URL.revokeObjectURL(AppState.recordedUrl);
        AppState.recordedUrl = null;
    }
    AppState.recordedBlob = null;
    resetSession();
}

// Keyboard shortcuts
function handleKeyDown(event) {
    // Don't trigger shortcuts when typing in text input
    if (event.target === DOM.textInput) return;
    
    // Space: start/stop recording or play preview
    if (event.code === 'Space' && !event.target.matches('input, textarea, button')) {
        event.preventDefault();
        if (AppState.currentState === 'idle') startRecording();
        else if (AppState.currentState === 'recording') stopRecording();
        else if (AppState.currentState === 'preview') togglePreviewPlayback();
    }
    
    // Enter: send in preview mode
    if (event.code === 'Enter' && AppState.currentState === 'preview') {
        event.preventDefault();
        sendRecordedAudio();
    }
    
    // Escape: cancel recording or discard preview
    if (event.code === 'Escape') {
        if (AppState.currentState === 'recording') {
            if (AppState.mediaRecorder) {
                AppState.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            }
            stopWaveformVisualization();
            stopTimer();
            AppState.audioChunks = [];
            setState('idle');
        } else if (AppState.currentState === 'preview') {
            discardRecording();
        }
    }
}


// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION - Set up the application on page load
// ═══════════════════════════════════════════════════════════════════════════════

function init() {
    // Check browser support
    try {
        checkBrowserSupport();
    } catch (error) {
        showError(error.message, 10000);
        DOM.recordBtn.disabled = true;
        return;
    }
    
    // Attach event listeners - Buttons
    DOM.recordBtn.addEventListener('click', handleRecordClick);
    DOM.stopBtn.addEventListener('click', handleStopClick);
    DOM.newChatBtn.addEventListener('click', handleNewChatClick);
    DOM.previewPlayBtn.addEventListener('click', handlePreviewPlayClick);
    DOM.sendBtn.addEventListener('click', handleSendClick);
    DOM.discardBtn.addEventListener('click', handleDiscardClick);
    
    // Attach event listeners - Sidebar
    DOM.sidebarToggle.addEventListener('click', openSidebar);
    DOM.sidebarClose.addEventListener('click', closeSidebar);
    
    // Attach event listeners - Settings
    DOM.settingsBtn.addEventListener('click', toggleSettingsPopup);
    DOM.darkModeToggle.addEventListener('change', toggleDarkMode);
    
    // Attach event listeners - Document level
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);
    
    // Attach event listeners - Text input
    DOM.textInput.addEventListener('input', handleTextInput);
    DOM.textInput.addEventListener('keydown', handleTextInputKeydown);
    
    // Initialize waveform canvas
    const ctx = DOM.waveformCanvas.getContext('2d');
    ctx.fillStyle = CONFIG.WAVEFORM_BG;
    ctx.fillRect(0, 0, DOM.waveformCanvas.width, DOM.waveformCanvas.height);
    
    // Set initial state and load preferences
    setState('idle');
    loadDarkModePreference();
    
    console.log(`Minerva Voice Chat v${VERSION} initialized`);
    console.log('Shortcuts: Space (record/stop/play), Enter (send), Escape (cancel)');
}

// Start app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
