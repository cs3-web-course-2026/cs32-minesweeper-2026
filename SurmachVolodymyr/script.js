const gameState = {
    rows: 10,
    cols: 10,
    minesCount: 15,
    status: 'process', // 'process' | 'win' | 'lose'
    gameTime: 0,
    timerId: null,
    firstMove: true,
    openedSafeCells: 0,
    flagsPlaced: 0,
    explodedCell: null,
    dom: {}
};

let board = [];

function generateField(rows, cols, minesCount) {
    const grid = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            row.push({ type: 'empty', state: 'closed', neighborMines: 0, el: null });
        }
        grid.push(row);
    }

    const candidates = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            candidates.push([r, c]);
        }
    
    
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const count = Math.min(minesCount, candidates.length);
    for (let i = 0; i < count; i++) {
        const [r, c] = candidates[i];
        grid[r][c].type = 'mine';
    }

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c].type === 'mine') continue;
            let neighborCount = 0;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                        if (grid[nr][nc].type === 'mine') neighborCount++;
                    }
                }
            }
            grid[r][c].neighborMines = neighborCount;
        }
    }

    return grid;
}

function forEachNeighbour(r, c, fn) {
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < gameState.rows && nc >= 0 && nc < gameState.cols) {
                fn(nr, nc);
            }
        }
    }
}

function countNeighbourMines(grid) {
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            if (grid[r][c].type === 'mine') continue;
            let count = 0;
            forEachNeighbour(r, c, (nr, nc) => {
                if (grid[nr][nc].type === 'mine') count++;
            });
            grid[r][c].neighborMines = count;
        }
    }
}

function openCell(r, c) {
    if (gameState.status !== 'process') return;

    const cell = board[r][c];
    if (cell.state !== 'closed') return;

    if (gameState.firstMove) {
        gameState.firstMove = false;
        startTimer();
    }

    if (cell.type === 'mine') {
        cell.state = 'opened';
        lose(r, c);
        return;
    }

    floodOpen(r, c);

    const totalSafeCells = gameState.rows * gameState.cols - gameState.minesCount;
    if (gameState.openedSafeCells === totalSafeCells) {
        win();
        return;
    }

    updateUI();
}

function floodOpen(r, c) {
    const cell = board[r][c];
    if (cell.state !== 'closed') return;

    cell.state = 'opened';
    gameState.openedSafeCells++;

    if (cell.neighborMines === 0) {
        forEachNeighbour(r, c, (nr, nc) => floodOpen(nr, nc));
    }
}

function toggleFlag(r, c) {
    if (gameState.status !== 'process') return;
    const cell = board[r][c];
    if (cell.state === 'opened') return;

    if (cell.state === 'flagged') {
        cell.state = 'closed';
        gameState.flagsPlaced--;
    } else {
        cell.state = 'flagged';
        gameState.flagsPlaced++;
    }
    updateMineDisplay();
    renderCell(r, c);
}

function lose(r, c) {
    gameState.status = 'lose';
    gameState.explodedCell = [r, c];
    stopTimer();
    revealMines();
    updateUI();
    announce('Game Over! You hit a mine.');
}

function win() {
    gameState.status = 'win';
    stopTimer();
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const cell = board[r][c];
            if (cell.type === 'mine' && cell.state !== 'flagged') {
                cell.state = 'flagged';
                gameState.flagsPlaced++;
            }
        }
    }
    updateUI();
    announce('Congratulations! You won!');
}

function revealMines() {
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const cell = board[r][c];
            if (cell.type === 'mine' && cell.state === 'closed') {
                cell.state = 'opened';
            }
        }
    }
}

function announce(message) {
    if (gameState.dom.statusMsg) {
        gameState.dom.statusMsg.textContent = message;
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
    const mins = Math.floor(gameState.gameTime / 60).toString().padStart(2, '0');
    const secs = (gameState.gameTime % 60).toString().padStart(2, '0');
    gameState.dom.timer.innerHTML = `<span class="led-icon">⏰</span> ${mins}:${secs}`;
}

function updateMineDisplay() {
    if (!gameState.dom.mines) return;
    const remaining = Math.max(0, gameState.minesCount - gameState.flagsPlaced);
    gameState.dom.mines.innerHTML = `<span class="led-icon">💣</span> ${remaining.toString().padStart(3, '0')}`;
}

function renderCell(r, c) {
    const data = board[r][c];
    const el = data.el;
    if (!el) return;

    const classes = ['cell'];
    let flagIcon = false;
    let text = '';

    if (data.state === 'flagged') {
        if (gameState.status === 'lose' && data.type !== 'mine') {
            classes.push('open', 'wrong-flag');
            text = '❌';
        } else {
            classes.push('closed', 'flagged-mine');
            flagIcon = true;
        }
    } else if (data.state === 'closed') {
        classes.push('closed');
    } else {
        classes.push('open');
        if (data.type === 'mine') {
            classes.push('mine');
            text = '💣';
            const ex = gameState.explodedCell;
            if (ex && ex[0] === r && ex[1] === c) {
                classes.push('exploded-mine');
            }
        } else if (data.neighborMines > 0) {
            classes.push(`num-${data.neighborMines}`);
            text = String(data.neighborMines);
        }
    }

    el.className = classes.join(' ');
    el.textContent = text;
    if (flagIcon) {
        const span = document.createElement('span');
        span.className = 'flag';
        span.textContent = '🚩';
        el.appendChild(span);
    }
}

function renderBoard() {
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            renderCell(r, c);
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
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const el = document.createElement('button');
            el.type = 'button';
            el.className = 'cell closed';
            el.dataset.r = r;
            el.dataset.c = c;
            gameState.dom.grid.appendChild(el);
            board[r][c].el = el;
        }
    }
}

function getCellPos(target) {
    const el = target instanceof Element ? target.closest('.cell') : null;
    if (!el || !gameState.dom.grid.contains(el)) return null;
    return { r: Number(el.dataset.r), c: Number(el.dataset.c) };
}

function setupGridEvents() {
    gameState.dom.grid.addEventListener('click', (e) => {
        const pos = getCellPos(e.target);
        if (pos) openCell(pos.r, pos.c);
    });

    gameState.dom.grid.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const pos = getCellPos(e.target);
        if (pos) toggleFlag(pos.r, pos.c);
    });

    gameState.dom.grid.addEventListener('keydown', (e) => {
        if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            const pos = getCellPos(e.target);
            if (pos) toggleFlag(pos.r, pos.c);
        }
    });
}

function cacheDom() {
    gameState.dom.grid = document.querySelector('.game-grid');
    gameState.dom.mines = document.querySelector('.top-panel .led-display:first-child');
    gameState.dom.timer = document.querySelector('.top-panel .led-display:last-child');
    gameState.dom.smiley = document.querySelector('.smiley-btn');
    gameState.dom.statusMsg = document.getElementById('status-message');

    const navItems = document.querySelectorAll('.nav-item');
    if (navItems.length > 0) gameState.dom.newGame = navItems[0];
}

function initGame() {
    stopTimer();
    if (gameState.dom.statusMsg) gameState.dom.statusMsg.textContent = '';

    const maxMines = Math.max(0, gameState.rows * gameState.cols - 9);
    gameState.minesCount = Math.min(gameState.minesCount, maxMines);

    gameState.status = 'process';
    gameState.gameTime = 0;
    gameState.firstMove = true;
    gameState.openedSafeCells = 0;
    gameState.flagsPlaced = 0;
    gameState.explodedCell = null;

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