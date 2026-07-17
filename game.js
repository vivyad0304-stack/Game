// Retro Picnic Date Quest - Game Logic

// --- Audio Synthesizer via Web Audio API ---
const Sound = {
  ctx: null,
  enabled: true,

  init() {
    // AudioContext will be initialized on first user interaction to comply with browser policies
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },

  play(type) {
    if (!this.enabled) return;
    this.init();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;

    switch (type) {
      case 'hover':
        this.beep(150, 'triangle', 0.05, 0.05);
        break;

      case 'click':
        this.beep(300, 'square', 0.08, 0.05);
        break;

      case 'collect':
        // Two-note arpeggio (classic coin sound)
        this.beep(523.25, 'sine', 0.08, 0.1); // C5
        setTimeout(() => {
          if (this.enabled) this.beep(783.99, 'sine', 0.15, 0.1); // G5
        }, 80);
        break;

      case 'chime':
        // Sweet magical slide up
        this.sweep(400, 1000, 0.25, 'triangle', 0.1);
        break;

      case 'dodge':
        // Low pitch slide down (buzz/fail)
        this.sweep(220, 110, 0.2, 'sawtooth', 0.15);
        break;

      case 'victory':
        // Retro major scale arpeggio fanfare
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C4, E4, G4, C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          setTimeout(() => {
            if (this.enabled) {
              this.beep(freq, idx === notes.length - 1 ? 'square' : 'sine', idx === notes.length - 1 ? 0.6 : 0.1, 0.1);
            }
          }, idx * 100);
        });
        break;
    }
  },

  beep(frequency, type, duration, volume) {
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
      
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      // Smooth fade-out to prevent clicks
      gain.gain.exponentialRampToValueAtTime(0.00001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio synthesis failed:", e);
    }
  },

  sweep(startFreq, endFreq, duration, type, volume) {
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);

      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Sweep synthesis failed:", e);
    }
  },

  bgMusicInterval: null,
  musicPlaying: false,

  startMusic() {
    if (this.bgMusicInterval || !this.enabled) return;
    this.init();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    this.musicPlaying = true;
    
    // Cute, simple pentatonic loop (G Major / E Minor pentatonic)
    // Notes: G4, A4, B4, D5, E5
    const melody = [
      392.00, 440.00, 493.88, 587.33, 
      493.88, 440.00, 392.00, 440.00,
      493.88, 493.88, 493.88, 587.33,
      587.33, 493.88, 440.00, 392.00
    ];
    let noteIdx = 0;
    
    const playNextNote = () => {
      if (!this.musicPlaying || !this.enabled) return;
      
      const freq = melody[noteIdx];
      // Triangle wave at slightly louder but gentle volume (0.035)
      this.playMelodyNote(freq, 0.035, 0.25);
      
      noteIdx = (noteIdx + 1) % melody.length;
    };
    
    playNextNote();
    this.bgMusicInterval = setInterval(playNextNote, 400);
  },

  stopMusic() {
    this.musicPlaying = false;
    if (this.bgMusicInterval) {
      clearInterval(this.bgMusicInterval);
      this.bgMusicInterval = null;
    }
  },

  playMelodyNote(frequency, volume, duration) {
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
      
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);
      // Gentle decay
      gain.gain.exponentialRampToValueAtTime(0.00001, this.ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Melody note failed:", e);
    }
  }
};

// --- Game State & Configuration ---
const Game = {
  gridSize: 13,
  cellSizePercent: 7.6923, // 100 / 13
  
  // Game state variables
  player: { x: 6, y: 6, dir: 'right' },
  items: {
    strawberry: { x: 2, y: 2, collected: false, elementId: 'itemStrawberry', checkId: 'checkStrawberry' },
    croissant: { x: 10, y: 2, collected: false, elementId: 'itemCroissant', checkId: 'checkCroissant' },
    coffee: { x: 2, y: 10, collected: false, elementId: 'itemCoffee', checkId: 'checkCoffee' }
  },
  blanket: { x: 10, y: 10 },
  activeScreen: 'screenIntro',
  controlsLocked: false,
  
  // Proposal screens text logic
  funnyTexts: [
    "Nice try!! 😉",
    "The No button has LEFT the chat 🚪",
    "No escape 💀",
    "Bro really said no 😭",
    "You can't say no haha!",
    "Error 404: 'No' not found! ❌",
    "Access Denied! Try 'Yes' instead 🔒"
  ],
  funnyTextIdx: 0,
  
  // Dialogue screens script
  dialogues: [
    "Everything's ready... 🧺",
    "I've been wanting to ask you something... 👉👈",
    "We could have coffee and croissants... 🥐☕",
    "And you could bring some strawberries for dessert? 🍓",
    "Will you go on a date with me? 🥺"
  ],
  dialogueIdx: 0,

  // Initialize Game Elements
  init() {
    this.createGrid();
    this.setupEventListeners();
    this.resetGame();
    this.initSoundControl();

    // Start background music on first user interaction (browser policy compliant)
    const startMusicOnInteraction = () => {
      if (this.activeScreen === 'screenGameplay' || this.activeScreen === 'screenIntro') {
        Sound.startMusic();
      }
      document.removeEventListener('click', startMusicOnInteraction);
      document.removeEventListener('keydown', startMusicOnInteraction);
      document.removeEventListener('touchstart', startMusicOnInteraction);
    };
    document.addEventListener('click', startMusicOnInteraction);
    document.addEventListener('keydown', startMusicOnInteraction);
    document.addEventListener('touchstart', startMusicOnInteraction);
  },

  initSoundControl() {
    const soundToggle = document.getElementById('soundToggle');
    const soundOnIcon = document.getElementById('soundOnIcon');
    const soundOffIcon = document.getElementById('soundOffIcon');

    soundToggle.addEventListener('click', () => {
      Sound.enabled = !Sound.enabled;
      if (Sound.enabled) {
        soundOnIcon.style.display = 'block';
        soundOffIcon.style.display = 'none';
        Sound.play('click');
        if (this.activeScreen === 'screenGameplay' || this.activeScreen === 'screenIntro') {
          Sound.startMusic();
        }
      } else {
        soundOnIcon.style.display = 'none';
        soundOffIcon.style.display = 'block';
        Sound.stopMusic();
      }
    });

    // Make all buttons play hover and click sounds, and blur them to prevent Enter key focus double-triggering
    document.querySelectorAll('.pixel-btn, .dialogue-next-btn, .sound-toggle, .dpad-btn').forEach(btn => {
      btn.addEventListener('mouseenter', () => Sound.play('hover'));
      btn.addEventListener('click', (e) => {
        Sound.play('click');
        e.currentTarget.blur();
      });
    });
  },

  // Generate 13x13 grid cells
  createGrid() {
    const grid = document.getElementById('gameGrid');
    
    // Clean up old dynamic grid cells if any
    grid.querySelectorAll('.grid-cell').forEach(cell => cell.remove());

    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.style.width = '100%';
        cell.style.height = '100%';
        
        // Form path cross-hair
        if (r === 6 || c === 6) {
          cell.style.background = '#ebdcb9'; // Path dirt color
          cell.style.border = '1px solid #dfcca2';
        } else {
          // Grass tile with details
          cell.style.background = '#96cd63';
          cell.style.border = '1px solid #8ec659';
          
          // Random grass tuft for visual texture
          if ((r + c) % 5 === 0) {
            cell.innerHTML = `<svg viewBox="0 0 10 10" style="width:6px; height:6px; margin:4px; opacity:0.35;">
              <rect x="4" y="2" width="2" height="6" fill="#589025" />
              <rect x="2" y="4" width="6" height="2" fill="#589025" />
            </svg>`;
          }
        }
        
        grid.appendChild(cell);
      }
    }
  },

  // Setup Event Listeners
  setupEventListeners() {
    // Key Controls
    window.addEventListener('keydown', (e) => {
      // If dialogue overlay is active, let Enter/Space advance the dialogue instead of triggering default/restart behavior
      const dialogueOverlay = document.getElementById('dialogueOverlay');
      if (this.activeScreen === 'screenGameplay' && this.controlsLocked && dialogueOverlay.style.display !== 'none') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.advanceDialogue();
          return;
        }
      }

      if (this.activeScreen !== 'screenGameplay' || this.controlsLocked) return;
      
      let moved = false;
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          moved = this.movePlayer(0, -1);
          break;
        case 's':
        case 'arrowdown':
          moved = this.movePlayer(0, 1);
          break;
        case 'a':
        case 'arrowleft':
          moved = this.movePlayer(-1, 0);
          this.setPlayerDirection('left');
          break;
        case 'd':
        case 'arrowright':
          moved = this.movePlayer(1, 0);
          this.setPlayerDirection('right');
          break;
      }
      if (moved) {
        e.preventDefault();
      }
    });

    // Mobile D-Pad Events
    const setupDpadBtn = (elementId, dx, dy, dir) => {
      const btn = document.getElementById(elementId);
      btn.addEventListener('click', () => {
        if (this.activeScreen !== 'screenGameplay' || this.controlsLocked) return;
        this.movePlayer(dx, dy);
        if (dir) this.setPlayerDirection(dir);
      });
    };

    setupDpadBtn('dpadUp', 0, -1);
    setupDpadBtn('dpadDown', 0, 1);
    setupDpadBtn('dpadLeft', -1, 0, 'left');
    setupDpadBtn('dpadRight', 1, 0, 'right');

    // UI Buttons
    document.getElementById('btnStartGame').addEventListener('click', () => {
      this.switchScreen('screenGameplay');
    });

    document.getElementById('btnBack').addEventListener('click', () => {
      alert("No turning back on a sweet quest! 😉");
    });

    // Dialogue Overlay Controls
    document.getElementById('btnNextDialogue').addEventListener('click', () => {
      this.advanceDialogue();
    });

    // Proposal Screen Dodging No Button
    const btnNo = document.getElementById('btnNo');
    const btnNoWrapper = document.getElementById('btnNoWrapper');
    const screenProposal = document.getElementById('screenProposal');

    const dodgeButton = () => {
      Sound.play('dodge');
      
      const screenRect = screenProposal.getBoundingClientRect();
      const btnRect = btnNoWrapper.getBoundingClientRect();
      const btnYesRect = document.getElementById('btnYes').getBoundingClientRect();
      
      const maxX = screenRect.width - btnRect.width;
      const maxY = screenRect.height - btnRect.height;
      
      // Convert YES button bounding rect to screen-relative coordinates
      const yesLeft = btnYesRect.left - screenRect.left;
      const yesTop = btnYesRect.top - screenRect.top;
      const yesRight = yesLeft + btnYesRect.width;
      const yesBottom = yesTop + btnYesRect.height;
      
      let randomX = 0;
      let randomY = 0;
      let overlap = true;
      let attempts = 0;
      const margin = 24; // Safe margin around the Yes button
      
      while (overlap && attempts < 20) {
        randomX = Math.random() * maxX;
        randomY = Math.random() * maxY;
        attempts++;
        
        const noLeft = randomX;
        const noTop = randomY;
        const noRight = noLeft + btnRect.width;
        const noBottom = noTop + btnRect.height;
        
        const horizontalOverlap = noLeft < yesRight + margin && noRight > yesLeft - margin;
        const verticalOverlap = noTop < yesBottom + margin && noBottom > yesTop - margin;
        
        if (!(horizontalOverlap && verticalOverlap)) {
          overlap = false;
        }
      }
      
      btnNoWrapper.style.left = `${randomX}px`;
      btnNoWrapper.style.top = `${randomY}px`;
      btnNoWrapper.style.bottom = 'auto'; // Clear CSS bottom

      // Cycle warning message
      const warning = document.getElementById('funnyWarning');
      warning.textContent = this.funnyTexts[this.funnyTextIdx];
      warning.classList.add('show');
      
      this.funnyTextIdx = (this.funnyTextIdx + 1) % this.funnyTexts.length;
    };

    // Trigger dodge on hover (desktop)
    btnNoWrapper.addEventListener('mouseenter', dodgeButton);
    btnNoWrapper.addEventListener('mousemove', dodgeButton);
    
    // Trigger dodge on touch / click (mobile & fallback)
    btnNo.addEventListener('touchstart', (e) => {
      e.preventDefault();
      dodgeButton();
    });
    btnNo.addEventListener('click', (e) => {
      e.preventDefault();
      dodgeButton();
    });

    // Yes button action
    document.getElementById('btnYes').addEventListener('click', () => {
      Sound.play('chime');
      this.switchScreen('screenPicker');
    });

    // Date/Time lock in
    document.getElementById('btnLockIn').addEventListener('click', () => {
      const inputDate = document.getElementById('inputDate').value;
      const inputTime = document.getElementById('inputTime').value;

      if (!inputDate || !inputTime) {
        alert("Please pick a beautiful date and time for us! 🧺❤️");
        return;
      }
      this.lockInDate(inputDate, inputTime);
    });
  },

  // Reset Game variables
  resetGame() {
    this.player = { x: 6, y: 6, dir: 'right' };
    this.controlsLocked = false;
    this.dialogueIdx = 0;
    this.funnyTextIdx = 0;
    
    // Reset items
    for (const key in this.items) {
      this.items[key].collected = false;
      const itemEl = document.getElementById(this.items[key].elementId);
      itemEl.style.display = 'block';
      
      const checkEl = document.getElementById(this.items[key].checkId);
      checkEl.classList.remove('done');
    }

    // Set item positioning
    this.positionElement('itemStrawberry', this.items.strawberry.x, this.items.strawberry.y);
    this.positionElement('itemCroissant', this.items.croissant.x, this.items.croissant.y);
    this.positionElement('itemCoffee', this.items.coffee.x, this.items.coffee.y);
    this.positionElement('picnicBlanket', this.blanket.x, this.blanket.y);

    // Hide dialogue overlay
    document.getElementById('dialogueOverlay').style.display = 'none';

    // Set picker min date to today
    const dateInput = document.getElementById('inputDate');
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
    dateInput.value = today;

    // Set default time to evening (07:00 PM)
    document.getElementById('inputTime').value = '19:00';

    // Position player
    this.updatePlayerPosition();
  },

  // Switch screen view
  switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(scr => scr.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    this.activeScreen = screenId;

    if (screenId === 'screenGameplay') {
      this.resetGame();
      Sound.play('click');
      Sound.startMusic();
    } else if (screenId === 'screenSuccess') {
      Sound.stopMusic();
    }
  },

  // Position elements relative to cells
  positionElement(elementId, x, y) {
    const el = document.getElementById(elementId);
    el.style.width = this.cellSizePercent + '%';
    el.style.height = this.cellSizePercent + '%';
    el.style.left = (x * this.cellSizePercent) + '%';
    el.style.top = (y * this.cellSizePercent) + '%';
  },

  // Update player pos styling
  updatePlayerPosition() {
    this.positionElement('player', this.player.x, this.player.y);
  },

  // Set Player face scale direction
  setPlayerDirection(dir) {
    const playerSvg = document.querySelector('#player svg');
    if (dir === 'left') {
      playerSvg.style.transform = 'scaleX(-1)';
    } else {
      playerSvg.style.transform = 'scaleX(1)';
    }
    this.player.dir = dir;
  },

  // Execute Player Step
  movePlayer(dx, dy) {
    const newX = this.player.x + dx;
    const newY = this.player.y + dy;

    // Boundary check
    if (newX < 0 || newX >= this.gridSize || newY < 0 || newY >= this.gridSize) {
      return false;
    }

    this.player.x = newX;
    this.player.y = newY;
    this.updatePlayerPosition();

    // Check item pick ups
    this.checkItemCollisions();

    // Check blanket destination collision
    this.checkBlanketCollision();

    return true;
  },

  // Collision with items
  checkItemCollisions() {
    for (const key in this.items) {
      const item = this.items[key];
      if (!item.collected && this.player.x === item.x && this.player.y === item.y) {
        // Collect!
        item.collected = true;
        Sound.play('collect');
        
        // Hide map element
        document.getElementById(item.elementId).style.display = 'none';
        
        // Cross off sidebar checklist
        document.getElementById(item.checkId).classList.add('done');
        
        this.checkAllItemsCollected();
      }
    }
  },

  // Trigger blanket pulse if everything collected
  checkAllItemsCollected() {
    const allDone = Object.values(this.items).every(item => item.collected);
    if (allDone) {
      const blanketEl = document.getElementById('picnicBlanket');
      blanketEl.style.transform = 'scale(1.2)';
      blanketEl.style.boxShadow = '0 0 15px #df5846';
      
      // Play brief reminder chime
      setTimeout(() => Sound.play('chime'), 400);
    }
  },

  // Blanket collision logic
  checkBlanketCollision() {
    if (this.player.x === this.blanket.x && this.player.y === this.blanket.y) {
      const allDone = Object.values(this.items).every(item => item.collected);
      
      if (allDone) {
        // Lock controls, trigger dialog
        this.controlsLocked = true;
        Sound.play('chime');
        
        setTimeout(() => {
          this.dialogueIdx = 0;
          document.getElementById('dialogueText').textContent = this.dialogues[0];
          document.getElementById('dialogueOverlay').style.display = 'flex';
        }, 300);
      } else {
        // Blanket reminder note
        alert("Make sure to collect the Strawberry, Croissant, and Coffee before arriving at the picnic blanket! 🍓🥐☕");
        // Push player back slightly to allow movement
        this.movePlayer(-1, 0);
      }
    }
  },

  // Advance dialogue step
  advanceDialogue() {
    this.dialogueIdx++;
    if (this.dialogueIdx < this.dialogues.length) {
      document.getElementById('dialogueText').textContent = this.dialogues[this.dialogueIdx];
      Sound.play('click');
    } else {
      // Transition to proposal screen
      this.switchScreen('screenProposal');
      // Reset No button style positioning to standard centered
      const btnNoWrapper = document.getElementById('btnNoWrapper');
      btnNoWrapper.style.left = '';
      btnNoWrapper.style.top = '';
      btnNoWrapper.style.bottom = '';
      document.getElementById('funnyWarning').classList.remove('show');
    }
  },

  // Parse Date picker & format text
  lockInDate(dateString, timeString) {
    // Format: Wednesday, July 22 at 19:03
    const dateObj = new Date(dateString + 'T' + timeString);
    
    // Formatting date parameters
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    const dateFormatted = dateObj.toLocaleDateString('en-US', options);
    
    // Format hours:minutes
    let hours = dateObj.getHours();
    let minutes = dateObj.getMinutes();
    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
    const formattedHours = hours < 10 ? '0' + hours : hours;

    const formattedString = `${dateFormatted} at ${formattedHours}:${formattedMinutes}`;
    
    document.getElementById('lockedDateTimeText').textContent = formattedString;
    
    // Victory transition
    this.switchScreen('screenSuccess');
    Sound.play('victory');
    this.spawnSuccessHearts();
  },

  // Floating heart creator logic
  spawnSuccessHearts() {
    const container = document.getElementById('successHearts');
    container.innerHTML = ''; // Clear old hearts
    
    // Periodically spawn hearts
    const heartSpawner = setInterval(() => {
      if (this.activeScreen !== 'screenSuccess') {
        clearInterval(heartSpawner);
        return;
      }
      
      const heart = document.createElement('div');
      heart.className = 'floating-heart';
      heart.textContent = Math.random() > 0.5 ? '❤️' : '💖';
      
      // Randomize position details
      const randomX = Math.random() * 100; // percent
      const duration = 3 + Math.random() * 2; // 3s to 5s
      const delay = Math.random() * 0.5;
      const size = 16 + Math.random() * 16; // 16px to 32px
      const drift = (Math.random() * 80 - 40) + 'px'; // horizontal drift offset
      const rotation = (Math.random() * 360 - 180) + 'deg';
      
      heart.style.left = randomX + '%';
      heart.style.bottom = '-40px';
      heart.style.fontSize = size + 'px';
      heart.style.animationDuration = duration + 's';
      heart.style.animationDelay = delay + 's';
      heart.style.setProperty('--drift', drift);
      heart.style.setProperty('--rotation', rotation);

      container.appendChild(heart);
      
      // Remove heart after animation ends
      setTimeout(() => heart.remove(), (duration + delay) * 1000);
    }, 150);
  }
};

// Start the game loop on page load
window.addEventListener('DOMContentLoaded', () => Game.init());
