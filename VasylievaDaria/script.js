const ROWS = 10;
const COLS = 10;
const MINES_COUNT = 15;

let gameState = {
    rows: ROWS,
    cols: COLS,
    minesCount: MINES_COUNT,
    status: 'process', // 'process' | 'win' | 'lose'
    gameTime: 0,
    timerId: null,
};

let board = [];
let flagsLeft = MINES_COUNT;

const gridEl = document.getElementById('grid');
const timerEl = document.getElementById('timer');
const flagsEl = document.getElementById('flags-count');
const restartBtn = document.getElementById('restart-btn');
const newGameBtn = document.getElementById('new-game-btn');
const messageEl = document.getElementById('message');

// Генерація поля та мін
function generateField(rows, cols, minesCount) {
    let newBoard = [];

    for (let r = 0; r < rows; r++) {
        let row = [];
        for (let c = 0; c < cols; c++) {
            row.push({
                row: r,
                col: c,
                type: 'empty',
                state: 'closed',
                neighborMines: 0
            });
        }
        newBoard.push(row);
    }

    let minesPlaced = 0;
    while (minesPlaced < minesCount) {
        let randomRow = Math.floor(Math.random() * rows);
        let randomCol = Math.floor(Math.random() * cols);

        if (newBoard[randomRow][randomCol].type !== 'mine') {
            newBoard[randomRow][randomCol].type = 'mine';
            minesPlaced++;
        }
    }

    countNeighbourMines(newBoard, rows, cols);
    return newBoard;
}

// Підрахунок сусідніх мін
function countNeighbourMines(field, rows, cols) {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (field[r][c].type === 'mine') continue;

            let count = 0;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    let nr = r + dr;
                    let nc = c + dc;
                    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                        if (field[nr][nc].type === 'mine') {
                            count++;
                        }
                    }
                }
            }
            field[r][c].neighborMines = count;
        }
    }
}

// Таймер
function startTimer() {
    clearInterval(gameState.timerId);
    gameState.gameTime = 0;
    timerEl.textContent = `⏱️ 000`;

    gameState.timerId = setInterval(() => {
        if (gameState.status === 'process') {
            gameState.gameTime++;
            let formattedTime = String(gameState.gameTime).padStart(3, '0');
            timerEl.textContent = `⏱️ ${formattedTime}`;
        }
    }, 1000);
}

// Робота з прапорцями
function toggleFlag(row, col) {
    let cell = board[row][col];
    if (cell.state === 'opened' || gameState.status !== 'process') return;

    if (cell.state === 'closed' && flagsLeft > 0) {
        cell.state = 'flagged';
        flagsLeft--;
    } else if (cell.state === 'flagged') {
        cell.state = 'closed';
        flagsLeft++;
    }
    updateFlagsDisplay();
    renderBoard();
}

function updateFlagsDisplay() {
    flagsEl.textContent = `🚩 ${flagsLeft}`;
}

// Логіка відкриття клітинок та рекурсія
function openCell(row, col) {
    let cell = board[row][col];

    if (cell.state === 'opened' || cell.state === 'flagged' || gameState.status !== 'process') {
        return;
    }

    if (cell.type === 'mine') {
        cell.state = 'opened';
        gameState.status = 'lose';
        clearInterval(gameState.timerId);
        revealAllMines();
        messageEl.textContent = '💥 Поразка! Ви підірвалися на міні.';
        restartBtn.textContent = '😵';
        renderBoard();
        return;
    }

    cell.state = 'opened';

    if (cell.neighborMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                let nr = row + dr;
                let nc = col + dc;
                if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
                    if (board[nr][nc].state === 'closed') {
                        openCell(nr, nc);
                    }
                }
            }
        }
    }

    checkWinCondition();
    renderBoard();
}

// Перевірка перемоги
function checkWinCondition() {
    let win = true;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            let cell = board[r][c];
            if (cell.type === 'empty' && cell.state !== 'opened') {
                win = false;
                break;
            }
        }
    }

    if (win) {
        gameState.status = 'win';
        clearInterval(gameState.timerId);
        messageEl.textContent = '🏆 Вітаю! Ви виграли!';
        restartBtn.textContent = '😎';
    }
}

function revealAllMines() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c].type === 'mine') {
                board[r][c].state = 'opened';
            }
        }
    }
}

// Рендеринг сітки в DOM
function renderBoard() {
    gridEl.innerHTML = '';

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            let cellData = board[r][c];
            let cellEl = document.createElement('div');
            cellEl.classList.add('cell');

            if (cellData.state === 'opened') {
                cellEl.classList.add('opened');
                if (cellData.type === 'mine') {
                    cellEl.classList.add('mine');
                    cellEl.textContent = '💣';
                } else if (cellData.neighborMines > 0) {
                    cellEl.textContent = cellData.neighborMines;
                    cellEl.setAttribute('data-value', cellData.neighborMines);
                }
            } else if (cellData.state === 'flagged') {
                cellEl.classList.add('flagged');
                cellEl.textContent = '🚩';
            }

            cellEl.addEventListener('click', () => {
                if (gameState.status === 'process') {
                    openCell(r, c);
                }
            });

            cellEl.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (gameState.status === 'process') {
                    toggleFlag(r, c);
                }
            });

            gridEl.appendChild(cellEl);
        }
    }
}

// Ініціалізація / Нова гра
function initGame() {
    gameState.status = 'process';
    gameState.gameTime = 0;
    flagsLeft = MINES_COUNT;
    messageEl.textContent = '';
    restartBtn.textContent = '😇';

    board = generateField(ROWS, COLS, MINES_COUNT);
    updateFlagsDisplay();
    startTimer();
    renderBoard();
}

// Події кнопок
restartBtn.addEventListener('click', initGame);
newGameBtn.addEventListener('click', initGame);

// Перший запуск
initGame();