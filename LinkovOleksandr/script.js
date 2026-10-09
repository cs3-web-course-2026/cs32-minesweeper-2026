// КРОК 1: Моделювання даних (Data Layer)

const gameState = {
    rows: 10,
    cols: 10,
    minesCount: 10,
    status: 'process',
    gameTime: 0,
    timerID: null,
    flagsUsed: 0,
    board: [],
};

// Елементи DOM, з якими будемо працювати
const boardElement = document.querySelector('.game-board');
const timerElement = document.querySelector('.timer');
const flagCounterElement = document.querySelector('.flag-counter');
const startBtn = document.querySelector('.start-btn');

// КРОК 2: Генерація поля та мін
function generateField(rows, cols, minesCount) {
    gameState.board = [];

    // Створюємо порожнє поле
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            row.push({
                type: 'empty', // Тип клітинки: 'empty' або 'mine'
                neighborMines: 0, // Кількість сусідніх мін
                state: 'closed', // Стан клітинки
            });
        }
        gameState.board.push(row);
    }

    // Розставляємо міни випадковим чином
    let placedMines = 0;
    while (placedMines < minesCount) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);
        if (gameState.board[r][c].type !== 'mine') {
            gameState.board[r][c].type = 'mine';
            placedMines++;
        }
    }
}

// КРОК 3: Алгоритмічна частина

// Функція для підрахунку сусідніх мін
function countNeighbourMines() {
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            if (gameState.board[r][c].type === 'mine') continue;

            let count = 0;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr >= 0 && nr < gameState.rows && nc >= 0 && nc < gameState.cols) {
                        if (gameState.board[nr][nc].type === 'mine') {
                            count++;
                        }
                    }
                }
            }
            gameState.board[r][c].neighborMines = count;
        }
    }
}

// Логіка для відкриття клітинки
function openCell(r, c) {
    // Блокуємо кліки, якщо гра вже закінчена
    if (gameState.status === 'win' || gameState.status === 'lose') return;

    // Безпечний старт гри
    if (gameState.status === 'idle') {
        gameState.status = 'process';
        startTimer();

        // Якщо перша клітинка виявилася міною — переносимо її
        if (gameState.board[r][c].type === 'mine') {
            gameState.board[r][c].type = 'empty'; // Забираємо міну
            
            // Шукаємо нове випадкове місце для неї
            let moved = false;
            while (!moved) {
                const newR = Math.floor(Math.random() * gameState.rows);
                const newC = Math.floor(Math.random() * gameState.cols);
                // Щоб нове місце не було міною і не було клітинкою, на яку ми щойно натиснули
                if (gameState.board[newR][newC].type !== 'mine' && (newR !== r || newC !== c)) {
                    gameState.board[newR][newC].type = 'mine';
                    moved = true;
                }
            }
            // Перераховуємо цифри на полі, оскільки міна змінила позицію
            countNeighbourMines();
        }
    }

    const cell = gameState.board[r][c];
    
    // припиняємо роботу, якщо клітинка ВЖЕ відкрита або має прапорець
    if (cell.state === 'opened' || cell.state === 'flagged') return;

    cell.state = 'opened';

    // Якщо все ж натрапили на міну (на 2-му і далі ходах)
    if (cell.type === 'mine') {
        gameOver('lose', r, c);
        return;
    }

    // Рекурсія для порожніх клітинок
    if (cell.neighborMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < gameState.rows && nc >= 0 && nc < gameState.cols) {
                    openCell(nr, nc);
                }
            }
        }
    }

    checkWin();
    renderBoard();
}

// КРОК 4: Таймер та прапорці
function toggleFlag(r, c) {
    if (gameState.status !== 'process') return;

    const cell = gameState.board[r][c];
    if (cell.state === 'opened') return;

    if (cell.state === 'closed') {
        cell.state = 'flagged';
        gameState.flagsUsed++;
    } else if (cell.state === 'flagged') {
        cell.state = 'closed';
        gameState.flagsUsed--;
    }

    updateUI();
    renderBoard();
}

function startTimer() {
    if (gameState.timerID) clearInterval(gameState.timerID);
    gameState.gameTime = 0;

    gameState.timerID = setInterval(() => {
        if (gameState.status === 'process') {
            gameState.gameTime++;
            updateUI();
        }
    }, 1000);
}

// КРОК 6: Динамічні елементи інтерфейсу
function updateUI() {
    const timeFormatted = String(gameState.gameTime).padStart(3, '0');
    timerElement.textContent = `⏱${timeFormatted}`;

    const flagsLeft = gameState.minesCount - gameState.flagsUsed;
    const flagsFormatted = String(flagsLeft >= 0 ? flagsLeft : 0).padStart(3, '0');
    flagCounterElement.textContent = `🚩 ${flagsFormatted}`;

    if (gameState.status === 'win') {
        startBtn.textContent = '😎';
    } else if (gameState.status === 'lose') {
        startBtn.textContent = '😵';
    } else {
        startBtn.textContent = '🙂';
    }
}

// КРОК 5 та 7: Рендеринг і події (DOM)
function renderBoard(clickedMineR = null, clickedMineC = null) {
    boardElement.innerHTML = '';
    
    // Динамічно задаємо розмір сітки в CSS, замість hardcode 5x4
    boardElement.style.gridTemplateColumns = `repeat(${gameState.cols}, 40px)`;
    boardElement.style.gridTemplateRows = `repeat(${gameState.rows}, 40px)`;

    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const cell = gameState.board[r][c];
            
            // Створюємо HTML елемент
            const div = document.createElement('div');
            div.classList.add('cell');

            // Задаємо класи відповідно до стану
            if (cell.state === 'opened') {
                div.classList.add('open');
                
                if (cell.type === 'mine') {
                    div.classList.add('mine');
                    div.textContent = '💣';
                    // Якщо це та міна, на яку клікнули
                    if (r === clickedMineR && c === clickedMineC) {
                        div.classList.add('clicked');
                    }
                } else if (cell.neighborMines > 0) {
                    div.dataset.number = cell.neighborMines; // Для CSS кольорів (data-number="1", "2" і тд)
                    div.textContent = cell.neighborMines;
                }
            } 
            else if (cell.state === 'flagged') {
                div.classList.add('flag');
                div.textContent = '🚩';
                
                // Якщо гра завершена поразкою, і прапорець стояв неправильно
                if (gameState.status === 'lose' && cell.type !== 'mine') {
                    div.classList.add('wrong-flag');
                }
            }

            // Обробка кліків (Крок 7)
            div.addEventListener('click', () => openCell(r, c));
            
            div.addEventListener('contextmenu', (e) => {
                e.preventDefault(); // Блокуємо стандартне меню браузера
                toggleFlag(r, c);
            });

            boardElement.appendChild(div);
        }
    }
}

// КРОК 8: Завершення гри
function checkWin() {
    let closedCount = 0;
    
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            if (gameState.board[r][c].state !== 'opened') {
                closedCount++;
            }
        }
    }

    // Якщо невідкритих клітинок лишилося рівно стільки, скільки мін — це перемога!
    if (closedCount === gameState.minesCount) {
        gameOver('win');
    }
}

function gameOver(status, clickedMineR = null, clickedMineC = null) {
    gameState.status = status;
    clearInterval(gameState.timerID); // Зупиняємо таймер

    // Відкриваємо всі міни (та показуємо неправильні прапорці)
    for (let r = 0; r < gameState.rows; r++) {
        for (let c = 0; c < gameState.cols; c++) {
            const cell = gameState.board[r][c];
            if (cell.type === 'mine') {
                // Міни, де не було прапорця, відкриваємо
                if (cell.state !== 'flagged') {
                    cell.state = 'opened';
                }
            }
        }
    }
    
    updateUI();
    renderBoard(clickedMineR, clickedMineC);

    // Сповіщення після невеликої затримки, щоб гра встигла відрендерити поле
    setTimeout(() => {
        if (status === 'win') alert('Ви перемогли! 😎');
        else alert('Гру закінчено. Ви натрапили на міну! 💥');
    }, 100);
}

// ІНІЦІАЛІЗАЦІЯ ГРИ
function initGame() {
    // Зупиняємо старий таймер, якщо він був
    if (gameState.timerID) clearInterval(gameState.timerID);
    
    gameState.status = 'idle'; // Гра готова, але ще не почалась
    gameState.flagsUsed = 0;
    gameState.gameTime = 0;
    
    generateField(gameState.rows, gameState.cols, gameState.minesCount);
    countNeighbourMines();
    
    updateUI();
    renderBoard();
}

// Прив'язуємо кнопку старту
startBtn.addEventListener('click', initGame);

// Запускаємо гру при завантаженні сторінки
initGame();