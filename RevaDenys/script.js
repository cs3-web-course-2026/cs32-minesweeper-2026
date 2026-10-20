const gameState = {
  rows: 8,
  cols: 8,
  minesCount: 5,
  status: 'process',
  gameTime: 0,
  timerId: null,
};

let gameGrid = [];

const gridElement = document.getElementById('grid');
const flagCountElement = document.getElementById('flag-count');
const timerElement = document.getElementById('timer');
const restartButtonElement = document.getElementById('btn-restart');
const gameMessageElement = document.getElementById('game-message');

function getRndInteger(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function generateField(rows, cols, minesCount) {
  if (minesCount >= rows * cols) {
    throw new Error('number of mines on the field is too high!');
  }
  gameGrid = [];

  for (let i = 0; i < rows; i++) {
    gameGrid.push([]);
    for (let j = 0; j < cols; j++) {
      gameGrid[i].push({
        type: 'empty',
        state: 'closed',
        neighborMines: 0,
      });
    }
  }

  for (let u = 0; u < minesCount; u++) {
    let found_empty = false;

    while (!found_empty) {
      const rand_row = getRndInteger(0, rows);
      const rand_col = getRndInteger(0, cols);
      const current_cell = gameGrid[rand_row][rand_col];
      if (current_cell.type === 'empty') {
        found_empty = true;
        current_cell.type = 'mine';
      }
    }
  }
  console.log(gameGrid);
}

function cellCoordinatesInBounds(row, col) {
  return (
    row >= 0 && row < gameGrid.length && col >= 0 && col < gameGrid[row].length
  );
}

function countNeighbourMines() {
  for (let row = 0; row < gameGrid.length; row++) {
    for (let col = 0; col < gameGrid[row].length; col++) {
      let mineCount = 0;

      for (let directionalRow = -1; directionalRow <= 1; directionalRow++) {
        for (let directionalCol = -1; directionalCol <= 1; directionalCol++) {
          if (directionalRow === 0 && directionalCol === 0) {
            continue;
          }

          const neighbourRow = row + directionalRow;
          const neighbourCol = col + directionalCol;

          if (
            cellCoordinatesInBounds(neighbourRow, neighbourCol) &&
            gameGrid[neighbourRow][neighbourCol].type === 'mine'
          ) {
            mineCount++;
          }
        }
      }

      gameGrid[row][col].neighborMines = mineCount;
    }
  }
}

function openCell(row, col) {
  if (gameState.status !== 'process') {
    return;
  }

  if (!cellCoordinatesInBounds(row, col)) {
    return;
  }

  const clickedCell = gameGrid[row][col];

  if (clickedCell.state !== 'closed') {
    return;
  }

  clickedCell.state = 'opened';

  if (clickedCell.type === 'mine') {
    gameState.status = 'lose';

    return;
  }

  if (clickedCell.neighborMines === 0) {
    for (let directionalRow = -1; directionalRow <= 1; directionalRow++) {
      for (let directionalCol = -1; directionalCol <= 1; directionalCol++) {
        if (directionalRow === 0 && directionalCol === 0) {
          continue;
        }

        openCell(row + directionalRow, col + directionalCol);
      }
    }
  }
}

function toggleFlag(row, col) {
  if (gameState.status !== 'process') {
    return;
  }

  if (!cellCoordinatesInBounds(row, col)) {
    return;
  }

  const clickedCell = gameGrid[row][col];

  if (clickedCell.state === 'opened') {
    return;
  }

  if (clickedCell.state === 'closed') {
    clickedCell.state = 'flagged';

    return;
  }

  if (clickedCell.state === 'flagged') {
    clickedCell.state = 'closed';
  }
}

function startGameTimer() {
  if (gameState.timerId !== null) {
    clearInterval(gameState.timerId);
  }

  gameState.timerId = setInterval(function () {
    if (gameState.status === 'win' || gameState.status === 'lose') {
      clearInterval(gameState.timerId);
      gameState.timerId = null;

      return;
    }

    gameState.gameTime++;
    timerElement.textContent = String(gameState.gameTime).padStart(3, '0');
    timerElement.setAttribute(
      'aria-label',
      `Минуло секунд: ${gameState.gameTime}`,
    );
  }, 1000);
}

function startNewGame() {
  if (gameState.timerId !== null) {
    clearInterval(gameState.timerId);
  }

  gameState.status = 'process';
  gameState.gameTime = 0;
  gameState.timerId = null;
  gameMessageElement.textContent = '';

  generateField(gameState.rows, gameState.cols, gameState.minesCount);
  countNeighbourMines();

  flagCountElement.textContent = String(gameState.minesCount).padStart(3, '0');
  timerElement.textContent = '000';
  timerElement.setAttribute('aria-label', 'Минуло секунд: 0');

  renderGrid();
  startGameTimer();
}

function checkWinCondition() {
  let openedSafeCells = 0;

  for (let row = 0; row < gameGrid.length; row++) {
    for (let col = 0; col < gameGrid[row].length; col++) {
      if (
        gameGrid[row][col].type === 'empty' &&
        gameGrid[row][col].state === 'opened'
      ) {
        openedSafeCells++;
      }
    }
  }

  if (
    openedSafeCells ===
    gameState.rows * gameState.cols - gameState.minesCount
  ) {
    gameState.status = 'win';
  }
}

function renderGrid() {
  gridElement.replaceChildren();

  for (let row = 0; row < gameGrid.length; row++) {
    const rowElement = document.createElement('div');
    rowElement.setAttribute('role', 'row');

    for (let col = 0; col < gameGrid[row].length; col++) {
      const cell = gameGrid[row][col];
      const cellButton = document.createElement('button');
      cellButton.type = 'button';
      cellButton.classList.add('v-cell');
      cellButton.setAttribute('role', 'gridcell');
      cellButton.setAttribute('aria-rowindex', String(row + 1));
      cellButton.setAttribute('aria-colindex', String(col + 1));

      if (gameState.status === 'lose' && cell.type === 'mine') {
        cellButton.classList.add('v-cell-revealed', 'v-cell-trap');

        if (cell.state === 'opened') {
          cellButton.classList.add('v-cell-exploded');
        }

        cellButton.setAttribute(
          'aria-label',
          `Рядок ${row + 1}, стовпець ${col + 1}, міна`,
        );
      } else if (
        gameState.status === 'lose' &&
        cell.state === 'flagged' &&
        cell.type === 'empty'
      ) {
        cellButton.classList.add('v-cell-flagged-wrong');
        cellButton.setAttribute(
          'aria-label',
          `Рядок ${row + 1}, стовпець ${col + 1}, хибний прапорець`,
        );
      } else if (cell.state === 'flagged') {
        cellButton.classList.add('v-cell-flagged');
        cellButton.setAttribute(
          'aria-label',
          `Рядок ${row + 1}, стовпець ${col + 1}, позначено прапорцем`,
        );
      } else if (cell.state === 'opened') {
        cellButton.classList.add('v-cell-revealed');

        if (cell.type === 'mine') {
          cellButton.classList.add('v-cell-trap', 'v-cell-exploded');
          cellButton.setAttribute(
            'aria-label',
            `Рядок ${row + 1}, стовпець ${col + 1}, міна`,
          );
        } else {
          if (cell.neighborMines > 0) {
            cellButton.textContent = String(cell.neighborMines);
            cellButton.classList.add(`v-cell-${cell.neighborMines}`);
          }

          cellButton.setAttribute(
            'aria-label',
            `Рядок ${row + 1}, стовпець ${col + 1}, відкрито, мін поруч: ${cell.neighborMines}`,
          );
        }
      } else {
        cellButton.setAttribute(
          'aria-label',
          `Рядок ${row + 1}, стовпець ${col + 1}, закрито`,
        );
      }

      cellButton.addEventListener('click', function () {
        openCell(row, col);
        checkWinCondition();
        renderGrid();
      });

      cellButton.addEventListener('contextmenu', function (event) {
        event.preventDefault();
        toggleFlag(row, col);
        renderGrid();
      });

      rowElement.appendChild(cellButton);
    }

    gridElement.appendChild(rowElement);
  }

  const flagsPlaced = gameGrid.flat().filter(function (cell) {
    return cell.state === 'flagged';
  }).length;
  const remainingFlags = gameState.minesCount - flagsPlaced;
  flagCountElement.textContent = String(remainingFlags).padStart(3, '0');
  flagCountElement.setAttribute(
    'aria-label',
    `Залишилось пасток: ${remainingFlags}`,
  );

  if (gameState.status === 'win') {
    gameMessageElement.textContent =
      'Перемога! Ви знайшли всі безпечні клітинки!';
  } else if (gameState.status === 'lose') {
    gameMessageElement.textContent = 'Поразка! Ви натрапили на міну.';
  }

  if (gameState.status === 'win' || gameState.status === 'lose') {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
  }
}

gridElement.setAttribute('aria-rowcount', String(gameState.rows));
gridElement.setAttribute('aria-colcount', String(gameState.cols));
gridElement.setAttribute(
  'aria-label',
  `Ігрове поле Сапер, сітка ${gameState.rows} на ${gameState.cols}`,
);
restartButtonElement.addEventListener('click', startNewGame);
startNewGame();
