// Крок 1. Моделювання даних (Data Layer)
const gameState = {
    rows: 10,
    cols: 10,
    minesCount: 15,
    flagsCount: 15,
    status: 'process', // 'process' | 'win' | 'lose'
    gameTime: 0,
    timerId: null,
    clickedMine: null
};

// Окремий 2D-масив для ігрового поля
let board = [];

// Напрямки для пошуку сусідів (8 клітинок навколо) з описовими назвами
const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
];

/**
 * Генерує ігрове поле та випадковим чином розставляє міни.
 * @param {number} totalRows - Кількість рядків на полі.
 * @param {number} totalCols - Кількість колонок на полі.
 * @param {number} minesCount - Кількість мін, які потрібно розставити.
 */
function generateField(totalRows, totalCols, minesCount) {
    board = Array.from({ length: totalRows }, () =>
        Array.from({ length: totalCols }, () => ({
            type: 'empty',
            state: 'closed',
            neighborMines: 0
        }))
    );

    let minesPlaced = 0;
    while (minesPlaced < minesCount) {
        const row = Math.floor(Math.random() * totalRows);
        const col = Math.floor(Math.random() * totalCols);
        
        if (board[row][col].type !== 'mine') {
            board[row][col].type = 'mine';
            minesPlaced++;
        }
    }
    
    countNeighbourMines();
}

/**
 * Підраховує кількість мін навколо кожної порожньої клітинки.
 */
function countNeighbourMines() {
    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            if (board[row][col].type === 'mine') continue;
            
            let mines = 0;
            for (const [deltaRow, deltaCol] of directions) {
                const neighborRow = row + deltaRow;
                const neighborCol = col + deltaCol;
                if (neighborRow >= 0 && neighborRow < gameState.rows && neighborCol >= 0 && neighborCol < gameState.cols) {
                    if (board[neighborRow][neighborCol].type === 'mine') mines++;
                }
            }
            board[row][col].neighborMines = mines;
        }
    }
}

/**
 * Відкриває вибрану клітинку та рекурсивно відкриває сусідні порожні клітинки.
 * @param {number} row - Індекс рядка клітинки.
 * @param {number} col - Індекс колонки клітинки.
 */
function openCell(row, col) {
    if (gameState.status !== 'process') return;
    
    const cell = board[row][col];
    if (cell.state === 'opened' || cell.state === 'flagged') return;

    cell.state = 'opened';

    if (cell.type === 'mine') {
        gameState.clickedMine = { row, col };
        endGame('lose');
        return;
    }

    if (cell.neighborMines === 0) {
        for (const [deltaRow, deltaCol] of directions) {
            const neighborRow = row + deltaRow;
            const neighborCol = col + deltaCol;
            if (neighborRow >= 0 && neighborRow < gameState.rows && neighborCol >= 0 && neighborCol < gameState.cols) {
                if (board[neighborRow][neighborCol].state === 'closed') {
                    openCell(neighborRow, neighborCol);
                }
            }
        }
    }
    
    checkWinCondition();
    renderBoard();
}

/**
 * Встановлює або знімає прапорець на вибраній клітинці.
 * @param {number} row - Індекс рядка клітинки.
 * @param {number} col - Індекс колонки клітинки.
 */
function toggleFlag(row, col) {
    if (gameState.status !== 'process') return;
    
    const cell = board[row][col];
    
    if (cell.state === 'closed' && gameState.flagsCount > 0) {
        cell.state = 'flagged';
        gameState.flagsCount--;
    } else if (cell.state === 'flagged') {
        cell.state = 'closed';
        gameState.flagsCount++;
    }
    
    updateUI();
    renderBoard();
}

/**
 * Запускає ігровий таймер, який оновлюється щосекунди.
 */
function startTimer() {
    stopTimer();
    gameState.gameTime = 0;
    gameState.timerId = setInterval(() => {
        gameState.gameTime++;
        updateUI();
    }, 1000);
}

/**
 * Зупиняє поточний ігровий таймер.
 */
function stopTimer() {
    if (gameState.timerId) clearInterval(gameState.timerId);
}

/**
 * Рендерить ігрове поле у DOM на основі масиву даних з урахуванням доступності.
 */
function renderBoard() {
    const boardElement = document.querySelector('.game-board');
    if (!boardElement) return;
    
    boardElement.innerHTML = '';
    document.documentElement.style.setProperty('--board-columns', gameState.cols);

    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            const cell = board[row][col];
            const cellElement = document.createElement('button');
            cellElement.type = 'button';
            cellElement.classList.add('cell');
            
            let ariaLabelText = `Клітинка ${row + 1}, ${col + 1}: `;

            if (cell.state === 'opened') {
                cellElement.classList.add('open');
                if (cell.type === 'mine') {
                    cellElement.classList.add('mine');
                    if (gameState.status === 'lose' && gameState.clickedMine && gameState.clickedMine.row === row && gameState.clickedMine.col === col) {
                        cellElement.classList.add('clicked');
                    }
                    cellElement.textContent = '💣';
                    ariaLabelText += 'Міна';
                } else if (cell.neighborMines > 0) {
                    cellElement.textContent = cell.neighborMines;
                    cellElement.classList.add(`num-${cell.neighborMines}`);
                    ariaLabelText += `Сусідніх мін: ${cell.neighborMines}`;
                } else {
                    cellElement.classList.add('empty');
                    ariaLabelText += 'Порожня відкрита клітинка';
                }
            } else if (cell.state === 'flagged') {
                cellElement.classList.add('flag');
                if (gameState.status === 'lose' && cell.type !== 'mine') {
                    cellElement.classList.add('flagged-safe');
                    cellElement.textContent = '❌';
                    ariaLabelText += 'Помилковий прапорець';
                } else {
                    cellElement.textContent = '🚩';
                    ariaLabelText += 'Прапорець';
                }
            } else {
                ariaLabelText += 'Закрита клітинка';
            }

            cellElement.setAttribute('aria-label', ariaLabelText);

            cellElement.addEventListener('click', () => openCell(row, col));
            cellElement.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                toggleFlag(row, col);
            });

            boardElement.appendChild(cellElement);
        }
    }
}

/**
 * Оновлює динамічні елементи інтерфейсу (таймер та лічильник прапорців).
 */
function updateUI() {
    const timerElement = document.getElementById('timer');
    const flagElement = document.getElementById('flag-count');
    
    if (timerElement) {
        timerElement.textContent = String(gameState.gameTime).padStart(3, '0');
    }
    if (flagElement) {
        flagElement.textContent = String(gameState.flagsCount).padStart(3, '0');
    }
}

/**
 * Перевіряє умову перемоги (чи відкриті всі безпечні клітинки).
 */
function checkWinCondition() {
    let closedSafeCells = 0;
    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            const cell = board[row][col];
            if (cell.type !== 'mine' && cell.state !== 'opened') {
                closedSafeCells++;
            }
        }
    }
    
    if (closedSafeCells === 0) {
        endGame('win');
    }
}

/**
 * Завершує гру, відкриває міни та оновлює статус у DOM.
 * @param {string} status - Статус завершення гри ('win' або 'lose').
 */
function endGame(status) {
    gameState.status = status;
    stopTimer();
    
    let statusElement = document.getElementById('game-status-message');
    if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.id = 'game-status-message';
        statusElement.setAttribute('role', 'status');
        statusElement.setAttribute('aria-live', 'polite');
        const container = document.querySelector('.game-container') || document.body;
        container.appendChild(statusElement);
    }
    
    if (status === 'lose') {
        for (let row = 0; row < gameState.rows; row++) {
            for (let col = 0; col < gameState.cols; col++) {
                if (board[row][col].type === 'mine' && board[row][col].state !== 'flagged') {
                    board[row][col].state = 'opened';
                }
            }
        }
        statusElement.textContent = '💥 Ви підірвались! Гра закінчена.';
    } else if (status === 'win') {
        statusElement.textContent = `🎉 Перемога! Ваш час: ${gameState.gameTime} сек.`;
    }
    
    renderBoard();
}

/**
 * Ініціалізує нові параметри стану та генерує нове ігрове поле.
 */
function initGame() {
    gameState.status = 'process';
    gameState.flagsCount = gameState.minesCount;
    gameState.clickedMine = null;
    
    const statusElement = document.getElementById('game-status-message');
    if (statusElement) {
        statusElement.textContent = '';
    }
    
    generateField(gameState.rows, gameState.cols, gameState.minesCount);
    startTimer();
    updateUI();
    renderBoard();
}

document.querySelector('.reset-btn').addEventListener('click', initGame);
window.addEventListener('DOMContentLoaded', initGame);