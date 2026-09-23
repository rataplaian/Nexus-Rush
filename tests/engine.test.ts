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
import {
  attackPowerForUnit,
  attackTarget,
  attackWithStructure,
  getLegalAttackTargets,
  getLegalStructureAttackTargets,
  hasLineOfSight,
  validateAttack
} from '../src/game/combat';
import {
  castSpell,
  getLegalStructurePlacementCells,
  legalTeleportDestinations,
  placeStructure
} from '../src/game/actions';
import { effectiveCardCost } from '../src/game/engine';
import { effectiveMovementForUnit } from '../src/game/movement';
import {
  chooseAINexusPositions,
  evaluateState,
  runAITurn
} from '../src/game/ai';

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
      attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
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
      attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
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
        attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
      },
      {
        instanceId: 'blocker',
        owner: 0,
        cardId: 'arcane_apprentice',
        position: { x: 4, y: 10 },
        life: 4,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
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
      attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
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
      attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
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
      attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
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
      attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
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


test('attack range uses orthogonal grid distance', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    units: [
      {
        instanceId: 'attacker',
        owner: 0,
        cardId: 'arcane_apprentice',
        position: { x: 4, y: 11 },
        life: 4,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
      },
      {
        instanceId: 'near',
        owner: 1,
        cardId: 'squire',
        position: { x: 4, y: 8 },
        life: 5,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
      },
      {
        instanceId: 'far',
        owner: 1,
        cardId: 'squire',
        position: { x: 3, y: 8 },
        life: 5,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
      }
    ]
  };

  assert.deepEqual(validateAttack(state, 'attacker', { kind: 'unit', id: 'near' }), []);
  assert.ok(validateAttack(state, 'attacker', { kind: 'unit', id: 'far' }).length > 0);
});

test('water does not block line of sight or ranged attacks', () => {
  let state = createGame(
    'horizontal-dual-nexus',
    [{ x: 1, y: 7 }, { x: 10, y: 6 }],
    [{ x: 1, y: 0 }, { x: 10, y: 1 }]
  );
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    units: [
      {
        instanceId: 'attacker',
        owner: 0,
        cardId: 'order_crossbow',
        position: { x: 4, y: 3 },
        life: 5,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
      },
      {
        instanceId: 'target',
        owner: 1,
        cardId: 'squire',
        position: { x: 7, y: 3 },
        life: 5,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
      }
    ]
  };

  assert.equal(hasLineOfSight(state, { x: 4, y: 3 }, { x: 7, y: 3 }), true);
  assert.deepEqual(validateAttack(state, 'attacker', { kind: 'unit', id: 'target' }), []);
});

test('mountains block line of sight and attacks', () => {
  let state = createGame(
    'horizontal-dual-nexus',
    [{ x: 1, y: 7 }, { x: 10, y: 6 }],
    [{ x: 1, y: 0 }, { x: 10, y: 1 }]
  );
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    units: [
      {
        instanceId: 'attacker',
        owner: 0,
        cardId: 'order_crossbow',
        position: { x: 0, y: 2 },
        life: 5,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
      },
      {
        instanceId: 'target',
        owner: 1,
        cardId: 'squire',
        position: { x: 2, y: 2 },
        life: 5,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
      }
    ]
  };

  assert.equal(hasLineOfSight(state, { x: 0, y: 2 }, { x: 2, y: 2 }), false);
  assert.ok(validateAttack(state, 'attacker', { kind: 'unit', id: 'target' }).length > 0);
});

test('hill grants plus one Attack to the unit standing on it', () => {
  let state = createGame(
    'horizontal-dual-nexus',
    [{ x: 1, y: 7 }, { x: 10, y: 6 }],
    [{ x: 1, y: 0 }, { x: 10, y: 1 }]
  );
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    units: [
      {
        instanceId: 'attacker',
        owner: 0,
        cardId: 'paladin',
        position: { x: 2, y: 2 },
        life: 7,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
      },
      {
        instanceId: 'target',
        owner: 1,
        cardId: 'arcane_apprentice',
        position: { x: 3, y: 2 },
        life: 4,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
      }
    ]
  };

  assert.equal(attackPowerForUnit(state, 'attacker'), 4);
  state = attackTarget(state, 'attacker', { kind: 'unit', id: 'target' });
  assert.equal(state.units.some((unit) => unit.instanceId === 'target'), false);
});

test('attacking damages a unit and an eliminated unit leaves the board', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    units: [
      {
        instanceId: 'attacker',
        owner: 0,
        cardId: 'paladin',
        position: { x: 4, y: 7 },
        life: 7,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
      },
      {
        instanceId: 'target',
        owner: 1,
        cardId: 'squire',
        position: { x: 4, y: 6 },
        life: 3,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
      }
    ]
  };

  state = attackTarget(state, 'attacker', { kind: 'unit', id: 'target' });
  assert.equal(state.units.some((unit) => unit.instanceId === 'target'), false);
  assert.equal(state.units.find((unit) => unit.instanceId === 'attacker')?.attackedThisTurn, true);
});

test('a unit can move and attack in the same turn', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    units: [
      {
        instanceId: 'attacker',
        owner: 0,
        cardId: 'paladin',
        position: { x: 4, y: 8 },
        life: 7,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
      },
      {
        instanceId: 'target',
        owner: 1,
        cardId: 'squire',
        position: { x: 4, y: 6 },
        life: 5,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
      }
    ]
  };

  state = moveUnit(state, 'attacker', { x: 4, y: 7 });
  assert.deepEqual(validateAttack(state, 'attacker', { kind: 'unit', id: 'target' }), []);
  state = attackTarget(state, 'attacker', { kind: 'unit', id: 'target' });
  assert.equal(state.units.find((unit) => unit.instanceId === 'attacker')?.attackedThisTurn, true);
});

test('a unit cannot attack twice in the same turn', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    units: [
      {
        instanceId: 'attacker',
        owner: 0,
        cardId: 'paladin',
        position: { x: 4, y: 7 },
        life: 7,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
      },
      {
        instanceId: 'target',
        owner: 1,
        cardId: 'shield_guardian',
        position: { x: 4, y: 6 },
        life: 9,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
      }
    ]
  };

  state = attackTarget(state, 'attacker', { kind: 'unit', id: 'target' });
  assert.deepEqual(getLegalAttackTargets(state, 'attacker'), []);
  assert.ok(validateAttack(state, 'attacker', { kind: 'unit', id: 'target' }).length > 0);
});

test('attacking a Nexus can end the match', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    nexuses: state.nexuses.map((nexus, index) =>
      index === 1 ? { ...nexus, life: 3 } : nexus
    ),
    units: [{
      instanceId: 'attacker',
      owner: 0,
      cardId: 'archmage',
      position: { x: 3, y: 4 },
      life: 7,
      movedThisTurn: false,
      cellsMovedThisTurn: 0,
      attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
    }]
  };

  assert.deepEqual(validateAttack(state, 'attacker', { kind: 'nexus', index: 1 }), []);
  state = attackTarget(state, 'attacker', { kind: 'nexus', index: 1 });

  assert.equal(state.nexuses[1].life, 0);
  assert.equal(state.winner, 0);
});


test('structures obey their placement rules and consume the card from hand', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    players: [
      { ...state.players[0], mana: 10, hand: ['arcane_tower', ...state.players[0].hand.slice(1)] },
      state.players[1]
    ]
  };

  const legal = getLegalStructurePlacementCells(state, 0);
  assert.ok(legal.length > 0);
  const target = legal.find((position) => position.x === 3 && position.y === 10) ?? legal[0];

  state = placeStructure(state, 0, target);
  assert.equal(state.structures.length, 1);
  assert.equal(state.structures[0].cardId, 'arcane_tower');
  assert.equal(state.players[0].hand.includes('arcane_tower'), false);
});

test('mana crystal generates one bonus mana every three owner turns after construction', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    structures: [{
      instanceId: 'crystal',
      owner: 0,
      cardId: 'mana_crystal',
      position: { x: 1, y: 11 },
      life: 6,
      attackedThisTurn: false,
      deployedOnPersonalTurn: 1
    }]
  };

  state = endTurn(state);
  state = startActivePlayerTurn(state);
  state = endTurn(state);
  state = startActivePlayerTurn(state);
  state = endTurn(state);
  state = startActivePlayerTurn(state);
  state = endTurn(state);
  const before = state.players[0].mana;
  state = startActivePlayerTurn(state);

  assert.equal(state.players[0].personalTurn, 3);
  assert.equal(state.players[0].mana, before + 2);

  state = endTurn(state);
  state = startActivePlayerTurn(state);
  state = endTurn(state);
  state = startActivePlayerTurn(state);
  state = endTurn(state);
  state = startActivePlayerTurn(state);
  state = endTurn(state);
  const manaBeforeTrigger = state.players[0].mana;
  state = startActivePlayerTurn(state);

  assert.equal(state.players[0].personalTurn, 5);
  assert.equal(state.players[0].mana, manaBeforeTrigger + 2);
});

test('mana crystal bonus triggers on its third owner turn after deployment', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    structures: [{
      instanceId: 'crystal',
      owner: 0,
      cardId: 'mana_crystal',
      position: { x: 1, y: 11 },
      life: 6,
      attackedThisTurn: false,
      deployedOnPersonalTurn: 1
    }]
  };

  for (let cycle = 0; cycle < 2; cycle += 1) {
    state = endTurn(state);
    state = startActivePlayerTurn(state);
    state = endTurn(state);
    state = startActivePlayerTurn(state);
  }

  assert.equal(state.players[0].personalTurn, 3);
  state = endTurn(state);
  state = startActivePlayerTurn(state);
  state = endTurn(state);
  const before = state.players[0].mana;
  state = startActivePlayerTurn(state);

  assert.equal(state.players[0].personalTurn, 4);
  assert.equal(state.players[0].mana, before + 3);
});

test('nexus chapel heals the most wounded adjacent allied unit at end of turn', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    structures: [{
      instanceId: 'chapel',
      owner: 0,
      cardId: 'nexus_chapel',
      position: { x: 2, y: 10 },
      life: 8,
      attackedThisTurn: false,
      deployedOnPersonalTurn: 1
    }],
    units: [{
      instanceId: 'ally',
      owner: 0,
      cardId: 'paladin',
      position: { x: 2, y: 9 },
      life: 4,
      movedThisTurn: false,
      cellsMovedThisTurn: 0,
      attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
    }]
  };

  state = endTurn(state);
  assert.equal(state.units[0].life, 5);
});

test('arcane and watch towers can attack once per turn', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    structures: [{
      instanceId: 'tower',
      owner: 0,
      cardId: 'watch_tower',
      position: { x: 4, y: 8 },
      life: 10,
      attackedThisTurn: false,
      deployedOnPersonalTurn: 1
    }],
    units: [{
      instanceId: 'target',
      owner: 1,
      cardId: 'squire',
      position: { x: 4, y: 5 },
      life: 5,
      movedThisTurn: false,
      cellsMovedThisTurn: 0,
      attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
    }]
  };

  assert.equal(getLegalStructureAttackTargets(state, 'tower').length, 1);
  state = attackWithStructure(state, 'tower', { kind: 'unit', id: 'target' });
  assert.equal(state.units[0].life, 2);
  assert.deepEqual(getLegalStructureAttackTargets(state, 'tower'), []);
});

test('archmage discounts only the first spell each turn by one mana', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    players: [
      { ...state.players[0], mana: 10, hand: ['fireball', 'ice_chains', ...state.players[0].hand.slice(2)] },
      state.players[1]
    ],
    units: [
      {
        instanceId: 'archmage',
        owner: 0,
        cardId: 'archmage',
        position: { x: 4, y: 10 },
        life: 7,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
        movementModifierThisTurn: 0,
        pendingMovementModifier: 0
      },
      {
        instanceId: 'enemy',
        owner: 1,
        cardId: 'squire',
        position: { x: 4, y: 5 },
        life: 5,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
        movementModifierThisTurn: 0,
        pendingMovementModifier: 0
      }
    ]
  };

  assert.equal(effectiveCardCost(state, 'fireball'), 2);
  state = castSpell(state, 0, { kind: 'damage', targetUnitId: 'enemy' });
  assert.equal(state.players[0].mana, 8);
  assert.equal(effectiveCardCost(state, 'ice_chains'), 2);
});

test('fireball deals four damage and is discarded', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    players: [
      { ...state.players[0], mana: 10, hand: ['fireball', ...state.players[0].hand.slice(1)] },
      state.players[1]
    ],
    units: [{
      instanceId: 'enemy',
      owner: 1,
      cardId: 'shield_guardian',
      position: { x: 4, y: 5 },
      life: 9,
      movedThisTurn: false,
      cellsMovedThisTurn: 0,
      attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
    }]
  };

  state = castSpell(state, 0, { kind: 'damage', targetUnitId: 'enemy' });
  assert.equal(state.units[0].life, 5);
  assert.equal(state.players[0].discardPile.at(-1), 'fireball');
});

test('ice chains applies minus two movement on the target next turn', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    players: [
      { ...state.players[0], mana: 10, hand: ['ice_chains', ...state.players[0].hand.slice(1)] },
      state.players[1]
    ],
    units: [{
      instanceId: 'enemy',
      owner: 1,
      cardId: 'nexus_knight',
      position: { x: 4, y: 5 },
      life: 8,
      movedThisTurn: false,
      cellsMovedThisTurn: 0,
      attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
    }]
  };

  state = castSpell(state, 0, { kind: 'slow', targetUnitId: 'enemy' });
  state = endTurn(state);
  state = startActivePlayerTurn(state);

  assert.equal(effectiveMovementForUnit(state, 'enemy'), 1);
});

test('translocation teleports up to three cells without consuming normal movement', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    players: [
      { ...state.players[0], mana: 10, hand: ['translocation', ...state.players[0].hand.slice(1)] },
      state.players[1]
    ],
    units: [{
      instanceId: 'ally',
      owner: 0,
      cardId: 'arcane_apprentice',
      position: { x: 4, y: 10 },
      life: 4,
      movedThisTurn: false,
      cellsMovedThisTurn: 0,
      attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
    }]
  };

  assert.ok(legalTeleportDestinations(state, 'ally').some((cell) => cell.x === 4 && cell.y === 7));
  state = castSpell(state, 0, { kind: 'teleport', unitId: 'ally', destination: { x: 4, y: 7 } });

  assert.deepEqual(state.units[0].position, { x: 4, y: 7 });
  assert.equal(state.units[0].movedThisTurn, false);
});

test('rally gives plus one movement to up to three unmoved allied units', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    players: [
      { ...state.players[0], mana: 10, hand: ['rally', ...state.players[0].hand.slice(1)] },
      state.players[1]
    ],
    units: ['a', 'b', 'c'].map((id, index) => ({
      instanceId: id,
      owner: 0 as const,
      cardId: 'squire',
      position: { x: index + 1, y: 10 },
      life: 5,
      movedThisTurn: false,
      cellsMovedThisTurn: 0,
      attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
    }))
  };

  state = castSpell(state, 0, { kind: 'buff-move', unitIds: ['a', 'b', 'c'] });
  assert.equal(effectiveMovementForUnit(state, 'a'), 3);
  assert.equal(effectiveMovementForUnit(state, 'b'), 3);
  assert.equal(effectiveMovementForUnit(state, 'c'), 3);
});

test('holy punishment deals four damage when target is adjacent to a friendly paladin', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    players: [
      { ...state.players[0], mana: 10, hand: ['holy_punishment', ...state.players[0].hand.slice(1)] },
      state.players[1]
    ],
    units: [
      {
        instanceId: 'paladin',
        owner: 0,
        cardId: 'paladin',
        position: { x: 4, y: 6 },
        life: 7,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
        movementModifierThisTurn: 0,
        pendingMovementModifier: 0
      },
      {
        instanceId: 'enemy',
        owner: 1,
        cardId: 'shield_guardian',
        position: { x: 4, y: 5 },
        life: 9,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
        movementModifierThisTurn: 0,
        pendingMovementModifier: 0
      }
    ]
  };

  state = castSpell(state, 0, { kind: 'conditional-damage', targetUnitId: 'enemy' });
  assert.equal(state.units.find((unit) => unit.instanceId === 'enemy')?.life, 5);
});

test('battle mage gains one range if it has not moved', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    units: [
      {
        instanceId: 'mage',
        owner: 0,
        cardId: 'battle_mage',
        position: { x: 4, y: 10 },
        life: 5,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
        movementModifierThisTurn: 0,
        pendingMovementModifier: 0
      },
      {
        instanceId: 'enemy',
        owner: 1,
        cardId: 'squire',
        position: { x: 4, y: 6 },
        life: 5,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
        movementModifierThisTurn: 0,
        pendingMovementModifier: 0
      }
    ]
  };

  assert.deepEqual(validateAttack(state, 'mage', { kind: 'unit', id: 'enemy' }), []);
  state = { ...state, units: state.units.map((unit) => unit.instanceId === 'mage' ? { ...unit, movedThisTurn: true } : unit) };
  assert.ok(validateAttack(state, 'mage', { kind: 'unit', id: 'enemy' }).length > 0);
});

test('frost weaver reduces the target movement next turn when it hits', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    units: [
      {
        instanceId: 'weaver',
        owner: 0,
        cardId: 'frost_weaver',
        position: { x: 4, y: 8 },
        life: 4,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
        movementModifierThisTurn: 0,
        pendingMovementModifier: 0
      },
      {
        instanceId: 'enemy',
        owner: 1,
        cardId: 'nexus_knight',
        position: { x: 4, y: 5 },
        life: 8,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
        movementModifierThisTurn: 0,
        pendingMovementModifier: 0
      }
    ]
  };

  state = attackTarget(state, 'weaver', { kind: 'unit', id: 'enemy' });
  state = endTurn(state);
  state = startActivePlayerTurn(state);
  assert.equal(effectiveMovementForUnit(state, 'enemy'), 2);
});

test('arcane elemental ignores the extra cost to climb a hill', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    units: [{
      instanceId: 'elemental',
      owner: 0,
      cardId: 'arcane_elemental',
      position: { x: 1, y: 11 },
      life: 8,
      movedThisTurn: false,
      cellsMovedThisTurn: 0,
      attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
    }]
  };

  const reachable = getReachableMovement(state, 'elemental');
  assert.ok(reachable.some((option) => option.position.x === 1 && option.position.y === 9));
});

test('shield guardian reduces ranged damage to adjacent allies by one', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    units: [
      {
        instanceId: 'attacker',
        owner: 0,
        cardId: 'order_crossbow',
        position: { x: 4, y: 9 },
        life: 5,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
        movementModifierThisTurn: 0,
        pendingMovementModifier: 0
      },
      {
        instanceId: 'target',
        owner: 1,
        cardId: 'squire',
        position: { x: 4, y: 6 },
        life: 5,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
        movementModifierThisTurn: 0,
        pendingMovementModifier: 0
      },
      {
        instanceId: 'guard',
        owner: 1,
        cardId: 'shield_guardian',
        position: { x: 5, y: 6 },
        life: 9,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
        movementModifierThisTurn: 0,
        pendingMovementModifier: 0
      }
    ]
  };

  state = attackTarget(state, 'attacker', { kind: 'unit', id: 'target' });
  assert.equal(state.units.find((unit) => unit.instanceId === 'target')?.life, 4);
});

test('nexus knight gains plus one attack after moving at least two cells', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    units: [{
      instanceId: 'knight',
      owner: 0,
      cardId: 'nexus_knight',
      position: { x: 4, y: 9 },
      life: 8,
      movedThisTurn: true,
      cellsMovedThisTurn: 2,
      attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
    }]
  };

  assert.equal(attackPowerForUnit(state, 'knight'), 5);
});

test('bastion champion heals two life after eliminating an enemy unit', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = {
    ...state,
    units: [
      {
        instanceId: 'champion',
        owner: 0,
        cardId: 'bastion_champion',
        position: { x: 4, y: 7 },
        life: 8,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
        movementModifierThisTurn: 0,
        pendingMovementModifier: 0
      },
      {
        instanceId: 'enemy',
        owner: 1,
        cardId: 'squire',
        position: { x: 4, y: 6 },
        life: 5,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
        movementModifierThisTurn: 0,
        pendingMovementModifier: 0
      }
    ]
  };

  state = attackTarget(state, 'champion', { kind: 'unit', id: 'enemy' });
  assert.equal(state.units.find((unit) => unit.instanceId === 'champion')?.life, 10);
});


test('AI chooses legal Nexus positions for both game modes', () => {
  const vertical = chooseAINexusPositions(VERTICAL_PASS, 1);
  const horizontal = chooseAINexusPositions(HORIZONTAL_VALLEY, 1);

  assert.deepEqual(validateNexusPositions(VERTICAL_PASS, 1, vertical), []);
  assert.deepEqual(validateNexusPositions(HORIZONTAL_VALLEY, 1, horizontal), []);
  assert.equal(vertical.length, 1);
  assert.equal(horizontal.length, 2);
});

test('AI takes a complete tactical turn instead of passing with playable mana', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = endTurn(state);
  state = startActivePlayerTurn(state);

  assert.equal(state.activePlayer, 1);
  assert.equal(state.players[1].mana, 2);

  const result = runAITurn(state);

  assert.ok(result.actions.length > 0);
  assert.ok(
    result.state.units.some((unit) => unit.owner === 1) ||
    result.state.structures.some((structure) => structure.owner === 1) ||
    result.state.players[1].mana < 2
  );
});

test('AI prioritizes an immediate lethal attack on the enemy Nexus', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = endTurn(state);
  state = startActivePlayerTurn(state);

  state = {
    ...state,
    nexuses: state.nexuses.map((nexus, index) =>
      index === 0 ? { ...nexus, life: 3 } : nexus
    ),
    units: [{
      instanceId: 'ai-finisher',
      owner: 1,
      cardId: 'archmage',
      position: { x: 3, y: 7 },
      life: 7,
      movedThisTurn: false,
      cellsMovedThisTurn: 0,
      attackedThisTurn: false,
      movementModifierThisTurn: 0,
      pendingMovementModifier: 0
    }],
    players: [
      state.players[0],
      { ...state.players[1], mana: 0, hand: [] }
    ]
  };

  const result = runAITurn(state);

  assert.equal(result.state.winner, 1);
  assert.equal(result.state.nexuses[0].life, 0);
});

test('AI focus fire prefers removing a killable enemy over chip damage', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = endTurn(state);
  state = startActivePlayerTurn(state);

  state = {
    ...state,
    players: [
      state.players[0],
      { ...state.players[1], mana: 0, hand: [] }
    ],
    units: [
      {
        instanceId: 'ai-paladin',
        owner: 1,
        cardId: 'paladin',
        position: { x: 4, y: 5 },
        life: 7,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
        movementModifierThisTurn: 0,
        pendingMovementModifier: 0
      },
      {
        instanceId: 'killable',
        owner: 0,
        cardId: 'squire',
        position: { x: 4, y: 6 },
        life: 2,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
        movementModifierThisTurn: 0,
        pendingMovementModifier: 0
      },
      {
        instanceId: 'healthy',
        owner: 0,
        cardId: 'shield_guardian',
        position: { x: 3, y: 5 },
        life: 9,
        movedThisTurn: false,
        cellsMovedThisTurn: 0,
        attackedThisTurn: false,
        movementModifierThisTurn: 0,
        pendingMovementModifier: 0
      }
    ]
  };

  const result = runAITurn(state);

  assert.equal(result.state.units.some((unit) => unit.instanceId === 'killable'), false);
  assert.equal(result.state.units.some((unit) => unit.instanceId === 'healthy'), true);
});

test('AI evaluation strongly prefers winning states', () => {
  const base = verticalGame();
  const won = { ...base, winner: 1 as const };
  const lost = { ...base, winner: 0 as const };

  assert.ok(evaluateState(won, 1) > evaluateState(base, 1) + 1000);
  assert.ok(evaluateState(lost, 1) < evaluateState(base, 1) - 1000);
});

test('AI is deterministic for the same board state', () => {
  let state = verticalGame();
  state = startActivePlayerTurn(state);
  state = endTurn(state);
  state = startActivePlayerTurn(state);

  const a = runAITurn(state);
  const b = runAITurn(state);

  assert.deepEqual(a.actions, b.actions);
  assert.deepEqual(a.state, b.state);
});
