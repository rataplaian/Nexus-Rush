# Nexus Rush — Game Design Baseline

Status: **prototype baseline**. This document records the rules already agreed for implementation. Values can be rebalanced without changing the core identity.

## 1. Core idea

Nexus Rush is a turn-based tactical card game on a square grid. Cards become units, structures or one-shot spells. Positioning, terrain, movement and attack range are central.

Movement is orthogonal only. Diagonal movement is not legal.

The objective is to destroy the enemy Nexus objective defined by the selected game mode.

## 2. Decks and hand

- A deck contains exactly **20 cards**.
- Maximum **2 copies** of the same card.
- Each card has an individual Mana cost.
- Prototype hand size: **5 cards**.
- Each player begins with 5 cards.
- At the start of each personal turn, after receiving Mana, the hand refills up to 5 cards from the draw pile.
- Played unit cards leave the hand and exist on the battlefield; they are not immediately replaced.
- When the draw pile is empty, no additional cards are created.
- The prototype currently uses deterministic deck ordering for repeatable tests; final shuffle/randomization is deferred.

Initial prototype archetypes:
- **Arcanisti del Nexus**: spells, control and ranged pressure.
- **Ordine del Bastione**: paladins, melee pressure and limited ranged support.

## 3. Card types

### Units

Minimum characteristics:
- Life
- Movement, measured in grid cells
- Attack Range
- Attack
- optional abilities

Units are normally deployed in the first **2 rows** of their player's side.

A unit deployment:
- requires sufficient Mana
- consumes the card's Mana cost
- removes that card from hand
- requires an accessible, unoccupied cell
- cannot overlap a Nexus, unit or structure

Movement and attacks after deployment are handled by later tasks.

### Structures

Structures remain on a grid cell and have their own Life and, when appropriate, Range and Attack.

Their card text defines where they may be placed. Examples include a maximum distance from a friendly Nexus or a specific deployment depth.

### Spells

Spells resolve their effect and are discarded. They do not occupy a board cell after resolution.

## 4. Mana and turns

Mana is banked: unused Mana remains available.

Income is based on each player's own turn count so both players reach the same income breakpoints:

- personal turns 1–5: +2 Mana at start of turn
- personal turns 6–10: +3 Mana
- personal turns 11–15: +4 Mana
- every further block of 5 turns: +1 additional Mana per turn

There is currently no Mana cap.

Turn baseline:
1. start turn
2. gain Mana
3. refill hand up to 5
4. take game actions
5. end turn
6. opponent begins their turn

## 5. Terrain

Maps must be intentionally designed rather than generated as random isolated terrain cells. Terrain should read as a believable place: lakes and waterways form coherent bodies, mountains form ridges, hills support the surrounding geography and passages exist for a gameplay reason.

Competitive maps should be mirrored or otherwise demonstrably fair between starting sides.

### Plain

- accessible
- standard movement
- no combat modifier
- does not block line of sight

### Water

- not accessible by standard units
- attacks and line of sight may pass across it

### Mountain

- not accessible by standard units
- blocks line of sight
- attacks cannot pass through it

### Hill

- accessible
- a unit standing on a hill receives **+1 Attack**
- climbing onto a hill costs one additional Movement point
- an available unit is never prevented from making its minimum one-cell climb solely because it only has 1 Movement remaining
- descending grants one additional movement step for that movement sequence

The exact implementation of chained hill descent and future movement modifiers will be refined during the movement task.

## 6. Nexus

Prototype Nexus Life: **10**.

A Nexus occupies one grid cell.

### Horizontal mode — Fronte Orizzontale

Each player places **2 Nexus** during pre-match setup.

Placement rules:
- Nexus must be inside the owner's deployment zone.
- one must be in the left half and one in the right half
- they cannot be on the same row
- they must be at least 5 cells apart by orthogonal grid distance
- they must be on legal accessible terrain

Destroying **either** enemy Nexus wins immediately.

### Vertical mode — Assalto Verticale

Each player places **1 Nexus** in the owner's deployment zone.

- legal accessible terrain only
- it cannot be placed in an outer board corner

Destroying that Nexus wins immediately.

## 7. Prototype maps

### Valle dei Due Fronti

12×8 horizontal battlefield. It uses a central lake, flanking mountain ridges and paired hills to create two natural pressure routes without looking like randomly scattered terrain.

### Passo del Nexus

8×12 vertical battlefield. Long mountain ridges shape a narrow advance around a central basin, producing a more direct assault mode.

Both layouts are mirrored between players.

## 8. Combat baseline

The first implementation uses deterministic damage.

- if a legal target is within Range and line of sight, an attack deals the attacker's Attack value
- hill modifies the attacker's Attack by +1
- no dice are required in the baseline
- abilities may modify these rules

Detailed targeting, path-based line of sight, reactions and card ability timing belong to later implementation tasks.

## 9. Current implementation boundary

Tasks 001–002 establish:
- Expo/React Native foundation
- card data model
- two 20-card starter decks
- terrain definitions and two designed maps
- Mana progression
- Nexus setup validation
- Nexus Life and win condition
- opening hands and draw piles
- turn start/end state
- hand refill
- unit deployment and board occupancy
- interactive prototype UI
- automated baseline tests

Movement, attacks, structures, spell resolution and AI will be layered on top rather than embedded into the foundation.
