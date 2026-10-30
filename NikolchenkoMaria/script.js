// Стан гри та її основні параметри
const gameState = {
    rows: 9,
    cols: 9,
    minesCount: 10,
    status: 'process',
    gameTime: 0,
    timerId: null,
    field: [],
    flagsCount: 0,
    firstMove: true,
    explodedCell: null
};

const boardElement = document.querySelector('.board');
const timerElement = document.querySelector('#timer');
const flagsElement = document.querySelector('#flag-count');
const restartButton = document.querySelector('.restart-button');
const statusElement = document.querySelector('#game-status');

function createEmptyField(rows, cols) {
    return Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({
            type: 'empty',
            state: 'closed',
            neighborMines: 0
        }))
    );
}

function generateField(rows, cols, minesCount, safeCell = null) {
    if (minesCount < 0 || minesCount >= rows * cols) {
        throw new Error('Некоректна кількість мін для розміру поля');
    }

    const field = createEmptyField(rows, cols);
    let placedMines = 0;

    // Розставляємо міни у випадкових клітинках
    while (placedMines < minesCount) {
        const row = Math.floor(Math.random() * rows);
        const col = Math.floor(Math.random() * cols);

        // Перша відкрита клітинка гарантовано безпечна
        if (safeCell && safeCell.row === row && safeCell.col === col) {
            continue;
        }

        if (field[row][col].type === 'empty') {
            field[row][col].type = 'mine';
            placedMines++;
        }
    }

    countNeighbourMines(field);
    return field;
}

function countNeighbourMines(field) {
    const rows = field.length;
    const cols = field[0].length;

    // Перебираємо всі клітинки поля
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const cell = field[row][col];

            if (cell.type === 'mine') {
                continue;
            }

            let count = 0;

            // Перевіряємо вісім сусідніх клітинок
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) {
                        continue;
                    }

                    const nr = row + dr;
                    const nc = col + dc;

                    if (
                        nr >= 0 && nr < rows &&
                        nc >= 0 && nc < cols &&
                        field[nr][nc].type === 'mine'
                    ) {
                        count++;
                    }
                }
            }

            cell.neighborMines = count;
        }
    }
}

function startTimer() {
    if (gameState.timerId !== null) {
        return;
    }

    gameState.timerId = setInterval(() => {
        if (gameState.status !== 'process') {
            stopTimer();
            return;
        }

        gameState.gameTime++;
        updateUI();
    }, 1000);
}

function stopTimer() {
    if (gameState.timerId !== null) {
        clearInterval(gameState.timerId);
        gameState.timerId = null;
    }
}

function checkWin() {
    // Перемога настає, коли відкрито всі безпечні клітинки
    const allSafeOpened = gameState.field.every(row =>
        row.every(cell =>
            cell.type === 'mine' || cell.state === 'opened'
        )
    );

    if (allSafeOpened) {
        gameState.status = 'win';
        stopTimer();

        // Автоматично позначаємо міни після перемоги
        gameState.field.forEach(row => {
            row.forEach(cell => {
                if (cell.type === 'mine' && cell.state !== 'flagged') {
                    cell.state = 'flagged';
                }
            });
        });

        gameState.flagsCount = gameState.minesCount;
    }
}

function openCell(row, col) {
    // Перевіряємо статус гри та межі поля
    if (
        gameState.status !== 'process' ||
        row < 0 || row >= gameState.rows ||
        col < 0 || col >= gameState.cols
    ) {
        return;
    }

    const cell = gameState.field[row][col];

    // Не відкриваємо вже відкриті клітинки або прапорці
    if (cell.state !== 'closed') {
        return;
    }

    if (gameState.firstMove) {
        // Зберігаємо встановлені прапорці
        const flaggedPositions = [];

        gameState.field.forEach((cells, r) => {
            cells.forEach((item, c) => {
                if (item.state === 'flagged') {
                    flaggedPositions.push([r, c]);
                }
            });
        });

        // Створюємо поле без міни на місці першого кліку
        gameState.field = generateField(
            gameState.rows,
            gameState.cols,
            gameState.minesCount,
            { row, col }
        );

        flaggedPositions.forEach(([r, c]) => {
            gameState.field[r][c].state = 'flagged';
        });

        gameState.firstMove = false;
        startTimer();
    }

    revealCell(row, col);

    if (gameState.status === 'process') {
        checkWin();
    }

    renderBoard();
    updateUI();
}

function revealCell(row, col) {
    // Перевіряємо межі поля та стан гри
    if (
        row < 0 || row >= gameState.rows ||
        col < 0 || col >= gameState.cols ||
        gameState.status !== 'process'
    ) {
        return;
    }

    const cell = gameState.field[row][col];

    if (cell.state !== 'closed') {
        return;
    }

    cell.state = 'opened';

    // Якщо відкрито міну, завершуємо гру
    if (cell.type === 'mine') {
        gameState.status = 'lose';
        gameState.explodedCell = { row, col };
        stopTimer();
        return;
    }

    // Рекурсивно відкриваємо сусідів порожньої клітинки
    if (cell.neighborMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) {
                    continue;
                }

                revealCell(row + dr, col + dc);
            }
        }
    }
}

function toggleFlag(row, col) {
    if (gameState.status !== 'process') {
        return;
    }

    const cell = gameState.field[row][col];

    // Не дозволяємо ставити прапорець на відкриту клітинку
    if (cell.state === 'opened') {
        return;
    }

    if (cell.state === 'flagged') {
        cell.state = 'closed';
        gameState.flagsCount--;
    } else if (gameState.flagsCount < gameState.minesCount) {
        cell.state = 'flagged';
        gameState.flagsCount++;
    }

    renderBoard();
    updateUI();
}

function renderBoard() {
    // Кількість стовпців визначається параметрами гри
    boardElement.style.setProperty('--board-columns', gameState.cols);
    boardElement.replaceChildren();

    const fragment = document.createDocumentFragment();

    gameState.field.forEach((cells, row) => {
        cells.forEach((cell, col) => {
            const button = document.createElement('button');

            button.type = 'button';
            button.className = 'cell';
            button.dataset.row = row;
            button.dataset.col = col;

            const showMine =
                gameState.status === 'lose' &&
                cell.type === 'mine';

            const wrongFlag =
                gameState.status === 'lose' &&
                cell.state === 'flagged' &&
                cell.type !== 'mine';

            const exploded =
                gameState.explodedCell &&
                gameState.explodedCell.row === row &&
                gameState.explodedCell.col === col;

            // Визначаємо вигляд клітинки
            if (wrongFlag) {
                button.classList.add('flagged-safe');
                button.textContent = '❌';
                button.setAttribute(
                    'aria-label',
                    'Помилковий прапорець'
                );
            } else if (cell.state === 'flagged') {
                button.classList.add('flagged-mine');
                button.textContent = '🚩';
                button.setAttribute('aria-label', 'Прапорець');
            } else if (exploded) {
                button.classList.add('exploded');
                button.textContent = '💣';
                button.setAttribute(
                    'aria-label',
                    'Міна, що вибухнула'
                );
            } else if (showMine) {
                button.classList.add('mine');
                button.textContent = '💣';
                button.setAttribute('aria-label', 'Міна');
            } else if (cell.state === 'opened') {
                button.classList.add('opened');

                if (cell.neighborMines > 0) {
                    button.classList.add(
                        `number-${cell.neighborMines}`
                    );
                    button.textContent = cell.neighborMines;
                }

                button.setAttribute(
                    'aria-label',
                    `Відкрито: ${cell.neighborMines} мін поруч`
                );
            } else {
                button.classList.add('closed');
                button.setAttribute(
                    'aria-label',
                    'Закрита клітинка'
                );
            }

            // Блокуємо відкриті клітинки та завершену гру
            button.disabled =
                gameState.status !== 'process' ||
                cell.state === 'opened';

            fragment.appendChild(button);
        });
    });

    boardElement.appendChild(fragment);
}

function updateUI() {
    // Оновлюємо таймер і лічильник прапорців
    timerElement.textContent =
        String(gameState.gameTime).padStart(2, '0');

    flagsElement.textContent =
        `${gameState.flagsCount} / ${gameState.minesCount}`;

    // Змінюємо вигляд кнопки залежно від результату
    if (gameState.status === 'win') {
        restartButton.textContent = '😎';
    } else if (gameState.status === 'lose') {
        restartButton.textContent = '😵';
    } else {
        restartButton.textContent = '🙂';
    }

    // Відображаємо поточний статус гри
    if (statusElement) {
        if (gameState.status === 'win') {
            statusElement.textContent =
                'Перемога! Усі безпечні клітинки відкрито.';
        } else if (gameState.status === 'lose') {
            statusElement.textContent =
                'Поразка! Ви натрапили на міну.';
        } else {
            statusElement.textContent = 'Гра триває';
        }
    }
}

function startGame() {
    // Зупиняємо попередній таймер і скидаємо параметри
    stopTimer();

    gameState.status = 'process';
    gameState.gameTime = 0;
    gameState.flagsCount = 0;
    gameState.firstMove = true;
    gameState.explodedCell = null;

    // Генеруємо нове ігрове поле
    gameState.field = generateField(
        gameState.rows,
        gameState.cols,
        gameState.minesCount
    );

    renderBoard();
    updateUI();
}

// Лівий клік відкриває клітинку
boardElement.addEventListener('click', event => {
    const cell = event.target.closest('.cell');

    if (!cell || !boardElement.contains(cell)) {
        return;
    }

    openCell(
        Number(cell.dataset.row),
        Number(cell.dataset.col)
    );
});

// Правий клік встановлює або знімає прапорець
boardElement.addEventListener('contextmenu', event => {
    const cell = event.target.closest('.cell');

    if (!cell || !boardElement.contains(cell)) {
        return;
    }

    event.preventDefault();

    toggleFlag(
        Number(cell.dataset.row),
        Number(cell.dataset.col)
    );
});

// Кнопка перезапуску створює нову гру
restartButton.addEventListener('click', startGame);

// Запускаємо гру після завантаження сторінки
startGame();
