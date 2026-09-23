import { GameMode, MapDefinition, PlayerId, Position, TerrainType } from './types';

export const NEXUS_MAX_LIFE = 10;
export const MAX_CARD_COPIES = 2;
export const DECK_SIZE = 20;

export function manaIncomeForPersonalTurn(personalTurn: number): number {
  if (personalTurn < 1) return 0;
  return 2 + Math.floor((personalTurn - 1) / 5);
}

export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function isOrthogonalStep(a: Position, b: Position): boolean {
  return manhattanDistance(a, b) === 1;
}

export function blocksMovement(terrain: TerrainType): boolean {
  return terrain === 'water' || terrain === 'mountain';
}

export function blocksLineOfSight(terrain: TerrainType): boolean {
  return terrain === 'mountain';
}

export function attackModifierForTerrain(terrain: TerrainType): number {
  return terrain === 'hill' ? 1 : 0;
}

export function movementCost(from: TerrainType, to: TerrainType, remainingMovement: number): number {
  if (blocksMovement(to)) return Number.POSITIVE_INFINITY;
  if (from !== 'hill' && to === 'hill') return Math.min(2, Math.max(1, remainingMovement));
  if (from === 'hill' && to !== 'hill') return 0;
  return 1;
}

export function deploymentRowsForPlayer(map: MapDefinition, player: PlayerId): number[] {
  if (player === 0) {
    return Array.from({ length: map.deploymentRows }, (_, index) => map.height - 1 - index);
  }
  return Array.from({ length: map.deploymentRows }, (_, index) => index);
}

export function isLegalNexusCell(map: MapDefinition, player: PlayerId, position: Position): boolean {
  if (position.x < 0 || position.x >= map.width || position.y < 0 || position.y >= map.height) return false;
  if (!deploymentRowsForPlayer(map, player).includes(position.y)) return false;
  if (blocksMovement(map.terrain[position.y][position.x])) return false;

  if (map.mode === 'vertical-single-nexus') {
    const isCornerColumn = position.x === 0 || position.x === map.width - 1;
    const isOuterDeploymentRow = player === 0 ? position.y === map.height - 1 : position.y === 0;
    if (isCornerColumn && isOuterDeploymentRow) return false;
  }

  return true;
}

export function validateNexusPositions(
  map: MapDefinition,
  player: PlayerId,
  positions: Position[]
): string[] {
  const errors: string[] = [];
  const expected = map.mode === 'horizontal-dual-nexus' ? 2 : 1;

  if (positions.length !== expected) {
    errors.push('Numero di Nexus non valido per questa modalità.');
    return errors;
  }

  for (const pos of positions) {
    if (!isLegalNexusCell(map, player, pos)) errors.push('Posizione Nexus non valida.');
  }

  if (map.mode === 'horizontal-dual-nexus') {
    const [a, b] = positions;
    const half = map.width / 2;
    const hasLeft = a.x < half || b.x < half;
    const hasRight = a.x >= half || b.x >= half;
    if (!hasLeft || !hasRight) errors.push('Serve un Nexus nella metà sinistra e uno nella metà destra.');
    if (a.y === b.y) errors.push('I due Nexus non possono essere sulla stessa riga.');
    if (manhattanDistance(a, b) < 5) errors.push('I due Nexus devono distare almeno 5 caselle.');
  }

  return errors;
}

export function modeLabel(mode: GameMode): string {
  return mode === 'horizontal-dual-nexus' ? 'Fronte Orizzontale' : 'Assalto Verticale';
}
