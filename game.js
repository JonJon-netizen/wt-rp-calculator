/**
 * Aether Pulse & Aether Essence - Unified Game Logic
 */

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const arcadeStats = document.getElementById('game-stats');

// Buttons
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Values
const scoreVal = document.getElementById('score-val');
const timerVal = document.getElementById('timer-val');
const finalScoreVal = document.getElementById('final-score-val');
const livesVal = document.getElementById('lives-val');
const lifeProgressBar = document.getElementById('life-progress-bar');
const ultimateVal = document.getElementById('ultimate-val');
const ultimateProgressBar = document.getElementById('ultimate-progress-bar');
const ultimateStat = document.getElementById('ultimate-stat');

// Game State
let activeMode = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let timeRemaining = 60;
let lives = 3;
let nextLifeThreshold = 200; 
let lastRestoreScore = 0;
const RESTORE_THRESHOLD = 200;

let ultimatePoints = 0;
let ultimateActive = false;
let ultimateTimer = 0;
const ULTIMATE_REQ = 500;
const ULTIMATE_DURATION = 300; // ~5 seconds at 60fps

let particles = [];
let lumos = [];
let voids = [];
let mouse = { x: 0, y: 0 };
let animationId;
let gameTimer;
let idleInterval;
let shakeTime = 0;

// Configuration
const PARTICLE_COUNT = 80;
const LUMOS_SPAWN_RATE = 0.05;
const VOID_SPAWN_RATE = 0.01;
const PLAYER_RADIUS = 15;

function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    window.addEventListener('mousedown', handleInteraction);
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') activateUltimate();
    });

    window.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
            mouse.x = e.touches[0].clientX;
            mouse.y = e.touches[0].clientY;
        }
    }, { passive: false });

    // Menu Navigation
    startBtn.addEventListener('click', startArcadeGame);
    restartBtn.addEventListener('click', startArcadeGame);

    createBackground();
    animate();
}

function handleInteraction() {
    if (activeMode === 'PLAYING') {
        if (ultimatePoints >= ULTIMATE_REQ && !ultimateActive) {
            activateUltimate();
        }
    }
}

function activateUltimate() {
    if (ultimatePoints < ULTIMATE_REQ || ultimateActive || activeMode !== 'PLAYING') return;
    ultimateActive = true;
    ultimateTimer = ULTIMATE_DURATION;
    ultimatePoints = 0;
    updateUltimateUI();
    
    // Growth effect
    shakeTime = 30;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function showInterface(mode) {
    activeMode = mode;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    arcadeStats.classList.add('hidden');

    // Cursor management
    if (mode === 'PLAYING') {
        canvas.style.cursor = 'none';
    } else {
        canvas.style.cursor = 'default';
    }

    clearInterval(gameTimer);

    switch(mode) {
        case 'START': startScreen.classList.remove('hidden'); break;
        case 'PLAYING': arcadeStats.classList.remove('hidden'); break;
        case 'GAMEOVER': gameOverScreen.classList.remove('hidden'); break;
    }
}

function startArcadeGame() {
    showInterface('PLAYING');
    score = 0;
    timeRemaining = 60;
    lives = 3;
    nextLifeThreshold = RESTORE_THRESHOLD;
    lastRestoreScore = 0;
    ultimatePoints = 0;
    ultimateActive = false;
    ultimateTimer = 0;
    updateUltimateUI();
    lumos = [];
    voids = [];
    
    scoreVal.innerText = score;
    timerVal.innerText = timeRemaining;
    livesVal.innerText = lives;
    lifeProgressBar.style.width = '0%';
    
    gameTimer = setInterval(() => {
        timeRemaining--;
        timerVal.innerText = timeRemaining;
        if (timeRemaining <= 0) endGame();
    }, 1000);
}

function updateUltimateUI() {
    if (ultimateActive) {
        const lifePercent = (ultimateTimer / ULTIMATE_DURATION) * 100;
        ultimateProgressBar.style.width = lifePercent + '%';
        ultimateVal.innerText = 'AKTIV';
        ultimateStat.classList.remove('ready');
    } else {
        const chargePercent = (ultimatePoints / ULTIMATE_REQ) * 100;
        ultimateProgressBar.style.width = chargePercent + '%';
        ultimateVal.innerText = Math.floor(chargePercent) + '%';
        
        if (ultimatePoints >= ULTIMATE_REQ) {
            ultimateStat.classList.add('ready');
        } else {
            ultimateStat.classList.remove('ready');
        }
    }
}

function endGame() {
    showInterface('GAMEOVER');
    finalScoreVal.innerText = score;
}

// Particle Classes (Reused)
class BackgroundParticle {
    constructor() { this.reset(); }
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.speedY = (Math.random() - 0.5) * 0.5;
        this.alpha = Math.random() * 0.3;
    }
    update() {
        this.x += this.speedX; this.y += this.speedY;
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) this.reset();
    }
    draw() {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
    }
}

class Lumos {
    constructor(x, y) {
        this.x = x || Math.random() * canvas.width;
        this.y = y || Math.random() * canvas.height;
        this.radius = Math.random() * 5 + 3;
        this.pulse = 0;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.life = 1.0;
        this.isTemporary = !!x;
    }
    update() {
        this.pulse += 0.05;
        if (this.isTemporary) {
            this.x += this.vx; this.y += this.vy;
            this.life -= 0.02;
        }
    }
    draw() {
        const alpha = this.isTemporary ? this.life : 1.0;
        if (alpha <= 0) return;
        const pulseRadius = this.radius + Math.sin(this.pulse) * 0.4;
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, pulseRadius * 2);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${0.8 * alpha})`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath(); ctx.arc(this.x, this.y, pulseRadius * 2, 0, Math.PI * 2); ctx.fill();
    }
}

class Void {
    constructor() {
        this.side = Math.floor(Math.random() * 4);
        this.radius = Math.random() * 20 + 10;
        this.speed = Math.random() * 2 + 1;
        switch(this.side) {
            case 0: this.x = Math.random() * canvas.width; this.y = -this.radius; this.vx = 0; this.vy = this.speed; break;
            case 1: this.x = canvas.width + this.radius; this.y = Math.random() * canvas.height; this.vx = -this.speed; this.vy = 0; break;
            case 2: this.x = Math.random() * canvas.width; this.y = canvas.height + this.radius; this.vx = 0; this.vy = -this.speed; break;
            case 3: this.x = -this.radius; this.y = Math.random() * canvas.height; this.vx = this.speed; this.vy = 0; break;
        }
    }
    update() { this.x += this.vx; this.y += this.vy; }
    draw() {
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 1.5);
        gradient.addColorStop(0, '#ff3e3e'); gradient.addColorStop(1, 'rgba(5, 5, 8, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius * 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2); ctx.fill();
    }
}

function spawnLumosAt(x, y) {
    lumos.push(new Lumos(x, y));
    if (lumos.length > 200) lumos.shift();
}

function triggerDamageEffect() {
    shakeTime = 15; // Set shake duration
    // Optional: add a red flash to the canvas by drawing a semi-transparent rectangle once
    ctx.fillStyle = 'rgba(255, 62, 62, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function createBackground() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new BackgroundParticle());
}

function drawPlayer() {
    const pulse = Math.sin(Date.now() / 200) * 1.0;
    const currentRadius = ultimateActive ? PLAYER_RADIUS * 3 : PLAYER_RADIUS;
    
    // Ultimate Glow
    if (ultimateActive) {
        const hue = (Date.now() / 10) % 360;
        const outerGradient = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, currentRadius + 40);
        outerGradient.addColorStop(0, `hsla(${hue}, 100%, 70%, 0.6)`);
        outerGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = outerGradient;
        ctx.beginPath(); ctx.arc(mouse.x, mouse.y, currentRadius + 40, 0, Math.PI * 2); ctx.fill();
    }

    const gradient = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, currentRadius + pulse + 10);
    gradient.addColorStop(0, ultimateActive ? 'white' : 'rgba(79, 172, 254, 0.8)');
    gradient.addColorStop(0.5, ultimateActive ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 242, 254, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 242, 254, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.arc(mouse.x, mouse.y, currentRadius + pulse + 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.arc(mouse.x, mouse.y, currentRadius, 0, Math.PI * 2); ctx.fill();
}

function animate() {
    ctx.save();
    if (shakeTime > 0) {
        const dx = (Math.random() - 0.5) * (ultimateActive ? 20 : 10);
        const dy = (Math.random() - 0.5) * (ultimateActive ? 20 : 10);
        ctx.translate(dx, dy);
        shakeTime--;
    }

    if (ultimateActive) {
        ultimateTimer--;
        if (ultimateTimer <= 0) {
            ultimateActive = false;
            updateUltimateUI();
        }
        updateUltimateUI();
    }

    ctx.fillStyle = 'rgba(5, 5, 8, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => { p.update(); p.draw(); });

    if (activeMode === 'PLAYING') {
        if (Math.random() < LUMOS_SPAWN_RATE) lumos.push(new Lumos());
        if (Math.random() < VOID_SPAWN_RATE + (60 - timeRemaining) * 0.0005) voids.push(new Void());

        lumos.forEach((l, index) => {
            l.update(); l.draw();
            const dist = Math.hypot(l.x - mouse.x, l.y - mouse.y);
            if (dist < PLAYER_RADIUS + l.radius) { 
                lumos.splice(index, 1); 
                score += 10; 
                scoreVal.innerText = score; 

                // RESTORE LIVES LOGIC
                const progress = ((score - lastRestoreScore) / RESTORE_THRESHOLD) * 100;
                lifeProgressBar.style.width = Math.min(100, progress) + '%';

                // ULTIMATE CHARGE
                if (!ultimateActive) {
                    ultimatePoints = Math.min(ULTIMATE_REQ, ultimatePoints + 10);
                    updateUltimateUI();
                }

                if (score >= nextLifeThreshold) {
                    if (lives < 3) {
                        lives++;
                        livesVal.innerText = lives;
                        // Visual feedback for life restoration
                        livesVal.parentElement.classList.add('gain-life');
                        setTimeout(() => livesVal.parentElement.classList.remove('gain-life'), 1000);
                    }
                    lastRestoreScore = nextLifeThreshold;
                    nextLifeThreshold += RESTORE_THRESHOLD;
                    lifeProgressBar.style.width = '0%';
                }
            }
        });

        voids.forEach((v, index) => {
            v.update(); v.draw();
            const dist = Math.hypot(v.x - mouse.x, v.y - mouse.y);
            const currentRadius = ultimateActive ? PLAYER_RADIUS * 3 : PLAYER_RADIUS;
            if (dist < currentRadius + v.radius * 0.5) {
                if (ultimateActive) {
                    // Destroy void circles when ultimate
                    voids.splice(index, 1);
                    score += 5; // Bonus for destroying voids
                    scoreVal.innerText = score;
                    spawnLumosAt(v.x, v.y);
                } else {
                    // LIFE LOSS LOGIC
                    voids.splice(index, 1);
                    lives--;
                    livesVal.innerText = lives;
                    
                    if (lives <= 0) {
                        endGame();
                    } else {
                        triggerDamageEffect();
                    }
                }
            }
            if (v.x < -100 || v.x > canvas.width + 100 || v.y < -100 || v.y > canvas.height + 100) voids.splice(index, 1);
        });
        drawPlayer();
    } else {
        // Menu ambient animation
        if (Math.random() < 0.02) lumos.push(new Lumos());
        lumos.forEach((l, index) => {
            l.update(); l.draw();
            if (l.x < -50 || l.x > canvas.width + 50 || l.y < -50 || l.y > canvas.height + 50) lumos.splice(index, 1);
        });
    }

    animationId = requestAnimationFrame(animate);
    ctx.restore();
}

init();
