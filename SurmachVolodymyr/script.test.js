/* global require, __dirname */

// Run explicitly with: node --test SurmachVolodymyr/script.test.js
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test, mock } = require('node:test');
const { createContext, Script, runInContext } = require('node:vm');

const gameScript = new Script(readFileSync(join(__dirname, 'script.js'), 'utf8'), {
  filename: 'script.js',
});

// A small DOM double for unit tests, limited to the APIs used by script.js.
// Events are delivered to the registered listener with an explicit target.
class TestElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.className = '';
    this.dataset = {};
    this.attributes = new Map();
    this.children = [];
    this.listeners = new Map();
    this.parentElement = null;
    this.classList = {
      contains: (name) => this.className.split(/\s+/).includes(name),
      add: (name) => {
        if (!this.classList.contains(name)) this.className += ` ${name}`;
      },
      remove: (name) => {
        this.className = this.className.split(/\s+/).filter((value) => value !== name).join(' ');
      },
    };
  }

  set textContent(value) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this.text = String(value);
  }

  get textContent() {
    return (this.text || '') + this.children.map((child) => child.textContent).join('');
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);

    return child;
  }

  contains(target) {
    return target === this || this.children.some((child) => child.contains(target));
  }

  closest(selector) {
    assert.equal(selector, '.cell');

    return this.classList.contains('cell') ? this : this.parentElement?.closest(selector) ?? null;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  emit(type, properties = {}) {
    const event = { target: this, preventDefault: mock.fn(), ...properties };
    for (const listener of this.listeners.get(type) || []) listener(event);

    return event;
  }
}

function loadGame({ random = () => 0.5, missingGrid = false, optionalControls = true } = {}) {
  const document = new TestElement();
  const elements = {
    grid: missingGrid ? null : new TestElement('main'),
    mines: new TestElement(),
    timer: new TestElement(),
    statusMessage: new TestElement(),
    smiley: optionalControls ? new TestElement('button') : null,
    newGame: optionalControls ? new TestElement('button') : null,
    flagButton: optionalControls ? new TestElement('button') : null,
  };
  const selectors = new Map([
    ['.game-grid', elements.grid],
    ['.top-panel .led-display:first-child', elements.mines],
    ['.top-panel .led-display:last-child', elements.timer],
    ['.smiley-btn', elements.smiley],
  ]);
  document.querySelector = (selector) => selectors.get(selector) ?? null;
  document.querySelectorAll = (selector) => {
    assert.equal(selector, '.nav-item');

    return optionalControls ? [elements.newGame, elements.flagButton] : [];
  };
  document.getElementById = (identifier) => identifier === 'status-message' ? elements.statusMessage : null;
  document.createElement = (tagName) => new TestElement(tagName);

  const intervals = new Map();
  const setInterval = mock.fn((callback, delay) => {
    const identifier = setInterval.mock.callCount();
    intervals.set(identifier, { callback, delay });

    return identifier;
  });
  const clearInterval = mock.fn((identifier) => intervals.delete(identifier));
  const randomMock = mock.fn(random);
  const context = createContext({
    document,
    Element: TestElement,
    Math: Object.assign(Object.create(Math), { random: randomMock }),
    setInterval,
    clearInterval,
  });
  gameScript.runInContext(context);
  // Expose lexical state for the tests without modifying the browser script.
  const game = runInContext(`({
    gameState,
    get board() { return board; },
    set board(value) { board = value; },
    forEachNeighbour, countNeighbourMines, generateField, ensureSafeFirstMove,
    openCell, toggleFlag, startTimer, stopTimer, updateTimerDisplay,
    updateMineDisplay, renderCell, buildGrid, getCellPos, initGame
  })`, context);
  Object.assign(game.gameState.dom, elements);

  return {
    game, document, elements, intervals, setInterval, clearInterval, randomMock,
    tick(seconds) {
      for (let second = 0; second < seconds; second++) {
        for (const { callback } of [...intervals.values()]) callback();
      }
    },
  };
}

function installBoard(harness, layout, { firstMove = false } = {}) {
  const { game } = harness;
  game.board = layout.map((row) => [...row].map((symbol) => ({
    type: symbol === '*' ? 'mine' : 'empty',
    state: 'closed',
    neighborMines: 0,
    element: null,
  })));
  Object.assign(game.gameState, {
    rows: layout.length,
    cols: layout[0].length,
    minesCount: layout.join('').split('*').length - 1,
    status: 'process',
    firstMove,
    openedSafeCells: 0,
    flagsPlaced: 0,
    explodedCell: null,
  });
  game.countNeighbourMines(game.board);
  game.buildGrid();

  return game.board;
}

// Convert arrays from the VM to local arrays before comparing their contents.
function cellsOf(board) {
  return Array.from(board, (row) => Array.from(row)).flat();
}

function statesOf(board) {
  return cellsOf(board).map((cell) => cell.state);
}

test('generateField creates independent closed cells and exactly the requested mines', () => {
  for (const random of [() => 0, () => 0.5, () => 1 - Number.EPSILON]) {
    const { game } = loadGame({ random });
    const field = game.generateField(3, 5, 4);
    const cells = cellsOf(field);
    assert.equal(field.length, 3);
    assert.ok(Array.from(field).every((row) => row.length === 5));
    assert.equal(new Set(cells).size, 15);
    assert.equal(cells.filter((cell) => cell.type === 'mine').length, 4);
    assert.ok(cells.every((cell) => cell.state === 'closed' && cell.element === null));
    const mines = [];
    for (let row = 0; row < field.length; row++) {
      for (let col = 0; col < field[row].length; col++) {
        if (field[row][col].type === 'mine') mines.push([row, col]);
      }
    }
    for (let row = 0; row < field.length; row++) {
      for (let col = 0; col < field[row].length; col++) {
        if (field[row][col].type === 'mine') continue;
        const adjacentMines = mines.filter(([mineRow, mineCol]) => (
          Math.abs(row - mineRow) <= 1 && Math.abs(col - mineCol) <= 1
        )).length;
        assert.equal(field[row][col].neighborMines, adjacentMines);
      }
    }
    assert.notEqual(field[0], field[1]);
    assert.notEqual(game.generateField(3, 5, 4)[0][0], field[0][0]);
  }
});

for (const [rows, cols, minesCount, expectedMines] of [
  [1, 1, 0, 0], [1, 1, 1, 1], [2, 3, 0, 0], [2, 3, 6, 6], [2, 3, 20, 6],
]) {
  test(`generateField handles ${rows}x${cols} with ${minesCount} requested mines`, () => {
    const { game } = loadGame();
    const cells = cellsOf(game.generateField(rows, cols, minesCount));
    assert.equal(cells.length, rows * cols);
    assert.equal(cells.filter((cell) => cell.type === 'mine').length, expectedMines);
    if (expectedMines === 0) assert.ok(cells.every((cell) => cell.neighborMines === 0));
  });
}

test('countNeighbourMines counts diagonals and boundaries on a rectangular field', () => {
  const harness = loadGame();
  const board = installBoard(harness, ['*..*', '.*..', '...*']);
  for (const cell of cellsOf(board)) cell.neighborMines = 99;
  // Counting must use the supplied grid, independently of the active game size.
  harness.game.gameState.rows = 10;
  harness.game.gameState.cols = 10;
  harness.game.countNeighbourMines(board);
  assert.deepEqual(board.map((row) => row.map((cell) => cell.neighborMines)), [
    [0, 2, 2, 0],
    [2, 0, 3, 2],
    [1, 1, 2, 0],
  ]);
});

test('neighbour traversal excludes the cell itself and stays inside each boundary', () => {
  const { game } = loadGame();
  Object.assign(game.gameState, { rows: 3, cols: 4 });
  for (const [row, col, expected] of [
    [0, 0, [[0, 1], [1, 0], [1, 1]]],
    [0, 1, [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2]]],
    [1, 1, [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]]],
    [2, 3, [[1, 2], [1, 3], [2, 2]]],
  ]) {
    const neighbors = [];
    game.forEachNeighbour(row, col, (neighborRow, neighborCol) => neighbors.push([neighborRow, neighborCol]));
    assert.deepEqual(neighbors, expected);
  }
});

for (const [clickRow, clickCol] of [[0, 0], [0, 2], [2, 2], [4, 4]]) {
  test(`first-move safety at (${clickRow}, ${clickCol}) preserves mines, flags and DOM cells`, () => {
    const harness = loadGame();
    const board = installBoard(harness, ['*.*.*', '.***.', '..*..', '.*.*.', '*...*']);
    harness.game.toggleFlag(0, 0);
    harness.game.toggleFlag(2, 2);
    const originalStates = statesOf(board);
    const originalElements = cellsOf(board).map((cell) => cell.element);
    const originalMineCount = harness.game.gameState.minesCount;
    harness.game.ensureSafeFirstMove(clickRow, clickCol);

    assert.equal(cellsOf(board).filter((cell) => cell.type === 'mine').length, originalMineCount);
    assert.equal(board[clickRow][clickCol].neighborMines, 0);
    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[row].length; col++) {
        if (Math.abs(row - clickRow) <= 1 && Math.abs(col - clickCol) <= 1) {
          assert.equal(board[row][col].type, 'empty');
        }
      }
    }
    assert.deepEqual(statesOf(board), originalStates);
    assert.deepEqual(cellsOf(board).map((cell) => cell.element), originalElements);
    assert.equal(harness.game.gameState.flagsPlaced, 2);
  });
}

test('an already safe first-move region leaves the board unchanged', () => {
  const harness = loadGame();
  const board = installBoard(harness, ['....', '....', '....', '...*']);
  const originalTypes = cellsOf(board).map((cell) => cell.type);
  harness.game.ensureSafeFirstMove(0, 0);
  assert.deepEqual(cellsOf(board).map((cell) => cell.type), originalTypes);
  assert.equal(harness.randomMock.mock.callCount(), 0);
});

test('opening the first cell relocates mines without consuming a pre-existing flag', () => {
  const harness = loadGame();
  const board = installBoard(harness, ['.....', '.***.', '.***.', '.***.', '.....'], { firstMove: true });
  harness.game.toggleFlag(2, 1);
  assert.equal(harness.intervals.size, 0);
  assert.equal(harness.game.gameState.firstMove, true);
  harness.game.openCell(2, 2);
  assert.equal(board[2][2].state, 'opened');
  assert.equal(board[2][2].neighborMines, 0);
  assert.equal(board[2][1].state, 'flagged');
  assert.equal(harness.game.gameState.flagsPlaced, 1);
  assert.equal(harness.game.gameState.firstMove, false);
  assert.equal(harness.game.gameState.status, 'process');
  assert.equal(harness.intervals.size, 1);
  assert.equal(harness.setInterval.mock.calls[0].arguments[1], 1000);
  harness.tick(2);
  harness.game.openCell(2, 2);
  assert.equal(harness.setInterval.mock.callCount(), 1);
  assert.equal(harness.game.gameState.gameTime, 2);
  const nextCell = board.flatMap((cells, row) => cells.map((cell, col) => ({ cell, row, col })))
    .find(({ cell }) => cell.type === 'empty' && cell.state === 'closed');
  assert.ok(nextCell, 'the fixture must leave a second safe cell available');
  harness.game.openCell(nextCell.row, nextCell.col);
  assert.equal(nextCell.cell.state, 'opened');
  assert.equal(harness.setInterval.mock.callCount(), 1);
  assert.equal(harness.game.gameState.gameTime, 2);
});

test('opening a numbered cell reveals only that cell and counts it once', () => {
  const harness = loadGame();
  const board = installBoard(harness, ['*..', '...', '...']);
  harness.game.openCell(1, 1);
  assert.equal(board[1][1].state, 'opened');
  assert.equal(harness.game.gameState.openedSafeCells, 1);
  assert.equal(statesOf(board).filter((state) => state === 'opened').length, 1);
  harness.game.openCell(1, 1);
  assert.equal(harness.game.gameState.openedSafeCells, 1);
  assert.equal(harness.game.gameState.status, 'process');
});

test('flood opening reaches numbered boundaries, skipping flags, mines and disconnected cells', () => {
  const harness = loadGame();
  const board = installBoard(harness, ['...*.', '...*.', '...*.']);
  harness.game.toggleFlag(1, 1);
  harness.game.openCell(0, 0);
  assert.deepEqual(board.map((row) => row.map((cell) => cell.state)), [
    ['opened', 'opened', 'opened', 'closed', 'closed'],
    ['opened', 'flagged', 'opened', 'closed', 'closed'],
    ['opened', 'opened', 'opened', 'closed', 'closed'],
  ]);
  assert.equal(harness.game.gameState.openedSafeCells, 8);
  assert.equal(harness.game.gameState.status, 'process');
  harness.game.toggleFlag(1, 1);
  harness.game.openCell(1, 1);
  assert.equal(harness.game.gameState.openedSafeCells, 9);
});

test('opening a flagged cell preserves first-move safety and does not start the clock', () => {
  const harness = loadGame();
  const board = installBoard(harness, ['*..', '...', '...'], { firstMove: true });
  harness.game.toggleFlag(0, 0);
  harness.game.openCell(0, 0);
  assert.equal(board[0][0].state, 'flagged');
  assert.equal(board[0][0].type, 'mine');
  assert.equal(harness.game.gameState.firstMove, true);
  assert.equal(harness.game.gameState.openedSafeCells, 0);
  assert.equal(harness.setInterval.mock.callCount(), 0);
  assert.equal(harness.randomMock.mock.callCount(), 0);
});

test('flags toggle on closed cells, update the mine counter and cannot flag opened cells', () => {
  const harness = loadGame();
  const board = installBoard(harness, ['*..', '...', '...']);
  harness.game.toggleFlag(0, 1);
  assert.equal(board[0][1].state, 'flagged');
  assert.equal(harness.game.gameState.flagsPlaced, 1);
  assert.match(harness.elements.mines.innerHTML, / 000$/);
  harness.game.toggleFlag(0, 1);
  assert.equal(board[0][1].state, 'closed');
  assert.equal(harness.game.gameState.flagsPlaced, 0);
  assert.match(harness.elements.mines.innerHTML, / 001$/);
  harness.game.openCell(0, 1);
  harness.game.toggleFlag(0, 1);
  assert.equal(board[0][1].state, 'opened');
  assert.equal(harness.game.gameState.flagsPlaced, 0);
});

test('opening every safe cell wins, flags remaining mines and stops the timer', () => {
  const harness = loadGame();
  const board = installBoard(harness, ['*..', '..*']);
  harness.game.startTimer();
  harness.tick(3);
  harness.game.toggleFlag(0, 0);
  for (const [row, col] of [[0, 1], [0, 2], [1, 0]]) harness.game.openCell(row, col);
  assert.equal(harness.game.gameState.status, 'process');
  harness.game.openCell(1, 1);
  assert.equal(harness.game.gameState.status, 'win');
  assert.equal(harness.game.gameState.openedSafeCells, 4);
  assert.equal(board[0][0].state, 'flagged');
  assert.equal(board[1][2].state, 'flagged');
  assert.equal(harness.game.gameState.flagsPlaced, 2);
  assert.equal(harness.game.gameState.timerId, null);
  assert.equal(harness.intervals.size, 0);
  assert.equal(harness.elements.statusMessage.textContent, 'Congratulations! You won!');
  assert.match(harness.elements.mines.innerHTML, / 000$/);
  harness.tick(1);
  assert.equal(harness.game.gameState.gameTime, 3);
});

test('a mine loses the game, reveals unflagged mines and marks incorrect flags', () => {
  const harness = loadGame();
  const board = installBoard(harness, ['*.*', '...', '*..']);
  harness.game.toggleFlag(0, 2);
  harness.game.toggleFlag(1, 1);
  harness.game.startTimer();
  harness.tick(2);
  harness.game.openCell(0, 0);
  assert.equal(harness.game.gameState.status, 'lose');
  assert.deepEqual(Array.from(harness.game.gameState.explodedCell), [0, 0]);
  assert.equal(board[0][0].state, 'opened');
  assert.equal(board[2][0].state, 'opened');
  assert.equal(board[0][2].state, 'flagged');
  assert.equal(board[1][1].state, 'flagged');
  assert.equal(board[1][2].state, 'closed');
  assert.equal(harness.game.gameState.openedSafeCells, 0);
  assert.ok(board[0][0].element.classList.contains('exploded-mine'));
  assert.ok(!board[2][0].element.classList.contains('exploded-mine'));
  assert.ok(board[1][1].element.classList.contains('wrong-flag'));
  assert.equal(board[1][1].element.textContent, '❌');
  assert.equal(harness.elements.statusMessage.textContent, 'Game Over! You hit a mine.');
  assert.equal(harness.game.gameState.timerId, null);
  assert.equal(harness.intervals.size, 0);
  harness.tick(1);
  assert.equal(harness.game.gameState.gameTime, 2);
});

for (const status of ['win', 'lose']) {
  test(`opening and flagging are ignored after ${status}`, () => {
    const harness = loadGame();
    const board = installBoard(harness, ['*..', '...', '...'], { firstMove: true });
    harness.game.toggleFlag(0, 0);
    harness.game.gameState.status = status;
    const originalStates = statesOf(board);
    harness.game.openCell(1, 1);
    harness.game.toggleFlag(1, 1);
    harness.game.toggleFlag(0, 0);
    assert.deepEqual(statesOf(board), originalStates);
    assert.equal(harness.game.gameState.flagsPlaced, 1);
    assert.equal(harness.game.gameState.openedSafeCells, 0);
    assert.equal(harness.game.gameState.firstMove, true);
    assert.equal(harness.setInterval.mock.callCount(), 0);
  });
}

test('timer ticks once per second, replaces an old interval and stops idempotently', () => {
  const harness = loadGame();
  harness.game.gameState.gameTime = 45;
  harness.game.startTimer();
  assert.equal(harness.game.gameState.gameTime, 0);
  harness.tick(59);
  assert.match(harness.elements.timer.innerHTML, / 00:59$/);
  harness.tick(1);
  assert.match(harness.elements.timer.innerHTML, / 01:00$/);
  const previousTimer = harness.game.gameState.timerId;
  harness.game.startTimer();
  assert.ok(!harness.intervals.has(previousTimer));
  assert.equal(harness.intervals.size, 1);
  harness.tick(1);
  assert.equal(harness.game.gameState.gameTime, 1);
  harness.game.stopTimer();
  harness.game.stopTimer();
  harness.tick(3);
  assert.equal(harness.game.gameState.gameTime, 1);
  assert.equal(harness.game.gameState.timerId, null);
  assert.equal(harness.intervals.size, 0);
});

test('timer and mine displays pad values and clamp excess flags to zero', () => {
  const { game, elements } = loadGame();
  for (const [seconds, formatted] of [[0, '00:00'], [9, '00:09'], [60, '01:00'], [3599, '59:59'], [3600, '60:00']]) {
    game.gameState.gameTime = seconds;
    game.updateTimerDisplay();
    assert.ok(elements.timer.innerHTML.endsWith(` ${formatted}`));
  }
  for (const [flags, formatted] of [[0, '015'], [1, '014'], [15, '000'], [20, '000']]) {
    game.gameState.flagsPlaced = flags;
    game.updateMineDisplay();
    assert.ok(elements.mines.innerHTML.endsWith(` ${formatted}`));
  }
});

const renderingCases = [
  { name: 'closed cell', state: 'closed', label: 'closed', text: '', classes: ['closed'] },
  { name: 'flag', state: 'flagged', label: 'flagged', text: '🚩', classes: ['closed', 'flagged-mine'] },
  { name: 'empty cell', state: 'opened', label: 'empty', text: '', classes: ['open'] },
  { name: 'one adjacent mine', state: 'opened', count: 1, label: '1 neighboring mines', text: '1', classes: ['open', 'num-1'] },
  { name: 'eight adjacent mines', state: 'opened', count: 8, label: '8 neighboring mines', text: '8', classes: ['open', 'num-8'] },
  { name: 'mine', state: 'opened', type: 'mine', label: 'mine', text: '💣', classes: ['open', 'mine'] },
  { name: 'exploded mine', state: 'opened', type: 'mine', exploded: true, label: 'exploded mine', text: '💣', classes: ['exploded-mine'] },
  { name: 'incorrect flag after loss', state: 'flagged', status: 'lose', label: 'wrong flag', text: '❌', classes: ['open', 'wrong-flag'] },
  { name: 'correct flag after loss', state: 'flagged', type: 'mine', status: 'lose', label: 'flagged', text: '🚩', classes: ['flagged-mine'] },
];

for (const rendering of renderingCases) {
  test(`renderCell renders ${rendering.name} and its accessible label`, () => {
    const harness = loadGame();
    const board = installBoard(harness, ['...', '...']);
    Object.assign(board[1][2], {
      state: rendering.state,
      type: rendering.type || 'empty',
      neighborMines: rendering.count || 0,
    });
    harness.game.gameState.status = rendering.status || 'process';
    harness.game.gameState.explodedCell = rendering.exploded ? [1, 2] : null;
    harness.game.renderCell(1, 2);
    const element = board[1][2].element;
    assert.equal(element.textContent, rendering.text);
    assert.equal(element.getAttribute('aria-label'), `Row 2, column 3, ${rendering.label}`);
    for (const className of rendering.classes) assert.ok(element.classList.contains(className));
  });
}

test('rendering updates existing buttons and clears stale flag icons and classes', () => {
  const harness = loadGame();
  const board = installBoard(harness, ['*..', '...', '...']);
  const element = board[0][1].element;
  harness.game.toggleFlag(0, 1);
  harness.game.renderCell(0, 1);
  assert.equal(element.children.length, 1);
  harness.game.toggleFlag(0, 1);
  assert.equal(element.children.length, 0);
  assert.equal(element.textContent, '');
  assert.ok(!element.classList.contains('flagged-mine'));
  harness.game.openCell(0, 1);
  assert.equal(board[0][1].element, element);
  assert.equal(element.textContent, '1');
  assert.ok(!element.classList.contains('closed'));
  assert.equal(harness.elements.grid.children.length, 9);
});

test('buildGrid replaces old cells and creates correctly positioned accessible buttons', () => {
  const harness = loadGame();
  const board = installBoard(harness, ['...', '...']);
  const oldElement = board[0][0].element;
  harness.game.buildGrid();
  assert.equal(harness.elements.grid.children.length, 6);
  assert.ok(!harness.elements.grid.contains(oldElement));
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const element = board[row][col].element;
      assert.equal(element.tagName, 'BUTTON');
      assert.equal(element.type, 'button');
      assert.equal(Number(element.dataset.row), row);
      assert.equal(Number(element.dataset.col), col);
      assert.equal(element.getAttribute('aria-label'), `Row ${row + 1}, column ${col + 1}, closed`);
      assert.equal(harness.elements.grid.children[row * 3 + col], element);
    }
  }
});

test('getCellPos resolves nested icons and rejects targets outside the grid', () => {
  const harness = loadGame();
  const board = installBoard(harness, ['...', '...']);
  harness.game.toggleFlag(1, 2);
  const icon = board[1][2].element.children[0];
  const position = harness.game.getCellPos(icon);
  assert.equal(position.row, 1);
  assert.equal(position.col, 2);
  const outsideCell = new TestElement('button');
  outsideCell.className = 'cell';
  for (const target of [outsideCell, harness.elements.grid, {}, null]) {
    assert.equal(harness.game.getCellPos(target), null);
  }
});

test('DOMContentLoaded builds the default board without starting the clock', () => {
  const harness = loadGame();
  harness.document.emit('DOMContentLoaded');
  assert.equal(harness.elements.grid.children.length, 100);
  assert.equal(cellsOf(harness.game.board).filter((cell) => cell.type === 'mine').length, 15);
  assert.ok(statesOf(harness.game.board).every((state) => state === 'closed'));
  assert.equal(harness.game.gameState.firstMove, true);
  assert.equal(harness.intervals.size, 0);
  assert.equal(harness.elements.flagButton.getAttribute('aria-pressed'), 'false');
});

test('delegated clicks open cells and flag mode toggles flags without opening cells', () => {
  const harness = loadGame();
  harness.document.emit('DOMContentLoaded');
  const cell = harness.game.board[0][0];
  harness.elements.flagButton.emit('click');
  assert.equal(harness.game.gameState.flagMode, true);
  assert.equal(harness.elements.flagButton.getAttribute('aria-pressed'), 'true');
  assert.ok(harness.elements.flagButton.classList.contains('active'));
  harness.elements.grid.emit('click', { target: cell.element });
  assert.equal(cell.state, 'flagged');
  assert.equal(harness.game.gameState.firstMove, true);
  assert.equal(harness.intervals.size, 0);
  harness.elements.flagButton.emit('click');
  assert.equal(harness.elements.flagButton.getAttribute('aria-pressed'), 'false');
  assert.ok(!harness.elements.flagButton.classList.contains('active'));
  harness.elements.grid.emit('contextmenu', { target: cell.element.children[0] });
  harness.elements.grid.emit('click', { target: cell.element });
  assert.equal(cell.state, 'opened');
  assert.equal(harness.game.gameState.firstMove, false);
});

test('right-click prevents the browser menu and toggles the targeted cell', () => {
  const harness = loadGame();
  harness.document.emit('DOMContentLoaded');
  const cell = harness.game.board[0][0];
  const event = harness.elements.grid.emit('contextmenu', { target: cell.element });
  assert.equal(event.preventDefault.mock.callCount(), 1);
  assert.equal(cell.state, 'flagged');
  harness.elements.grid.emit('contextmenu', { target: cell.element.children[0] });
  assert.equal(cell.state, 'closed');
});

test('F and f toggle flags while repeated or unrelated keys leave cells unchanged', () => {
  const harness = loadGame();
  harness.document.emit('DOMContentLoaded');
  const cell = harness.game.board[1][2];
  for (const key of ['f', 'F']) {
    const event = harness.elements.grid.emit('keydown', { target: cell.element, key, repeat: false });
    assert.equal(cell.state, 'flagged');
    assert.equal(event.preventDefault.mock.callCount(), 1);
    const repeated = harness.elements.grid.emit('keydown', { target: cell.element, key, repeat: true });
    assert.equal(cell.state, 'flagged');
    assert.equal(repeated.preventDefault.mock.callCount(), 0);
    harness.elements.grid.emit('keydown', { target: cell.element, key, repeat: false });
    assert.equal(cell.state, 'closed');
  }
  const unrelated = harness.elements.grid.emit('keydown', { target: cell.element, key: 'ArrowRight' });
  assert.equal(cell.state, 'closed');
  assert.equal(unrelated.preventDefault.mock.callCount(), 0);
});

test('delegated events ignore clicks, context menus and keys outside a cell', () => {
  const harness = loadGame();
  harness.document.emit('DOMContentLoaded');
  const originalStates = statesOf(harness.game.board);
  for (const type of ['click', 'contextmenu', 'keydown']) {
    harness.elements.grid.emit(type, { key: 'f' });
  }
  assert.deepEqual(statesOf(harness.game.board), originalStates);
  assert.equal(harness.game.gameState.firstMove, true);
});

for (const control of ['smiley', 'newGame']) {
  test(`${control} restarts the game and clears timer, flags, status and mode`, () => {
    const harness = loadGame();
    harness.document.emit('DOMContentLoaded');
    const previousBoard = harness.game.board;
    harness.game.toggleFlag(0, 0);
    harness.elements.flagButton.emit('click');
    harness.game.startTimer();
    harness.tick(4);
    Object.assign(harness.game.gameState, {
      status: 'lose', openedSafeCells: 7, firstMove: false, explodedCell: [1, 1],
    });
    harness.elements.statusMessage.textContent = 'Game Over! You hit a mine.';
    harness.elements[control].emit('click');

    assert.notEqual(harness.game.board, previousBoard);
    assert.equal(harness.elements.grid.children.length, 100);
    assert.ok(statesOf(harness.game.board).every((state) => state === 'closed'));
    assert.equal(harness.game.gameState.status, 'process');
    assert.equal(harness.game.gameState.openedSafeCells, 0);
    assert.equal(harness.game.gameState.gameTime, 0);
    assert.equal(harness.game.gameState.flagsPlaced, 0);
    assert.equal(harness.game.gameState.explodedCell, null);
    assert.equal(harness.game.gameState.firstMove, true);
    assert.equal(harness.game.gameState.flagMode, false);
    assert.equal(harness.game.gameState.timerId, null);
    assert.equal(harness.intervals.size, 0);
    assert.equal(harness.elements.statusMessage.textContent, '');
    assert.equal(harness.elements.flagButton.getAttribute('aria-pressed'), 'false');
    assert.ok(!harness.elements.flagButton.classList.contains('active'));
    assert.match(harness.elements.timer.innerHTML, / 00:00$/);
    assert.match(harness.elements.mines.innerHTML, / 015$/);
    // A restart must not register duplicate delegated listeners.
    harness.elements.grid.emit('contextmenu', { target: harness.game.board[0][0].element });
    assert.equal(harness.game.board[0][0].state, 'flagged');
    assert.equal(harness.game.gameState.flagsPlaced, 1);
  });
}

for (const [rows, cols, expectedMines] of [[2, 2, 0], [3, 4, 3], [4, 5, 11]]) {
  test(`initGame caps mine density to preserve a safe first move on ${rows}x${cols}`, () => {
    const harness = loadGame();
    Object.assign(harness.game.gameState, { rows, cols, minesCount: 100 });
    harness.game.initGame();
    assert.equal(harness.game.gameState.minesCount, expectedMines);
    assert.equal(cellsOf(harness.game.board).filter((cell) => cell.type === 'mine').length, expectedMines);
    if (expectedMines === 0) {
      harness.game.openCell(0, 0);
      assert.equal(harness.game.gameState.status, 'win');
      assert.equal(harness.game.gameState.openedSafeCells, rows * cols);
      assert.equal(harness.intervals.size, 0);
    }
  });
}

test('DOMContentLoaded safely ignores a page without a game grid', () => {
  const harness = loadGame({ missingGrid: true });
  assert.doesNotThrow(() => harness.document.emit('DOMContentLoaded'));
  assert.equal(harness.game.board.length, 0);
  assert.equal(harness.intervals.size, 0);
});

test('initialization tolerates missing optional controls and status displays', () => {
  const harness = loadGame({ optionalControls: false });
  harness.document.emit('DOMContentLoaded');
  assert.equal(harness.elements.grid.children.length, 100);
  Object.assign(harness.game.gameState.dom, { timer: null, mines: null, statusMessage: null });
  const board = installBoard(harness, ['*..', '...']);
  assert.doesNotThrow(() => {
    harness.game.startTimer();
    harness.game.toggleFlag(0, 2);
    harness.game.openCell(0, 0);
  });
  assert.equal(board[0][0].state, 'opened');
  assert.equal(harness.game.gameState.status, 'lose');
  assert.equal(harness.intervals.size, 0);
});
