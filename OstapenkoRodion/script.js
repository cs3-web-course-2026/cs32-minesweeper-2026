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

let field = [];


function generateField(rows, cols, minesCount) {
    field = [];
    
    for (let r = 0; r < rows; r++) {
        let row = [];
        for (let c = 0; c < cols; c++) {
            row.push({ 
                type: 'empty', 
                state: 'closed', // 'closed', 'opened', 'flagged'
                neighborMines: 0,
                exploded: false
            });
        }
        field.push(row);
    }

    let placedMines = 0;
    while (placedMines < minesCount) {
        let r = Math.floor(Math.random() * rows);
        let c = Math.floor(Math.random() * cols);
        
        if (field[r][c].type !== 'mine') {
            field[r][c].type = 'mine';
            placedMines++;
        }
    }
    
    countNeighbourMines();
}


function countNeighbourMines() {
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [ 0, -1],          [ 0, 1],
        [ 1, -1], [ 1, 0], [ 1, 1]
    ];

    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            if (field[r][c].type === 'mine') continue;
            
            let count = 0;
            for (let [dr, dc] of directions) {
                let nr = r + dr;
                let nc = c + dc;
                
                if (nr >= 0 && nr < gameState.rows && nc >= 0 && nc < gameState.cols) {
                    if (field[nr][nc].type === 'mine') {
                        count++;
                    }
                }
            }
            field[r][c].neighborMines = count;
        }
    }
}

function openCell(r, c) {
    if (gameState.status !== 'process') return;
    
    const cell = field[r][c];
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
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [ 0, -1],          [ 0, 1],
            [ 1, -1], [ 1, 0], [ 1, 1]
        ];
        
        for (let [dr, dc] of directions) {
            let nr = r + dr;
            let nc = c + dc;
            if (nr >= 0 && nr < gameState.rows && nc >= 0 && nc < gameState.cols) {
                openCell(nr, nc); // Рекурсивний виклик
            }
        }
    }

    checkWin();
}


function toggleFlag(r, c) {
    if (gameState.status !== 'process') return;
    
    const cell = field[r][c];
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

function renderBoard() {
    boardEl.innerHTML = '';
    
    boardEl.style.display = 'grid';
    boardEl.style.gridTemplateColumns = `repeat(${gameState.cols}, 40px)`;
    boardEl.style.justifyContent = 'center';

    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const cellData = field[r][c];
            const cellEl = document.createElement('div');
            cellEl.classList.add('cell');

            if (cellData.state === 'opened') {
                cellEl.classList.add('open');
                
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

    if (result === 'lose') {
        for (let r = 0; r < gameState.rows; r++) {
            for (let c = 0; c < gameState.cols; c++) {
                let cell = field[r][c];
                if (cell.type === 'mine' && cell.state !== 'flagged') {
                    cell.state = 'opened';
                }
            }
        }
    } else if (result === 'win') {
        for (let r = 0; r < gameState.rows; r++) {
            for (let c = 0; c < gameState.cols; c++) {
                if (field[r][c].type === 'mine') {
                    field[r][c].state = 'flagged';
                }
            }
        }
        gameState.flagsPlaced = gameState.minesCount;
    }
}

function checkWin() {
    let closedSafeCells = 0;

    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            if (field[r][c].type === 'empty' && field[r][c].state !== 'opened') {
                closedSafeCells++;
            }
        }
    }

    if (closedSafeCells === 0) {
        endGame('win');
    }
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

    generateField(gameState.rows, gameState.cols, gameState.minesCount);
    renderBoard();
    updateDisplay();
}

startBtn.addEventListener('click', initGame);

initGame();