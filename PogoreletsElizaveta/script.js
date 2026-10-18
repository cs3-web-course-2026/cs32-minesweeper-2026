
// Моделювання даних
const gameState = {
  boardSize: 6,
  minesCount: 6,
  board: [],
  status: 'process', // 'process' | 'win' | 'lose'
  timer: 0,
  timerId: null,
  flagsCount: 6
};

// Елементи DOM
const boardElement = document.querySelector('.game-board');
const timerElement = document.getElementById('timer');
const flagsElement = document.getElementById('flags-count');
const startBtnElement = document.getElementById('start-btn');

// Форматування чисел для відображення (наприклад, 005)
function formatNumber(num) {
  return String(Math.max(0, num)).padStart(3, '0');
}

// Ініціалізація та розстановка мін
function initBoard(size, minesCount) {
  gameState.board = [];

  // Створення порожнього поля
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) {
      row.push({
        type: 'empty', // 'empty' | 'mine'
        minesAround: 0,
        state: 'closed' // 'closed' | 'opened' | 'flagged'
      });
    }
    gameState.board.push(row);
  }

  // Випадкова розстановка мін
  let placedMines = 0;
  while (placedMines < minesCount) {
    const r = Math.floor(Math.random() * size);
    const c = Math.floor(Math.random() * size);

    if (gameState.board[r][c].type !== 'mine') {
      gameState.board[r][c].type = 'mine';
      placedMines++;
    }
  }

  // Підрахунок сусідніх мін для кожної клітинки
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (gameState.board[r][c].type === 'mine') continue;

      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;

          if (
            nr >= 0 &&
            nr < size &&
            nc >= 0 &&
            nc < size &&
            gameState.board[nr][nc].type === 'mine'
          ) {
            count++;
          }
        }
      }
      gameState.board[r][c].minesAround = count;
    }
  }
}

// Таймер
function startTimer() {
  stopTimer();
  gameState.timer = 0;
  timerElement.textContent = formatNumber(gameState.timer);

  gameState.timerId = setInterval(() => {
    gameState.timer++;
    timerElement.textContent = formatNumber(gameState.timer);
  }, 1000);
}

function stopTimer() {
  if (gameState.timerId !== null) {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
  }
}

// Логіка відкриття клітинок (Reveal & Рекурсія)
function openCell(r, c) {
  if (gameState.status !== 'process') return;

  const cell = gameState.board[r][c];
  if (cell.state === 'opened' || cell.state === 'flagged') return;

  // Запуск таймера при першому кліку
  if (gameState.timer === 0 && gameState.timerId === null) {
    startTimer();
  }

  // Поразка 
  if (cell.type === 'mine') {
    cell.state = 'opened';
    cell.exploded = true;
    handleGameOver(false);
    return;
  }

  // Відкриття безпечної клітинки
  cell.state = 'opened';

  // Рекурсивне відкриття сусідніх порожніх клітинок 
  if (cell.minesAround === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;

        if (
          nr >= 0 &&
          nr < gameState.boardSize &&
          nc >= 0 &&
          nc < gameState.boardSize
        ) {
          if (gameState.board[nr][nc].state === 'closed') {
            openCell(nr, nc);
          }
        }
      }
    }
  }

  checkWinCondition();
  renderBoard();
}

// Логіка прапорців
function toggleFlag(r, c) {
  if (gameState.status !== 'process') return;

  const cell = gameState.board[r][c];
  if (cell.state === 'opened') return;

  if (cell.state === 'flagged') {
    cell.state = 'closed';
    gameState.flagsCount++;
  } else if (cell.state === 'closed') {
    if (gameState.flagsCount > 0) {
      cell.state = 'flagged';
      gameState.flagsCount--;
    }
  }

  flagsElement.textContent = formatNumber(gameState.flagsCount);
  renderBoard();
}

// Перевірка перемоги / поразки
function checkWinCondition() {
  let unopendSafeCells = 0;

  for (let r = 0; r < gameState.boardSize; r++) {
    for (let c = 0; c < gameState.boardSize; c++) {
      const cell = gameState.board[r][c];
      if (cell.type !== 'mine' && cell.state !== 'opened') {
        unopendSafeCells++;
      }
    }
  }

  if (unopendSafeCells === 0) {
    handleGameOver(true);
  }
}

function handleGameOver(isWin) {
  stopTimer();
  gameState.status = isWin ? 'win' : 'lose';

  // Відкриття всіх мін після завершення гри
  for (let r = 0; r < gameState.boardSize; r++) {
    for (let c = 0; c < gameState.boardSize; c++) {
      const cell = gameState.board[r][c];
      if (cell.type === 'mine') {
        if (cell.state !== 'flagged') {
          cell.state = 'opened';
        }
      }
    }
  }

  startBtnElement.textContent = isWin ? '😎' : '😵';
  renderBoard();

  setTimeout(() => {
    alert(isWin ? 'Вітаємо! Ви виграли! 🎉' : 'Гра закінчена! Ви підірвалися на міні. 💣');
  }, 100);
}

// Рендеринг ігрового поля у DOM та обробка подій
function renderBoard() {
  boardElement.innerHTML = '';

  for (let r = 0; r < gameState.boardSize; r++) {
    for (let c = 0; c < gameState.boardSize; c++) {
      const cellData = gameState.board[r][c];
      const button = document.createElement('button');
      button.type = 'button';
      button.classList.add('cell');

      if (cellData.state === 'opened') {
        button.classList.add('reveal');

        if (cellData.type === 'mine') {
          button.classList.add('mine');
          if (cellData.exploded) {
            button.classList.add('exploded');
          }
          button.textContent = '💣';
          button.setAttribute('aria-label', 'Mine');
        } else if (cellData.minesAround > 0) {
          button.classList.add(`num-${cellData.minesAround}`);
          button.textContent = cellData.minesAround;
          button.setAttribute('aria-label', `Opened cell, ${cellData.minesAround} mine(s) nearby`);
        } else {
          button.setAttribute('aria-label', 'Empty opened cell');
        }
      } else if (cellData.state === 'flagged') {
        button.classList.add('flag');
        button.textContent = '🚩';
        button.setAttribute('aria-label', 'Flag');
      } else {
        button.setAttribute('aria-label', 'Closed cell');
      }

      // Лiвий клiк (Open)
      button.addEventListener('click', () => {
        openCell(r, c);
      });

      // Правий клiк (Flag)
      button.addEventListener('contextmenu', (e) => {
        e.preventDefault(); // Блокування стандартного контекстного меню
        toggleFlag(r, c);
      });

      boardElement.appendChild(button);
    }
  }
}

// Запуск нової гри
function resetGame() {
  stopTimer();
  gameState.status = 'process';
  gameState.timer = 0;
  gameState.flagsCount = gameState.minesCount;

  timerElement.textContent = formatNumber(0);
  flagsElement.textContent = formatNumber(gameState.flagsCount);
  startBtnElement.textContent = '🤓';

  initBoard(gameState.boardSize, gameState.minesCount);
  renderBoard();
}

// Початкова ініціалізація та прив'язка подій
startBtnElement.addEventListener('click', resetGame);
window.addEventListener('DOMContentLoaded', resetGame);