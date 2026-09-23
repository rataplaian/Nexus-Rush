import { CARDS } from './cards';
import { MAPS } from './maps';
import { attackModifierForTerrain, blocksLineOfSight, manhattanDistance } from './rules';
import {
  GameState,
  PlayerId,
  Position,
  StructureCard,
  StructureState,
  UnitCard,
  UnitState
} from './types';

export type AttackTarget =
  | { kind: 'unit'; id: string }
  | { kind: 'structure'; id: string }
  | { kind: 'nexus'; index: number };

export interface AttackOption {
  target: AttackTarget;
  position: Position;
}

type Attacker =
  | { kind: 'unit'; unit: UnitState; card: UnitCard }
  | { kind: 'structure'; structure: StructureState; card: StructureCard };

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

function unitAttackRange(unit: UnitState, card: UnitCard): number {
  if (card.id === 'battle_mage' && !unit.movedThisTurn) return card.range + 1;
  return card.range;
}

export function attackPowerForUnit(state: GameState, unitId: string): number {
  const unit = state.units.find((candidate) => candidate.instanceId === unitId);
  if (!unit) throw new Error('Unità non trovata.');

  const card = CARDS[unit.cardId];
  if (!card || card.type !== 'unit') throw new Error('Carta unità non valida.');

  const map = getMap(state);
  const terrain = map.terrain[unit.position.y][unit.position.x];
  let attack = card.attack + attackModifierForTerrain(terrain);

  if (card.id === 'nexus_knight' && unit.cellsMovedThisTurn >= 2) {
    attack += 1;
  }

  return attack;
}

function getUnitAttacker(state: GameState, attackerId: string): Attacker | null {
  const unit = state.units.find((candidate) => candidate.instanceId === attackerId);
  if (!unit) return null;
  const card = CARDS[unit.cardId];
  if (!card || card.type !== 'unit') return null;
  return { kind: 'unit', unit, card };
}

function getStructureAttacker(state: GameState, attackerId: string): Attacker | null {
  const structure = state.structures.find((candidate) => candidate.instanceId === attackerId);
  if (!structure) return null;
  const card = CARDS[structure.cardId];
  if (!card || card.type !== 'structure') return null;
  return { kind: 'structure', structure, card };
}

function attackerOwner(attacker: Attacker): PlayerId {
  return attacker.kind === 'unit' ? attacker.unit.owner : attacker.structure.owner;
}

function attackerPosition(attacker: Attacker): Position {
  return attacker.kind === 'unit' ? attacker.unit.position : attacker.structure.position;
}

function attackerRange(attacker: Attacker): number {
  return attacker.kind === 'unit'
    ? unitAttackRange(attacker.unit, attacker.card)
    : attacker.card.range;
}

function attackerAlreadyAttacked(attacker: Attacker): boolean {
  return attacker.kind === 'unit'
    ? attacker.unit.attackedThisTurn
    : attacker.structure.attackedThisTurn;
}

function attackerDamage(state: GameState, attacker: Attacker): number {
  return attacker.kind === 'unit'
    ? attackPowerForUnit(state, attacker.unit.instanceId)
    : attacker.card.attack;
}

function targetPosition(state: GameState, target: AttackTarget): Position | null {
  if (target.kind === 'unit') {
    return state.units.find((unit) => unit.instanceId === target.id)?.position ?? null;
  }
  if (target.kind === 'structure') {
    return state.structures.find((structure) => structure.instanceId === target.id)?.position ?? null;
  }
  return state.nexuses[target.index]?.position ?? null;
}

function targetOwner(state: GameState, target: AttackTarget): PlayerId | null {
  if (target.kind === 'unit') {
    return state.units.find((unit) => unit.instanceId === target.id)?.owner ?? null;
  }
  if (target.kind === 'structure') {
    return state.structures.find((structure) => structure.instanceId === target.id)?.owner ?? null;
  }
  return state.nexuses[target.index]?.owner ?? null;
}

function rangedDamageReduction(state: GameState, attacker: Attacker, target: AttackTarget): number {
  if (target.kind !== 'unit' || attackerRange(attacker) <= 1) return 0;

  const targetUnit = state.units.find((unit) => unit.instanceId === target.id);
  if (!targetUnit) return 0;

  const protectedByShield = state.units.some(
    (unit) =>
      unit.owner === targetUnit.owner &&
      unit.cardId === 'shield_guardian' &&
      manhattanDistance(unit.position, targetUnit.position) === 1
  );

  return protectedByShield ? 1 : 0;
}

function validateWithAttacker(
  state: GameState,
  attacker: Attacker | null,
  target: AttackTarget
): string[] {
  if (state.winner !== null) return ['La partita è terminata.'];
  if (!state.turnStarted) return ['Il turno non è ancora iniziato.'];
  if (!attacker) return ['Attaccante non trovato.'];
  if (attackerOwner(attacker) !== state.activePlayer) return ['Puoi attaccare solo con i tuoi pezzi.'];
  if (attackerAlreadyAttacked(attacker)) return ['Questo pezzo ha già attaccato in questo turno.'];
  if (attackerRange(attacker) <= 0 || attackerDamage(state, attacker) <= 0) {
    return ['Questo pezzo non può attaccare.'];
  }

  const position = targetPosition(state, target);
  const owner = targetOwner(state, target);
  if (!position || owner === null) return ['Bersaglio non trovato.'];
  if (owner === attackerOwner(attacker)) return ['Non puoi attaccare un bersaglio alleato.'];

  const distance = manhattanDistance(attackerPosition(attacker), position);
  if (distance > attackerRange(attacker)) return ['Bersaglio fuori Range.'];
  if (!hasLineOfSight(state, attackerPosition(attacker), position)) {
    return ['Linea di vista bloccata.'];
  }

  return [];
}

export function validateAttack(
  state: GameState,
  attackerId: string,
  target: AttackTarget
): string[] {
  return validateWithAttacker(state, getUnitAttacker(state, attackerId), target);
}

export function validateStructureAttack(
  state: GameState,
  attackerId: string,
  target: AttackTarget
): string[] {
  return validateWithAttacker(state, getStructureAttacker(state, attackerId), target);
}

function legalTargetsFor(state: GameState, attacker: Attacker | null): AttackOption[] {
  if (!attacker || attackerOwner(attacker) !== state.activePlayer || attackerAlreadyAttacked(attacker)) {
    return [];
  }

  const options: AttackOption[] = [];
  const validate = (target: AttackTarget) => validateWithAttacker(state, attacker, target).length === 0;

  for (const unit of state.units) {
    if (unit.owner === attackerOwner(attacker)) continue;
    const target: AttackTarget = { kind: 'unit', id: unit.instanceId };
    if (validate(target)) options.push({ target, position: unit.position });
  }

  for (const structure of state.structures) {
    if (structure.owner === attackerOwner(attacker)) continue;
    const target: AttackTarget = { kind: 'structure', id: structure.instanceId };
    if (validate(target)) options.push({ target, position: structure.position });
  }

  state.nexuses.forEach((nexus, index) => {
    if (nexus.owner === attackerOwner(attacker)) return;
    const target: AttackTarget = { kind: 'nexus', index };
    if (validate(target)) options.push({ target, position: nexus.position });
  });

  return options;
}

export function getLegalAttackTargets(state: GameState, attackerId: string): AttackOption[] {
  return legalTargetsFor(state, getUnitAttacker(state, attackerId));
}

export function getLegalStructureAttackTargets(state: GameState, attackerId: string): AttackOption[] {
  return legalTargetsFor(state, getStructureAttacker(state, attackerId));
}

function markAttackerUsed(state: GameState, attacker: Attacker): GameState {
  if (attacker.kind === 'unit') {
    return {
      ...state,
      units: state.units.map((unit) =>
        unit.instanceId === attacker.unit.instanceId
          ? { ...unit, attackedThisTurn: true }
          : unit
      )
    };
  }

  return {
    ...state,
    structures: state.structures.map((structure) =>
      structure.instanceId === attacker.structure.instanceId
        ? { ...structure, attackedThisTurn: true }
        : structure
    )
  };
}

function addDiscard(
  state: GameState,
  owner: PlayerId,
  cardId: string
): GameState {
  const players = [...state.players] as GameState['players'];
  players[owner] = {
    ...players[owner],
    discardPile: [...players[owner].discardPile, cardId]
  };
  return { ...state, players };
}

function applyTargetDamage(
  state: GameState,
  attacker: Attacker,
  target: AttackTarget
): { state: GameState; destroyedUnitId: string | null } {
  const rawDamage = attackerDamage(state, attacker);
  const damage = Math.max(0, rawDamage - rangedDamageReduction(state, attacker, target));

  if (target.kind === 'unit') {
    const targetUnit = state.units.find((unit) => unit.instanceId === target.id)!;
    const nextLife = Math.max(0, targetUnit.life - damage);
    let next = {
      ...state,
      units: state.units.map((unit) =>
        unit.instanceId === target.id ? { ...unit, life: nextLife } : unit
      )
    };

    if (
      attacker.kind === 'unit' &&
      attacker.card.id === 'frost_weaver' &&
      nextLife > 0
    ) {
      next = {
        ...next,
        units: next.units.map((unit) =>
          unit.instanceId === target.id
            ? { ...unit, pendingMovementModifier: unit.pendingMovementModifier - 1 }
            : unit
        )
      };
    }

    if (nextLife === 0) {
      next = {
        ...next,
        units: next.units.filter((unit) => unit.instanceId !== target.id)
      };
      next = addDiscard(next, targetUnit.owner, targetUnit.cardId);
      return { state: next, destroyedUnitId: target.id };
    }

    return { state: next, destroyedUnitId: null };
  }

  if (target.kind === 'structure') {
    const targetStructure = state.structures.find(
      (structure) => structure.instanceId === target.id
    )!;
    const nextLife = Math.max(0, targetStructure.life - damage);
    let next = {
      ...state,
      structures: state.structures.map((structure) =>
        structure.instanceId === target.id
          ? { ...structure, life: nextLife }
          : structure
      )
    };

    if (nextLife === 0) {
      next = {
        ...next,
        structures: next.structures.filter(
          (structure) => structure.instanceId !== target.id
        )
      };
      next = addDiscard(next, targetStructure.owner, targetStructure.cardId);
    }

    return { state: next, destroyedUnitId: null };
  }

  const nexus = state.nexuses[target.index];
  const nexuses = state.nexuses.map((candidate, index) =>
    index === target.index
      ? { ...candidate, life: Math.max(0, candidate.life - damage) }
      : candidate
  );

  return {
    state: {
      ...state,
      nexuses,
      winner: nexuses[target.index].life === 0
        ? (nexus.owner === 0 ? 1 : 0)
        : state.winner
    },
    destroyedUnitId: null
  };
}

function maybeHealBastionChampion(
  state: GameState,
  attacker: Attacker,
  destroyedUnitId: string | null
): GameState {
  if (
    !destroyedUnitId ||
    attacker.kind !== 'unit' ||
    attacker.card.id !== 'bastion_champion'
  ) {
    return state;
  }

  return {
    ...state,
    units: state.units.map((unit) =>
      unit.instanceId === attacker.unit.instanceId
        ? { ...unit, life: Math.min(attacker.card.life, unit.life + 2) }
        : unit
    )
  };
}

function performAttack(
  state: GameState,
  attacker: Attacker,
  target: AttackTarget
): GameState {
  let next = markAttackerUsed(state, attacker);
  const damaged = applyTargetDamage(next, attacker, target);
  next = damaged.state;
  next = maybeHealBastionChampion(next, attacker, damaged.destroyedUnitId);
  return next;
}

export function attackTarget(
  state: GameState,
  attackerId: string,
  target: AttackTarget
): GameState {
  const attacker = getUnitAttacker(state, attackerId);
  const errors = validateWithAttacker(state, attacker, target);
  if (errors.length > 0 || !attacker) throw new Error(errors.join(' '));
  return performAttack(state, attacker, target);
}

export function attackWithStructure(
  state: GameState,
  attackerId: string,
  target: AttackTarget
): GameState {
  const attacker = getStructureAttacker(state, attackerId);
  const errors = validateWithAttacker(state, attacker, target);
  if (errors.length > 0 || !attacker) throw new Error(errors.join(' '));
  return performAttack(state, attacker, target);
}

export function attackTargetAtPosition(
  state: GameState,
  attackerOwnerId: PlayerId,
  position: Position
): AttackTarget | null {
  const enemyUnit = state.units.find(
    (unit) =>
      unit.owner !== attackerOwnerId &&
      samePosition(unit.position, position)
  );
  if (enemyUnit) return { kind: 'unit', id: enemyUnit.instanceId };

  const enemyStructure = state.structures.find(
    (structure) =>
      structure.owner !== attackerOwnerId &&
      samePosition(structure.position, position)
  );
  if (enemyStructure) return { kind: 'structure', id: enemyStructure.instanceId };

  const nexusIndex = state.nexuses.findIndex(
    (nexus) =>
      nexus.owner !== attackerOwnerId &&
      samePosition(nexus.position, position)
  );
  if (nexusIndex >= 0) return { kind: 'nexus', index: nexusIndex };

  return null;
}
