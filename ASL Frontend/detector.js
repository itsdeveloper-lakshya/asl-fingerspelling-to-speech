// =========================================================
// ASL ENGINE - HIGH PERFORMANCE DETECTOR & MULTILINGUAL UI
// =========================================================

const BACKEND_URL = "http://127.0.0.1:5000";

// --- DOM ELEMENTS ---
const container = document.getElementById('webgl-container');
const webcamVideo = document.getElementById('webcam');
const landmarkCanvas = document.getElementById('landmarks-canvas');
const mainSensorBtn = document.getElementById('main-sensor-btn');

const sensorStatusPill = document.getElementById('sensor-status-pill');
const statusPulseDot = document.getElementById('status-pulse-dot');
const sensorStatusText = document.getElementById('sensor-status-text');

const liveGestureHud = document.getElementById('live-gesture-hud');
const hudLetter = document.getElementById('hud-letter');
const hudConf = document.getElementById('hud-conf');
const hudProgressBar = document.getElementById('hud-progress-bar');
const cameraHintBanner = document.getElementById('camera-hint-banner');
const cameraHintText = document.getElementById('camera-hint-text');

const liveAslText = document.getElementById('live-asl-text');
const liveTranslatedText = document.getElementById('live-translated-text');
const translatedBoxTitle = document.getElementById('translated-box-title');
const langDropdownBtn = document.getElementById('langDropdown');
const dropdownItems = document.querySelectorAll('#output-stream-list .dropdown-item');

const btnCopy = document.getElementById('btn-copy');
const btnBackspace = document.getElementById('btn-backspace');
const btnClear = document.getElementById('btn-clear');
const btnAddSpace = document.getElementById('btn-add-space');
const btnTriggerTranslate = document.getElementById('btn-trigger-translate');
const btnSpeakVoice = document.getElementById('btn-speak-voice');

let landmarkCtx = landmarkCanvas ? landmarkCanvas.getContext('2d') : null;

// --- STATE MANAGEMENT ---
let isSensorRunning = false;
let cameraInstance = null;
let currentSentence = "";
let lastTranslatedSentence = "";
let currentLangCode = "hi";
let currentLangName = "Hindi";

// Gesture Recognition Buffers & Timers
const PREDICT_THROTTLE_MS = 33;       // ~30 FPS (client-side inference is instant)
const LETTER_HOLD_DURATION_MS = 800;  // Hold sign 0.8s to commit
const SPACE_HOLD_DURATION_MS = 1200;  // Drop hand 1.2s for space
const AUTO_TRANSLATE_IDLE_MS = 4000;  // Auto translate after 4s idle

let lastPredictCallTime = 0;
let isPredicting = false;
let gestureBuffer = [];
const BUFFER_MAX_LEN = 6;

// Label map matching model training classes (0-31)
const LABELS_DICT = {
  0: 'A', 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F', 6: 'G', 7: 'H',
  8: 'I', 9: 'J', 10: 'K', 11: 'L', 12: 'M', 13: 'N', 14: 'O',
  15: 'P', 16: 'Q', 17: 'R', 18: 'S', 19: 'T', 20: 'U', 21: 'V',
  22: 'W', 23: 'X', 24: 'Y', 25: 'Z',
  26: 'I Love U', 27: 'Hello', 28: 'Yes',
  29: 'No', 30: 'Namaste', 31: 'Thank you'
};

// Autocomplete state
let autocompleteTimeout = null;
let activeAutocomplete = [];

let currentHoldingLetter = "";
let holdStartTime = 0;

let handWasPresent = false;
let lastHandSeenTime = Date.now();
let spaceAddedForCurrentDrop = false;
let autoTranslatedForCurrentDrop = false;
let lastDeleteGestureTime = 0;

// Language Locale Mapping for Web Speech Synthesis
const LOCALE_MAP = {
  "hi": "hi-IN",
  "ta": "ta-IN",
  "te": "te-IN",
  "bn": "bn-IN",
  "mr": "mr-IN",
  "gu": "gu-IN",
  "kn": "kn-IN",
  "ml": "ml-IN",
  "pa": "pa-IN",
  "ur": "ur-IN",
  "en": "en-US",
  "es": "es-ES",
  "fr": "fr-FR",
  "de": "de-DE",
  "ja": "ja-JP",
  "zh-cn": "zh-CN"
};

// ==========================================
// 1. OPTIMIZED THREE.JS BACKGROUND CORE
// ==========================================
let scene, camera3D, renderer, holoMesh, particles;
let threeAnimId = null;

function initThreeJS() {
  if (!container || typeof THREE === 'undefined') return;

  scene = new THREE.Scene();
  camera3D = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera3D.position.z = 10;

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "high-performance" });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.domElement.style.position = 'absolute';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  renderer.domElement.style.pointerEvents = 'none';
  renderer.domElement.style.mixBlendMode = 'screen';
  renderer.domElement.id = "webgl-canvas";
  container.appendChild(renderer.domElement);

  const geometry = new THREE.IcosahedronGeometry(2, 1);
  const material = new THREE.MeshBasicMaterial({ color: 0x00e1ff, wireframe: true, transparent: true, opacity: 0.35 });
  holoMesh = new THREE.Mesh(geometry, material);
  scene.add(holoMesh);

  const pGeometry = new THREE.BufferGeometry();
  const pCount = 60;
  const pPos = new Float32Array(pCount * 3);
  for(let i = 0; i < pCount * 3; i++) {
    pPos[i] = (Math.random() - 0.5) * 14;
  }
  pGeometry.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.04, transparent: true, opacity: 0.5 });
  particles = new THREE.Points(pGeometry, pMaterial);
  scene.add(particles);

  window.addEventListener('resize', () => {
    if (container.clientWidth > 0 && camera3D && renderer) {
      camera3D.aspect = container.clientWidth / container.clientHeight;
      camera3D.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    }
  });

  startThreeJS();
}

function startThreeJS() {
  if (!threeAnimId && renderer) {
    function loop() {
      threeAnimId = requestAnimationFrame(loop);
      if (holoMesh) {
        holoMesh.rotation.x += 0.004;
        holoMesh.rotation.y += 0.006;
      }
      if (particles) particles.rotation.y -= 0.001;
      renderer.render(scene, camera3D);
    }
    loop();
  }
}

function pauseThreeJS() {
  if (threeAnimId) {
    cancelAnimationFrame(threeAnimId);
    threeAnimId = null;
  }
  if (renderer && renderer.domElement) {
    renderer.domElement.style.display = 'none';
  }
}

function resumeThreeJS() {
  if (renderer && renderer.domElement) {
    renderer.domElement.style.display = 'block';
  }
  startThreeJS();
}

initThreeJS();

// ==========================================
// 2. MEDIAPIPE HANDS SETUP (LOW-LATENCY)
// ==========================================
let hands = null;

if (typeof Hands !== 'undefined') {
  hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  // maxNumHands: 1 for rock-solid single-hand ASL alphabet recognition without false delete triggers
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  hands.onResults(handleHandResults);
}

// Draw futuristic, thin glowing connections
function drawStylizedLandmarks(landmarks) {
  if (!landmarkCtx || !landmarkCanvas) return;

  const w = landmarkCanvas.width;
  const h = landmarkCanvas.height;

  const connections = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],[0,17]
  ];

  landmarkCtx.save();
  landmarkCtx.strokeStyle = 'rgba(0, 225, 255, 0.7)';
  landmarkCtx.lineWidth = 2;
  landmarkCtx.shadowColor = '#00E1FF';
  landmarkCtx.shadowBlur = 6;

  for (const [i, j] of connections) {
    const p1 = landmarks[i];
    const p2 = landmarks[j];
    landmarkCtx.beginPath();
    landmarkCtx.moveTo(p1.x * w, p1.y * h);
    landmarkCtx.lineTo(p2.x * w, p2.y * h);
    landmarkCtx.stroke();
  }

  // Draw refined joint dots
  landmarkCtx.shadowBlur = 0;
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    const isTip = [4, 8, 12, 16, 20].includes(i);

    landmarkCtx.beginPath();
    landmarkCtx.arc(lm.x * w, lm.y * h, isTip ? 4 : 2.5, 0, 2 * Math.PI);
    landmarkCtx.fillStyle = isTip ? '#00FF88' : '#FFFFFF';
    landmarkCtx.fill();
  }
  landmarkCtx.restore();
}

// ==========================================
// 3. CORE GESTURE RECOGNITION & LOGIC
// ==========================================
function handleHandResults(results) {
  if (!landmarkCanvas || !landmarkCtx || !webcamVideo) return;

  // Match canvas dimensions to webcam
  if (landmarkCanvas.width !== webcamVideo.videoWidth && webcamVideo.videoWidth > 0) {
    landmarkCanvas.width = webcamVideo.videoWidth;
    landmarkCanvas.height = webcamVideo.videoHeight;
  }

  landmarkCtx.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);
  const now = Date.now();

  // CASE A: NO HAND DETECTED
  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    if (handWasPresent) {
      // Hand just dropped!
      handWasPresent = false;
      lastHandSeenTime = now;
      spaceAddedForCurrentDrop = false;
      autoTranslatedForCurrentDrop = false;
      gestureBuffer = [];
      currentHoldingLetter = "";
      updateHud("-", 0, 0);
    }

    const timeWithoutHand = now - lastHandSeenTime;

    // Status Pill
    if (sensorStatusText) sensorStatusText.innerText = "Looking for Hand";
    if (statusPulseDot) statusPulseDot.className = "status-pulse-dot";

    // Trigger Space when hand lowered for 2.6s
    if (timeWithoutHand >= SPACE_HOLD_DURATION_MS && !spaceAddedForCurrentDrop) {
      if (currentSentence.length > 0 && !currentSentence.endsWith(" ")) {
        currentSentence += " ";
        updateSentenceDisplay();
        showCameraHint("␣ Space Added");
      }
      spaceAddedForCurrentDrop = true;
    }

    // Trigger Auto-Translate & Speak when hand stays away for 6.5s
    if (timeWithoutHand >= AUTO_TRANSLATE_IDLE_MS && !autoTranslatedForCurrentDrop) {
      if (currentSentence.trim().length > 0 && currentSentence.trim() !== lastTranslatedSentence) {
        triggerTranslation(false);
      }
      autoTranslatedForCurrentDrop = true;
    }

    return;
  }

  // CASE B: HAND DETECTED
  const numHands = results.multiHandLandmarks.length;

  // Hand just entered the frame!
  if (!handWasPresent) {
    handWasPresent = true;
    gestureBuffer = [];
    currentHoldingLetter = "";
    holdStartTime = now;
    showCameraHint("✋ Hand Detected - Hold gesture to spell");
  }

  lastHandSeenTime = now;
  if (sensorStatusText) sensorStatusText.innerText = `Live Tracking (${numHands})`;
  if (statusPulseDot) statusPulseDot.className = "status-pulse-dot active";

  // Draw stylized skeleton
  for (const lm of results.multiHandLandmarks) {
    drawStylizedLandmarks(lm);
  }

  // Single Hand Classification
  const singleHand = results.multiHandLandmarks[0];

  // Client-side inference (no HTTP needed)
  if (now - lastPredictCallTime >= PREDICT_THROTTLE_MS) {
    lastPredictCallTime = now;
    runLocalPrediction(singleHand);
  }

  // Manage hold progress bar animation
  if (currentHoldingLetter && holdStartTime > 0) {
    const elapsed = now - holdStartTime;
    const progressPct = Math.min(100, Math.round((elapsed / LETTER_HOLD_DURATION_MS) * 100));
    hudProgressBar.style.width = `${progressPct}%`;

    if (elapsed >= LETTER_HOLD_DURATION_MS) {
      // Letter hold time achieved -> commit letter!
      commitRecognizedLetter(currentHoldingLetter);
      currentHoldingLetter = "";
      holdStartTime = now;
      gestureBuffer = [];
      hudProgressBar.style.width = '0%';
    }
  } else {
    hudProgressBar.style.width = '0%';
  }
}

// Client-side inference using model.js (m2cgen generated)
function runLocalPrediction(landmarks) {
  const xs = [];
  const ys = [];
  for (const lm of landmarks) {
    xs.push(lm.x);
    ys.push(lm.y);
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const width = (maxX - minX) > 0 ? (maxX - minX) : 1e-6;
  const height = (maxY - minY) > 0 ? (maxY - minY) : 1e-6;

  // Scale-normalized features matching training pipeline
  const data_aux = [];
  for (const lm of landmarks) {
    data_aux.push((lm.x - minX) / width);
    data_aux.push((lm.y - minY) / height);
  }

  try {
    // predictFromLandmarks() is defined in model.js (m2cgen export)
    const result = predictFromLandmarks(data_aux);
    const letter = LABELS_DICT[result.classIndex] || "";
    const conf = result.confidence || 0;

    if (letter) {
      updateHud(letter, conf);

      if (conf >= 50) {
        gestureBuffer.push(letter);
        if (gestureBuffer.length > BUFFER_MAX_LEN) gestureBuffer.shift();

        const stableLetter = getMajorityVote(gestureBuffer);

        if (stableLetter) {
          if (stableLetter !== currentHoldingLetter) {
            currentHoldingLetter = stableLetter;
            holdStartTime = Date.now();
          }
        }
      }
    }
  } catch (err) {
    console.warn("Local prediction error:", err);
  }
}

function getMajorityVote(arr) {
  if (!arr || arr.length === 0) return null;
  const counts = {};
  for (const item of arr) counts[item] = (counts[item] || 0) + 1;
  let best = null, maxCount = 0;
  for (const key in counts) {
    if (counts[key] > maxCount) {
      maxCount = counts[key];
      best = key;
    }
  }
  return (maxCount >= 3) ? best : null;
}

function commitRecognizedLetter(letter) {
  if (!letter) return;

  // Multi-character signs get auto-spaced
  if (letter.length > 1) {
    if (currentSentence.length > 0 && !currentSentence.endsWith(" ")) {
      currentSentence += " ";
    }
    currentSentence += letter + " ";
  } else {
    currentSentence += letter;
  }

  updateSentenceDisplay();
  showCameraHint(`Added "${letter}"`);

  // Trigger LLM autocomplete after 2+ letters in current word
  requestAutocomplete();
}

// LLM-Powered Word Autocomplete via Gemini
function requestAutocomplete() {
  if (autocompleteTimeout) clearTimeout(autocompleteTimeout);

  // Extract the current partial word (last word being typed)
  const words = currentSentence.trimEnd().split(" ");
  const partial = words[words.length - 1] || "";

  if (partial.length < 2) {
    hideAutocomplete();
    return;
  }

  // Debounce: wait 300ms after last letter before querying
  autocompleteTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/autocomplete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partial: partial })
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.suggestions && data.suggestions.length > 0) {
        activeAutocomplete = data.suggestions;
        showAutocompleteSuggestions(data.suggestions, partial);
      } else {
        hideAutocomplete();
      }
    } catch (e) {
      // Autocomplete is best-effort, don't disrupt detection
    }
  }, 300);
}

function showAutocompleteSuggestions(suggestions, partial) {
  let bar = document.getElementById('autocomplete-bar');
  if (!bar) return;
  bar.innerHTML = '';
  bar.style.display = 'flex';

  suggestions.forEach(word => {
    const pill = document.createElement('button');
    pill.className = 'autocomplete-pill';
    pill.innerText = word;
    pill.addEventListener('click', () => {
      acceptAutocomplete(word, partial);
    });
    bar.appendChild(pill);
  });
}

function hideAutocomplete() {
  activeAutocomplete = [];
  const bar = document.getElementById('autocomplete-bar');
  if (bar) {
    bar.innerHTML = '';
    bar.style.display = 'none';
  }
}

function acceptAutocomplete(word, partial) {
  // Replace partial with the full word
  currentSentence = currentSentence.slice(0, -partial.length) + word + " ";
  updateSentenceDisplay();
  hideAutocomplete();
  showCameraHint(`Autocompleted: "${word}"`);
}

function updateHud(letter, conf) {
  if (hudLetter) hudLetter.innerText = letter;
  if (hudConf) hudConf.innerText = `${conf.toFixed(0)}%`;
}

function showCameraHint(msg) {
  if (cameraHintText && cameraHintBanner) {
    cameraHintText.innerText = msg;
    cameraHintBanner.style.display = 'block';
  }
}

function updateSentenceDisplay() {
  if (liveAslText) {
    if (currentSentence.length === 0) {
      liveAslText.innerHTML = `<span class="text-placeholder">Waiting for gesture input...</span>`;
    } else {
      liveAslText.innerHTML = `${escapeHtml(currentSentence)}<span class="blinking-cursor"></span>`;
    }
  }
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// ==========================================
// 4. MULTILINGUAL TRANSLATION & SPEECH
// ==========================================
async function triggerTranslation(speakOut = true) {
  const text = currentSentence.trim();
  if (!text) return;

  lastTranslatedSentence = text;
  if (liveTranslatedText) {
    liveTranslatedText.innerHTML = `<span style="color:var(--accent-cyan); font-size:1.05rem;">Translating to ${currentLangName}...</span>`;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text, lang: currentLangCode })
    });

    const data = await res.json();
    const translated = data.translated || text;

    if (liveTranslatedText) {
      liveTranslatedText.innerHTML = `<span style="color:#FFF;">${escapeHtml(translated)}</span>`;
    }

    if (speakOut) {
      speakInLanguage(translated, currentLangCode);
    }
  } catch (err) {
    console.warn("Translation API error:", err);
    if (liveTranslatedText) {
      liveTranslatedText.innerText = text;
    }
    if (speakOut) speakInLanguage(text, "en");
  }
}

function speakInLanguage(text, langCode) {
  if (!('speechSynthesis' in window) || !text) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LOCALE_MAP[langCode] || "en-US";
  utterance.rate = 0.95;
  utterance.pitch = 1.0;

  window.speechSynthesis.speak(utterance);
}

// ==========================================
// 5. CAMERA TOGGLE & EVENT LISTENERS
// ==========================================
if (mainSensorBtn) {
  mainSensorBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    if (!isSensorRunning) {
      // START SENSOR
      try {
        mainSensorBtn.innerText = "Initializing Sensor...";
        if (sensorStatusText) sensorStatusText.innerText = "Starting Camera...";

        // Show Video & Landmark canvas
        if (webcamVideo) webcamVideo.style.display = 'block';
        if (landmarkCanvas) landmarkCanvas.style.display = 'block';
        if (liveGestureHud) liveGestureHud.style.display = 'flex';

        // Pause Three.JS to save 100% GPU for camera & inference
        pauseThreeJS();

        // Start MediaPipe Camera Stream at 640x480 (fastest web resolution)
        if (webcamVideo && hands && typeof Camera !== 'undefined') {
          cameraInstance = new Camera(webcamVideo, {
            onFrame: async () => {
              if (isSensorRunning) {
                await hands.send({ image: webcamVideo });
              }
            },
            width: 640,
            height: 480
          });
          await cameraInstance.start();
        }

        // Notify Flask Backend
        await fetch(`${BACKEND_URL}/start`);

        isSensorRunning = true;
        mainSensorBtn.innerText = "🛑 Stop ASL Sensor";
        mainSensorBtn.classList.add('running');
        if (sensorStatusText) sensorStatusText.innerText = "Sensor Active";
        if (statusPulseDot) statusPulseDot.className = "status-pulse-dot active";
        showCameraHint("✋ Sensor Active - Position hand in view");

      } catch (err) {
        console.error("Camera startup error:", err);
        alert("Could not access camera or connect to Flask Backend.\nPlease check camera permissions and make sure app.py is running.");
        stopSensor();
      }
    } else {
      // STOP SENSOR
      stopSensor();
    }
  });
}

function stopSensor() {
  isSensorRunning = false;

  if (cameraInstance) {
    cameraInstance.stop();
    cameraInstance = null;
  }

  if (webcamVideo) webcamVideo.style.display = 'none';
  if (landmarkCanvas) {
    landmarkCanvas.style.display = 'none';
    if (landmarkCtx) landmarkCtx.clearRect(0, 0, landmarkCanvas.width, landmarkCanvas.height);
  }
  if (liveGestureHud) liveGestureHud.style.display = 'none';

  resumeThreeJS();

  if (mainSensorBtn) {
    mainSensorBtn.innerText = "🚀 Start ASL Sensor";
    mainSensorBtn.classList.remove('running');
  }

  if (sensorStatusText) sensorStatusText.innerText = "Sensor Standby";
  if (statusPulseDot) statusPulseDot.className = "status-pulse-dot standby";
  showCameraHint("🚀 Click \"Start ASL Sensor\" below to begin");

  fetch(`${BACKEND_URL}/stop`).catch(() => {});
}

// Language Selection Dropdown
dropdownItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const code = item.getAttribute('data-code') || 'hi';
    const name = item.innerText.trim();

    currentLangCode = code;
    currentLangName = name;

    if (langDropdownBtn) {
      langDropdownBtn.innerText = name;
      langDropdownBtn.setAttribute('data-code', code);
    }

    if (translatedBoxTitle) {
      translatedBoxTitle.innerText = `Translated Output (${name})`;
    }

    showCameraHint(`Language changed to ${name}`);

    // If there is existing text, immediately translate to new language
    if (currentSentence.trim().length > 0) {
      triggerTranslation(true);
    }
  });
});

// Control Buttons
if (btnCopy) {
  btnCopy.addEventListener('click', () => {
    if (!currentSentence.trim()) return;
    navigator.clipboard.writeText(currentSentence.trim()).then(() => {
      showCameraHint("📋 Sentence copied to clipboard!");
    });
  });
}

if (btnBackspace) {
  btnBackspace.addEventListener('click', () => {
    if (currentSentence.length > 0) {
      currentSentence = currentSentence.slice(0, -1);
      updateSentenceDisplay();
      showCameraHint("⌫ Last character removed");
    }
  });
}

if (btnClear) {
  btnClear.addEventListener('click', () => {
    currentSentence = "";
    lastTranslatedSentence = "";
    updateSentenceDisplay();
    if (liveTranslatedText) {
      liveTranslatedText.innerHTML = `<span class="text-placeholder">Translation will appear here...</span>`;
    }
    showCameraHint("🧹 Cleared all text");
  });
}

if (btnAddSpace) {
  btnAddSpace.addEventListener('click', () => {
    if (currentSentence.length > 0 && !currentSentence.endsWith(" ")) {
      currentSentence += " ";
      updateSentenceDisplay();
      showCameraHint("␣ Space Added");
    }
  });
}

if (btnTriggerTranslate) {
  btnTriggerTranslate.addEventListener('click', () => {
    triggerTranslation(true);
  });
}

if (btnSpeakVoice) {
  btnSpeakVoice.addEventListener('click', () => {
    const transText = liveTranslatedText ? liveTranslatedText.innerText.trim() : "";
    if (transText && !transText.includes("Translation will appear")) {
      speakInLanguage(transText, currentLangCode);
    } else if (currentSentence.trim()) {
      triggerTranslation(true);
    }
  });
}
