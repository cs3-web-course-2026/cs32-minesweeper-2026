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

const START_BUTTON_FACE = {
  [GAME_STATUS.PROCESS]: '😈',
  [GAME_STATUS.WIN]: '😎',
  [GAME_STATUS.LOSE]: '😵',
};

const GAME_MESSAGE = {
  [GAME_STATUS.PROCESS]: 'Right-click or press F to place a flag.',
  [GAME_STATUS.WIN]: 'You win! Press 😎 to play again.',
  [GAME_STATUS.LOSE]: 'Game over — press 😵 to play again.',
};

const TIMER_INTERVAL_MS = 1000;
const SECONDS_PER_MINUTE = 60;
const FLAG_KEY = 'f';

const gameState = {
  rows: 10,
  cols: 10,
  minesCount: 15,
  status: GAME_STATUS.PROCESS,
  gameTime: 0,
  timerId: null,
};

let board = [];

const boardElement = document.getElementById('board');
const flagCounterElement = document.getElementById('flag-counter');
const timerElement = document.getElementById('timer');
const startButton = document.getElementById('start-button');
const gameMessageElement = document.getElementById('game-message');


/* Helpers */

function createCell() {
  return {
    type: CELL_TYPE.EMPTY,
    state: CELL_STATE.CLOSED,
    neighborMines: 0,
  };
}


function isInBounds(field, row, col) {
  return row >= 0 && row < field.length && col >= 0 && col < field[0].length;
}


function getNeighbourPositions(field, row, col) {
  return DIRECTIONS.map(([directionalRow, directionalCol]) => [
    row + directionalRow,
    col + directionalCol,
  ]).filter(([neighbourRow, neighbourCol]) =>
    isInBounds(field, neighbourRow, neighbourCol),
  );
}


function countFlagsLeft(field, minesCount) {
  const flaggedCount = field
    .flat()
    .filter((cell) => cell.state === CELL_STATE.FLAGGED).length;

  return minesCount - flaggedCount;
}


function hasOpenedCells(field) {
  return field.flat().some((cell) => cell.state === CELL_STATE.OPENED);
}


function getRandomIndex(length) {
  return Math.floor(Math.random() * length);
}


function isEverySafeCellOpened(field) {
  return field
    .flat()
    .every(
      (cell) =>
        cell.type === CELL_TYPE.MINE || cell.state === CELL_STATE.OPENED,
    );
}


function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = String(totalSeconds % SECONDS_PER_MINUTE).padStart(2, '0');

  return `${minutes}:${seconds}`;
}


/* Game logic */

function generateField(rows, cols, minesCount) {
  if (minesCount >= rows * cols) {
    throw new RangeError('minesCount must be less than the number of cells');
  }

  const field = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, createCell),
  );
  let placedMines = 0;

  while (placedMines < minesCount) {
    const cell = field[getRandomIndex(rows)][getRandomIndex(cols)];

    if (cell.type === CELL_TYPE.MINE) {
      continue;
    }

    cell.type = CELL_TYPE.MINE;
    placedMines++;
  }

  return field;
}


function countNeighbourMines(field) {
  field.forEach((rowCells, row) => {
    rowCells.forEach((cell, col) => {
      if (cell.type !== CELL_TYPE.EMPTY) {
        return;
      }

      cell.neighborMines = getNeighbourPositions(field, row, col).filter(
        ([neighbourRow, neighbourCol]) =>
          field[neighbourRow][neighbourCol].type === CELL_TYPE.MINE,
      ).length;
    });
  });
}


// Keeps the first opened cell safe: a mine under it moves to a random empty cell.
function moveMineAwayFrom(field, row, col) {
  const cell = field[row][col];

  if (cell.type !== CELL_TYPE.MINE) {
    return;
  }

  const emptyCells = field
    .flat()
    .filter((candidate) => candidate.type === CELL_TYPE.EMPTY);

  emptyCells[getRandomIndex(emptyCells.length)].type = CELL_TYPE.MINE;
  cell.type = CELL_TYPE.EMPTY;
  countNeighbourMines(field);
}


function startTimer(onTick) {
  gameState.timerId = setInterval(() => {
    gameState.gameTime++;
    onTick();
  }, TIMER_INTERVAL_MS);
}


function stopTimer() {
  clearInterval(gameState.timerId);
  gameState.timerId = null;
}


function setGameStatus(status) {
  gameState.status = status;

  if (status !== GAME_STATUS.PROCESS) {
    stopTimer();
  }
}


function openCell(row, col) {
  const cell = board[row][col];

  if (
    gameState.status !== GAME_STATUS.PROCESS ||
    cell.state !== CELL_STATE.CLOSED
  ) {
    return;
  }

  cell.state = CELL_STATE.OPENED;

  if (cell.type === CELL_TYPE.MINE) {
    setGameStatus(GAME_STATUS.LOSE);

    return;
  }

  if (cell.neighborMines === 0) {
    getNeighbourPositions(board, row, col).forEach(
      ([neighbourRow, neighbourCol]) => openCell(neighbourRow, neighbourCol),
    );
  }
}


function toggleFlag(row, col) {
  const cell = board[row][col];

  if (
    gameState.status !== GAME_STATUS.PROCESS ||
    cell.state === CELL_STATE.OPENED
  ) {
    return;
  }

  if (cell.state === CELL_STATE.FLAGGED) {
    cell.state = CELL_STATE.CLOSED;

    return;
  }

  if (countFlagsLeft(board, gameState.minesCount) === 0) {
    return;
  }

  cell.state = CELL_STATE.FLAGGED;
}


function checkWinCondition() {
  if (
    gameState.status !== GAME_STATUS.PROCESS ||
    !isEverySafeCellOpened(board)
  ) {
    return;
  }

  board
    .flat()
    .filter((cell) => cell.type === CELL_TYPE.MINE)
    .forEach((cell) => {
      cell.state = CELL_STATE.FLAGGED;
    });
  setGameStatus(GAME_STATUS.WIN);
}


/* Rendering */

function getCellView(cell, status) {
  const isMine = cell.type === CELL_TYPE.MINE;
  const isGameLost = status === GAME_STATUS.LOSE;

  if (cell.state === CELL_STATE.OPENED && isMine) {
    return {
      classNames: ['cell-mine', 'cell-exploded'],
      description: 'exploded mine',
    };
  }

  if (cell.state === CELL_STATE.OPENED && cell.neighborMines === 0) {
    return { classNames: ['cell-opened'], description: 'empty' };
  }

  if (cell.state === CELL_STATE.OPENED) {
    const mineWord = cell.neighborMines === 1 ? 'mine' : 'mines';

    return {
      classNames: ['cell-opened'],
      description: `${cell.neighborMines} adjacent ${mineWord}`,
      minesNearby: cell.neighborMines,
    };
  }

  if (cell.state === CELL_STATE.FLAGGED && isGameLost && !isMine) {
    return {
      classNames: ['cell-flagged', 'cell-wrong-flag'],
      description: 'wrong flag',
    };
  }

  if (cell.state === CELL_STATE.FLAGGED) {
    return { classNames: ['cell-flagged'], description: 'flagged' };
  }

  if (isGameLost && isMine) {
    return { classNames: ['cell-mine'], description: 'mine' };
  }

  return { classNames: [], description: 'closed' };
}


function createCellButton(row, col) {
  const button = document.createElement('button');

  button.type = 'button';
  button.dataset.row = row;
  button.dataset.col = col;

  return button;
}


function updateCellButton(button, cell) {
  const { classNames, description, minesNearby } = getCellView(
    cell,
    gameState.status,
  );
  const row = Number(button.dataset.row);
  const col = Number(button.dataset.col);

  button.className = ['cell', ...classNames].join(' ');
  button.textContent = minesNearby ?? '';
  button.setAttribute(
    'aria-label',
    `Row ${row + 1}, column ${col + 1}, ${description}`,
  );

  if (minesNearby) {
    button.dataset.mines = minesNearby;
  } else {
    delete button.dataset.mines;
  }
}


function updateBoard() {
  Array.from(boardElement.children).forEach((button) => {
    const cell = board[button.dataset.row][button.dataset.col];

    updateCellButton(button, cell);
  });
}


function renderBoard() {
  const cellButtons = board.flatMap((rowCells, row) =>
    rowCells.map((cell, col) => createCellButton(row, col)),
  );

  document.documentElement.style.setProperty('--board-columns', gameState.cols);
  boardElement.replaceChildren(...cellButtons);
  updateBoard();
}


function renderTimer() {
  timerElement.textContent = formatTime(gameState.gameTime);
  timerElement.dateTime = `PT${gameState.gameTime}S`;
}


function renderGameInfo() {
  flagCounterElement.textContent = countFlagsLeft(board, gameState.minesCount);
  startButton.textContent = START_BUTTON_FACE[gameState.status];
  gameMessageElement.textContent = GAME_MESSAGE[gameState.status];
  renderTimer();
}


function renderGame() {
  updateBoard();
  renderGameInfo();
}


/* Event handling */

function getCellPosition(target) {
  const button = target.closest('.cell');

  if (!button) {
    return null;
  }

  return { row: Number(button.dataset.row), col: Number(button.dataset.col) };
}


function startTimerOnFirstMove() {
  if (
    gameState.status !== GAME_STATUS.PROCESS ||
    gameState.timerId !== null
  ) {
    return;
  }

  startTimer(renderTimer);
}


function flagCellAt(target) {
  const position = getCellPosition(target);

  if (!position) {
    return;
  }

  startTimerOnFirstMove();
  toggleFlag(position.row, position.col);
  renderGame();
}


function handleBoardClick(event) {
  const position = getCellPosition(event.target);

  if (!position) {
    return;
  }

  if (!hasOpenedCells(board)) {
    moveMineAwayFrom(board, position.row, position.col);
  }

  startTimerOnFirstMove();
  openCell(position.row, position.col);
  checkWinCondition();
  renderGame();
}


function handleBoardContextMenu(event) {
  event.preventDefault();
  flagCellAt(event.target);
}


function handleBoardKeydown(event) {
  if (
    event.key.toLowerCase() !== FLAG_KEY ||
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  ) {
    return;
  }

  flagCellAt(event.target);
}


function startNewGame() {
  stopTimer();
  gameState.status = GAME_STATUS.PROCESS;
  gameState.gameTime = 0;

  board = generateField(gameState.rows, gameState.cols, gameState.minesCount);
  countNeighbourMines(board);

  renderBoard();
  renderGameInfo();
}


boardElement.addEventListener('click', handleBoardClick);
boardElement.addEventListener('contextmenu', handleBoardContextMenu);
boardElement.addEventListener('keydown', handleBoardKeydown);
startButton.addEventListener('click', startNewGame);

startNewGame();
