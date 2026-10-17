const gameState = {
    rows: 9,
    cols: 9,
    minesCount: 10,
    status: 'process',
    gameTime: 0,
    timerId: null,
    flagsCount: 0
};

let field = [];

const boardElement = document.querySelector('.game-board');
const minesCounterElement = document.querySelector('.mines-counter');
const timerElement = document.querySelector('.timer');
const resetBtn = document.querySelector('.reset-btn');

function generateField(rows, cols, minesCount) {
    field = [];
    
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            row.push({
                type: 'empty',
                neighborMines: 0,
                state: 'closed'
            });
        }
        field.push(row);
    }

    let placedMines = 0;
    while (placedMines < minesCount) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);
        
        if (field[r][c].type !== 'mine') {
            field[r][c].type = 'mine';
            placedMines++;
        }
    }
}

function countNeighbourMines() {
    const directions = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];

    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            if (field[r][c].type === 'mine') continue;

            let count = 0;
            for (let [dr, dc] of directions) {
                const nr = r + dr;
                const nc = c + dc;
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

function openCell(row, col) {
    if (gameState.status !== 'process') return;
    
    const cell = field[row][col];
    if (cell.state === 'opened' || cell.state === 'flagged') return;

    cell.state = 'opened';

    if (cell.type === 'mine') {
        gameState.status = 'lose';
        cell.exploded = true;
        handleGameOver();
        return;
    }

    if (cell.neighborMines === 0) {
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        
        for (let [dr, dc] of directions) {
            const nr = row + dr;
            const nc = col + dc;
            if (nr >= 0 && nr < gameState.rows && nc >= 0 && nc < gameState.cols) {
                if (field[nr][nc].state === 'closed') {
                    openCell(nr, nc);
                }
            }
        }
    }

    checkWinCondition();
}

function toggleFlag(row, col) {
    if (gameState.status !== 'process') return;
    
    const cell = field[row][col];
    if (cell.state === 'opened') return;

    if (cell.state === 'closed') {
        cell.state = 'flagged';
        gameState.flagsCount++;
    } else if (cell.state === 'flagged') {
        cell.state = 'closed';
        gameState.flagsCount--;
    }
    updateUI();
}

function startTimer() {
    if (gameState.timerId) clearInterval(gameState.timerId);
    gameState.gameTime = 0;
    updateUI();
    
    gameState.timerId = setInterval(() => {
        if (gameState.status === 'process') {
            gameState.gameTime++;
            updateUI();
        } else {
            clearInterval(gameState.timerId);
        }
    }, 1000);
}

function stopTimer() {
    if (gameState.timerId) {
        clearInterval(gameState.timerId);
        gameState.timerId = null;
    }
}

function renderBoard() {
    boardElement.innerHTML = '';

    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const cellData = field[r][c];
            const btn = document.createElement('button');
            btn.className = 'cell';
            btn.type = 'button';

            if (cellData.state === 'opened') {
                btn.classList.add('open');
                
                if (cellData.type === 'mine') {
                    btn.classList.add('mine');
                    btn.textContent = '💣';
                    if (cellData.exploded) btn.classList.add('exploded');
                } else if (cellData.neighborMines > 0) {
                    btn.classList.add(`number-${cellData.neighborMines}`);
                    btn.textContent = cellData.neighborMines;
                }
            } 
            else if (cellData.state === 'flagged') {
                btn.classList.add('flagged');
                if (gameState.status === 'lose' && cellData.type === 'mine') {
                    btn.classList.add('mine');
                }
            } 
            else if (gameState.status === 'lose' && cellData.type === 'mine') {
                btn.classList.add('open', 'mine');
                btn.textContent = '💣';
            }

            btn.addEventListener('click', () => {
                if (gameState.gameTime === 0 && !gameState.timerId) startTimer();
                openCell(r, c);
                renderBoard();
                updateUI();
            });

            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (gameState.gameTime === 0 && !gameState.timerId) startTimer();
                toggleFlag(r, c);
                renderBoard();
            });

            boardElement.appendChild(btn);
        }
    }
}

function updateUI() {
    timerElement.textContent = String(gameState.gameTime).padStart(3, '0');
    
    const leftMines = gameState.minesCount - gameState.flagsCount;
    minesCounterElement.textContent = String(leftMines >= 0 ? leftMines : 0).padStart(3, '0');

    if (gameState.status === 'win') {
        resetBtn.textContent = '😎';
    } else if (gameState.status === 'lose') {
        resetBtn.textContent = '😵';
    } else {
        resetBtn.textContent = '🙂';
    }
}

function checkWinCondition() {
    let closedSafeCells = 0;
    
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const cell = field[r][c];
            if (cell.type === 'empty' && cell.state !== 'opened') {
                closedSafeCells++;
            }
        }
    }

    if (closedSafeCells === 0) {
        gameState.status = 'win';
        handleGameOver();
    }
}

function handleGameOver() {
    stopTimer();
    updateUI();
    
    setTimeout(() => {
        if (gameState.status === 'win') {
            alert('Вітаємо! Ви розмінували поле!');
        } else if (gameState.status === 'lose') {
            alert('Гру закінчено! Ви підірвались на міні.');
        }
    }, 100);
}

function initGame() {
    gameState.status = 'process';
    gameState.flagsCount = 0;
    gameState.gameTime = 0;
    stopTimer();
    
    generateField(gameState.rows, gameState.cols, gameState.minesCount);
    countNeighbourMines();
    
    updateUI();
    renderBoard();
}

resetBtn.addEventListener('click', () => {
    initGame();
});

initGame();