const gameState = {
  rows: 10,
  cols: 10,
  minesCount: 15,
  status: 'process',
  gameTime: 0,
  timerId: null,
  board: [],
  flagsLeft: 15,
  explodedMine: null,
  isFirstClick: true,
};

const boardElement = document.getElementById('board');
const timerElement = document.getElementById('timer');
const flagsElement = document.getElementById('flags-count');
const restartBtn = document.getElementById('restart-btn');
const gameMessage = document.getElementById('game-message');

document.documentElement.style.setProperty('--board-columns', gameState.cols);

function generateField(rows, cols, minesCount, safeRow = -1, safeCol = -1) {
  const board = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push({
        type: 'empty',
        state: 'closed',
        neighborMines: 0,
        isWrongFlag: false,
      });
    }
    board.push(row);
  }

  let plantedMines = 0;
  while (plantedMines < minesCount) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);

    if (r === safeRow && c === safeCol) continue;

    if (board[r][c].type !== 'mine') {
      board[r][c].type = 'mine';
      plantedMines++;
    }
  }

  return board;
}

function countNeighbourMines() {
  const { rows, cols, board } = gameState;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].type === 'mine') continue;

      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;

          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            if (board[nr][nc].type === 'mine') {
              count++;
            }
          }
        }
      }
      board[r][c].neighborMines = count;
    }
  }
}

function openCell(row, col) {
  const { rows, cols, board, status } = gameState;

  if (status !== 'process') return;
  if (row < 0 || row >= rows || col < 0 || col >= cols) return;

  const cell = board[row][col];
  if (cell.state === 'opened' || cell.state === 'flagged') return;

  if (gameState.isFirstClick) {
    gameState.isFirstClick = false;
    gameState.board = generateField(rows, cols, gameState.minesCount, row, col);
    countNeighbourMines();
    startTimer();
  } else if (!gameState.timerId && gameState.gameTime === 0) {
    startTimer();
  }

  const currentCell = gameState.board[row][col];

  if (currentCell.type === 'mine') {
    currentCell.state = 'opened';
    gameState.explodedMine = { row, col };
    endGame('lose');
    return;
  }

  currentCell.state = 'opened';

  if (currentCell.neighborMines === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr !== 0 || dc !== 0) {
          openCell(row + dr, col + dc);
        }
      }
    }
  }

  checkWinCondition();
}

function toggleFlag(row, col) {
  if (gameState.status !== 'process') return;

  const cell = gameState.board[row][col];
  if (cell.state === 'opened') return;

  if (cell.state === 'closed') {
    if (gameState.flagsLeft <= 0) return;
    cell.state = 'flagged';
    gameState.flagsLeft--;
  } else if (cell.state === 'flagged') {
    cell.state = 'closed';
    gameState.flagsLeft++;
  }

  updateUI();
  renderBoard();
}

function startTimer() {
  if (gameState.timerId) return;
  gameState.timerId = setInterval(() => {
    gameState.gameTime++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (gameState.timerId) {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
  }
}

function updateTimerDisplay() {
  const minutes = String(Math.floor(gameState.gameTime / 60)).padStart(2, '0');
  const seconds = String(gameState.gameTime % 60).padStart(2, '0');
  timerElement.textContent = `${minutes}:${seconds}`;
}

function renderBoard() {
  boardElement.innerHTML = '';

  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cellData = gameState.board[r][c];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.classList.add('cell');
      btn.dataset.row = r;
      btn.dataset.col = c;

      let ariaText = `Row ${r + 1}, column ${c + 1}`;

      if (cellData.state === 'opened') {
        btn.classList.add('open');

        if (cellData.type === 'mine') {
          if (
            gameState.explodedMine &&
            gameState.explodedMine.row === r &&
            gameState.explodedMine.col === c
          ) {
            btn.classList.add('exploded');
            btn.textContent = '💥';
            ariaText += ', exploded mine';
          } else {
            btn.classList.add('mine');
            btn.textContent = '💣';
            ariaText += ', mine';
          }
        } else if (cellData.neighborMines > 0) {
          btn.dataset.value = cellData.neighborMines;
          btn.textContent = cellData.neighborMines;
          ariaText += `, open, neighbor mines: ${cellData.neighborMines}`;
        } else {
          ariaText += ', open, empty';
        }
      } else if (cellData.state === 'flagged') {
        btn.classList.add('flagged');
        if (cellData.isWrongFlag) {
          btn.textContent = '❌';
          btn.classList.add('wrong-flag');
        } else {
          btn.textContent = '🚩';
        }
        ariaText += ', flagged';
      } else {
        ariaText += ', closed';
      }

      btn.setAttribute('aria-label', ariaText);
      boardElement.appendChild(btn);
    }
  }
}

function updateUI() {
  flagsElement.textContent = gameState.flagsLeft;

  if (gameState.status === 'win') {
    gameMessage.textContent = 'Victory!';
    gameMessage.className = 'status-message win';
  } else if (gameState.status === 'lose') {
    gameMessage.textContent = 'Game over.';
    gameMessage.className = 'status-message lose';
  } else {
    gameMessage.textContent = '';
    gameMessage.className = 'status-message';
  }
}

boardElement.addEventListener('click', (e) => {
  const target = e.target.closest('.cell');
  if (!target || gameState.status !== 'process') return;

  const row = parseInt(target.dataset.row, 10);
  const col = parseInt(target.dataset.col, 10);

  openCell(row, col);
  renderBoard();
  updateUI();
});

boardElement.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const target = e.target.closest('.cell');
  if (!target || gameState.status !== 'process') return;

  const row = parseInt(target.dataset.row, 10);
  const col = parseInt(target.dataset.col, 10);

  toggleFlag(row, col);
});

restartBtn.addEventListener('click', initGame);

function checkWinCondition() {
  const { rows, cols, board, minesCount } = gameState;
  let openedCells = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].state === 'opened' && board[r][c].type !== 'mine') {
        openedCells++;
      }
    }
  }

  if (openedCells === rows * cols - minesCount) {
    endGame('win');
  }
}

function endGame(status) {
  gameState.status = status;
  stopTimer();

  const { rows, cols, board } = gameState;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board[r][c];

      if (status === 'lose') {
        if (cell.type === 'mine' && cell.state !== 'flagged') {
          cell.state = 'opened';
        }
        if (cell.type !== 'mine' && cell.state === 'flagged') {
          cell.isWrongFlag = true;
        }
      } else if (status === 'win') {
        if (cell.type === 'mine') {
          cell.state = 'flagged';
        }
      }
    }
  }

  renderBoard();
  updateUI();
}

function initGame() {
  stopTimer();
  gameState.status = 'process';
  gameState.gameTime = 0;
  gameState.flagsLeft = gameState.minesCount;
  gameState.explodedMine = null;
  gameState.isFirstClick = true;

  updateTimerDisplay();

  gameState.board = generateField(
    gameState.rows,
    gameState.cols,
    0
  );

  renderBoard();
  updateUI();
}

initGame();