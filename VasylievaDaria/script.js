
const ROWS = 10;
const COLS = 10;
const MINES_COUNT = 15;
const MAX_TIME = 999;

const gameState = {
    board: [],
    gameOver: false,
    gameStarted: false,
    timer: null,
    seconds: 0,
    flagsCount: 0,
    revealedCount: 0
};

/** Creates an empty game board. */
function createBoard() {
    return Array.from({ length: ROWS }, (_, row) =>
        Array.from({ length: COLS }, (_, col) => ({
            row,
            col,
            isMine: false,
            isRevealed: false,
            isFlagged: false,
            neighborMines: 0
        }))
    );
}

/** Resets the game and creates a new minefield. */
function initGame() {
    stopTimer();

    gameState.board = createBoard();
    gameState.gameOver = false;
    gameState.gameStarted = false;
    gameState.seconds = 0;
    gameState.flagsCount = 0;
    gameState.revealedCount = 0;

    placeMines();
    calculateNeighbors();

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

/** Places mines at unique random positions. */
function placeMines() {
    let placedMines = 0;

    while (placedMines < MINES_COUNT) {
        const row = Math.floor(Math.random() * ROWS);
        const col = Math.floor(Math.random() * COLS);
        const cell = gameState.board[row][col];

        if (!cell.isMine) {
            cell.isMine = true;
            placedMines++;
        }
    }
}

/** Calculates the number of adjacent mines for each cell. */
function calculateNeighbors() {
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const cell = gameState.board[row][col];

            if (cell.isMine) {
                cell.neighborMines = 0;
                continue;
            }

            let count = 0;

            for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
                for (let colOffset = -1; colOffset <= 1; colOffset++) {
                    const neighborRow = row + rowOffset;
                    const neighborCol = col + colOffset;

                    if (
                        neighborRow >= 0 &&
                        neighborRow < ROWS &&
                        neighborCol >= 0 &&
                        neighborCol < COLS &&
                        gameState.board[neighborRow][neighborCol].isMine
                    ) {
                        count++;
                    }
                }
            }

            cell.neighborMines = count;
        }
    }
}

/** Updates the flag counter and timer display. */
function updateUI() {
    const flagCounter = document.getElementById('flags-count');
    const timerDisplay = document.getElementById('timer');

    if (flagCounter) {
        flagCounter.textContent =
            `🚩 ${MINES_COUNT - gameState.flagsCount}`;
    }

    if (timerDisplay) {
        const time = String(gameState.seconds).padStart(3, '0');
        timerDisplay.textContent = `⏱️ ${time}`;
    }
}

/** Starts the timer when the first cell is opened. */
function startTimer() {
    if (gameState.timer !== null) {
        return;
    }

    gameState.timer = setInterval(() => {
        if (gameState.seconds < MAX_TIME) {
            gameState.seconds++;
            updateUI();
        } else {
            stopTimer();
        }
    }, 1000);
}

/** Stops the active game timer. */
function stopTimer() {
    if (gameState.timer !== null) {
        clearInterval(gameState.timer);
        gameState.timer = null;
    }
}

/** Renders the board and restores keyboard focus when possible. */
function renderBoard() {
    const boardElement = document.getElementById('grid');

    if (!boardElement) {
        return;
    }

    const activeCell = document.activeElement;
    const activeRow = activeCell?.dataset.row;
    const activeCol = activeCell?.dataset.col;

    boardElement.innerHTML = '';

    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const cell = gameState.board[row][col];
            const cellButton = document.createElement('button');

            cellButton.type = 'button';
            cellButton.classList.add('cell');
            cellButton.dataset.row = row;
            cellButton.dataset.col = col;

            if (cell.isRevealed) {
                cellButton.classList.add('revealed');

                if (cell.isMine) {
                    cellButton.classList.add('mine');
                    cellButton.textContent = '💣';
                } else if (cell.neighborMines > 0) {
                    cellButton.textContent = cell.neighborMines;
                    cellButton.dataset.mines = cell.neighborMines;
                }
            } else if (cell.isFlagged) {
                cellButton.classList.add('flagged');
                cellButton.textContent = '🚩';
            }

            let cellDescription = 'Закрита клітинка';

            if (cell.isFlagged) {
                cellDescription = 'Позначено прапорцем';
            } else if (cell.isRevealed && cell.isMine) {
                cellDescription = 'Міна';
            } else if (cell.isRevealed) {
                cellDescription =
                    `Відкрито, сусідніх мін: ${cell.neighborMines}`;
            }

            cellButton.setAttribute(
                'aria-label',
                `Рядок ${row + 1}, стовпець ${col + 1}. ${cellDescription}`
            );

            cellButton.addEventListener('click', () => {
                handleCellClick(row, col);
            });

            cellButton.addEventListener('contextmenu', event => {
                event.preventDefault();
                handleCellRightClick(row, col);
            });

            cellButton.addEventListener('keydown', event => {
                if (event.key.toLowerCase() === 'f') {
                    event.preventDefault();
                    handleCellRightClick(row, col);
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

/** Opens a cell and processes the first move, loss or victory. */
function handleCellClick(row, col) {
    if (gameState.gameOver) {
        return;
    }

    const cell = gameState.board[row][col];

    if (cell.isRevealed || cell.isFlagged) {
        return;
    }

    if (!gameState.gameStarted) {
        gameState.gameStarted = true;

        if (cell.isMine) {
            relocateMine(row, col);
        }

        startTimer();
    }

    if (cell.isMine) {
        finishGame(false);
        return;
    }

    revealCell(row, col);
    renderBoard();

    if (checkWinCondition()) {
        finishGame(true);
    }
}

/** Moves a mine away from the first opened cell. */
function relocateMine(row, col) {
    const firstCell = gameState.board[row][col];
    firstCell.isMine = false;

    const availableCells = gameState.board
        .flat()
        .filter(cell =>
            !cell.isMine &&
            !(cell.row === row && cell.col === col)
        );

    const randomIndex = Math.floor(
        Math.random() * availableCells.length
    );

    availableCells[randomIndex].isMine = true;
    calculateNeighbors();
}

/** Toggles a flag without exceeding the mine count. */
function handleCellRightClick(row, col) {
    if (gameState.gameOver) {
        return;
    }

    const cell = gameState.board[row][col];

    if (cell.isRevealed) {
        return;
    }

    if (!cell.isFlagged && gameState.flagsCount >= MINES_COUNT) {
        return;
    }

    cell.isFlagged = !cell.isFlagged;
    gameState.flagsCount += cell.isFlagged ? 1 : -1;

    renderBoard();
    updateUI();
}

/** Reveals a safe cell and expands into adjacent empty cells. */
function revealCell(row, col) {
    if (
        row < 0 ||
        row >= ROWS ||
        col < 0 ||
        col >= COLS
    ) {
        return;
    }

    const cell = gameState.board[row][col];

    if (cell.isRevealed || cell.isFlagged || cell.isMine) {
        return;
    }

    cell.isRevealed = true;
    gameState.revealedCount++;

    if (cell.neighborMines === 0) {
        for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
            for (let colOffset = -1; colOffset <= 1; colOffset++) {
                revealCell(
                    row + rowOffset,
                    col + colOffset
                );
            }
        }
    }
}

/** Reveals all mines after a loss. */
function revealAllMines() {
    for (const row of gameState.board) {
        for (const cell of row) {
            if (cell.isMine) {
                cell.isRevealed = true;
            }
        }
    }
}

/** Checks whether all safe cells have been opened. */
function checkWinCondition() {
    return gameState.revealedCount ===
        ROWS * COLS - MINES_COUNT;
}

/** Finishes the game and displays its result. */
function finishGame(isWin) {
    gameState.gameOver = true;
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

/** Initializes the game and connects both restart buttons. */
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
