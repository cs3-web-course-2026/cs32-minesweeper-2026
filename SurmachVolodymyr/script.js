const GAME_STATUS = {
    PROCESS: 'process',
    WIN: 'win',
    LOSE: 'lose'
};

const CELL_STATE = {
    CLOSED: 'closed',
    OPENED: 'opened',
    FLAGGED: 'flagged'
};

const CELL_TYPE = {
    EMPTY: 'empty',
    MINE: 'mine'
};

const gameState = {
    rows: 10,
    cols: 10,
    minesCount: 15,
    status: GAME_STATUS.PROCESS,
    gameTime: 0,
    timerId: null,
    firstMove: true,
    openedSafeCells: 0,
    flagsPlaced: 0,
    explodedCell: null,
    flagMode: false,
    dom: {}
};

let board = [];

function forEachNeighbour(row, col, callback) {
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
        for (let colOffset = -1; colOffset <= 1; colOffset++) {
            if (rowOffset === 0 && colOffset === 0) continue;
            const neighborRow = row + rowOffset;
            const neighborCol = col + colOffset;
            if (
                neighborRow >= 0 &&
                neighborRow < gameState.rows &&
                neighborCol >= 0 &&
                neighborCol < gameState.cols
            ) {
                callback(neighborRow, neighborCol);
            }
        }
    }
}

function countNeighbourMines(grid) {
    const rowsCount = grid.length;
    const colsCount = grid[0].length;
    for (let row = 0; row < rowsCount; row++) {
        for (let col = 0; col < colsCount; col++) {
            if (grid[row][col].type === CELL_TYPE.MINE) {
                grid[row][col].neighborMines = 0;
                continue;
            }
            let count = 0;
            for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
                for (let colOffset = -1; colOffset <= 1; colOffset++) {
                    if (rowOffset === 0 && colOffset === 0) continue;
                    const neighborRow = row + rowOffset;
                    const neighborCol = col + colOffset;
                    if (
                        neighborRow >= 0 &&
                        neighborRow < rowsCount &&
                        neighborCol >= 0 &&
                        neighborCol < colsCount
                    ) {
                        if (grid[neighborRow][neighborCol].type === CELL_TYPE.MINE) {
                            count++;
                        }
                    }
                }
            }
            grid[row][col].neighborMines = count;
        }
    }
}

function generateField(rows, cols, minesCount) {
    const grid = [];
    for (let row = 0; row < rows; row++) {
        const currentRow = [];
        for (let col = 0; col < cols; col++) {
            currentRow.push({
                type: CELL_TYPE.EMPTY,
                state: CELL_STATE.CLOSED,
                neighborMines: 0,
                element: null
            });
        }
        grid.push(currentRow);
    }

    const candidates = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            candidates.push([row, col]);
        }
    }

    for (let index = candidates.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [candidates[index], candidates[randomIndex]] = [candidates[randomIndex], candidates[index]];
    }

    const count = Math.min(minesCount, candidates.length);
    for (let index = 0; index < count; index++) {
        const [mineRow, mineCol] = candidates[index];
        grid[mineRow][mineCol].type = CELL_TYPE.MINE;
    }

    countNeighbourMines(grid);
    return grid;
}

function ensureSafeFirstMove(clickRow, clickCol) {
    const minesToMove = [];
    const safeCandidates = [];

    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            const isNearClick = Math.abs(row - clickRow) <= 1 && Math.abs(col - clickCol) <= 1;
            if (isNearClick && board[row][col].type === CELL_TYPE.MINE) {
                minesToMove.push([row, col]);
            } else if (!isNearClick && board[row][col].type !== CELL_TYPE.MINE) {
                safeCandidates.push([row, col]);
            }
        }
    }

    if (minesToMove.length === 0) return;

    for (let index = safeCandidates.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [safeCandidates[index], safeCandidates[randomIndex]] = [safeCandidates[randomIndex], safeCandidates[index]];
    }

    for (let index = 0; index < minesToMove.length && index < safeCandidates.length; index++) {
        const [mineRow, mineCol] = minesToMove[index];
        const [safeRow, safeCol] = safeCandidates[index];
        board[mineRow][mineCol].type = CELL_TYPE.EMPTY;
        board[safeRow][safeCol].type = CELL_TYPE.MINE;
    }

    countNeighbourMines(board);
}

function openCell(row, col) {
    if (gameState.status !== GAME_STATUS.PROCESS) return;

    const cell = board[row][col];
    if (cell.state !== CELL_STATE.CLOSED) return;

    if (gameState.firstMove) {
        gameState.firstMove = false;
        ensureSafeFirstMove(row, col);
        startTimer();
    }

    if (cell.type === CELL_TYPE.MINE) {
        cell.state = CELL_STATE.OPENED;
        lose(row, col);
        return;
    }

    floodOpen(row, col);

    const totalSafeCells = gameState.rows * gameState.cols - gameState.minesCount;
    if (gameState.openedSafeCells === totalSafeCells) {
        win();
        return;
    }

    updateUI();
}

function floodOpen(row, col) {
    const cell = board[row][col];
    if (cell.state !== CELL_STATE.CLOSED) return;

    cell.state = CELL_STATE.OPENED;
    gameState.openedSafeCells++;

    if (cell.neighborMines === 0) {
        forEachNeighbour(row, col, (neighborRow, neighborCol) => floodOpen(neighborRow, neighborCol));
    }
}

function toggleFlag(row, col) {
    if (gameState.status !== GAME_STATUS.PROCESS) return;
    const cell = board[row][col];
    if (cell.state === CELL_STATE.OPENED) return;

    if (cell.state === CELL_STATE.FLAGGED) {
        cell.state = CELL_STATE.CLOSED;
        gameState.flagsPlaced--;
    } else {
        cell.state = CELL_STATE.FLAGGED;
        gameState.flagsPlaced++;
    }
    updateMineDisplay();
    renderCell(row, col);
}

function lose(row, col) {
    gameState.status = GAME_STATUS.LOSE;
    gameState.explodedCell = [row, col];
    stopTimer();
    revealMines();
    updateUI();
    announce('Game Over! You hit a mine.');
}

function win() {
    gameState.status = GAME_STATUS.WIN;
    stopTimer();
    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            const cell = board[row][col];
            if (cell.type === CELL_TYPE.MINE && cell.state !== CELL_STATE.FLAGGED) {
                cell.state = CELL_STATE.FLAGGED;
                gameState.flagsPlaced++;
            }
        }
    }
    updateUI();
    announce('Congratulations! You won!');
}

function revealMines() {
    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            const cell = board[row][col];
            if (cell.type === CELL_TYPE.MINE && cell.state === CELL_STATE.CLOSED) {
                cell.state = CELL_STATE.OPENED;
            }
        }
    }
}

function announce(message) {
    if (gameState.dom.statusMessage) {
        gameState.dom.statusMessage.textContent = message;
    }
}

function startTimer() {
    stopTimer();
    gameState.gameTime = 0;
    updateTimerDisplay();
    gameState.timerId = setInterval(() => {
        gameState.gameTime++;
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
}

function updateTimerDisplay() {
    if (!gameState.dom.timer) return;
    const minutes = Math.floor(gameState.gameTime / 60).toString().padStart(2, '0');
    const seconds = (gameState.gameTime % 60).toString().padStart(2, '0');
    gameState.dom.timer.innerHTML = `<span class="led-icon">⏰</span> ${minutes}:${seconds}`;
}

function updateMineDisplay() {
    if (!gameState.dom.mines) return;
    const remaining = Math.max(0, gameState.minesCount - gameState.flagsPlaced);
    gameState.dom.mines.innerHTML = `<span class="led-icon">💣</span> ${remaining.toString().padStart(3, '0')}`;
}

function renderCell(row, col) {
    const data = board[row][col];
    const element = data.element;
    if (!element) return;

    const classes = ['cell'];
    let flagIcon = false;
    let text = '';
    let accessibleState = CELL_STATE.CLOSED;

    if (data.state === CELL_STATE.FLAGGED) {
        if (gameState.status === GAME_STATUS.LOSE && data.type !== CELL_TYPE.MINE) {
            classes.push('open', 'wrong-flag');
            text = '❌';
            accessibleState = 'wrong flag';
        } else {
            classes.push('closed', 'flagged-mine');
            flagIcon = true;
            accessibleState = CELL_STATE.FLAGGED;
        }
    } else if (data.state === CELL_STATE.CLOSED) {
        classes.push('closed');
        accessibleState = CELL_STATE.CLOSED;
    } else {
        classes.push('open');
        if (data.type === CELL_TYPE.MINE) {
            classes.push('mine');
            text = '💣';
            const exploded = gameState.explodedCell;
            if (exploded && exploded[0] === row && exploded[1] === col) {
                classes.push('exploded-mine');
                accessibleState = 'exploded mine';
            } else {
                accessibleState = CELL_TYPE.MINE;
            }
        } else if (data.neighborMines > 0) {
            classes.push(`num-${data.neighborMines}`);
            text = String(data.neighborMines);
            accessibleState = `${data.neighborMines} neighboring mines`;
        } else {
            accessibleState = CELL_TYPE.EMPTY;
        }
    }

    element.className = classes.join(' ');
    element.textContent = text;
    element.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}, ${accessibleState}`);

    if (flagIcon) {
        const span = document.createElement('span');
        span.className = 'flag';
        span.textContent = '🚩';
        element.appendChild(span);
    }
}

function renderBoard() {
    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            renderCell(row, col);
        }
    }
}

function updateUI() {
    updateTimerDisplay();
    updateMineDisplay();
    renderBoard();
}

function buildGrid() {
    gameState.dom.grid.textContent = '';
    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            const element = document.createElement('button');
            element.type = 'button';
            element.className = 'cell closed';
            element.dataset.row = row;
            element.dataset.col = col;
            element.setAttribute('aria-label', `Row ${row + 1}, column ${col + 1}, closed`);
            gameState.dom.grid.appendChild(element);
            board[row][col].element = element;
        }
    }
}

function getCellPos(target) {
    const element = target instanceof Element ? target.closest('.cell') : null;
    if (!element || !gameState.dom.grid.contains(element)) return null;
    return { row: Number(element.dataset.row), col: Number(element.dataset.col) };
}

function setupGridEvents() {
    gameState.dom.grid.addEventListener('click', (event) => {
        const position = getCellPos(event.target);
        if (position) {
            if (gameState.flagMode) {
                toggleFlag(position.row, position.col);
            } else {
                openCell(position.row, position.col);
            }
        }
    });

    gameState.dom.grid.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        const position = getCellPos(event.target);
        if (position) toggleFlag(position.row, position.col);
    });

    gameState.dom.grid.addEventListener('keydown', (event) => {
        if ((event.key === 'f' || event.key === 'F') && !event.repeat) {
            event.preventDefault();
            const position = getCellPos(event.target);
            if (position) toggleFlag(position.row, position.col);
        }
    });

    if (gameState.dom.flagButton) {
        gameState.dom.flagButton.addEventListener('click', () => {
            gameState.flagMode = !gameState.flagMode;
            if (gameState.flagMode) {
                gameState.dom.flagButton.classList.add('active');
                gameState.dom.flagButton.setAttribute('aria-pressed', 'true');
            } else {
                gameState.dom.flagButton.classList.remove('active');
                gameState.dom.flagButton.setAttribute('aria-pressed', 'false');
            }
        });
    }
}

function cacheDom() {
    gameState.dom.grid = document.querySelector('.game-grid');
    gameState.dom.mines = document.querySelector('.top-panel .led-display:first-child');
    gameState.dom.timer = document.querySelector('.top-panel .led-display:last-child');
    gameState.dom.smiley = document.querySelector('.smiley-btn');
    gameState.dom.statusMessage = document.getElementById('status-message');

    const navItems = document.querySelectorAll('.nav-item');
    if (navItems.length > 0) gameState.dom.newGame = navItems[0];
    if (navItems.length > 1) gameState.dom.flagButton = navItems[1];
}

function initGame() {
    stopTimer();
    if (gameState.dom.statusMessage) gameState.dom.statusMessage.textContent = '';

    const maxMines = Math.max(0, gameState.rows * gameState.cols - 9);
    gameState.minesCount = Math.min(gameState.minesCount, maxMines);

    gameState.status = GAME_STATUS.PROCESS;
    gameState.gameTime = 0;
    gameState.firstMove = true;
    gameState.openedSafeCells = 0;
    gameState.flagsPlaced = 0;
    gameState.explodedCell = null;
    gameState.flagMode = false;

    if (gameState.dom.flagButton) {
        gameState.dom.flagButton.classList.remove('active');
        gameState.dom.flagButton.setAttribute('aria-pressed', 'false');
    }

    board = generateField(gameState.rows, gameState.cols, gameState.minesCount);
    buildGrid();
    updateUI();
}

document.addEventListener('DOMContentLoaded', () => {
    cacheDom();
    if (!gameState.dom.grid) return;

    setupGridEvents();
    if (gameState.dom.smiley) gameState.dom.smiley.addEventListener('click', initGame);
    if (gameState.dom.newGame) gameState.dom.newGame.addEventListener('click', initGame);

    initGame();
});