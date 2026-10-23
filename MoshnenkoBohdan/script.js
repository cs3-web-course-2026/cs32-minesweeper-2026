const startButton = document.getElementById('start-btn');
const restartButton = document.getElementById('restart-btn');
const modalRestartButton = document.getElementById('modal-restart-btn');
const menuCard = document.getElementById('menu-card');
const gameContainer = document.getElementById('game-container');
const boardElement = document.getElementById('board-element');
const rowsInput = document.getElementById('rows');
const colsInput = document.getElementById('columns');

const minesCountElement = document.getElementById('mines-count');
const timerElement = document.getElementById('timer');
const closedCountElement = document.getElementById('closed-count');
const gameStatusElement = document.getElementById('game-status');
const menuErrorElement = document.getElementById('menu-error');

const gameModal = document.getElementById('game-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');

const MIN_SIZE = 5;
const MAX_SIZE = 15;
const MINE_DENSITY = 0.20;
const INITIAL_MINES = Math.round(MIN_SIZE * MIN_SIZE * MINE_DENSITY);

// Enum-style constants to replace raw strings
const GAME_STATUS = {
    PROCESS: 'process',
    WIN: 'win',
    LOSE: 'lose'
};

const CELL_TYPE = {
    EMPTY: 'empty',
    MINE: 'mine'
};

const CELL_STATE = {
    CLOSED: 'closed',
    OPENED: 'opened',
    FLAGGED: 'flagged'
};

// Required contract structures: ONLY gameState and board allowed at top level
let gameState = {
    rows: MIN_SIZE,
    cols: MIN_SIZE,
    minesCount: INITIAL_MINES,
    status: GAME_STATUS.PROCESS,
    gameTime: 0,
    timerId: null
};

let board = []; // 2D array containing cell objects: { type, state, neighborMines }

// Helper functions to derive counts dynamically from board instead of separate variables
function getFlaggedCount() {
    let count = 0;
    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            if (board[row][col].state === CELL_STATE.FLAGGED) {
                count++;
            }
        }
    }
    return count;
}

function getSafeCellsRemaining() {
    let count = 0;
    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            if (board[row][col].type === CELL_TYPE.EMPTY && board[row][col].state !== CELL_STATE.OPENED) {
                count++;
            }
        }
    }
    return count;
}

function startGame() {
    const rowsRaw = rowsInput.value.trim();
    const colsRaw = colsInput.value.trim();

    const rows = Number(rowsRaw);
    const cols = Number(colsRaw);

    // Reject fractional or non-integer dimensions
    if (
        isNaN(rows) || isNaN(cols) ||
        !Number.isInteger(rows) || !Number.isInteger(cols) ||
        rows < MIN_SIZE || rows > MAX_SIZE ||
        cols < MIN_SIZE || cols > MAX_SIZE
    ) {
        menuErrorElement.textContent = `Please enter valid integer field dimensions between ${MIN_SIZE} and ${MAX_SIZE}.`;
        return;
    }

    menuErrorElement.textContent = '';
    menuCard.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    gameModal.classList.add('hidden');

    // Stop active timer before re-creating gameState to prevent multiple timers running
    stopTimer();

    const totalCells = rows * cols;
    const minesCount = Math.round(totalCells * MINE_DENSITY);

    gameState = {
        rows,
        cols,
        minesCount,
        status: GAME_STATUS.PROCESS,
        gameTime: 0,
        timerId: null
    };

    generateField(rows, cols, minesCount);
    countNeighbourMines();
    renderBoard();

    // Focus the first playable cell after renderBoard completes
    focusCell(0, 0);

    const safeCellsRemaining = getSafeCellsRemaining();
    const flaggedCount = getFlaggedCount();
    minesCountElement.textContent = gameState.minesCount - flaggedCount;
    closedCountElement.textContent = safeCellsRemaining;

    resetTimer();
    startTimer();
    updateStatus(`Game started. Mines: ${minesCount}, remaining safe cells: ${safeCellsRemaining}`);
}

startButton.addEventListener('click', startGame);
if (restartButton) restartButton.addEventListener('click', startGame);
if (modalRestartButton) modalRestartButton.addEventListener('click', startGame);

function generateField(rows, cols, minesCount) {
    board = [];
    for (let row = 0; row < rows; row++) {
        board[row] = [];
        for (let col = 0; col < cols; col++) {
            board[row][col] = {
                type: CELL_TYPE.EMPTY,
                state: CELL_STATE.CLOSED,
                neighborMines: 0
            };
        }
    }

    let minesPlanted = 0;
    while (minesPlanted < minesCount) {
        const randomRow = Math.floor(Math.random() * rows);
        const randomCol = Math.floor(Math.random() * cols);
        if (board[randomRow][randomCol].type === CELL_TYPE.EMPTY) {
            board[randomRow][randomCol].type = CELL_TYPE.MINE;
            minesPlanted++;
        }
    }
}

function countNeighbourMines() {
    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            if (board[row][col].type === CELL_TYPE.MINE) {
                continue;
            }
            let counter = 0;
            const left = Math.max(0, col - 1);
            const right = Math.min(gameState.cols - 1, col + 1);
            const high = Math.max(0, row - 1);
            const low = Math.min(gameState.rows - 1, row + 1);

            for (let neighbourRow = high; neighbourRow <= low; neighbourRow++) {
                for (let neighbourCol = left; neighbourCol <= right; neighbourCol++) {
                    if (neighbourRow === row && neighbourCol === col) {
                        continue;
                    }
                    if (board[neighbourRow][neighbourCol].type === CELL_TYPE.MINE) {
                        counter++;
                    }
                }
            }
            board[row][col].neighborMines = counter;
        }
    }
}

function renderBoard() {
    boardElement.innerHTML = '';
    boardElement.style.gridTemplateColumns = `repeat(${gameState.cols}, var(--cell-size))`;

    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            const cellData = board[row][col];
            const cellButton = document.createElement('button');
            cellButton.type = 'button';
            cellButton.classList.add('cell');
            cellButton.dataset.row = row;
            cellButton.dataset.col = col;

            // Build dynamic aria-label for accessibility (row, col, state, values)
            let ariaLabel = `Row ${row + 1}, column ${col + 1}, ${cellData.state}`;
            if (cellData.state === CELL_STATE.OPENED) {
                if (cellData.type === CELL_TYPE.MINE) {
                    ariaLabel = `Row ${row + 1}, column ${col + 1}, mine opened`;
                } else if (cellData.neighborMines > 0) {
                    ariaLabel = `Row ${row + 1}, column ${col + 1}, ${cellData.neighborMines} neighboring mines`;
                } else {
                    ariaLabel = `Row ${row + 1}, column ${col + 1}, empty opened`;
                }
            }
            cellButton.setAttribute('aria-label', ariaLabel);

            if (cellData.state === CELL_STATE.OPENED) {
                cellButton.classList.add('revealed');
                if (cellData.type === CELL_TYPE.MINE) {
                    cellButton.textContent = '💣';
                } else if (cellData.neighborMines > 0) {
                    cellButton.textContent = cellData.neighborMines;
                    cellButton.classList.add(`number-${cellData.neighborMines}`);
                }
            } else if (cellData.state === CELL_STATE.FLAGGED) {
                cellButton.classList.add('flagged');
                cellButton.textContent = '🚩';
            }

            cellButton.addEventListener('click', () => {
                if (gameState.status !== GAME_STATUS.PROCESS) return;
                openCell(row, col);
                renderBoard();
                focusCell(row, col);
            });

            cellButton.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                if (gameState.status !== GAME_STATUS.PROCESS) return;
                toggleFlag(row, col);
                renderBoard();
                focusCell(row, col);
            });

            boardElement.appendChild(cellButton);
        }
    }

    // Update info UI dynamically based on board data
    closedCountElement.textContent = getSafeCellsRemaining();
    const currentMinesLeft = gameState.minesCount - getFlaggedCount();
    minesCountElement.textContent = currentMinesLeft;
}

function openCell(row, col) {
    const cellData = board[row][col];
    if (cellData.state === CELL_STATE.OPENED || cellData.state === CELL_STATE.FLAGGED) {
        return;
    }

    if (cellData.type === CELL_TYPE.MINE) {
        cellData.state = CELL_STATE.OPENED;
        gameState.status = GAME_STATUS.LOSE;
        revealAllMines();
        stopTimer();
        updateStatus('Game over. You lost!');
        showModal('Game Over', 'You hit a mine and lost the game!');
        return;
    }

    cellData.state = CELL_STATE.OPENED;

    // Flood fill algorithm if neighborMines === 0
    if (cellData.neighborMines === 0) {
        const left = Math.max(0, col - 1);
        const right = Math.min(gameState.cols - 1, col + 1);
        const high = Math.max(0, row - 1);
        const low = Math.min(gameState.rows - 1, row + 1);

        for (let neighbourRow = high; neighbourRow <= low; neighbourRow++) {
            for (let neighbourCol = left; neighbourCol <= right; neighbourCol++) {
                if (board[neighbourRow][neighbourCol].state === CELL_STATE.CLOSED) {
                    openCell(neighbourRow, neighbourCol);
                }
            }
        }
    }

    if (getSafeCellsRemaining() === 0) {
        gameState.status = GAME_STATUS.WIN;
        stopTimer();
        updateStatus('Congratulations, you won!');
        showModal('Victory!', 'Congratulations, you successfully cleared all safe cells!');
    }
}

function toggleFlag(row, col) {
    const cellData = board[row][col];
    if (cellData.state === CELL_STATE.OPENED) {
        return;
    }

    if (cellData.state === CELL_STATE.FLAGGED) {
        cellData.state = CELL_STATE.CLOSED;
    } else {
        cellData.state = CELL_STATE.FLAGGED;
    }

    const currentMinesLeft = gameState.minesCount - getFlaggedCount();
    updateStatus(`Mines count: ${currentMinesLeft}`);
}

function revealAllMines() {
    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            if (board[row][col].type === CELL_TYPE.MINE) {
                board[row][col].state = CELL_STATE.OPENED;
            }
        }
    }
}

function focusCell(row, col) {
    if (gameState.status !== GAME_STATUS.PROCESS) return; // Modal owns focus after win or loss
    const target = boardElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (target) {
        target.focus();
    }
}

function startTimer() {
    gameState.timerId = setInterval(() => {
        gameState.gameTime++;
        const minutes = String(Math.floor(gameState.gameTime / 60)).padStart(2, '0');
        const seconds = String(gameState.gameTime % 60).padStart(2, '0');
        timerElement.textContent = `${minutes}:${seconds}`;
    }, 1000);