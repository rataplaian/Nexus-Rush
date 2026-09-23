import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, STARTER_DECKS, validateDeck } from '../src/game/cards';
import { HORIZONTAL_VALLEY, VERTICAL_PASS } from '../src/game/maps';
import {
  attackModifierForTerrain,
  blocksLineOfSight,
  blocksMovement,
  HAND_SIZE,
  manaIncomeForPersonalTurn,
  movementCost,
  validateNexusPositions
} from '../src/game/rules';
import {
  createGame,
  damageNexus,
  deployUnit,
  endTurn,
  getLegalUnitDeploymentCells,
  startActivePlayerTurn
} from '../src/game/engine';
import {
  getReachableMovement,
  moveUnit,
  validateUnitMove
} from '../src/game/movement';

function verticalGame() {
  return createGame(
    'vertical-single-nexus',
    [{ x: 3, y: 11 }],
    [{ x: 3, y: 0 }]
  );
}

test('starter decks contain 20 cards and never exceed two copies', () => {
  for (const deck of STARTER_DECKS) {
    assert.deepEqual(validateDeck(deck), []);
    assert.equal(deck.cardIds.length, 20);
  }
});

test('new games start with five-card hands and fifteen cards remaining', () => {
  const state = verticalGame();
  assert.equal(state.players[0].hand.length, HAND_SIZE);
  assert.equal(state.players[0].drawPile.length, 15);
  assert.equal(state.players[1].hand.length, HAND_SIZE);
  assert.equal(state.players[1].drawPile.length, 15);
  assert.equal(new Set(state.players[0].hand).size, 5);
});

test('mana income grows every five personal turns', () => {
  assert.equal(manaIncomeForPersonalTurn(1), 2);
  assert.equal(manaIncomeForPersonalTurn(5), 2);
  assert.equal(manaIncomeForPersonalTurn(6), 3);
  assert.equal(manaIncomeForPersonalTurn(10), 3);
  assert.equal(manaIncomeForPersonalTurn(11), 4);
});

test('water blocks movement but not line of sight', () => {
  assert.equal(blocksMovement('water'), true);
  assert.equal(blocksLineOfSight('water'), false);
});

test('mountains block movement and line of sight', () => {
  assert.equal(blocksMovement('mountain'), true);
  assert.equal(blocksLineOfSight('mountain'), true);
});

test('hill grants one attack and climbing costs extra movement', () => {
  assert.equal(attackModifierForTerrain('hill'), 1);
  assert.equal(movementCost('plain', 'hill', 3), 2);
  assert.equal(movementCost('plain', 'hill', 1), 1);
  assert.equal(movementCost('hill', 'plain', 2), 0);
});

test('horizontal mode requires left/right nexus, different rows and five-cell spacing', () => {
  assert.deepEqual(
    validateNexusPositions(HORIZONTAL_VALLEY, 0, [{ x: 1, y: 7 }, { x: 10, y: 6 }]),
    []
  );
  assert.ok(
    validateNexusPositions(HORIZONTAL_VALLEY, 0, [{ x: 1, y: 7 }, { x: 7, y: 7 }]).length > 0
  );
});

test('vertical mode rejects outer corners', () => {
  assert.ok(validateNexusPositions(VERTICAL_PASS, 0, [{ x: 0, y: 11 }]).length > 0);
  assert.deepEqual(validateNexusPositions(VERTICAL_PASS, 0, [{ x: 3, y: 11 }]), []);
});

test('destroying one nexus wins immediately in horizontal mode', () => {
  let state = createGame(
    'horizontal-dual-nexus',
    [{ x: 1, y: 7 }, { x: 10, y: 6 }],
    [{ x: 1, y: 0 }, { x: 10, y: 1 }]
  );
  state = damageNexus(state, 2, 10);
  assert.equal(state.nexuses[2].life, 0);
  assert.equal(state.winner, 0);
});

test('mana is banked across active player turns', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  assert.equal(state.players[0].mana, 2);
  state = endTurn(state);
  state = startActivePlayerTurn(state);
  assert.equal(state.players[1].mana, 2);
  state = endTurn(state);
  state = startActivePlayerTurn(state);
  assert.equal(state.players[0].mana, 4);
});

test('a unit can be deployed in a legal free deployment cell and consumes mana/card', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);

  const apprenticeIndex = state.players[0].hand.indexOf('arcane_apprentice');
  assert.notEqual(apprenticeIndex, -1);
  assert.equal(CARDS.arcane_apprentice.cost, 2);

  const legal = getLegalUnitDeploymentCells(state, apprenticeIndex);
  assert.ok(legal.length > 0);
  const target = legal.find((cell) => !(cell.x === 3 && cell.y === 11));
  assert.ok(target);

  state = deployUnit(state, apprenticeIndex, target!);

  assert.equal(state.players[0].mana, 0);
  assert.equal(state.players[0].hand.length, 4);
  assert.equal(state.units.length, 1);
  assert.equal(state.units[0].cardId, 'arcane_apprentice');
  assert.deepEqual(state.units[0].position, target);
});

test('occupied nexus cells cannot be used for deployment', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  const apprenticeIndex = state.players[0].hand.indexOf('arcane_apprentice');
  const legal = getLegalUnitDeploymentCells(state, apprenticeIndex);

  assert.equal(legal.some((cell) => cell.x === 3 && cell.y === 11), false);
});

test('hand refills to five at the start of the next personal turn', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  const apprenticeIndex = state.players[0].hand.indexOf('arcane_apprentice');
  const target = getLegalUnitDeploymentCells(state, apprenticeIndex)[0];
  state = deployUnit(state, apprenticeIndex, target);

  assert.equal(state.players[0].hand.length, 4);
  assert.equal(state.players[0].drawPile.length, 15);

  state = endTurn(state);
  state = startActivePlayerTurn(state);
  state = endTurn(state);
  state = startActivePlayerTurn(state);

  assert.equal(state.players[0].hand.length, 5);
  assert.equal(state.players[0].drawPile.length, 14);
});

test('non-unit cards are not valid for unit deployment', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);

  state = {
    ...state,
    players: [
      { ...state.players[0], mana: 10, hand: ['fireball', ...state.players[0].hand.slice(1)] },
      state.players[1]
    ]
  };

  assert.deepEqual(getLegalUnitDeploymentCells(state, 0), []);
});


test('movement is orthogonal and limited by the unit Movement value', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    units: [{
      instanceId: 'unit-test',
      owner: 0,
      cardId: 'arcane_apprentice',
      position: { x: 4, y: 11 },
      life: 4,
      movedThisTurn: false,
      cellsMovedThisTurn: 0,
      attackedThisTurn: false
    }]
  };

  const reachable = getReachableMovement(state, 'unit-test');

  assert.equal(reachable.some((option) => option.position.x === 4 && option.position.y === 9), true);
  assert.equal(reachable.some((option) => option.position.x === 6 && option.position.y === 11), true);
  assert.equal(reachable.some((option) => option.position.x === 5 && option.position.y === 10), true);
  assert.equal(reachable.some((option) => option.position.x === 5 && option.position.y === 9), false);
});

test('water and mountains cannot be entered during movement', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    units: [{
      instanceId: 'unit-test',
      owner: 0,
      cardId: 'arcane_apprentice',
      position: { x: 2, y: 5 },
      life: 4,
      movedThisTurn: false,
      cellsMovedThisTurn: 0,
      attackedThisTurn: false
    }]
  };

  const reachable = getReachableMovement(state, 'unit-test');
  assert.equal(reachable.some((option) => option.position.x === 3 && option.position.y === 5), false);
  assert.equal(reachable.some((option) => option.position.x === 2 && option.position.y === 4), false);
});

test('occupied cells block movement and cannot be crossed', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    units: [
      {
        instanceId: 'mover',
        owner: 0,
        cardId: 'arcane_apprentice',
        position: { x: 4, y: 11 },
        life: 4,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false
      },
      {
        instanceId: 'blocker',
        owner: 0,
        cardId: 'arcane_apprentice',
        position: { x: 4, y: 10 },
        life: 4,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false
      }
    ]
  };

  const reachable = getReachableMovement(state, 'mover');
  assert.equal(reachable.some((option) => option.position.x === 4 && option.position.y === 10), false);
  assert.equal(reachable.some((option) => option.position.x === 4 && option.position.y === 9), false);
});

test('a one-Movement unit can still climb an adjacent hill', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    units: [{
      instanceId: 'climber',
      owner: 0,
      cardId: 'shield_guardian',
      position: { x: 1, y: 11 },
      life: 9,
      movedThisTurn: false,
      cellsMovedThisTurn: 0,
      attackedThisTurn: false
    }]
  };

  const reachable = getReachableMovement(state, 'climber');
  assert.equal(reachable.some((option) => option.position.x === 1 && option.position.y === 10), true);
});

test('descending from a hill grants one extra movement step', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    units: [{
      instanceId: 'descender',
      owner: 0,
      cardId: 'shield_guardian',
      position: { x: 1, y: 10 },
      life: 9,
      movedThisTurn: false,
      cellsMovedThisTurn: 0,
      attackedThisTurn: false
    }]
  };

  const reachable = getReachableMovement(state, 'descender');
  assert.equal(reachable.some((option) => option.position.x === 1 && option.position.y === 11), true);
  assert.equal(reachable.some((option) => option.position.x === 2 && option.position.y === 11), true);
});

test('moving marks the unit as moved and prevents a second move that turn', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    units: [{
      instanceId: 'mover',
      owner: 0,
      cardId: 'arcane_apprentice',
      position: { x: 4, y: 11 },
      life: 4,
      movedThisTurn: false,
      cellsMovedThisTurn: 0,
      attackedThisTurn: false
    }]
  };

  state = moveUnit(state, 'mover', { x: 4, y: 10 });

  assert.deepEqual(state.units[0].position, { x: 4, y: 10 });
  assert.equal(state.units[0].movedThisTurn, true);
  assert.equal(state.units[0].cellsMovedThisTurn, 1);
  assert.deepEqual(getReachableMovement(state, 'mover'), []);
  assert.ok(validateUnitMove(state, 'mover', { x: 4, y: 9 }).length > 0);
});

test('movement resets on that unit owner next turn', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    units: [{
      instanceId: 'mover',
      owner: 0,
      cardId: 'arcane_apprentice',
      position: { x: 4, y: 11 },
      life: 4,
      movedThisTurn: false,
      cellsMovedThisTurn: 0,
      attackedThisTurn: false
    }]
  };

  state = moveUnit(state, 'mover', { x: 4, y: 10 });
  state = endTurn(state);
  state = startActivePlayerTurn(state);
  state = endTurn(state);
  state = startActivePlayerTurn(state);

  assert.equal(state.units[0].movedThisTurn, false);
  assert.equal(state.units[0].cellsMovedThisTurn, 0);
});
