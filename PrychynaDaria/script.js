//   DATA LAYER (Крок 1)  

const gameState = {
  rows: 10,
  cols: 10,
  minesCount: 15,
  status: 'process', // 'process' | 'win' | 'lose'
  gameTime: 0,
  timerId: null,
  flagsUsed: 0,
  field: []
};

// Зсуви координат для перевірки 8 сусідів
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

//   BUSINESS LOGIC (Кроки 2, 3, 4, 8)  

/**
 * Перевірка, чи не виходять координати за межі поля
 */
function isValidCell(row, col) {
  return row >= 0 && row < gameState.rows && col >= 0 && col < gameState.cols;
}

/**
 * Генерація поля та розміщення мін (Крок 2)
 */
function generateField(rows, cols, minesCount) {
  const grid = [];

  // 1. Ініціалізація порожнього поля
  for (let r = 0; r < rows; r += 1) {
    const row = [];
    for (let c = 0; c < cols; c += 1) {
      row.push({
        type: 'empty',
        state: 'closed',
        neighborMines: 0
      });
    }
    grid.push(row);
  }

  // 2. Випадкова розстановка мін без дублікатів
  let placedMines = 0;
  while (placedMines < minesCount) {
    const randRow = Math.floor(Math.random() * rows);
    const randCol = Math.floor(Math.random() * cols);

    if (grid[randRow][randCol].type !== 'mine') {
      grid[randRow][randCol].type = 'mine';
      placedMines += 1;
    }
  }

  return grid;
}

/**
 * Підрахунок кількості мін навколо кожної клітинки (Крок 3)
 */
function countNeighbourMines() {
  for (let r = 0; r < gameState.rows; r += 1) {
    for (let c = 0; c < gameState.cols; c += 1) {
      if (gameState.field[r][c].type === 'mine') {
        continue;
      }

      let minesAround = 0;
      for (const [dr, dc] of DIRECTIONS) {
        const nr = r + dr;
        const nc = c + dc;
        if (isValidCell(nr, nc) && gameState.field[nr][nc].type === 'mine') {
          minesAround += 1;
        }
      }
      gameState.field[r][c].neighborMines = minesAround;
    }
  }
}

/**
 * Перевірка умови перемоги (Крок 8)
 * Перемога настає, коли відкриті всі клітинки, окрім мін
 */
function checkWinCondition() {
  const totalCells = gameState.rows * gameState.cols;
  let openedCells = 0;

  for (let r = 0; r < gameState.rows; r += 1) {
    for (let c = 0; c < gameState.cols; c += 1) {
      if (gameState.field[r][c].state === 'opened') {
        openedCells += 1;
      }
    }
  }

  return openedCells === totalCells - gameState.minesCount;
}

/**
 * Розкриття всіх мін у разі поразки або перемоги
 */
function revealAllMines(isWin) {
  for (let r = 0; r < gameState.rows; r += 1) {
    for (let c = 0; c < gameState.cols; c += 1) {
      const cell = gameState.field[r][c];
      if (cell.type === 'mine') {
        if (isWin) {
          cell.state = 'flagged';
        } else if (cell.state !== 'flagged') {
          cell.state = 'opened';
        }
      } else if (!isWin && cell.state === 'flagged') {
        // Помилково встановлений прапорець
        cell.type = 'misflagged';
      }
    }
  }
}

/**
 * Рекурсивне відкриття клітинок (Крок 3)
 */
function openCell(row, col) {
  if (!isValidCell(row, col)) return;

  const cell = gameState.field[row][col];
  if (cell.state === 'opened' || cell.state === 'flagged') {
    return;
  }

  // Запуск таймера при першому ході
  if (gameState.gameTime === 0 && !gameState.timerId && gameState.status === 'process') {
    startTimer();
  }

  // Клік на міну — поразка
  if (cell.type === 'mine') {
    cell.state = 'opened';
    cell.exploded = true;
    gameState.status = 'lose';
    stopTimer();
    revealAllMines(false);
    return;
  }

  // Відкриття безпечної клітинки
  cell.state = 'opened';

  // Якщо мін навколо немає — рекурсивно відкриваємо всіх 8 сусідів
  if (cell.neighborMines === 0) {
    for (const [dr, dc] of DIRECTIONS) {
      openCell(row + dr, col + dc);
    }
  }

  // Перевірка на перемогу після ходу
  if (checkWinCondition()) {
    gameState.status = 'win';
    stopTimer();
    revealAllMines(true);
  }
}

/**
 * Встановлення / зняття прапорця (Крок 4)
 */
function toggleFlag(row, col) {
  const cell = gameState.field[row][col];
  if (cell.state === 'opened' || gameState.status !== 'process') {
    return;
  }

  if (cell.state === 'closed') {
    if (gameState.flagsUsed < gameState.minesCount) {
      cell.state = 'flagged';
      gameState.flagsUsed += 1;
    }
  } else if (cell.state === 'flagged') {
    cell.state = 'closed';
    gameState.flagsUsed -= 1;
  }
}

/**
 * Керування таймером (Крок 4)
 */
function startTimer() {
  if (gameState.timerId) return;
  gameState.timerId = setInterval(() => {
    gameState.gameTime += 1;
    renderIndicators();
  }, 1000);
}

function stopTimer() {
  if (gameState.timerId) {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
  }
}

//   DOM / PRESENTATION LAYER (Кроки 5, 6, 7)  

const elements = {
  grid: document.getElementById('minefield'),
  minesCounter: document.getElementById('flags-counter'),
  timerDisplay: document.getElementById('timer-display'),
  resetButton: document.getElementById('reset-btn'),
  faceIcon: document.getElementById('face-icon')
};

/**
 * Форматування 3-значного числа для цифрового табло (наприклад: 015, 002)
 */
function formatDigits(value) {
  const bounded = Math.max(0, Math.min(999, value));
  return String(bounded).padStart(3, '0');
}

/**
 * Оновлення лічильників та смайлика (Крок 6)
 */
function renderIndicators() {
  const remainingMines = gameState.minesCount - gameState.flagsUsed;
  elements.minesCounter.textContent = formatDigits(remainingMines);
  elements.timerDisplay.textContent = formatDigits(gameState.gameTime);

  if (gameState.status === 'win') {
    elements.faceIcon.textContent = '😎';
  } else if (gameState.status === 'lose') {
    elements.faceIcon.textContent = '😵';
  } else {
    elements.faceIcon.textContent = '🙂';
  }
}

/**
 * Динамічна генерація та оновлення сітки в DOM (Крок 5)
 */
function renderBoard() {
  elements.grid.innerHTML = '';
  elements.grid.style.setProperty('--grid-rows', gameState.rows);
  elements.grid.style.setProperty('--grid-cols', gameState.cols);

  for (let r = 0; r < gameState.rows; r += 1) {
    for (let c = 0; c < gameState.cols; c += 1) {
      const cellData = gameState.field[r][c];
      const cellBtn = document.createElement('button');
      cellBtn.type = 'button';
      cellBtn.classList.add('cell');
      cellBtn.dataset.row = r;
      cellBtn.dataset.col = c;

      if (cellData.state === 'closed') {
        cellBtn.classList.add('cell-closed');
        cellBtn.setAttribute('aria-label', `Закрита клітинка, рядок ${r + 1}, колонка ${c + 1}`);
      } else if (cellData.state === 'flagged') {
        cellBtn.classList.add('cell-closed', 'cell-flagged');
        cellBtn.textContent = '🚩';
        cellBtn.setAttribute('aria-label', 'Позначено прапорцем');
      } else if (cellData.state === 'opened') {
        cellBtn.classList.add('cell-open');

        if (cellData.type === 'mine') {
          cellBtn.textContent = '💣';
          if (cellData.exploded) {
            cellBtn.classList.add('cell-mine-exploded');
            cellBtn.setAttribute('aria-label', 'Підірвана міна');
          } else {
            cellBtn.classList.add('cell-mine');
            cellBtn.setAttribute('aria-label', 'Міна');
          }
        } else if (cellData.type === 'misflagged') {
          cellBtn.classList.add('cell-flagged-wrong');
          cellBtn.textContent = '❌';
          cellBtn.setAttribute('aria-label', 'Помилковий прапорець');
        } else {
          // Порожня клітинка або число
          if (cellData.neighborMines > 0) {
            cellBtn.textContent = cellData.neighborMines;
            cellBtn.classList.add(`cell-num-${cellData.neighborMines}`);
            cellBtn.setAttribute('aria-label', `${cellData.neighborMines} мін поруч`);
          } else {
            cellBtn.setAttribute('aria-label', 'Порожня відкрита клітинка');
          }
        }
      }

      elements.grid.appendChild(cellBtn);
    }
  }

  renderIndicators();
}

/**
 * Ініціалізація та рестарт гри
 */
function initGame() {
  stopTimer();
  gameState.status = 'process';
  gameState.gameTime = 0;
  gameState.flagsUsed = 0;
  gameState.field = generateField(gameState.rows, gameState.cols, gameState.minesCount);
  countNeighbourMines();
  renderBoard();
}

// ОБРОБКА ПОДІЙ (Крок 7)  

// Делегування подій на контейнері сітки для оптимізації продуктивності
elements.grid.addEventListener('click', (event) => {
  if (gameState.status !== 'process') return;

  const target = event.target.closest('.cell');
  if (!target) return;

  const r = parseInt(target.dataset.row, 10);
  const c = parseInt(target.dataset.col, 10);

  openCell(r, c);
  renderBoard();
});

// Правий клік — блокування контекстного меню та встановлення прапорця
elements.grid.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  if (gameState.status !== 'process') return;

  const target = event.target.closest('.cell');
  if (!target) return;

  const r = parseInt(target.dataset.row, 10);
  const c = parseInt(target.dataset.col, 10);

  toggleFlag(r, c);
  renderBoard();
});

// Кнопка рестарту
elements.resetButton.addEventListener('click', () => {
  initGame();
});

// Старт застосунку при завантаженні сторінки
document.addEventListener('DOMContentLoaded', () => {
  initGame();
});