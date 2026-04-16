import { stageCellKey, getBoardRows, wrapBoardCol } from './boardQueries.js';

export var BOARD_DIRECTIONS = ['NW', 'NE', 'E', 'W', 'SW', 'SE'];
export var OPPOSITE_DIRECTION = {
  NW: 'SE',
  NE: 'SW',
  E: 'W',
  W: 'E',
  SW: 'NE',
  SE: 'NW'
};

export function getNeighborOffsetsForRow(row) {
  if (row % 2 === 0) {
    return {
      NW: { row: -1, col: -1 },
      NE: { row: -1, col:  0 },
      E:  { row:  0, col:  1 },
      W:  { row:  0, col: -1 },
      SW: { row:  1, col: -1 },
      SE: { row:  1, col:  0 }
    };
  }
  return {
    NW: { row: -1, col:  0 },
    NE: { row: -1, col:  1 },
    E:  { row:  0, col:  1 },
    W:  { row:  0, col: -1 },
    SW: { row:  1, col:  0 },
    SE: { row:  1, col:  1 }
  };
}

export function buildLogicalHexGraph(cells) {
  var idx = {};
  var i;
  var c;
  var boardRows = getBoardRows();
  for (i = 0; i < cells.length; i++) {
    c = cells[i];
    idx[stageCellKey(c.row, c.col)] = c.id;
  }

  function lookup(row, col) {
    if (row < 0 || row >= boardRows) { return null; }
    var wrappedCol = wrapBoardCol(col);
    var id = idx[stageCellKey(row, wrappedCol)];
    return id !== undefined ? id : null;
  }

  for (i = 0; i < cells.length; i++) {
    c = cells[i];
    var row = c.row;
    var col = c.col;
    var offsets = getNeighborOffsetsForRow(row);
    var dirs = {};
    for (var di = 0; di < BOARD_DIRECTIONS.length; di++) {
      var dirName = BOARD_DIRECTIONS[di];
      var delta = offsets[dirName];
      dirs[dirName] = lookup(row + delta.row, col + delta.col);
    }

    c.directionMap = dirs;

    var nbrs = [];
    for (var dni = 0; dni < BOARD_DIRECTIONS.length; dni++) {
      var neighborId = dirs[BOARD_DIRECTIONS[dni]];
      if (neighborId !== null) { nbrs.push(neighborId); }
    }
    c.neighborIds = nbrs;
    c.revealTargetIds = nbrs.slice();
    c.seats = [];
    c.seat = null;
  }
}
