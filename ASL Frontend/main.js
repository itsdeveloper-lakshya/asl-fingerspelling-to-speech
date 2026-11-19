gsap.registerPlugin(ScrollTrigger);

// --- LENIS SMOOTH SCROLLING ---
const lenis = new Lenis({
  lerp: 0.11,          // Faster catch-up — feels snappy yet smooth
  smoothWheel: true,
  wheelMultiplier: 1.3, // More natural scroll distance per wheel tick
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
});
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => { lenis.raf(time * 1000); });
gsap.ticker.lagSmoothing(500, 33);
// ------------------------------

const canvas = document.getElementById("hero-lightpass");
const context = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const frameCount = 240;
const currentFrame = index => (
  `data%20set/ezgif-frame-${(index + 1).toString().padStart(3, '0')}.jpg`
);

const images = new Array(frameCount);
const imageSeq = { frame: 0 };

function render() {
  const img = images[imageSeq.frame];
  if (!img || !img.complete || img.naturalWidth === 0) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  const ratio = Math.max(canvas.width / img.width, canvas.height / img.height);
  const centerShift_x = (canvas.width - img.width * ratio) / 2;
  const centerShift_y = (canvas.height - img.height * ratio) / 2;  
  context.drawImage(img, 0, 0, img.width, img.height, centerShift_x, centerShift_y, img.width * ratio, img.width * ratio);
}

// Load initial frame immediately for zero initial render delay
const firstImg = new Image();
firstImg.src = currentFrame(0);
firstImg.onload = () => {
  images[0] = firstImg;
  render();
};
images[0] = firstImg;

// Preload remaining sequence frames progressively in small background batches
function preloadRemainingFrames(startIndex = 1, batchSize = 8) {
  if (startIndex >= frameCount) return;
  
  const endIndex = Math.min(startIndex + batchSize, frameCount);
  for (let i = startIndex; i < endIndex; i++) {
    if (!images[i]) {
      const img = new Image();
      img.src = currentFrame(i);
      img.onload = () => {
        images[i] = img;
        if (imageSeq.frame === i) render();
      };
      images[i] = img;
    }
  }

  if (endIndex < frameCount) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => preloadRemainingFrames(endIndex, batchSize), { timeout: 150 });
    } else {
      setTimeout(() => preloadRemainingFrames(endIndex, batchSize), 20);
    }
  }
}
preloadRemainingFrames(1);

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  render();
});

// Setting initial transform states for the text elements
gsap.set(".step-1", { opacity: 0, y: 40 });
gsap.set(".step-2", { opacity: 0, y: 40 });
gsap.set(".step-3", { opacity: 0, y: 40 });
gsap.set(".team-node", { opacity: 0, scale: 0 });
gsap.set(".step-5", { opacity: 0, y: 40, scale: 0.95 });

// HERO SEQUENCE: Pin the entire hero block and scrub the frames
const masterTl = gsap.timeline({
  scrollTrigger: {
    trigger: ".hero-sequence",
    pin: true,
    start: "top top",
    end: "+=2000",
    scrub: 0.6,
  }
});

// The master timeline uses a rigid 0-100 'time' mapped duration.
// The image sequence spans exactly the whole 100 duration.
masterTl.to(imageSeq, {
  frame: frameCount - 1,
  snap: "frame",
  ease: "none",
  duration: 100,
  onUpdate: render
}, 0);

// step-1 (0-18%) — intro title
masterTl.to(".step-1", { opacity: 1, y: 0, duration: 5, ease: "power2.out" }, 0)
        .to(".step-1", { opacity: 0, y: -25, duration: 4, ease: "power2.in" }, 13);

// step-2 (18-40%) — About Us (Centered)
masterTl.to(".step-2", { opacity: 1, y: 0, duration: 5, ease: "power2.out" }, 18)
        .to(".step-2", { opacity: 0, y: -25, duration: 4, ease: "power2.in" }, 35);

// step-3 (40-60%) — AI-Powered Translation (Centered)
masterTl.to(".step-3", { opacity: 1, y: 0, duration: 5, ease: "power2.out" }, 40)
        .to(".step-3", { opacity: 0, y: -25, duration: 4, ease: "power2.in" }, 57);

// step-4 (60-78%) — Team nodes (no gap)
masterTl.to(".team-node", { opacity: 1, scale: 1, duration: 4, stagger: 0.3, ease: "back.out(1.7)" }, 60)
        .to(".team-node", { opacity: 0, scale: 1.2, duration: 3, stagger: 0.15, ease: "power2.in" }, 74);

// step-5 (78-100%) — Universal Communication (no gap)
masterTl.to(".step-5", { opacity: 1, y: 0, scale: 1, duration: 5, ease: "power2.out" }, 78);


// Navbar fade in
gsap.to(".navbar", {
  scrollTrigger: {
    trigger: "body",
    start: "5% top",
    end: "10% top",
    scrub: true,
  },
  opacity: 1, y: 0,
});

/* === PREMIUM INTERACTIONS === */

// Mouse Glow Effect with throttled RAF
const glow = document.querySelector('.mouse-glow');
let mouseGlowTicking = false;
let latestMouseX = 0;
let latestMouseY = 0;

window.addEventListener('mousemove', (e) => {
  latestMouseX = e.clientX;
  latestMouseY = e.clientY;
  if (!mouseGlowTicking && glow) {
    mouseGlowTicking = true;
    requestAnimationFrame(() => {
      glow.style.transform = `translate(${latestMouseX - 200}px, ${latestMouseY - 200}px)`;
      mouseGlowTicking = false;
    });
  }
});

// Interactive Feature Cards (3D Tilt & Glow Lighting)
const cards = document.querySelectorAll('.interactive-card');
cards.forEach(card => {
  let cardTicking = false;
  card.addEventListener('mousemove', e => {
    if (cardTicking) return;
    cardTicking = true;
    const clientX = e.clientX;
    const clientY = e.clientY;
    requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -5;
      const rotateY = ((x - centerX) / centerX) * 5;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
      cardTicking = false;
    });
  });
  
  card.addEventListener('mouseleave', () => {
    card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
  });
});

// Smooth fade-in animations for section headings (no blank gaps)
document.querySelectorAll('.glowing-title').forEach(el => {
  gsap.fromTo(el, 
    { opacity: 0.3, y: 20 }, 
    {
      scrollTrigger: { trigger: el, start: "top 95%", once: true },
      opacity: 1, 
      y: 0, 
      duration: 0.8, 
      ease: "power3.out"
    }
  );
});

gsap.utils.toArray('.feature-card, .contact-container').forEach(card => {
  gsap.fromTo(card, 
    { y: 40, opacity: 0.2 }, 
    {
      scrollTrigger: { 
        trigger: card, 
        start: "top 92%",
        once: true
      },
      y: 0,
      opacity: 1,
      duration: 0.8,
      ease: "power3.out"
    }
  );
});

// --- CUSTOM INTERACTIVE CURSOR & MAGNETIC ELEMENTS --- //

const cursorDot = document.querySelector('.cursor-dot');
const cursorOutline = document.querySelector('.cursor-outline');
let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let outlineX = mouseX;
let outlineY = mouseY;

window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  if (cursorDot) {
    cursorDot.style.transform = `translate(${mouseX - 4}px, ${mouseY - 4}px)`;
  }
}, { passive: true });

// Smooth trail loop for the outline
function animateCursor() {
  const dx = mouseX - outlineX;
  const dy = mouseY - outlineY;
  outlineX += dx * 0.2;
  outlineY += dy * 0.2;
  
  if (cursorOutline) {
    cursorOutline.style.transform = `translate(${outlineX - 20}px, ${outlineY - 20}px)`;
  }
  requestAnimationFrame(animateCursor);
}
animateCursor();

// Add Magnetic interaction to nav links and buttons
const magneticElements = document.querySelectorAll('a, button, .glass-select, input, textarea');

magneticElements.forEach(el => {
  el.addEventListener('mouseenter', () => {
    document.body.classList.add('cursor-hover');
  });
  el.addEventListener('mouseleave', () => {
    document.body.classList.remove('cursor-hover');
    gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
  });
  
  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    
    gsap.to(el, { x: x * 0.3, y: y * 0.3, duration: 0.3, ease: 'power2.out' });
  });
});

// --- ANTIGRAVITY HOVER PARTICLES (BACKGROUND UI) --- //
const antiCanvas = document.getElementById("antigravity-bg");
const antiCtx = antiCanvas ? antiCanvas.getContext("2d") : null;

if (antiCanvas && antiCtx) {
  antiCanvas.width = window.innerWidth;
  antiCanvas.height = window.innerHeight;

  const chars = ['A', 'S', 'L', 'D', 'E', 'T', 'E', 'C', 'T', 'O', 'R', '0', '1', '+'];
  const particles = [];

  for (let i = 0; i < 35; i++) {
    particles.push({
      x: Math.random() * antiCanvas.width,
      y: Math.random() * antiCanvas.height,
      size: Math.random() * 18 + 10,
      speedY: (Math.random() - 1) * 0.4 - 0.1,
      speedX: (Math.random() - 0.5) * 0.3,
      char: chars[Math.floor(Math.random() * chars.length)],
      opacity: Math.random() * 0.4 + 0.1
    });
  }

  function drawAntigravity() {
    antiCtx.clearRect(0, 0, antiCanvas.width, antiCanvas.height);
    antiCtx.fillStyle = "rgba(0, 212, 255, 0.9)";
    
    particles.forEach(p => {
      const dx = (mouseX - antiCanvas.width / 2) * 0.005;
      const dy = (mouseY - antiCanvas.height / 2) * 0.005;
      
      p.y += p.speedY - dy;
      p.x += p.speedX - dx;
      
      if (p.y < -50) p.y = antiCanvas.height + 50;
      if (p.y > antiCanvas.height + 50) p.y = -50;
      if (p.x < -50) p.x = antiCanvas.width + 50;
      if (p.x > antiCanvas.width + 50) p.x = -50;
      
      antiCtx.globalAlpha = p.opacity;
      antiCtx.font = `${p.size}px Inter, sans-serif`;
      antiCtx.shadowBlur = 0; // Removed high GPU shadowBlur bottleneck
      antiCtx.fillText(p.char, p.x, p.y);
    });
    
    requestAnimationFrame(drawAntigravity);
  }
  drawAntigravity();

  window.addEventListener("resize", () => {
    antiCanvas.width = window.innerWidth;
    antiCanvas.height = window.innerHeight;
  });
}

// --- THEME ACCENT SWITCHER --- //
const themes = {
  cyan: { light: '#00E1FF', dark: '#0066FF' },
  emerald: { light: '#00FF88', dark: '#009955' },
  purple: { light: '#A855F7', dark: '#6B21A8' },
  gold: { light: '#FFB800', dark: '#D97706' }
};

function applyTheme(name) {
  const theme = themes[name] || themes.cyan;
  document.documentElement.style.setProperty('--accent-light', theme.light);
  document.documentElement.style.setProperty('--accent-dark', theme.dark);
  
  document.querySelectorAll('.theme-dot').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.theme === name);
  });
  localStorage.setItem('asl_theme', name);
}

document.querySelectorAll('.theme-dot').forEach(dot => {
  dot.addEventListener('click', () => {
    applyTheme(dot.dataset.theme);
  });
});

// Restore saved theme on load
const savedTheme = localStorage.getItem('asl_theme') || 'cyan';
applyTheme(savedTheme);

// --- INTERACTIVE ASL ALPHABET DICTIONARY --- //
const aslAlphabet = [
  { letter: 'A', icon: '✊', word: 'Fist / Thumb Side' },
  { letter: 'B', icon: '✋', word: 'Flat Palm Up' },
  { letter: 'C', icon: '🤏', word: 'Curved C Hand' },
  { letter: 'D', icon: '☝️', word: 'Index Up' },
  { letter: 'E', icon: '✊', word: 'Curled Fingers' },
  { letter: 'F', icon: '👌', word: 'OK Circle Sign' },
  { letter: 'G', icon: '👈', word: 'Index Thumb Pinch' },
  { letter: 'H', icon: '✌️', word: 'Index Middle Flat' },
  { letter: 'I', icon: '🤙', word: 'Pinky Finger Up' },
  { letter: 'J', icon: '🤙', word: 'Pinky Curve' },
  { letter: 'K', icon: '✌️', word: 'V Sign with Thumb' },
  { letter: 'L', icon: '👆', word: 'L Shape Hand' },
  { letter: 'M', icon: '👊', word: 'Three Fingers Over' },
  { letter: 'N', icon: '👊', word: 'Two Fingers Over' },
  { letter: 'O', icon: '👌', word: 'O Circle Hand' },
  { letter: 'P', icon: '👇', word: 'K Downward' },
  { letter: 'Q', icon: '👇', word: 'G Downward' },
  { letter: 'R', icon: '🤞', word: 'Crossed Fingers' },
  { letter: 'S', icon: '✊', word: 'Fist Thumb Front' },
  { letter: 'T', icon: '👊', word: 'Thumb Under Index' },
  { letter: 'U', icon: '✌️', word: 'Two Fingers Up' },
  { letter: 'V', icon: '✌️', word: 'Victory V Sign' },
  { letter: 'W', icon: '🖐️', word: 'Three Fingers Up' },
  { letter: 'X', icon: '☝️', word: 'Hooked Index' },
  { letter: 'Y', icon: '🤙', word: 'Shaka Sign' },
  { letter: 'Z', icon: '👆', word: 'Index Draw Z' }
];

const dictGrid = document.getElementById('dict-grid');
const dictSearch = document.getElementById('dict-search');

function renderDictionary(filterText = '') {
  if (!dictGrid) return;
  dictGrid.innerHTML = '';
  
  const query = filterText.toLowerCase().trim();
  const filtered = aslAlphabet.filter(item => 
    item.letter.toLowerCase().includes(query) || 
    item.word.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    dictGrid.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color: var(--text-muted); padding: 40px;">No matching signs found.</p>`;
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'dict-card interactive-card';
    card.innerHTML = `
      <div class="dict-letter">${item.letter}</div>
      <span class="dict-sign-preview">${item.icon}</span>
      <div class="dict-word">${item.word}</div>
    `;

    card.addEventListener('click', () => {
      // Speak letter aloud using Web Speech API
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(`Letter ${item.letter}. ${item.word}`);
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    });

    dictGrid.appendChild(card);
  });
}

if (dictSearch) {
  dictSearch.addEventListener('input', (e) => {
    renderDictionary(e.target.value);
  });
}

renderDictionary();



