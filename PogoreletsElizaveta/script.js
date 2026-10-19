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

/**
 * Formats a number for display as a zero-padded 3-digit string.
 * Negative values are clamped to 0.
 * @param {number} num - The number to format.
 * @returns {string} The zero-padded string representation of the number.
 */
function formatNumber(num) {
  return String(Math.max(0, num)).padStart(3, '0');
}

/**
 * Calculates and stores the number of neighboring mines for each non-mine cell in the grid.
 * Mutates the provided board grid in place, setting the `neighborMines` property for each cell.
 * @param {Array<Array<Object>>} boardGrid - The 2D grid of cell objects to analyze.
 * @param {number} totalRows - The total number of rows in the grid.
 * @param {number} totalCols - The total number of columns in the grid.
 * @returns {void}
 */
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

/**
 * Generates a new game board with randomly placed mines, avoiding the safe spot and its neighbors.
 * Preserves the existing cell state (e.g. flagged cells) from the current board where available.
 * @param {number} rows - The number of rows in the board.
 * @param {number} cols - The number of columns in the board.
 * @param {number} minesCount - The number of mines to place on the board.
 * @param {number} safeRow - The row index of the cell that must remain mine-free.
 * @param {number} safeCol - The column index of the cell that must remain mine-free.
 * @returns {Array<Array<Object>>} The newly generated board grid.
 */
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

/**
 * Starts (or restarts) the game timer, resetting the elapsed time to zero and
 * updating the timer display every second.
 * @returns {void}
 */
function startTimer() {
  stopTimer();
  gameState.gameTime = 0;
  timerElement.textContent = formatNumber(gameState.gameTime);

  gameState.timerId = setInterval(() => {
    gameState.gameTime++;
    timerElement.textContent = formatNumber(gameState.gameTime);
  }, TIMER_INTERVAL_MS);
}

/**
 * Stops the running game timer, if any, and clears the stored interval id.
 * @returns {void}
 */
function stopTimer() {
  if (gameState.timerId !== null) {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
  }
}

/**
 * Opens the cell at the given position, generating the board on first click,
 * triggering game over on a mine, or recursively opening neighboring cells
 * when the opened cell has no adjacent mines. Also checks for a win condition
 * and re-renders the board.
 * @param {number} row - The row index of the cell to open.
 * @param {number} col - The column index of the cell to open.
 * @returns {void}
 */
function openCell(row, col) {
  if (gameState.status !== GAME_STATUS.PROCESS) return;

  if (gameState.isFirstClick) {
    gameState.isFirstClick = false;
    board = generateField(gameState.rows, gameState.cols, gameState.minesCount, row, col);
    startTimer();
  }

  const cell = board[row][col];
  if (cell.state === CELL_STATE.OPENED || cell.state === CELL_STATE.FLAGGED) return;

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

/**
 * Toggles the flagged state of the cell at the given position, updating the
 * remaining flags count and re-rendering the board. Has no effect on opened cells.
 * @param {number} row - The row index of the cell to flag/unflag.
 * @param {number} col - The column index of the cell to flag/unflag.
 * @returns {void}
 */
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

/**
 * Checks whether all non-mine cells have been opened and, if so, triggers a win.
 * @returns {void}
 */
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

/**
 * Ends the current game, stopping the timer, revealing all mines, updating the
 * start button and status message, and re-rendering the board.
 * @param {boolean} isWin - Whether the game ended in a win (true) or a loss (false).
 * @returns {void}
 */
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

/**
 * Renders the entire game board by rebuilding the cell buttons in the DOM
 * based on the current board state, and attaches click/flag event listeners.
 * @returns {void}
 */
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

/**
 * Creates a fresh board grid with no mines, where every cell is empty and closed.
 * @param {number} rows - The number of rows in the board.
 * @param {number} cols - The number of columns in the board.
 * @returns {Array<Array<Object>>} The newly created empty board grid.
 */
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


/**
 * Resets the game to its initial state: stops the timer, resets counters and
 * status, clears the status message, rebuilds an empty board, and re-renders it.
 * @returns {void}
 */
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