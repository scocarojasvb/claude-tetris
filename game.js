'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS_RETRO = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - blue
  '#ffb74d', // L - orange
  '#90a4ae', // Tuerca - gris acero
];

const COLORS_NEON = [
  null,
  '#00fff0', '#fff700', '#ff00ea', '#39ff14',
  '#ff073a', '#00aaff', '#ff8800', '#d0c0ff',
];

const COLORS_PASTEL = [
  null,
  '#a8dee6', '#fff2b2', '#d8b8e8', '#b8e8c0',
  '#f4b8b8', '#b8cdf0', '#f7cfa0', '#cfd6dc',
];

const SKINS = {
  retro: { label: 'Retro', colors: COLORS_RETRO },
  neon: { label: 'Neon', colors: COLORS_NEON },
  pastel: { label: 'Pastel', colors: COLORS_PASTEL },
  pixel: { label: 'Pixel Art', colors: COLORS_RETRO },
};

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Tuerca (nut)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const THEME_COLORS = {
  dark: { grid: '#22222e', highlight: 'rgba(255,255,255,0.12)' },
  light: { grid: '#dcdce6', highlight: 'rgba(0,0,0,0.1)' },
};

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');
const pauseOverlay = document.getElementById('pause-overlay');
const pauseMain = document.getElementById('pause-main');
const pauseControlsView = document.getElementById('pause-controls');
const resumeBtn = document.getElementById('resume-btn');
const restartPauseBtn = document.getElementById('restart-pause-btn');
const controlsBtn = document.getElementById('controls-btn');
const backBtn = document.getElementById('back-btn');
const startLevelSelect = document.getElementById('start-level');
const recordsListEl = document.getElementById('records-list');
const overlayRecordsListEl = document.getElementById('overlay-records-list');
const bestComboEl = document.getElementById('best-combo');
const bestLinesEl = document.getElementById('best-lines');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const overlayNewRecord = document.getElementById('overlay-new-record');
const playerNameInput = document.getElementById('player-name');
const saveRecordBtn = document.getElementById('save-record-btn');

let board, current, next, hold, canHold, score, lines, level, combo, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let theme = 'dark';
let skin = 'retro';
let startLevel = 1;

const RECORDS_KEY = 'tetris-records';
let records = loadRecords();

function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECORDS_KEY));
    return {
      scores: Array.isArray(parsed?.scores) ? parsed.scores : [],
      bestCombo: Number(parsed?.bestCombo) || 0,
      bestLines: Number(parsed?.bestLines) || 0,
    };
  } catch {
    return { scores: [], bestCombo: 0, bestLines: 0 };
  }
}

function saveRecords() {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

function qualifiesForTop5(candidateScore) {
  if (records.scores.length < 5) return true;
  return candidateScore > records.scores[records.scores.length - 1].score;
}

function renderRecordsList(listEl, highlightEntry) {
  listEl.innerHTML = '';
  if (records.scores.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Sin récords aún';
    li.className = 'empty';
    listEl.appendChild(li);
    return;
  }
  records.scores.forEach((entry, i) => {
    const li = document.createElement('li');
    li.textContent = `${i + 1}. ${entry.name} — ${entry.score.toLocaleString()}`;
    if (entry === highlightEntry) li.classList.add('highlight');
    listEl.appendChild(li);
  });
}

function renderRecords(highlightEntry) {
  renderRecordsList(recordsListEl, highlightEntry);
  renderRecordsList(overlayRecordsListEl, highlightEntry);
  bestComboEl.textContent = records.bestCombo;
  bestLinesEl.textContent = records.bestLines;
}

function applyTheme(name) {
  theme = name;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('tetris-theme', theme);
  themeToggle.checked = theme === 'light';
}

function initTheme() {
  const saved = localStorage.getItem('tetris-theme');
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

function applySkin(name, redraw = true) {
  skin = SKINS[name] ? name : 'retro';
  document.documentElement.setAttribute('data-skin', skin);
  localStorage.setItem('tetris-skin', skin);
  skinSelect.value = skin;
  if (redraw && current) {
    draw();
    drawNext();
    drawHold();
  }
}

function initSkin() {
  const saved = localStorage.getItem('tetris-skin');
  applySkin(saved && SKINS[saved] ? saved : 'retro', false);
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function resetPos(piece) {
  piece.shape = PIECES[piece.type].map(row => [...row]);
  piece.x = Math.floor(COLS / 2) - Math.floor(piece.shape[0].length / 2);
  piece.y = 0;
  return piece;
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const cleared = clearLines();
  combo = cleared > 0 ? combo + 1 : -1;
  if (combo > records.bestCombo) {
    records.bestCombo = combo;
    bestComboEl.textContent = records.bestCombo;
  }
  spawn();
  canHold = true;
  holdCanvas.classList.remove('locked');
}

function holdPiece() {
  if (!canHold) return;
  const cur = { type: current.type };
  if (hold === null) {
    hold = cur;
    spawn();
  } else {
    const swap = hold;
    hold = cur;
    current = resetPos({ type: swap.type });
    if (collide(current.shape, current.x, current.y)) endGame();
  }
  canHold = false;
  holdCanvas.classList.add('locked');
  drawHold();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function shadeColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) + percent;
  let g = ((num >> 8) & 0x00ff) + percent;
  let b = (num & 0x0000ff) + percent;
  r = Math.max(Math.min(255, r), 0);
  g = Math.max(Math.min(255, g), 0);
  b = Math.max(Math.min(255, b), 0);
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}

function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawPixelTexture(context, x, y, size, color) {
  const cell = size / 4;
  context.fillStyle = shadeColor(color, -35);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if ((i + j) % 2 === 0) {
        context.fillRect(x + i * cell, y + j * cell, cell, cell);
      }
    }
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = SKINS[skin].colors[colorIndex];
  const px = x * size;
  const py = y * size;

  context.save();
  context.globalAlpha = alpha ?? 1;

  if (skin === 'neon') {
    context.shadowColor = color;
    context.shadowBlur = size * 0.4;
    context.fillStyle = color;
    context.fillRect(px + 1, py + 1, size - 2, size - 2);
    context.shadowBlur = 0;
    context.strokeStyle = 'rgba(255,255,255,0.5)';
    context.lineWidth = 1;
    context.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
  } else if (skin === 'pastel') {
    roundedRectPath(context, px + 2, py + 2, size - 4, size - 4, size * 0.22);
    context.fillStyle = color;
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.4)';
    roundedRectPath(context, px + 2, py + 2, size - 4, (size - 4) * 0.4, size * 0.22);
    context.fill();
  } else if (skin === 'pixel') {
    context.fillStyle = color;
    context.fillRect(px + 1, py + 1, size - 2, size - 2);
    drawPixelTexture(context, px + 1, py + 1, size - 2, color);
  } else {
    context.fillStyle = color;
    context.fillRect(px + 1, py + 1, size - 2, size - 2);
    context.fillStyle = THEME_COLORS[theme].highlight;
    context.fillRect(px + 1, py + 1, size - 2, 4);
  }

  context.restore();
}

function drawGrid() {
  ctx.strokeStyle = THEME_COLORS[theme].grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function drawHold() {
  const NB = 30;
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (!hold) return;
  const shape = PIECES[hold.type];
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(holdCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  if (lines > records.bestLines) records.bestLines = lines;
  saveRecords();

  if (qualifiesForTop5(score)) {
    overlayNewRecord.classList.remove('hidden');
    playerNameInput.value = '';
    setTimeout(() => playerNameInput.focus(), 0);
  } else {
    overlayNewRecord.classList.add('hidden');
  }
  renderRecords(null);
  overlay.classList.remove('hidden');
}

function saveCurrentRecord() {
  if (!qualifiesForTop5(score)) return;
  const name = playerNameInput.value.trim().slice(0, 10) || 'JUGADOR';
  const entry = { name, score };
  records.scores.push(entry);
  records.scores.sort((a, b) => b.score - a.score);
  records.scores = records.scores.slice(0, 5);
  saveRecords();
  overlayNewRecord.classList.add('hidden');
  renderRecords(entry);
}

function resetRecords() {
  if (!confirm('¿Seguro que quieres borrar todos los récords?')) return;
  records = { scores: [], bestCombo: 0, bestLines: 0 };
  saveRecords();
  renderRecords(null);
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseOverlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    pauseControlsView.classList.add('hidden');
    pauseMain.classList.remove('hidden');
    pauseOverlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver || paused) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  combo = -1;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  hold = null;
  canHold = true;
  next = randomPiece();
  spawn();
  updateHUD();
  drawHold();
  holdCanvas.classList.remove('locked');
  overlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  overlayNewRecord.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      holdPiece();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
themeToggle.addEventListener('change', () => applyTheme(themeToggle.checked ? 'light' : 'dark'));
skinSelect.addEventListener('change', () => applySkin(skinSelect.value));

resumeBtn.addEventListener('click', () => { if (paused) togglePause(); });
restartPauseBtn.addEventListener('click', init);
controlsBtn.addEventListener('click', () => {
  pauseMain.classList.add('hidden');
  pauseControlsView.classList.remove('hidden');
});
backBtn.addEventListener('click', () => {
  pauseControlsView.classList.add('hidden');
  pauseMain.classList.remove('hidden');
});
startLevelSelect.addEventListener('change', () => {
  startLevel = parseInt(startLevelSelect.value, 10);
});

resetRecordsBtn.addEventListener('click', resetRecords);
saveRecordBtn.addEventListener('click', saveCurrentRecord);
playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveCurrentRecord();
  e.stopPropagation();
});

initTheme();
initSkin();
renderRecords(null);
init();
