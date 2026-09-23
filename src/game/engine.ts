import { CARDS } from './cards';
import { MAPS } from './maps';
import { manaIncomeForPersonalTurn, NEXUS_MAX_LIFE, validateNexusPositions } from './rules';
import { GameMode, GameState, PlayerId, Position } from './types';

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
    players: [
      { mana: 0, personalTurn: 0, deckId: player0Deck },
      { mana: 0, personalTurn: 0, deckId: player1Deck }
    ],
    nexuses: [
      ...player0Nexuses.map((position) => ({ owner: 0 as PlayerId, position, life: NEXUS_MAX_LIFE, maxLife: NEXUS_MAX_LIFE })),
      ...player1Nexuses.map((position) => ({ owner: 1 as PlayerId, position, life: NEXUS_MAX_LIFE, maxLife: NEXUS_MAX_LIFE }))
    ],
    units: [],
    structures: [],
    winner: null
  };
}

export function startActivePlayerTurn(state: GameState): GameState {
  if (state.winner !== null) return state;
  const playerIndex = state.activePlayer;
  const players = [...state.players] as GameState['players'];
  const current = players[playerIndex];
  const personalTurn = current.personalTurn + 1;

  players[playerIndex] = {
    ...current,
    personalTurn,
    mana: current.mana + manaIncomeForPersonalTurn(personalTurn)
  };

  return {
    ...state,
    players,
    units: state.units.map((unit) =>
      unit.owner === playerIndex
        ? { ...unit, movedThisTurn: false, attackedThisTurn: false }
        : unit
    )
  };
}

export function endTurn(state: GameState): GameState {
  if (state.winner !== null) return state;
  const nextPlayer: PlayerId = state.activePlayer === 0 ? 1 : 0;
  return {
    ...state,
    activePlayer: nextPlayer,
    round: nextPlayer === 0 ? state.round + 1 : state.round
  };
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
