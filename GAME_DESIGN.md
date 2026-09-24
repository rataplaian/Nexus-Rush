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

A newly deployed unit may move during the same turn unless a future card ability says otherwise.

### Movement

- Movement is orthogonal only: up, down, left or right.
- A unit can make one movement action per turn.
- The unit may choose any reachable destination within its Movement allowance.
- Water and Mountain cells cannot be entered by standard units.
- Nexus, units and structures block both entry and pathing.
- Units cannot move through occupied cells.
- Hill climbing normally costs 2 Movement instead of 1.
- If a unit has exactly 1 Movement remaining, it may still make a one-cell climb onto an adjacent Hill.
- Descending from a Hill costs 0 Movement for that step, effectively granting one extra movement cell for that movement sequence.
- The engine stores how many grid cells the unit moved this turn for abilities such as charge bonuses.

### Structures

Structures remain on a grid cell, occupy space and can be destroyed.

- **Torre Arcana**: placement within 4 cells of a friendly Nexus; can attack once per turn.
- **Torre di Guardia**: placement within 3 cells of a friendly Nexus; can attack once per turn.
- **Cristallo del Mana**: placement in the first 3 rows; generates +1 Mana every third owner turn after construction.
- **Cappella del Nexus**: placement within 3 cells of a friendly Nexus; at end of the owner's turn heals 1 Life to the most wounded adjacent allied unit.

Structures with Attack and Range use the same Range and Mountain line-of-sight rules as units.

### Spells

Spells consume Mana, resolve once and are then placed in the caster's discard pile.

- **Palla di Fuoco**: 4 damage to an enemy unit.
- **Catene di Ghiaccio**: target enemy unit gets -2 Movement on its next turn.
- **Traslazione**: teleport a friendly unit up to 3 orthogonal-distance cells to a legal free cell; this does not consume its normal movement action.
- **Adunata**: up to 3 unmoved friendly units get +1 Movement for the current turn.
- **Punizione Sacra**: 2 damage to an enemy unit, increased to 4 if that unit is adjacent to a friendly Paladin.

The Arcimago reduces the first spell played each turn by 1 Mana.

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

The illustrated battle map is now the visual source of truth for the battlefield shape, while the logical terrain matrix remains the rules source of truth. The two layers are intentionally aligned cell by cell.

### Valle dei Due Fronti — 12×8

Wide tactical arena for the two-Nexus mode.

- central vertical water channel
- two main playable crossings represented as Plain bridge cells
- compact mirrored ruin/rock blocks represented as Mountain
- paired Hill cells next to key cover rather than scattered bonuses
- open deployment rows so both Nexus can still be placed legally
- 180° rotational symmetry for competitive fairness

### Passo del Nexus — 8×12

Tall tactical arena for the single-Nexus mode.

- transverse river through the middle
- two-cell central bridge represented as Plain
- compact mirrored ruin/rock formations represented as Mountain
- paired Hill positions near the approach lanes
- clear central and side routes around cover
- 180° rotational symmetry for competitive fairness

The artwork itself is not decorative geography anymore: water, blocking ruins and elevated tactical positions correspond to the rules overlay.
## 8. Combat baseline

Combat uses deterministic damage.

- each unit may attack once per turn
- a unit may move and attack in either order during the same turn
- attack Range uses orthogonal/Manhattan grid distance
- units may target enemy units and enemy Nexus objectives
- a legal attack deals the attacker's Attack value directly as damage
- a unit standing on a Hill receives +1 Attack
- Water does not block line of sight
- Mountain blocks line of sight; attacks cannot pass through Mountain cells
- other units and Nexus do not currently block line of sight
- units reduced to 0 Life are removed immediately
- a Nexus reduced to 0 Life immediately triggers the mode's victory condition
- no dice are required in the baseline
- starter-card attack modifiers are active; reactions and future advanced abilities remain extensible

## 9. Current implementation boundary

Tasks 001–005 establish:
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

Movement, combat, structures, starter spells and starter-card abilities are now implemented. AI and presentation/polish remain the next major layers.


## 10. Starter ability implementation

### Arcanisti del Nexus
- Mago da Battaglia: +1 Range while it has not moved this turn.
- Tessitore del Gelo: a surviving unit hit by it gets -1 Movement on its next turn.
- Elementale Arcano: ignores the extra Movement cost when climbing onto a Hill.
- Arcimago: first spell each turn costs 1 less Mana.

### Ordine del Bastione
- Guardiano dello Scudo: adjacent allied units suffer 1 less damage from ranged attacks.
- Cavaliere del Nexus: +1 Attack after moving at least 2 cells in the current turn.
- Campione del Bastione: heals 2 Life after eliminating an enemy unit.

These effects are data-linked to the current starter cards. Future cards should extend the same effect framework rather than add UI-only exceptions.


## 11. Single-player AI

The default opponent is a deterministic tactical AI designed to be challenging rather than random.

It evaluates:
- immediate Nexus kills and lethal attacks first
- unit removal and focus fire
- material advantage and remaining Life
- enemy pressure near its own Nexus
- distance and approach lanes toward the enemy Nexus
- Hill control and positional value
- exposure to enemy threat ranges
- Mana value and whether an action is worth spending resources on
- unit, structure and spell synergies already implemented in the starter decks

The AI:
- chooses its own legal Nexus placement based on defensive terrain and spacing
- deploys units and structures by scoring all legal cells
- uses spells only when the resulting board state improves enough to justify the Mana
- evaluates attack-before-move versus move-before-attack
- considers attacks available after each candidate movement
- repositions after attacking when doing so improves survival or objective pressure
- uses structure attacks
- keeps unused Mana when no available card action improves its evaluated position
- uses deterministic tie-breaking so identical game states produce identical decisions

This is intentionally a tactical heuristic planner rather than a scripted opponent. The evaluation system is isolated in `src/game/ai.ts` so deeper search and future difficulty profiles can be added without changing core game rules.


### Battle-map rendering contract

- approved map backgrounds are cropped to the exact logical aspect ratios: 12:8 and 8:12
- the image is stretched exactly to the logical board bounds so grid cells cannot drift relative to the artwork
- the rules grid stays visible above the image
- terrain tinting is intentionally subtle: the illustration should communicate the place, while the overlay communicates rules
- bridges are visual bridge artwork but logical Plain cells
- decorative scenery outside a blocking Mountain cell never changes gameplay by itself
