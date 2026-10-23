/** @type {Object} */
const config = { rows: 8, cols: 8, minesCount: 10 };

/** @type {number} */
const MAX_TIME = 999;
/** @type {number} */
const MODAL_DELAY_MS = 300;

/** @enum {string} */
const STATUS = { PROCESS: 'process', WIN: 'win', LOSE: 'lose' };
/** @enum {string} */
const CELL_STATE = { CLOSED: 'closed', OPENED: 'opened', FLAGGED: 'flagged', EXPLODED: 'exploded' };

/** @enum {string} */
const ICONS = { MINE: '💣', FLAG: '🏴‍☠️' };
/** @enum {string} */
const START_BTN_ICONS = {
    [STATUS.PROCESS]: '🧭',
    [STATUS.WIN]: '😎',
    [STATUS.LOSE]: '😵'
};

/** @type {number[][]} */
const DIRECTIONS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

const boardEl = document.querySelector('.game-board');
const timerEl = document.getElementById('timer');
const flagsCountEl = document.getElementById('flags-count');
const startBtnEl = document.getElementById('start-btn');
const modalEl = document.getElementById('game-modal');
const modalTitleEl = document.getElementById('modal-title');
const modalTextEl = document.getElementById('modal-text');
const modalBtnEl = document.getElementById('modal-btn');
const modalAnnounceEl = document.getElementById('modal-announce');

let gameState = createInitialState();
let board = [];

/**
 * Creates and returns the initial game state object.
 * @returns {Object} Initial state configuration
 */
function createInitialState() {
    return {
        ...config,
        status: STATUS.PROCESS,
        gameTime: 0,
        timerId: null,
        flagsCount: 0,
        isFirstClick: true,
        excludeRow: -1,
        excludeCol: -1,
        modalTimeoutId: null,
        previousActiveElement: null
    };
}

/**
 * Creates a new cell object conforming to the lab requirements.
 * @returns {Object} Cell representation
 */
function createCell() {
    return { type: 'empty', state: CELL_STATE.CLOSED, neighborMines: 0 };
}

/**
 * Checks if given coordinates are within the board boundaries.
 * @param {number} row The row index
 * @param {number} col The column index
 * @returns {boolean} True if coordinates are inside the grid
 */
function isInside(row, col) {
    return row >= 0 && row < gameState.rows && col >= 0 && col < gameState.cols;
}

/**
 * Iterates over all valid neighboring cells of a given coordinate.
 * @param {number} row The target row
 * @param {number} col The target column
 * @param {Function} callback Function to execute for each valid neighbor
 */
function forEachNeighbour(row, col, callback) {
    DIRECTIONS.forEach(([dRow, dCol]) => {
        const nRow = row + dRow;
        const nCol = col + dCol;
        if (isInside(nRow, nCol)) callback(nRow, nCol);
    });
}

/**
 * Initializes the board and places mines, explicitly using the required lab signature.
 * @param {number} rows Number of rows
 * @param {number} cols Number of columns
 * @param {number} minesCount Number of mines to place
 */
function generateField(rows, cols, minesCount) {
    if (minesCount > rows * cols - 1) {
        throw new RangeError('Кількість мін перевищує доступну кількість клітинок');
    }

    board = Array.from({ length: rows }, () => Array.from({ length: cols }, createCell));

    let minesPlaced = 0;
    while (minesPlaced < minesCount) {
        const row = Math.floor(Math.random() * rows);
        const col = Math.floor(Math.random() * cols);

        if (row === gameState.excludeRow && col === gameState.excludeCol) continue;

        if (board[row][col].type !== 'mine') {
            board[row][col].type = 'mine';
            minesPlaced++;
        }
    }

    countNeighbourMines();
}

/**
 * Calculates the number of adjacent mines for each empty cell.
 */
function countNeighbourMines() {
    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            if (board[row][col].type === 'mine') continue;

            let count = 0;
            forEachNeighbour(row, col, (nRow, nCol) => {
                if (board[nRow][nCol].type === 'mine') count++;
            });
            board[row][col].neighborMines = count;
        }
    }
}

/**
 * Recursively reveals empty cells and their neighbors.
 * @param {number} row The cell row index
 * @param {number} col The cell column index
 */
function revealCell(row, col) {
    if (!isInside(row, col)) return;

    const cell = board[row][col];
    if (cell.state !== CELL_STATE.CLOSED) return;

    cell.state = CELL_STATE.OPENED;

    if (cell.neighborMines === 0) {
        forEachNeighbour(row, col, revealCell);
    }
}

/**
 * Checks if the win condition has been met.
 * @returns {boolean} True if player won
 */
function isWin() {
    const totalSafeCells = gameState.rows * gameState.cols - gameState.minesCount;
    const openedCells = board.flat().filter((cell) => cell.state === CELL_STATE.OPENED).length;
    return openedCells === totalSafeCells;
}

/**
 * Handles the logic when a user clicks on a cell.
 * @param {number} row The row index
 * @param {number} col The column index
 */
function openCell(row, col) {
    if (gameState.status !== STATUS.PROCESS || !isInside(row, col)) return;

    if (gameState.isFirstClick) {
        gameState.isFirstClick = false;
        gameState.excludeRow = row;
        gameState.excludeCol = col;
        generateField(gameState.rows, gameState.cols, gameState.minesCount);
    }

    const cell = board[row][col];
    if (cell.state !== CELL_STATE.CLOSED) return;

    startTimerOnce();

    if (cell.type === 'mine') {
        cell.state = CELL_STATE.EXPLODED;
        endGame(STATUS.LOSE);
        return;
    }

    revealCell(row, col);

    if (isWin()) {
        endGame(STATUS.WIN);
    } else {
        renderBoard();
    }
}

/**
 * Toggles a flag marker on a closed cell.
 * @param {number} row The row index
 * @param {number} col The column index
 */
function toggleFlag(row, col) {
    if (gameState.status !== STATUS.PROCESS || !isInside(row, col)) return;

    const cell = board[row][col];

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

/**
 * Concludes the game, stops the timer, and triggers the modal.
 * @param {string} status 'win' or 'lose'
 */
function endGame(status) {
    gameState.status = status;
    stopTimer();
    render();
    showModal(status);
}

/**
 * Initializes and starts the interval timer for the game.
 */
function startTimer() {
    gameState.timerId = setInterval(() => {
        gameState.gameTime = Math.min(gameState.gameTime + 1, MAX_TIME);
        updateUI();
    }, 1000);
}

/**
 * Starts the game timer only if it is not already running.
 */
function startTimerOnce() {
    if (!gameState.timerId) startTimer();
}

/**
 * Clears the active game timer.
 */
function stopTimer() {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
}

/**
 * Returns the grammatically correct plural form of the word "mine" in Ukrainian.
 * @param {number} count The number of mines
 * @returns {string} Correct word form
 */
function pluralizeMines(count) {
    const lastTwo = count % 100;
    const last = count % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return 'мін';
    if (last === 1) return 'міна';
    if (last >= 2 && last <= 4) return 'міни';
    return 'мін';
}

/**
 * Generates the view configuration (CSS classes, text, aria label) for a cell.
 * @param {Object} cell The cell data object
 * @param {number} row The row index
 * @param {number} col The column index
 * @returns {Object} Configuration object for the UI element
 */
function getCellView(cell, row, col) {
    const position = `рядок ${row + 1}, стовпець ${col + 1}`;
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
            if (cell.neighborMines > 0) {
                view.text = String(cell.neighborMines);
                view.number = cell.neighborMines;
                view.label = `${cell.neighborMines} ${pluralizeMines(cell.neighborMines)} поруч, ${position}`;
            } else {
                view.label = `Порожня відкрита клітинка, ${position}`;
            }
            break;

        case CELL_STATE.FLAGGED:
            view.classes.push('flagged');
            view.text = ICONS.FLAG;
            view.label = `Клітинка з прапорцем, ${position}`;
            if (gameState.status === STATUS.LOSE && cell.type !== 'mine') {
                view.classes.push('false-flag');
                view.label = `Хибний прапорець, ${position}`;
            }
            break;

        default:
            if (gameOver && cell.type === 'mine') {
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

/**
 * Creates a DOM button element representing a cell on the board.
 * @param {number} row The row index
 * @param {number} col The column index
 * @returns {HTMLButtonElement} DOM element
 */
function createCellElement(row, col) {
    const view = getCellView(board[row][col], row, col);
    const btn = document.createElement('button');

    btn.type = 'button';
    btn.className = ['cell', ...view.classes].join(' ');
    btn.textContent = view.text;
    btn.dataset.row = row;
    btn.dataset.col = col;
    btn.setAttribute('aria-label', view.label);
    if (view.number !== null) btn.dataset.number = view.number;

    return btn;
}

/**
 * Constructs and renders the entire game board into the DOM.
 */
function renderBoard() {
    const activeRow = document.activeElement?.dataset?.row;
    const activeCol = document.activeElement?.dataset?.col;

    boardEl.style.setProperty('--board-width', gameState.cols);

    const fragment = document.createDocumentFragment();
    for (let row = 0; row < gameState.rows; row++) {
        for (let col = 0; col < gameState.cols; col++) {
            fragment.appendChild(createCellElement(row, col));
        }
    }
    boardEl.replaceChildren(fragment);

    if (activeRow !== undefined && activeCol !== undefined) {
        boardEl.querySelector(`[data-row="${activeRow}"][data-col="${activeCol}"]`)?.focus();
    }
}

/**
 * Updates the user interface counters (timer, flags, game status icon).
 */
function updateUI() {
    const flagsLeft = gameState.minesCount - gameState.flagsCount;

    timerEl.textContent = String(gameState.gameTime).padStart(3, '0');
    flagsCountEl.textContent = String(flagsLeft).padStart(3, '0');
    startBtnEl.textContent = START_BTN_ICONS[gameState.status];
}

/**
 * Triggers a comprehensive update of both the UI state and game board.
 */
function render() {
    updateUI();
    renderBoard();
}

/**
 * Displays the modal dialog with the result of the game and handles accessibility focus.
 * @param {string} status The concluding game status ('win' or 'lose')
 */
function showModal(status) {
    const isWinner = status === STATUS.WIN;
    const message = isWinner ? 'Перемога! Всі безпечні клітинки відкриті.' : 'Поразка! Ви натрапили на міну.';

    modalTitleEl.textContent = isWinner ? 'Перемога! 🎉' : 'Поразка! 💥';
    modalTextEl.textContent = message;
    modalAnnounceEl.textContent = message;

    gameState.previousActiveElement = document.activeElement;

    gameState.modalTimeoutId = setTimeout(() => {
        modalEl.classList.remove('hidden');
        modalBtnEl.focus();
    }, MODAL_DELAY_MS);
}

/**
 * Hides the modal dialog and returns focus to the previously active element.
 */
function hideModal() {
    clearTimeout(gameState.modalTimeoutId);
    modalEl.classList.add('hidden');
    
    if (gameState.previousActiveElement) {
        gameState.previousActiveElement.focus();
        gameState.previousActiveElement = null;
    }
}

/**
 * Resets all parameters and initializes a fresh game instance.
 */
function initGame() {
    hideModal();
    stopTimer();

    gameState = createInitialState();
    generateField(gameState.rows, gameState.cols, 0); // 0 mines for initial render (safe first click)
    render();
}

/**
 * Extracts row and column indexes from a DOM click event.
 * @param {Event} event The DOM event object
 * @returns {Object|null} Coordinate object or null if not a cell
 */
function getCellCoords(event) {
    const cellEl = event.target.closest('.cell');
    if (!cellEl) return null;
    return { row: Number(cellEl.dataset.row), col: Number(cellEl.dataset.col) };
}

/**
 * Binds necessary event listeners to interactive elements.
 */
function bindEvents() {
    boardEl.addEventListener('click', (event) => {
        const coords = getCellCoords(event);
        if (coords) openCell(coords.row, coords.col);
    });

    boardEl.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        const coords = getCellCoords(event);
        if (coords) toggleFlag(coords.row, coords.col);
    });

    startBtnEl.addEventListener('click', initGame);
    modalBtnEl.addEventListener('click', hideModal);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') hideModal();
    });
}

bindEvents();
initGame();