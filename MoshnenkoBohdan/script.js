const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const modalRestartBtn = document.getElementById('modal-restart-btn');
const menuCard = document.getElementById('menu-card');
const gameContainer = document.getElementById('game-container');
const boardElement = document.getElementById('board-element');
const rowsInput = document.getElementById('rows');
const colsInput = document.getElementById('columns');

const minesCountEl = document.getElementById('mines-count');
const timerEl = document.getElementById('timer');
const closedCountEl = document.getElementById('closed-count');
const gameStatusEl = document.getElementById('game-status');
const menuErrorEl = document.getElementById('menu-error');

const gameModal = document.getElementById('game-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');

const MIN_SIZE = 5;
const MAX_SIZE = 15;
const MINE_DENSITY = 0.20;

// Required contract structures
let gameState = {
    rows: 5,
    cols: 5,
    minesCount: 5,
    status: 'process', // 'process', 'win', 'lose'
    gameTime: 0,
    timerId: null
};

let board = []; // 2D array containing cell objects: { type, state, neighbourMines }
let safeCellsRemaining = 0;
let flaggedCount = 0; // Separate variable to track placed flags without mutating total mines

function startGame() {
    const rows = parseInt(rowsInput.value, 10);
    const cols = parseInt(colsInput.value, 10);

    if (isNaN(rows) || isNaN(cols) || rows < MIN_SIZE || rows > MAX_SIZE || cols < MIN_SIZE || cols > MAX_SIZE) {
        menuErrorEl.textContent = 'Please enter valid field dimensions between 5 and 15.';
        return;
    }

    menuErrorEl.textContent = '';
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
        status: 'process',
        gameTime: 0,
        timerId: null
    };

    safeCellsRemaining = totalCells - minesCount;
    flaggedCount = 0;

    minesCountEl.textContent = gameState.minesCount - flaggedCount;
    closedCountEl.textContent = safeCellsRemaining;

    generateField(rows, cols, minesCount);
    countNeighbourMines();
    renderBoard();

    resetTimer();
    startTimer();
    updateStatus(`Game started. Mines: ${minesCount}, remaining safe cells: ${safeCellsRemaining}`);
}

startBtn.addEventListener('click', startGame);
if (restartBtn) restartBtn.addEventListener('click', startGame);
if (modalRestartBtn) modalRestartBtn.addEventListener('click', startGame);

function generateField(rows, cols, minesCount) {
    board = [];
    for (let row = 0; row < rows; row++) {
        board[row] = [];
        for (let col = 0; col < cols; col++) {
            board[row][col] = {
                type: 'empty',
                state: 'closed', // 'closed', 'opened', 'flagged'
                neighbourMines: 0
            };
        }
    }

    let minesPlanted = 0;
    while (minesPlanted < minesCount) {
        const randomRow = Math.floor(Math.random() * rows);
        const randomCol = Math.floor(Math.random() * cols);
        if (board[randomRow][randomCol].type === 'empty') {
            board[randomRow][randomCol].type = 'mine';
            minesPlanted++;
        }
    }
}

function countNeighbourMines() {
    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            if (board[row][col].type === 'mine') {
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
                    if (board[neighbourRow][neighbourCol].type === 'mine') {
                        counter++;
                    }
                }
            }
            board[row][col].neighbourMines = counter;
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

            if (cellData.state === 'opened') {
                cellButton.classList.add('revealed');
                if (cellData.type === 'mine') {
                    cellButton.textContent = '💣';
                } else if (cellData.neighbourMines > 0) {
                    cellButton.textContent = cellData.neighbourMines;
                    cellButton.classList.add(`number-${cellData.neighbourMines}`);
                }
            } else if (cellData.state === 'flagged') {
                cellButton.classList.add('flagged');
                cellButton.textContent = '🚩';
            }

            cellButton.addEventListener('click', () => {
                if (gameState.status !== 'process') return;
                openCell(row, col);
            });

            cellButton.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (gameState.status !== 'process') return;
                toggleFlag(row, col);
            });

            boardElement.appendChild(cellButton);
        }
    }
}

function openCell(row, col) {
    const cellData = board[row][col];
    if (cellData.state === 'opened' || cellData.state === 'flagged') {
        return;
    }

    if (cellData.type === 'mine') {
        cellData.state = 'opened';
        gameState.status = 'lose';
        revealAllMines();
        renderBoard();
        stopTimer();
        updateStatus('Game over. You lost!');
        showModal('Game Over', 'You hit a mine and lost the game!');
        return;
    }

    cellData.state = 'opened';
    safeCellsRemaining--;
    closedCountEl.textContent = safeCellsRemaining;

    // Flood fill algorithm if neighbourMines === 0
    if (cellData.neighbourMines === 0) {
        const left = Math.max(0, col - 1);
        const right = Math.min(gameState.cols - 1, col + 1);
        const high = Math.max(0, row - 1);
        const low = Math.min(gameState.rows - 1, row + 1);

        for (let neighbourRow = high; neighbourRow <= low; neighbourRow++) {
            for (let neighbourCol = left; neighbourCol <= right; neighbourCol++) {
                if (board[neighbourRow][neighbourCol].state === 'closed') {
                    openCell(neighbourRow, neighbourCol);
                }
            }
        }
    }

    renderBoard();

    if (safeCellsRemaining === 0) {
        gameState.status = 'win';
        stopTimer();
        updateStatus('Congratulations, you won!');
        showModal('Victory!', 'Congratulations, you successfully cleared all safe cells!');
    }
}

function toggleFlag(row, col) {
    const cellData = board[row][col];
    if (cellData.state === 'opened') {
        return;
    }

    if (cellData.state === 'flagged') {
        cellData.state = 'closed';
        flaggedCount--;
    } else {
        cellData.state = 'flagged';
        flaggedCount++;
    }

    const currentMinesLeft = gameState.minesCount - flaggedCount;
    minesCountEl.textContent = currentMinesLeft;
    renderBoard();
    updateStatus(`Mines count: ${currentMinesLeft}`);
}

function revealAllMines() {
    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            if (board[row][col].type === 'mine') {
                board[row][col].state = 'opened';
            }
        }
    }
}

function startTimer() {
    gameState.timerId = setInterval(() => {
        gameState.gameTime++;
        const mins = String(Math.floor(gameState.gameTime / 60)).padStart(2, '0');
        const secs = String(gameState.gameTime % 60).padStart(2, '0');
        timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
}

function stopTimer() {
    if (gameState && gameState.timerId) {
        clearInterval(gameState.timerId);
        gameState.timerId = null;
    }
}

function resetTimer() {
    stopTimer();
    gameState.gameTime = 0;
    timerEl.textContent = '00:00';
}

function updateStatus(message) {
    if (gameStatusEl) {
        gameStatusEl.textContent = message;
    }
}

function showModal(title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    gameModal.classList.remove('hidden');
    if (modalRestartBtn) {
        modalRestartBtn.focus();
    }
}