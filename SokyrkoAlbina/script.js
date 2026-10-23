const config = { rows: 8, cols: 8, minesCount: 10 };

const MAX_TIME = 999;
const MODAL_DELAY_MS = 300;

const STATUS = { PROCESS: 'process', WIN: 'win', LOSE: 'lose' };
const CELL_STATE = { CLOSED: 'closed', OPENED: 'opened', FLAGGED: 'flagged', EXPLODED: 'exploded' };

const ICONS = { MINE: '💣', FLAG: '🏴‍☠️' };
const START_BTN_ICONS = {
    [STATUS.PROCESS]: '🧭',
    [STATUS.WIN]: '😎',
    [STATUS.LOSE]: '😵'
};

const DIRECTIONS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const boardEl = document.querySelector('.game-board');
const timerEl = document.getElementById('timer');
const flagsCountEl = document.getElementById('flags-count');
const startBtnEl = document.getElementById('start-btn');
const modalEl = document.getElementById('game-modal');
const modalTitleEl = document.getElementById('modal-title');
const modalTextEl = document.getElementById('modal-text');
const modalBtnEl = document.getElementById('modal-btn');

let gameState = createInitialState();
let board = [];
let modalTimeoutId = null;

function createInitialState() {
    return {
        ...config,
        status: STATUS.PROCESS,
        gameTime: 0,
        timerId: null,
        flagsCount: 0,
        isFirstClick: true
    };
}

function createCell() {
    return { isMine: false, state: CELL_STATE.CLOSED, neighbourMines: 0 };
}

function isInside(r, c) {
    return r >= 0 && r < gameState.rows && c >= 0 && c < gameState.cols;
}

function forEachNeighbour(r, c, callback) {
    DIRECTIONS.forEach(([dr, dc]) => {
        const nr = r + dr;
        const nc = c + dc;
        if (isInside(nr, nc)) callback(nr, nc);
    });
}

function generateEmptyField(rows, cols) {
    board = Array.from({ length: rows }, () => Array.from({ length: cols }, createCell));
}

function placeMinesAndCount(excludeR, excludeC) {
    let minesPlaced = 0;
    while (minesPlaced < gameState.minesCount) {
        const r = Math.floor(Math.random() * gameState.rows);
        const c = Math.floor(Math.random() * gameState.cols);

        if (r === excludeR && c === excludeC) continue;

        if (!board[r][c].isMine) {
            board[r][c].isMine = true;
            minesPlaced++;
        }
    }
    countNeighbourMines();
}

function countNeighbourMines() {
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            if (board[r][c].isMine) continue;

            let count = 0;
            forEachNeighbour(r, c, (nr, nc) => {
                if (board[nr][nc].isMine) count++;
            });
            board[r][c].neighbourMines = count;
        }
    }
}

function revealCell(r, c) {
    if (!isInside(r, c)) return;

    const cell = board[r][c];
    if (cell.state !== CELL_STATE.CLOSED) return;

    cell.state = CELL_STATE.OPENED;

    if (cell.neighbourMines === 0) {
        forEachNeighbour(r, c, revealCell);
    }
}

function isWin() {
    const totalSafeCells = gameState.rows * gameState.cols - gameState.minesCount;
    const openedCells = board.flat().filter((cell) => cell.state === CELL_STATE.OPENED).length;
    return openedCells === totalSafeCells;
}

function openCell(r, c) {
    if (gameState.status !== STATUS.PROCESS || !isInside(r, c)) return;

    const cell = board[r][c];
    if (cell.state !== CELL_STATE.CLOSED) return;

    if (gameState.isFirstClick) {
        gameState.isFirstClick = false;
        placeMinesAndCount(r, c);
    }

    startTimerOnce();

    if (cell.isMine) {
        cell.state = CELL_STATE.EXPLODED;
        endGame(STATUS.LOSE);
        return;
    }

    revealCell(r, c);

    if (isWin()) {
        endGame(STATUS.WIN);
    } else {
        renderBoard();
    }
}

function toggleFlag(r, c) {
    if (gameState.status !== STATUS.PROCESS || !isInside(r, c)) return;

    const cell = board[r][c];

    if (cell.state === CELL_STATE.CLOSED) {
        if (gameState.flagsCount >= gameState.minesCount) return;
        cell.state = CELL_STATE.FLAGGED;
        gameState.flagsCount++;
    } else if (cell.state === CELL_STATE.FLAGGED) {
        cell.state = CELL_STATE.CLOSED;
        gameState.flagsCount--;
    } else {
        return;
    }

    render();
}

function endGame(status) {
    gameState.status = status;
    stopTimer();
    render();
    showModal(status);
}

function startTimer() {
    gameState.timerId = setInterval(() => {
        gameState.gameTime = Math.min(gameState.gameTime + 1, MAX_TIME);
        updateUI();
    }, 1000);
}

function startTimerOnce() {
    if (!gameState.timerId) startTimer();
}

function stopTimer() {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
}

function pluralizeMines(count) {
    const lastTwo = count % 100;
    const last = count % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return 'мін';
    if (last === 1) return 'міна';
    if (last >= 2 && last <= 4) return 'міни';
    return 'мін';
}

function getCellView(cell, r, c) {
    const position = `рядок ${r + 1}, стовпець ${c + 1}`;
    const view = { classes: [], text: '', number: null, label: `Закрита клітинка, ${position}` };
    const gameOver = gameState.status !== STATUS.PROCESS;

    switch (cell.state) {
        case CELL_STATE.EXPLODED:
            view.classes.push('open', 'mine', 'exploded');
            view.text = ICONS.MINE;
            view.label = `Вибухнула міна, ${position}`;
            break;

        case CELL_STATE.OPENED:
            view.classes.push('open');
            if (cell.neighbourMines > 0) {
                view.text = String(cell.neighbourMines);
                view.number = cell.neighbourMines;
                view.label = `${cell.neighbourMines} ${pluralizeMines(cell.neighbourMines)} поруч, ${position}`;
            } else {
                view.label = `Порожня відкрита клітинка, ${position}`;
            }
            break;

        case CELL_STATE.FLAGGED:
            view.classes.push('flagged');
            view.text = ICONS.FLAG;
            view.label = `Клітинка з прапорцем, ${position}`;
            if (gameState.status === STATUS.LOSE && !cell.isMine) {
                view.classes.push('false-flag');
                view.label = `Хибний прапорець, ${position}`;
            }
            break;

        default:
            if (gameOver && cell.isMine) {
                if (gameState.status === STATUS.WIN) {
                    view.classes.push('flagged');
                    view.text = ICONS.FLAG;
                    view.label = `Клітинка з прапорцем, ${position}`;
                } else {
                    view.classes.push('open', 'mine');
                    view.text = ICONS.MINE;
                    view.label = `Міна, ${position}`;
                }
            }
    }

    return view;
}

function createCellElement(r, c) {
    const view = getCellView(board[r][c], r, c);
    const btn = document.createElement('button');

    btn.type = 'button';
    btn.className = ['cell', ...view.classes].join(' ');
    btn.textContent = view.text;
    btn.dataset.row = r;
    btn.dataset.col = c;
    btn.setAttribute('aria-label', view.label);
    if (view.number !== null) btn.dataset.number = view.number;

    return btn;
}

function renderBoard() {
    const { row, col } = document.activeElement?.dataset ?? {};

    boardEl.style.setProperty('--board-width', gameState.cols);

    const fragment = document.createDocumentFragment();
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            fragment.appendChild(createCellElement(r, c));
        }
    }
    boardEl.replaceChildren(fragment);

    if (row !== undefined && col !== undefined) {
        boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`)?.focus();
    }
}

function updateUI() {
    const flagsLeft = gameState.minesCount - gameState.flagsCount;

    timerEl.textContent = String(gameState.gameTime).padStart(3, '0');
    flagsCountEl.textContent = String(flagsLeft).padStart(3, '0');
    startBtnEl.textContent = START_BTN_ICONS[gameState.status];
}

function render() {
    updateUI();
    renderBoard();
}

function showModal(status) {
    const isWinner = status === STATUS.WIN;

    modalTitleEl.textContent = isWinner ? 'Перемога! 🎉' : 'Поразка! 💥';
    modalTextEl.textContent = isWinner ? 'Всі безпечні клітинки відкриті.' : 'Ви натрапили на міну.';

    modalTimeoutId = setTimeout(() => {
        modalEl.classList.remove('hidden');
        modalBtnEl.focus();
    }, MODAL_DELAY_MS);
}

function hideModal() {
    clearTimeout(modalTimeoutId);
    modalEl.classList.add('hidden');
}

function initGame() {
    hideModal();
    stopTimer();
    gameState = createInitialState();
    generateEmptyField(gameState.rows, gameState.cols);
    render();
}

function getCellCoords(event) {
    const cellEl = event.target.closest('.cell');
    if (!cellEl) return null;
    return { r: Number(cellEl.dataset.row), c: Number(cellEl.dataset.col) };
}

function bindEvents() {
    boardEl.addEventListener('click', (event) => {
        const coords = getCellCoords(event);
        if (coords) openCell(coords.r, coords.c);
    });

    boardEl.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        const coords = getCellCoords(event);
        if (coords) toggleFlag(coords.r, coords.c);
    });

    startBtnEl.addEventListener('click', initGame);
    modalBtnEl.addEventListener('click', hideModal);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') hideModal();
    });
}

bindEvents();
initGame();