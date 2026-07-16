'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
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

const SKIN_COLORS = {
  retro: COLORS,
  neon: [
    null,
    '#00e5ff', // I
    '#fff700', // O
    '#e040fb', // T
    '#00ff6a', // S
    '#ff1744', // Z
    '#2979ff', // J
    '#ff9100', // L
    '#b0bec5', // Tuerca
  ],
  pastel: [
    null,
    '#a8e6ef', // I
    '#fff2b2', // O
    '#e3bfe6', // T
    '#c3e8c8', // S
    '#f4c2c2', // Z
    '#bcd8f7', // J
    '#f8d9b0', // L
    '#cfd8dc', // Tuerca
  ],
  pixelart: [
    null,
    '#4dd0e1',
    '#ffd54f',
    '#ba68c8',
    '#81c784',
    '#e57373',
    '#64b5f6',
    '#ffb74d',
    '#90a4ae',
  ],
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
const pauseMenu = document.getElementById('pause-menu');
const pauseMainView = document.getElementById('pause-main-view');
const pauseControlsView = document.getElementById('pause-controls-view');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const showControlsBtn = document.getElementById('show-controls-btn');
const backFromControlsBtn = document.getElementById('back-from-controls-btn');
const startLevelSelect = document.getElementById('start-level-select');
const skinSelect = document.getElementById('skin-select');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('player-name-input');
const saveScoreBtn = document.getElementById('save-score-btn');
const highscoresPanel = document.getElementById('highscores-panel');
const highscoresBody = document.getElementById('highscores-body');
const bestComboEl = document.getElementById('best-combo');
const bestLinesEl = document.getElementById('best-lines');
const resetScoresBtn = document.getElementById('reset-scores-btn');

let board, current, next, hold, canHold, score, lines, level, combo, maxCombo, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let theme = 'dark';
let startLevel = 1;
let skin = 'retro';

const HS_KEY = 'tetris-highscores';
const BEST_COMBO_KEY = 'tetris-best-combo';
const BEST_LINES_KEY = 'tetris-best-lines';

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

function applyStartLevel(lvl) {
  startLevel = lvl;
  localStorage.setItem('tetris-start-level', String(lvl));
  startLevelSelect.value = String(lvl);
}

function initStartLevel() {
  const saved = parseInt(localStorage.getItem('tetris-start-level'), 10);
  applyStartLevel(Number.isInteger(saved) && saved >= 1 && saved <= 10 ? saved : 1);
}

function applySkin(name) {
  skin = SKIN_COLORS[name] ? name : 'retro';
  localStorage.setItem('tetris-skin', skin);
  if (skinSelect) skinSelect.value = skin;
  if (typeof current !== 'undefined' && current) {
    draw();
    drawNext();
    drawHold();
  }
}

function initSkin() {
  const saved = localStorage.getItem('tetris-skin');
  applySkin(saved && SKIN_COLORS[saved] ? saved : 'retro');
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
    combo++;
    maxCombo = Math.max(maxCombo, combo);
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
  if (cleared === 0) combo = 0;
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

function tracePath(context, x, y, w, h, r) {
  if (typeof context.roundRect === 'function') {
    context.beginPath();
    context.roundRect(x, y, w, h, r);
    return;
  }
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawPixelTexture(context, x, y, s, baseAlpha) {
  const step = s / 3;
  context.fillStyle = 'rgba(0,0,0,1)';
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if ((i + j) % 2 === 0) {
        context.globalAlpha = baseAlpha * 0.18;
        context.fillRect(x + i * step, y + j * step, step, step);
      }
    }
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const a = alpha ?? 1;
  const palette = SKIN_COLORS[skin] || COLORS;
  const color = palette[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;

  context.globalAlpha = a;

  if (skin === 'neon') {
    context.save();
    context.shadowBlur = 10;
    context.shadowColor = color;
    context.fillStyle = color;
    context.fillRect(px, py, s, s);
    context.restore();
    context.fillStyle = THEME_COLORS[theme].highlight;
    context.fillRect(px, py, s, 4);
  } else if (skin === 'pastel') {
    context.fillStyle = color;
    tracePath(context, px, py, s, s, Math.min(6, s / 2));
    context.fill();
    context.fillStyle = THEME_COLORS[theme].highlight;
    tracePath(context, px, py, s, Math.min(4, s), Math.min(4, s / 2));
    context.fill();
  } else {
    // retro / pixelart share the base fill + highlight
    context.fillStyle = color;
    context.fillRect(px, py, s, s);
    if (skin === 'pixelart') {
      drawPixelTexture(context, px, py, s, a);
      context.globalAlpha = a;
    }
    context.fillStyle = THEME_COLORS[theme].highlight;
    context.fillRect(px, py, s, 4);
  }

  context.globalAlpha = 1;
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getHighscores() {
  try {
    const raw = localStorage.getItem(HS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveHighscores(list) {
  localStorage.setItem(HS_KEY, JSON.stringify(list));
}

function getBestCombo() {
  return Number(localStorage.getItem(BEST_COMBO_KEY)) || 0;
}

function getBestLines() {
  return Number(localStorage.getItem(BEST_LINES_KEY)) || 0;
}

function updateBests(currentMaxCombo, currentLines) {
  const bestCombo = Math.max(getBestCombo(), currentMaxCombo);
  const bestLines = Math.max(getBestLines(), currentLines);
  localStorage.setItem(BEST_COMBO_KEY, String(bestCombo));
  localStorage.setItem(BEST_LINES_KEY, String(bestLines));
}

function qualifiesForTop(list, s) {
  if (list.length < 5) return true;
  return s > Math.min(...list.map(e => e.score));
}

function addHighscore(entry) {
  const list = getHighscores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, 5);
  saveHighscores(trimmed);
  return trimmed;
}

function renderHighscores(list, highlightEntry) {
  const data = list || getHighscores();
  highscoresBody.innerHTML = '';
  if (data.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="4" class="hs-empty">Sin récords aún</td>';
    highscoresBody.appendChild(row);
  } else {
    data.forEach((entry, i) => {
      const row = document.createElement('tr');
      if (highlightEntry && entry === highlightEntry) row.classList.add('hs-highlight');
      row.innerHTML = `<td>${i + 1}</td><td>${escapeHtml(entry.name)}</td><td>${entry.score.toLocaleString()}</td><td>${entry.lines}</td>`;
      highscoresBody.appendChild(row);
    });
  }
  bestComboEl.textContent = getBestCombo();
  bestLinesEl.textContent = getBestLines();
}

function resetHighscores() {
  localStorage.removeItem(HS_KEY);
  localStorage.removeItem(BEST_COMBO_KEY);
  localStorage.removeItem(BEST_LINES_KEY);
  renderHighscores();
}

function showStartScreen() {
  gameOver = true;
  paused = false;
  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = '';
  restartBtn.textContent = 'Jugar';
  nameForm.classList.add('hidden');
  highscoresPanel.classList.remove('hidden');
  renderHighscores();
  overlay.classList.remove('hidden');
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  restartBtn.textContent = 'Reiniciar';
  highscoresPanel.classList.remove('hidden');
  updateBests(maxCombo, lines);

  const list = getHighscores();
  if (qualifiesForTop(list, score)) {
    nameForm.classList.remove('hidden');
    nameInput.value = '';
    renderHighscores(list);
    saveScoreBtn.onclick = () => {
      const name = (nameInput.value.trim() || 'AAA').slice(0, 12);
      const entry = { name, score, lines, combo: maxCombo };
      const updated = addHighscore(entry);
      nameForm.classList.add('hidden');
      renderHighscores(updated, entry);
    };
  } else {
    nameForm.classList.add('hidden');
    renderHighscores(list);
  }

  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    closePauseMenu();
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    openPauseMenu();
  }
}

function openPauseMenu() {
  showPauseMainView();
  pauseMenu.classList.remove('hidden');
}

function closePauseMenu() {
  pauseMenu.classList.add('hidden');
}

function showPauseMainView() {
  pauseControlsView.classList.add('hidden');
  pauseMainView.classList.remove('hidden');
}

function showPauseControlsView() {
  pauseMainView.classList.add('hidden');
  pauseControlsView.classList.remove('hidden');
}

function isShowingPauseControls() {
  return paused && !pauseControlsView.classList.contains('hidden');
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
  combo = 0;
  maxCombo = 0;
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
  closePauseMenu();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'Escape') {
    if (isShowingPauseControls()) { showPauseMainView(); return; }
    togglePause();
    return;
  }
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
if (skinSelect) skinSelect.addEventListener('change', () => applySkin(skinSelect.value));

resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', init);
showControlsBtn.addEventListener('click', showPauseControlsView);
backFromControlsBtn.addEventListener('click', showPauseMainView);
startLevelSelect.addEventListener('change', () => applyStartLevel(parseInt(startLevelSelect.value, 10)));
resetScoresBtn.addEventListener('click', resetHighscores);
nameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveScoreBtn.click();
});

initTheme();
initStartLevel();
initSkin();
showStartScreen();
