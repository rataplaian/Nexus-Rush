import { CARDS } from './cards';
import { canAffordCard, effectiveCardCost, isCellOccupied, payCardCost } from './engine';
import { MAPS } from './maps';
import { blocksMovement, manhattanDistance } from './rules';
import {
  GameState,
  Position,
  SpellCard,
  StructureCard,
  UnitCard
} from './types';

export type SpellCastRequest =
  | { kind: 'damage'; targetUnitId: string }
  | { kind: 'slow'; targetUnitId: string }
  | { kind: 'teleport'; unitId: string; destination: Position }
  | { kind: 'buff-move'; unitIds: string[] }
  | { kind: 'conditional-damage'; targetUnitId: string };

function getMap(state: GameState) {
  const map = MAPS.find((candidate) => candidate.id === state.mapId);
  if (!map) throw new Error('Mappa non trovata.');
  return map;
}

function cardAtHand(state: GameState, handIndex: number) {
  const cardId = state.players[state.activePlayer].hand[handIndex];
  return cardId ? CARDS[cardId] : undefined;
}

function removeHandCardAndDiscard(
  state: GameState,
  handIndex: number,
  cardId: string
): GameState {
  const players = [...state.players] as GameState['players'];
  const player = players[state.activePlayer];
  players[state.activePlayer] = {
    ...player,
    hand: player.hand.filter((_, index) => index !== handIndex),
    discardPile: [...player.discardPile, cardId]
  };
  return { ...state, players };
}

function removeHandCard(
  state: GameState,
  handIndex: number
): GameState {
  const players = [...state.players] as GameState['players'];
  const player = players[state.activePlayer];
  players[state.activePlayer] = {
    ...player,
    hand: player.hand.filter((_, index) => index !== handIndex)
  };
  return { ...state, players };
}

function isInFirstRows(state: GameState, position: Position, rows: number): boolean {
  const map = getMap(state);
  if (state.activePlayer === 0) {
    return position.y >= map.height - rows;
  }
  return position.y < rows;
}

function structurePlacementRange(cardId: string): number | null {
  if (cardId === 'arcane_tower') return 4;
  if (cardId === 'watch_tower') return 3;
  if (cardId === 'nexus_chapel') return 3;
  return null;
}

export function validateStructurePlacement(
  state: GameState,
  handIndex: number,
  position: Position
): string[] {
  if (state.winner !== null) return ['La partita è terminata.'];
  if (!state.turnStarted) return ['Il turno non è ancora iniziato.'];

  const card = cardAtHand(state, handIndex);
  if (!card) return ['Carta della mano non valida.'];
  if (card.type !== 'structure') return ['La carta selezionata non è una Struttura.'];
  if (!canAffordCard(state, card.id)) return ['Mana insufficiente.'];

  const map = getMap(state);
  if (
    position.x < 0 ||
    position.x >= map.width ||
    position.y < 0 ||
    position.y >= map.height
  ) {
    return ['Casella fuori dalla plancia.'];
  }

  if (blocksMovement(map.terrain[position.y][position.x])) {
    return ['La Struttura richiede terreno accessibile.'];
  }

  if (isCellOccupied(state, position)) return ['La casella è già occupata.'];

  if (card.id === 'mana_crystal') {
    return isInFirstRows(state, position, 3)
      ? []
      : ['Il Cristallo del Mana può essere posizionato solo nelle prime 3 righe.'];
  }

  const range = structurePlacementRange(card.id);
  if (range !== null) {
    const nearNexus = state.nexuses.some(
      (nexus) =>
        nexus.owner === state.activePlayer &&
        manhattanDistance(nexus.position, position) <= range
    );
    if (!nearNexus) {
      return ['La Struttura è fuori dal raggio di posizionamento di un tuo Nexus.'];
    }
  }

  return [];
}

export function getLegalStructurePlacementCells(
  state: GameState,
  handIndex: number
): Position[] {
  const card = cardAtHand(state, handIndex);
  if (!card || card.type !== 'structure' || !canAffordCard(state, card.id)) return [];

  const map = getMap(state);
  const positions: Position[] = [];

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const position = { x, y };
      if (validateStructurePlacement(state, handIndex, position).length === 0) {
        positions.push(position);
      }
    }
  }

  return positions;
}

export function placeStructure(
  state: GameState,
  handIndex: number,
  position: Position
): GameState {
  const errors = validateStructurePlacement(state, handIndex, position);
  if (errors.length > 0) throw new Error(errors.join(' '));

  const owner = state.activePlayer;
  const cardId = state.players[owner].hand[handIndex];
  const card = CARDS[cardId] as StructureCard;
  let next = payCardCost(state, cardId);
  next = removeHandCard(next, handIndex);

  return {
    ...next,
    structures: [
      ...next.structures,
      {
        instanceId: 'structure-' + next.nextInstanceId,
        owner,
        cardId,
        position,
        life: card.life,
        attackedThisTurn: false,
        deployedOnPersonalTurn: next.players[owner].personalTurn
      }
    ],
    nextInstanceId: next.nextInstanceId + 1
  };
}

export function legalTeleportDestinations(
  state: GameState,
  unitId: string
): Position[] {
  const unit = state.units.find(
    (candidate) =>
      candidate.instanceId === unitId &&
      candidate.owner === state.activePlayer
  );
  if (!unit) return [];

  const map = getMap(state);
  const positions: Position[] = [];

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const position = { x, y };
      if (manhattanDistance(unit.position, position) > 3) continue;
      if (manhattanDistance(unit.position, position) === 0) continue;
      if (blocksMovement(map.terrain[y][x])) continue;
      if (isCellOccupied(state, position)) continue;
      positions.push(position);
    }
  }

  return positions;
}

function legalSpellRequest(
  state: GameState,
  card: SpellCard,
  request: SpellCastRequest
): boolean {
  if (card.effect !== request.kind) return false;

  if (
    request.kind === 'damage' ||
    request.kind === 'slow' ||
    request.kind === 'conditional-damage'
  ) {
    return state.units.some(
      (unit) =>
        unit.instanceId === request.targetUnitId &&
        unit.owner !== state.activePlayer
    );
  }

  if (request.kind === 'teleport') {
    return legalTeleportDestinations(state, request.unitId).some(
      (position) =>
        position.x === request.destination.x &&
        position.y === request.destination.y
    );
  }

  if (request.kind === 'buff-move') {
    if (request.unitIds.length < 1 || request.unitIds.length > 3) return false;
    if (new Set(request.unitIds).size !== request.unitIds.length) return false;
    return request.unitIds.every((unitId) =>
      state.units.some(
        (unit) =>
          unit.instanceId === unitId &&
          unit.owner === state.activePlayer &&
          !unit.movedThisTurn
      )
    );
  }

  return false;
}

export function validateSpellCast(
  state: GameState,
  handIndex: number,
  request: SpellCastRequest
): string[] {
  if (state.winner !== null) return ['La partita è terminata.'];
  if (!state.turnStarted) return ['Il turno non è ancora iniziato.'];

  const card = cardAtHand(state, handIndex);
  if (!card) return ['Carta della mano non valida.'];
  if (card.type !== 'spell') return ['La carta selezionata non è una Magia.'];
  if (!canAffordCard(state, card.id)) return ['Mana insufficiente.'];
  if (!legalSpellRequest(state, card, request)) return ['Bersaglio della Magia non valido.'];

  return [];
}

function damageEnemyUnit(
  state: GameState,
  unitId: string,
  damage: number
): GameState {
  const target = state.units.find((unit) => unit.instanceId === unitId);
  if (!target) return state;

  const nextLife = Math.max(0, target.life - damage);
  let next = {
    ...state,
    units: state.units.map((unit) =>
      unit.instanceId === unitId ? { ...unit, life: nextLife } : unit
    )
  };

  if (nextLife === 0) {
    next = {
      ...next,
      units: next.units.filter((unit) => unit.instanceId !== unitId)
    };

    const players = [...next.players] as GameState['players'];
    players[target.owner] = {
      ...players[target.owner],
      discardPile: [...players[target.owner].discardPile, target.cardId]
    };
    next = { ...next, players };
  }

  return next;
}

function holyPunishmentDamage(state: GameState, targetUnitId: string): number {
  const target = state.units.find((unit) => unit.instanceId === targetUnitId);
  if (!target) return 2;

  const adjacentPaladin = state.units.some((unit) => {
    if (unit.owner !== state.activePlayer) return false;
    const card = CARDS[unit.cardId];
    return (
      card?.type === 'unit' &&
      card.tags?.includes('paladin') === true &&
      manhattanDistance(unit.position, target.position) === 1
    );
  });

  return adjacentPaladin ? 4 : 2;
}

export function castSpell(
  state: GameState,
  handIndex: number,
  request: SpellCastRequest
): GameState {
  const errors = validateSpellCast(state, handIndex, request);
  if (errors.length > 0) throw new Error(errors.join(' '));

  const cardId = state.players[state.activePlayer].hand[handIndex];
  const card = CARDS[cardId] as SpellCard;
  let next = payCardCost(state, cardId);

  if (request.kind === 'damage') {
    next = damageEnemyUnit(next, request.targetUnitId, card.value);
  } else if (request.kind === 'slow') {
    next = {
      ...next,
      units: next.units.map((unit) =>
        unit.instanceId === request.targetUnitId
          ? {
              ...unit,
              pendingMovementModifier:
                unit.pendingMovementModifier - card.value
            }
          : unit
      )
    };
  } else if (request.kind === 'teleport') {
    next = {
      ...next,
      units: next.units.map((unit) =>
        unit.instanceId === request.unitId
          ? { ...unit, position: request.destination }
          : unit
      )
    };
  } else if (request.kind === 'buff-move') {
    const selected = new Set(request.unitIds);
    next = {
      ...next,
      units: next.units.map((unit) =>
        selected.has(unit.instanceId)
          ? {
              ...unit,
              movementModifierThisTurn:
                unit.movementModifierThisTurn + card.value
            }
          : unit
      )
    };
  } else if (request.kind === 'conditional-damage') {
    next = damageEnemyUnit(
      next,
      request.targetUnitId,
      holyPunishmentDamage(next, request.targetUnitId)
    );
  }

  return removeHandCardAndDiscard(next, handIndex, cardId);
}

export function effectiveDisplayedCardCost(
  state: GameState,
  handIndex: number
): number | null {
  const card = cardAtHand(state, handIndex);
  return card ? effectiveCardCost(state, card.id) : null;
}
