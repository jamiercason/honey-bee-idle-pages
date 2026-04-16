export var HIVE = {
  ROWS: 7,
  COLS: 7,
  // Tuned so the wrapped odd-r Hex(H) grid packs tightly on the cylinder:
  // arc distance between columns is close to the pointy-top hex width,
  // and row spacing stays near the canonical 1.5 * hex radius relationship.
  CYLINDER_RADIUS: 2.720,
  VERTICAL_SPACING: 2.050,
  HEX_CIRCUMRADIUS: 1.380,
  HEX_DEPTH: 0.180,
  HEX_GAP_FACTOR: 0.9920
};
