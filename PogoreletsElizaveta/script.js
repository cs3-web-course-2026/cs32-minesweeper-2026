const gameState = {
  rows: 6,
  cols: 6,
  minesCount: 6,
  status: 'process',
  gameTime: 0,
  timerId: null,
  flagsCount: 6,
  isFirstClick: true
};

let board = [];

const boardElement = document.querySelector('.game-board');
const timerElement = document.getElementById('timer');
const flagsElement = document.getElementById('flags-count');
const startBtnElement = document.getElementById('start-btn');
const gameStatusElement = document.getElementById('game-status');

function formatNumber(num) {
  return String(Math.max(0, num)).padStart(3, '0');
}

function countNeighbourMines(boardGrid, rows, cols) {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (boardGrid[r][c].type === 'mine') continue;

      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;

          if (
            nr >= 0 &&
            nr < rows &&
            nc >= 0 &&
            nc < cols &&
            boardGrid[nr][nc].type === 'mine'
          ) {
            count++;
          }
        }
      }
      boardGrid[r][c].neighborMines = count;
    }
  }
}

function generateField(rows, cols, minesCount, safeR, safeC) {
  const newBoard = [];

  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push({
        type: 'empty',
        neighborMines: 0,
        state: 'closed'
      });
    }
    newBoard.push(row);
  }

  let placedMines = 0;
  while (placedMines < minesCount) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);

    const isNearSafeSpot = Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1;

    if (!isNearSafeSpot && newBoard[r][c].type !== 'mine') {
      newBoard[r][c].type = 'mine';
      placedMines++;
    }
  }

  countNeighbourMines(newBoard, rows, cols);

  return newBoard;
}

function startTimer() {
  stopTimer();
  gameState.gameTime = 0;
  timerElement.textContent = formatNumber(gameState.gameTime);

  gameState.timerId = setInterval(() => {
    gameState.gameTime++;
    timerElement.textContent = formatNumber(gameState.gameTime);
  }, 1000);
}

function stopTimer() {
  if (gameState.timerId !== null) {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
  }
}

function openCell(r, c) {
  if (gameState.status !== 'process') return;

  if (gameState.isFirstClick) {
    gameState.isFirstClick = false;
    board = generateField(gameState.rows, gameState.cols, gameState.minesCount, r, c);
    startTimer();
  }

  const cell = board[r][c];
  if (cell.state === 'opened' || cell.state === 'flagged') return;

  if (cell.type === 'mine') {
    cell.state = 'opened';
    cell.exploded = true;
    handleGameOver(false);
    return;
  }

  cell.state = 'opened';

  if (cell.neighborMines === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;

        if (
          nr >= 0 &&
          nr < gameState.rows &&
          nc >= 0 &&
          nc < gameState.cols
        ) {
          if (board[nr][nc].state === 'closed') {
            openCell(nr, nc);
          }
        }
      }
    }
  }

  if (gameState.status === 'process') {
    checkWinCondition();
  }
  
  renderBoard();
}

function toggleFlag(r, c) {
  if (gameState.status !== 'process') return;
  if (gameState.isFirstClick) return;

  const cell = board[r][c];
  if (cell.state === 'opened') return;

  if (cell.state === 'flagged') {
    cell.state = 'closed';
    gameState.flagsCount++;
  } else if (cell.state === 'closed') {
    if (gameState.flagsCount > 0) {
      cell.state = 'flagged';
      gameState.flagsCount--;
    }
  }

  flagsElement.textContent = formatNumber(gameState.flagsCount);
  renderBoard();
}

function checkWinCondition() {
  if (gameState.status !== 'process') return;

  let unopenedSafeCells = 0;

  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cell = board[r][c];
      if (cell.type !== 'mine' && cell.state !== 'opened') {
        unopenedSafeCells++;
      }
    }
  }

  if (unopenedSafeCells === 0) {
    handleGameOver(true);
  }
}

function handleGameOver(isWin) {
  if (gameState.status !== 'process') return;

  stopTimer();
  gameState.status = isWin ? 'win' : 'lose';

  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cell = board[r][c];
      if (cell.type === 'mine') {
        if (cell.state !== 'flagged') {
          cell.state = 'opened';
        }
      }
    }
  }

  startBtnElement.textContent = isWin ? '😎' : '😵';
  
  if (gameStatusElement) {
    gameStatusElement.textContent = isWin 
      ? 'Вітаємо! Ви виграли! 🎉' 
      : 'Гра закінчена! Ви підірвалися на міні. 💣';
  }

  renderBoard();
}

function renderBoard() {
  boardElement.innerHTML = '';

  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cellData = board[r][c];
      const button = document.createElement('button');
      button.type = 'button';
      button.classList.add('cell');

      if (cellData.state === 'opened') {
        button.classList.add('reveal');

        if (cellData.type === 'mine') {
          button.classList.add('mine');
          if (cellData.exploded) {
            button.classList.add('exploded');
          }
          button.textContent = '💣';
          button.setAttribute('aria-label', 'Mine');
        } else if (cellData.neighborMines > 0) {
          button.classList.add(`num-${cellData.neighborMines}`);
          button.textContent = cellData.neighborMines;
          button.setAttribute('aria-label', `Opened cell, ${cellData.neighborMines} mine(s) nearby`);
        } else {
          button.setAttribute('aria-label', 'Empty opened cell');
        }
      } else if (cellData.state === 'flagged') {
        button.classList.add('flag');
        button.textContent = '🚩';
        button.setAttribute('aria-label', 'Flag');
      } else {
        button.setAttribute('aria-label', 'Closed cell');
      }

      button.addEventListener('click', () => {
        openCell(r, c);
      });

      button.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        toggleFlag(r, c);
      });

      boardElement.appendChild(button);
    }
  }
}

function initEmptyBoard(rows, cols) {
  const emptyBoard = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push({
        type: 'empty',
        neighborMines: 0,
        state: 'closed'
      });
    }
    emptyBoard.push(row);
  }
  return emptyBoard;
}

function resetGame() {
  stopTimer();
  gameState.status = 'process';
  gameState.gameTime = 0;
  gameState.flagsCount = gameState.minesCount;
  gameState.isFirstClick = true;

  timerElement.textContent = formatNumber(0);
  flagsElement.textContent = formatNumber(gameState.flagsCount);
  startBtnElement.textContent = '🤓';

  if (gameStatusElement) {
    gameStatusElement.textContent = '';
  }

  board = initEmptyBoard(gameState.rows, gameState.cols);
  renderBoard();
}

startBtnElement.addEventListener('click', resetGame);
window.addEventListener('DOMContentLoaded', resetGame);