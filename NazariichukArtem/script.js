const gameState = {
  rows: 9,
  cols: 9,
  minesCount: 10,
  status: 'process',
  gameTime: 0,
  timerId: null,
  flaggedCount: 0,
};

let board = [];

const gridContainer = document.querySelector('.game-grid');
const restartBtn = document.querySelector('.restart-btn');
const timerDisplay = document.querySelector('.timer');
const counterDisplay = document.querySelector('.counter');
document.addEventListener('DOMContentLoaded', () => {
  initGame();
  restartBtn.addEventListener('click', initGame);
});

function initGame() {
  if (gameState.timerId) {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
  }
  gameState.status = 'process';
  gameState.gameTime = 0;
  gameState.flaggedCount = 0;
  updateTimerDisplay();
  updateCounterDisplay();
  board = generateField(gameState.rows, gameState.cols, gameState.minesCount);
  countNeighbourMines();
  renderBoard();
}

// Крок 2: Функція генерації поля
function generateField(rows, cols, minesCount) {
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push({
        type: 'empty',
        state: 'closed',
        neighborMines: 0,
        row: r,
        col: c
      });
    }
    grid.push(row);
  }
  let placedMines = 0;
  while (placedMines < minesCount) {
    const randomRow = Math.floor(Math.random() * rows);
    const randomCol = Math.floor(Math.random() * cols);

    if (grid[randomRow][randomCol].type !== 'mine') {
      grid[randomRow][randomCol].type = 'mine';
      placedMines++;
    }
  }

  return grid;
}

// Крок 3: Підрахунок сусідніх мін
function countNeighbourMines() {
  const rows = gameState.rows;
  const cols = gameState.cols;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].type === 'mine') continue;

      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;

          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            if (board[nr][nc].type === 'mine') {
              count++;
            }
          }
        }
      }
      board[r][c].neighborMines = count;
    }
  }
}

// Крок 4: Запуск та оновлення таймера
function startTimer() {
  if (gameState.timerId) return;
  gameState.timerId = setInterval(() => {
    if (gameState.status === 'process') {
      gameState.gameTime++;
      updateTimerDisplay();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const formattedTime = String(gameState.gameTime).padStart(3, '0');
  timerDisplay.innerHTML = `<span class="icon">&#9201;</span> ${formattedTime}`;
}

function updateCounterDisplay() {
  const remainingMines = gameState.minesCount - gameState.flaggedCount;
  const formattedMines = String(Math.max(0, remainingMines)).padStart(3, '0');
  counterDisplay.innerHTML = `<span class="icon">&#9873;</span> ${formattedMines}`;
}

// Крок 5: Рендеринг ігрового поля в DOM
function renderBoard() {
  gridContainer.innerHTML = '';
  gridContainer.style.gridTemplateColumns = `repeat(${gameState.cols}, 36px)`;
  gridContainer.style.gridTemplateRows = `repeat(${gameState.rows}, 36px)`;

  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cellData = board[r][c];
      const cellBtn = document.createElement('button');
      cellBtn.type = 'button';
      cellBtn.className = 'cell closed';
      if (cellData.state === 'opened') {
        cellBtn.classList.remove('closed');
        cellBtn.classList.add('open');
        if (cellData.type === 'mine') {
          cellBtn.classList.add('mine');
          cellBtn.innerHTML = '&#9673;';
        } else if (cellData.neighborMines > 0) {
          cellBtn.classList.add(`num-${cellData.neighborMines}`);
          cellBtn.textContent = cellData.neighborMines;
        }
      } else if (cellData.state === 'flagged') {
        cellBtn.classList.add('flagged');
        cellBtn.innerHTML = '&#9873;';
      }
      cellBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleCellClick(r, c);
      });
      cellBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handleCellRightClick(r, c);
      });

      gridContainer.appendChild(cellBtn);
    }
  }
}

// Крок 7: Обробка лівого кліку (відкриття клітинки)
function handleCellClick(row, col) {
  if (gameState.status !== 'process') return;
  if (gameState.gameTime === 0 && !gameState.timerId) {
    startTimer();
  }

  const cell = board[row][col];
  if (cell.state === 'opened' || cell.state === 'flagged') return;

  openCell(row, col);
  checkGameWinLose();
  renderBoard();
}

function openCell(row, col) {
  const cell = board[row][col];
  if (cell.state === 'opened' || cell.state === 'flagged') return;
  cell.state = 'opened';
  if (cell.type === 'mine') {
    gameState.status = 'lose';
    revealAllMines();
    stopGame();
    alert('Гра закінчена! Ви підірвалися на міні.');
    return;
  }

  if (cell.neighborMines === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;

        if (nr >= 0 && nr < gameState.rows && nc >= 0 && nc < gameState.cols) {
          if (board[nr][nc].state === 'closed') {
            openCell(nr, nc);
          }
        }
      }
    }
  }
}

// Крок 4 & 7: Прапорці toggleFlag через правий клік
function handleCellRightClick(row, col) {
  if (gameState.status !== 'process') return;

  const cell = board[row][col];
  if (cell.state === 'opened') return;

  if (cell.state === 'closed') {
    cell.state = 'flagged';
    gameState.flaggedCount++;
  } else if (cell.state === 'flagged') {
    cell.state = 'closed';
    gameState.flaggedCount--;
  }

  updateCounterDisplay();
  renderBoard();
}

function stopGame() {
  if (gameState.timerId) {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
  }
}

function revealAllMines() {
  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      if (board[r][c].type === 'mine') {
        board[r][c].state = 'opened';
      }
    }
  }
}

// Крок 8: Перевірка умови перемоги
function checkGameWinLose() {
  if (gameState.status === 'lose') return;

  let allSafeOpened = true;
  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cell = board[r][c];
      if (cell.type === 'empty' && cell.state !== 'opened') {
        allSafeOpened = false;
        break;
      }
    }
  }

  if (allSafeOpened) {
    gameState.status = 'win';
    stopGame();
    alert('Вітаємо! Ви успішно пройшли гру!');
  }
}