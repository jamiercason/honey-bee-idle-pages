import { CONFIG } from '../config/config.js';
import { HIVE } from '../config/hiveConfig.js';
import { TARGET_MODE, BOOST_TYPE, CELL_STATE, OBSTACLE_CLASS } from './enums.js';

export var STAGE_DEFS = {
  tutorial_01: {
    id: 'tutorial_01',
    title: 'Prototype Band 01',
    rows: HIVE.ROWS,
    cols: HIVE.COLS,
    startingHoney: CONFIG.STARTING_HONEY,
    beeStartCount: CONFIG.BEE_START_COUNT,
    spawnCost: CONFIG.SUMMON_COST,
    gate: {
      honeyRequired: CONFIG.GATE_HONEY_REQUIRED,
      rowProgressRequired: CONFIG.GATE_ROW_PROGRESS_REQUIRED
    },
    // Authored stage data is the canonical source of current board content.
    // Unspecified cells default to locked blockers.
    cells: [
      { row: 0, col: 2, state: CELL_STATE.ACTIVE,   cellType: 'open' },
      { row: 0, col: 3, state: CELL_STATE.ACTIVE,   cellType: 'open' },
      { row: 0, col: 4, state: CELL_STATE.ACTIVE,   cellType: 'open' },
      { row: 0, col: 2, revealTargetDirections: ['SE'] },
      { row: 0, col: 3, revealTargetDirections: ['SW', 'SE'] },
      { row: 0, col: 4, revealTargetDirections: ['SW', 'SE'] },
      { row: 1, col: 2, state: CELL_STATE.OBSTACLE, cellType: 'blocker', obstacleClass: OBSTACLE_CLASS.COMMON, revealTargetDirections: ['SW', 'SE'] },
      { row: 1, col: 3, state: CELL_STATE.OBSTACLE, cellType: 'blocker', obstacleClass: OBSTACLE_CLASS.COMMON, revealTargetDirections: ['SW', 'SE'] },
      { row: 1, col: 4, state: CELL_STATE.OBSTACLE, cellType: 'blocker', obstacleClass: OBSTACLE_CLASS.COMMON, revealTargetDirections: ['SW', 'SE'] },
      { row: 2, col: 2, state: CELL_STATE.LOCKED,   cellType: 'blocker',        obstacleClass: OBSTACLE_CLASS.HEAVY, revealTargetDirections: ['SW', 'SE'] },
      { row: 2, col: 3, state: CELL_STATE.LOCKED,   cellType: 'reward_blocker', obstacleClass: OBSTACLE_CLASS.TREASURE, rewardTable: [{ type: 'honey', amount: 15 }, { type: BOOST_TYPE.ROYAL_JELLY, amount: 1 }], revealTargetDirections: ['SW', 'SE'] },
      { row: 2, col: 4, state: CELL_STATE.LOCKED,   cellType: 'blocker',        obstacleClass: OBSTACLE_CLASS.HEAVY, revealTargetDirections: ['SW', 'SE'] },
      { row: 3, col: 2, state: CELL_STATE.LOCKED,   cellType: 'hatchery',       obstacleClass: OBSTACLE_CLASS.STRUCTURE, revealTargetDirections: ['SW', 'SE'] },
      { row: 3, col: 3, state: CELL_STATE.LOCKED,   cellType: 'building_lot',   obstacleClass: OBSTACLE_CLASS.STRUCTURE, revealTargetDirections: ['SW', 'SE'] },
      { row: 3, col: 4, state: CELL_STATE.LOCKED,   cellType: 'reward_blocker', obstacleClass: OBSTACLE_CLASS.TREASURE, rewardTable: [{ type: 'nectar', amount: 20 }, { type: BOOST_TYPE.ROYAL_JELLY, amount: 1 }], revealTargetDirections: ['SW', 'SE'] },
      { row: 4, col: 3, state: CELL_STATE.LOCKED,   cellType: 'processor',      obstacleClass: OBSTACLE_CLASS.STRUCTURE, revealTargetDirections: ['SW', 'SE'] },
      { row: 5, col: 3, state: CELL_STATE.LOCKED,   cellType: 'reward_blocker', obstacleClass: OBSTACLE_CLASS.TREASURE, rewardTable: [{ type: 'honey', amount: 40 }, { type: BOOST_TYPE.ROYAL_JELLY, amount: 1 }] },
      { row: 6, col: 2, state: CELL_STATE.LOCKED,   cellType: 'gate', gateCondition: 'clear progress rows', activationRequired: CONFIG.GATE_WORK_REQUIRED },
      { row: 6, col: 3, state: CELL_STATE.LOCKED,   cellType: 'gate', gateCondition: 'clear progress rows', activationRequired: CONFIG.GATE_WORK_REQUIRED },
      { row: 6, col: 4, state: CELL_STATE.LOCKED,   cellType: 'gate', gateCondition: 'clear progress rows', activationRequired: CONFIG.GATE_WORK_REQUIRED }
    ],
    seats: [
      { seatId: 'seat-r0c2', parentRow: 0, parentCol: 2, targetMode: TARGET_MODE.ALL6 },
      { seatId: 'seat-r0c3', parentRow: 0, parentCol: 3, targetMode: TARGET_MODE.ALL6 },
      { seatId: 'seat-r0c4', parentRow: 0, parentCol: 4, targetMode: TARGET_MODE.ALL6 },
      { seatId: 'seat-r1c2', parentRow: 1, parentCol: 2, targetMode: TARGET_MODE.ALL6 },
      { seatId: 'seat-r1c3', parentRow: 1, parentCol: 3, targetMode: TARGET_MODE.ALL6 },
      { seatId: 'seat-r1c4', parentRow: 1, parentCol: 4, targetMode: TARGET_MODE.ALL6 },
      { seatId: 'seat-r2c2', parentRow: 2, parentCol: 2, targetMode: TARGET_MODE.ALL6 },
      { seatId: 'seat-r2c3', parentRow: 2, parentCol: 3, targetMode: TARGET_MODE.ALL6 },
      { seatId: 'seat-r2c4', parentRow: 2, parentCol: 4, targetMode: TARGET_MODE.ALL6 }
    ]
  }
};

export var CURRENT_STAGE_ID = 'tutorial_01';
