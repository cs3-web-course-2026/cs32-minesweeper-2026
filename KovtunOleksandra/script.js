// Крок 1. Моделювання даних (Data Layer)
const gameState = {
    rows: 10,
    cols: 10,
    minesCount: 15,
    flagsCount: 15,
    status: 'process', // 'process' | 'win' | 'lose'
    gameTime: 0,
    timerId: null,
    board: []
};

// Напрямки для пошуку сусідів (8 клітинок навколо)
const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
];

// Крок 2. Генерація поля та мін
function generateField(rows, cols, minesCount) {
    // 1. Ініціалізація порожнього поля
    gameState.board = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({
            type: 'empty',
            state: 'closed',
            neighborMines: 0
        }))
    );

    // 2. Розстановка мін випадковим чином
    let minesPlaced = 0;
    while (minesPlaced < minesCount) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);
        
        if (gameState.board[r][c].type !== 'mine') {
            gameState.board[r][c].type = 'mine';
            minesPlaced++;
        }
    }
    
    countNeighbourMines();
}

// Крок 3. Алгоритмічна частина (Business Logic)
function countNeighbourMines() {
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            if (gameState.board[r][c].type === 'mine') continue;
            
            let mines = 0;
            for (const [dx, dy] of directions) {
                const nr = r + dx;
                const nc = c + dy;
                if (nr >= 0 && nr < gameState.rows && nc >= 0 && nc < gameState.cols) {
                    if (gameState.board[nr][nc].type === 'mine') mines++;
                }
            }
            gameState.board[r][c].neighborMines = mines;
        }
    }
}

function openCell(r, c) {
    if (gameState.status !== 'process') return;
    
    const cell = gameState.board[r][c];
    if (cell.state === 'opened' || cell.state === 'flagged') return;

    cell.state = 'opened';

    // Поразка
    if (cell.type === 'mine') {
        endGame('lose');
        return;
    }

    // Рекурсія для порожніх клітинок
    if (cell.neighborMines === 0) {
        for (const [dx, dy] of directions) {
            const nr = r + dx;
            const nc = c + dy;
            if (nr >= 0 && nr < gameState.rows && nc >= 0 && nc < gameState.cols) {
                if (gameState.board[nr][nc].state === 'closed') {
                    openCell(nr, nc);
                }
            }
        }
    }
    
    checkWinCondition();
    renderBoard();
}

// Крок 4. Таймер та прапорці
function toggleFlag(r, c) {
    if (gameState.status !== 'process') return;
    
    const cell = gameState.board[r][c];
    
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

function startTimer() {
    stopTimer();
    gameState.gameTime = 0;
    gameState.timerId = setInterval(() => {
        gameState.gameTime++;
        updateUI();
    }, 1000);
}

function stopTimer() {
    if (gameState.timerId) clearInterval(gameState.timerId);
}

// Крок 5 & 7. Рендеринг ігрового поля (DOM) та Обробка подій
function renderBoard() {
    const boardElement = document.querySelector('.game-board');
    if (!boardElement) return;
    
    boardElement.innerHTML = '';
    
    // Встановлюємо правильну кількість колонок у CSS
    document.documentElement.style.setProperty('--board-columns', gameState.cols);

    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const cell = gameState.board[r][c];
            const cellElement = document.createElement('div');
            cellElement.classList.add('cell');
            
            if (cell.state === 'opened') {
                cellElement.classList.add('open');
                if (cell.type === 'mine') {
                    cellElement.classList.add('mine');
                    // Додаємо клас кліку для тієї міни, на яку натиснули, і просто міну для інших
                    if (gameState.status === 'lose') cellElement.classList.add('clicked');
                    cellElement.textContent = '💣';
                } else if (cell.neighborMines > 0) {
                    cellElement.textContent = cell.neighborMines;
                    cellElement.classList.add(`num-${cell.neighborMines}`);
                } else {
                    cellElement.classList.add('empty');
                }
            } else if (cell.state === 'flagged') {
                cellElement.classList.add('flag');
                // Визначення правильності прапорця в кінці гри (опціонально для візуалу)
                if (gameState.status === 'lose' && cell.type !== 'mine') {
                    cellElement.classList.add('flagged-safe');
                    cellElement.textContent = '❌';
                } else {
                    cellElement.textContent = '🚩';
                }
            }

            // Обробка подій (Крок 7)
            cellElement.addEventListener('click', () => openCell(r, c));
            cellElement.addEventListener('contextmenu', (e) => {
                e.preventDefault(); // Блокування контекстного меню
                toggleFlag(r, c);
            });

            boardElement.appendChild(cellElement);
        }
    }
}

// Крок 6. Динамічні елементи інтерфейсу
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

// Крок 8. Завершення гри
function checkWinCondition() {
    let closedSafeCells = 0;
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const cell = gameState.board[r][c];
            if (cell.type !== 'mine' && cell.state !== 'opened') {
                closedSafeCells++;
            }
        }
    }
    
    if (closedSafeCells === 0) {
        endGame('win');
    }
}

function endGame(status) {
    gameState.status = status;
    stopTimer();
    
    if (status === 'lose') {
        // Відкриваємо всі міни
        for (let r = 0; r < gameState.rows; r++) {
            for (let c = 0; c < gameState.cols; c++) {
                if (gameState.board[r][c].type === 'mine' && gameState.board[r][c].state !== 'flagged') {
                    gameState.board[r][c].state = 'opened';
                }
            }
        }
        setTimeout(() => alert('💥 Ви підірвались! Гра закінчена.'), 100);
    } else if (status === 'win') {
        setTimeout(() => alert(`🎉 Перемога! Ваш час: ${gameState.gameTime} сек.`), 100);
    }
    
    renderBoard();
}

// Ініціалізація нової гри
function initGame() {
    gameState.status = 'process';
    gameState.flagsCount = gameState.minesCount;
    
    generateField(gameState.rows, gameState.cols, gameState.minesCount);
    startTimer();
    updateUI();
    renderBoard();
}

// Прив'язка події до кнопки рестарту (емодзі)
document.querySelector('.reset-btn').addEventListener('click', initGame);

// Запуск першої гри при завантаженні сторінки
window.addEventListener('DOMContentLoaded', initGame);