const GAME_CONFIG = {
    rows: 10,
    cols: 10,
    minesCount: 15
};

let gameState = {
    rows: GAME_CONFIG.rows,
    cols: GAME_CONFIG.cols,
    minesCount: GAME_CONFIG.minesCount,
    status: 'process', // 'process', 'win', 'lose'
    gameTime: 0,
    timerId: null,
    flagsPlaced: 0,
    firstClick: true
};

let board = []; 


function generateField(rows, cols, minesCount) {
    board = [];
    
    for (let r = 0; r < rows; r++) {
        let row = [];
        for (let c = 0; c < cols; c++) {
            row.push({ 
                type: 'empty', 
                state: 'closed',
                neighborMines: 0,
                exploded: false
            });
        }
        board.push(row);
    }

    let placedMines = 0;
    while (placedMines < minesCount) {
        let r = Math.floor(Math.random() * rows);
        let c = Math.floor(Math.random() * cols);
        
        if (board[r][c].type !== 'mine') {
            board[r][c].type = 'mine';
            placedMines++;
        }
    }
    
    countNeighbourMines();
}


function countNeighbourMines() {
    const rows = board.length;
    const cols = board[0].length;

    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [ 0, -1],          [ 0, 1],
        [ 1, -1], [ 1, 0], [ 1, 1]
    ];

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c].type === 'mine') continue;
            
            let count = 0;
            for (let [dr, dc] of directions) {
                let nr = r + dr;
                let nc = c + dc;
                
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                    if (board[nr][nc].type === 'mine') {
                        count++;
                    }
                }
            }
            board[r][c].neighborMines = count;
        }
    }
}

function openCell(r, c) {
    if (gameState.status !== 'process') return;
    
    const cell = board[r][c];
    if (cell.state === 'opened' || cell.state === 'flagged') return;

    if (gameState.firstClick) {
        gameState.firstClick = false;
        startTimer();
    }

    cell.state = 'opened';

    if (cell.type === 'mine') {
        cell.exploded = true;
        endGame('lose');
        return;
    }

    if (cell.neighborMines === 0) {
        const rows = board.length;
        const cols = board[0].length;
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [ 0, -1],          [ 0, 1],
            [ 1, -1], [ 1, 0], [ 1, 1]
        ];
        
        for (let [dr, dc] of directions) {
            let nr = r + dr;
            let nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                openCell(nr, nc);
            }
        }
    }

    checkWin();
}


function toggleFlag(r, c) {
    if (gameState.status !== 'process') return;
    
    const cell = board[r][c];
    if (cell.state === 'opened') return;

    if (cell.state === 'closed') {
        cell.state = 'flagged';
        gameState.flagsPlaced++;
    } else if (cell.state === 'flagged') {
        cell.state = 'closed';
        gameState.flagsPlaced--;
    }
}

function startTimer() {
    gameState.timerId = setInterval(() => {
        gameState.gameTime++;
        updateDisplay();
    }, 1000);
}


const boardEl = document.querySelector('.game-board');
const statusMessageEl = document.querySelector('.status-message');

function renderBoard() {
    boardEl.innerHTML = ''; 
    const rows = board.length;
    const cols = board[0].length;
    
    boardEl.style.display = 'grid';
    boardEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
    boardEl.style.justifyContent = 'center';

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cellData = board[r][c];
            
            const cellEl = document.createElement('button');
            cellEl.setAttribute('type', 'button');
            cellEl.classList.add('cell');

            if (cellData.state === 'opened') {
                cellEl.classList.add('open');
                cellEl.disabled = true;
                
                if (cellData.type === 'mine') {
                    cellEl.classList.add('mine');
                    cellEl.textContent = '💣';
                    if (cellData.exploded) cellEl.classList.add('exploded');
                } else if (cellData.neighborMines > 0) {
                    cellEl.textContent = cellData.neighborMines;
                    cellEl.setAttribute('data-num', cellData.neighborMines);
                }
            } else if (cellData.state === 'flagged') {
                cellEl.classList.add('flag');
                cellEl.textContent = '🚩';
                
                if (gameState.status === 'lose' && cellData.type !== 'mine') {
                    cellEl.classList.add('wrong-flag');
                }
            }

            cellEl.addEventListener('click', () => {
                openCell(r, c);
                renderBoard();
                updateDisplay();
            });

            cellEl.addEventListener('contextmenu', (e) => {
                e.preventDefault(); 
                toggleFlag(r, c);
                renderBoard();
                updateDisplay();
            });

            boardEl.appendChild(cellEl);
        }
    }
}


const timerEl = document.querySelector('.timer');
const flagsEl = document.querySelector('.flags-count');
const startBtn = document.querySelector('.start-btn');

function updateDisplay() {
    const timeStr = String(Math.min(gameState.gameTime, 999)).padStart(3, '0');
    timerEl.textContent = `🕝${timeStr}`;

    const flagsLeft = gameState.minesCount - gameState.flagsPlaced;
    const flagsStr = String(flagsLeft).padStart(3, '0');
    flagsEl.textContent = `🚩${flagsStr}`;

    if (gameState.status === 'process') startBtn.textContent = '🙂';
    if (gameState.status === 'win') startBtn.textContent = '😎';
    if (gameState.status === 'lose') startBtn.textContent = '😵';
}

function endGame(result) {
    gameState.status = result;
    clearInterval(gameState.timerId);
    
    const rows = board.length;
    const cols = board[0].length;

    if (result === 'lose') {
        statusMessageEl.textContent = 'Гра закінчена: Ви підірвались на міні!';
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                let cell = board[r][c];
                if (cell.type === 'mine' && cell.state !== 'flagged') {
                    cell.state = 'opened';
                }
            }
        }
    } else if (result === 'win') {
        statusMessageEl.textContent = 'Вітаємо! Усі безпечні клітинки відкрито!';
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (board[r][c].type === 'mine') {
                    board[r][c].state = 'flagged';
                }
            }
        }
        gameState.flagsPlaced = gameState.minesCount;
    }
}

function checkWin() {
    let closedSafeCells = 0;
    const rows = board.length;
    const cols = board[0].length;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[r][c].type === 'empty' && board[r][c].state !== 'opened') {
                closedSafeCells++;
            }
        }
    }

    if (closedSafeCells === 0) endGame('win');
}

function initGame() {
    gameState.status = 'process';
    gameState.gameTime = 0;
    gameState.flagsPlaced = 0;
    gameState.firstClick = true;
    
    if (gameState.timerId) {
        clearInterval(gameState.timerId);
        gameState.timerId = null;
    }

    statusMessageEl.textContent = 'Почато нову гру. Хай щастить!';
    generateField(gameState.rows, gameState.cols, gameState.minesCount);
    renderBoard();
    updateDisplay();
}

startBtn.addEventListener('click', initGame);
initGame();