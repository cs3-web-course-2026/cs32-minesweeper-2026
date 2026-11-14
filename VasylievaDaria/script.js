
const ROWS = 10;
const COLS = 10;
const MINES_COUNT = 15;

const gameState = {
    rows: ROWS,
    cols: COLS,
    minesCount: MINES_COUNT,
    status: 'ready',
    gameTime: 0,
    timerId: null,
    flagsCount: 0,
    revealedCount: 0
};

let board = [];

/** Creates a new field and places mines at unique positions. */
function generateField(rows, cols, minesCount) {
    board = Array.from({ length: rows }, () =>
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

        if (board[row][col].type === 'empty') {
            board[row][col].type = 'mine';
            placedMines++;
        }
    }

    updateNeighbourCounts();
    return board;
}

/** Counts mines surrounding the specified cell. */
function countNeighbourMines(row, col) {
    let count = 0;

    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
        for (let colOffset = -1; colOffset <= 1; colOffset++) {
            const nextRow = row + rowOffset;
            const nextCol = col + colOffset;

            if (
                nextRow >= 0 &&
                nextRow < gameState.rows &&
                nextCol >= 0 &&
                nextCol < gameState.cols &&
                board[nextRow][nextCol].type === 'mine'
            ) {
                count++;
            }
        }
    }

    return count;
}

/** Recalculates neighboring mine counts for the entire field. */
function updateNeighbourCounts() {
    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            const cell = board[row][col];

            cell.neighborMines = cell.type === 'mine'
                ? 0
                : countNeighbourMines(row, col);
        }
    }
}

/** Updates the flag counter and elapsed time. */
function updateUI() {
    const flagCounter = document.getElementById('flags-count');
    const timerDisplay = document.getElementById('timer');

    if (flagCounter) {
        flagCounter.textContent =
            `🚩 ${gameState.minesCount - gameState.flagsCount}`;
    }

    if (timerDisplay) {
        const displayedTime = String(
            Math.min(gameState.gameTime, 999)
        ).padStart(3, '0');

        timerDisplay.textContent = `⏱️ ${displayedTime}`;
    }
}

/** Starts the timer after the first valid move. */
function startTimer() {
    if (gameState.timerId !== null) {
        return;
    }

    gameState.timerId = setInterval(() => {
        if (gameState.status === 'playing') {
            gameState.gameTime++;
            updateUI();
        }
    }, 1000);
}

/** Stops the current timer. */
function stopTimer() {
    if (gameState.timerId !== null) {
        clearInterval(gameState.timerId);
        gameState.timerId = null;
    }
}

/** Resets the game to its initial state. */
function initGame() {
    stopTimer();

    gameState.status = 'ready';
    gameState.gameTime = 0;
    gameState.flagsCount = 0;
    gameState.revealedCount = 0;

    generateField(
        gameState.rows,
        gameState.cols,
        gameState.minesCount
    );

    const message = document.getElementById('message');
    const restartButton = document.getElementById('restart-btn');

    if (message) {
        message.textContent = '';
    }

    if (restartButton) {
        restartButton.textContent = '😇';
    }

    renderBoard();
    updateUI();
}

/** Moves a mine away from the first opened cell. */
function relocateMine(row, col) {
    board[row][col].type = 'empty';

    const availableCells = [];

    for (let currentRow = 0; currentRow < gameState.rows; currentRow++) {
        for (let currentCol = 0; currentCol < gameState.cols; currentCol++) {
            if (
                board[currentRow][currentCol].type === 'empty' &&
                !(currentRow === row && currentCol === col)
            ) {
                availableCells.push({
                    row: currentRow,
                    col: currentCol
                });
            }
        }
    }

    const randomIndex = Math.floor(
        Math.random() * availableCells.length
    );
    const destination = availableCells[randomIndex];

    board[destination.row][destination.col].type = 'mine';
    updateNeighbourCounts();
}

/** Opens a safe cell and recursively expands empty areas. */
function revealSafeCells(row, col) {
    if (
        row < 0 ||
        row >= gameState.rows ||
        col < 0 ||
        col >= gameState.cols
    ) {
        return;
    }

    const cell = board[row][col];

    if (cell.state !== 'closed' || cell.type === 'mine') {
        return;
    }

    cell.state = 'opened';
    gameState.revealedCount++;

    if (cell.neighborMines === 0) {
        for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
            for (let colOffset = -1; colOffset <= 1; colOffset++) {
                if (rowOffset !== 0 || colOffset !== 0) {
                    revealSafeCells(
                        row + rowOffset,
                        col + colOffset
                    );
                }
            }
        }
    }
}

/** Checks whether every safe cell has been opened. */
function checkWinCondition() {
    return gameState.revealedCount ===
        gameState.rows * gameState.cols - gameState.minesCount;
}

/** Reveals every mine after a loss. */
function revealAllMines() {
    for (const row of board) {
        for (const cell of row) {
            if (cell.type === 'mine') {
                cell.state = 'opened';
            }
        }
    }
}

/** Finishes the game and displays the result. */
function finishGame(isWin) {
    gameState.status = isWin ? 'won' : 'lost';
    stopTimer();

    const message = document.getElementById('message');
    const restartButton = document.getElementById('restart-btn');

    if (isWin) {
        if (message) {
            message.textContent = '🎉 Вітаємо! Ви перемогли!';
        }

        if (restartButton) {
            restartButton.textContent = '😎';
        }
    } else {
        revealAllMines();

        if (message) {
            message.textContent = '💥 Гру завершено! Ви програли.';
        }

        if (restartButton) {
            restartButton.textContent = '😵';
        }
    }

    renderBoard();
    updateUI();
}

/** Opens a cell and handles the first move and game result. */
function openCell(row, col) {
    if (
        gameState.status === 'won' ||
        gameState.status === 'lost'
    ) {
        return;
    }

    if (
        row < 0 ||
        row >= gameState.rows ||
        col < 0 ||
        col >= gameState.cols
    ) {
        return;
    }

    const cell = board[row][col];

    if (cell.state !== 'closed') {
        return;
    }

    if (gameState.status === 'ready') {
        if (cell.type === 'mine') {
            relocateMine(row, col);
        }

        gameState.status = 'playing';
        startTimer();
    }

    if (cell.type === 'mine') {
        finishGame(false);
        return;
    }

    revealSafeCells(row, col);

    if (checkWinCondition()) {
        finishGame(true);
    } else {
        renderBoard();
        updateUI();
    }
}

/** Adds or removes a flag from a closed cell. */
function toggleFlag(row, col) {
    if (
        gameState.status === 'won' ||
        gameState.status === 'lost'
    ) {
        return;
    }

    if (
        row < 0 ||
        row >= gameState.rows ||
        col < 0 ||
        col >= gameState.cols
    ) {
        return;
    }

    const cell = board[row][col];

    if (cell.state === 'opened') {
        return;
    }

    if (cell.state === 'flagged') {
        cell.state = 'closed';
        gameState.flagsCount--;
    } else {
        if (gameState.flagsCount >= gameState.minesCount) {
            return;
        }

        cell.state = 'flagged';
        gameState.flagsCount++;
    }

    renderBoard();
    updateUI();
}

/** Renders accessible cell buttons and preserves keyboard focus. */
function renderBoard() {
    const boardElement = document.getElementById('grid');

    if (!boardElement) {
        return;
    }

    const activeCell = document.activeElement;
    const activeRow = activeCell?.dataset.row;
    const activeCol = activeCell?.dataset.col;

    boardElement.replaceChildren();

    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            const cell = board[row][col];
            const cellButton = document.createElement('button');

            cellButton.type = 'button';
            cellButton.classList.add('cell');
            cellButton.dataset.row = String(row);
            cellButton.dataset.col = String(col);

            if (cell.state === 'opened') {
                cellButton.classList.add('revealed');

                if (cell.type === 'mine') {
                    cellButton.classList.add('mine');
                    cellButton.textContent = '💣';
                } else if (cell.neighborMines > 0) {
                    cellButton.textContent = String(cell.neighborMines);
                    cellButton.dataset.mines = String(
                        cell.neighborMines
                    );
                }
            } else if (cell.state === 'flagged') {
                cellButton.classList.add('flagged');
                cellButton.textContent = '🚩';
            }

            let cellDescription = 'Закрита клітинка';

            if (cell.state === 'opened' && cell.type === 'mine') {
                cellDescription = 'Відкрита міна';
            } else if (cell.state === 'flagged') {
                cellDescription = 'Позначено прапорцем';
            } else if (cell.state === 'opened') {
                cellDescription =
                    `Відкрито, сусідніх мін: ${cell.neighborMines}`;
            }

            cellButton.setAttribute(
                'aria-label',
                `Рядок ${row + 1}, стовпець ${col + 1}. ${cellDescription}`
            );

            cellButton.addEventListener('click', () => {
                openCell(row, col);
            });

            cellButton.addEventListener('contextmenu', event => {
                event.preventDefault();
                toggleFlag(row, col);
            });

            cellButton.addEventListener('keydown', event => {
                if (event.key.toLowerCase() === 'f') {
                    event.preventDefault();
                    toggleFlag(row, col);
                }
            });

            boardElement.appendChild(cellButton);
        }
    }

    if (activeRow !== undefined && activeCol !== undefined) {
        const nextCell = Array.from(boardElement.children).find(
            cell =>
                cell.dataset.row === activeRow &&
                cell.dataset.col === activeCol
        );

        nextCell?.focus();
    }
}

/** Initializes the game and connects the restart controls. */
document.addEventListener('DOMContentLoaded', () => {
    initGame();

    const restartButton = document.getElementById('restart-btn');
    const newGameButton = document.getElementById('new-game-btn');

    if (restartButton) {
        restartButton.addEventListener('click', initGame);
    }

    if (newGameButton) {
        newGameButton.addEventListener('click', initGame);
    }
});
