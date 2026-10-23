const gameState = {
    rows: 10,
    cols: 10,
    minesCount: 15,
    status: 'playing', // 'playing' | 'win' | 'lose'
    gameTime: 0,
    timerId: null,
    firstMove: true,
    openedSafeCells: 0,
    flagsPlaced: 0,
    explodedCell: null, // [r, c] of the mine the player hit
};

let field = [];   // field[r][c] = { type, state, neighborMines }
let cellEls = []; // cellEls[r][c] = the matching DOM element
const dom = {};

const LONG_PRESS_MS = 400;
let longPressTimer = null;
let longPressFired = false;
let lastPointerType = 'mouse';


function createEmptyField(rows, cols) {
    const grid = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            row.push({ type: 'empty', state: 'closed', neighborMines: 0 });
        }
        grid.push(row);
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

// Places mines only after the first click, so the clicked cell and its
// neighbours are always safe and any flags set earlier are kept.
function placeMines(grid, minesCount, excludeR, excludeC) {
    const candidates = [];
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            if (Math.abs(r - excludeR) <= 1 && Math.abs(c - excludeC) <= 1) continue;
            candidates.push([r, c]);
        }
    }

    // Fisher-Yates shuffle: always terminates, unlike random retry loops
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const count = Math.min(minesCount, candidates.length);
    for (let i = 0; i < count; i++) {
        const [r, c] = candidates[i];
        grid[r][c].type = 'mine';
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
    if (gameState.status !== 'playing') return;

    const cell = field[r][c];
    if (cell.state !== 'closed') return; // already opened or flagged

    if (gameState.firstMove) {
        gameState.firstMove = false;
        placeMines(field, gameState.minesCount, r, c);
        countNeighbourMines(field);
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

// Iterative flood fill: no recursion limit, and no UI work until it finishes.
function floodOpen(startR, startC) {
    const stack = [[startR, startC]];
    while (stack.length) {
        const [r, c] = stack.pop();
        const cell = field[r][c];
        if (cell.state !== 'closed') continue; // skips opened and flagged cells

        cell.state = 'opened';
        gameState.openedSafeCells++;

        if (cell.neighborMines === 0) {
            forEachNeighbour(r, c, (nr, nc) => stack.push([nr, nc]));
        }
    }
}

function toggleFlag(r, c) {
    if (gameState.status !== 'playing') return;
    const cell = field[r][c];
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
    // Flag every remaining mine
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const cell = field[r][c];
            if (cell.type === 'mine' && cell.state !== 'flagged') {
                cell.state = 'flagged';
                gameState.flagsPlaced++;
            }
        }
    }
    updateUI();
    announce('Congratulations! You won!');
}

// Open unflagged mines. Correct flags stay as flags; wrong flags are
// marked in renderCell.
function revealMines() {
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const cell = field[r][c];
            if (cell.type === 'mine' && cell.state === 'closed') {
                cell.state = 'opened';
            }
        }
    }
}

// alert() blocks painting, so wait until the browser has drawn the board.
function announce(message) {
    requestAnimationFrame(() => setTimeout(() => alert(message), 0));
}


function startTimer() {
    stopTimer();
    gameState.gameTime = 0;
    updateTimerDisplay();
    gameState.timerId = setInterval(() => {
        gameState.gameTime++;
        updateTimerDisplay(); // only touches the timer, never the grid
    }, 1000);
}

function stopTimer() {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
}

function updateTimerDisplay() {
    if (!dom.timer) return;
    const mins = Math.floor(gameState.gameTime / 60).toString().padStart(2, '0');
    const secs = (gameState.gameTime % 60).toString().padStart(2, '0');
    dom.timer.innerHTML = `<span class="led-icon">⏰</span> ${mins}:${secs}`;
}

function updateMineDisplay() {
    if (!dom.mines) return;
    // Clamped at 0. Remove Math.max to show negatives when over-flagging.
    const remaining = Math.max(0, gameState.minesCount - gameState.flagsPlaced);
    dom.mines.innerHTML = `<span class="led-icon">💣</span> ${remaining.toString().padStart(3, '0')}`;
}

// Cells are created once (buildGrid) and updated in place afterwards, so
// elements never disappear between mousedown and mouseup.
function renderCell(r, c) {
    const data = field[r][c];
    const el = cellEls[r][c];
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
            if (ex && ex[0] === r && ex[1] === c) classes.push('exploded');
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
    dom.grid.textContent = '';
    cellEls = [];
    for (let r = 0; r < gameState.rows; r++) {
        const rowEls = [];
        for (let c = 0; c < gameState.cols; c++) {
            const el = document.createElement('div');
            el.className = 'cell closed';
            el.dataset.r = r;
            el.dataset.c = c;
            dom.grid.appendChild(el);
            rowEls.push(el);
        }
        cellEls.push(rowEls);
    }
}

function getCellPos(target) {
    const el = target instanceof Element ? target.closest('.cell') : null;
    if (!el || !dom.grid.contains(el)) return null;
    return { r: Number(el.dataset.r), c: Number(el.dataset.c) };
}

function clearLongPress() {
    clearTimeout(longPressTimer);
    longPressTimer = null;
}

function setupGridEvents() {
    dom.grid.addEventListener('click', (e) => {
        if (longPressFired) return; // this tap was a long-press flag
        const pos = getCellPos(e.target);
        if (pos) openCell(pos.r, pos.c);
    });

    dom.grid.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // On touch devices the long-press timer already handled the flag
        if (lastPointerType === 'touch') return;
        const pos = getCellPos(e.target);
        if (pos) toggleFlag(pos.r, pos.c);
    });

    
    dom.grid.addEventListener('pointerup', clearLongPress);
    dom.grid.addEventListener('pointercancel', clearLongPress);

    dom.grid.style.touchAction = 'manipulation';
    dom.grid.style.userSelect = 'none';
    dom.grid.style.webkitUserSelect = 'none';
    dom.grid.style.webkitTouchCallout = 'none';
}

function cacheDom() {
    dom.grid = document.querySelector('.game-grid');
    dom.mines = document.querySelector('.top-panel .led-display:first-child');
    dom.timer = document.querySelector('.top-panel .led-display:last-child');
    dom.smiley = document.querySelector('.smiley-btn');
    dom.newGame = document.querySelector('.nav-item:first-child');
}

function initGame() {
    stopTimer();
    clearLongPress();

    // Keep room for the 3x3 safe zone around the first click
    const maxMines = Math.max(0, gameState.rows * gameState.cols - 9);
    gameState.minesCount = Math.min(gameState.minesCount, maxMines);

    gameState.status = 'playing';
    gameState.gameTime = 0;
    gameState.firstMove = true;
    gameState.openedSafeCells = 0;
    gameState.flagsPlaced = 0;
    gameState.explodedCell = null;

    field = createEmptyField(gameState.rows, gameState.cols);
    buildGrid();
    updateUI();
}

document.addEventListener('DOMContentLoaded', () => {
    cacheDom();
    if (!dom.grid) return;

    setupGridEvents();
    if (dom.smiley) dom.smiley.addEventListener('click', initGame);
    if (dom.newGame) dom.newGame.addEventListener('click', initGame);

    initGame();
});
