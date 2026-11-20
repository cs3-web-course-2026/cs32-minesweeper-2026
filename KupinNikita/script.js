
const ROWS = 10;
const COLS = 10;
const MINES_COUNT = 15;

const gameState = {
    rows: ROWS,
    cols: COLS,
    minesCount: MINES_COUNT,
    status: 'process',
    gameTime: 0,
    timerId: null,
    field: [],
    flagsCount: 0,
    started: false
};

const boardElement = document.getElementById('game-board');
const timerElement = document.getElementById('timer');
const mineCounterElement = document.getElementById('mine-counter');
const messageElement = document.getElementById('game-message');
const restartButton = document.getElementById('restart-button');

const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],            [0, 1],
    [1, -1],  [1, 0],   [1, 1]
];

// Перевірка, чи координати знаходяться в межах поля.
function isInsideField(row, col) {
    return row >= 0 &&
        row < gameState.rows &&
        col >= 0 &&
        col < gameState.cols;
}

// Створення поля та випадкова розстановка мін.
function generateField(rows, cols, minesCount) {
    if (
        !Number.isInteger(rows) ||
        !Number.isInteger(cols) ||
        !Number.isInteger(minesCount) ||
        rows < 1 ||
        cols < 1 ||
        minesCount < 0 ||
        minesCount >= rows * cols
    ) {
        throw new Error('Некоректні параметри ігрового поля.');
    }

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

        if (field[row][col].type === 'mine') {
            continue;
        }

        field[row][col].type = 'mine';
        placedMines++;
    }

    return field;
}

// Підрахунок мін у восьми сусідніх клітинках.
function countNeighbourMines(field, row, col) {
    let count = 0;

    for (const [rowOffset, colOffset] of DIRECTIONS) {
        const nextRow = row + rowOffset;
        const nextCol = col + colOffset;

        if (
            nextRow >= 0 &&
            nextRow < field.length &&
            nextCol >= 0 &&
            nextCol < field[0].length &&
            field[nextRow][nextCol].type === 'mine'
        ) {
            count++;
        }
    }

    return count;
}

// Заповнення кількості сусідніх мін для всіх клітинок.
function calculateAllNeighbours() {
    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            const cell = gameState.field[row][col];

            if (cell.type === 'empty') {
                cell.neighborMines = countNeighbourMines(
                    gameState.field, row, col
                );
            }
        }
    }
}

// Запуск таймера лише один раз після першої дії.
function startTimer() {
    if (gameState.started || gameState.status !== 'process') {
        return;
    }

    gameState.started = true;

    gameState.timerId = setInterval(() => {
        if (gameState.status !== 'process') {
            stopTimer();
            return;
        }

        gameState.gameTime++;
        updateCounters();
    }, 1000);
}

// Зупинка таймера.
function stopTimer() {
    if (gameState.timerId !== null) {
        clearInterval(gameState.timerId);
        gameState.timerId = null;
    }
}

// Оновлення лічильників на сторінці.
function updateCounters() {
    const remainingMines = gameState.minesCount - gameState.flagsCount;

    mineCounterElement.textContent = String(remainingMines);
    timerElement.textContent = String(gameState.gameTime).padStart(3, '0');
}

// Відкриття клітинки.
function openCell(row, col) {
    if (
        gameState.status !== 'process' ||
        !isInsideField(row, col)
    ) {
        return;
    }

    const cell = gameState.field[row][col];

    if (cell.state === 'opened' || cell.state === 'flagged') {
        return;
    }

    startTimer();

    cell.state = 'opened';

    if (cell.type === 'mine') {
        finishGame('lose');
        return;
    }

    // Рекурсивно відкриваємо сусідні клітинки,
    // якщо навколо немає мін.
    if (cell.neighborMines === 0) {
        for (const [rowOffset, colOffset] of DIRECTIONS) {
            const nextRow = row + rowOffset;
            const nextCol = col + colOffset;

            if (!isInsideField(nextRow, nextCol)) {
                continue;
            }

            const neighbor = gameState.field[nextRow][nextCol];

            if (
                neighbor.state === 'closed' &&
                neighbor.type === 'empty'
            ) {
                openCell(nextRow, nextCol);
            }
        }
    }

    checkWin();
}

// Установлення або зняття прапорця.
function toggleFlag(row, col) {
    if (
        gameState.status !== 'process' ||
        !isInsideField(row, col)
    ) {
        return;
    }

    const cell = gameState.field[row][col];

    if (cell.state === 'opened') {
        return;
    }

    if (cell.state === 'flagged') {
        cell.state = 'closed';
        gameState.flagsCount--;
    } else {
        // Не дозволяємо поставити більше прапорців, ніж мін.
        if (gameState.flagsCount >= gameState.minesCount) {
            return;
        }

        cell.state = 'flagged';
        gameState.flagsCount++;
        startTimer();
    }

    renderField();
    updateCounters();
}

// Перевірка умови перемоги.
function checkWin() {
    const allSafeCellsOpened = gameState.field.every(row =>
        row.every(cell =>
            cell.type === 'mine' || cell.state === 'opened'
        )
    );

    if (allSafeCellsOpened) {
        finishGame('win');
    }
}

// Завершення гри.
function finishGame(status) {
    if (gameState.status !== 'process') {
        return;
    }

    gameState.status = status;
    stopTimer();

    if (status === 'win') {
        messageElement.textContent =
            '🎉 Перемога! Усі безпечні клітинки відкрито.';
        restartButton.textContent = '😎 Зіграти ще';
    } else {
        messageElement.textContent =
            '💥 Ти натрапив на міну. Спробуй ще раз!';
        restartButton.textContent = '😵 Зіграти ще';
    }

    renderField();
}

// Створення клітинок у DOM на основі стану поля.
function renderField() {
    boardElement.replaceChildren();

    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            const cell = gameState.field[row][col];
            const button = document.createElement('button');

            button.type = 'button';
            button.classList.add('cell');
            button.dataset.row = row;
            button.dataset.col = col;
            button.setAttribute('role', 'gridcell');

            if (cell.state === 'opened') {
                button.classList.add('opened');

                if (cell.type === 'mine') {
                    button.classList.add('mine');
                    button.textContent = '💣';
                    button.setAttribute('aria-label', 'Міна');
                } else if (cell.neighborMines > 0) {
                    button.textContent = cell.neighborMines;
                    button.classList.add(
                        `number-${cell.neighborMines}`
                    );
                    button.setAttribute(
                        'aria-label',
                        `Мін поруч: ${cell.neighborMines}`
                    );
                } else {
                    button.setAttribute('aria-label', 'Порожня клітинка');
                }
            } else if (
                gameState.status !== 'process' &&
                cell.type === 'mine'
            ) {
                // Після завершення показуємо всі міни.
                button.classList.add('opened', 'mine');
                button.textContent = '💣';
                button.setAttribute('aria-label', 'Міна');
            } else if (cell.state === 'flagged') {
                button.classList.add('flagged');
                button.textContent = '🚩';
                button.setAttribute('aria-label', 'Прапорець');
            } else {
                button.setAttribute('aria-label', 'Закрита клітинка');
            }

            boardElement.appendChild(button);
        }
    }

    updateCounters();
}

// Обробка лівих кліків через делегування подій.
boardElement.addEventListener('click', event => {
    const button = event.target.closest('.cell');

    if (!button || !boardElement.contains(button)) {
        return;
    }

    const row = Number(button.dataset.row);
    const col = Number(button.dataset.col);

    openCell(row, col);
    renderField();
});

// Обробка правих кліків.
boardElement.addEventListener('contextmenu', event => {
    event.preventDefault();

    const button = event.target.closest('.cell');

    if (!button || !boardElement.contains(button)) {
        return;
    }

    const row = Number(button.dataset.row);
    const col = Number(button.dataset.col);

    toggleFlag(row, col);
});

// Початок нової гри.
function startNewGame() {
    stopTimer();

    gameState.status = 'process';
    gameState.gameTime = 0;
    gameState.flagsCount = 0;
    gameState.started = false;

    gameState.field = generateField(
        gameState.rows,
        gameState.cols,
        gameState.minesCount
    );

    calculateAllNeighbours();

    restartButton.textContent = '🙂 Нова гра';
    messageElement.textContent =
        'Натисни на клітинку, щоб почати.';

    renderField();
}

restartButton.addEventListener('click', startNewGame);

// Ініціалізація першої гри.
startNewGame();
