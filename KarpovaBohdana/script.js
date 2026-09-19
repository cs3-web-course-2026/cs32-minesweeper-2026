'use strict';

/*
 * Сапер. Логічний шар (поле, відкриття клітинок, прапорці, таймер)
 * і шар відображення (DOM, події миші) в одному файлі.
 * Весь змінний стан живе у двох контейнерах: gameState та board.
 * Логіку можна перевірити з консолі браузера: openCell(0, 0), toggleFlag(1, 1), board.
 */

// ---------- Константи ----------

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

/** Табло в шапці показує рівно три цифри: 0 → "000", 42 → "042". */
const DISPLAY_DIGITS = 3;
const DISPLAY_MAX_VALUE = 10 ** DISPLAY_DIGITS - 1;

/** Зсуви до восьми сусідніх клітинок у форматі [Δрядок, Δстовпець]. */
const NEIGHBOUR_OFFSETS = [
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
  OPEN: 'is-open',
  FLAGGED: 'is-flagged',
  MINE: 'is-mine',
  EXPLODED: 'is-exploded',
  WRONG: 'is-wrong',
};

const CELL_LABEL = {
  CLOSED: 'закрита',
  FLAGGED: 'прапорець',
  MINE: 'міна',
  EMPTY: 'порожня',
};

const CSS_VARIABLE = {
  BOARD_COLUMNS: '--board-columns',
  BOARD_ROWS: '--board-rows',
};

/** Емодзі-«обличчя» на кнопці рестарту для кожного стану гри. */
const FACES = {
  [GAME_STATUS.PROCESS]: '🙂',
  [GAME_STATUS.WIN]: '😎',
  [GAME_STATUS.LOSE]: '😵',
};

/** Сповіщення про завершення гри. */
const END_MESSAGES = {
  [GAME_STATUS.WIN]: 'Перемога! Усі безпечні клітинки відкрито 🎉',
  [GAME_STATUS.LOSE]: 'Вибух! Гру завершено 💥',
};

const RESTART_LABEL = {
  NEW_GAME: 'Почати нову гру',
  PLAY_AGAIN: 'Зіграти ще раз',
};

// ---------- Стан гри ----------

const gameState = {
  rows: DEFAULT_ROWS,
  cols: DEFAULT_COLS,
  minesCount: DEFAULT_MINES_COUNT,
  status: GAME_STATUS.PROCESS,
  gameTime: 0,
  timerId: null,
};

/** Двовимірний масив клітинок { type, state, neighborMines }. */
let board = [];

// ---------- DOM-елементи (шукаємо один раз) ----------

const elements = {
  board: document.querySelector('.board'),
  flagsValue: document.querySelector('.counter-flags .counter-value'),
  timerValue: document.querySelector('.counter-timer .counter-value'),
  restartButton: document.querySelector('.restart'),
  restartFace: document.querySelector('.restart-face'),
  statusMessage: document.querySelector('.game-status'),
};

// ---------- Допоміжні функції (чисті: працюють лише з параметрами) ----------

function createCell() {
  return { type: CELL_TYPE.EMPTY, neighborMines: 0, state: CELL_STATE.CLOSED };
}


/** Повертає координати наявних сусідів клітинки (тільки в межах поля). */
function getNeighbours(field, row, col) {
  const neighbours = [];

  for (const [directionalRow, directionalCol] of NEIGHBOUR_OFFSETS) {
    const neighbourRow = row + directionalRow;
    const neighbourCol = col + directionalCol;

    if (field[neighbourRow]?.[neighbourCol] !== undefined) {
      neighbours.push({ row: neighbourRow, col: neighbourCol });
    }
  }

  return neighbours;
}


function countFlaggedCells(field) {
  return field.flat().filter((cell) => cell.state === CELL_STATE.FLAGGED)
    .length;
}


/** Перемога: усі клітинки, крім мін, відкриті. */
function checkWinCondition(field) {
  return field.flat().every((cell) => {
    return cell.type === CELL_TYPE.MINE || cell.state === CELL_STATE.OPENED;
  });
}


/** Ставить прапорці на всі міни (після перемоги). */
function flagAllMines(field) {
  field
    .flat()
    .filter((cell) => cell.type === CELL_TYPE.MINE)
    .forEach((cell) => {
      cell.state = CELL_STATE.FLAGGED;
    });
}


// ---------- Логічний шар ----------

/** Крок 2. Створює сітку rows × cols; дві міни ніколи не потрапляють в одну клітинку. */
function generateField(rows, cols, minesCount) {
  const field = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, createCell),
  );
  let minesToPlace = Math.min(minesCount, rows * cols);

  while (minesToPlace > 0) {
    const row = Math.floor(Math.random() * rows);
    const col = Math.floor(Math.random() * cols);
    const cell = field[row][col];

    // Клітинка вже зайнята іншою міною — пробуємо ще раз
    if (cell.type === CELL_TYPE.MINE) continue;

    cell.type = CELL_TYPE.MINE;
    minesToPlace -= 1;
  }

  return field;
}


/** Крок 3. Записує кожній безпечній клітинці кількість мін серед сусідів. */
function countNeighbourMines(field) {
  field.forEach((cells, row) => {
    cells.forEach((cell, col) => {
      if (cell.type === CELL_TYPE.MINE) return;

      cell.neighborMines = getNeighbours(field, row, col).filter(
        (neighbour) =>
          field[neighbour.row][neighbour.col].type === CELL_TYPE.MINE,
      ).length;
    });
  });

  return field;
}


/**
 * Рекурсивно відкриває клітинку; якщо навколо немає мін,
 * те саме робить з усіма сусідами, поки не дійде до клітинок із цифрами.
 */
function openCellsRecursively(field, row, col) {
  const cell = field[row][col];

  if (cell.state !== CELL_STATE.CLOSED) return;

  cell.state = CELL_STATE.OPENED;

  if (cell.neighborMines > 0) return;

  for (const neighbour of getNeighbours(field, row, col)) {
    openCellsRecursively(field, neighbour.row, neighbour.col);
  }
}


/**
 * Крок 3. Лівий клік по клітинці (row, col).
 * @returns {boolean} true, якщо клітинку було відкрито
 */
function openCell(row, col) {
  const cell = board[row]?.[col];

  if (gameState.status !== GAME_STATUS.PROCESS) return false;
  if (!cell || cell.state !== CELL_STATE.CLOSED) return false;

  if (cell.type === CELL_TYPE.MINE) {
    // Єдина відкрита міна на полі — та, на якій стався підрив
    cell.state = CELL_STATE.OPENED;
    finishGame(GAME_STATUS.LOSE);

    return true;
  }

  openCellsRecursively(board, row, col);

  if (checkWinCondition(board)) finishGame(GAME_STATUS.WIN);

  return true;
}


/** Крок 4. Правий клік: ставить або знімає прапорець; на відкритій клітинці нічого не робить. */
function toggleFlag(row, col) {
  const cell = board[row]?.[col];

  if (gameState.status !== GAME_STATUS.PROCESS) return;
  if (!cell || cell.state === CELL_STATE.OPENED) return;

  cell.state =
    cell.state === CELL_STATE.FLAGGED ? CELL_STATE.CLOSED : CELL_STATE.FLAGGED;
}


/** Крок 8. Фіксує результат, зупиняє таймер; при перемозі позначає всі міни. */
function finishGame(status) {
  gameState.status = status;
  stopTimer();

  if (status === GAME_STATUS.WIN) flagAllMines(board);
}


/** Крок 4. Щосекунди додає 1 до gameState.gameTime і викликає onTick. */
function startTimer(onTick) {
  if (gameState.timerId !== null) return;
  if (gameState.status !== GAME_STATUS.PROCESS) return;

  gameState.timerId = setInterval(() => {
    gameState.gameTime += 1;
    onTick();
  }, TIMER_INTERVAL_MS);
}


function stopTimer() {
  clearInterval(gameState.timerId);
  gameState.timerId = null;
}


/** Скидає стан і створює нове поле з поточними налаштуваннями. */
function resetGame() {
  stopTimer();

  gameState.status = GAME_STATUS.PROCESS;
  gameState.gameTime = 0;

  board = countNeighbourMines(
    generateField(gameState.rows, gameState.cols, gameState.minesCount),
  );
}


// ---------- Відображення (DOM) ----------

/** Формат табло: обмежує значення діапазоном 0…999 і доповнює нулями. */
function formatDisplay(value) {
  const clampedValue = Math.max(0, Math.min(value, DISPLAY_MAX_VALUE));

  return String(clampedValue).padStart(DISPLAY_DIGITS, '0');
}


function formatCellLabel(row, col, description) {
  return `Рядок ${row + 1}, стовпець ${col + 1}: ${description}`;
}


/** Чиста функція: як має виглядати клітинка (класи, текст, підпис) за її моделлю. */
function describeCell(cell, isGameOver) {
  const isMine = cell.type === CELL_TYPE.MINE;

  if (cell.state === CELL_STATE.FLAGGED) {
    // Після завершення гри показуємо, чи прапорець стояв на міні
    const classNames = [CELL_CLASS.FLAGGED];

    if (isGameOver) {
      classNames.push(isMine ? CELL_CLASS.MINE : CELL_CLASS.WRONG);
    }

    return { classNames, text: '', count: 0, label: CELL_LABEL.FLAGGED };
  }

  if (isMine && cell.state === CELL_STATE.OPENED) {
    const classNames = [CELL_CLASS.OPEN, CELL_CLASS.MINE, CELL_CLASS.EXPLODED];

    return { classNames, text: '', count: 0, label: CELL_LABEL.MINE };
  }

  if (isMine && isGameOver) {
    // Решта мін показується після поразки
    const classNames = [CELL_CLASS.OPEN, CELL_CLASS.MINE];

    return { classNames, text: '', count: 0, label: CELL_LABEL.MINE };
  }

  if (cell.state === CELL_STATE.CLOSED) {
    return { classNames: [], text: '', count: 0, label: CELL_LABEL.CLOSED };
  }

  if (cell.neighborMines === 0) {
    const classNames = [CELL_CLASS.OPEN];

    return { classNames, text: '', count: 0, label: CELL_LABEL.EMPTY };
  }

  return {
    classNames: [CELL_CLASS.OPEN],
    text: String(cell.neighborMines),
    count: cell.neighborMines,
    label: `${cell.neighborMines} мін поруч`,
  };
}


function createCellButton(row, col) {
  const button = document.createElement('button');

  button.type = 'button';
  button.dataset.row = row;
  button.dataset.col = col;

  return button;
}


/** Крок 5. Будує HTML-сітку за розмірами поля (викликається один раз на нову гру). */
function renderBoard() {
  elements.board.style.setProperty(CSS_VARIABLE.BOARD_COLUMNS, gameState.cols);
  elements.board.style.setProperty(CSS_VARIABLE.BOARD_ROWS, gameState.rows);

  const buttons = board.flatMap((cells, row) =>
    cells.map((cell, col) => createCellButton(row, col)),
  );

  elements.board.replaceChildren(...buttons);
}


/**
 * Синхронізує кнопку з моделлю клітинки. aria-disabled замість disabled:
 * неактивна кнопка «ковтає» події миші (зокрема contextmenu), і браузерне
 * меню перестало б блокуватися. Самі дії ігнорує логічний шар.
 */
function updateCellButton(button, cell, row, col) {
  const isGameOver = gameState.status !== GAME_STATUS.PROCESS;
  const { classNames, text, count, label } = describeCell(cell, isGameOver);

  button.className = [CELL_CLASS.BASE, ...classNames].join(' ');
  button.textContent = text;
  button.setAttribute('aria-label', formatCellLabel(row, col, label));
  button.setAttribute(
    'aria-disabled',
    String(isGameOver || cell.state === CELL_STATE.OPENED),
  );

  if (count > 0) {
    button.dataset.count = count;
  } else {
    delete button.dataset.count;
  }
}


/** Оновлює наявні кнопки, не пересоздаючи їх: клік не губиться, фокус зберігається. */
function updateBoard() {
  board.forEach((cells, row) => {
    cells.forEach((cell, col) => {
      const button = elements.board.children[row * gameState.cols + col];

      updateCellButton(button, cell, row, col);
    });
  });
}


function renderTimer() {
  elements.timerValue.textContent = formatDisplay(gameState.gameTime);
}


/** Крок 6. Лічильник прапорців, таймер, «обличчя» кнопки рестарту, повідомлення. */
function renderHeader() {
  const flagsLeft = gameState.minesCount - countFlaggedCells(board);
  const isGameOver = gameState.status !== GAME_STATUS.PROCESS;

  elements.flagsValue.textContent = formatDisplay(flagsLeft);
  elements.restartFace.textContent = FACES[gameState.status];
  elements.restartButton.setAttribute(
    'aria-label',
    isGameOver ? RESTART_LABEL.PLAY_AGAIN : RESTART_LABEL.NEW_GAME,
  );
  elements.statusMessage.textContent = END_MESSAGES[gameState.status] ?? '';

  renderTimer();
}


function renderGame() {
  updateBoard();
  renderHeader();
}


function startNewGame() {
  resetGame();
  renderBoard();
  renderGame();
}


// ---------- Події користувача (Крок 7) ----------

/** Дістає координати клітинки з елемента, на якому сталася подія. */
function getCellPosition(event) {
  const button = event.target.closest(`.${CELL_CLASS.BASE}`);

  if (!button || !elements.board.contains(button)) return null;

  return { row: Number(button.dataset.row), col: Number(button.dataset.col) };
}


function handleCellClick(event) {
  const position = getCellPosition(event);

  if (!position) return;
  if (!openCell(position.row, position.col)) return;

  startTimer(renderTimer); // таймер стартує з першого відкриття клітинки
  renderGame();
}


function handleCellRightClick(event) {
  event.preventDefault(); // блокуємо стандартне контекстне меню браузера

  const position = getCellPosition(event);

  if (!position) return;

  toggleFlag(position.row, position.col);
  renderGame();
}


elements.board.addEventListener('click', handleCellClick);
elements.board.addEventListener('contextmenu', handleCellRightClick);
elements.restartButton.addEventListener('click', startNewGame);

startNewGame();
