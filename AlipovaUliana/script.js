const gameState = {
    rows: 10,
    cols: 10,
    minesCount: 15,
    status: 'process',
    gameTime: 0,
    timerId: null,
    board: [],
    isFirstClick: true
};

// Посилання на DOM-елементи
const boardElement = document.getElementById('board');
const minesCountElement = document.getElementById('mines-count');
const timerElement = document.getElementById('timer');
const restartBtn = document.getElementById('restart-btn');

// Форматування чисел для лічильника
function formatNumber(num) {
    if (num < -99) return '-99';
    if (num < 0) return '-' + String(Math.abs(num)).padStart(2, '0');
    return String(num).padStart(3, '0');
}

// Ініціалізація порожнього поля перед першим кліком
function createEmptyBoard(rows, cols) {
    const board = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            row.push({
                type: 'empty',
                state: 'closed', // 'closed' | 'opened' | 'flagged'
                neighborMines: 0,
                isExploded: false,
                isWrongFlag: false
            });
        }
        board.push(row);
    }
    return board;
}

// Генерація мін з урахуванням безпечної зони
function placeMines(rows, cols, minesCount, safeRow, safeCol) {
    let minesPlaced = 0;
    while (minesPlaced < minesCount) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);

        const isNearSafe = Math.abs(r - safeRow) <= 1 && Math.abs(c - safeCol) <= 1;

        if (!isNearSafe && gameState.board[r][c].type !== 'mine') {
            gameState.board[r][c].type = 'mine';
            minesPlaced++;
        }
    }
}

// Підрахунок мін навколо кожної клітинки
function countNeighbourMines() {
    const { rows, cols, board } = gameState;

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

// Рекурсивне відкриття клітинок
function openCell(row, col) {
    const { rows, cols, board, status } = gameState;

    if (status !== 'process') return;

    const cell = board[row][col];

    if (cell.state === 'opened' || cell.state === 'flagged') return;

    if (gameState.isFirstClick) {
        gameState.isFirstClick = false;
        placeMines(rows, cols, gameState.minesCount, row, col);
        countNeighbourMines();
        startTimer();
    }

    // Якщо клітинка з міною — поразка
    if (cell.type === 'mine') {
        cell.state = 'opened';
        cell.isExploded = true;
        endGame('lose', row, col);
        return;
    }

    cell.state = 'opened';

    if (cell.neighborMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dr === 0) continue;
                const nr = row + dr;
                const nc = col + dc;

                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                    if (board[nr][nc].state === 'closed') {
                        openCell(nr, nc);
                    }
                }
            }
        }
    }

    checkWin();
}

// Управління прапорцями
function toggleFlag(row, col) {
    if (gameState.status !== 'process') return;

    const cell = gameState.board[row][col];

    if (cell.state === 'opened') return;

    if (cell.state === 'closed') {
        cell.state = 'flagged';
    } else if (cell.state === 'flagged') {
        cell.state = 'closed';
    }

    updateUI();
}

// Таймер
function startTimer() {
    stopTimer();
    gameState.timerId = setInterval(() => {
        if (gameState.gameTime < 999) {
            gameState.gameTime++;
            timerElement.textContent = formatNumber(gameState.gameTime);
        }
    }, 1000);
}

function stopTimer() {
    if (gameState.timerId) {
        clearInterval(gameState.timerId);
        gameState.timerId = null;
    }
}

// Рендеринг ігрового поля в DOM
function renderBoard() {
    boardElement.innerHTML = '';

    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const cellData = gameState.board[r][c];
            const cellBtn = document.createElement('button');
            cellBtn.classList.add('cell');
            cellBtn.dataset.row = r;
            cellBtn.dataset.col = c;
            cellBtn.setAttribute('type', 'button');

            if (cellData.state === 'opened') {
                cellBtn.classList.add('revealed');
                if (cellData.type === 'mine') {
                    cellBtn.classList.add('mine');
                    if (cellData.isExploded) {
                        cellBtn.classList.add('exploded');
                    }
                } else if (cellData.neighborMines > 0) {
                    cellBtn.classList.add(`val-${cellData.neighborMines}`);
                    cellBtn.textContent = cellData.neighborMines;
                }
            } else if (cellData.state === 'flagged') {
                cellBtn.classList.add('flagged');
                if (cellData.isWrongFlag) {
                    cellBtn.classList.add('wrong-flag');
                }
            }

            boardElement.appendChild(cellBtn);
        }
    }
}

// Оновлення інтерфейсу та статистики
function updateUI() {
    let flaggedCount = 0;
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            if (gameState.board[r][c].state === 'flagged') {
                flaggedCount++;
            }
        }
    }

    const remainingMines = gameState.minesCount - flaggedCount;
    minesCountElement.textContent = formatNumber(remainingMines);
    timerElement.textContent = formatNumber(gameState.gameTime);

    // Смайлик статусу
    if (gameState.status === 'process') {
        restartBtn.textContent = '🙂';
    } else if (gameState.status === 'win') {
        restartBtn.textContent = '😎';
    } else if (gameState.status === 'lose') {
        restartBtn.textContent = '😵';
    }

    renderBoard();
}

// Перевірка перемоги
function checkWin() {
    let unrevealedSafeCells = 0;

    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const cell = gameState.board[r][c];
            if (cell.type !== 'mine' && cell.state !== 'opened') {
                unrevealedSafeCells++;
            }
        }
    }

    if (unrevealedSafeCells === 0) {
        endGame('win');
    }
}

// Завершення гри
function endGame(result, explodedRow = null, explodedCol = null) {
    gameState.status = result;
    stopTimer();

    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const cell = gameState.board[r][c];

            if (result === 'lose') {
                if (cell.type === 'mine') {
                    cell.state = 'opened';
                    if (r === explodedRow && c === explodedCol) {
                        cell.isExploded = true;
                    }
                } else if (cell.state === 'flagged') {
                    cell.isWrongFlag = true;
                }
            } else if (result === 'win') {
                if (cell.type === 'mine') {
                    cell.state = 'flagged';
                }
            }
        }
    }

    updateUI();
}

// Скидання гри
function initGame() {
    stopTimer();
    gameState.status = 'process';
    gameState.gameTime = 0;
    gameState.isFirstClick = true;
    gameState.board = createEmptyBoard(gameState.rows, gameState.cols);
    updateUI();
}

boardElement.addEventListener('click', (e) => {
    const target = e.target.closest('.cell');
    if (!target || gameState.status !== 'process') return;

    const row = parseInt(target.dataset.row, 10);
    const col = parseInt(target.dataset.col, 10);

    openCell(row, col);
    updateUI();
});

boardElement.addEventListener('contextmenu', (e) => {
    e.preventDefault(); // Блокування стандартного контекстного меню браузера

    const target = e.target.closest('.cell');
    if (!target || gameState.status !== 'process') return;

    const row = parseInt(target.dataset.row, 10);
    const col = parseInt(target.dataset.col, 10);

    toggleFlag(row, col);
});

restartBtn.addEventListener('click', initGame);


initGame();