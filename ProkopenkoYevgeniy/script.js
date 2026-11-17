'use strict';

/**
 * ============================================================================
 * КРОК 1. МОДЕЛЮВАННЯ ДАНИХ (DATA LAYER)
 * ============================================================================
 */

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

/**
 * Глобальний об'єкт стану гри (gameState)
 */
const gameState = {
  rows: 16,
  cols: 16,
  minesCount: 40,
  status: GAME_STATUS.PROCESS,
  gameTime: 0,
  timerId: null,
  isTimerRunning: false,
  explodedCell: null,
};

/**
 * Двовимірний масив ігрового поля
 * @type {Array<Array<{type: string, state: string, neighborMines: number}>>}
 */
let field = [];

/**
 * Перевірка, чи належать координати (row, col) межам поля
 */
function isValidCell(row, col, rows = gameState.rows, cols = gameState.cols) {
  return row >= 0 && row < rows && col >= 0 && col < cols;
}

/**
 * Отримання координат усіх сусідніх клітинок (до 8 сусідів)
 */
function getNeighbors(row, col, rows = gameState.rows, cols = gameState.cols) {
  const neighbors = [];
  for (let dRow = -1; dRow <= 1; dRow++) {
    for (let dCol = -1; dCol <= 1; dCol++) {
      if (dRow === 0 && dCol === 0) continue;
      const targetRow = row + dRow;
      const targetCol = col + dCol;
      if (isValidCell(targetRow, targetCol, rows, cols)) {
        neighbors.push([targetRow, targetCol]);
      }
    }
  }
  return neighbors;
}

/**
 * ============================================================================
 * КРОК 2. ГЕНЕРАЦІЯ ПОЛЯ ТА МІН
 * ============================================================================
 */

/**
 * Створення двовимірного масиву поля та випадкова розстановка мін
 * @param {number} rows - Кількість рядків
 * @param {number} cols - Кількість стовпців
 * @param {number} minesCount - Кількість мін
 * @returns {Array<Array<Object>>} Сітка поля
 */
function generateField(rows, cols, minesCount) {
  const newField = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      type: CELL_TYPE.EMPTY,
      neighborMines: 0,
      state: CELL_STATE.CLOSED,
    })),
  );

  const maxPossibleMines = rows * cols - 1;
  const actualMinesCount = Math.min(minesCount, maxPossibleMines);

  let placedMines = 0;
  while (placedMines < actualMinesCount) {
    const randomRow = Math.floor(Math.random() * rows);
    const randomCol = Math.floor(Math.random() * cols);

    if (newField[randomRow][randomCol].type !== CELL_TYPE.MINE) {
      newField[randomRow][randomCol].type = CELL_TYPE.MINE;
      placedMines++;
    }
  }

  return newField;
}

/**
 * ============================================================================
 * КРОК 3. АЛГОРИТМІЧНА ЧАСТИНА (BUSINESS LOGIC)
 * ============================================================================
 */

/**
 * Підрахунок кількості мін у сусідніх клітинках для кожної порожньої клітинки
 * @param {Array<Array<Object>>} currentField - Ігрове поле
 */
function countNeighbourMines(currentField = field) {
  const rows = currentField.length;
  const cols = rows > 0 ? currentField[0].length : 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (currentField[r][c].type === CELL_TYPE.MINE) continue;

      const neighbors = getNeighbors(r, c, rows, cols);
      let minesAround = 0;

      for (const [nRow, nCol] of neighbors) {
        if (currentField[nRow][nCol].type === CELL_TYPE.MINE) {
          minesAround++;
        }
      }

      currentField[r][c].neighborMines = minesAround;
    }
  }
}

/**
 * Відкриття клітинки з рекурсивним розкриттям порожніх сусідніх областей
 * @param {number} row - Індекс рядка
 * @param {number} col - Індекс стовпця
 */
function openCell(row, col) {
  if (gameState.status !== GAME_STATUS.PROCESS) return;
  if (!isValidCell(row, col)) return;

  const cell = field[row][col];

  // Якщо клітинка вже відкрита або позначена прапорцем — нічого не робимо
  if (cell.state === CELL_STATE.OPENED || cell.state === CELL_STATE.FLAGGED) {
    return;
  }

  // Запуск таймера при першій дії гравця
  if (!gameState.isTimerRunning) {
    startTimer();
  }

  cell.state = CELL_STATE.OPENED;

  // Підрив на міні -> поразка
  if (cell.type === CELL_TYPE.MINE) {
    gameState.status = GAME_STATUS.LOSE;
    gameState.explodedCell = { row, col };
    stopTimer();
    revealAllMines();
    return;
  }

  // Рекурсивне відкриття сусідів, якщо навколо немає мін (neighborMines === 0)
  if (cell.neighborMines === 0) {
    const neighbors = getNeighbors(row, col);
    for (const [nRow, nCol] of neighbors) {
      if (field[nRow][nCol].state === CELL_STATE.CLOSED) {
        openCell(nRow, nCol);
      }
    }
  }

  checkWinCondition();
}

/**
 * ============================================================================
 * КРОК 4. ТАЙМЕР ТА ПРАПОРЦІ
 * ============================================================================
 */

/**
 * Підрахунок кількості встановлених прапорців на полі
 */
function getPlacedFlagsCount() {
  let count = 0;
  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      if (field[r][c].state === CELL_STATE.FLAGGED) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Встановлення або зняття прапорця на закритій клітинці
 * @param {number} row - Індекс рядка
 * @param {number} col - Індекс стовпця
 */
function toggleFlag(row, col) {
  if (gameState.status !== GAME_STATUS.PROCESS) return;
  if (!isValidCell(row, col)) return;

  const cell = field[row][col];

  // На відкриту клітинку ставити прапорець не можна
  if (cell.state === CELL_STATE.OPENED) return;

  if (!gameState.isTimerRunning) {
    startTimer();
  }

  if (cell.state === CELL_STATE.CLOSED) {
    if (getPlacedFlagsCount() >= gameState.minesCount) return;
    cell.state = CELL_STATE.FLAGGED;
  } else if (cell.state === CELL_STATE.FLAGGED) {
    cell.state = CELL_STATE.CLOSED;
  }
}

/**
 * Запуск секундного таймера гри
 */
function startTimer() {
  if (gameState.isTimerRunning) return;
  gameState.isTimerRunning = true;

  gameState.timerId = setInterval(() => {
    if (gameState.gameTime < 999) {
      gameState.gameTime += 1;
      updateHeaderUI();
    }
  }, 1000);
}

/**
 * Зупинка таймера гри (clearInterval)
 */
function stopTimer() {
  if (gameState.timerId !== null) {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
  }
  gameState.isTimerRunning = false;
}

/**
 * ============================================================================
 * КРОК 8. ЗАВЕРШЕННЯ ГРИ (ПЕРЕВІРКА WIN / LOSE)
 * ============================================================================
 */

/**
 * Перевірка умови перемоги: усі безпечні клітинки (type === 'empty') відкриті
 */
function checkWinCondition() {
  if (gameState.status !== GAME_STATUS.PROCESS) return;

  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cell = field[r][c];
      if (cell.type === CELL_TYPE.EMPTY && cell.state !== CELL_STATE.OPENED) {
        return;
      }
    }
  }

  gameState.status = GAME_STATUS.WIN;
  stopTimer();
  flagRemainingMines();
}

/**
 * Розкриття всіх нерозмінованих мін після підриву
 */
function revealAllMines() {
  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cell = field[r][c];
      if (cell.type === CELL_TYPE.MINE && cell.state === CELL_STATE.CLOSED) {
        cell.state = CELL_STATE.OPENED;
      }
    }
  }
}

/**
 * Автоматичне встановлення прапорців на всі міни у разі перемоги
 */
function flagRemainingMines() {
  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cell = field[r][c];
      if (cell.type === CELL_TYPE.MINE && cell.state !== CELL_STATE.FLAGGED) {
        cell.state = CELL_STATE.FLAGGED;
      }
    }
  }
}

/**
 * ============================================================================
 * КРОК 5 та КРОК 6. РЕНДЕРИНГ ПОЛЯ ТА ДИНАМІЧНІ ЕЛЕМЕНТИ ІНТЕРФЕЙСУ (DOM)
 * ============================================================================
 */

const boardElement = document.getElementById('game-board');
const flagsCounterElement = document.getElementById('flags-counter');
const timerElement = document.getElementById('timer');
const startBtnElement = document.getElementById('start-btn');
const statusBannerElement = document.getElementById('status-banner');

/**
 * Форматування числа у 3-значний вигляд для табло (наприклад, 040, 007)
 */
function formatCounter(value) {
  const clamped = Math.max(-99, Math.min(999, value));
  if (clamped < 0) {
    return '-' + String(Math.abs(clamped)).padStart(2, '0');
  }
  return String(clamped).padStart(3, '0');
}

/**
 * Оновлення таймера, лічильника прапорців, кнопки рестарту та банера статусу
 */
function updateHeaderUI() {
  const remainingFlags = gameState.minesCount - getPlacedFlagsCount();
  flagsCounterElement.textContent = formatCounter(remainingFlags);
  timerElement.textContent = formatCounter(gameState.gameTime);

  if (gameState.status === GAME_STATUS.WIN) {
    startBtnElement.textContent = '😎';
    statusBannerElement.textContent = `Перемога! Усі міни знешкоджено за ${gameState.gameTime} с.`;
    statusBannerElement.className = 'status-banner win';
  } else if (gameState.status === GAME_STATUS.LOSE) {
    startBtnElement.textContent = '😵';
    statusBannerElement.textContent = 'Поразка! Ви натрапили на міну.';
    statusBannerElement.className = 'status-banner lose';
  } else {
    startBtnElement.textContent = '🙂';
    statusBannerElement.textContent = '';
    statusBannerElement.className = 'status-banner hidden';
  }
}

/**
 * Динамічна генерація та оновлення HTML-структури ігрової сітки на основі масиву field
 */
function renderBoard() {
  document.documentElement.style.setProperty('--rows-count', gameState.rows);
  document.documentElement.style.setProperty('--cols-count', gameState.cols);

  boardElement.innerHTML = '';
  const fragment = document.createDocumentFragment();

  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cellData = field[r][c];
      const cellDiv = document.createElement('div');
      cellDiv.classList.add('cell');
      cellDiv.setAttribute('role', 'gridcell');
      cellDiv.dataset.row = String(r);
      cellDiv.dataset.col = String(c);

      if (cellData.state === CELL_STATE.OPENED) {
        cellDiv.classList.add('open');

        if (cellData.type === CELL_TYPE.MINE) {
          cellDiv.classList.add('mine');
          cellDiv.textContent = '💣';

          const isExploded =
            gameState.explodedCell &&
            gameState.explodedCell.row === r &&
            gameState.explodedCell.col === c;

          if (isExploded) {
            cellDiv.classList.add('clicked');
            cellDiv.setAttribute('aria-label', 'Підірвана міна');
          } else {
            cellDiv.setAttribute('aria-label', 'Відкрита міна');
          }
        } else if (cellData.neighborMines > 0) {
          cellDiv.classList.add(`num-${cellData.neighborMines}`);
          cellDiv.textContent = String(cellData.neighborMines);
          cellDiv.setAttribute(
            'aria-label',
            `${cellData.neighborMines} мін поруч`,
          );
        } else {
          cellDiv.setAttribute('aria-label', 'Порожня відкрита клітинка');
        }
      } else if (cellData.state === CELL_STATE.FLAGGED) {
        cellDiv.classList.add('flag');
        cellDiv.textContent = '🚩';

        if (
          gameState.status === GAME_STATUS.LOSE &&
          cellData.type !== CELL_TYPE.MINE
        ) {
          cellDiv.classList.add('false-flag', 'no-mine');
          cellDiv.setAttribute('aria-label', 'Помилковий прапорець');
        } else {
          cellDiv.classList.add('on-mine');
          cellDiv.setAttribute('aria-label', 'Прапорець');
        }
      } else {
        cellDiv.setAttribute('aria-label', 'Закрита клітинка');
      }

      fragment.appendChild(cellDiv);
    }
  }

  boardElement.appendChild(fragment);
  updateHeaderUI();
}

/**
 * Ініціалізація / скидання стану та запуск нової гри
 */
function initGame(
  rows = gameState.rows,
  cols = gameState.cols,
  minesCount = gameState.minesCount,
) {
  stopTimer();

  gameState.rows = rows;
  gameState.cols = cols;
  gameState.minesCount = minesCount;
  gameState.status = GAME_STATUS.PROCESS;
  gameState.gameTime = 0;
  gameState.explodedCell = null;

  field = generateField(rows, cols, minesCount);
  countNeighbourMines(field);
  renderBoard();
}

/**
 * ============================================================================
 * КРОК 7. ОБРОБКА ПОДІЙ КОРИСТУВАЧА (MOUSE EVENTS)
 * ============================================================================
 */

// Лівий клік: відкриття клітинки (використовуємо делегування подій на контейнері поля)
boardElement.addEventListener('click', (event) => {
  const cellDiv = event.target.closest('.cell');
  if (!cellDiv) return;

  const row = Number(cellDiv.dataset.row);
  const col = Number(cellDiv.dataset.col);

  openCell(row, col);
  renderBoard();
});

// Правий клік: встановлення/зняття прапорця та блокування контекстного меню браузера
boardElement.addEventListener('contextmenu', (event) => {
  event.preventDefault();

  const cellDiv = event.target.closest('.cell');
  if (!cellDiv) return;

  const row = Number(cellDiv.dataset.row);
  const col = Number(cellDiv.dataset.col);

  toggleFlag(row, col);
  renderBoard();
});

// Кнопка «Старт / Рестарт»
startBtnElement.addEventListener('click', () => {
  initGame();
});

// Автоматичний старт гри після завантаження сторінки
document.addEventListener('DOMContentLoaded', () => {
  initGame();
});
