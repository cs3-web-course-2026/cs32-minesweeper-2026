// Крок 1. Об'єкт стану гри (gameState)
const gameState = {
  rows: 10,
  cols: 10,
  minesCount: 15,
  status: 'process', // 'process' | 'win' | 'lose'
  gameTime: 0,
  timerId: null,
  board: [], // Двовимірний масив
  flagsLeft: 15,
  isFirstClick: true
};

// Елементи DOM
const boardElement = document.querySelector('.game-board');
const minesCountElement = document.getElementById('mines-count');
const timerElement = document.getElementById('timer');
const resetBtn = document.getElementById('reset-btn');

// Ініціалізація гри
function initGame() {
  clearInterval(gameState.timerId);
  gameState.status = 'process';
  gameState.gameTime = 0;
  gameState.flagsLeft = gameState.minesCount;
  gameState.isFirstClick = true;
  timerElement.textContent = '000';
  updateMinesCountDisplay();

  gameState.board = generateEmptyField(gameState.rows, gameState.cols);
  renderBoard();
}

// Крок 2. Генерація порожнього поля
function generateEmptyField(rows, cols) {
  const board = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push({
        row: r,
        col: c,
        type: 'empty', // 'empty' | 'mine'
        state: 'closed', // 'closed' | 'opened' | 'flagged'
        neighborMines: 0
      });
    }
    board.push(row);
  }
  return board;
}

// Розстановка мін (із захистом першого кліку)
function placeMines(rows, cols, minesCount, excludeRow, excludeCol) {
  let placedMines = 0;
  while (placedMines < minesCount) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);

    if ((r === excludeRow && c === excludeCol) || gameState.board[r][c].type === 'mine') {
      continue;
    }

    gameState.board[r][c].type = 'mine';
    placedMines++;
  }
  countNeighbourMines();
}

// Крок 3. Підрахунок сусідніх мін (countNeighbourMines)
function countNeighbourMines() {
  const rows = gameState.rows;
  const cols = gameState.cols;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (gameState.board[r][c].type === 'mine') continue;

      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            if (gameState.board[nr][nc].type === 'mine') {
              count++;
            }
          }
        }
      }
      gameState.board[r][c].neighborMines = count;
    }
  }
}

// Крок 3 & 7. Логіка відкриття клітинки (openCell) з рекурсією
function openCell(row, col) {
  const cellData = gameState.board[row][col];

  if (gameState.status !== 'process') return;
  if (cellData.state === 'opened' || cellData.state === 'flagged') return;

  if (gameState.isFirstClick) {
    gameState.isFirstClick = false;
    placeMines(gameState.rows, gameState.cols, gameState.minesCount, row, col);
    startTimer();
  }

  if (cellData.type === 'mine') {
    cellData.state = 'opened';
    gameState.status = 'lose';
    stopTimer();
    revealAllMines();
    renderBoard();
    alert('Гра закінчилася! Ви підірвалися на міні 💥');
    return;
  }

  cellData.state = 'opened';

  // Рекурсивне відкриття для порожніх клітинок
  if (cellData.neighborMines === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < gameState.rows && nc >= 0 && nc < gameState.cols) {
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

// Крок 4. Робота з прапорцями (toggleFlag)
function toggleFlag(row, col) {
  const cellData = gameState.board[row][col];
  if (gameState.status !== 'process' || cellData.state === 'opened') return;

  if (cellData.state === 'closed' && gameState.flagsLeft > 0) {
    cellData.state = 'flagged';
    gameState.flagsLeft--;
  } else if (cellData.state === 'flagged') {
    cellData.state = 'closed';
    gameState.flagsLeft++;
  }

  updateMinesCountDisplay();
  renderBoard();
}

// Крок 4. Таймер
function startTimer() {
  gameState.timerId = setInterval(() => {
    gameState.gameTime++;
    timerElement.textContent = String(gameState.gameTime).padStart(3, '0');
  }, 1000);
}

function stopTimer() {
  clearInterval(gameState.timerId);
}

function updateMinesCountDisplay() {
  minesCountElement.textContent = String(gameState.flagsLeft).padStart(3, '0');
}

// Крок 8. Перевірка перемоги
function checkWinCondition() {
  let hasWon = true;
  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cell = gameState.board[r][c];
      if (cell.type === 'empty' && cell.state !== 'opened') {
        hasWon = false;
        break;
      }
    }
  }

  if (hasWon) {
    gameState.status = 'win';
    stopTimer();
    renderBoard();
    alert('Вітаємо! Ви виграли гру! 🎉');
  }
}

function revealAllMines() {
  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      if (gameState.board[r][c].type === 'mine') {
        gameState.board[r][c].state = 'opened';
      }
    }
  }
}

// Крок 5, 6 & 7. Рендеринг і обробка подій миші
function renderBoard() {
  boardElement.innerHTML = '';

  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cellData = gameState.board[r][c];
      const cellDiv = document.createElement('div');
      cellDiv.classList.add('cell');

      if (cellData.state === 'opened') {
        cellDiv.classList.add('open');
        if (cellData.type === 'mine') {
          cellDiv.classList.add('mine', 'exploded');
        } else if (cellData.neighborMines > 0) {
          cellDiv.textContent = cellData.neighborMines;
          cellDiv.classList.add(`number-${cellData.neighborMines}`);
        }
      } else if (cellData.state === 'flagged') {
        cellDiv.classList.add('flagged');
      }

      // Обробка подій (Крок 7)
      cellDiv.addEventListener('click', () => openCell(r, c));
      cellDiv.addEventListener('contextmenu', (e) => {
        e.preventDefault(); // Блокування стандартного контекстного меню
        toggleFlag(r, c);
      });

      boardElement.appendChild(cellDiv);
    }
  }
}

resetBtn.addEventListener('click', initGame);

// Запуск гри
initGame();