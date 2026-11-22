
const ROWS = 10;
const COLS = 10;
const MINES_COUNT = 15;

const GAME_STATUS = Object.freeze({
    PROCESS: 'process',
    WIN: 'win',
    LOSE: 'lose'
});

const gameState = {
    rows: ROWS,
    cols: COLS,
    minesCount: MINES_COUNT,
    status: GAME_STATUS.PROCESS,
    gameTime: 0,
    timerId: null,
    flagsCount: 0,
    revealedCount: 0
};

let board = [];

/** Creates a field of the requested size with unique mine positions. */
function generateField(rows, cols, minesCount) {
    if (!Number.isInteger(rows) || !Number.isInteger(cols) ||
        !Number.isInteger(minesCount) || rows <= 0 || cols <= 0 ||
        minesCount < 0 || minesCount >= rows * cols) {
        throw new RangeError('Invalid field dimensions or mine count');
    }
    
        gameState.rows = rows;
    gameState.cols = cols;
    gameState.minesCount = minesCount;
    gameState.flagsCount = 0;
    gameState.revealedCount = 0;

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

    updateNeighbourCounts(board);
    return board;
}

/** Counts mines adjacent to a cell, using the supplied field's bounds. */
function countNeighbourMines(row, col, field = board) {
    let count = 0;
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
        for (let colOffset = -1; colOffset <= 1; colOffset++) {
            const nextRow = row + rowOffset;
            const nextCol = col + colOffset;
            if (nextRow >= 0 && nextRow < field.length &&
                nextCol >= 0 && nextCol < field[nextRow].length &&
                field[nextRow][nextCol].type === 'mine') {
                count++;
            }
        }
    }
    return count;
}

/** Recalculates the adjacent mine counts for the specified field. */
function updateNeighbourCounts(field = board) {
    for (let row = 0; row < field.length; row++) {
        for (let col = 0; col < field[row].length; col++) {
            const cell = field[row][col];
            cell.neighborMines = cell.type === 'mine'
                ? 0
                : countNeighbourMines(row, col, field);
        }
    }
}

function updateUI() {
    const flagCounter = document.getElementById('flags-count');
    const timerDisplay = document.getElementById('timer');
    if (flagCounter) {
        flagCounter.textContent = `🚩 ${gameState.minesCount - gameState.flagsCount}`;
    }
    if (timerDisplay) {
        const displayedTime = String(Math.min(gameState.gameTime, 999)).padStart(3, '0');
        timerDisplay.textContent = `⏱️ ${displayedTime}`;
    }
}

function startTimer() {
    if (gameState.timerId !== null) return;
    gameState.timerId = setInterval(() => {
        if (gameState.status === GAME_STATUS.PROCESS) {
            gameState.gameTime++;
            updateUI();
        }
    }, 1000);
}

function stopTimer() {
    if (gameState.timerId !== null) {
        clearInterval(gameState.timerId);
        gameState.timerId = null;
    }
}

function initGame() {
    stopTimer();
    gameState.status = GAME_STATUS.PROCESS;
    gameState.gameTime = 0;
    gameState.flagsCount = 0;
    gameState.revealedCount = 0;
    generateField(gameState.rows, gameState.cols, gameState.minesCount);

    const message = document.getElementById('message');
    const restartButton = document.getElementById('restart-btn');
    if (message) message.textContent = '';
    if (restartButton) restartButton.textContent = '😇';
    renderBoard();
    updateUI();
}

/** Relocates a mine when the first opened cell contains one. */
function relocateMine(row, col) {
    board[row][col].type = 'empty';
    const availableCells = [];
    for (let currentRow = 0; currentRow < board.length; currentRow++) {
        for (let currentCol = 0; currentCol < board[currentRow].length; currentCol++) {
            if (board[currentRow][currentCol].type === 'empty' &&
                !(currentRow === row && currentCol === col)) {
                availableCells.push({ row: currentRow, col: currentCol });
            }
        }
    }
    const destination = availableCells[Math.floor(Math.random() * availableCells.length)];
    board[destination.row][destination.col].type = 'mine';
    updateNeighbourCounts(board);
}

function revealSafeCells(row, col) {
    if (row < 0 || row >= board.length || col < 0 || col >= board[row].length) return;
    const cell = board[row][col];
    if (cell.state !== 'closed' || cell.type === 'mine') return;
    cell.state = 'opened';
    gameState.revealedCount++;
    if (cell.neighborMines === 0) {
        for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
            for (let colOffset = -1; colOffset <= 1; colOffset++) {
                if (rowOffset !== 0 || colOffset !== 0) {
                    revealSafeCells(row + rowOffset, col + colOffset);
                }
            }
        }
    }
}

function checkWinCondition() {
    return gameState.revealedCount ===
        gameState.rows * gameState.cols - gameState.minesCount;
}

function revealAllMines() {
    for (const row of board) {
        for (const cell of row) {
            if (cell.type === 'mine') cell.state = 'opened';
        }
    }
}

function finishGame(isWin) {
    gameState.status = isWin ? GAME_STATUS.WIN : GAME_STATUS.LOSE;
    stopTimer();
    const message = document.getElementById('message');
    const restartButton = document.getElementById('restart-btn');
    if (isWin) {
        if (message) message.textContent = '🎉 Вітаємо! Ви перемогли!';
        if (restartButton) restartButton.textContent = '😎';
    } else {
        revealAllMines();
        if (message) message.textContent = '💥 Гру завершено! Ви програли.';
        if (restartButton) restartButton.textContent = '😵';
    }
    renderBoard();
    updateUI();
}

function openCell(row, col) {
    if (gameState.status !== GAME_STATUS.PROCESS) return;
    if (row < 0 || row >= board.length || col < 0 || col >= board[row].length) return;
    const cell = board[row][col];
    if (cell.state !== 'closed') return;

    // No separate status is needed: no revealed cells means this is the first move.
    if (gameState.revealedCount === 0) {
        if (cell.type === 'mine') relocateMine(row, col);
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

function toggleFlag(row, col) {
    if (gameState.status !== GAME_STATUS.PROCESS) return;
    if (row < 0 || row >= board.length || col < 0 || col >= board[row].length) return;
    const cell = board[row][col];
    if (cell.state === 'opened') return;
    if (cell.state === 'flagged') {
        cell.state = 'closed';
        gameState.flagsCount--;
    } else {
        if (gameState.flagsCount >= gameState.minesCount) return;
        cell.state = 'flagged';
        gameState.flagsCount++;
    }
    renderBoard();
    updateUI();
}

function renderBoard() {
    const boardElement = document.getElementById('grid');
    if (!boardElement) return;
    const activeCell = document.activeElement;
    const activeRow = activeCell?.dataset.row;
    const activeCol = activeCell?.dataset.col;
    boardElement.replaceChildren();

    for (let row = 0; row < board.length; row++) {
        for (let col = 0; col < board[row].length; col++) {
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
                    cellButton.dataset.mines = String(cell.neighborMines);
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
                cellDescription = `Відкрито, сусідніх мін: ${cell.neighborMines}`;
            }
            cellButton.setAttribute('aria-label',
                `Рядок ${row + 1}, стовпець ${col + 1}. ${cellDescription}`);
            cellButton.addEventListener('click', () => openCell(row, col));
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
            cell => cell.dataset.row === activeRow && cell.dataset.col === activeCol
        );
        nextCell?.focus();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initGame();
    const restartButton = document.getElementById('restart-btn');
    const newGameButton = document.getElementById('new-game-btn');
    if (restartButton) restartButton.addEventListener('click', initGame);
    if (newGameButton) newGameButton.addEventListener('click', initGame);
});
