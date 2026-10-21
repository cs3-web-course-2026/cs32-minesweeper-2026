/**
 * Практична робота №2: Minesweeper (Логіка та DOM)
 */

const GAME_STATUS = Object.freeze({
  PROCESS: 'process',
  WIN: 'win',
  LOSE: 'lose'
});

const CELL_TYPE = Object.freeze({
  EMPTY: 'empty',
  MINE: 'mine'
});

const CELL_STATE = Object.freeze({
  CLOSED: 'closed',
  OPENED: 'opened',
  FLAGGED: 'flagged'
});

// КРОК 1. Моделювання даних (Data Layer)

/**
 * Глобальний об'єкт стану гри (містить виключно необхідні поля контракту)
 */
const gameState = {
  rows: 9,              // Кількість рядків
  cols: 9,              // Кількість стовпців
  minesCount: 10,       // Кількість мін на полі
  status: GAME_STATUS.PROCESS, // Поточний статус гри
  gameTime: 0,          // Час гри у секундах
  timerId: null         // ID таймера для clearInterval (також прапорець першого ходу)
};

/**
 * Єдиний інший верхньорівневий змінюваний контейнер
 */
let board = [];

/**
 * Кешовані посилання на елементи DOM (запитуються один раз при старті)
 */
const domElements = {
  board: null,
  timerDisplay: null,
  flagCounter: null,
  startButton: null,
  startButtonIcon: null,
  gameStatus: null
};

/**
 * Фабрика створення нової клітинки
 * @returns {Object} Об'єкт стану клітинки
 */
function createCell() {
  return {
    type: CELL_TYPE.EMPTY,
    state: CELL_STATE.CLOSED,
    neighborMines: 0
  };
}

// КРОК 2. Генерація поля та мін

/**
 * Створює сітку поля та випадково розставляє міни
 * @param {number} rows 
 * @param {number} cols 
 * @param {number} minesCount 
 * @returns {Array<Array<Object>>}
 */
function generateField(rows, cols, minesCount) {
  const totalCells = rows * cols;
  const actualMines = Math.min(minesCount, totalCells);

  // 1. Ініціалізація порожнього поля
  const field = [];
  for (let row = 0; row < rows; row++) {
    const rowCells = [];
    for (let col = 0; col < cols; col++) {
      rowCells.push(createCell());
    }
    field.push(rowCells);
  }

  // 2. Випадкова розстановка мін без дублювання
  let minesPlaced = 0;
  while (minesPlaced < actualMines) {
    const randomRow = Math.floor(Math.random() * rows);
    const randomCol = Math.floor(Math.random() * cols);

    if (field[randomRow][randomCol].type !== CELL_TYPE.MINE) {
      field[randomRow][randomCol].type = CELL_TYPE.MINE;
      minesPlaced++;
    }
  }

  return field;
}

// КРОК 3. Алгоритмічна частина (Business Logic)

/**
 * Список 8 відносних зміщень для сусідніх клітинок
 */
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [ 0, -1],          [ 0, 1],
  [ 1, -1], [ 1, 0], [ 1, 1]
];

/**
 * Перевірка, чи знаходяться координати в межах поля
 */
function isValidCoordinate(row, col) {
  return row >= 0 && row < gameState.rows && col >= 0 && col < gameState.cols;
}

/**
 * Підраховує кількість мін-сусідів для кожної клітинки на полі
 * @param {Array<Array<Object>>} field 
 */
function countNeighbourMines(field) {
  const rowCount = field.length;
  if (rowCount === 0) return;
  const colCount = field[0].length;

  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < colCount; col++) {
      if (field[row][col].type === CELL_TYPE.MINE) continue;

      let count = 0;
      for (const [offsetRow, offsetCol] of DIRECTIONS) {
        const neighborRow = row + offsetRow;
        const neighborCol = col + offsetCol;
        if (
          neighborRow >= 0 &&
          neighborRow < rowCount &&
          neighborCol >= 0 &&
          neighborCol < colCount &&
          field[neighborRow][neighborCol].type === CELL_TYPE.MINE
        ) {
          count++;
        }
      }
      field[row][col].neighborMines = count;
    }
  }
}

/**
 * Логіка відкриття клітинки з рекурсивним каскадом (flood fill)
 * Перевірка перемоги та оновлення DOM викликаються один раз після завершення каскаду
 * @param {number} row 
 * @param {number} col 
 * @param {boolean} isOuterCall Прапорець зовнішнього (не рекурсивного) виклику
 */
function openCell(row, col, isOuterCall = true) {
  if (gameState.status !== GAME_STATUS.PROCESS) return;
  if (!isValidCoordinate(row, col)) return;

  const cell = board[row][col];

  // Якщо клітинка вже відкрита або має прапорець — нічого не робимо
  if (cell.state === CELL_STATE.OPENED || cell.state === CELL_STATE.FLAGGED) return;

  // Запуск таймера при першій взаємодії
  if (gameState.timerId === null) {
    startTimer();
  }

  // Якщо натрапили на міну -> поразка
  if (cell.type === CELL_TYPE.MINE) {
    gameState.status = GAME_STATUS.LOSE;
    cell.state = CELL_STATE.OPENED;
    stopTimer();
    revealAllMines();
    render({ row, col });
    return;
  }

  // Відкриваємо безпечну клітинку
  cell.state = CELL_STATE.OPENED;

  // Якщо навколо немає мін (neighborMines === 0) — каскадне відкриття без зайвого перемальовування
  if (cell.neighborMines === 0) {
    for (const [offsetRow, offsetCol] of DIRECTIONS) {
      const neighborRow = row + offsetRow;
      const neighborCol = col + offsetCol;
      if (isValidCoordinate(neighborRow, neighborCol)) {
        const neighborCell = board[neighborRow][neighborCol];
        if (neighborCell.state === CELL_STATE.CLOSED && neighborCell.type !== CELL_TYPE.MINE) {
          openCell(neighborRow, neighborCol, false);
        }
      }
    }
  }

  // Тільки після завершення зовнішнього виклику оновлюємо DOM та перевіряємо перемогу
  if (isOuterCall) {
    checkWinCondition();
    render();
  }
}

// КРОК 4. Таймер та прапорці

/**
 * Підраховує кількість встановлених на даний момент прапорців
 * @returns {number}
 */
function countPlacedFlags() {
  let placedFlags = 0;
  for (let row = 0; row < gameState.rows; row++) {
    for (let col = 0; col < gameState.cols; col++) {
      if (board[row] && board[row][col].state === CELL_STATE.FLAGGED) {
        placedFlags++;
      }
    }
  }
  return placedFlags;
}

/**
 * Перемикання прапорця на клітинці
 * @param {number} row 
 * @param {number} col 
 */
function toggleFlag(row, col) {
  if (gameState.status !== GAME_STATUS.PROCESS) return;
  if (!isValidCoordinate(row, col)) return;

  const cell = board[row][col];

  // Не можна ставити прапорець на відкриту клітинку
  if (cell.state === CELL_STATE.OPENED) return;

  if (gameState.timerId === null) {
    startTimer();
  }

  if (cell.state === CELL_STATE.CLOSED) {
    // Дозволяємо встановлення тільки якщо ліміт прапорців не вичерпано
    if (countPlacedFlags() < gameState.minesCount) {
      cell.state = CELL_STATE.FLAGGED;
    } else {
      return;
    }
  } else if (cell.state === CELL_STATE.FLAGGED) {
    cell.state = CELL_STATE.CLOSED;
  }

  render();
}

/**
 * Запуск таймера
 */
function startTimer() {
  if (gameState.timerId !== null) clearInterval(gameState.timerId);
  gameState.timerId = setInterval(() => {
    gameState.gameTime++;
    updateStats();
  }, 1000);
}

/**
 * Зупинка таймера
 */
function stopTimer() {
  if (gameState.timerId !== null) {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
  }
}

/**
 * Скидання таймера
 */
function resetTimer() {
  stopTimer();
  gameState.gameTime = 0;
}

/**
 * Форматування секунд у вигляд MM:SS
 * @param {number} totalSeconds 
 * @returns {string}
 */
function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// КРОК 5. Рендеринг ігрового поля (DOM)

/**
 * Відображення сітки поля у DOM у вигляді інтерактивних доступних кнопок
 * @param {Object|null} explodedCell Координати клітинки вибуху {row, col}
 */
function renderBoard(explodedCell = null) {
  const boardElement = domElements.board;
  if (!boardElement) return;

  // Зберігаємо координати поточно сфокусованої кнопки перед оновленням
  const activeElement = document.activeElement;
  let focusedRow = null;
  let focusedCol = null;
  if (activeElement && activeElement.classList.contains('cell') && activeElement.dataset.row !== undefined) {
    focusedRow = activeElement.dataset.row;
    focusedCol = activeElement.dataset.col;
  }

  // Очищаємо вміст сітки
  boardElement.innerHTML = '';

  for (let row = 0; row < gameState.rows; row++) {
    for (let col = 0; col < gameState.cols; col++) {
      const cell = board[row][col];
      const cellElement = document.createElement('button');
      cellElement.type = 'button';
      cellElement.classList.add('cell');
      cellElement.dataset.row = row;
      cellElement.dataset.col = col;

      // 1. Закрита клітинка
      if (cell.state === CELL_STATE.CLOSED) {
        cellElement.classList.add('closed');
        cellElement.setAttribute('aria-label', `Закрита клітинка, рядок ${row + 1}, колонка ${col + 1}`);
      }
      // 2. Прапорець
      else if (cell.state === CELL_STATE.FLAGGED) {
        if (gameState.status === GAME_STATUS.LOSE && cell.type !== CELL_TYPE.MINE) {
          cellElement.classList.add('flagged-wrong');
          cellElement.textContent = '❌';
          cellElement.title = 'Помилковий прапорець (без міни)';
          cellElement.setAttribute('aria-label', `Помилковий прапорець, рядок ${row + 1}, колонка ${col + 1}`);
        } else {
          cellElement.classList.add('flagged');
          cellElement.textContent = '🚩';
          cellElement.title = 'Прапорець';
          cellElement.setAttribute('aria-label', `Прапорець, рядок ${row + 1}, колонка ${col + 1}`);
        }
      }
      // 3. Відкрита клітинка
      else if (cell.state === CELL_STATE.OPENED) {
        if (cell.type === CELL_TYPE.MINE) {
          if (
            explodedCell &&
            explodedCell.row === row &&
            explodedCell.col === col
          ) {
            cellElement.classList.add('mine-exploded');
            cellElement.textContent = '💥';
            cellElement.title = 'Міна, на яку наступив гравець';
            cellElement.setAttribute('aria-label', `Підірвана міна, рядок ${row + 1}, колонка ${col + 1}`);
          } else {
            cellElement.classList.add('mine');
            cellElement.textContent = '💣';
            cellElement.title = 'Відкрита міна';
            cellElement.setAttribute('aria-label', `Міна, рядок ${row + 1}, колонка ${col + 1}`);
          }
        } else {
          cellElement.classList.add('open');
          if (cell.neighborMines === 0) {
            cellElement.classList.add('empty');
            cellElement.setAttribute('aria-label', `Порожня клітинка, рядок ${row + 1}, колонка ${col + 1}`);
          } else {
            cellElement.classList.add(`num-${cell.neighborMines}`);
            cellElement.textContent = cell.neighborMines;
            cellElement.setAttribute('aria-label', `${cell.neighborMines} мін навколо, рядок ${row + 1}, колонка ${col + 1}`);
          }
        }
      }

      boardElement.appendChild(cellElement);
    }
  }

  // Відновлюємо фокус на новій кнопці для збереження фокусу при навігації з клавіатури
  if (focusedRow !== null && focusedCol !== null) {
    const newFocusedButtonElement = boardElement.querySelector(
      `.cell[data-row="${focusedRow}"][data-col="${focusedCol}"]`
    );
    if (newFocusedButtonElement) {
      newFocusedButtonElement.focus();
    }
  }
}

// КРОК 6. Динамічні елементи інтерфейсу

/**
 * Оновлення лічильників (таймер, прапорці), текстового статусу гри та кнопки
 * Використовує попередньо закешовані посилання на DOM-елементи
 */
function updateStats() {
  // Оновлення таймера
  if (domElements.timerDisplay) {
    domElements.timerDisplay.textContent = formatTime(gameState.gameTime);
  }

  // Оновлення лічильника прапорців
  if (domElements.flagCounter) {
    const remainingFlags = gameState.minesCount - countPlacedFlags();
    domElements.flagCounter.textContent = remainingFlags;
  }

  // Оновлення іконки на кнопці рестарту
  if (domElements.startButtonIcon) {
    if (gameState.status === GAME_STATUS.WIN) {
      domElements.startButtonIcon.textContent = '😎';
    } else if (gameState.status === GAME_STATUS.LOSE) {
      domElements.startButtonIcon.textContent = '😵';
    } else {
      domElements.startButtonIcon.textContent = '🙂';
    }
  }

  // Оновлення доступного текстового статусу гри для скрінрідерів
  if (domElements.gameStatus) {
    if (gameState.status === GAME_STATUS.WIN) {
      domElements.gameStatus.textContent = 'Перемога! Всі безпечні клітинки успішно відкрито.';
      domElements.gameStatus.className = 'game-status win';
    } else if (gameState.status === GAME_STATUS.LOSE) {
      domElements.gameStatus.textContent = 'Поразка! Ви підірвалися на міні.';
      domElements.gameStatus.className = 'game-status lose';
    } else {
      domElements.gameStatus.textContent = '';
      domElements.gameStatus.className = 'game-status';
    }
  }
}

/**
 * Загальна функція синхронізації DOM з gameState
 * @param {Object|null} explodedCell Координати клітинки вибуху
 */
function render(explodedCell = null) {
  renderBoard(explodedCell);
  updateStats();
}

// КРОК 7. Обробка подій користувача (Mouse & Keyboard Events)

/**
 * Підключення слухачів подій до DOM
 */
function setupEventListeners() {
  const boardElement = domElements.board;
  const startButtonElement = domElements.startButton;

  // Делегування подій для клітинок дошки
  if (boardElement) {
    // Лівий клік — відкриття клітинки
    boardElement.addEventListener('click', (event) => {
      const cellTarget = event.target.closest('.cell');
      if (!cellTarget) return;

      const row = parseInt(cellTarget.dataset.row, 10);
      const col = parseInt(cellTarget.dataset.col, 10);

      if (!isNaN(row) && !isNaN(col)) {
        openCell(row, col);
      }
    });

    // Правий клік — прапорець (з блокуванням контекстного меню)
    boardElement.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      const cellTarget = event.target.closest('.cell');
      if (!cellTarget) return;

      const row = parseInt(cellTarget.dataset.row, 10);
      const col = parseInt(cellTarget.dataset.col, 10);

      if (!isNaN(row) && !isNaN(col)) {
        toggleFlag(row, col);
      }
    });

    // Клавіатурне керування: Space (прапорець) та стрілки (переміщення)
    boardElement.addEventListener('keydown', (event) => {
      const cellTarget = event.target.closest('.cell');
      if (!cellTarget) return;

      const row = parseInt(cellTarget.dataset.row, 10);
      const col = parseInt(cellTarget.dataset.col, 10);

      // Пробіл — встановлення або зняття прапорця
      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault(); // Запобігаємо стандартній активації кнопки (кліку)
        if (!isNaN(row) && !isNaN(col)) {
          toggleFlag(row, col);
        }
      }

      // Стрілки — навігація між сусідніми клітинками
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        let nextRow = row;
        let nextCol = col;

        if (event.key === 'ArrowUp') nextRow--;
        if (event.key === 'ArrowDown') nextRow++;
        if (event.key === 'ArrowLeft') nextCol--;
        if (event.key === 'ArrowRight') nextCol++;

        if (isValidCoordinate(nextRow, nextCol)) {
          event.preventDefault();
          const nextButtonElement = boardElement.querySelector(
            `.cell[data-row="${nextRow}"][data-col="${nextCol}"]`
          );
          if (nextButtonElement) {
            nextButtonElement.focus();
          }
        }
      }
    });
  }

  // Кнопка рестарту гри
  if (startButtonElement) {
    startButtonElement.addEventListener('click', () => {
      initGame();
    });
  }
}

// КРОК 8. Завершення гри (Win / Lose)

/**
 * Відкриття всіх мін при поразці (відкриваються лише закриті міни, прапорці залишаються)
 */
function revealAllMines() {
  for (let row = 0; row < gameState.rows; row++) {
    for (let col = 0; col < gameState.cols; col++) {
      const cell = board[row][col];
      if (cell.type === CELL_TYPE.MINE && cell.state === CELL_STATE.CLOSED) {
        cell.state = CELL_STATE.OPENED;
      }
    }
  }
}

/**
 * Перевірка умови перемоги:
 * Якщо всі безпечні клітинки (не міни) вже відкриті
 */
function checkWinCondition() {
  let openedSafeCells = 0;
  const totalSafeCells = gameState.rows * gameState.cols - gameState.minesCount;

  for (let row = 0; row < gameState.rows; row++) {
    for (let col = 0; col < gameState.cols; col++) {
      const cell = board[row][col];
      if (cell.type !== CELL_TYPE.MINE && cell.state === CELL_STATE.OPENED) {
        openedSafeCells++;
      }
    }
  }

  if (openedSafeCells === totalSafeCells) {
    gameState.status = GAME_STATUS.WIN;
    stopTimer();

    // Автоматично позначаємо всі міни прапорцями при перемозі
    for (let row = 0; row < gameState.rows; row++) {
      for (let col = 0; col < gameState.cols; col++) {
        if (board[row][col].type === CELL_TYPE.MINE) {
          board[row][col].state = CELL_STATE.FLAGGED;
        }
      }
    }
  }
}

// Ініціалізація нової гри

/**
 * Кешування посилань на елементи інтерфейсу
 */
function cacheDomElements() {
  domElements.board = document.querySelector('.board');
  domElements.timerDisplay = document.querySelector('.header-timer .stat-value');
  domElements.flagCounter = document.querySelector('.header-flag .stat-value');
  domElements.startButton = document.querySelector('.btn-start');
  domElements.startButtonIcon = document.querySelector('.btn-start .btn-icon');
  domElements.gameStatus = document.querySelector('.game-status');
}

/**
 * Повний запуск/перезапуск гри
 */
function initGame() {
  resetTimer();
  gameState.status = GAME_STATUS.PROCESS;
  board = generateField(gameState.rows, gameState.cols, gameState.minesCount);
  countNeighbourMines(board);
  render();
}

// Автоматичний старт після завантаження DOM
document.addEventListener('DOMContentLoaded', () => {
  cacheDomElements();
  setupEventListeners();
  initGame();
});