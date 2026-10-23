const CELL_TYPE = {
  EMPTY: 'empty',
  MINE: 'mine',
};

const CELL_STATE = {
  CLOSED: 'closed',
  OPENED: 'opened',
  FLAGGED: 'flagged',
};

const GAME_STATUS = {
  PROCESS: 'process',
  WIN: 'win',
  LOSE: 'lose',
};

const gameState = {
  rows: 10,
  cols: 10,
  minesCount: 15,
  status: GAME_STATUS.PROCESS,
  gameTime: 0,
  timerId: null,
};

let board = [];

const boardElement = document.getElementById('game-board');
const timerElement = document.getElementById('timer');
const flagCountElement = document.getElementById('flag-count');
const restartBtn = document.getElementById('restart-btn');
const statusElement = document.getElementById('game-status');

function formatCounter(value) {
  const clamped = Math.max(0, Math.min(999, value));
  return String(clamped).padStart(3, '0');
}

function stopTimer() {
  if (gameState.timerId !== null) {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
  }
}

function startTimer() {
  stopTimer();
  gameState.timerId = setInterval(() => {
    if (gameState.status !== GAME_STATUS.PROCESS) {
      stopTimer();
      return;
    }
    gameState.gameTime += 1;
    timerElement.textContent = formatCounter(gameState.gameTime);
  }, 1000);
}

function generateField(rows, cols, minesCount) {
  const field = [];

  for (let r = 0; r < rows; r += 1) {
    const row = [];
    for (let c = 0; c < cols; c += 1) {
      row.push({
        type: CELL_TYPE.EMPTY,
        neighborMines: 0,
        state: CELL_STATE.CLOSED,
        exploded: false,
      });
    }
    field.push(row);
  }

  let placedMines = 0;
  const maxMines = Math.min(minesCount, rows * cols);

  while (placedMines < maxMines) {
    const randomRow = Math.floor(Math.random() * rows);
    const randomCol = Math.floor(Math.random() * cols);

    if (field[randomRow][randomCol].type !== CELL_TYPE.MINE) {
      field[randomRow][randomCol].type = CELL_TYPE.MINE;
      placedMines += 1;
    }
  }

  return field;
}

function isValidCell(row, col, rows, cols) {
  return row >= 0 && row < rows && col >= 0 && col < cols;
}

function countNeighbourMines(field) {
  const rows = field.length;
  const cols = rows > 0 ? field[0].length : 0;

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (field[r][c].type === CELL_TYPE.EMPTY) {
        let mines = 0;

        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            if (dr !== 0 || dc !== 0) {
              const nr = r + dr;
              const nc = c + dc;
              if (
                isValidCell(nr, nc, rows, cols) &&
                field[nr][nc].type === CELL_TYPE.MINE
              ) {
                mines += 1;
              }
            }
          }
        }

        field[r][c].neighborMines = mines;
      }
    }
  }
}

function revealAllMines() {
  for (let r = 0; r < gameState.rows; r += 1) {
    for (let c = 0; c < gameState.cols; c += 1) {
      const cell = board[r][c];
      if (cell.type === CELL_TYPE.MINE && cell.state !== CELL_STATE.FLAGGED) {
        cell.state = CELL_STATE.OPENED;
      }
    }
  }
}

function checkWinCondition() {
  if (gameState.status !== GAME_STATUS.PROCESS) {
    return;
  }

  let openedSafeCells = 0;
  const totalSafeCells =
    gameState.rows * gameState.cols - gameState.minesCount;

  for (let r = 0; r < gameState.rows; r += 1) {
    for (let c = 0; c < gameState.cols; c += 1) {
      const cell = board[r][c];
      if (
        cell.type === CELL_TYPE.EMPTY &&
        cell.state === CELL_STATE.OPENED
      ) {
        openedSafeCells += 1;
      }
    }
  }

  if (openedSafeCells === totalSafeCells) {
    gameState.status = GAME_STATUS.WIN;
    stopTimer();
  }
}

function openCell(row, col) {
  if (
    gameState.status !== GAME_STATUS.PROCESS ||
    !isValidCell(row, col, gameState.rows, gameState.cols)
  ) {
    return;
  }

  const cell = board[row][col];

  if (
    cell.state === CELL_STATE.OPENED ||
    cell.state === CELL_STATE.FLAGGED
  ) {
    return;
  }

  cell.state = CELL_STATE.OPENED;

  if (cell.type === CELL_TYPE.MINE) {
    cell.exploded = true;
    gameState.status = GAME_STATUS.LOSE;
    stopTimer();
    revealAllMines();
    return;
  }

  if (cell.neighborMines === 0) {
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr !== 0 || dc !== 0) {
          openCell(row + dr, col + dc);
        }
      }
    }
  }

  checkWinCondition();
}

function countFlags() {
  let flags = 0;
  for (let r = 0; r < gameState.rows; r += 1) {
    for (let c = 0; c < gameState.cols; c += 1) {
      if (board[r][c].state === CELL_STATE.FLAGGED) {
        flags += 1;
      }
    }
  }
  return flags;
}

function toggleFlag(row, col) {
  if (
    gameState.status !== GAME_STATUS.PROCESS ||
    !isValidCell(row, col, gameState.rows, gameState.cols)
  ) {
    return;
  }

  const cell = board[row][col];

  if (cell.state === CELL_STATE.OPENED) {
    return;
  }

  if (cell.state === CELL_STATE.CLOSED) {
    if (countFlags() >= gameState.minesCount) {
      return;
    }
    cell.state = CELL_STATE.FLAGGED;
  } else if (cell.state === CELL_STATE.FLAGGED) {
    cell.state = CELL_STATE.CLOSED;
  }
}

function updateUIHeader() {
  const remainingFlags = gameState.minesCount - countFlags();
  flagCountElement.textContent = formatCounter(remainingFlags);
  timerElement.textContent = formatCounter(gameState.gameTime);

  statusElement.className = 'game-status';
  if (gameState.status === GAME_STATUS.WIN) {
    statusElement.textContent = 'Перемога! Усі безпечні клітинки відкрито!';
    statusElement.classList.add('status-win');
  } else if (gameState.status === GAME_STATUS.LOSE) {
    statusElement.textContent = 'Поразка! Ви натрапили на міну!';
    statusElement.classList.add('status-lose');
  } else {
    statusElement.textContent = 'Гра триває';
  }
}

function getCellAriaLabel(cell, row, col) {
  const position = `Рядок ${row + 1}, колонка ${col + 1}`;
  if (cell.state === CELL_STATE.FLAGGED) {
    if (
      gameState.status === GAME_STATUS.LOSE &&
      cell.type !== CELL_TYPE.MINE
    ) {
      return `${position}, хибний прапорець`;
    }
    return `${position}, прапорець`;
  }
  if (cell.state === CELL_STATE.CLOSED) {
    return `${position}, закрита клітинка`;
  }
  if (cell.type === CELL_TYPE.MINE) {
    return cell.exploded
      ? `${position}, міна, що вибухнула`
      : `${position}, відкрита міна`;
  }
  if (cell.neighborMines > 0) {
    return `${position}, відкрита клітинка, мін навколо: ${cell.neighborMines}`;
  }
  return `${position}, відкрита порожня клітинка`;
}

function renderBoard() {
  boardElement.innerHTML = '';
  boardElement.style.setProperty('--cols', String(gameState.cols));

  for (let r = 0; r < gameState.rows; r += 1) {
    for (let c = 0; c < gameState.cols; c += 1) {
      const cell = board[r][c];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cell';
      button.dataset.row = String(r);
      button.dataset.col = String(c);

      if (cell.state === CELL_STATE.OPENED) {
        button.classList.add('open');
        if (cell.type === CELL_TYPE.MINE) {
          button.classList.add('mine');
          if (cell.exploded) {
            button.classList.add('exploded');
          }
        } else if (cell.neighborMines > 0) {
          button.classList.add(`num-${cell.neighborMines}`);
          button.textContent = String(cell.neighborMines);
        }
      } else if (cell.state === CELL_STATE.FLAGGED) {
        if (
          gameState.status === GAME_STATUS.LOSE &&
          cell.type !== CELL_TYPE.MINE
        ) {
          button.classList.add('false-flag', 'mine');
        } else {
          button.classList.add('flag');
        }
      }

      button.setAttribute('aria-label', getCellAriaLabel(cell, r, c));
      boardElement.appendChild(button);
    }
  }

  updateUIHeader();
}

function initGame() {
  stopTimer();
  gameState.status = GAME_STATUS.PROCESS;
  gameState.gameTime = 0;
  board = generateField(
    gameState.rows,
    gameState.cols,
    gameState.minesCount,
  );
  countNeighbourMines(board);
  renderBoard();
  startTimer();
}

boardElement.addEventListener('click', (event) => {
  const target = event.target.closest('.cell');
  if (!target) {
    return;
  }
  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);
  openCell(row, col);
  renderBoard();
});

boardElement.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  const target = event.target.closest('.cell');
  if (!target) {
    return;
  }
  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);
  toggleFlag(row, col);
  renderBoard();
});

restartBtn.addEventListener('click', () => {
  initGame();
});

initGame();