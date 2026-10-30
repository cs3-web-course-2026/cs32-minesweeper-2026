'use strict';

// Основний стан гри
const gameState = {
  rows: 10,
  cols: 10,
  minesCount: 15,
  status: 'process',
  gameTime: 0,
  timerId: null,
  field: [],
  started: false
};

const boardElement = document.querySelector('#board');
const timerElement = document.querySelector('#timer');
const mineCounterElement = document.querySelector('#mine-counter');
const messageElement = document.querySelector('.game-message');
const restartButton = document.querySelector('#restart-button');

const NEIGHBOUR_OFFSETS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],             [0, 1],
  [1, -1],  [1, 0],   [1, 1]
];
const DEFAULT_MESSAGE = 'Відкрий клітинку, щоб почати гру. Правий клік - поставити прапорець.';

// Створює двовимірний масив клітинок і випадково розміщує міни
function generateField(rows, cols, minesCount) {
  const field = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      type: 'empty',
      state: 'closed',
      neighborMines: 0
    }))
  );

  let placedMines = 0;
  while (placedMines < minesCount) {
    const row = Math.floor(Math.random() * rows);
    const col = Math.floor(Math.random() * cols);

    // Не дозволяємо розмістити дві міни в одній клітинці
    if (field[row][col].type !== 'mine') {
      field[row][col].type = 'mine';
      placedMines += 1;
    }
  }

  return field;
}

// Повертає координати сусідів, які перебувають у межах поля
function getNeighbours(row, col) {
  return NEIGHBOUR_OFFSETS
    .map(([rowOffset, colOffset]) => [row + rowOffset, col + colOffset])
    .filter(([nextRow, nextCol]) =>
      nextRow >= 0 &&
      nextRow < gameState.rows &&
      nextCol >= 0 &&
      nextCol < gameState.cols
    );
}

// Для кожної безпечної клітинки рахує кількість мін навколо неї
function countNeighbourMines(field) {
  for (let row = 0; row < gameState.rows; row += 1) {
    for (let col = 0; col < gameState.cols; col += 1) {
      const cell = field[row][col];

      if (cell.type === 'mine') continue;

      cell.neighborMines = getNeighbours(row, col)
        .filter(([nextRow, nextCol]) => field[nextRow][nextCol].type === 'mine')
        .length;
    }
  }
}

// Запускає таймер лише один раз після першої дії користувача
function startTimer() {
  if (gameState.timerId !== null || gameState.status !== 'process') return;

  gameState.timerId = setInterval(() => {
    gameState.gameTime += 1;
    updateTimer();
  }, 1000);
}

function stopTimer() {
  if (gameState.timerId !== null) {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
  }
}

function updateTimer() {
  timerElement.textContent = String(gameState.gameTime).padStart(3, '0');
}

// Кількість прапорців, які ще можна поставити
function updateMineCounter() {
  const flagsCount = gameState.field.flat()
    .filter((cell) => cell.state === 'flagged').length;

  mineCounterElement.textContent = String(gameState.minesCount - flagsCount);
}

// Відкриває клітинку, для порожніх клітинок рекурсивно відкриває всіх закритих сусідів
function openCell(row, col) {
  if (gameState.status !== 'process') return;
  if (!isInsideField(row, col)) return;

  const cell = gameState.field[row][col];

  // Якщо клітинка вже відкрита або на ній прапорець — нічого не робимо
  if (cell.state === 'opened' || cell.state === 'flagged') return;

  startTimer();
  cell.state = 'opened';

  // Якщо натрапили на міну, гра завершується
  if (cell.type === 'mine') {
    finishGame('lose', [row, col]);
    return;
  }

  // Якщо поруч немає мін, відкриваємо ВСІХ закритих сусідів
  if (cell.neighborMines === 0) {
    getNeighbours(row, col).forEach(([nextRow, nextCol]) => {
      const neighbour = gameState.field[nextRow][nextCol];
      if (neighbour.state === 'closed') {
        openCell(nextRow, nextCol);
      }
    });
  }

  checkWin();
  renderField();
}

function isInsideField(row, col) {
  return row >= 0 && row < gameState.rows &&
    col >= 0 && col < gameState.cols;
}

// Перемикає прапорець на закритій клітинці
function toggleFlag(row, col) {
  if (gameState.status !== 'process' || !isInsideField(row, col)) return;

  const cell = gameState.field[row][col];
  if (cell.state === 'opened') return;

  if (cell.state === 'flagged') {
    cell.state = 'closed';
  } else {
    const flagsCount = gameState.field.flat()
      .filter((item) => item.state === 'flagged').length;

    if (flagsCount >= gameState.minesCount) {
      messageElement.textContent = 'Усі прапорці вже використані. Зніми один, щоб поставити інший.';
      return;
    }
    cell.state = 'flagged';
    startTimer();
  }

  // Після успішного перемикання повертаємо звичайну підказку
  messageElement.textContent = DEFAULT_MESSAGE;

  updateMineCounter();
  renderField();
}

// Перевіряє, чи відкриті всі клітинки без мін
function checkWin() {
  const allSafeCellsOpened = gameState.field.flat().every((cell) =>
    cell.type === 'mine' || cell.state === 'opened'
  );

  if (allSafeCellsOpened) finishGame('win');
}

// Завершує гру та зупиняє таймер.
function finishGame(result, explodedCell = null) {
  gameState.status = result;
  stopTimer();

  if (result === 'win') {
    messageElement.textContent = `Вітаємо! Перемога за ${gameState.gameTime} с.`;
    messageElement.className = 'game-message is-win';
  } else {
    messageElement.textContent = 'Гру завершено: ти натрапив(ла) на міну☹️. Спробуй ще раз!';
    messageElement.className = 'game-message is-lose';
  }

  // Розпаковуємо масив координат [row, col], якщо він переданий
  if (Array.isArray(explodedCell)) {
    const [row, col] = explodedCell;
    renderField(row, col);
  } else {
    renderField();
  }
}

// Формує текст для скрінридерів з урахуванням стану клітинки
function getCellLabel(cell, rowIndex, colIndex) {
  const position = `Рядок ${rowIndex + 1}, стовпець ${colIndex + 1}`;

  if (cell.state === 'flagged') return `${position}, прапорець`;

  if (cell.state === 'opened') {
    if (cell.type === 'mine') return `${position}, міна`;
    if (cell.neighborMines > 0) {
      return `${position}, відкрита клітинка, мін поруч: ${cell.neighborMines}`;
    }
    return `${position}, відкрита порожня клітинка`;
  }

  if (gameState.status !== 'process' && cell.type === 'mine') {
    return `${position}, міна`;
  }

  return `${position}, закрита клітинка`;
}

// Створює HTML-клітинки на основі актуального стану масиву
function renderField(explodedRow = null, explodedCol = null) {
  const activeElement = document.activeElement;
  let activeRow = null;
  let activeCol = null;

  if (activeElement && activeElement.classList.contains('cell')) {
    activeRow = activeElement.dataset.row;
    activeCol = activeElement.dataset.col;
  }

  const fragment = document.createDocumentFragment();

  gameState.field.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cell';
      button.dataset.row = String(rowIndex);
      button.dataset.col = String(colIndex);

      const isExploded = explodedRow === rowIndex && explodedCol === colIndex;

        if (cell.state === 'opened') {
        button.classList.add('cell-opened');

        if (cell.type === 'mine') {
          button.classList.add(isExploded ? 'cell-mine-hit' : 'cell-mine');
          button.textContent = '💣';
        } else if (cell.neighborMines > 0) {
          button.textContent = String(cell.neighborMines);
          button.classList.add(`cell-number-${cell.neighborMines}`);
        } else {
          button.textContent = '';
        }
      } else if (cell.state === 'flagged') {
        button.classList.add('cell-flagged');
        button.textContent = '🚩';
      } else if (gameState.status !== 'process' && cell.type === 'mine') {
        button.classList.add('cell-opened', 'cell-mine');
        button.textContent = '💣';
      }

      button.setAttribute('aria-label', getCellLabel(cell, rowIndex, colIndex));

      if (gameState.status !== 'process') {
        button.disabled = true;
      }

      fragment.appendChild(button);
    });
  });

  boardElement.replaceChildren(fragment);

  // Відновлюємо фокус на клітинці після перемальовки поля
  if (activeRow !== null && activeCol !== null) {
    const newActiveCell = boardElement.querySelector(
      `[data-row="${activeRow}"][data-col="${activeCol}"]`
    );
    if (newActiveCell && !newActiveCell.disabled) {
      newActiveCell.focus();
    }
  }

  updateMineCounter();
  updateTimer();
}

// Скидає стан і створює нову гру
function startNewGame() {
  stopTimer();

  gameState.status = 'process';
  gameState.gameTime = 0;
  gameState.started = false;
  gameState.field = generateField(gameState.rows, gameState.cols, gameState.minesCount);
  countNeighbourMines(gameState.field);
  messageElement.textContent = DEFAULT_MESSAGE;
  messageElement.className = 'game-message';

  renderField();
}

// Делегування подій: обробляємо кліки на полі через один обробник
boardElement.addEventListener('click', (event) => {
  const cellElement = event.target.closest('.cell');
  if (!cellElement || !boardElement.contains(cellElement)) return;

  const row = Number(cellElement.dataset.row);
  const col = Number(cellElement.dataset.col);
  openCell(row, col);
});

// Вимикаємо стандартне контекстне меню та ставимо/знімаємо прапорець
boardElement.addEventListener('contextmenu', (event) => {
  event.preventDefault();

  const cellElement = event.target.closest('.cell');
  if (!cellElement || !boardElement.contains(cellElement)) return;

  const row = Number(cellElement.dataset.row);
  const col = Number(cellElement.dataset.col);
  toggleFlag(row, col);
});

restartButton.addEventListener('click', startNewGame);

// Початкове створення поля
startNewGame();
