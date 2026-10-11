// КРОК 1. Моделювання даних (Data Layer)

/**
 * Глобальний об'єкт стану гри
 */
const gameState = {
  rows: 9,              // Кількість рядків (9x9 для стандартного поля)
  cols: 9,              // Кількість стовпців
  minesCount: 10,       // Кількість мін на полі
  status: 'process',    // 'process' | 'win' | 'lose'
  gameTime: 0,          // Час гри у секундах
  timerId: null,        // ID таймера для clearInterval
  board: [],            // Двовимірний масив об'єктів клітинок
  explodedCell: null,   // Координати клітинки, на якій підірвався гравець {row, col}
  isTimerStarted: false // Прапорець запуску таймера після першого кліку
};

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
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push(createCell());
    }
    field.push(row);
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
 * @param {Array<Array<Object>>} board 
 */
function countNeighbourMines(board) {
  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      if (board[r][c].type === 'mine') continue;

      let count = 0;
      for (const [dr, dc] of DIRECTIONS) {
        const nr = r + dr;
        const nc = c + dc;
        if (isValidCoordinate(nr, nc) && board[nr][nc].type === 'mine') {
          count++;
        }
      }
      board[r][c].neighborMines = count;
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

  const cell = gameState.board[row][col];

  // Якщо клітинка вже відкрита або має прапорець — нічого не робимо
  if (cell.state === 'opened' || cell.state === 'flagged') return;

  // Запуск таймера при першій взаємодії
  if (!gameState.isTimerStarted) {
    startTimer();
  }

  // Якщо натрапили на міну -> поразка
  if (cell.type === 'mine') {
    gameState.status = 'lose';
    gameState.explodedCell = { row, col };
    cell.state = 'opened';
    stopTimer();
    revealAllMines();
    render();
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
        const neighbor = gameState.board[nr][nc];
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
 * Перемикання прапорця на клітинці
 * @param {number} row 
 * @param {number} col 
 */
function toggleFlag(row, col) {
  if (gameState.status !== 'process') return;
  if (!isValidCoordinate(row, col)) return;

  const cell = gameState.board[row][col];

  // Не можна ставити прапорець на відкриту клітинку
  if (cell.state === 'opened') return;

  if (!gameState.isTimerStarted) {
    startTimer();
  }

  if (cell.state === 'closed') {
    cell.state = 'flagged';
  } else if (cell.state === 'flagged') {
    cell.state = 'closed';
  }

  render();
}

/**
 * Запуск таймера
 */
function startTimer() {
  if (gameState.timerId) clearInterval(gameState.timerId);
  gameState.isTimerStarted = true;
  gameState.timerId = setInterval(() => {
    gameState.gameTime++;
    updateStats();
  }, 1000);
}

/**
 * Зупинка таймера
 */
function stopTimer() {
  if (gameState.timerId) {
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
  gameState.isTimerStarted = false;
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
 * Відображення сітки поля у DOM
 */
function renderBoard() {
  const boardElement = document.querySelector('.board');
  if (!boardElement) return;

  // Очищаємо вміст сітки
  boardElement.innerHTML = '';

  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cell = gameState.board[r][c];
      const cellElement = document.createElement('div');
      cellElement.classList.add('cell');
      cellElement.dataset.row = r;
      cellElement.dataset.col = c;

      // 1. Закрита клітинка
      if (cell.state === 'closed') {
        cellElement.classList.add('closed');
      }
      // 2. Прапорець
      else if (cell.state === 'flagged') {
        // Якщо гра завершилась поразкою і прапорець стояв помилково (не на міні)
        if (gameState.status === 'lose' && cell.type !== 'mine') {
          cellElement.classList.add('flagged-wrong');
          cellElement.textContent = '❌';
          cellElement.title = 'Помилковий прапорець (без міни)';
        } else {
          cellElement.classList.add('flagged');
          cellElement.textContent = '🚩';
          cellElement.title = 'Прапорець на міні';
        }
      }
      // 3. Відкрита клітинка
      else if (cell.state === 'opened') {
        if (cell.type === 'mine') {
          // Якщо це саме та міна, на якій гравець програв
          if (
            gameState.explodedCell &&
            gameState.explodedCell.row === r &&
            gameState.explodedCell.col === c
          ) {
            cellElement.classList.add('mine-exploded');
            cellElement.textContent = '💥';
            cellElement.title = 'Міна, на яку наступив гравець';
          } else {
            cellElement.classList.add('mine');
            cellElement.textContent = '💣';
            cellElement.title = 'Відкрита міна';
          }
        } else {
          // Порожня клітинка або цифра
          cellElement.classList.add('open');
          if (cell.neighborMines === 0) {
            cellElement.classList.add('empty');
          } else {
            cellElement.classList.add(`num-${cell.neighborMines}`);
            cellElement.textContent = cell.neighborMines;
          }
        }
      }

      boardElement.appendChild(cellElement);
    }
  }
}

// КРОК 6. Динамічні елементи інтерфейсу

/**
 * Оновлення лічильників (таймер, прапорці) та кнопки статусу
 */
function updateStats() {
  // Оновлення таймера
  const timerElement = document.querySelector('.header-timer .stat-value');
  if (timerElement) {
    timerElement.textContent = formatTime(gameState.gameTime);
  }

  // Підрахунок встановлених прапорців
  let placedFlags = 0;
  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      if (gameState.board[r] && gameState.board[r][c].state === 'flagged') {
        placedFlags++;
      }
    }
  }

  // Оновлення лічильника прапорців
  const flagElement = document.querySelector('.header-flag .stat-value');
  if (flagElement) {
    const remainingFlags = gameState.minesCount - placedFlags;
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
}

/**
 * Загальна функція синхронізації DOM з gameState
 */
function render() {
  renderBoard();
  updateStats();
}

// КРОК 7. Обробка подій користувача (Mouse Events)

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
      const cell = gameState.board[r][c];
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
      const cell = gameState.board[r][c];
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
        if (gameState.board[r][c].type === 'mine') {
          gameState.board[r][c].state = 'flagged';
        }
      }
    }
  }
}

// Ініціалізація нової гри
function initGame() {
  resetTimer();
  gameState.status = 'process';
  gameState.explodedCell = null;
  gameState.board = generateField(gameState.rows, gameState.cols, gameState.minesCount);
  countNeighbourMines(gameState.board);
  render();
}

// Автоматичний старт після завантаження DOM
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  initGame();
});