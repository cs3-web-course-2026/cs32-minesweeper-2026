const startBtn = document.getElementById('start-btn');
const menuCard = document.getElementById('menu-card');
const gameContainer = document.getElementById('game-container');
const board = document.getElementById('board');
const rowsInput = document.getElementById('rows');
const colsInput = document.getElementById('columns');

const minesCountEl = document.getElementById('mines-count');
const timerEl = document.getElementById('timer');
const closedCountEl = document.getElementById('closed-count');

let isGameOver = false;
let timerInterval = null;
let secondsPassed = 0;
let minesLeft = 0;
let safeCellsRemaining = 0;

startBtn.addEventListener('click', () => {
    const rows = parseInt(rowsInput.value);
    const cols = parseInt(colsInput.value);

    menuCard.classList.add('hidden');
    gameContainer.classList.remove('hidden');

    createBoard(rows, cols);
});

function createBoard(rows, cols) {
    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${cols}, 35px)`;
    isGameOver = false;

    resetTimer();
    startTimer();

    const totalCells = rows * cols;
    const totalMines = Math.round(totalCells * 0.20);

    minesLeft = totalMines;
    safeCellsRemaining = totalCells - totalMines;

    minesCountEl.textContent = minesLeft;
    closedCountEl.textContent = safeCellsRemaining;

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

                const mines = parseInt(cell.dataset.amountOfMines);
                if (mines > 0) {
                    cell.textContent = mines;
                    cell.classList.add(`number-${mines}`);
                }

                safeCellsRemaining--;
                closedCountEl.textContent = safeCellsRemaining;

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

function countMines(cellsGrid, rows, cols){
    let counter = 0;
    for (let i = 0; i < rows; i++){
        for( let j = 0; j < cols; j++){
            if (cellsGrid[i][j].dataset.isMine === 'true') {
                continue;
            }
            let left = j - 1;
            let right = j + 1;
            let high = i - 1;
            let low = i + 1;
            if( j === 0){
                left = j;
            }
            if (j === cols - 1){
                right = j;
            }
            if (i === 0){
                high = i;
            }
            if(i === rows - 1){
                low = i;
            }
            for (let z = high; z <= low; z++){
                for( let y = left; y <= right; y++) {
                    if( z === i && y === j){
                        continue;
                    }
                    else if(cellsGrid[z][y].dataset.isMine === 'true'){
                       counter++;
                    }
                }
            }
            cellsGrid[i][j].dataset.amountOfMines = counter;
            counter = 0;
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

function gameOver(cellsGrid, rows, cols, clickedCell) {
    isGameOver = true;
    clearInterval(timerInterval);

    clickedCell.dataset.state = 'revealed';
    clickedCell.classList.add('revealed');
    clickedCell.textContent = '💣';
    clickedCell.style.background = 'rgba(239, 68, 68, 0.7)';

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

    setTimeout(() => {
        alert('You lost!');
    }, 100);
}

function gameWin() {
    isGameOver = true;
    clearInterval(timerInterval);
    setTimeout(() => {
        alert(`Victory!`);
    }, 100);
}