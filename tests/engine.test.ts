import test from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_DECKS, validateDeck } from '../src/game/cards';
import { HORIZONTAL_VALLEY, VERTICAL_PASS } from '../src/game/maps';
import {
  attackModifierForTerrain,
  blocksLineOfSight,
  blocksMovement,
  manaIncomeForPersonalTurn,
  movementCost,
  validateNexusPositions
} from '../src/game/rules';
import { createGame, damageNexus, endTurn, startActivePlayerTurn } from '../src/game/engine';

test('starter decks contain 20 cards and never exceed two copies', () => {
  for (const deck of STARTER_DECKS) {
    assert.deepEqual(validateDeck(deck), []);
    assert.equal(deck.cardIds.length, 20);
  }
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
  let state = createGame(
    'vertical-single-nexus',
    [{ x: 3, y: 11 }],
    [{ x: 3, y: 0 }]
  );
  state = startActivePlayerTurn(state);
  assert.equal(state.players[0].mana, 2);
  state = endTurn(state);
  state = startActivePlayerTurn(state);
  assert.equal(state.players[1].mana, 2);
  state = endTurn(state);
  state = startActivePlayerTurn(state);
  assert.equal(state.players[0].mana, 4);
});
