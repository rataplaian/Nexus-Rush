import { castSpell, getLegalStructurePlacementCells, legalTeleportDestinations, placeStructure } from './actions';
import { CARDS } from './cards';
import {
  attackTarget,
  attackWithStructure,
  getLegalAttackTargets,
  getLegalStructureAttackTargets
} from './combat';
import { deployUnit, getLegalUnitDeploymentCells } from './engine';
import { MAPS } from './maps';
import { getReachableMovement, moveUnit } from './movement';
import {
  attackModifierForTerrain,
  blocksMovement,
  isLegalNexusCell,
  manhattanDistance,
  validateNexusPositions
} from './rules';
import {
  CardDefinition,
  GameState,
  MapDefinition,
  PlayerId,
  Position,
  StructureCard,
  UnitCard
} from './types';

export type AIDifficulty = 'challenging';

export interface AITurnResult {
  state: GameState;
  actions: string[];
}

interface Candidate {
  score: number;
  label: string;
  apply: (state: GameState) => GameState;
}

const AI_PLAYER: PlayerId = 1;
const HUMAN_PLAYER: PlayerId = 0;
const WIN_SCORE = 100000;

function getMap(state: GameState): MapDefinition {
  const map = MAPS.find((candidate) => candidate.id === state.mapId);
  if (!map) throw new Error('Mappa AI non trovata.');
  return map;
}

function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

function unitCardValue(card: UnitCard): number {
  let ability = 0;
  if (card.id === 'archmage') ability = 4;
  else if (card.id === 'shield_guardian') ability = 3;
  else if (card.id === 'frost_weaver') ability = 2.5;
  else if (card.id === 'nexus_knight') ability = 2;
  else if (card.id === 'bastion_champion') ability = 3;
  else if (card.id === 'battle_mage') ability = 1.5;
  else if (card.id === 'arcane_elemental') ability = 1.5;

  return (
    card.life * 0.75 +
    card.attack * 2.1 +
    card.range * 0.85 +
    card.movement * 0.65 +
    ability
  );
}

function structureCardValue(card: StructureCard): number {
  let utility = 0;
  if (card.id === 'mana_crystal') utility = 7;
  else if (card.id === 'nexus_chapel') utility = 5;
  return card.life * 0.45 + card.attack * 1.8 + card.range * 0.55 + utility;
}

function cardPotential(card: CardDefinition): number {
  if (card.type === 'unit') return unitCardValue(card) * 0.25;
  if (card.type === 'structure') return structureCardValue(card) * 0.22;
  return card.cost * 0.8 + card.value * 0.45;
}

function nearestNexusDistance(state: GameState, position: Position, owner: PlayerId): number {
  const targets = state.nexuses.filter((nexus) => nexus.owner === owner);
  return Math.min(...targets.map((nexus) => manhattanDistance(position, nexus.position)));
}

function nearestEnemyUnitDistance(state: GameState, position: Position, owner: PlayerId): number {
  const targets = state.units.filter((unit) => unit.owner !== owner);
  if (targets.length === 0) return 99;
  return Math.min(...targets.map((unit) => manhattanDistance(position, unit.position)));
}

function enemyPressureOnNexus(state: GameState, owner: PlayerId): number {
  const nexuses = state.nexuses.filter((nexus) => nexus.owner === owner);
  let pressure = 0;

  for (const enemy of state.units.filter((unit) => unit.owner !== owner)) {
    const card = CARDS[enemy.cardId];
    if (!card || card.type !== 'unit') continue;
    const distance = Math.min(
      ...nexuses.map((nexus) => manhattanDistance(enemy.position, nexus.position))
    );
    if (distance <= 2) pressure += 7 + card.attack * 2;
    else if (distance <= 4) pressure += 3 + card.attack;
    else if (distance <= 6) pressure += 1;
  }

  return pressure;
}

function piecePositionalValue(
  state: GameState,
  unitId: string,
  perspective: PlayerId
): number {
  const unit = state.units.find((candidate) => candidate.instanceId === unitId);
  if (!unit) return 0;
  const card = CARDS[unit.cardId];
  if (!card || card.type !== 'unit') return 0;

  const map = getMap(state);
  const enemy: PlayerId = perspective === 0 ? 1 : 0;
  const nexusDistance = nearestNexusDistance(state, unit.position, enemy);
  const enemyDistance = nearestEnemyUnitDistance(state, unit.position, perspective);
  const terrain = map.terrain[unit.position.y][unit.position.x];

  let score = -nexusDistance * (card.range <= 1 ? 1.15 : 0.72);
  if (terrain === 'hill') score += 2.2 + attackModifierForTerrain(terrain);

  if (card.range > 1) {
    const desired = Math.max(2, card.range - 1);
    score -= Math.abs(enemyDistance - desired) * 0.35;
  }

  const ownThreat = enemyPressureOnNexus(state, perspective);
  if (ownThreat > 6) {
    const ownNexusDistance = nearestNexusDistance(state, unit.position, perspective);
    score -= ownNexusDistance * 0.45;
  }

  return score;
}

function exposedRisk(state: GameState, unitId: string): number {
  const unit = state.units.find((candidate) => candidate.instanceId === unitId);
  if (!unit) return 0;

  let risk = 0;
  for (const enemy of state.units.filter((candidate) => candidate.owner !== unit.owner)) {
    const card = CARDS[enemy.cardId];
    if (!card || card.type !== 'unit') continue;

    const distance = manhattanDistance(enemy.position, unit.position);
    const reach = card.range + (enemy.movedThisTurn ? 0 : Math.max(0, card.movement + enemy.movementModifierThisTurn));
    if (distance <= card.range) risk += card.attack * 1.4;
    else if (distance <= reach) risk += card.attack * 0.55;
  }

  return risk;
}

export function evaluateState(state: GameState, perspective: PlayerId = AI_PLAYER): number {
  const enemy: PlayerId = perspective === 0 ? 1 : 0;

  if (state.winner === perspective) return WIN_SCORE;
  if (state.winner === enemy) return -WIN_SCORE;

  let score = 0;

  for (const nexus of state.nexuses) {
    const sign = nexus.owner === perspective ? 1 : -1;
    score += sign * nexus.life * 14;
    score += sign * (nexus.life / nexus.maxLife) * 8;
  }

  for (const unit of state.units) {
    const card = CARDS[unit.cardId];
    if (!card || card.type !== 'unit') continue;
    const sign = unit.owner === perspective ? 1 : -1;
    const material = unitCardValue(card) * (0.45 + 0.55 * (unit.life / card.life));
    score += sign * material;
    score += sign * piecePositionalValue(state, unit.instanceId, unit.owner);

    const risk = exposedRisk(state, unit.instanceId);
    score -= sign * risk * (unit.life <= card.attack ? 0.8 : 0.3);
  }

  for (const structure of state.structures) {
    const card = CARDS[structure.cardId];
    if (!card || card.type !== 'structure') continue;
    const sign = structure.owner === perspective ? 1 : -1;
    score += sign * structureCardValue(card) * (0.5 + 0.5 * (structure.life / card.life));
  }

  const own = state.players[perspective];
  const foe = state.players[enemy];
  score += own.mana * 0.55 - foe.mana * 0.4;
  score += own.hand.reduce((sum, id) => sum + cardPotential(CARDS[id]), 0);
  score -= foe.hand.reduce((sum, id) => sum + cardPotential(CARDS[id]), 0) * 0.75;

  score -= enemyPressureOnNexus(state, perspective) * 1.3;
  score += enemyPressureOnNexus(state, enemy) * 0.9;

  return score;
}

function scoreDefensiveNexusCell(map: MapDefinition, position: Position, player: PlayerId): number {
  let score = 0;
  const directions = [
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
  ];

  let blocked = 0;
  let hills = 0;
  let plains = 0;

  for (const direction of directions) {
    const x = position.x + direction.x;
    const y = position.y + direction.y;
    if (x < 0 || x >= map.width || y < 0 || y >= map.height) {
      blocked += 1;
      continue;
    }

    const terrain = map.terrain[y][x];
    if (terrain === 'mountain' || terrain === 'water') blocked += 1;
    else if (terrain === 'hill') hills += 1;
    else plains += 1;
  }

  score += blocked * 2.8 + hills * 1.3 + plains * 0.25;

  const backRow = player === 0 ? map.height - 1 : 0;
  score += Math.max(0, 2 - Math.abs(position.y - backRow)) * 1.1;

  const centerX = (map.width - 1) / 2;
  score -= Math.abs(position.x - centerX) * 0.08;

  if (blocked >= 3) score -= 2.5;
  return score;
}

export function chooseAINexusPositions(
  map: MapDefinition,
  player: PlayerId = AI_PLAYER
): Position[] {
  const legal: Position[] = [];

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const position = { x, y };
      if (isLegalNexusCell(map, player, position)) legal.push(position);
    }
  }

  if (map.mode === 'vertical-single-nexus') {
    return legal
      .map((position) => ({ position, score: scoreDefensiveNexusCell(map, position, player) }))
      .sort((a, b) => b.score - a.score || a.position.x - b.position.x)[0]
      ? [legal
          .map((position) => ({ position, score: scoreDefensiveNexusCell(map, position, player) }))
          .sort((a, b) => b.score - a.score || a.position.x - b.position.x)[0].position]
      : [];
  }

  let best: { positions: Position[]; score: number } | null = null;

  for (let a = 0; a < legal.length; a += 1) {
    for (let b = a + 1; b < legal.length; b += 1) {
      const positions = [legal[a], legal[b]];
      if (validateNexusPositions(map, player, positions).length > 0) continue;

      const separation = manhattanDistance(positions[0], positions[1]);
      const score =
        scoreDefensiveNexusCell(map, positions[0], player) +
        scoreDefensiveNexusCell(map, positions[1], player) +
        Math.min(separation, 9) * 0.35;

      if (!best || score > best.score) best = { positions, score };
    }
  }

  return best?.positions ?? [];
}

function bestAttackForUnit(state: GameState, unitId: string): Candidate | null {
  const options = getLegalAttackTargets(state, unitId);
  if (options.length === 0) return null;

  let best: Candidate | null = null;
  for (const option of options) {
    const target = option.target;
    const next = attackTarget(state, unitId, target);
    let score = evaluateState(next);

    if (target.kind === 'unit') {
      const targetId = target.id;
      const before = state.units.find((unit) => unit.instanceId === targetId);
      const survives = next.units.some((unit) => unit.instanceId === targetId);
      if (before && !survives) {
        const targetCard = CARDS[before.cardId];
        score += 18 + (targetCard.type === 'unit' ? unitCardValue(targetCard) * 0.65 : 0);
      }
    }

    if (target.kind === 'structure') {
      const targetId = target.id;
      const destroyed = !next.structures.some((structure) => structure.instanceId === targetId);
      if (destroyed) score += 14;
    }

    if (target.kind === 'nexus') score += 18;
    if (next.winner === AI_PLAYER) score += WIN_SCORE;

    const candidate: Candidate = {
      score,
      label: option.target.kind === 'nexus' ? 'attacca il Nexus' : 'attacca un bersaglio',
      apply: () => next
    };
    if (!best || candidate.score > best.score) best = candidate;
  }

  return best;
}

function bestAttackForStructure(state: GameState, structureId: string): Candidate | null {
  const options = getLegalStructureAttackTargets(state, structureId);
  let best: Candidate | null = null;

  for (const option of options) {
    const target = option.target;
    const next = attackWithStructure(state, structureId, target);
    let score = evaluateState(next);

    if (target.kind === 'unit') {
      const targetId = target.id;
      const removed = !next.units.some((unit) => unit.instanceId === targetId);
      if (removed) score += 16;
    }
    if (target.kind === 'structure') {
      const targetId = target.id;
      const removed = !next.structures.some((structure) => structure.instanceId === targetId);
      if (removed) score += 12;
    }
    if (target.kind === 'nexus') score += 16;
    if (next.winner === AI_PLAYER) score += WIN_SCORE;

    const candidate: Candidate = {
      score,
      label: 'usa una struttura offensiva',
      apply: () => next
    };
    if (!best || candidate.score > best.score) best = candidate;
  }

  return best;
}

function bestMoveSequence(state: GameState, unitId: string): Candidate | null {
  const moves = getReachableMovement(state, unitId);
  if (moves.length === 0) return null;

  let best: Candidate | null = null;

  for (const option of moves) {
    let next = moveUnit(state, unitId, option.position);
    let score = evaluateState(next);
    const afterMoveAttack = bestAttackForUnit(next, unitId);

    if (afterMoveAttack && afterMoveAttack.score > score) {
      next = afterMoveAttack.apply(next);
      score = evaluateState(next) + 2.5;
    }

    const movedUnit = next.units.find((unit) => unit.instanceId === unitId);
    if (movedUnit) {
      score += piecePositionalValue(next, unitId, AI_PLAYER) * 0.6;
      score -= exposedRisk(next, unitId) * 0.2;
    }

    const candidate: Candidate = {
      score,
      label: afterMoveAttack ? 'si riposiziona e attacca' : 'si riposiziona',
      apply: () => next
    };

    if (!best || candidate.score > best.score) best = candidate;
  }

  return best;
}

function playUnitIntelligently(state: GameState, unitId: string): Candidate | null {
  const immediate = bestAttackForUnit(state, unitId);
  const move = bestMoveSequence(state, unitId);
  const baseline = evaluateState(state);

  if (immediate && immediate.score >= (move?.score ?? -Infinity)) {
    let afterAttack = immediate.apply(state);

    if (afterAttack.winner === null) {
      const stillThere = afterAttack.units.find((unit) => unit.instanceId === unitId);
      if (stillThere && !stillThere.movedThisTurn) {
        const reposition = bestMoveSequence(afterAttack, unitId);
        if (reposition && reposition.score > evaluateState(afterAttack) + 0.25) {
          afterAttack = reposition.apply(afterAttack);
        }
      }
    }

    return {
      score: evaluateState(afterAttack),
      label: immediate.label,
      apply: () => afterAttack
    };
  }

  if (move && move.score > baseline - 0.5) return move;
  return immediate;
}

function deploymentCandidates(state: GameState): Candidate[] {
  const player = state.players[state.activePlayer];
  const candidates: Candidate[] = [];

  player.hand.forEach((cardId, handIndex) => {
    const card = CARDS[cardId];

    if (card.type === 'unit') {
      const cells = getLegalUnitDeploymentCells(state, handIndex);
      for (const position of cells) {
        const next = deployUnit(state, handIndex, position);
        const created = next.units[next.units.length - 1];
        let score = evaluateState(next) + piecePositionalValue(next, created.instanceId, AI_PLAYER);
        const dist = nearestNexusDistance(next, position, HUMAN_PLAYER);
        score -= dist * (card.range <= 1 ? 0.35 : 0.15);
        score += 2.5;
        if (state.units.filter((unit) => unit.owner === AI_PLAYER).length === 0) score += 4;

        candidates.push({
          score,
          label: 'schiera ' + card.name,
          apply: () => next
        });
      }
    }

    if (card.type === 'structure') {
      const cells = getLegalStructurePlacementCells(state, handIndex);
      for (const position of cells) {
        const next = placeStructure(state, handIndex, position);
        let score = evaluateState(next);

        const ownNexusDistance = nearestNexusDistance(next, position, AI_PLAYER);
        const enemyNexusDistance = nearestNexusDistance(next, position, HUMAN_PLAYER);

        if (card.attack > 0) score -= enemyNexusDistance * 0.2;
        if (card.id === 'nexus_chapel') score -= ownNexusDistance * 0.35;
        if (card.id === 'mana_crystal') score += 1.5;

        candidates.push({
          score,
          label: 'costruisce ' + card.name,
          apply: () => next
        });
      }
    }
  });

  return candidates;
}

function combinations<T>(values: T[], maxSize: number): T[][] {
  const out: T[][] = [];

  function walk(start: number, current: T[]) {
    if (current.length > 0) out.push([...current]);
    if (current.length === maxSize) return;

    for (let i = start; i < values.length; i += 1) {
      current.push(values[i]);
      walk(i + 1, current);
      current.pop();
    }
  }

  walk(0, []);
  return out;
}

function spellCandidates(state: GameState): Candidate[] {
  const player = state.players[state.activePlayer];
  const candidates: Candidate[] = [];

  player.hand.forEach((cardId, handIndex) => {
    const card = CARDS[cardId];
    if (card.type !== 'spell') return;

    if (card.effect === 'damage' || card.effect === 'slow' || card.effect === 'conditional-damage') {
      for (const enemy of state.units.filter((unit) => unit.owner === HUMAN_PLAYER)) {
        try {
          const next = castSpell(state, handIndex, {
            kind: card.effect,
            targetUnitId: enemy.instanceId
          });
          let score = evaluateState(next);
          const enemyCard = CARDS[enemy.cardId];
          if (card.effect === 'slow' && enemyCard.type === 'unit') {
            const d = nearestNexusDistance(state, enemy.position, AI_PLAYER);
            score += enemyCard.movement * 0.8 + Math.max(0, 5 - d) * 1.3;
          }
          candidates.push({
            score,
            label: 'lancia ' + card.name,
            apply: () => next
          });
        } catch {
          // invalid spell target
        }
      }
    }

    if (card.effect === 'teleport') {
      const allies = state.units
        .filter((unit) => unit.owner === AI_PLAYER && !unit.movedThisTurn)
        .slice(0, 5);

      for (const ally of allies) {
        const destinations = legalTeleportDestinations(state, ally.instanceId)
          .map((position) => ({
            position,
            value:
              -nearestNexusDistance(state, position, HUMAN_PLAYER) +
              (getMap(state).terrain[position.y][position.x] === 'hill' ? 2 : 0)
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5);

        for (const { position } of destinations) {
          try {
            const next = castSpell(state, handIndex, {
              kind: 'teleport',
              unitId: ally.instanceId,
              destination: position
            });
            candidates.push({
              score: evaluateState(next) + piecePositionalValue(next, ally.instanceId, AI_PLAYER),
              label: 'usa Traslazione',
              apply: () => next
            });
          } catch {
            // invalid destination
          }
        }
      }
    }

    if (card.effect === 'buff-move') {
      const allies = state.units
        .filter((unit) => unit.owner === AI_PLAYER && !unit.movedThisTurn)
        .sort((a, b) =>
          nearestNexusDistance(state, a.position, HUMAN_PLAYER) -
          nearestNexusDistance(state, b.position, HUMAN_PLAYER)
        )
        .slice(0, 5);

      for (const group of combinations(allies, 3)) {
        try {
          const next = castSpell(state, handIndex, {
            kind: 'buff-move',
            unitIds: group.map((unit) => unit.instanceId)
          });
          candidates.push({
            score: evaluateState(next) + group.length * 0.8,
            label: 'lancia Adunata',
            apply: () => next
          });
        } catch {
          // invalid group
        }
      }
    }
  });

  return candidates;
}

function bestCardAction(state: GameState): Candidate | null {
  const baseline = evaluateState(state);
  const candidates = [...spellCandidates(state), ...deploymentCandidates(state)]
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best) return null;

  // Save mana when an action is genuinely wasteful, but do not become passive in the opening.
  const hasBoardPresence =
    state.units.some((unit) => unit.owner === AI_PLAYER) ||
    state.structures.some((structure) => structure.owner === AI_PLAYER);
  const threshold = hasBoardPresence ? baseline + 0.2 : baseline - 0.5;
  return best.score > threshold ? best : null;
}

function executeCardPhase(state: GameState, actions: string[]): GameState {
  let next = state;

  for (let i = 0; i < 8; i += 1) {
    if (next.winner !== null) break;
    const best = bestCardAction(next);
    if (!best) break;
    next = best.apply(next);
    actions.push(best.label);
  }

  return next;
}

function executeUnits(state: GameState, actions: string[]): GameState {
  let next = state;

  const unitIds = next.units
    .filter((unit) => unit.owner === AI_PLAYER)
    .sort((a, b) => {
      const aThreat = nearestNexusDistance(next, a.position, HUMAN_PLAYER);
      const bThreat = nearestNexusDistance(next, b.position, HUMAN_PLAYER);
      return aThreat - bThreat;
    })
    .map((unit) => unit.instanceId);

  for (const unitId of unitIds) {
    if (next.winner !== null) break;
    if (!next.units.some((unit) => unit.instanceId === unitId)) continue;

    const candidate = playUnitIntelligently(next, unitId);
    if (!candidate) continue;

    const before = evaluateState(next);
    const after = candidate.apply(next);
    if (evaluateState(after) >= before - 0.5) {
      next = after;
      actions.push(candidate.label);
    }
  }

  return next;
}

function executeStructures(state: GameState, actions: string[]): GameState {
  let next = state;
  const ids = next.structures
    .filter((structure) => structure.owner === AI_PLAYER)
    .map((structure) => structure.instanceId);

  for (const id of ids) {
    if (next.winner !== null) break;
    const candidate = bestAttackForStructure(next, id);
    if (!candidate) continue;
    next = candidate.apply(next);
    actions.push(candidate.label);
  }

  return next;
}

function finishUnusedAttacks(state: GameState, actions: string[]): GameState {
  let next = state;

  for (const unit of [...next.units]) {
    if (unit.owner !== AI_PLAYER || unit.attackedThisTurn) continue;
    const candidate = bestAttackForUnit(next, unit.instanceId);
    if (!candidate) continue;
    next = candidate.apply(next);
    actions.push(candidate.label);
    if (next.winner !== null) break;
  }

  return next;
}

export function runAITurn(
  state: GameState,
  difficulty: AIDifficulty = 'challenging'
): AITurnResult {
  if (difficulty !== 'challenging') throw new Error('Profilo AI non supportato.');
  if (state.activePlayer !== AI_PLAYER || !state.turnStarted || state.winner !== null) {
    return { state, actions: [] };
  }

  const actions: string[] = [];
  let next = state;

  // Order is deliberate: use tactical spells/deployments first, then pieces.
  next = executeCardPhase(next, actions);
  next = executeUnits(next, actions);
  next = executeStructures(next, actions);
  next = finishUnusedAttacks(next, actions);

  return { state: next, actions };
}
