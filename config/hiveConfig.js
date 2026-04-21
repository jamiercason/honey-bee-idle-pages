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
  HEX_GAP_FACTOR: 0.9920,
  CORE_SURFACE_INSET: 0.006,
  HEX_FACE_SCALE: 0.94,
  HEX_BEVEL_INSET: 0.090,
  HEX_FACE_RECESS: 0.008,
  HEX_FACE_SEGMENTS: 5,
  CELL_STATE_CONTRAST: 0.70,
  CELL_PRODUCING_FILL_VIS: 0.70,
  CELL_FULL_GLOSS: 0.62,
  CELL_SEAM_SHADOW: 0.08,
  CELL_WAX_VARIATION: 0.02
};
