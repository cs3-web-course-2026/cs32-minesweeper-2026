// Крок 1. Моделювання даних (Data Layer)
const gameState = {
    rows: 10,
    cols: 10,
    minesCount: 15,
    flagsCount: 15,
    status: 'process', // 'process' | 'win' | 'lose'
    gameTime: 0,
    timerId: null,
    clickedMine: null // Зберігаємо координати міни всередині gameState відповідно до вимог
};

// Окремий 2D-масив для ігрового поля
let board = [];

// Напрямки для пошуку сусідів (8 клітинок навколо)
const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
];

/**
 * Генерує ігрове поле та випадковим чином розставляє міни.
 * @param {number} rows - Кількість рядків на полі.
 * @param {number} cols - Кількість колонок на полі.
 * @param {number} minesCount - Кількість мін, які потрібно розставити.
 */
function generateField(rows, cols, minesCount) {
    board = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({
            type: 'empty',
            state: 'closed',
            neighborMines: 0
        }))
    );

    let minesPlaced = 0;
    while (minesPlaced < minesCount) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);
        
        if (board[r][c].type !== 'mine') {
            board[r][c].type = 'mine';
            minesPlaced++;
        }
    }
    
    countNeighbourMines();
}

/**
 * Підраховує кількість мін навколо кожної порожньої клітинки.
 */
function countNeighbourMines() {
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            if (board[r][c].type === 'mine') continue;
            
            let mines = 0;
            for (const [dx, dy] of directions) {
                const nr = r + dx;
                const nc = c + dy;
                if (nr >= 0 && nr < gameState.rows && nc >= 0 && nc < gameState.cols) {
                    if (board[nr][nc].type === 'mine') mines++;
                }
            }
            board[r][c].neighborMines = mines;
        }
    }
}

/**
 * Відкриває вибрану клітинку та рекурсивно відкриває сусідні порожні клітинки.
 * @param {number} r - Індекс рядка клітинки.
 * @param {number} c - Індекс колонки клітинки.
 */
function openCell(r, c) {
    if (gameState.status !== 'process') return;
    
    const cell = board[r][c];
    if (cell.state === 'opened' || cell.state === 'flagged') return;

    cell.state = 'opened';

    if (cell.type === 'mine') {
        gameState.clickedMine = { r, c };
        endGame('lose');
        return;
    }

    if (cell.neighborMines === 0) {
        for (const [dx, dy] of directions) {
            const nr = r + dx;
            const nc = c + dy;
            if (nr >= 0 && nr < gameState.rows && nc >= 0 && nc < gameState.cols) {
                if (board[nr][nc].state === 'closed') {
                    openCell(nr, nc);
                }
            }
        }
    }
    
    checkWinCondition();
    renderBoard();
}

/**
 * Встановлює або знімає прапорець на вибраній клітинці.
 * @param {number} r - Індекс рядка клітинки.
 * @param {number} c - Індекс колонки клітинки.
 */
function toggleFlag(r, c) {
    if (gameState.status !== 'process') return;
    
    const cell = board[r][c];
    
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

    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const cell = board[r][c];
            const cellElement = document.createElement('button');
            cellElement.type = 'button';
            cellElement.classList.add('cell');
            
            let ariaLabelText = `Клітинка ${r + 1}, ${c + 1}: `;

            if (cell.state === 'opened') {
                cellElement.classList.add('open');
                if (cell.type === 'mine') {
                    cellElement.classList.add('mine');
                    if (gameState.status === 'lose' && gameState.clickedMine && gameState.clickedMine.r === r && gameState.clickedMine.c === c) {
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

            cellElement.addEventListener('click', () => openCell(r, c));
            cellElement.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                toggleFlag(r, c);
            });

            boardElement.appendChild(cellElement);
        }
    }
}

/**
 * Оновлює динамічні елементи інтерфейсу (таймер та лічильник прапорців).
 */
function updateUI() {
    const timerEl = document.getElementById('timer');
    const flagEl = document.getElementById('flag-count');
    
    if (timerEl) {
        timerEl.textContent = String(gameState.gameTime).padStart(3, '0');
    }
    if (flagEl) {
        flagEl.textContent = String(gameState.flagsCount).padStart(3, '0');
    }
}

/**
 * Перевіряє умову перемоги (чи відкриті всі безпечні клітинки).
 */
function checkWinCondition() {
    let closedSafeCells = 0;
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const cell = board[r][c];
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
    
    let statusEl = document.getElementById('game-status-message');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'game-status-message';
        statusEl.setAttribute('role', 'status');
        statusEl.setAttribute('aria-live', 'polite');
        const container = document.querySelector('.game-container') || document.body;
        container.appendChild(statusEl);
    }
    
    if (status === 'lose') {
        for (let r = 0; r < gameState.rows; r++) {
            for (let c = 0; c < gameState.cols; c++) {
                if (board[r][c].type === 'mine' && board[r][c].state !== 'flagged') {
                    board[r][c].state = 'opened';
                }
            }
        }
        statusEl.textContent = '💥 Ви підірвались! Гра закінчена.';
    } else if (status === 'win') {
        statusEl.textContent = `🎉 Перемога! Ваш час: ${gameState.gameTime} сек.`;
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
    
    const statusEl = document.getElementById('game-status-message');
    if (statusEl) {
        statusEl.textContent = '';
    }
    
    generateField(gameState.rows, gameState.cols, gameState.minesCount);
    startTimer();
    updateUI();
    renderBoard();
}

document.querySelector('.reset-btn').addEventListener('click', initGame);
window.addEventListener('DOMContentLoaded', initGame);