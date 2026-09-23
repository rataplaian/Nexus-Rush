import { CARDS } from './cards';
import { MAPS } from './maps';
import { attackModifierForTerrain, blocksLineOfSight, manhattanDistance } from './rules';
import { GameState, PlayerId, Position, UnitCard } from './types';

export type AttackTarget =
  | { kind: 'unit'; id: string }
  | { kind: 'nexus'; index: number };

export interface AttackOption {
  target: AttackTarget;
  position: Position;
}

function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

function getMap(state: GameState) {
  const map = MAPS.find((candidate) => candidate.id === state.mapId);
  if (!map) throw new Error('Mappa non trovata.');
  return map;
}

function lineCells(from: Position, to: Position): Position[] {
  const cells: Position[] = [];
  let x = from.x;
  let y = from.y;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const nx = Math.abs(dx);
  const ny = Math.abs(dy);
  const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
  const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;
  let ix = 0;
  let iy = 0;

  cells.push({ x, y });

  while (ix < nx || iy < ny) {
    const decision = (1 + 2 * ix) * ny - (1 + 2 * iy) * nx;

    if (decision === 0) {
      x += stepX;
      y += stepY;
      ix += 1;
      iy += 1;
    } else if (decision < 0) {
      x += stepX;
      ix += 1;
    } else {
      y += stepY;
      iy += 1;
    }

    cells.push({ x, y });
  }

  return cells;
}

export function hasLineOfSight(state: GameState, from: Position, to: Position): boolean {
  const map = getMap(state);
  const cells = lineCells(from, to);

  for (const position of cells.slice(1, -1)) {
    if (blocksLineOfSight(map.terrain[position.y][position.x])) return false;
  }

  return true;
}

export function attackPowerForUnit(state: GameState, unitId: string): number {
  const unit = state.units.find((candidate) => candidate.instanceId === unitId);
  if (!unit) throw new Error('Unità non trovata.');

  const card = CARDS[unit.cardId];
  if (!card || card.type !== 'unit') throw new Error('Carta unità non valida.');

  const map = getMap(state);
  const terrain = map.terrain[unit.position.y][unit.position.x];
  return (card as UnitCard).attack + attackModifierForTerrain(terrain);
}

function targetPosition(state: GameState, target: AttackTarget): Position | null {
  if (target.kind === 'unit') {
    return state.units.find((unit) => unit.instanceId === target.id)?.position ?? null;
  }

  return state.nexuses[target.index]?.position ?? null;
}

function targetOwner(state: GameState, target: AttackTarget): PlayerId | null {
  if (target.kind === 'unit') {
    return state.units.find((unit) => unit.instanceId === target.id)?.owner ?? null;
  }

  return state.nexuses[target.index]?.owner ?? null;
}

export function validateAttack(
  state: GameState,
  attackerId: string,
  target: AttackTarget
): string[] {
  if (state.winner !== null) return ['La partita è terminata.'];
  if (!state.turnStarted) return ['Il turno non è ancora iniziato.'];

  const attacker = state.units.find((unit) => unit.instanceId === attackerId);
  if (!attacker) return ['Unità attaccante non trovata.'];
  if (attacker.owner !== state.activePlayer) return ['Puoi attaccare solo con le tue unità.'];
  if (attacker.attackedThisTurn) return ['Questa unità ha già attaccato in questo turno.'];

  const card = CARDS[attacker.cardId];
  if (!card || card.type !== 'unit') return ['Carta unità non valida.'];

  const position = targetPosition(state, target);
  const owner = targetOwner(state, target);
  if (!position || owner === null) return ['Bersaglio non trovato.'];
  if (owner === attacker.owner) return ['Non puoi attaccare un bersaglio alleato.'];

  const distance = manhattanDistance(attacker.position, position);
  if (distance > card.range) return ['Bersaglio fuori Range.'];
  if (!hasLineOfSight(state, attacker.position, position)) return ['Linea di vista bloccata.'];

  return [];
}

export function getLegalAttackTargets(state: GameState, attackerId: string): AttackOption[] {
  const attacker = state.units.find((unit) => unit.instanceId === attackerId);
  if (
    !attacker ||
    attacker.owner !== state.activePlayer ||
    attacker.attackedThisTurn ||
    !state.turnStarted ||
    state.winner !== null
  ) {
    return [];
  }

  const options: AttackOption[] = [];

  for (const unit of state.units) {
    if (unit.owner === attacker.owner) continue;
    const target: AttackTarget = { kind: 'unit', id: unit.instanceId };
    if (validateAttack(state, attackerId, target).length === 0) {
      options.push({ target, position: unit.position });
    }
  }

  state.nexuses.forEach((nexus, index) => {
    if (nexus.owner === attacker.owner) return;
    const target: AttackTarget = { kind: 'nexus', index };
    if (validateAttack(state, attackerId, target).length === 0) {
      options.push({ target, position: nexus.position });
    }
  });

  return options;
}

export function attackTarget(
  state: GameState,
  attackerId: string,
  target: AttackTarget
): GameState {
  const errors = validateAttack(state, attackerId, target);
  if (errors.length > 0) throw new Error(errors.join(' '));

  const attacker = state.units.find((unit) => unit.instanceId === attackerId)!;
  const damage = attackPowerForUnit(state, attackerId);

  let units = state.units.map((unit) =>
    unit.instanceId === attackerId
      ? { ...unit, attackedThisTurn: true }
      : unit
  );
  let nexuses = state.nexuses;
  let winner = state.winner;

  if (target.kind === 'unit') {
    units = units
      .map((unit) =>
        unit.instanceId === target.id
          ? { ...unit, life: Math.max(0, unit.life - damage) }
          : unit
      )
      .filter((unit) => unit.life > 0);
  } else {
    const nexus = state.nexuses[target.index];
    nexuses = state.nexuses.map((candidate, index) =>
      index === target.index
        ? { ...candidate, life: Math.max(0, candidate.life - damage) }
        : candidate
    );

    if (nexuses[target.index].life === 0) {
      winner = nexus.owner === 0 ? 1 : 0;
    }
  }

  return {
    ...state,
    units,
    nexuses,
    winner
  };
}

export function attackTargetAtPosition(
  state: GameState,
  attackerId: string,
  position: Position
): AttackTarget | null {
  const enemyUnit = state.units.find(
    (unit) =>
      unit.owner !== state.activePlayer &&
      samePosition(unit.position, position)
  );
  if (enemyUnit) return { kind: 'unit', id: enemyUnit.instanceId };

  const nexusIndex = state.nexuses.findIndex(
    (nexus) =>
      nexus.owner !== state.activePlayer &&
      samePosition(nexus.position, position)
  );
  if (nexusIndex >= 0) return { kind: 'nexus', index: nexusIndex };

  return null;
}
