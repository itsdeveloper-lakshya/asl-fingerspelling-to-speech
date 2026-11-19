# 🤟 American Sign Language (ASL) Detector & Multilingual Translator

## Hackathon Pitch — Complete Technical Documentation

> **Team Members**: Lakshya, Ashutosh, Mohammad, Kriti, Dev, Abhimann
> **Project Category**: AI/ML for Social Good — Accessibility & Inclusion

---

## 1. Problem Statement

Over **70 million deaf individuals worldwide** (NIDCD) rely on sign language as their primary mode of communication. In India alone, an estimated **18 million people** live with hearing disabilities (Census 2011). Despite this, there is a severe lack of accessible tools that can translate sign language into spoken and written language in real-time.

**Our solution bridges this gap** by building a complete end-to-end system that:
1. Recognizes 32 ASL gestures (A–Z + 6 common phrases) in real-time using a webcam.
2. Constructs full sentences from individual signs using intelligent timing logic.
3. Translates sentences into **16 languages** (10 Indian + 6 international).
4. Speaks the translation aloud using Text-to-Speech (TTS).

---

## 2. Solution Architecture

### System Flow
```
📷 Webcam → MediaPipe Hands → 21 Landmark Points (x,y)
    → Feature Extraction (42 floats) → Random Forest Classifier (model.p)
    → Predicted Letter + Confidence → Sentence Builder (Hold/Space/Delete Logic)
    → Google Translate API → gTTS / Web Speech API → 🔊 Spoken Output in 16 Languages
```

### Dual-Mode Architecture

| Mode | Description | Technology |
|------|-------------|-----------|
| **Web Mode** (Primary) | Browser-based detection via `detector.html` → sends landmarks to Flask `/predict` API | HTML/CSS/JS + Flask REST API |
| **Desktop Mode** (Standalone) | Direct OpenCV window with real-time detection | Python + OpenCV + MediaPipe |

---

## 3. Complete Project File Structure

```
Hackathon Project/
├── Start_ASL_Project.bat          # One-click launcher (backend + frontend + browser)
├── Train_Model.bat                # One-click model retraining script
│
├── ASL Backend/
│   ├── app.py                     # Flask REST API server (port 5000)
│   ├── asldataset.py              # Image → landmark feature extractor
│   ├── asltrainer.py              # Random Forest model trainer
│   ├── detectAlphabets.py         # Desktop: single letter detection (OpenCV)
│   ├── sentenceDetect.py          # Desktop: sentence construction (OpenCV)
│   ├── transSentence.py           # Desktop: sentence + delete + translation
│   ├── translator_speaker.py      # Translation engine + TTS audio
│   ├── sihimage.py                # Alternate 84-feature dataset extractor
│   ├── data.pickle                # Extracted landmark dataset (3.6 MB)
│   ├── model.p                    # Trained Random Forest model (17 MB)
│   ├── output.txt                 # Desktop mode sentence output file
│   └── venv/                      # Python virtual environment
│
└── ASL Frontend/
    ├── index.html                 # Landing page (scrollytelling hero)
    ├── detector.html              # Real-time ASL detection page
    ├── detector.js                # Core detection + inference + UI logic
    ├── main.js                    # Landing page animations & interactions
    ├── styles.css                 # Global CSS design system
    ├── b64images.js               # Base64-encoded ASL alphabet reference images
    ├── bg-cinematic.png           # Cinematic background texture
    ├── data set/                  # 240 frame sequence for hero animation
    └── package.json               # Node.js metadata
```

---

## 4. Detailed File-by-File Breakdown

---

### 4.1 `ASL Backend/asldataset.py` — Dataset Generator

**Purpose**: Converts raw hand gesture images into machine-learning-ready numerical features.

**How it works**:
1. Reads `.jpg`/`.png` images from `--data-dir`, `ASL_DATA_DIR`, or the local `ASL Backend/data/` directory.
2. The dataset is organized into **32 subfolders** (named `0` through `31` or by class names such as `A` and `Hello`) with separate image samples for each class.
3. For each image, MediaPipe Hands detects **21 hand landmark points** (wrist, thumb joints, index joints, etc.).
4. Each landmark has an `(x, y)` coordinate normalized to the frame dimensions `[0.0, 1.0]`.
5. Features are **scale-normalized** by dividing by the hand's bounding box size:
   ```python
   feature_x = (lm.x - min_x) / width    # Range: [0.0, 1.0]
   feature_y = (lm.y - min_y) / height    # Range: [0.0, 1.0]
   ```
6. This produces a **42-element feature vector** (21 landmarks × 2 coordinates) per image.
7. All vectors are saved as `data.pickle` (a Python serialized dictionary with `data` and `labels` keys).

**Why scale normalization?**
- Without it, features are raw pixel-relative offsets (range `[0.0, 0.25]`), which change depending on how far the hand is from the camera.
- With normalization, the gesture shape is described in a **scale-invariant** way — the same feature values whether your hand is 1 foot or 4 feet away.

**Key Configuration**:
- `static_image_mode=True` — processes each image independently (slower but more accurate for training).
- `min_detection_confidence=0.3` — lower threshold to capture more training samples.
- Only processes images where **exactly 1 hand** is detected (avoids multi-hand noise).

**Dataset Statistics**:

| Labels | Sign | Image Count |
|--------|------|-------------|
| 0 | A | 150 |
| 1–25 | B through Z | 300 each |
| 26 | I Love U | 300 |
| 27 | Hello | 300 |
| 28 | Yes | 300 |
| 29 | No | 300 |
| 30 | Namaste | 300 |
| 31 | Thank you | 300 |
| **Total** | **32 classes** | **~9,450 images** |

---

### 4.2 `ASL Backend/asltrainer.py` — Model Trainer

**Purpose**: Trains a Random Forest classifier on the extracted landmark features.

**Algorithm**: `sklearn.ensemble.RandomForestClassifier`

**Why Random Forest?**
- No need for GPU — runs on any CPU in seconds.
- Handles 42-dimensional feature space well without overfitting.
- Provides `predict_proba()` for confidence scores (essential for filtering noisy predictions).
- Inherently performs feature importance ranking.

**Hyperparameters**:
```python
RandomForestClassifier(
    n_estimators=300,     # 300 individual decision trees (ensemble)
    max_depth=25,         # Maximum tree depth to capture fine gesture differences
    min_samples_split=2,  # Standard split criterion
    random_state=42,      # Reproducible results
    n_jobs=-1             # Use ALL CPU cores for parallel training
)
```

**Why these values?**
- `n_estimators=300`: More trees = more stable predictions. 300 trees provide a strong consensus without excessive computation.
- `max_depth=25`: ASL has very similar gestures (e.g., M vs N differ by one finger). Deeper trees capture these fine distinctions.
- `n_jobs=-1`: Parallelizes across all CPU cores for faster training.

**Training Process**:
1. Loads `data.pickle` → splits 80/20 train/test with `stratify=labels` (ensures each class has proportional representation in both sets).
2. Trains the 300-tree ensemble.
3. Prints overall accuracy and per-class classification report.
4. Saves the trained model as `model.p` using Python's `pickle` serialization.

**Expected Accuracy**: ~95–98% on the test set.

---

### 4.3 `ASL Backend/app.py` — Flask REST API Server

**Purpose**: Central backend server providing real-time inference, translation, and session management.

**Port**: `http://127.0.0.1:5000`

**API Endpoints**:

| Endpoint | Method | Purpose | Input | Output |
|----------|--------|---------|-------|--------|
| `/predict` | POST | Real-time gesture classification | `{ landmarks: [42 floats] }` | `{ letter: "A", confidence: 95.2 }` |
| `/languages` | GET | Returns all supported languages | — | `{ regional: [...], international: [...] }` |
| `/translate` | POST | Translates text to target language | `{ text: "HELLO", lang: "hi" }` | `{ translated: "नमस्ते" }` |
| `/start` | GET | Signals detection session started | — | `{ status: "started" }` |
| `/stop` | GET | Signals detection session stopped | — | `{ status: "stopped" }` |
| `/get_text` | GET | Reads `output.txt` for desktop mode | — | `{ sentence: "...", history: [...] }` |

**CORS Configuration**: All responses include `Access-Control-Allow-Origin: *` to allow the frontend (running on port 8000) to communicate with the backend (port 5000) without browser security blocks.

**Model Loading**: The model (`model.p`) is loaded once at server startup into memory. The `/predict` endpoint uses `model.predict_proba()` to get probability distributions across all 32 classes, then uses `model.classes_[argmax]` to correctly map the prediction index to the actual class label.

**Why `model.classes_` mapping?**
- scikit-learn's `predict_proba()` returns probabilities ordered by `model.classes_`, not by sequential indices 0–31.
- If the training data didn't have every label from 0–31 represented in the same order, `argmax` of probabilities would point to the wrong class without this mapping.

---

### 4.4 `ASL Backend/translator_speaker.py` — Translation & Speech Engine

**Purpose**: Translates English text to any of 16 languages and speaks it aloud.

**Technology Stack**:
- **`googletrans`** — Google Translate API wrapper for text translation.
- **`gTTS`** (Google Text-to-Speech) — Converts translated text to an MP3 audio file.
- **`pygame`** — Plays the generated MP3 file through the system speakers.

**Supported Languages (16)**:

| Category | Languages |
|----------|-----------|
| 🇮🇳 **Regional Indian (10)** | Hindi (hi), Tamil (ta), Telugu (te), Bengali (bn), Marathi (mr), Gujarati (gu), Kannada (kn), Malayalam (ml), Punjabi (pa), Urdu (ur) |
| 🌍 **International (6)** | English (en), Spanish (es), French (fr), German (de), Japanese (ja), Chinese (zh-cn) |

**Why these specific languages?**
- India has 22 official languages. We prioritized the 10 most spoken regional languages by population.
- International languages cover the top 6 most commonly used languages globally.
- This makes the project relevant for both **SIH (Smart India Hackathon)** and international accessibility standards.

**Error Handling**: Translation is decoupled from audio playback — even if audio fails (e.g., headless server environment), the translated text is always returned to the caller.

---

### 4.5 `ASL Backend/detectAlphabets.py` — Desktop Single-Letter Detection

**Purpose**: Simplest detection mode — shows a live webcam feed with the predicted ASL letter overlaid.

**How it works**:
1. Opens webcam via `cv2.VideoCapture(0)`.
2. Each frame is processed by MediaPipe Hands.
3. If exactly 1 hand is detected, extracts 42 scale-normalized features.
4. Runs `model.predict()` to get the predicted character.
5. Uses a **smoothing buffer** (`deque(maxlen=10)`) — takes the majority vote of the last 10 predictions to eliminate flicker.
6. Draws a black rectangle with the predicted letter above the hand in the video feed.

**Why smoothing buffer?**
- Raw frame-by-frame predictions oscillate rapidly (e.g., M→N→M→N).
- A 10-frame majority vote stabilizes the output, showing only the gesture the user is consistently holding.

---

### 4.6 `ASL Backend/sentenceDetect.py` — Desktop Sentence Builder

**Purpose**: Extends single-letter detection to full sentence construction with intelligent timing.

**Sentence Construction Logic**:

| Event | Timer | Action |
|-------|-------|--------|
| **Hold same gesture** | 3 seconds | Letter is committed to the sentence |
| **Remove hand** | 3 seconds | Space is added to the sentence |
| **Hand stays away** | 8 seconds | Sentence is finalized and saved to `output.txt` |
| **New gesture detected** | — | Timer resets; starts counting for the new letter |

**Ghost Letter Prevention**:
- When the hand leaves the frame, `buffer`, `current_letter`, and `last_added_time` are all reset.
- When the hand re-enters the frame, these values are freshly initialized so the previous letter does not auto-commit.

**Why `hand_was_present` flag?**
- Without it, lowering the hand to add a space and then raising it again would immediately commit the last cached letter (because `time - last_added_time` was already >= 3 seconds).
- The flag ensures a clean state transition: hand exits → reset → hand re-enters → fresh start.

---

### 4.7 `ASL Backend/transSentence.py` — Desktop Full Pipeline (Detect + Delete + Translate)

**Purpose**: The most complete desktop script — combines sentence detection with two-hand delete and auto-translation.

**Additional Feature: Two-Hand Delete**:
- If MediaPipe detects **2 hands** simultaneously and they are spread apart (Euclidean distance > 0.3 in normalized coordinates), the last character is deleted from the sentence.
- A 1-second `time.sleep()` prevents rapid repeated deletions.

**Auto-Translation Trigger**:
- When the script exits (user presses 'Q'), any remaining sentence is saved to `output.txt`.
- The script then automatically launches `translator_speaker.py` via `os.system()`.

---

### 4.8 `ASL Backend/sihimage.py` — Alternate Dataset Extractor (84 features)

**Purpose**: An alternate/experimental dataset extractor designed for two-handed signs.

**Key Difference from `asldataset.py`**:
- Detects **up to 2 hands** (`max_num_hands=2`).
- Creates a **84-element feature vector** (42 for left hand + 42 for right hand).
- If only one hand is detected, the missing hand's features are padded with zeros.
- Uses `hand_handedness.classification[0].label` to correctly assign left vs right hand data.

**Why it exists**: This was an early experiment for SIH (Smart India Hackathon) that explored two-hand gesture recognition. The final project uses the 42-feature single-hand approach for reliability and speed.

---

### 4.9 `ASL Frontend/index.html` — Landing Page

**Purpose**: Premium cinematic landing page with scrollytelling hero animation.

**Design Elements**:

| Element | Technology | Purpose |
|---------|-----------|---------|
| **Scrollytelling Hero** | GSAP ScrollTrigger + 240-frame image sequence | Cinematic scroll-driven animation (like Apple product pages) |
| **Glassmorphism Navbar** | CSS `backdrop-filter: blur()` | Premium translucent navigation bar |
| **Custom Cursor** | JavaScript `mousemove` + CSS transforms | Interactive dot + trailing outline cursor |
| **Antigravity Particles** | HTML5 Canvas 2D | Floating ASL letters in the background |
| **3D Tilt Feature Cards** | JavaScript `perspective()` + GSAP | Cards respond to mouse position with 3D rotation |
| **Theme Accent Switcher** | CSS custom properties + localStorage | 4 color themes: Cyan, Emerald, Purple, Gold |
| **ASL Dictionary** | JavaScript-generated card grid | Interactive A–Z cards that speak the letter name aloud |
| **Smooth Scrolling** | Lenis library | Buttery-smooth scroll with configurable easing |
| **Team Section** | GSAP `stagger` animation | Team member nodes appear with elastic bounce |

**Libraries Used**:
- **GSAP 3.12.2** — Professional-grade animation library.
- **ScrollTrigger** — GSAP plugin for scroll-driven animations.
- **Lenis** — Smooth scroll library by Studio Freight.
- **Google Fonts (Inter)** — Clean, modern typography.

---

### 4.10 `ASL Frontend/detector.html` — ASL Detection Page

**Purpose**: The core real-time detection interface where users interact with the camera.

**UI Components**:

| Component | Location | Description |
|-----------|----------|-------------|
| **Status Pill** | Top-left of camera | Shows `🟢 Live Tracking` or `⚫ Sensor Standby` |
| **Gesture HUD** | Top-right of camera | Shows current detected sign (e.g., `Sign: M 94%`) with a hold progress bar |
| **Hint Banner** | Bottom of camera | Dynamic guidance (e.g., `✋ Hand Detected`, `✅ Added "A"`, `␣ Space Added`) |
| **Recognized Sentence Box** | Below camera | Shows the English sentence being constructed |
| **Translated Output Box** | Below sentence | Shows the translated text in the selected language |
| **Language Dropdown** | Above camera | 16-language selector grouped by Regional/International |
| **Action Buttons** | Below output | Start/Stop Sensor, Add Space, Translate & Speak |
| **Control Buttons** | Sentence box header | Copy, Backspace, Clear |

**Visual Design**: Glassmorphism with a cinematic background, Outfit font, and Bootstrap 5 layout.

**Anti-Caching**: `<meta http-equiv="Cache-Control" content="no-cache">` ensures the browser always loads the latest JavaScript.

---

### 4.11 `ASL Frontend/detector.js` — Core Detection Engine (687 lines)

**Purpose**: The heart of the web-based detection system — handles camera, MediaPipe, inference, UI, and translation.

#### Section 1: Three.js Background (Lines 87–170)
- Creates a 3D holographic mesh (rotating icosahedron) and particle field as an idle-state background.
- **Automatically pauses** when the camera sensor starts to dedicate 100% GPU to the webcam + MediaPipe.
- **Resumes** when the sensor stops.

#### Section 2: MediaPipe Hands Setup (Lines 172–191)
```javascript
hands.setOptions({
  maxNumHands: 1,         // Single-hand ASL alphabet recognition
  modelComplexity: 0,     // Fastest mode (3x faster than complexity 1)
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});
```

**Why `maxNumHands: 1`?**
- Setting this to 2 caused MediaPipe to occasionally hallucinate a "second hand" from face/chin contours, triggering false `DELETE` gestures.
- For single-hand ASL alphabet spelling, 1 is optimal.

**Why `modelComplexity: 0`?**
- Complexity 0 uses a lightweight model (3x faster inference).
- Since we only need 21 landmark positions (not precise 3D mesh), accuracy is virtually identical.

#### Section 3: Hand Landmark Rendering (Lines 194–235)
- Draws **stylized glowing cyan skeleton** connections between hand landmarks.
- Fingertips (indices 4, 8, 12, 16, 20) are highlighted with green dots for visual distinction.
- Uses `canvas.shadowBlur` for a neon glow effect.

#### Section 4: Core Gesture Recognition Logic (Lines 240–420)

**Feature Extraction** (Lines 342–368):
```javascript
const width = (maxX - minX) > 0 ? (maxX - minX) : 1e-6;
const height = (maxY - minY) > 0 ? (maxY - minY) : 1e-6;

for (const lm of landmarks) {
  data_aux.push((lm.x - minX) / width);    // Scale-normalized X
  data_aux.push((lm.y - minY) / height);   // Scale-normalized Y
}
```

**CRITICAL**: The feature extraction formula **must exactly match** the formula used in `asldataset.py`. If the training script divides by bounding box width/height, the inference script MUST do the same. A mismatch causes all predictions to collapse to a single class.

**Inference Throttling**:
```javascript
const PREDICT_THROTTLE_MS = 110;  // ~9 FPS
```
- HTTP prediction calls are rate-limited to ~9 per second.
- This prevents the CPU from being overwhelmed while keeping predictions responsive.

**Buffer Majority Voting** (Lines 407–418):
- A sliding window of the last 8 predictions is maintained.
- The `getMajorityVote()` function returns the most frequent letter only if it appears >= 3 times out of 8.
- This eliminates flicker between similar gestures.

**Hold-to-Commit Logic** (Lines 322–338):
```
LETTER_HOLD_DURATION_MS = 800   // Hold gesture 0.8 seconds to commit
SPACE_HOLD_DURATION_MS = 1200   // Drop hand 1.2 seconds for space
AUTO_TRANSLATE_IDLE_MS = 4000   // Auto-translate after 4 seconds idle
```

**Visual Progress Bar**: A cyan-to-green gradient bar fills from 0% to 100% as the user holds a gesture, providing immediate visual feedback.

#### Section 5: Multilingual Translation & Speech (Lines 468–513)

**Translation Flow**:
1. User's ASL sentence is sent to Flask `/translate` endpoint.
2. Flask uses `googletrans` to translate the text.
3. The translated text is displayed in the UI.
4. **Web Speech API** (`window.speechSynthesis`) speaks the text aloud in the correct locale.

**Locale Mapping for Accurate Speech**:
```javascript
const LOCALE_MAP = {
  "hi": "hi-IN",   // Hindi (India)
  "ta": "ta-IN",   // Tamil (India)
  "en": "en-US",   // English (US)
  "ja": "ja-JP",   // Japanese (Japan)
  // ... 16 total
};
```

**Why Web Speech API instead of gTTS on backend?**
- gTTS generates an MP3 on the server and requires file I/O.
- Web Speech API is instant, zero-latency, and works directly in the browser.
- Used as primary TTS; gTTS is a fallback for desktop mode.

#### Section 6: Camera Toggle & Event Listeners (Lines 518–687)
- Handles Start/Stop sensor button.
- Manages language dropdown selection.
- Implements Copy, Backspace, Clear, Add Space, Translate & Speak buttons.
- On sensor start: pauses Three.js, starts MediaPipe Camera.
- On sensor stop: stops camera, resumes Three.js background.

---

### 4.12 `ASL Frontend/main.js` — Landing Page Interactions (440 lines)

**Key Features**:

1. **240-Frame Scrollytelling** (Lines 15–107):
   - 240 JPG frames in `data set/` folder form a cinematic scroll-driven animation.
   - Frames preload in batches of 8 using `requestIdleCallback` to avoid blocking the main thread.
   - GSAP ScrollTrigger pins the hero section and scrubs through frames as the user scrolls.

2. **Text Chapter Transitions** (Lines 109–127):
   - Step 1 (0–18%): Title "American Sign Language Detector" fades in/out.
   - Step 2 (18–40%): "About Us" panel.
   - Step 3 (40–60%): "AI-Powered Translation" panel.
   - Step 4 (60–78%): Team member nodes animate with elastic bounce.
   - Step 5 (78–100%): Final CTA "Universal Communication is here."

3. **3D Tilt Cards** (Lines 160–190):
   - Feature cards rotate in 3D (`perspective(1000px)`) based on mouse position.
   - Subtle `scale3d(1.02)` on hover for a "floating" effect.

4. **Antigravity Particles** (Lines 276–328):
   - 35 floating characters (A, S, L, D, E, T, etc.) drift upward with a subtle parallax response to mouse movement.

5. **ASL Dictionary** (Lines 359–436):
   - 26 cards (A–Z) with emoji-based sign previews.
   - Searchable: typing in the search box filters cards in real-time.
   - Clicking a card speaks the letter name using Web Speech API.

---

### 4.13 `ASL Frontend/styles.css` — Global Design System (18 KB)

**Design Philosophy**: Dark-mode glassmorphism with vibrant accent colors.

**Key CSS Features**:

| Feature | Implementation |
|---------|---------------|
| **Custom Cursor** | `.cursor-dot` (4px circle) + `.cursor-outline` (40px trailing ring) |
| **Glassmorphism** | `backdrop-filter: blur(30px)` + semi-transparent backgrounds |
| **Gradient Accents** | CSS custom properties: `--accent-light`, `--accent-dark` |
| **Responsive Breakpoints** | `@media (max-width: 1150px)` — hides nav links, 2-col cards |
| | `@media (max-width: 820px)` — 1-col cards, stacked layout |
| **Smooth Animations** | `transition: all 0.3s ease` on interactive elements |
| **Mouse Glow** | 400px radial gradient that follows the cursor |

---

### 4.14 `Start_ASL_Project.bat` — One-Click Project Launcher

**Purpose**: Launches both servers and opens the browser with a single double-click.

**Execution Flow**:
1. Detects Python executable (checks `venv/Scripts/python.exe` first, verifies it works, falls back to system `python`).
2. Launches Flask backend: `python app.py` in a new terminal window (port 5000).
3. Launches Frontend HTTP server: `python -m http.server 8000` in a new terminal window.
4. Waits 2 seconds for servers to initialize.
5. Opens browser at `http://localhost:8000/detector.html?t=RANDOM` (cache-buster parameter forces fresh page load).

---

### 4.15 `Train_Model.bat` — One-Click Model Retraining

**Purpose**: Regenerates `data.pickle` and retrains `model.p` with a single double-click.

**Execution Flow**:
1. Step 1: Runs `asldataset.py` — processes all images — creates `data.pickle`.
2. Step 2: Runs `asltrainer.py` — trains Random Forest — saves `model.p`.
3. Shows success/failure messages and waits for user acknowledgment.

---

## 5. Technology Stack Summary

| Layer | Technology | Version | Why We Chose It |
|-------|-----------|---------|-----------------|
| **Hand Detection** | MediaPipe Hands | Latest CDN | Google's state-of-the-art hand landmark model, runs in-browser |
| **ML Classifier** | scikit-learn Random Forest | 1.x | CPU-only, fast training, built-in confidence scores |
| **Backend Server** | Flask | 2.x | Lightweight Python web framework, perfect for ML serving |
| **Translation** | googletrans | 4.x | Free Google Translate API wrapper |
| **Desktop TTS** | gTTS + pygame | Latest | Google Text-to-Speech for offline audio generation |
| **Browser TTS** | Web Speech API | Built-in | Zero-latency browser-native speech synthesis |
| **Frontend** | HTML5 + CSS3 + Vanilla JS | — | No build step, instant deployment, maximum control |
| **UI Framework** | Bootstrap 5.3.2 | CDN | Responsive grid, dropdowns, utility classes |
| **Animations** | GSAP 3.12.2 + ScrollTrigger | CDN | Industry-standard animation library used by Apple, Nike |
| **3D Graphics** | Three.js r128 | CDN | WebGL-powered 3D background during idle state |
| **Smooth Scroll** | Lenis | 1.0.19 CDN | Premium scroll feel by Studio Freight |
| **Typography** | Inter & Outfit | Google Fonts | Modern, clean, professional typefaces |
| **Serialization** | Python pickle | Built-in | Fast binary serialization for numpy arrays |
| **Data Processing** | NumPy, OpenCV | Latest | Numerical computation and image handling |

---

## 6. ML Pipeline Deep Dive

### 6.1 Feature Engineering

**Input**: Raw webcam frame (640x480 RGB image)

**Step 1 — Hand Detection** (MediaPipe):
- MediaPipe's palm detection model locates the hand region.
- A hand landmark model then identifies 21 keypoints:
  ```
  0: Wrist
  1-4: Thumb (CMC, MCP, IP, Tip)
  5-8: Index Finger (MCP, PIP, DIP, Tip)
  9-12: Middle Finger
  13-16: Ring Finger
  17-20: Pinky Finger
  ```

**Step 2 — Normalization**:
- Raw MediaPipe coordinates are in frame-relative space `[0.0, 1.0]`.
- We translate all points to hand-relative space (subtract minimum x, y).
- We divide by bounding box dimensions for scale invariance:
  ```
  feature = (lm.coordinate - min_coordinate) / bounding_box_size
  ```
- Final feature vector: 42 floats in range `[0.0, 1.0]`.

### 6.2 Why Not a Neural Network?

| Consideration | Random Forest | CNN / Deep Learning |
|--------------|---------------|---------------------|
| Training time | 10–20 seconds | Minutes to hours |
| GPU required | No | Yes |
| Accuracy on 42 features | ~95–98% | ~97–99% (marginal gain) |
| Interpretability | High (feature importance) | Low (black box) |
| Deployment complexity | `pickle.load()` | TensorFlow/PyTorch runtime |
| Hackathon feasibility | Perfect | Risky (environment issues) |

**Key insight**: Since MediaPipe already handles the hard computer vision work (hand detection + landmark localization), the downstream classifier only needs to distinguish 32 pose configurations from 42 numbers. This is a **tabular classification** problem where Random Forest excels.

### 6.3 Confidence-Based Filtering

```python
# Only consider predictions with > 60% confidence
if confidence > 60:
    buffer.append(predicted_character)
```

**Why 60%?**: Frames where the hand is transitioning between gestures or partially occluded produce low-confidence predictions. The 60% threshold filters these noisy frames before they enter the smoothing buffer.

---

## 7. Real-Time Performance Optimizations

| Optimization | What It Does | Impact |
|-------------|-------------|--------|
| `modelComplexity: 0` | Uses MediaPipe's lightweight hand model | 3x faster inference |
| Three.js auto-pause | Stops 3D rendering when camera is active | Frees 100% GPU for webcam |
| `PREDICT_THROTTLE_MS = 110` | Limits HTTP calls to ~9 FPS | Prevents CPU/network saturation |
| `backdrop-filter: blur(20px)` | Reduced from 60px | Eliminates GPU re-compositing lag |
| `maxNumHands: 1` | MediaPipe processes 1 hand only | Halves MediaPipe compute time |
| Frame batch preloading | Loads hero frames in batches of 8 | Prevents UI jank during page load |
| Cache-buster query strings | `detector.js?v=2.3` | Ensures browser loads latest code |

---

## 8. Potential Evaluator Q&A

### Q: Why did you use MediaPipe instead of training your own hand detection model?
**A**: MediaPipe Hands is a production-grade model developed by Google Research that provides real-time 21-point hand landmark detection at 30+ FPS. Building our own hand detector from scratch would take weeks and wouldn't match MediaPipe's accuracy. We focused our innovation on the **classification and sentence-building logic** on top of MediaPipe's reliable landmark extraction.

### Q: How does the system handle similar gestures like M and N?
**A**: M and N differ by how many fingers are folded over the thumb (M = 3 fingers, N = 2 fingers). Our Random Forest, trained with `max_depth=25`, creates deep enough decision trees to capture these fine-grained differences in finger joint positions. Scale normalization also helps because it removes distance-dependent noise that would otherwise conflate these gestures.

### Q: What happens if the user makes a mistake while signing?
**A**: Three correction mechanisms:
1. **Backspace button** in the web UI removes the last character.
2. **Clear button** wipes the entire sentence.
3. **Desktop mode**: Spreading two hands apart triggers a `DELETE` action that removes the last character.

### Q: Can this work offline?
**A**: Partially. The detection engine (MediaPipe + Random Forest) works entirely offline. Translation requires internet (Google Translate API). The Web Speech API for TTS may or may not work offline depending on the browser's cached voice data.

### Q: How do you handle the transition between signs?
**A**: We use a **temporal hold-and-commit** system: the user must hold a gesture stable for 2.2 seconds before the letter is committed. This prevents accidental letter additions during transitions. A progress bar provides real-time visual feedback of the hold duration.

### Q: Why not use a pre-trained ASL dataset from Kaggle?
**A**: We captured our **own dataset of ~9,450 images** to ensure the model recognizes our specific hand shapes, skin tones, and webcam lighting conditions. This provides significantly better real-world accuracy than using a generic dataset captured under different conditions.

### Q: How scalable is this approach?
**A**: To add new gestures:
1. Create a new numbered subfolder in the `data/` directory with ~300 images.
2. Add the label to `labels_dict` in all Python files.
3. Run `Train_Model.bat`.
The entire retraining takes under 2 minutes.

### Q: Why Flask instead of FastAPI or Django?
**A**: Flask is the lightest-weight Python web framework. For a real-time inference endpoint that does nothing but accept JSON and return predictions, Flask's simplicity is ideal. FastAPI would add async complexity that isn't needed (our predictions complete in <5ms). Django would be overkill for 5 simple endpoints.

### Q: What is the latency from gesture to displayed letter?
**A**: End-to-end latency breakdown:
- MediaPipe hand detection: ~15ms
- Feature extraction: ~1ms
- HTTP request to Flask: ~5ms
- Model prediction: ~3ms
- UI update: ~1ms
- **Total: ~25ms** (well under one frame at 30 FPS)

### Q: Why did you use scale normalization instead of raw coordinates?
**A**: Raw coordinates are **camera-distance-dependent**. If you train with your hand 2 feet from the camera but test at 4 feet, the raw coordinate magnitudes shrink by ~50%, and the model fails catastrophically. Scale normalization maps all hand poses to a consistent `[0.0, 1.0]` range regardless of distance.

### Q: What is the difference between `detectAlphabets.py`, `sentenceDetect.py`, and `transSentence.py`?
**A**: They are incremental versions of the desktop detection system:
- `detectAlphabets.py` — Detects and displays individual letters only (no sentence building).
- `sentenceDetect.py` — Adds sentence construction with hold-to-commit, space, and auto-save logic.
- `transSentence.py` — Adds two-hand delete gesture and auto-triggers translation after sentence completion.
Each builds on the previous one, with `transSentence.py` being the most feature-complete desktop script.

### Q: Why did you build both Web and Desktop modes?
**A**: The Desktop mode (OpenCV) was our initial prototype for rapid development and testing without needing a web server. The Web mode (HTML/JS + Flask) was built for the final product because:
1. No software installation required — works in any browser.
2. Better UI/UX with glassmorphism, animations, and responsive design.
3. Cross-platform — works on Windows, Mac, Linux, and even tablets.
4. The Flask backend can be deployed to a cloud server for remote access.

### Q: How does the system prevent "ghost letters" after adding a space?
**A**: When the user lowers their hand to trigger a space, the system:
1. Clears the prediction buffer entirely.
2. Resets `currentHoldingLetter` to empty.
3. Resets the hold timer to the current time.
When the hand re-enters the frame, it starts from a completely clean state — no cached predictions from before the space can leak through.

---

## 9. Social Impact & Future Scope

### Impact
- **Inclusivity**: Enables deaf and hearing-impaired individuals to communicate in their native language.
- **Education**: The ASL Dictionary section helps learners practice sign language independently.
- **Accessibility**: Runs on any device with a webcam — no special hardware required.

### Future Enhancements
1. **Indian Sign Language (ISL)** support (beyond ASL).
2. **Continuous sign recognition** (J and Z are currently limitations: they involve motion, but the present model was trained on still poses rather than temporal sequences).
3. **Mobile app** with on-device TensorFlow Lite model.
4. **Two-way translation** — spoken/typed text converted to animated sign language avatar.
5. **Multi-hand phrase detection** for compound signs.

---

> *"Technology should bring people closer. Our ASL Detector is a step toward a world where no one is left unheard."*
