'use strict';

/**
 * ============================================================================
 * КРОК 1. МОДЕЛЮВАННЯ ДАНИХ (DATA LAYER)
 * ============================================================================
 */

const CELL_TYPE = {
    EMPTY: 'empty',
    MINE: 'mine',
};

const CELL_STATE = {
    CLOSED: 'closed',
    OPENED: 'opened',
    FLAGGED: 'flagged',
};

const GAME_STATUS = {
    PROCESS: 'process',
    WIN: 'win',
    LOSE: 'lose',
};

/**
 * Глобальний об'єкт стану гри (gameState)
 */
const gameState = {
    rows: 16,
    cols: 16,
    minesCount: 40,
    status: GAME_STATUS.PROCESS,
    gameTime: 0,
    timerId: null,
    isTimerRunning: false,
    explodedCell: null,
};

/**
 * Двовимірний масив ігрового поля
 * @type {Array<Array<{type: string, state: string, neighborMines: number}>>}
 */
let board = [];

/**
 * Перевірка, чи належать координати (row, col) межам поля
 */
function isValidCell(row, col, rows = gameState.rows, cols = gameState.cols) {
    return row >= 0 && row < rows && col >= 0 && col < cols;
}

/**
 * Отримання координат усіх сусідніх клітинок (до 8 сусідів)
 */
function getNeighbors(row, col, rows = gameState.rows, cols = gameState.cols) {
    const neighbors = [];
    for (let dRow = -1; dRow <= 1; dRow++) {
        for (let dCol = -1; dCol <= 1; dCol++) {
            if (dRow === 0 && dCol === 0) continue;
            const targetRow = row + dRow;
            const targetCol = col + dCol;
            if (isValidCell(targetRow, targetCol, rows, cols)) {
                neighbors.push([targetRow, targetCol]);
            }
        }
    }
    return neighbors;
}

/**
 * ============================================================================
 * КРОК 2. ГЕНЕРАЦІЯ ПОЛЯ ТА МІН
 * ============================================================================
 */

/**
 * Створення двовимірного масиву поля та випадкова розстановка мін
 * @param {number} rows - Кількість рядків
 * @param {number} cols - Кількість стовпців
 * @param {number} minesCount - Кількість мін
 * @returns {Array<Array<Object>>} Сітка поля
 */
function generateField(rows, cols, minesCount) {
    const newBoard = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({
            type: CELL_TYPE.EMPTY,
            neighborMines: 0,
            state: CELL_STATE.CLOSED,
        }))
    );

    const maxPossibleMines = rows * cols - 1;
    const actualMinesCount = Math.min(minesCount, maxPossibleMines);

    let placedMines = 0;
    while (placedMines < actualMinesCount) {
        const randomRow = Math.floor(Math.random() * rows);
        const randomCol = Math.floor(Math.random() * cols);

        if (newBoard[randomRow][randomCol].type !== CELL_TYPE.MINE) {
            newBoard[randomRow][randomCol].type = CELL_TYPE.MINE;
            placedMines++;
        }
    }

    return newBoard;
}

/**
 * ============================================================================
 * КРОК 3. АЛГОРИТМІЧНА ЧАСТИНА (BUSINESS LOGIC)
 * ============================================================================
 */

/**
 * Підрахунок кількості мін у сусідніх клітинках для кожної порожньої клітинки
 * @param {Array<Array<Object>>} currentBoard - Ігрове поле
 */
function countNeighbourMines(currentBoard = board) {
    const rows = currentBoard.length;
    const cols = rows > 0 ? currentBoard[0].length : 0;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (currentBoard[r][c].type === CELL_TYPE.MINE) continue;

            const neighbors = getNeighbors(r, c, rows, cols);
            let minesAround = 0;

            for (const [nRow, nCol] of neighbors) {
                if (currentBoard[nRow][nCol].type === CELL_TYPE.MINE) {
                    minesAround++;
                }
            }

            currentBoard[r][c].neighborMines = minesAround;
        }
    }
}

/**
 * Відкриття клітинки з рекурсивним розкриттям порожніх сусідніх областей
 * @param {number} row - Індекс рядка
 * @param {number} col - Індекс стовпця
 */
function openCell(row, col) {
    if (gameState.status !== GAME_STATUS.PROCESS) return;
    if (!isValidCell(row, col)) return;

    const cell = board[row][col];

    // Якщо клітинка вже відкрита або позначена прапорцем — нічого не робимо
    if (cell.state === CELL_STATE.OPENED || cell.state === CELL_STATE.FLAGGED) {
        return;
    }

    // Запуск таймера при першій дії гравця
    if (!gameState.isTimerRunning) {
        startTimer();
    }

    cell.state = CELL_STATE.OPENED;

    // Підрив на міні -> поразка
    if (cell.type === CELL_TYPE.MINE) {
        gameState.status = GAME_STATUS.LOSE;
        gameState.explodedCell = { row, col };
        stopTimer();
        revealAllMines();
        return;
    }

    // Рекурсивне відкриття сусідів, якщо навколо немає мін (neighborMines === 0)
    if (cell.neighborMines === 0) {
        const neighbors = getNeighbors(row, col);
        for (const [nRow, nCol] of neighbors) {
            if (board[nRow][nCol].state === CELL_STATE.CLOSED) {
                openCell(nRow, nCol);
            }
        }
    }

    checkWinCondition();
}

/**
 * ============================================================================
 * КРОК 4. ТАЙМЕР ТА ПРАПОРЦІ
 * ============================================================================
 */

/**
 * Підрахунок кількості встановлених прапорців на полі
 */
function getPlacedFlagsCount() {
    let count = 0;
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            if (board[r][c].state === CELL_STATE.FLAGGED) {
                count++;
            }
        }
    }
    return count;
}

/**
 * Встановлення або зняття прапорця на закритій клітинці
 * @param {number} row - Індекс рядка
 * @param {number} col - Індекс стовпця
 */
function toggleFlag(row, col) {
    if (gameState.status !== GAME_STATUS.PROCESS) return;
    if (!isValidCell(row, col)) return;

    const cell = board[row][col];

    // На відкриту клітинку ставити прапорець не можна
    if (cell.state === CELL_STATE.OPENED) return;

    if (!gameState.isTimerRunning) {
        startTimer();
    }

    if (cell.state === CELL_STATE.CLOSED) {
        if (getPlacedFlagsCount() >= gameState.minesCount) return;
        cell.state = CELL_STATE.FLAGGED;
    } else if (cell.state === CELL_STATE.FLAGGED) {
        cell.state = CELL_STATE.CLOSED;
    }
}

/**
 * Запуск секундного таймера гри
 */
function startTimer() {
    if (gameState.isTimerRunning) return;
    gameState.isTimerRunning = true;

    gameState.timerId = setInterval(() => {
        gameState.gameTime += 1;
        updateHeaderUI();
    }, 1000);
}

/**
 * Зупинка таймера гри (clearInterval)
 */
function stopTimer() {
    if (gameState.timerId !== null) {
        clearInterval(gameState.timerId);
        gameState.timerId = null;
    }
    gameState.isTimerRunning = false;
}

/**
 * ============================================================================
 * КРОК 8. ЗАВЕРШЕННЯ ГРИ (ПЕРЕВІРКА WIN / LOSE)
 * ============================================================================
 */

/**
 * Перевірка умови перемоги: усі безпечні клітинки (type === 'empty') відкриті
 */
function checkWinCondition() {
    if (gameState.status !== GAME_STATUS.PROCESS) return;

    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const cell = board[r][c];
            if (cell.type === CELL_TYPE.EMPTY && cell.state !== CELL_STATE.OPENED) {
                return;
            }
        }
    }

    gameState.status = GAME_STATUS.WIN;
    stopTimer();
    flagRemainingMines();
}

/**
 * Розкриття всіх нерозмінованих мін після підриву
 */
function revealAllMines() {
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const cell = board[r][c];
            if (cell.type === CELL_TYPE.MINE && cell.state === CELL_STATE.CLOSED) {
                cell.state = CELL_STATE.OPENED;
            }
        }
    }
}

/**
 * Автоматичне встановлення прапорців на всі міни у разі перемоги
 */
function flagRemainingMines() {
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const cell = board[r][c];
            if (cell.type === CELL_TYPE.MINE && cell.state !== CELL_STATE.FLAGGED) {
                cell.state = CELL_STATE.FLAGGED;
            }
        }
    }
}

/**
 * ============================================================================
 * КРОК 5 та КРОК 6. РЕНДЕРИНГ ПОЛЯ ТА ДИНАМІЧНІ ЕЛЕМЕНТИ ІНТЕРФЕЙСУ (DOM)
 * ============================================================================
 */

const boardElement = document.getElementById('game-board');
const flagsCounterElement = document.getElementById('flags-counter');
const timerElement = document.getElementById('timer');
const startBtnElement = document.getElementById('start-btn');
const statusBannerElement = document.getElementById('status-banner');

/**
 * Форматування числа у 3-значний вигляд для табло (наприклад, 040, 007)
 */
function formatCounter(value) {
    const clamped = Math.max(-99, Math.min(999, value));
    if (clamped < 0) {
        return '-' + String(Math.abs(clamped)).padStart(2, '0');
    }
    return String(clamped).padStart(3, '0');
}

/**
 * Оновлення таймера, лічильника прапорців, кнопки рестарту та банера статусу
 */
function updateHeaderUI() {
    const remainingFlags = gameState.minesCount - getPlacedFlagsCount();
    flagsCounterElement.textContent = formatCounter(remainingFlags);
    timerElement.textContent = formatCounter(gameState.gameTime);

    if (gameState.status === GAME_STATUS.WIN) {
        startBtnElement.textContent = '😎';
        statusBannerElement.textContent = `Перемога! Усі міни знешкоджено за ${gameState.gameTime} с. Залишок мін: ${remainingFlags}.`;
        statusBannerElement.className = 'status-banner win';
    } else if (gameState.status === GAME_STATUS.LOSE) {
        startBtnElement.textContent = '😵';
        statusBannerElement.textContent = `Поразка! Ви натрапили на міну. Залишок мін: ${remainingFlags}.`;
        statusBannerElement.className = 'status-banner lose';
    } else {
        startBtnElement.textContent = '🙂';
        statusBannerElement.textContent = '';
        statusBannerElement.className = 'status-banner hidden';
    }
}

/**
 * Динамічна генерація та оновлення HTML-структури ігрової сітки на основі масиву board
 */
function renderBoard() {
    const activeEl = document.activeElement;
    const focusedRow =
        activeEl && activeEl.classList.contains('cell') ? activeEl.dataset.row : null;
    const focusedCol =
        activeEl && activeEl.classList.contains('cell') ? activeEl.dataset.col : null;

    document.documentElement.style.setProperty('--rows-count', gameState.rows);
    document.documentElement.style.setProperty('--cols-count', gameState.cols);

    boardElement.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const cellData = board[r][c];
            const cellBtn = document.createElement('button');
            cellBtn.type = 'button';
            cellBtn.classList.add('cell');
            cellBtn.setAttribute('role', 'gridcell');
            cellBtn.dataset.row = String(r);
            cellBtn.dataset.col = String(c);

            if (cellData.state === CELL_STATE.OPENED) {
                cellBtn.classList.add('open');

                if (cellData.type === CELL_TYPE.MINE) {
                    cellBtn.classList.add('mine');
                    cellBtn.textContent = '💣';

                    const isExploded =
                        gameState.explodedCell &&
                        gameState.explodedCell.row === r &&
                        gameState.explodedCell.col === c;

                    if (isExploded) {
                        cellBtn.classList.add('clicked');
                        cellBtn.setAttribute('aria-label', 'Підірвана міна');
                    } else {
                        cellBtn.setAttribute('aria-label', 'Відкрита міна');
                    }
                } else if (cellData.neighborMines > 0) {
                    cellBtn.classList.add(`num-${cellData.neighborMines}`);
                    cellBtn.textContent = String(cellData.neighborMines);
                    cellBtn.setAttribute('aria-label', `${cellData.neighborMines} мін поруч`);
                } else {
                    cellBtn.setAttribute('aria-label', 'Порожня відкрита клітинка');
                }
            } else if (cellData.state === CELL_STATE.FLAGGED) {
                cellBtn.classList.add('flag');
                cellBtn.textContent = '🚩';

                if (gameState.status === GAME_STATUS.LOSE && cellData.type !== CELL_TYPE.MINE) {
                    cellBtn.classList.add('false-flag', 'no-mine');
                    cellBtn.setAttribute('aria-label', 'Помилковий прапорець');
                } else {
                    cellBtn.classList.add('on-mine');
                    cellBtn.setAttribute('aria-label', 'Прапорець');
                }
            } else {
                cellBtn.setAttribute('aria-label', 'Закрита клітинка');
            }

            fragment.appendChild(cellBtn);
        }
    }

    boardElement.appendChild(fragment);

    if (focusedRow !== null && focusedCol !== null) {
        const cellToFocus = boardElement.querySelector(
            `.cell[data-row="${focusedRow}"][data-col="${focusedCol}"]`
        );
        if (cellToFocus) {
            cellToFocus.focus();
        }
    }

    updateHeaderUI();
}

/**
 * Ініціалізація / скидання стану та запуск нової гри
 */
function initGame(
    rows = gameState.rows,
    cols = gameState.cols,
    minesCount = gameState.minesCount
) {
    stopTimer();

    gameState.rows = rows;
    gameState.cols = cols;
    gameState.minesCount = minesCount;
    gameState.status = GAME_STATUS.PROCESS;
    gameState.gameTime = 0;
    gameState.explodedCell = null;

    board = generateField(rows, cols, minesCount);
    countNeighbourMines(board);
    renderBoard();
}

/**
 * ============================================================================
 * КРОК 7. ОБРОБКА ПОДІЙ КОРИСТУВАЧА (MOUSE & KEYBOARD EVENTS)
 * ============================================================================
 */

// Лівий клік (або Enter / Space по кнопці клітинки): відкриття клітинки
boardElement.addEventListener('click', (event) => {
    const cellBtn = event.target.closest('.cell');
    if (!cellBtn) return;

    const row = Number(cellBtn.dataset.row);
    const col = Number(cellBtn.dataset.col);

    openCell(row, col);
    renderBoard();
});

// Правий клік: встановлення/зняття прапорця та блокування контекстного меню браузера
boardElement.addEventListener('contextmenu', (event) => {
    event.preventDefault();

    const cellBtn = event.target.closest('.cell');
    if (!cellBtn) return;

    const row = Number(cellBtn.dataset.row);
    const col = Number(cellBtn.dataset.col);

    toggleFlag(row, col);
    renderBoard();
});

// Підтримка встановлення прапорця з клавіатури (клавіша F)
boardElement.addEventListener('keydown', (event) => {
    if (event.key === 'f' || event.key === 'F' || event.key === 'а' || event.key === 'А') {
        const cellBtn = event.target.closest('.cell');
        if (!cellBtn) return;

        event.preventDefault();
        const row = Number(cellBtn.dataset.row);
        const col = Number(cellBtn.dataset.col);

        toggleFlag(row, col);
        renderBoard();
    }
});

// Кнопка «Старт / Рестарт»
startBtnElement.addEventListener('click', () => {
    initGame();
});

// Автоматичний старт гри після завантаження сторінки
document.addEventListener('DOMContentLoaded', () => {
    initGame();
});