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

const NEIGHBOR_OFFSETS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
];

const TIMER_INTERVAL_MS = 1000;
const DISPLAY_DIGITS = 3;

const gameState = {
    rows: 9,
    cols: 9,
    minesCount: 10,
    status: GAME_STATUS.PROCESS,
    gameTime: 0,
    timerId: null,
    flagsCount: 0
};

let board = [];

const boardElement = document.querySelector('.game-board');
const minesCounterElement = document.querySelector('.mines-counter');
const timerElement = document.querySelector('.timer');
const resetButton = document.querySelector('.reset-btn');
const statusMessageElement = document.querySelector('.game-status-message');

function generateField(rows, cols, minesCount) {
    board = [];
    
    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
        const rowArray = [];
        for (let colIndex = 0; colIndex < cols; colIndex++) {
            rowArray.push({
                type: CELL_TYPE.EMPTY,
                neighborMines: 0,
                state: CELL_STATE.CLOSED
            });
        }
        board.push(rowArray);
    }

    let placedMines = 0;
    while (placedMines < minesCount) {
        const randomRow = Math.floor(Math.random() * rows);
        const randomCol = Math.floor(Math.random() * cols);
        
        if (board[randomRow][randomCol].type !== CELL_TYPE.MINE) {
            board[randomRow][randomCol].type = CELL_TYPE.MINE;
            placedMines++;
        }
    }
}

function countNeighbourMines() {
    for (let rowIndex = 0; rowIndex < gameState.rows; rowIndex++) {
        for (let colIndex = 0; colIndex < gameState.cols; colIndex++) {
            if (board[rowIndex][colIndex].type === CELL_TYPE.MINE) continue;

            let count = 0;
            for (const [rowOffset, colOffset] of NEIGHBOR_OFFSETS) {
                const neighborRow = rowIndex + rowOffset;
                const neighborCol = colIndex + colOffset;
                
                if (neighborRow >= 0 && neighborRow < gameState.rows && neighborCol >= 0 && neighborCol < gameState.cols) {
                    if (board[neighborRow][neighborCol].type === CELL_TYPE.MINE) {
                        count++;
                    }
                }
            }
            board[rowIndex][colIndex].neighborMines = count;
        }
    }
}

function openCell(rowIndex, colIndex) {
    if (gameState.status !== GAME_STATUS.PROCESS) return;
    
    const cell = board[rowIndex][colIndex];
    if (cell.state === CELL_STATE.OPENED || cell.state === CELL_STATE.FLAGGED) return;

    cell.state = CELL_STATE.OPENED;

    if (cell.type === CELL_TYPE.MINE) {
        gameState.status = GAME_STATUS.LOSE;
        cell.exploded = true;
        handleGameOver();
        return;
    }

    if (cell.neighborMines === 0) {
        for (const [rowOffset, colOffset] of NEIGHBOR_OFFSETS) {
            const neighborRow = rowIndex + rowOffset;
            const neighborCol = colIndex + colOffset;
            
            if (neighborRow >= 0 && neighborRow < gameState.rows && neighborCol >= 0 && neighborCol < gameState.cols) {
                if (board[neighborRow][neighborCol].state === CELL_STATE.CLOSED) {
                    openCell(neighborRow, neighborCol);
                }
            }
        }
    }

    checkWinCondition();
}

function toggleFlag(rowIndex, colIndex) {
    if (gameState.status !== GAME_STATUS.PROCESS) return;
    
    const cell = board[rowIndex][colIndex];
    if (cell.state === CELL_STATE.OPENED) return;

    if (cell.state === CELL_STATE.CLOSED) {
        if (gameState.flagsCount >= gameState.minesCount) return;
        
        cell.state = CELL_STATE.FLAGGED;
        gameState.flagsCount++;
    } else if (cell.state === CELL_STATE.FLAGGED) {
        cell.state = CELL_STATE.CLOSED;
        gameState.flagsCount--;
    }
    updateUI();
}

function startTimer() {
    if (gameState.timerId) clearInterval(gameState.timerId);
    gameState.gameTime = 0;
    updateUI();
    
    gameState.timerId = setInterval(() => {
        if (gameState.status === GAME_STATUS.PROCESS) {
            gameState.gameTime++;
            updateUI();
        } else {
            clearInterval(gameState.timerId);
        }
    }, TIMER_INTERVAL_MS);
}

function stopTimer() {
    if (gameState.timerId) {
        clearInterval(gameState.timerId);
        gameState.timerId = null;
    }
}

function renderBoard(focusedRow = null, focusedCol = null) {
    boardElement.innerHTML = '';
    let cellToFocus = null;

    for (let rowIndex = 0; rowIndex < gameState.rows; rowIndex++) {
        for (let colIndex = 0; colIndex < gameState.cols; colIndex++) {
            const cellData = board[rowIndex][colIndex];
            const cellButton = document.createElement('button');
            cellButton.className = 'cell';
            cellButton.type = 'button';
            
            const coordText = `рядок ${rowIndex + 1}, стовпець ${colIndex + 1}`;
            let ariaLabelText = `Закрита клітинка, ${coordText}`;

            if (cellData.state === CELL_STATE.OPENED) {
                cellButton.classList.add('open');
                
                if (cellData.type === CELL_TYPE.MINE) {
                    cellButton.classList.add('mine');
                    cellButton.textContent = '💣';
                    if (cellData.exploded) {
                        cellButton.classList.add('exploded');
                        ariaLabelText = `Міна, на яку натиснули, ${coordText}`;
                    } else {
                        ariaLabelText = `Клітинка з міною, ${coordText}`;
                    }
                } else if (cellData.neighborMines > 0) {
                    cellButton.classList.add(`number-${cellData.neighborMines}`);
                    cellButton.textContent = cellData.neighborMines;
                    ariaLabelText = `Відкрита клітинка, ${cellData.neighborMines}, ${coordText}`;
                } else {
                    ariaLabelText = `Порожня відкрита клітинка, ${coordText}`;
                }
            } 
            else if (cellData.state === CELL_STATE.FLAGGED) {
                cellButton.classList.add('flagged');
                ariaLabelText = `Клітинка з прапорцем, ${coordText}`;
                if (gameState.status === GAME_STATUS.LOSE && cellData.type === CELL_TYPE.MINE) {
                    cellButton.classList.add('mine');
                }
            } 
            else if (gameState.status === GAME_STATUS.LOSE && cellData.type === CELL_TYPE.MINE) {
                cellButton.classList.add('open', 'mine');
                cellButton.textContent = '💣';
                ariaLabelText = `Клітинка з міною, ${coordText}`;
            }

            cellButton.setAttribute('aria-label', ariaLabelText);

            cellButton.addEventListener('click', () => {
                if (gameState.status !== GAME_STATUS.PROCESS) return;
                
                if (gameState.gameTime === 0 && !gameState.timerId) startTimer();
                openCell(rowIndex, colIndex);

                renderBoard(rowIndex, colIndex);
                updateUI();
            });

            cellButton.addEventListener('contextmenu', (event) => {
                event.preventDefault();
                
                if (gameState.status !== GAME_STATUS.PROCESS) return;
                
                if (gameState.gameTime === 0 && !gameState.timerId) startTimer();
                toggleFlag(rowIndex, colIndex);
                renderBoard(rowIndex, colIndex);
            });

            boardElement.appendChild(cellButton);

            if (rowIndex === focusedRow && colIndex === focusedCol) {
                cellToFocus = cellButton;
            }
        }
    }
    
    if (cellToFocus) {
        cellToFocus.focus();
    }
}

function updateUI() {
    timerElement.textContent = String(gameState.gameTime).padStart(DISPLAY_DIGITS, '0');
    
    const leftMines = gameState.minesCount - gameState.flagsCount;
    const formattedMines = String(leftMines).padStart(DISPLAY_DIGITS, '0');
    
    if (minesCounterElement.textContent !== formattedMines) {
        minesCounterElement.textContent = formattedMines;
    }

    if (gameState.status === GAME_STATUS.WIN) {
        resetButton.textContent = '😎';
    } else if (gameState.status === GAME_STATUS.LOSE) {
        resetButton.textContent = '😵';
    } else {
        resetButton.textContent = '🙂';
    }
}

function checkWinCondition() {
    if (gameState.status !== GAME_STATUS.PROCESS) return;

    let closedSafeCells = 0;
    
    for (let rowIndex = 0; rowIndex < gameState.rows; rowIndex++) {
        for (let colIndex = 0; colIndex < gameState.cols; colIndex++) {
            const cell = board[rowIndex][colIndex];
            if (cell.type === CELL_TYPE.EMPTY && cell.state !== CELL_STATE.OPENED) {
                closedSafeCells++;
            }
        }
    }

    if (closedSafeCells === 0) {
        gameState.status = GAME_STATUS.WIN;
        handleGameOver();
    }
}

function handleGameOver() {
    stopTimer();
    updateUI();
    
    if (gameState.status === GAME_STATUS.WIN) {
        statusMessageElement.textContent = 'Вітаємо! Ви розмінували поле!';
    } else if (gameState.status === GAME_STATUS.LOSE) {
        statusMessageElement.textContent = 'Гру закінчено! Ви підірвались на міні.';
    }
}

function initGame() {
    gameState.status = GAME_STATUS.PROCESS;
    gameState.flagsCount = 0;
    gameState.gameTime = 0;
    stopTimer();
    
    if (statusMessageElement) {
        statusMessageElement.textContent = '';
    }
    
    generateField(gameState.rows, gameState.cols, gameState.minesCount);
    countNeighbourMines();
    
    updateUI();
    renderBoard();
}

resetButton.addEventListener('click', () => {
    initGame();
});

initGame();