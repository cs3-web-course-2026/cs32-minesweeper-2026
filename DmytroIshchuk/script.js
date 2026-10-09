const gameState = { rows: 10, cols: 10, minesCount: 15, status: 'process', gameTime: 0, timerId: null };
let board = [];
const boardElement = document.querySelector('#board');
const flags = document.querySelector('#flags');
const timer = document.querySelector('#timer');
const message = document.querySelector('#message');

function generateField(rows, cols, minesCount) {
  const cells = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ type: 'empty', neighborMines: 0, state: 'closed' })));
  let mines = 0;
  while (mines < minesCount) {
    const cell = cells[Math.floor(Math.random() * rows)][Math.floor(Math.random() * cols)];
    if (cell.type === 'empty') {
      cell.type = 'mine';
      mines += 1;
    }
  }
  return countNeighbourMines(cells);
}

function countNeighbourMines(cells) {
  return cells.map((row, r) => row.map((cell, c) => {
    if (cell.type === 'mine') return cell;
    for (let y = r - 1; y <= r + 1; y += 1) for (let x = c - 1; x <= c + 1; x += 1) if (cells[y]?.[x]?.type === 'mine') cell.neighborMines += 1;
    return cell;
  }));
}

function neighbours(row, col) {
  const result = [];
  for (let r = row - 1; r <= row + 1; r += 1) for (let c = col - 1; c <= col + 1; c += 1) if ((r !== row || c !== col) && board[r]?.[c]) result.push([r, c]);
  return result;
}

function openCell(row, col) {
  const cell = board[row][col];
  if (gameState.status !== 'process' || cell.state !== 'closed') return;
  cell.state = 'opened';
  if (cell.type === 'mine') {
    gameState.status = 'lose';
    board.flat().filter(({ type }) => type === 'mine').forEach((mine) => { mine.state = 'opened'; });
    stopTimer();
  } else if (!cell.neighborMines) neighbours(row, col).forEach(([r, c]) => openCell(r, c));
  checkWin();
}

function toggleFlag(row, col) {
  const cell = board[row][col];
  if (gameState.status !== 'process' || cell.state === 'opened') return;
  if (cell.state === 'closed' && flaggedCount() === gameState.minesCount) return;
  cell.state = cell.state === 'flagged' ? 'closed' : 'flagged';
}

function flaggedCount() { return board.flat().filter(({ state }) => state === 'flagged').length; }

function checkWin() {
  if (gameState.status === 'process' && board.flat().every(({ type, state }) => type === 'mine' || state === 'opened')) {
    gameState.status = 'win';
    stopTimer();
  }
}

function stopTimer() { clearInterval(gameState.timerId); }

function updateInfo() {
  flags.textContent = `⚑ ${String(gameState.minesCount - flaggedCount()).padStart(2, '0')}`;
  timer.textContent = `${String(Math.floor(gameState.gameTime / 60)).padStart(2, '0')}:${String(gameState.gameTime % 60).padStart(2, '0')}`;
  message.textContent = gameState.status === 'win' ? 'Перемога!' : gameState.status === 'lose' ? 'Гру завершено' : '';
}

function render() {
  boardElement.style.setProperty('--cols', gameState.cols);
  boardElement.replaceChildren(...board.flatMap((row, r) => row.map((cell, c) => {
    const button = document.createElement('button');
    const opened = cell.state === 'opened';
    button.className = `cell ${opened ? 'open' : ''} ${cell.state === 'flagged' ? 'flag' : ''} ${opened && cell.type === 'mine' ? 'mine' : ''} ${opened && cell.neighborMines ? `n${cell.neighborMines}` : ''}`;
    button.textContent = cell.state === 'flagged' ? '⚑' : opened && cell.type === 'mine' ? '✹' : opened && cell.neighborMines || '';
    button.setAttribute('aria-label', `Рядок ${r + 1}, стовпець ${c + 1}`);
    button.addEventListener('click', () => { openCell(r, c); render(); });
    button.addEventListener('contextmenu', (event) => { event.preventDefault(); toggleFlag(r, c); render(); });
    return button;
  })));
  updateInfo();
}

function startGame() {
  stopTimer();
  Object.assign(gameState, { status: 'process', gameTime: 0 });
  board = generateField(gameState.rows, gameState.cols, gameState.minesCount);
  gameState.timerId = setInterval(() => { gameState.gameTime += 1; updateInfo(); }, 1000);
  render();
}

document.querySelector('#restart').addEventListener('click', startGame);
startGame();
