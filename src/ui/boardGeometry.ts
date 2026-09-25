import { GameMode } from '../game/types';

export type BoardReferenceGeometry = {
  imageWidth: number;
  imageHeight: number;
  maxDisplayWidth: number;
  xLines: number[];
  yLines: number[];
};

export type ScaledBoardGeometry = {
  displayWidth: number;
  displayHeight: number;
  gridLeft: number;
  gridTop: number;
  gridWidth: number;
  gridHeight: number;
  columnWidths: number[];
  rowHeights: number[];
};

const HORIZONTAL_REFERENCE: BoardReferenceGeometry = {
  imageWidth: 1149,
  imageHeight: 687,
  maxDisplayWidth: 760,
  // Boundaries measured directly from the grid drawn in the user's supplied image.
  xLines: [89, 175, 261, 348, 435, 521, 655, 742, 829, 915, 1001, 1086],
  yLines: [108, 191, 275, 360, 444, 528]
};

const VERTICAL_REFERENCE: BoardReferenceGeometry = {
  imageWidth: 1089,
  imageHeight: 1445,
  maxDisplayWidth: 460,
  // 5 columns x 9 logical rows; the river is the single taller middle row.
  xLines: [226, 354, 482, 610, 740, 867],
  yLines: [119, 226, 341, 452, 580, 795, 919, 1041, 1162, 1285]
};

export function boardReferenceGeometry(mode: GameMode): BoardReferenceGeometry {
  return mode === 'horizontal-dual-nexus'
    ? HORIZONTAL_REFERENCE
    : VERTICAL_REFERENCE;
}

export function scaledBoardGeometry(mode: GameMode, viewportWidth: number): ScaledBoardGeometry {
  const reference = boardReferenceGeometry(mode);
  const availableWidth = Math.max(1, viewportWidth - 28);
  const displayWidth = Math.min(reference.maxDisplayWidth, availableWidth);
  const scale = displayWidth / reference.imageWidth;
  const displayHeight = reference.imageHeight * scale;
  const x = reference.xLines.map((value) => value * scale);
  const y = reference.yLines.map((value) => value * scale);
  const columnWidths = x.slice(1).map((value, index) => value - x[index]);
  const rowHeights = y.slice(1).map((value, index) => value - y[index]);

  return {
    displayWidth,
    displayHeight,
    gridLeft: x[0],
    gridTop: y[0],
    gridWidth: x[x.length - 1] - x[0],
    gridHeight: y[y.length - 1] - y[0],
    columnWidths,
    rowHeights
  };
}
