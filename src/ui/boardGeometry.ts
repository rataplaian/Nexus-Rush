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
  imageWidth: 900,
  imageHeight: 537,
  maxDisplayWidth: 760,
  // Pixel boundaries traced from the visible tile seams of the approved image.
  xLines: [92, 152, 212, 272, 331, 391, 451, 510, 570, 630, 689, 749, 808],
  yLines: [58, 118, 178, 238, 298, 358, 418, 478]
};

const VERTICAL_REFERENCE: BoardReferenceGeometry = {
  imageWidth: 460,
  imageHeight: 790,
  maxDisplayWidth: 460,
  // Pixel boundaries traced from the visible tile seams of the approved image.
  xLines: [70, 116, 162, 208, 254, 300, 346, 392],
  yLines: [82, 134, 186, 238, 290, 342, 394, 446, 498, 550, 602, 654, 706]
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
