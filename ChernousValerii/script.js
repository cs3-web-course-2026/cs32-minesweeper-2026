// КРОК 1. Моделювання даних (Data Layer)

/**
 * Глобальний об'єкт стану гри (містить виключно необхідні поля контракту)
 */
const gameState = {
  rows: 9,              // Кількість рядків
  cols: 9,              // Кількість стовпців
  minesCount: 10,       // Кількість мін на полі
  status: 'process',    // 'process' | 'win' | 'lose'
  gameTime: 0,          // Час гри у секундах
  timerId: null         // ID таймера для clearInterval (також використовується для визначення першого ходу)
};

/**
 * Єдиний інший верхньорівневий змінюваний контейнер
 */
let board = [];

/**
 * Фабрика створення нової клітинки
 * @returns {Object} Об'єкт стану клітинки
 */
function createCell() {
  return {
    type: 'empty',      // 'empty' | 'mine'
    state: 'closed',    // 'closed' | 'opened' | 'flagged'
    neighborMines: 0    // Кількість мін навколо (0-8)
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

    if (field[randomRow][randomCol].type !== 'mine') {
      field[randomRow][randomCol].type = 'mine';
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
      if (field[row][col].type === 'mine') continue;

      let count = 0;
      for (const [offsetRow, offsetCol] of DIRECTIONS) {
        const neighborRow = row + offsetRow;
        const neighborCol = col + offsetCol;
        if (
          neighborRow >= 0 &&
          neighborRow < rowCount &&
          neighborCol >= 0 &&
          neighborCol < colCount &&
          field[neighborRow][neighborCol].type === 'mine'
        ) {
          count++;
        }
      }
      field[row][col].neighborMines = count;
    }
  }
}

/**
 * Логіка відкриття клітинки
 * @param {number} row 
 * @param {number} col 
 */
function openCell(row, col) {
  if (gameState.status !== 'process') return;
  if (!isValidCoordinate(row, col)) return;

  const cell = board[row][col];

  // Якщо клітинка вже відкрита або має прапорець — нічого не робимо
  if (cell.state === 'opened' || cell.state === 'flagged') return;

  // Запуск таймера при першій взаємодії (gameState.timerId === null)
  if (gameState.timerId === null) {
    startTimer();
  }

  // Якщо натрапили на міну -> поразка
  if (cell.type === 'mine') {
    gameState.status = 'lose';
    cell.state = 'opened';
    stopTimer();
    revealAllMines();
    render({ row, col });
    return;
  }

  // Відкриваємо безпечну клітинку
  cell.state = 'opened';

  // Якщо навколо немає мін (neighborMines === 0) — каскадне (рекурсивне) відкриття сусідів
  if (cell.neighborMines === 0) {
    for (const [dr, dc] of DIRECTIONS) {
      const nr = row + dr;
      const nc = col + dc;
      if (isValidCoordinate(nr, nc)) {
        const neighbor = board[nr][nc];
        if (neighbor.state === 'closed' && neighbor.type !== 'mine') {
          openCell(nr, nc);
        }
      }
    }
  }

  // Перевірка умови перемоги
  checkWinCondition();
  render();
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
      if (board[row] && board[row][col].state === 'flagged') {
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
  if (gameState.status !== 'process') return;
  if (!isValidCoordinate(row, col)) return;

  const cell = board[row][col];

  // Не можна ставити прапорець на відкриту клітинку
  if (cell.state === 'opened') return;

  if (gameState.timerId === null) {
    startTimer();
  }

  if (cell.state === 'closed') {
    // Дозволяємо встановлення тільки якщо ліміт прапорців не вичерпано
    if (countPlacedFlags() < gameState.minesCount) {
      cell.state = 'flagged';
    } else {
      return;
    }
  } else if (cell.state === 'flagged') {
    cell.state = 'closed';
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
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// КРОК 5. Рендеринг ігрового поля (DOM)

/**
 * Відображення сітки поля у DOM у вигляді інтерактивних доступних кнопок
 * @param {Object|null} explodedCell Координати клітинки вибуху {row, col}
 */
function renderBoard(explodedCell = null) {
  const boardElement = document.querySelector('.board');
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
      if (cell.state === 'closed') {
        cellElement.classList.add('closed');
        cellElement.setAttribute('aria-label', `Закрита клітинка, рядок ${row + 1}, колонка ${col + 1}`);
      }
      // 2. Прапорець
      else if (cell.state === 'flagged') {
        if (gameState.status === 'lose' && cell.type !== 'mine') {
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
      else if (cell.state === 'opened') {
        if (cell.type === 'mine') {
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
 */
function updateStats() {
  // Оновлення таймера
  const timerElement = document.querySelector('.header-timer .stat-value');
  if (timerElement) {
    timerElement.textContent = formatTime(gameState.gameTime);
  }

  // Оновлення лічильника прапорців
  const flagElement = document.querySelector('.header-flag .stat-value');
  if (flagElement) {
    const remainingFlags = gameState.minesCount - countPlacedFlags();
    flagElement.textContent = remainingFlags;
  }

  // Оновлення іконки на кнопці рестарту
  const btnIcon = document.querySelector('.btn-start .btn-icon');
  if (btnIcon) {
    if (gameState.status === 'win') {
      btnIcon.textContent = '😎';
    } else if (gameState.status === 'lose') {
      btnIcon.textContent = '😵';
    } else {
      btnIcon.textContent = '🙂';
    }
  }

  // Оновлення доступного текстового статусу гри для скрінрідерів
  const statusElement = document.querySelector('.game-status');
  if (statusElement) {
    if (gameState.status === 'win') {
      statusElement.textContent = 'Перемога! Всі безпечні клітинки успішно відкрито.';
      statusElement.className = 'game-status win';
    } else if (gameState.status === 'lose') {
      statusElement.textContent = 'Поразка! Ви підірвалися на міні.';
      statusElement.className = 'game-status lose';
    } else {
      statusElement.textContent = '';
      statusElement.className = 'game-status';
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
  const boardElement = document.querySelector('.board');
  const btnStart = document.querySelector('.btn-start');

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
  if (btnStart) {
    btnStart.addEventListener('click', () => {
      initGame();
    });
  }
}

// КРОК 8. Завершення гри (Win / Lose)

/**
 * Відкриття всіх мін при поразці
 */
function revealAllMines() {
  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cell = board[r][c];
      if (cell.type === 'mine') {
        cell.state = 'opened';
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

  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cell = board[r][c];
      if (cell.type !== 'mine' && cell.state === 'opened') {
        openedSafeCells++;
      }
    }
  }

  if (openedSafeCells === totalSafeCells) {
    gameState.status = 'win';
    stopTimer();

    // Автоматично позначаємо всі міни прапорцями при перемозі
    for (let r = 0; r < gameState.rows; r++) {
      for (let c = 0; c < gameState.cols; c++) {
        if (board[r][c].type === 'mine') {
          board[r][c].state = 'flagged';
        }
      }
    }
  }
}

// Ініціалізація нової гри

/**
 * Повний запуск/перезапуск гри
 */
function initGame() {
  resetTimer();
  gameState.status = 'process';
  board = generateField(gameState.rows, gameState.cols, gameState.minesCount);
  countNeighbourMines(board);
  render();
}

// Автоматичний старт після завантаження DOM
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  initGame();
});