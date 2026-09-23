import { CARDS, STARTER_DECKS } from './cards';
import { MAPS } from './maps';
import {
  blocksMovement,
  deploymentRowsForPlayer,
  HAND_SIZE,
  manaIncomeForPersonalTurn,
  NEXUS_MAX_LIFE,
  validateNexusPositions
} from './rules';
import {
  DeckDefinition,
  GameMode,
  GameState,
  PlayerId,
  PlayerState,
  Position,
  UnitCard
} from './types';

function getDeck(deckId: string): DeckDefinition {
  const deck = STARTER_DECKS.find((candidate) => candidate.id === deckId);
  if (!deck) throw new Error('Mazzo non trovato: ' + deckId);
  return deck;
}

function spreadDuplicateCards(cardIds: string[]): string[] {
  const unique: string[] = [];
  const counts = new Map<string, number>();

  for (const cardId of cardIds) {
    if (!counts.has(cardId)) unique.push(cardId);
    counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
  }

  const maxCopies = Math.max(...counts.values());
  const result: string[] = [];

  for (let pass = 0; pass < maxCopies; pass += 1) {
    for (const cardId of unique) {
      if ((counts.get(cardId) ?? 0) > pass) result.push(cardId);
    }
  }

  return result;
}

function createPlayerState(deckId: string): PlayerState {
  const deck = getDeck(deckId);
  const orderedDeck = spreadDuplicateCards(deck.cardIds);

  return {
    mana: 0,
    personalTurn: 0,
    deckId,
    hand: orderedDeck.slice(0, HAND_SIZE),
    drawPile: orderedDeck.slice(HAND_SIZE),
    discardPile: []
  };
}

function refillHand(player: PlayerState): PlayerState {
  const missing = Math.max(0, HAND_SIZE - player.hand.length);
  const drawCount = Math.min(missing, player.drawPile.length);

  if (drawCount === 0) return player;

  return {
    ...player,
    hand: [...player.hand, ...player.drawPile.slice(0, drawCount)],
    drawPile: player.drawPile.slice(drawCount)
  };
}

export function createGame(
  mode: GameMode,
  player0Nexuses: Position[],
  player1Nexuses: Position[],
  player0Deck = 'arcane',
  player1Deck = 'bastion'
): GameState {
  const map = MAPS.find((candidate) => candidate.mode === mode);
  if (!map) throw new Error('Mappa non trovata per la modalità.');

  const p0Errors = validateNexusPositions(map, 0, player0Nexuses);
  const p1Errors = validateNexusPositions(map, 1, player1Nexuses);
  const allErrors = [...p0Errors, ...p1Errors];
  if (allErrors.length) throw new Error(allErrors.join(' '));

  return {
    mode,
    mapId: map.id,
    activePlayer: 0,
    round: 1,
    turnStarted: false,
    players: [
      createPlayerState(player0Deck),
      createPlayerState(player1Deck)
    ],
    nexuses: [
      ...player0Nexuses.map((position) => ({ owner: 0 as PlayerId, position, life: NEXUS_MAX_LIFE, maxLife: NEXUS_MAX_LIFE })),
      ...player1Nexuses.map((position) => ({ owner: 1 as PlayerId, position, life: NEXUS_MAX_LIFE, maxLife: NEXUS_MAX_LIFE }))
    ],
    units: [],
    structures: [],
    nextInstanceId: 1,
    winner: null
  };
}

export function startActivePlayerTurn(state: GameState): GameState {
  if (state.winner !== null || state.turnStarted) return state;

  const playerIndex = state.activePlayer;
  const players = [...state.players] as GameState['players'];
  const current = players[playerIndex];
  const personalTurn = current.personalTurn + 1;

  players[playerIndex] = refillHand({
    ...current,
    personalTurn,
    mana: current.mana + manaIncomeForPersonalTurn(personalTurn)
  });

  return {
    ...state,
    turnStarted: true,
    players,
    units: state.units.map((unit) =>
      unit.owner === playerIndex
        ? { ...unit, movedThisTurn: false, cellsMovedThisTurn: 0, attackedThisTurn: false }
        : unit
    )
  };
}

export function endTurn(state: GameState): GameState {
  if (state.winner !== null || !state.turnStarted) return state;

  const nextPlayer: PlayerId = state.activePlayer === 0 ? 1 : 0;
  return {
    ...state,
    activePlayer: nextPlayer,
    round: nextPlayer === 0 ? state.round + 1 : state.round,
    turnStarted: false
  };
}

export function startNextTurn(state: GameState): GameState {
  return startActivePlayerTurn(endTurn(state));
}

export function damageNexus(state: GameState, nexusIndex: number, amount: number): GameState {
  if (amount <= 0 || state.winner !== null) return state;
  const target = state.nexuses[nexusIndex];
  if (!target) throw new Error('Nexus non trovato.');

  const nexuses = state.nexuses.map((nexus, index) =>
    index === nexusIndex ? { ...nexus, life: Math.max(0, nexus.life - amount) } : nexus
  );

  const destroyed = nexuses[nexusIndex].life === 0;
  return {
    ...state,
    nexuses,
    winner: destroyed ? (target.owner === 0 ? 1 : 0) : null
  };
}

export function canAffordCard(state: GameState, cardId: string): boolean {
  const card = CARDS[cardId];
  if (!card) return false;
  return state.players[state.activePlayer].mana >= card.cost;
}

export function payCardCost(state: GameState, cardId: string): GameState {
  const card = CARDS[cardId];
  if (!card) throw new Error('Carta sconosciuta.');
  if (!canAffordCard(state, cardId)) throw new Error('Mana insufficiente.');

  const players = [...state.players] as GameState['players'];
  const current = players[state.activePlayer];
  players[state.activePlayer] = { ...current, mana: current.mana - card.cost };
  return { ...state, players };
}

function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

export function isCellOccupied(state: GameState, position: Position): boolean {
  return (
    state.nexuses.some((nexus) => samePosition(nexus.position, position)) ||
    state.units.some((unit) => samePosition(unit.position, position)) ||
    state.structures.some((structure) => samePosition(structure.position, position))
  );
}

export function validateUnitDeployment(
  state: GameState,
  handIndex: number,
  position: Position
): string[] {
  const errors: string[] = [];

  if (state.winner !== null) return ['La partita è terminata.'];
  if (!state.turnStarted) errors.push('Il turno non è ancora iniziato.');

  const player = state.players[state.activePlayer];
  const cardId = player.hand[handIndex];
  const card = cardId ? CARDS[cardId] : undefined;

  if (!card) {
    errors.push('Carta della mano non valida.');
    return errors;
  }

  if (card.type !== 'unit') errors.push('Solo le unità possono essere schierate con questa azione.');
  if (player.mana < card.cost) errors.push('Mana insufficiente.');

  const map = MAPS.find((candidate) => candidate.id === state.mapId);
  if (!map) {
    errors.push('Mappa non trovata.');
    return errors;
  }

  if (position.x < 0 || position.x >= map.width || position.y < 0 || position.y >= map.height) {
    errors.push('Casella fuori dalla plancia.');
    return errors;
  }

  if (!deploymentRowsForPlayer(map, state.activePlayer).includes(position.y)) {
    errors.push('Le unità possono essere schierate solo nelle prime 2 righe del proprio lato.');
  }

  if (blocksMovement(map.terrain[position.y][position.x])) {
    errors.push('Il terreno non è accessibile.');
  }

  if (isCellOccupied(state, position)) {
    errors.push('La casella è già occupata.');
  }

  return errors;
}

export function getLegalUnitDeploymentCells(state: GameState, handIndex: number): Position[] {
  const player = state.players[state.activePlayer];
  const cardId = player.hand[handIndex];
  const card = cardId ? CARDS[cardId] : undefined;
  const map = MAPS.find((candidate) => candidate.id === state.mapId);

  if (!card || card.type !== 'unit' || !map || !state.turnStarted || player.mana < card.cost) return [];

  const cells: Position[] = [];
  for (const y of deploymentRowsForPlayer(map, state.activePlayer)) {
    for (let x = 0; x < map.width; x += 1) {
      const position = { x, y };
      if (validateUnitDeployment(state, handIndex, position).length === 0) cells.push(position);
    }
  }
  return cells;
}

export function deployUnit(state: GameState, handIndex: number, position: Position): GameState {
  const errors = validateUnitDeployment(state, handIndex, position);
  if (errors.length) throw new Error(errors.join(' '));

  const playerIndex = state.activePlayer;
  const players = [...state.players] as GameState['players'];
  const current = players[playerIndex];
  const cardId = current.hand[handIndex];
  const card = CARDS[cardId] as UnitCard;

  players[playerIndex] = {
    ...current,
    mana: current.mana - card.cost,
    hand: current.hand.filter((_, index) => index !== handIndex)
  };

  return {
    ...state,
    players,
    units: [
      ...state.units,
      {
        instanceId: 'unit-' + state.nextInstanceId,
        owner: playerIndex,
        cardId,
        position,
        life: card.life,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false
      }
    ],
    nextInstanceId: state.nextInstanceId + 1
  };
}
