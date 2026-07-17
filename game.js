'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

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

const SKINS = {
  retro: {
    colors: ['#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#64b5f6', '#ffb74d', '#90a4ae'],
  },
  neon: {
    colors: ['#00e5ff', '#ffee00', '#e040fb', '#00e676', '#ff1744', '#2979ff', '#ff9100', '#b0bec5'],
    grid: '#0a2a2a',
  },
  pastel: {
    colors: ['#a7d8de', '#fff0b3', '#dcb8e0', '#c3e8c5', '#f4b8b8', '#b8d4f0', '#f7d2ae', '#d3d8dc'],
  },
  pixel: {
    colors: ['#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#64b5f6', '#ffb74d', '#90a4ae'],
  },
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
const recordsListEl = document.getElementById('records-list');
const overlayRecordsListEl = document.getElementById('overlay-records-list');
const overlayRecordsSection = document.getElementById('overlay-records-section');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const newRecordForm = document.getElementById('new-record-form');
const playerNameInput = document.getElementById('player-name');
const saveRecordBtn = document.getElementById('save-record-btn');
const pauseOverlay = document.getElementById('pause-overlay');
const pauseMain = document.getElementById('pause-main');
const pauseControls = document.getElementById('pause-controls');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const backBtn = document.getElementById('back-btn');
const startLevelSelect = document.getElementById('start-level');

const RECORDS_KEY = 'tetris-records';
const BEST_COMBO_KEY = 'tetris-best-combo';
const MAX_LINES_KEY = 'tetris-max-lines';

const MAX_START_LEVEL = 10;
for (let i = 1; i <= MAX_START_LEVEL; i++) {
  const opt = document.createElement('option');
  opt.value = i;
  opt.textContent = i;
  startLevelSelect.appendChild(opt);
}

let board, current, next, hold, canHold, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let theme = 'dark';
let skin = 'retro';
let startLevel = 1;
let records = [];
let bestCombo = 0;
let maxLines = 0;
let comboStreak = 0;
let maxComboThisGame = 0;
let pendingRecord = null;

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

function applySkin(name) {
  skin = SKINS[name] ? name : 'retro';
  document.documentElement.setAttribute('data-skin', skin);
  localStorage.setItem('tetris-skin', skin);
  skinSelect.value = skin;
}

function initSkin() {
  const saved = localStorage.getItem('tetris-skin');
  applySkin(SKINS[saved] ? saved : 'retro');
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
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    comboStreak++;
    if (comboStreak > maxComboThisGame) maxComboThisGame = comboStreak;
    updateHUD();
  } else {
    comboStreak = 0;
  }
}

function loadRecords() {
  try {
    records = JSON.parse(localStorage.getItem(RECORDS_KEY)) || [];
  } catch {
    records = [];
  }
  bestCombo = Number(localStorage.getItem(BEST_COMBO_KEY)) || 0;
  maxLines = Number(localStorage.getItem(MAX_LINES_KEY)) || 0;
}

function saveRecords() {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  localStorage.setItem(BEST_COMBO_KEY, String(bestCombo));
  localStorage.setItem(MAX_LINES_KEY, String(maxLines));
}

function qualifiesForTop(candidateScore) {
  return records.length < 5 || candidateScore > records[records.length - 1].score;
}

function addRecord(name, candidateScore, candidateLines, candidateLevel) {
  const entry = { name: name || 'AAA', score: candidateScore, lines: candidateLines, level: candidateLevel };
  records.push(entry);
  records.sort((a, b) => b.score - a.score);
  records = records.slice(0, 5);
  saveRecords();
  return records.includes(entry) ? entry : null;
}

function renderRecords(highlightEntry) {
  const renderList = (el) => {
    el.innerHTML = '';
    if (records.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'Sin récords aún';
      li.className = 'empty';
      el.appendChild(li);
      return;
    }
    records.forEach((r) => {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.textContent = r.name;
      const value = document.createElement('span');
      value.textContent = r.score.toLocaleString();
      li.appendChild(name);
      li.appendChild(value);
      if (highlightEntry && r === highlightEntry) li.classList.add('highlight');
      el.appendChild(li);
    });
  };
  renderList(recordsListEl);
  renderList(overlayRecordsListEl);
  bestComboEl.textContent = bestCombo;
  maxLinesEl.textContent = maxLines;
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
  clearLines();
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

function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawPixelTexture(context, px, py, size) {
  const step = size / 4;
  context.save();
  context.globalAlpha = 0.14;
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      context.fillStyle = (i + j) % 2 === 0 ? '#ffffff' : '#000000';
      context.fillRect(px + i * step, py + j * step, step, step);
    }
  }
  context.restore();
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = SKINS[skin].colors[colorIndex - 1];
  const px = x * size, py = y * size;
  context.globalAlpha = alpha ?? 1;

  switch (skin) {
    case 'neon': {
      context.save();
      context.shadowColor = color;
      context.shadowBlur = size * 0.45;
      context.fillStyle = color;
      context.fillRect(px + 3, py + 3, size - 6, size - 6);
      context.shadowBlur = 0;
      context.strokeStyle = color;
      context.lineWidth = 1.5;
      context.strokeRect(px + 3, py + 3, size - 6, size - 6);
      context.restore();
      break;
    }
    case 'pastel': {
      const r = size * 0.22;
      context.fillStyle = color;
      roundRectPath(context, px + 2, py + 2, size - 4, size - 4, r);
      context.fill();
      break;
    }
    case 'pixel': {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      drawPixelTexture(context, px + 1, py + 1, size - 2);
      context.strokeStyle = 'rgba(0,0,0,0.3)';
      context.lineWidth = 1;
      context.strokeRect(px + 1, py + 1, size - 2, size - 2);
      break;
    }
    default: {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = THEME_COLORS[theme].highlight;
      context.fillRect(px + 1, py + 1, size - 2, 4);
    }
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = SKINS[skin].grid || THEME_COLORS[theme].grid;
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

  if (lines > maxLines) maxLines = lines;
  if (maxComboThisGame > bestCombo) bestCombo = maxComboThisGame;
  saveRecords();

  overlayRecordsSection.classList.remove('hidden');
  if (qualifiesForTop(score)) {
    pendingRecord = { score, lines, level };
    playerNameInput.value = '';
    newRecordForm.classList.remove('hidden');
    renderRecords();
    setTimeout(() => playerNameInput.focus(), 50);
  } else {
    pendingRecord = null;
    newRecordForm.classList.add('hidden');
    renderRecords();
  }

  overlay.classList.remove('hidden');
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
    pauseMain.classList.remove('hidden');
    pauseControls.classList.add('hidden');
    startLevelSelect.value = startLevel;
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
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  hold = null;
  canHold = true;
  comboStreak = 0;
  maxComboThisGame = 0;
  pendingRecord = null;
  next = randomPiece();
  spawn();
  updateHUD();
  drawHold();
  holdCanvas.classList.remove('locked');
  overlay.classList.add('hidden');
  newRecordForm.classList.add('hidden');
  overlayRecordsSection.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target === playerNameInput) return;
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
skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  drawNext();
  drawHold();
});

function submitRecord() {
  if (!pendingRecord) return;
  const name = playerNameInput.value.trim().slice(0, 12) || 'AAA';
  const entry = addRecord(name, pendingRecord.score, pendingRecord.lines, pendingRecord.level);
  pendingRecord = null;
  newRecordForm.classList.add('hidden');
  renderRecords(entry);
}

saveRecordBtn.addEventListener('click', submitRecord);
playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') submitRecord();
});

resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los récords?')) return;
  records = [];
  bestCombo = 0;
  maxLines = 0;
  saveRecords();
  renderRecords();
});

resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', () => {
  paused = false;
  init();
});
controlsBtn.addEventListener('click', () => {
  pauseMain.classList.add('hidden');
  pauseControls.classList.remove('hidden');
});
backBtn.addEventListener('click', () => {
  pauseControls.classList.add('hidden');
  pauseMain.classList.remove('hidden');
});
startLevelSelect.addEventListener('change', () => {
  startLevel = parseInt(startLevelSelect.value, 10);
});

initTheme();
initSkin();
loadRecords();
renderRecords();
init();
