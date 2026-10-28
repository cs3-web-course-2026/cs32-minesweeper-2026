const ROWS = 10;
const COLS = 10;
const MINES_COUNT = 15;

// Окремий об'єкт стану згідно з контрактом лабораторної
const gameState = {
  rows: ROWS,
  cols: COLS,
  minesCount: MINES_COUNT,
  status: 'process', // 'process' | 'win' | 'lose'
  gameTime: 0,
  timerId: null,
  flagsLeft: MINES_COUNT,
  isFirstClick: true
};

let board = [];

// Елементи DOM
const boardElement = document.querySelector('.game-board');
const minesCountElement = document.getElementById('mines-count');
const timerElement = document.getElementById('timer');
const resetBtn = document.getElementById('reset-btn');
const gameStatusElement = document.getElementById('game-status');

// Ініціалізація гри
function initGame() {
  clearInterval(gameState.timerId);
  gameState.status = 'process';
  gameState.gameTime = 0;
  gameState.flagsLeft = gameState.minesCount;
  gameState.isFirstClick = true;
  timerElement.textContent = '000';
  gameStatusElement.textContent = '';
  updateMinesCountDisplay();

  board = generateField(gameState.rows, gameState.cols, gameState.minesCount);
  renderBoard();
}

function generateField(rows, cols, minesCount) {
  const newBoard = [];
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
    newBoard.push(row);
  }

  // Початкове розміщення мін з використанням параметра minesCount
  let placedMines = 0;
  while (placedMines < minesCount) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (newBoard[r][c].type !== 'mine') {
      newBoard[r][c].type = 'mine';
      placedMines++;
    }
  }

  countNeighbourMinesForBoard(newBoard, rows, cols);
  return newBoard;
}

// Перерозподіл мін із захистом першого кліку
function placeMinesWithFirstClickSafety(excludeRow, excludeCol) {
  // Якщо перша клітинка виявилась міною, перегенеруємо поле
  while (board[excludeRow][excludeCol].type === 'mine') {
    board = generateField(gameState.rows, gameState.cols, gameState.minesCount);
  }
}

// Підрахунок сусідніх мін для довільного масиву
function countNeighbourMinesForBoard(targetBoard, rows, cols) {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (targetBoard[r][c].type === 'mine') continue;

      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            if (targetBoard[nr][nc].type === 'mine') {
              count++;
            }
          }
        }
      }
      targetBoard[r][c].neighborMines = count;
    }
  }
}

// Відкриття клітинки з рекурсією
function openCell(row, col) {
  const cellData = board[row][col];

  if (gameState.status !== 'process') return;
  if (cellData.state === 'opened' || cellData.state === 'flagged') return;

  if (gameState.isFirstClick) {
    gameState.isFirstClick = false;
    if (cellData.type === 'mine') {
      placeMinesWithFirstClickSafety(row, col);
    }
    startTimer();
  }

  if (cellData.type === 'mine') {
    cellData.state = 'opened';
    cellData.isExploded = true;
    gameState.status = 'lose';
    stopTimer();
    revealAllMines();
    renderBoard();
    gameStatusElement.textContent = 'Гра закінчилася! Ви підірвалися на міні 💥';
    return;
  }

  cellData.state = 'opened';

  if (cellData.neighborMines === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
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

  checkWinCondition();
  renderBoard();
}

// Прапорці
function toggleFlag(row, col) {
  const cellData = board[row][col];
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

// Таймер
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

// Перевірка перемоги
function checkWinCondition() {
  let hasWon = true;
  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cell = board[r][c];
      if (cell.type === 'empty' && cell.state !== 'opened') {
        hasWon = false;
        break;
      }
    }
  }

  if (hasWon && gameState.status === 'process') {
    gameState.status = 'win';
    stopTimer();
    renderBoard();
    gameStatusElement.textContent = 'Вітаємо! Ви виграли гру! 🎉';
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

// Рендеринг сітки із збереженням фокусу клавіатури та повною доступністю (a11y)
function renderBoard() {
  const activeElement = document.activeElement;
  const focusedIndex = activeElement && activeElement.parentElement === boardElement
    ? Array.from(boardElement.children).indexOf(activeElement)
    : -1;

  boardElement.innerHTML = '';

  for (let r = 0; r < gameState.rows; r++) {
    for (let c = 0; c < gameState.cols; c++) {
      const cellData = board[r][c];
      const cellBtn = document.createElement('button');
      cellBtn.type = 'button';
      cellBtn.classList.add('cell');

      // Формуємо детальний динамічний aria-label відповідно до вимог код-рев'ю
      let stateDescription = 'закрита клітинка';
      if (cellData.state === 'opened') {
        if (cellData.type === 'mine') {
          stateDescription = 'відкрита міна';
        } else {
          stateDescription = cellData.neighborMines > 0
            ? `відкрито, мін навколо: ${cellData.neighborMines}`
            : 'відкрита порожня клітинка';
        }
      } else if (cellData.state === 'flagged') {
        stateDescription = 'з прапорцем';
      }

      cellBtn.setAttribute('aria-label', `Рядок ${r + 1}, колонка ${c + 1}, ${stateDescription}`);

      if (cellData.state === 'opened') {
        cellBtn.classList.add('open');
        if (cellData.type === 'mine') {
          cellBtn.classList.add('mine');
          if (cellData.isExploded) {
            cellBtn.classList.add('exploded');
          }
        } else if (cellData.neighborMines > 0) {
          cellBtn.textContent = cellData.neighborMines;
          cellBtn.classList.add(`number-${cellData.neighborMines}`);
        }
      } else if (cellData.state === 'flagged') {
        if (cellData.type === 'mine') {
          cellBtn.classList.add('flag-mine');
        } else {
          cellBtn.classList.add('flag-safe');
        }
      }

      // Клік мишею
      cellBtn.addEventListener('click', () => openCell(r, c));
      cellBtn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        toggleFlag(r, c);
      });

      // Керування прапорцем з клавіатури (клавіша F або f)
      cellBtn.addEventListener('keydown', (e) => {
        if (e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          toggleFlag(r, c);
        }
      });

      boardElement.appendChild(cellBtn);
    }
  }

  if (focusedIndex >= 0 && boardElement.children[focusedIndex]) {
    boardElement.children[focusedIndex].focus();
  }
}

resetBtn.addEventListener('click', initGame);

initGame();