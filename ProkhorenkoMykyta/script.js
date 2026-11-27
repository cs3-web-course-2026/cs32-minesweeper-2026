'use strict';

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

const DEFAULT_ROWS = 10;
const DEFAULT_COLS = 10;
const DEFAULT_MINES_COUNT = 15;
const TIMER_INTERVAL_MS = 1000;
const COUNTER_DIGITS = 3;

const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

const CELL_CLASS = {
  BASE: 'cell',
  OPENED: 'cell-open',
  FLAGGED: 'cell-flagged',
  WRONG_FLAG: 'cell-flag-wrong',
  MINE: 'cell-mine',
  EXPLODED: 'cell-mine-exploded',
  NUMBER_PREFIX: 'cell-number-',
};

const CELL_ICON = {
  FLAG: '🚩',
  MINE: '💣',
};

const BOARD_FINISHED_CLASS = 'board-finished';

const MESSAGE_CLASS = {
  [GAME_STATUS.WIN]: 'game-message-win',
  [GAME_STATUS.LOSE]: 'game-message-lose',
};

const gameState = {
  rows: DEFAULT_ROWS,
  cols: DEFAULT_COLS,
  minesCount: DEFAULT_MINES_COUNT,
  status: GAME_STATUS.PROCESS,
  gameTime: 0,
  timerId: null,
};

let board = []; // 2D array of { type, state, neighborMines } cell objects

const boardElement = document.getElementById('board');
const flagsCounterElement = document.getElementById('flags-counter');
const timerElement = document.getElementById('timer');
const newGameButton = document.getElementById('new-game-button');
const gameMessageElement = document.getElementById('game-message');


// ---------- Helper functions ----------

function createEmptyCell() {
  return {
    type: CELL_TYPE.EMPTY,
    state: CELL_STATE.CLOSED,
    neighborMines: 0,
  };
}


function getRandomIndex(length) {
  return Math.floor(Math.random() * length);
}


function isInBounds(field, row, col) {
  return row >= 0 && row < field.length && col >= 0 && col < field[0].length;
}


function getNeighbourPositions(field, row, col) {
  const neighbourPositions = [];

  for (const [directionalRow, directionalCol] of DIRECTIONS) {
    const neighbourRow = row + directionalRow;
    const neighbourCol = col + directionalCol;

    if (isInBounds(field, neighbourRow, neighbourCol)) {
      neighbourPositions.push({ row: neighbourRow, col: neighbourCol });
    }
  }

  return neighbourPositions;
}


function countCellsInState(field, cellState) {
  let cellsCount = 0;

  for (const fieldRow of field) {
    for (const cell of fieldRow) {
      if (cell.state === cellState) {
        cellsCount++;
      }
    }
  }

  return cellsCount;
}


function formatCounter(value) {
  return String(Math.max(value, 0)).padStart(COUNTER_DIGITS, '0');
}


function getMinesWord(count) {
  if (count === 1) {
    return 'міна';
  }

  if (count >= 2 && count <= 4) {
    return 'міни';
  }

  return 'мін';
}


// ---------- Core game logic ----------

function generateField(rows, cols, minesCount) {
  const field = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, createEmptyCell),
  );
  const minesToPlace = Math.min(minesCount, rows * cols - 1);
  let placedMines = 0;

  while (placedMines < minesToPlace) {
    const row = getRandomIndex(rows);
    const col = getRandomIndex(cols);

    if (field[row][col].type !== CELL_TYPE.MINE) {
      field[row][col].type = CELL_TYPE.MINE;
      placedMines++;
    }
  }

  countNeighbourMines(field);

  return field;
}


function countNeighbourMines(field) {
  field.forEach((fieldRow, row) => {
    fieldRow.forEach((cell, col) => {
      if (cell.type !== CELL_TYPE.EMPTY) {
        return;
      }

      cell.neighborMines = getNeighbourPositions(field, row, col).filter(
        (position) => field[position.row][position.col].type === CELL_TYPE.MINE,
      ).length;
    });
  });
}


function revealArea(field, row, col) {
  const cell = field[row][col];

  if (cell.state !== CELL_STATE.CLOSED || cell.type === CELL_TYPE.MINE) {
    return;
  }

  cell.state = CELL_STATE.OPENED;

  if (cell.neighborMines > 0) {
    return;
  }

  for (const position of getNeighbourPositions(field, row, col)) {
    revealArea(field, position.row, position.col);
  }
}


function isWinCondition(field) {
  return field.every((fieldRow) =>
    fieldRow.every(
      (cell) =>
        cell.type === CELL_TYPE.MINE || cell.state === CELL_STATE.OPENED,
    ),
  );
}


function getFlagsLeft(field, minesCount) {
  return minesCount - countCellsInState(field, CELL_STATE.FLAGGED);
}


function startTimer(onTick) {
  if (gameState.timerId !== null) {
    return;
  }

  gameState.timerId = setInterval(() => {
    gameState.gameTime++;
    onTick();
  }, TIMER_INTERVAL_MS);
}


function stopTimer() {
  clearInterval(gameState.timerId);
  gameState.timerId = null;
}


function finishGame(status) {
  gameState.status = status;
  stopTimer();
}


function openCell(row, col) {
  if (gameState.status !== GAME_STATUS.PROCESS) {
    return;
  }

  const cell = board[row][col];

  if (cell.state !== CELL_STATE.CLOSED) {
    return;
  }

  if (cell.type === CELL_TYPE.MINE) {
    cell.state = CELL_STATE.OPENED;
    finishGame(GAME_STATUS.LOSE);

    return;
  }

  revealArea(board, row, col);

  if (isWinCondition(board)) {
    finishGame(GAME_STATUS.WIN);
  }
}


function toggleFlag(row, col) {
  if (gameState.status !== GAME_STATUS.PROCESS) {
    return;
  }

  const cell = board[row][col];

  if (cell.state === CELL_STATE.OPENED) {
    return;
  }

  if (cell.state === CELL_STATE.FLAGGED) {
    cell.state = CELL_STATE.CLOSED;

    return;
  }

  if (getFlagsLeft(board, gameState.minesCount) > 0) {
    cell.state = CELL_STATE.FLAGGED;
  }
}


function resetGame() {
  stopTimer();
  gameState.status = GAME_STATUS.PROCESS;
  gameState.gameTime = 0;
  board = generateField(gameState.rows, gameState.cols, gameState.minesCount);
}


// ---------- Rendering / DOM ----------

function getCellView(cell, isGameLost) {
  const isMine = cell.type === CELL_TYPE.MINE;

  if (cell.state === CELL_STATE.OPENED && isMine) {
    return {
      classNames: [CELL_CLASS.OPENED, CELL_CLASS.MINE, CELL_CLASS.EXPLODED],
      text: CELL_ICON.MINE,
      description: 'підірвана міна',
    };
  }

  if (cell.state === CELL_STATE.OPENED && cell.neighborMines > 0) {
    return {
      classNames: [
        CELL_CLASS.OPENED,
        `${CELL_CLASS.NUMBER_PREFIX}${cell.neighborMines}`,
      ],
      text: String(cell.neighborMines),
      description: `відкрита, ${cell.neighborMines} ${getMinesWord(cell.neighborMines)} поруч`,
    };
  }

  if (cell.state === CELL_STATE.OPENED) {
    return {
      classNames: [CELL_CLASS.OPENED],
      text: '',
      description: 'відкрита, порожня',
    };
  }

  if (isGameLost && isMine && cell.state === CELL_STATE.CLOSED) {
    return {
      classNames: [CELL_CLASS.OPENED, CELL_CLASS.MINE],
      text: CELL_ICON.MINE,
      description: 'міна',
    };
  }

  if (isGameLost && !isMine && cell.state === CELL_STATE.FLAGGED) {
    return {
      classNames: [CELL_CLASS.OPENED, CELL_CLASS.WRONG_FLAG],
      text: CELL_ICON.FLAG,
      description: 'помилковий прапорець',
    };
  }

  if (cell.state === CELL_STATE.FLAGGED) {
    return {
      classNames: [CELL_CLASS.FLAGGED],
      text: CELL_ICON.FLAG,
      description: 'прапорець',
    };
  }

  return {
    classNames: [],
    text: '',
    description: 'закрита',
  };
}


function createCellButton(row, col) {
  const button = document.createElement('button');

  button.type = 'button';
  button.dataset.row = String(row);
  button.dataset.col = String(col);

  return button;
}


function renderBoard() {
  const cellButtons = [];

  for (let row = 0; row < gameState.rows; row++) {
    for (let col = 0; col < gameState.cols; col++) {
      cellButtons.push(createCellButton(row, col));
    }
  }

  document.documentElement.style.setProperty(
    '--board-columns',
    String(gameState.cols),
  );
  boardElement.setAttribute(
    'aria-label',
    `Ігрове поле ${gameState.rows} на ${gameState.cols}`,
  );
  boardElement.replaceChildren(...cellButtons);
}


function updateCellButton(button, cell, row, col) {
  const isGameLost = gameState.status === GAME_STATUS.LOSE;
  const cellView = getCellView(cell, isGameLost);

  button.className = [CELL_CLASS.BASE, ...cellView.classNames].join(' ');
  button.textContent = cellView.text;
  button.setAttribute(
    'aria-label',
    `Рядок ${row + 1}, стовпець ${col + 1}, ${cellView.description}`,
  );
}


function updateBoard() {
  const cellButtons = boardElement.children;

  board.forEach((fieldRow, row) => {
    fieldRow.forEach((cell, col) => {
      updateCellButton(cellButtons[row * gameState.cols + col], cell, row, col);
    });
  });

  boardElement.classList.toggle(
    BOARD_FINISHED_CLASS,
    gameState.status !== GAME_STATUS.PROCESS,
  );
}


function renderTimer() {
  timerElement.textContent = formatCounter(gameState.gameTime);
}


function renderFlagsCounter() {
  flagsCounterElement.textContent = formatCounter(
    getFlagsLeft(board, gameState.minesCount),
  );
}


function getGameMessage() {
  if (gameState.status === GAME_STATUS.WIN) {
    return `Перемога! Усі безпечні клітинки відкрито за ${gameState.gameTime} с.`;
  }

  if (gameState.status === GAME_STATUS.LOSE) {
    return 'Ви натрапили на міну! Натисніть «Нова гра», щоб спробувати ще раз.';
  }

  return 'Ліва кнопка — відкрити клітинку, права — поставити прапорець.';
}


function renderGameMessage() {
  gameMessageElement.textContent = getGameMessage();
  gameMessageElement.classList.remove(...Object.values(MESSAGE_CLASS));

  if (MESSAGE_CLASS[gameState.status]) {
    gameMessageElement.classList.add(MESSAGE_CLASS[gameState.status]);
  }
}


function renderGame() {
  updateBoard();
  renderFlagsCounter();
  renderTimer();
  renderGameMessage();
}


// ---------- Event handlers ----------

function getCellPosition(event) {
  const button = event.target.closest(`.${CELL_CLASS.BASE}`);

  if (!button) {
    return null;
  }

  return {
    row: Number(button.dataset.row),
    col: Number(button.dataset.col),
  };
}


function ensureTimerStarted() {
  if (gameState.status === GAME_STATUS.PROCESS) {
    startTimer(renderTimer);
  }
}


function handleBoardClick(event) {
  const position = getCellPosition(event);

  if (!position) {
    return;
  }

  ensureTimerStarted();
  openCell(position.row, position.col);
  renderGame();
}


function handleBoardContextMenu(event) {
  event.preventDefault();

  const position = getCellPosition(event);

  if (!position) {
    return;
  }

  ensureTimerStarted();
  toggleFlag(position.row, position.col);
  renderGame();
}


function startNewGame() {
  resetGame();
  renderBoard();
  renderGame();
}


boardElement.addEventListener('click', handleBoardClick);
boardElement.addEventListener('contextmenu', handleBoardContextMenu);
newGameButton.addEventListener('click', startNewGame);

startNewGame();
