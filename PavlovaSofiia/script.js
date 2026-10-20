const gameState = {
  rows: 8,
  cols: 8,
  minesCount: 10,
  status: 'process',
  gameTime: 0,
  timerId: null,
};

let board = [];

function generateBoard(rows, cols, minesCount) {
  board = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push({
        type: 'empty',
        neighborMines: 0,
        state: 'closed',
        exploded: false,
      });
    }
    board.push(row);
  }

  let placedMines = 0;
  while (placedMines < minesCount) {
    const randomRow = Math.floor(Math.random() * rows);
    const randomCol = Math.floor(Math.random() * cols);

    if (board[randomRow][randomCol].type !== 'mine') {
      board[randomRow][randomCol].type = 'mine';
      placedMines++;
    }
  }
  countNeighbourMines();
}

function getNeighbors(row, col) {
  const neighbors = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;

      const nr = row + dr;
      const nc = col + dc;

      if (nr >= 0 && nr < gameState.rows && nc >= 0 && nc < gameState.cols) {
        neighbors.push({ r: nr, c: nc });
      }
    }
  }
  return neighbors;
}

function countNeighbourMines() {
  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      if (board[r][c].type === 'mine') continue;

      const neighbors = getNeighbors(r, c);
      let count = 0;
      neighbors.forEach(({ r: nr, c: nc }) => {
        if (board[nr][nc].type === 'mine') {
          count++;
        }
      });

      board[r][c].neighborMines = count;
    }
  }
}

function revealCell(row, col) {
  const cell = board[row][col];
  if (cell.state !== 'closed') return;

  cell.state = 'opened';

  if (cell.neighborMines === 0) {
    const neighbors = getNeighbors(row, col);
    neighbors.forEach(({ r: nr, c: nc }) => {
      if (board[nr][nc].state === 'closed') {
        revealCell(nr, nc);
      }
    });
  }
}

function openCell(row, col) {
  if (gameState.status !== 'process') return;
  const cell = board[row][col];
  if (cell.state === 'opened' || cell.state === 'flagged') return;

  if (gameState.gameTime === 0 && !gameState.timerId) {
    startTimer();
  }

  if (cell.type === 'mine') {
    cell.state = 'opened';
    cell.exploded = true;
    endGame('lose');
    return;
  }

  revealCell(row, col);

  checkWinCondition();
}

function checkWinCondition() {
  if (gameState.status !== 'process') return;

  let closedSafeCells = 0;

  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cell = board[r][c];
      if (cell.type !== 'mine' && cell.state !== 'opened') {
        closedSafeCells++;
      }
    }
  }

  if (closedSafeCells === 0) {
    endGame('win');
  }
}

function toggleFlag(row, col) {
  if (gameState.status !== 'process') return;
  const cell = board[row][col];

  if (cell.state === 'opened') return;

  if (cell.state === 'closed') {
    cell.state = 'flagged';
  } else if (cell.state === 'flagged') {
    cell.state = 'closed';
  }

  updateHeaderUI();
}

function startTimer() {
  if (gameState.timerId) clearInterval(gameState.timerId);
  gameState.timerId = setInterval(() => {
    gameState.gameTime++;
    updateTimerUI();
  }, 1000);
}

const boardElement = document.querySelector('.board');
const timerElement = document.querySelector('.time');
const flagsElement = document.querySelector('.flag-count');
const startBtn = document.querySelector('.start-btn');
const statusElement = document.querySelector('[role="status"]');

function endGame(status) {
  gameState.status = status;
  clearInterval(gameState.timerId);

  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      if (board[r][c].type === 'mine') {
        if (status === 'lose' && board[r][c].state !== 'flagged') {
          board[r][c].state = 'opened';
        }
      }
    }
  }

  renderBoard();
  updateHeaderUI();

  if (statusElement) {
    if (status === 'win') {
      statusElement.textContent = `You won in ${gameState.gameTime} seconds!`;
    } else {
      statusElement.textContent = 'Game Over! You hit a mine.';
    }
  }
}

function renderBoard() {
  if (!boardElement) return;
  boardElement.innerHTML = '';

  for (let r = 0; r < gameState.rows; r++) {
    const rowElement = document.createElement('div');
    rowElement.classList.add('row');

    for (let c = 0; c < gameState.cols; c++) {
      const cellData = board[r][c];
      const cellElement = document.createElement('div');
      cellElement.classList.add('cell');

      cellElement.dataset.row = r;
      cellElement.dataset.col = c;

      if (cellData.state === 'opened') {
        cellElement.classList.add('opened');
        if (cellData.type === 'mine') {
          cellElement.classList.add('mined');
          if (cellData.exploded) {
            cellElement.classList.add('exploded');
          }
        } else if (cellData.neighborMines > 0) {
          cellElement.textContent = cellData.neighborMines;
          cellElement.dataset.number = cellData.neighborMines;
        }
      } else if (cellData.state === 'flagged') {
        cellElement.classList.add('flagged');
      }

      rowElement.appendChild(cellElement);
    }
    boardElement.appendChild(rowElement);
  }
}

function getFlaggedCount() {
  let count = 0;
  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      if (board[r][c].state === 'flagged') {
        count++;
      }
    }
  }
  return count;
}

function updateTimerUI() {
  if (timerElement) {
    timerElement.textContent = `${gameState.gameTime} seconds`;
  }
}

function updateHeaderUI() {
  if (flagsElement) {
    const remainingFlags = gameState.minesCount - getFlaggedCount();
    flagsElement.textContent = `${remainingFlags} flags`;
  }
  updateTimerUI();
}

function setupEventListeners() {
  if (!boardElement) return;

  boardElement.addEventListener('click', (event) => {
    const cellElement = event.target.closest('.cell');
    if (!cellElement) return;

    const row = parseInt(cellElement.dataset.row, 10);
    const col = parseInt(cellElement.dataset.col, 10);

    openCell(row, col);
    renderBoard();
  });

  boardElement.addEventListener('contextmenu', (event) => {
    event.preventDefault();

    const cellElement = event.target.closest('.cell');
    if (!cellElement) return;

    const row = parseInt(cellElement.dataset.row, 10);
    const col = parseInt(cellElement.dataset.col, 10);

    toggleFlag(row, col);
    renderBoard();
  });

  if (startBtn) {
    startBtn.addEventListener('click', initGame);
  }
}

function initGame() {
  clearInterval(gameState.timerId);
  gameState.status = 'process';
  gameState.gameTime = 0;
  gameState.timerId = null;

  if (statusElement) {
    statusElement.textContent = '';
  }

  generateBoard(gameState.rows, gameState.cols, gameState.minesCount);
  renderBoard();
  updateHeaderUI();
}

document.addEventListener('DOMContentLoaded', () => {
  initGame();
  setupEventListeners();
});
