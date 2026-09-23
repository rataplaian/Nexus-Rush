import { CARDS } from './cards';
import { MAPS } from './maps';
import { blocksMovement, movementCost } from './rules';
import { GameState, Position, UnitCard } from './types';

export interface MovementOption {
  position: Position;
  path: Position[];
  movementSpent: number;
  remainingMovement: number;
}

interface SearchNode {
  position: Position;
  path: Position[];
  remainingMovement: number;
}

function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

function positionKey(position: Position): string {
  return position.x + ',' + position.y;
}

function getMap(state: GameState) {
  const map = MAPS.find((candidate) => candidate.id === state.mapId);
  if (!map) throw new Error('Mappa non trovata.');
  return map;
}

function isBlockedByPiece(state: GameState, position: Position, movingUnitId: string): boolean {
  if (state.nexuses.some((nexus) => samePosition(nexus.position, position))) return true;
  if (state.structures.some((structure) => samePosition(structure.position, position))) return true;
  return state.units.some(
    (unit) => unit.instanceId !== movingUnitId && samePosition(unit.position, position)
  );
}

function orthogonalNeighbors(position: Position, width: number, height: number): Position[] {
  const candidates = [
    { x: position.x + 1, y: position.y },
    { x: position.x - 1, y: position.y },
    { x: position.x, y: position.y + 1 },
    { x: position.x, y: position.y - 1 }
  ];

  return candidates.filter(
    (candidate) =>
      candidate.x >= 0 &&
      candidate.x < width &&
      candidate.y >= 0 &&
      candidate.y < height
  );
}

export function effectiveMovementForUnit(state: GameState, unitId: string): number {
  const unit = state.units.find((candidate) => candidate.instanceId === unitId);
  if (!unit) throw new Error('Unità non trovata.');

  const card = CARDS[unit.cardId];
  if (!card || card.type !== 'unit') throw new Error('Carta unità non valida.');

  return Math.max(0, card.movement + unit.movementModifierThisTurn);
}

function stepCost(
  card: UnitCard,
  from: ReturnType<typeof getMap>['terrain'][number][number],
  to: ReturnType<typeof getMap>['terrain'][number][number],
  remainingMovement: number
): number {
  if (card.id === 'arcane_elemental' && to === 'hill' && from !== 'hill') {
    return 1;
  }
  return movementCost(from, to, remainingMovement);
}

export function getReachableMovement(state: GameState, unitId: string): MovementOption[] {
  if (state.winner !== null || !state.turnStarted) return [];

  const unit = state.units.find((candidate) => candidate.instanceId === unitId);
  if (!unit || unit.owner !== state.activePlayer || unit.movedThisTurn) return [];

  const card = CARDS[unit.cardId];
  if (!card || card.type !== 'unit') return [];

  const unitCard = card as UnitCard;
  const movement = effectiveMovementForUnit(state, unitId);
  if (movement <= 0) return [];

  const map = getMap(state);
  const start = unit.position;
  const bestRemaining = new Map<string, number>([[positionKey(start), movement]]);
  const bestOptions = new Map<string, MovementOption>();
  const frontier: SearchNode[] = [
    {
      position: start,
      path: [start],
      remainingMovement: movement
    }
  ];

  while (frontier.length > 0) {
    const current = frontier.shift()!;
    const currentTerrain = map.terrain[current.position.y][current.position.x];

    for (const next of orthogonalNeighbors(current.position, map.width, map.height)) {
      const nextTerrain = map.terrain[next.y][next.x];
      if (blocksMovement(nextTerrain)) continue;
      if (isBlockedByPiece(state, next, unitId)) continue;

      const cost = stepCost(unitCard, currentTerrain, nextTerrain, current.remainingMovement);
      if (!Number.isFinite(cost) || cost > current.remainingMovement) continue;

      const nextRemaining = current.remainingMovement - cost;
      const key = positionKey(next);
      const previousBest = bestRemaining.get(key);

      if (previousBest !== undefined && previousBest >= nextRemaining) continue;

      const path = [...current.path, next];
      bestRemaining.set(key, nextRemaining);
      bestOptions.set(key, {
        position: next,
        path,
        movementSpent: movement - nextRemaining,
        remainingMovement: nextRemaining
      });
      frontier.push({
        position: next,
        path,
        remainingMovement: nextRemaining
      });
    }
  }

  bestOptions.delete(positionKey(start));

  return Array.from(bestOptions.values()).sort((a, b) =>
    a.position.y === b.position.y
      ? a.position.x - b.position.x
      : a.position.y - b.position.y
  );
}

export function validateUnitMove(
  state: GameState,
  unitId: string,
  destination: Position
): string[] {
  if (state.winner !== null) return ['La partita è terminata.'];
  if (!state.turnStarted) return ['Il turno non è ancora iniziato.'];

  const unit = state.units.find((candidate) => candidate.instanceId === unitId);
  if (!unit) return ['Unità non trovata.'];
  if (unit.owner !== state.activePlayer) return ['Puoi muovere solo le tue unità nel tuo turno.'];
  if (unit.movedThisTurn) return ['Questa unità si è già mossa in questo turno.'];
  if (samePosition(unit.position, destination)) return ['Scegli una casella diversa.'];

  const option = getReachableMovement(state, unitId).find((candidate) =>
    samePosition(candidate.position, destination)
  );

  return option ? [] : ['La destinazione non è raggiungibile con il Movimento disponibile.'];
}

export function moveUnit(state: GameState, unitId: string, destination: Position): GameState {
  const errors = validateUnitMove(state, unitId, destination);
  if (errors.length > 0) throw new Error(errors.join(' '));

  const option = getReachableMovement(state, unitId).find((candidate) =>
    samePosition(candidate.position, destination)
  );

  if (!option) throw new Error('Percorso di movimento non trovato.');

  return {
    ...state,
    units: state.units.map((unit) =>
      unit.instanceId === unitId
        ? {
            ...unit,
            position: destination,
            movedThisTurn: true,
            cellsMovedThisTurn: option.path.length - 1
          }
        : unit
    )
  };
}
