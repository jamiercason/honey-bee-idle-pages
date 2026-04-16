import { HIVE } from '../config/hiveConfig.js';

var currentStage = null;
var stateRef = null;
var cellById = {};
var cellByCoordKey = {};

export function setBoardQueryRuntime(runtime) {
  currentStage = runtime && runtime.currentStage ? runtime.currentStage : null;
  stateRef = runtime && runtime.state ? runtime.state : null;
}

export function stageCellKey(row, col) {
  return row + ':' + col;
}

export function getBoardRows() {
  return currentStage ? currentStage.rows : HIVE.ROWS;
}

export function getBoardCols() {
  return currentStage ? currentStage.cols : HIVE.COLS;
}

export function isBoardRowInBounds(row) {
  return row >= 0 && row < getBoardRows();
}

export function wrapBoardCol(col) {
  var cols = getBoardCols();
  return ((col % cols) + cols) % cols;
}

export function buildCellIndex() {
  cellById = {};
  cellByCoordKey = {};
  var cells = stateRef && stateRef.cells ? stateRef.cells : [];
  for (var ci = 0; ci < cells.length; ci++) {
    cellById[cells[ci].id] = cells[ci];
    cellByCoordKey[stageCellKey(cells[ci].row, cells[ci].col)] = cells[ci];
  }
}

export function getCellById(id) {
  return cellById[id] || null;
}

export function getCellByCoords(row, col) {
  if (!isBoardRowInBounds(row)) { return null; }
  return cellByCoordKey[stageCellKey(row, wrapBoardCol(col))] || null;
}
