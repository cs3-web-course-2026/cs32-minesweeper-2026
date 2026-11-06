// VasylievaDaria/script.js

const ROWS = 10;
const COLS = 10;
const MINES_COUNT = 15;

const gameState = {
    board: [],
    gameOver: false,
    timer: null,
    seconds: 0,
    flagsCount: 0,
    revealedCount: 0
};

function initGame() {
    const newBoard = [];
    for (let r = 0; r < ROWS; r++) {
        const row = [];
        for (let c = 0; c < COLS; c++) {
            row.push({
                row: r,
                col: c,
                isMine: false,
                isRevealed: false,
                isFlagged: false,
                neighborMines: 0
            });
        }
        newBoard.push(row);
    }
    gameState.board = newBoard;
    gameState.gameOver = false;
    gameState.seconds = 0;
    gameState.flagsCount = 0;
    gameState.revealedCount = 0;

    clearInterval(gameState.timer);
    gameState.timer = null;

    placeMines();
    calculateNeighbors();
    renderBoard();
    updateUI();
}

function placeMines() {
    let placedMines = 0;
    while (placedMines < MINES_COUNT) {
        const randomRow = Math.floor(Math.random() * ROWS);
        const randomCol = Math.floor(Math.random() * COLS);
        if (!gameState.board[randomRow][randomCol].isMine) {
            gameState.board[randomRow][randomCol].isMine = true;
            placedMines++;
        }
    }
}

function calculateNeighbors() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = gameState.board[r][c];
            if (cell.isMine) continue;

            let count = 0;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                        if (gameState.board[nr][nc].isMine) {
                            count++;
                        }
                    }
                }
            }
            cell.neighborMines = count;
        }
    }
}

function updateUI() {
    const flagCounter = document.getElementById('flag-counter');
    if (flagCounter) {
        flagCounter.textContent = MINES_COUNT - gameState.flagsCount;
    }

    const timerDisplay = document.getElementById('timer');
    if (timerDisplay) {
        const formattedTime = String(gameState.seconds).padStart(3, '0');
        timerDisplay.textContent = formattedTime;
    }
}

function renderBoard() {
    const boardElement = document.getElementById('game-board');
    if (!boardElement) return;
    boardElement.innerHTML = '';

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = gameState.board[r][c];
            const cellDiv = document.createElement('div');
            cellDiv.classList.add('cell');

            if (cell.isRevealed) {
                cellDiv.classList.add('revealed');
                if (cell.isMine) {
                    cellDiv.classList.add('mine');
                    cellDiv.textContent = '💣';
                } else if (cell.neighborMines > 0) {
                    cellDiv.textContent = cell.neighborMines;
                    cellDiv.dataset.mines = cell.neighborMines;
                }
            } else if (cell.isFlagged) {
                cellDiv.classList.add('flagged');
                cellDiv.textContent = '🚩';
            }

            cellDiv.addEventListener('click', () => handleCellClick(r, c));
            cellDiv.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                handleCellRightClick(r, c);
            });

            boardElement.appendChild(cellDiv);
        }
    }
}

function handleCellClick(r, c) {
    if (gameState.gameOver) return;
    const cell = gameState.board[r][c];
    if (cell.isRevealed || cell.isFlagged) return;

    if (!gameState.timer) {
        gameState.timer = setInterval(() => {
            gameState.seconds++;
            updateUI();
        }, 1000);
    }

    if (cell.isMine) {
        revealAllMines();
        gameState.gameOver = true;
        clearInterval(gameState.timer);
        alert('Game Over!');
        return;
    }

    revealCell(r, c);
    renderBoard();

    if (checkWinCondition()) {
        gameState.gameOver = true;
        clearInterval(gameState.timer);
        alert('You Win!');
    }
}

function handleCellRightClick(r, c) {
    if (gameState.gameOver) return;
    const cell = gameState.board[r][c];
    if (cell.isRevealed) return;

    cell.isFlagged = !cell.isFlagged;
    gameState.flagsCount += cell.isFlagged ? 1 : -1;

    renderBoard();
    updateUI();
}

function revealCell(r, c) {
    const cell = gameState.board[r][c];
    if (cell.isRevealed || cell.isFlagged) return;

    cell.isRevealed = true;
    gameState.revealedCount++;

    if (cell.neighborMines === 0 && !cell.isMine) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                    revealCell(nr, nc);
                }
            }
        }
    }
}

function revealAllMines() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (gameState.board[r][c].isMine) {
                gameState.board[r][c].isRevealed = true;
            }
        }
    }
    renderBoard();
}

function checkWinCondition() {
    return gameState.revealedCount === (ROWS * COLS - MINES_COUNT);
}

document.addEventListener('DOMContentLoaded', () => {
    initGame();
    const restartButton = document.getElementById('restart-btn');
    if (restartButton) {
        restartButton.addEventListener('click', initGame);
    }
});