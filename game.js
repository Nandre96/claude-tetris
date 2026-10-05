'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// Order: null, I, O, T, S, Z, J, L, R(ring), bomb, tint, wild
const RETRO_COLORS = [
  null,
  '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d',
  '#f06292', '#616161', '#e0e0e0', '#ffd700',
];
const NEON_COLORS = [
  null,
  '#00f0ff', '#fff200', '#d400ff', '#39ff14', '#ff1744', '#2979ff', '#ff9100',
  '#ff2bd6', '#9e9e9e', '#ffffff', '#ffe600',
];
const PASTEL_COLORS = [
  null,
  '#a8e6ef', '#fff1b8', '#d7b9e8', '#b9e4c0', '#f4b8b8', '#bcd8f5', '#fbd3a5',
  '#f7bfd3', '#b0b0b8', '#f3f3f6', '#f5e08a',
];
const PIXEL_COLORS = [
  null,
  '#29b6c8', '#e6b422', '#9a3fb0', '#4caf50', '#d32f2f', '#3f7fd6', '#e68a1f',
  '#d81b60', '#4a4a4a', '#cfcfcf', '#e6c200',
];

// Each skin: palette, canvas bg, grid color, and a draw(ctx, px, py, size, color) for the block body.
const SKINS = {
  retro: {
    label: 'Retro',
    colors: RETRO_COLORS,
    bg: '#1a1a25',
    grid: '#22222e',
    draw(c, px, py, s, color) {
      c.fillStyle = color;
      c.fillRect(px + 1, py + 1, s - 2, s - 2);
      c.fillStyle = 'rgba(255,255,255,0.12)';
      c.fillRect(px + 1, py + 1, s - 2, 4);
    },
  },
  neon: {
    label: 'Neon',
    colors: NEON_COLORS,
    bg: '#000000',
    grid: '#14142a',
    draw(c, px, py, s, color) {
      c.shadowColor = color;
      c.shadowBlur = 12;
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.strokeRect(px + 3, py + 3, s - 6, s - 6);
      c.fillStyle = color + '55';
      c.fillRect(px + 3, py + 3, s - 6, s - 6);
      c.shadowBlur = 0;
      c.shadowColor = 'transparent';
    },
  },
  pastel: {
    label: 'Pastel',
    colors: PASTEL_COLORS,
    bg: '#2a2733',
    grid: '#332f3f',
    draw(c, px, py, s, color) {
      c.fillStyle = color;
      c.beginPath();
      c.roundRect(px + 2, py + 2, s - 4, s - 4, s * 0.3);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.beginPath();
      c.roundRect(px + 5, py + 5, s - 10, 4, 2);
      c.fill();
    },
  },
  pixel: {
    label: 'Pixel art',
    colors: PIXEL_COLORS,
    bg: '#101018',
    grid: '#1c1c28',
    draw(c, px, py, s, color) {
      c.fillStyle = color;
      c.fillRect(px, py, s, s);
      const u = s / 6; // 6x6 pixel texture
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(px + u, py + u, u * 3, u);
      c.fillRect(px + u, py + u, u, u * 3);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(px + u * 2, py + u * 4, u * 3, u);
      c.fillRect(px + u * 4, py + u * 2, u, u * 3);
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillRect(px, py + s - 2, s, 2);
      c.fillRect(px + s - 2, py, 2, s);
    },
  },
};
const SKIN_KEY = 'tetris-skin';
let skin = SKINS.retro;
let COLORS = skin.colors;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // R (ring)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const SPECIAL_EVERY_LINES = 8;
const BOMB = 9, TINT = 10, WILD = 11; // indices into COLORS
const SPECIAL_TYPES = [BOMB, TINT];
const BOMB_RADIUS = 1; // 1 => 3x3 blast area
const BLOCK_GLYPHS = { [BOMB]: '✹', [TINT]: '◐', [WILD]: '★' };

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const skinSelect = document.getElementById('skin-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let specialsAwarded, specialPending;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function createPiece(type, baseShape) {
  const shape = baseShape.map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  return createPiece(type, PIECES[type]);
}

function randomSpecialPiece() {
  const type = SPECIAL_TYPES[Math.floor(Math.random() * SPECIAL_TYPES.length)];
  return createPiece(type, [[type]]);
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

// BOMB: clears the (2*BOMB_RADIUS+1)² area centered on the piece.
function detonate(cx, cy) {
  for (let r = cy - BOMB_RADIUS; r <= cy + BOMB_RADIUS; r++)
    for (let c = cx - BOMB_RADIUS; c <= cx + BOMB_RADIUS; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) board[r][c] = 0;
}

// TINT: turns every block of the color found right below the piece into WILD. No-op on empty/floor/WILD.
function applyTint(x, y) {
  const target = board[y + 1]?.[x];
  if (!target || target === WILD) return;
  for (const row of board)
    for (let c = 0; c < COLS; c++)
      if (row[c] === target) row[c] = WILD;
}

// A row is complete when every gap can be covered by a WILD block in that row.
function isRowComplete(row) {
  const gaps = row.filter(v => v === 0).length;
  const wilds = row.filter(v => v === WILD).length;
  return gaps <= wilds;
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (isRowComplete(board[r])) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    if (Math.floor(lines / SPECIAL_EVERY_LINES) > specialsAwarded) {
      specialsAwarded++;
      specialPending = true;
    }
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
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
  if (current.type === BOMB) detonate(current.x, current.y);
  else if (current.type === TINT) applyTint(current.x, current.y);
  else merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = specialPending ? randomSpecialPiece() : randomPiece();
  specialPending = false;
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

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  skin.draw(context, x * size, y * size, size, color);
  const glyph = BLOCK_GLYPHS[colorIndex];
  if (glyph) {
    context.fillStyle = skin === SKINS.neon ? '#ffffff' : '#1a1a24';
    context.font = `${size * 0.6}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(glyph, x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = skin.grid;
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

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
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
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  specialsAwarded = 0;
  specialPending = false;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
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
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

function applySkin(name) {
  skin = SKINS[name] || SKINS.retro;
  COLORS = skin.colors;
  canvas.style.background = skin.bg;
  nextCanvas.style.background = skin.bg;
  skinSelect.value = Object.keys(SKINS).find(k => SKINS[k] === skin);
  if (current) { draw(); drawNext(); } // repaint immediately (also while paused)
}

function loadSkin() {
  try { return localStorage.getItem(SKIN_KEY); } catch { return null; }
}

for (const [key, s] of Object.entries(SKINS)) {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = s.label;
  skinSelect.appendChild(opt);
}
skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  try { localStorage.setItem(SKIN_KEY, skinSelect.value); } catch {}
  skinSelect.blur(); // keep arrow keys for the game
});

applySkin(loadSkin());
init();
