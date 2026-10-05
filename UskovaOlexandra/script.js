/**
 * Enum for game state constants.
 * @readonly
 * @enum {string}
 */
const GAME_STATUS = {
  PROCESS: 'process',
  WIN: 'win',
  LOSE: 'lose',
};

/**
 * Enum for cell state constants.
 * @readonly
 * @enum {string}
 */
const CELL_STATE = {
  CLOSED: 'closed',
  OPENED: 'opened',
  FLAGGED: 'flagged',
};

/**
 * Enum for cell type constants.
 * @readonly
 * @enum {string}
 */
const CELL_TYPE = {
  EMPTY: 'empty',
  MINE: 'mine',
};

/**
 * Global game state settings and variables.
 */
const gameState = {
  rows: 10,
  cols: 10,
  minesCount: 15,
  status: GAME_STATUS.PROCESS,
  gameTime: 0,
  timerId: null,
  flagsLeft: 15,
  explodedMine: null,
  isFirstClick: true,
};

/**
 * Top-level 2D array representing the Minesweeper board.
 * @type {Array<Array<Object>>}
 */
let board = [];

const boardElement = document.getElementById('board');
const timerElement = document.getElementById('timer');
const flagsElement = document.getElementById('flags-count');
const restartButton = document.getElementById('restart-btn');
const gameMessage = document.getElementById('game-message');

document.documentElement.style.setProperty('--board-columns', gameState.cols);

/**
 * Generates the game board and places mines, ensuring the first click is safe.
 * @param {number} rows - Number of rows on the board.
 * @param {number} cols - Number of columns on the board.
 * @param {number} minesCount - Total number of mines to place.
 * @param {number} [safeRow=-1] - Row index of the initial safe click.
 * @param {number} [safeCol=-1] - Column index of the initial safe click.
 * @returns {Array<Array<Object>>} The newly generated board matrix.
 */
function generateField(rows, cols, minesCount, safeRow = -1, safeCol = -1) {
  const newBoard = [];
  for (let row = 0; row < rows; row++) {
    const boardRow = [];
    for (let col = 0; col < cols; col++) {
      boardRow.push({
        type: CELL_TYPE.EMPTY,
        state: CELL_STATE.CLOSED,
        neighborMines: 0,
        isWrongFlag: false,
      });
    }
    newBoard.push(boardRow);
  }

  let plantedMines = 0;
  while (plantedMines < minesCount) {
    const randomRow = Math.floor(Math.random() * rows);
    const randomCol = Math.floor(Math.random() * cols);

    if (randomRow === safeRow && randomCol === safeCol) continue;

    if (newBoard[randomRow][randomCol].type !== CELL_TYPE.MINE) {
      newBoard[randomRow][randomCol].type = CELL_TYPE.MINE;
      plantedMines++;
    }
  }

  return newBoard;
}

/**
 * Calculates and updates the number of adjacent mines for each empty cell.
 */
function countNeighbourMines() {
  const { rows, cols } = gameState;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (board[row][col].type === CELL_TYPE.MINE) continue;

      let count = 0;
      for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
        for (let colOffset = -1; colOffset <= 1; colOffset++) {
          if (rowOffset === 0 && colOffset === 0) continue;
          const neighborRow = row + rowOffset;
          const neighborCol = col + colOffset;

          if (neighborRow >= 0 && neighborRow < rows && neighborCol >= 0 && neighborCol < cols) {
            if (board[neighborRow][neighborCol].type === CELL_TYPE.MINE) {
              count++;
            }
          }
        }
      }
      board[row][col].neighborMines = count;
    }
  }
}

/**
 * Handles the logic when a cell is clicked, including first-click safety,
 * revealing empty areas recursively, and checking for win/loss states.
 * @param {number} row - The row index of the clicked cell.
 * @param {number} col - The column index of the clicked cell.
 */
function openCell(row, col) {
  const { rows, cols, status } = gameState;

  if (status !== GAME_STATUS.PROCESS) return;
  if (row < 0 || row >= rows || col < 0 || col >= cols) return;

  const cell = board[row][col];
  if (cell.state === CELL_STATE.OPENED || cell.state === CELL_STATE.FLAGGED) return;

  if (gameState.isFirstClick) {
    gameState.isFirstClick = false;
    board = generateField(rows, cols, gameState.minesCount, row, col);
    countNeighbourMines();
    startTimer();
  } else if (!gameState.timerId && gameState.gameTime === 0) {
    startTimer();
  }

  const currentCell = board[row][col];

  if (currentCell.type === CELL_TYPE.MINE) {
    currentCell.state = CELL_STATE.OPENED;
    gameState.explodedMine = { row, col };
    endGame(GAME_STATUS.LOSE);
    return;
  }

  currentCell.state = CELL_STATE.OPENED;

  if (currentCell.neighborMines === 0) {
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      for (let colOffset = -1; colOffset <= 1; colOffset++) {
        if (rowOffset !== 0 || colOffset !== 0) {
          openCell(row + rowOffset, col + colOffset);
        }
      }
    }
  }

  checkWinCondition();
}

/**
 * Toggles a flag marker on the specified cell.
 * @param {number} row - The row index of the cell.
 * @param {number} col - The column index of the cell.
 */
function toggleFlag(row, col) {
  if (gameState.status !== GAME_STATUS.PROCESS || gameState.isFirstClick) return;

  const cell = board[row][col];
  if (cell.state === CELL_STATE.OPENED) return;

  if (cell.state === CELL_STATE.CLOSED) {
    if (gameState.flagsLeft <= 0) return;
    cell.state = CELL_STATE.FLAGGED;
    gameState.flagsLeft--;
  } else if (cell.state === CELL_STATE.FLAGGED) {
    cell.state = CELL_STATE.CLOSED;
    gameState.flagsLeft++;
  }

  updateUI();
  renderBoard();
}

/**
 * Initializes and starts the game timer.
 */
function startTimer() {
  if (gameState.timerId) return;
  gameState.timerId = setInterval(() => {
    gameState.gameTime++;
    updateTimerDisplay();
  }, 1000);
}

/**
 * Stops the game timer if it is currently running.
 */
function stopTimer() {
  if (gameState.timerId) {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
  }
}

/**
 * Updates the timer display element on the UI with formatted minutes and seconds.
 */
function updateTimerDisplay() {
  const minutes = String(Math.floor(gameState.gameTime / 60)).padStart(2, '0');
  const seconds = String(gameState.gameTime % 60).padStart(2, '0');
  timerElement.textContent = `${minutes}:${seconds}`;
}

/**
 * Renders the entire Minesweeper board to the DOM based on the current state.
 */
function renderBoard() {
  boardElement.innerHTML = '';

  for (let row = 0; row < gameState.rows; row++) {
    for (let col = 0; col < gameState.cols; col++) {
      const cellData = board[row][col];
      const cellButton = document.createElement('button');
      cellButton.type = 'button';
      cellButton.classList.add('cell');
      cellButton.dataset.row = row;
      cellButton.dataset.col = col;

      let ariaText = `Row ${row + 1}, column ${col + 1}`;

      if (cellData.state === CELL_STATE.OPENED) {
        cellButton.classList.add('open');

        if (cellData.type === CELL_TYPE.MINE) {
          if (
            gameState.explodedMine &&
            gameState.explodedMine.row === row &&
            gameState.explodedMine.col === col
          ) {
            cellButton.classList.add('exploded');
            cellButton.textContent = '💥';
            ariaText += ', exploded mine';
          } else {
            cellButton.classList.add('mine');
            cellButton.textContent = '💣';
            ariaText += ', mine';
          }
        } else if (cellData.neighborMines > 0) {
          cellButton.dataset.value = cellData.neighborMines;
          cellButton.textContent = cellData.neighborMines;
          ariaText += `, open, neighbor mines: ${cellData.neighborMines}`;
        } else {
          ariaText += ', open, empty';
        }
      } else if (cellData.state === CELL_STATE.FLAGGED) {
        cellButton.classList.add('flagged');
        if (cellData.isWrongFlag) {
          cellButton.textContent = '❌';
          cellButton.classList.add('wrong-flag');
        } else {
          cellButton.textContent = '🚩';
        }
        ariaText += ', flagged';
      } else {
        ariaText += ', closed';
      }

      cellButton.setAttribute('aria-label', ariaText);
      boardElement.appendChild(cellButton);
    }
  }
}

/**
 * Updates interface counters and displays victory or defeat messages.
 */
function updateUI() {
  flagsElement.textContent = gameState.flagsLeft;

  if (gameState.status === GAME_STATUS.WIN) {
    gameMessage.textContent = 'Victory!';
    gameMessage.className = 'status-message win';
  } else if (gameState.status === GAME_STATUS.LOSE) {
    gameMessage.textContent = 'Game over.';
    gameMessage.className = 'status-message lose';
  } else {
    gameMessage.textContent = '';
    gameMessage.className = 'status-message';
  }
}

// Event listener for opening cells with a left click
boardElement.addEventListener('click', (event) => {
  const target = event.target.closest('.cell');
  if (!target || gameState.status !== GAME_STATUS.PROCESS) return;

  const row = parseInt(target.dataset.row, 10);
  const col = parseInt(target.dataset.col, 10);

  openCell(row, col);
  renderBoard();
  updateUI();
});

// Event listener for placing flags with a right click
boardElement.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  const target = event.target.closest('.cell');
  if (!target || gameState.status !== GAME_STATUS.PROCESS) return;

  const row = parseInt(target.dataset.row, 10);
  const col = parseInt(target.dataset.col, 10);

  toggleFlag(row, col);
});

// Event listener for resetting the game
restartButton.addEventListener('click', initGame);

/**
 * Validates whether the player has opened all non-mine cells to declare a win.
 */
function checkWinCondition() {
  const { rows, cols, minesCount } = gameState;
  let openedCells = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (board[row][col].state === CELL_STATE.OPENED && board[row][col].type !== CELL_TYPE.MINE) {
        openedCells++;
      }
    }
  }

  if (openedCells === rows * cols - minesCount) {
    endGame(GAME_STATUS.WIN);
  }
}

/**
 * Finalizes the game logic upon a win or loss event.
 * @param {string} status - The ending status ('win' or 'lose').
 */
function endGame(status) {
  gameState.status = status;
  stopTimer();

  const { rows, cols } = gameState;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = board[row][col];

      if (status === GAME_STATUS.LOSE) {
        if (cell.type === CELL_TYPE.MINE && cell.state !== CELL_STATE.FLAGGED) {
          cell.state = CELL_STATE.OPENED;
        }
        if (cell.type !== CELL_TYPE.MINE && cell.state === CELL_STATE.FLAGGED) {
          cell.isWrongFlag = true;
        }
      } else if (status === GAME_STATUS.WIN) {
        if (cell.type === CELL_TYPE.MINE) {
          cell.state = CELL_STATE.FLAGGED;
        }
      }
    }
  }

  if (status === GAME_STATUS.WIN) {
    gameState.flagsLeft = 0;
  }

  renderBoard();
  updateUI();
}

/**
 * Resets variables and states to initialize a fresh game round.
 */
function initGame() {
  stopTimer();
  gameState.status = GAME_STATUS.PROCESS;
  gameState.gameTime = 0;
  gameState.flagsLeft = gameState.minesCount;
  gameState.explodedMine = null;
  gameState.isFirstClick = true;

  updateTimerDisplay();

  board = generateField(
    gameState.rows,
    gameState.cols,
    0
  );

  renderBoard();
  updateUI();
}

// Bootstrap the initial game render on load
initGame();