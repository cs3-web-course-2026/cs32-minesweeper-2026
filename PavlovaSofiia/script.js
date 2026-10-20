const gameState = {
  rows: 8,
  cols: 8,
  minesCount: 10,
  status: 'process',
  gameTime: 0,
  timerId: null,
  flaggedCount: 0,
};

let field = [];

function generateField(rows, cols, minesCount) {
  field = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push({
        type: 'empty',
        neighborMines: 0,
        state: 'closed',
      });
    }
    field.push(row);
  }

  let placedMines = 0;
  while (placedMines < minesCount) {
    const randomRow = Math.floor(Math.random() * rows);
    const randomCol = Math.floor(Math.random() * cols);

    if (field[randomRow][randomCol].type !== 'mine') {
      field[randomRow][randomCol].type = 'mine';
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
      if (field[r][c].type === 'mine') continue;

      const neighbors = getNeighbors(r, c);
      let count = 0;
      neighbors.forEach(({ r: nr, c: nc }) => {
        if (field[nr][nc].type === 'mine') {
          count++;
        }
      });

      field[r][c].neighborMines = count;
    }
  }
}

function openCell(row, col) {
  if (gameState.status !== 'process') return;
  const cell = field[row][col];
  if (cell.state === 'opened' || cell.state === 'flagged') return;

  if (gameState.gameTime === 0 && !gameState.timerId) {
    startTimer();
  }

  if (cell.type === 'mine') {
    cell.state = 'opened';
    endGame('lose');
    return;
  }

  cell.state = 'opened';

  if (cell.neighborMines === 0) {
    const neighbors = getNeighbors(row, col);
    neighbors.forEach(({ r: nr, c: nc }) => {
      if (field[nr][nc].state === 'closed') {
        openCell(nr, nc);
      }
    });
  }

  checkWinCondition();
}

function checkWinCondition() {
  let closedSafeCells = 0;

  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cell = field[r][c];
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
  const cell = field[row][col];

  if (cell.state === 'opened') return;

  if (cell.state === 'closed') {
    cell.state = 'flagged';
    gameState.flaggedCount++;
  } else if (cell.state === 'flagged') {
    cell.state = 'closed';
    gameState.flaggedCount--;
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

function endGame(status) {
  gameState.status = status;
  clearInterval(gameState.timerId);

  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      if (field[r][c].type === 'mine') {
        if (status === 'lose' && field[r][c].state !== 'flagged') {
          field[r][c].state = 'opened';
        }
      }
    }
  }

  renderBoard();
  updateHeaderUI();

  setTimeout(() => {
    if (status === 'win') {
      alert(`You won in ${gameState.gameTime} seconds!`);
    } else {
      alert('You bombed');
    }
  }, 100);
}

const boardElement = document.querySelector('.field');
const timerElement = document.querySelector('.time');
const flagsElement = document.querySelector('.flag-count');
const startBtn = document.querySelector('.start-btn');

function renderBoard() {
  if (!boardElement) return;
  boardElement.innerHTML = '';

  for (let r = 0; r < gameState.rows; r++) {
    const rowElement = document.createElement('div');
    rowElement.classList.add('row');

    for (let c = 0; c < gameState.cols; c++) {
      const cellData = field[r][c];
      const cellElement = document.createElement('div');
      cellElement.classList.add('cell');

      cellElement.dataset.row = r;
      cellElement.dataset.col = c;

      if (cellData.state === 'opened') {
        cellElement.classList.add('opened');
        if (cellData.type === 'mine') {
          cellElement.classList.add('mined', 'exploded');
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

function updateTimerUI() {
  if (timerElement) {
    timerElement.textContent = `${gameState.gameTime} seconds`;
  }
}

function updateHeaderUI() {
  if (flagsElement) {
    const remainingFlags = gameState.minesCount - gameState.flaggedCount;
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
  gameState.flaggedCount = 0;

  generateField(gameState.rows, gameState.cols, gameState.minesCount);
  renderBoard();
  updateHeaderUI();
}

document.addEventListener('DOMContentLoaded', () => {
  initGame();
  setupEventListeners();
});
