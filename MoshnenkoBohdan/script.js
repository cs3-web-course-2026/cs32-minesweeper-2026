const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const menuCard = document.getElementById('menu-card');
const gameContainer = document.getElementById('game-container');
const board = document.getElementById('board');
const rowsInput = document.getElementById('rows');
const colsInput = document.getElementById('columns');

const minesCountEl = document.getElementById('mines-count');
const timerEl = document.getElementById('timer');
const closedCountEl = document.getElementById('closed-count');
const gameStatusEl = document.getElementById('game-status');

let isGameOver = false;
let timerInterval = null;
let secondsPassed = 0;
let minesLeft = 0;
let safeCellsRemaining = 0;

function startGame() {
    const rows = parseInt(rowsInput.value, 10);
    const cols = parseInt(colsInput.value, 10);

    if (isNaN(rows) || isNaN(cols) || rows < 5 || rows > 15 || cols < 5 || cols > 15) {
        updateStatus('Please enter valid field dimensions between 5 and 15.');
        return;
    }

    menuCard.classList.add('hidden');
    gameContainer.classList.remove('hidden');

    createBoard(rows, cols);
}

startBtn.addEventListener('click', startGame);
if (restartBtn) {
    restartBtn.addEventListener('click', startGame);
}

function createBoard(rows, cols) {
    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
    isGameOver = false;

    resetTimer();
    startTimer();

    const totalCells = rows * cols;
    const totalMines = Math.round(totalCells * 0.20);

    minesLeft = totalMines;
    safeCellsRemaining = totalCells - totalMines;

    minesCountEl.textContent = minesLeft;
    closedCountEl.textContent = safeCellsRemaining;
    updateStatus(`Game started. Mines: ${minesLeft}, remaining safe cells: ${safeCellsRemaining}`);

    const cellsGrid = [];

    for (let r = 0; r < rows; r++) {
        cellsGrid[r] = [];
        for (let c = 0; c < cols; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');

            cell.dataset.row = r;
            cell.dataset.col = c;
            cell.dataset.state = 'closed';
            cell.dataset.isMine = 'false';

            cell.addEventListener('click', () => {
                if (isGameOver || cell.dataset.state === 'revealed' || cell.dataset.state === 'flagged') {
                    return;
                }

                if (cell.dataset.isMine === 'true') {
                    gameOver(cellsGrid, rows, cols, cell);
                    return;
                }

                cell.dataset.state = 'revealed';
                cell.classList.add('revealed');

                const mines = parseInt(cell.dataset.amountOfMines, 10);
                if (mines > 0) {
                    cell.textContent = mines;
                    cell.classList.add(`number-${mines}`);
                }

                safeCellsRemaining--;
                closedCountEl.textContent = safeCellsRemaining;
                updateStatus(`Cell revealed. Remaining safe cells: ${safeCellsRemaining}`);

                if (safeCellsRemaining === 0) {
                    gameWin();
                }
            });

            cell.addEventListener('contextmenu', (e) => {
                e.preventDefault();

                if (isGameOver || cell.dataset.state === 'revealed') {
                    return;
                }

                if (cell.dataset.state === 'flagged') {
                    cell.dataset.state = 'closed';
                    cell.classList.remove('flagged');
                    cell.textContent = '';
                    minesLeft++;
                } else {
                    cell.dataset.state = 'flagged';
                    cell.classList.add('flagged');
                    cell.textContent = '🚩';
                    minesLeft--;
                }

                minesCountEl.textContent = minesLeft;
                updateStatus(`Mines count: ${minesLeft}`);
            });

            board.appendChild(cell);
            cellsGrid[r][c] = cell;
        }
    }

    placeMines(cellsGrid, rows, cols, totalMines);
    countMines(cellsGrid, rows, cols);
}

function placeMines(cellsGrid, rows, cols, totalMines) {
    let minesPlanted = 0;

    while (minesPlanted < totalMines) {
        const randomRow = Math.floor(Math.random() * rows);
        const randomCol = Math.floor(Math.random() * cols);
        const targetCell = cellsGrid[randomRow][randomCol];

        if (targetCell.dataset.isMine === 'false') {
            targetCell.dataset.isMine = 'true';
            minesPlanted++;
        }
    }
}

function countMines(cellsGrid, rows, cols) {
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            if (cellsGrid[i][j].dataset.isMine === 'true') {
                continue;
            }
            let counter = 0;
            let left = Math.max(0, j - 1);
            let right = Math.min(cols - 1, j + 1);
            let high = Math.max(0, i - 1);
            let low = Math.min(rows - 1, i + 1);

            for (let z = high; z <= low; z++) {
                for (let y = left; y <= right; y++) {
                    if (z === i && y === j) {
                        continue;
                    } else if (cellsGrid[z][y].dataset.isMine === 'true') {
                        counter++;
                    }
                }
            }
            cellsGrid[i][j].dataset.amountOfMines = counter;
        }
    }
}

function startTimer() {
    timerInterval = setInterval(() => {
        secondsPassed++;
        const mins = String(Math.floor(secondsPassed / 60)).padStart(2, '0');
        const secs = String(secondsPassed % 60).padStart(2, '0');
        timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
}

function resetTimer() {
    clearInterval(timerInterval);
    secondsPassed = 0;
    timerEl.textContent = '00:00';
}

function updateStatus(message) {
    if (gameStatusEl) {
        gameStatusEl.textContent = message;
    }
}

function gameOver(cellsGrid, rows, cols, clickedCell) {
    isGameOver = true;
    clearInterval(timerInterval);

    clickedCell.dataset.state = 'revealed';
    clickedCell.classList.add('revealed');
    clickedCell.textContent = '💣';
    clickedCell.style.background = 'rgb(239 68 68 / 70%)';

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const currentCell = cellsGrid[r][c];
            if (currentCell.dataset.isMine === 'true' && currentCell !== clickedCell) {
                currentCell.dataset.state = 'revealed';
                currentCell.classList.add('revealed');
                currentCell.textContent = '💣';
            }
        }
    }

    updateStatus('Game over. You lost!');
}

function gameWin() {
    isGameOver = true;
    clearInterval(timerInterval);
    updateStatus('Congratulations, you won!');
}