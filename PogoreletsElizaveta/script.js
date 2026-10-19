const GAME_STATUS = {
  PROCESS: 'process',
  WIN: 'win',
  LOSE: 'lose'
};

const CELL_STATE = {
  CLOSED: 'closed',
  OPENED: 'opened',
  FLAGGED: 'flagged'
};

const CELL_TYPE = {
  EMPTY: 'empty',
  MINE: 'mine'
};

const BOARD_ROWS = 6;
const BOARD_COLS = 6;
const MINES_COUNT = 6;
const TIMER_INTERVAL_MS = 1000;

const gameState = {
  rows: BOARD_ROWS,
  cols: BOARD_COLS,
  minesCount: MINES_COUNT,
  status: GAME_STATUS.PROCESS,
  gameTime: 0,
  timerId: null,
  flagsCount: MINES_COUNT,
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

function countNeighbourMines(boardGrid, totalRows, totalCols) {
  for (let row = 0; row < totalRows; row++) {
    for (let col = 0; col < totalCols; col++) {
      if (boardGrid[row][col].type === CELL_TYPE.MINE) continue;

      let count = 0;
      for (let deltaRow = -1; deltaRow <= 1; deltaRow++) {
        for (let deltaCol = -1; deltaCol <= 1; deltaCol++) {
          if (deltaRow === 0 && deltaCol === 0) continue;
          const neighborRow = row + deltaRow;
          const neighborCol = col + deltaCol;

          if (
            neighborRow >= 0 &&
            neighborRow < totalRows &&
            neighborCol >= 0 &&
            neighborCol < totalCols &&
            boardGrid[neighborRow][neighborCol].type === CELL_TYPE.MINE
          ) {
            count++;
          }
        }
      }
      boardGrid[row][col].neighborMines = count;
    }
  }
}

function generateField(rows, cols, minesCount, safeRow, safeCol) {
  const newBoard = [];

  for (let row = 0; row < rows; row++) {
    const rowCells = [];
    for (let col = 0; col < cols; col++) {
      const existingCell = board[row] && board[row][col] ? board[row][col] : null;
      rowCells.push({
        type: CELL_TYPE.EMPTY,
        neighborMines: 0,
        state: existingCell ? existingCell.state : CELL_STATE.CLOSED
      });
    }
    newBoard.push(rowCells);
  }

  let placedMines = 0;
  while (placedMines < minesCount) {
    const row = Math.floor(Math.random() * rows);
    const col = Math.floor(Math.random() * cols);

    const isNearSafeSpot = Math.abs(row - safeRow) <= 1 && Math.abs(col - safeCol) <= 1;

    if (!isNearSafeSpot && newBoard[row][col].type !== CELL_TYPE.MINE) {
      newBoard[row][col].type = CELL_TYPE.MINE;
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
  }, TIMER_INTERVAL_MS);
}

function stopTimer() {
  if (gameState.timerId !== null) {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
  }
}

function openCell(row, col) {
  if (gameState.status !== GAME_STATUS.PROCESS) return;

  const targetCell = board[row][col];
  if (targetCell.state === CELL_STATE.FLAGGED || targetCell.state === CELL_STATE.OPENED) return;

  if (gameState.isFirstClick) {
    gameState.isFirstClick = false;
    board = generateField(gameState.rows, gameState.cols, gameState.minesCount, row, col);
    startTimer();
  }

  const cell = board[row][col];

  if (cell.type === CELL_TYPE.MINE) {
    cell.state = CELL_STATE.OPENED;
    cell.exploded = true;
    handleGameOver(false);
    return;
  }

  cell.state = CELL_STATE.OPENED;

  if (cell.neighborMines === 0) {
    for (let deltaRow = -1; deltaRow <= 1; deltaRow++) {
      for (let deltaCol = -1; deltaCol <= 1; deltaCol++) {
        if (deltaRow === 0 && deltaCol === 0) continue;
        const neighborRow = row + deltaRow;
        const neighborCol = col + deltaCol;

        if (
          neighborRow >= 0 &&
          neighborRow < gameState.rows &&
          neighborCol >= 0 &&
          neighborCol < gameState.cols
        ) {
          if (board[neighborRow][neighborCol].state === CELL_STATE.CLOSED) {
            openCell(neighborRow, neighborCol);
          }
        }
      }
    }
  }

  if (gameState.status === GAME_STATUS.PROCESS) {
    checkWinCondition();
  }
  
  renderBoard();
}

function toggleFlag(row, col) {
  if (gameState.status !== GAME_STATUS.PROCESS) return;

  const cell = board[row][col];
  if (cell.state === CELL_STATE.OPENED) return;

  if (cell.state === CELL_STATE.FLAGGED) {
    cell.state = CELL_STATE.CLOSED;
    gameState.flagsCount++;
  } else if (cell.state === CELL_STATE.CLOSED) {
    if (gameState.flagsCount > 0) {
      cell.state = CELL_STATE.FLAGGED;
      gameState.flagsCount--;
    }
  }

  flagsElement.textContent = formatNumber(gameState.flagsCount);
  renderBoard();
}

function checkWinCondition() {
  if (gameState.status !== GAME_STATUS.PROCESS) return;

  let unopenedSafeCells = 0;

  for (let row = 0; row < gameState.rows; row++) {
    for (let col = 0; col < gameState.cols; col++) {
      const cell = board[row][col];
      if (cell.type !== CELL_TYPE.MINE && cell.state !== CELL_STATE.OPENED) {
        unopenedSafeCells++;
      }
    }
  }

  if (unopenedSafeCells === 0) {
    handleGameOver(true);
  }
}

function handleGameOver(isWin) {
  if (gameState.status !== GAME_STATUS.PROCESS) return;

  stopTimer();
  gameState.status = isWin ? GAME_STATUS.WIN : GAME_STATUS.LOSE;

  for (let row = 0; row < gameState.rows; row++) {
    for (let col = 0; col < gameState.cols; col++) {
      const cell = board[row][col];
      if (cell.type === CELL_TYPE.MINE) {
        if (cell.state !== CELL_STATE.FLAGGED) {
          cell.state = CELL_STATE.OPENED;
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

  for (let row = 0; row < gameState.rows; row++) {
    for (let col = 0; col < gameState.cols; col++) {
      const cellData = board[row][col];
      const button = document.createElement('button');
      button.type = 'button';
      button.classList.add('cell');

      if (cellData.state === CELL_STATE.OPENED) {
        button.classList.add('reveal');

        if (cellData.type === CELL_TYPE.MINE) {
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
      } else if (cellData.state === CELL_STATE.FLAGGED) {
        button.classList.add('flag');
        button.textContent = '🚩';
        button.setAttribute('aria-label', 'Flag');
      } else {
        button.setAttribute('aria-label', 'Closed cell');
      }

      button.addEventListener('click', () => {
        openCell(row, col);
      });

      button.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        toggleFlag(row, col);
      });

      boardElement.appendChild(button);
    }
  }
}

function initEmptyBoard(rows, cols) {
  const emptyBoard = [];
  for (let row = 0; row < rows; row++) {
    const rowCells = [];
    for (let col = 0; col < cols; col++) {
      rowCells.push({
        type: CELL_TYPE.EMPTY,
        neighborMines: 0,
        state: CELL_STATE.CLOSED
      });
    }
    emptyBoard.push(rowCells);
  }
  return emptyBoard;
}

function resetGame() {
  stopTimer();
  gameState.status = GAME_STATUS.PROCESS;
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