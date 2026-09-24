import React, { useMemo, useState } from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { CARDS, STARTER_DECKS } from './src/game/cards';
import {
  canAffordCard,
  createGame,
  deployUnit,
  endTurn,
  getLegalUnitDeploymentCells,
  startActivePlayerTurn
} from './src/game/engine';
import {
  effectiveMovementForUnit,
  getReachableMovement,
  moveUnit
} from './src/game/movement';
import {
  attackPowerForUnit,
  attackTarget,
  attackTargetAtPosition,
  attackWithStructure,
  getLegalAttackTargets,
  getLegalStructureAttackTargets
} from './src/game/combat';
import {
  castSpell,
  effectiveDisplayedCardCost,
  getLegalStructurePlacementCells,
  legalTeleportDestinations,
  placeStructure
} from './src/game/actions';
import { chooseAINexusPositions, runAITurn } from './src/game/ai';
import { MAPS } from './src/game/maps';
import {
  isLegalNexusCell,
  modeLabel,
  validateNexusPositions
} from './src/game/rules';
import {
  CardDefinition,
  GameMode,
  GameState,
  MapDefinition,
  Position,
  TerrainType
} from './src/game/types';
import {
  CARD_ART_ATLAS,
  CARD_ART_COORDS,
  factionForCard,
} from './src/ui/visualAssets';
import { mapBackground } from './src/ui/battleMapBackgrounds';
import { scaledBoardGeometry } from './src/ui/boardGeometry';

type Screen = 'home' | 'setup' | 'game';

const terrainLabels: Record<TerrainType, string> = {
  plain: '',
  water: '≈',
  mountain: '▲',
  hill: '⌃'
};

const terrainNames: Record<TerrainType, string> = {
  plain: 'Pianura',
  water: 'Acqua',
  mountain: 'Montagna',
  hill: 'Collina'
};

function samePosition(a: Position, b: Position) {
  return a.x === b.x && a.y === b.y;
}

function CardArtwork(props: { cardId: string; size: number }) {
  const coord = CARD_ART_COORDS[props.cardId] ?? { col: 0, row: 0 };
  return (
    <View style={{ width: props.size, height: props.size, overflow: 'hidden' }}>
      <Image
        source={CARD_ART_ATLAS}
        resizeMode="stretch"
        style={{
          position: 'absolute',
          width: props.size * 5,
          height: props.size * 4,
          left: -coord.col * props.size,
          top: -coord.row * props.size
        }}
      />
    </View>
  );
}

function StatBadge(props: { icon: string; value: string | number; accent?: boolean }) {
  return (
    <View style={[styles.statBadge, props.accent && styles.statBadgeAccent]}>
      <Text style={styles.statIcon}>{props.icon}</Text>
      <Text style={styles.statValue}>{props.value}</Text>
    </View>
  );
}

function cardEffectText(card: CardDefinition): string {
  if (card.type === 'structure') {
    return [card.placement, card.text].filter(Boolean).join(' ');
  }
  if (card.text) return card.text;
  if (card.type === 'spell') return 'Magia usa e getta.';
  return 'Unità base.';
}

function HandCardVisual(props: {
  card: CardDefinition;
  displayedCost: number;
  selected: boolean;
  playable: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const faction = factionForCard(props.card.id);
  const arcane = faction === 'arcane';
  const stats =
    props.card.type === 'unit'
      ? [
          ['♥', props.card.life],
          ['↟', props.card.movement],
          ['◎', props.card.range],
          ['⚔', props.card.attack]
        ]
      : props.card.type === 'structure'
        ? [
            ['♥', props.card.life],
            ['◎', props.card.range],
            ['⚔', props.card.attack]
          ]
        : [['✦', props.card.value]];

  return (
    <TouchableOpacity
      disabled={props.disabled}
      onPress={props.onPress}
      activeOpacity={0.86}
      style={[
        styles.visualCard,
        arcane ? styles.visualCardArcane : styles.visualCardBastion,
        props.selected && styles.visualCardSelected,
        !props.playable && styles.handCardDisabled
      ]}
    >
      <View style={styles.visualCardNameBar}>
        <Text numberOfLines={2} style={styles.visualCardName}>{props.card.name}</Text>
        <View style={[styles.factionGem, arcane ? styles.arcaneGem : styles.bastionGem]} />
      </View>

      <View style={styles.visualCardArtWrap}>
        <CardArtwork cardId={props.card.id} size={142} />
        <View style={styles.cardStatRail}>
          <StatBadge icon="◆" value={props.displayedCost} accent />
          {stats.map(([icon, value], index) => (
            <StatBadge key={String(icon) + index} icon={String(icon)} value={value} />
          ))}
        </View>
        <View style={styles.cardTypeRibbon}>
          <Text style={styles.visualCardType}>
            {props.card.type === 'unit' ? 'UNITÀ' : props.card.type === 'structure' ? 'STRUTTURA' : 'MAGIA'}
          </Text>
        </View>
      </View>

      <View style={styles.visualCardRules}>
        <Text numberOfLines={5} style={styles.visualCardRulesText}>
          {cardEffectText(props.card)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function BoardPiece(props: {
  cardId: string;
  life: number;
  owner: 0 | 1;
  cellSize: number;
  structure?: boolean;
}) {
  const width = Math.max(28, props.cellSize - 12);
  return (
    <View
      style={[
        styles.boardPiece,
        { width, height: props.cellSize - 4 },
        props.owner === 0 ? styles.boardPiecePlayer : styles.boardPieceEnemy,
        props.structure && styles.boardPieceStructure
      ]}
    >
      <CardArtwork cardId={props.cardId} size={width} />
      <View style={styles.pieceLifeBadge}>
        <Text style={styles.pieceLifeText}>♥{props.life}</Text>
      </View>
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [mode, setMode] = useState<GameMode>('horizontal-dual-nexus');
  const [deckId, setDeckId] = useState(STARTER_DECKS[0].id);
  const [nexuses, setNexuses] = useState<Position[]>([]);
  const [game, setGame] = useState<GameState | null>(null);
  const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedStructureId, setSelectedStructureId] = useState<string | null>(null);
  const [spellUnitTargets, setSpellUnitTargets] = useState<string[]>([]);

  const map = useMemo(
    () => MAPS.find((candidate) => candidate.mode === mode) ?? MAPS[0],
    [mode]
  );
  const deck = STARTER_DECKS.find((candidate) => candidate.id === deckId) ?? STARTER_DECKS[0];
  const requiredNexuses = mode === 'horizontal-dual-nexus' ? 2 : 1;
  const nexusErrors = validateNexusPositions(map, 0, nexuses);
  const canConfirm = nexuses.length === requiredNexuses && nexusErrors.length === 0;

  function beginSetup(selectedMode: GameMode) {
    setMode(selectedMode);
    setNexuses([]);
    setGame(null);
    setSelectedHandIndex(null);
    setSelectedUnitId(null);
    setSelectedStructureId(null);
    setSpellUnitTargets([]);
    setScreen('setup');
  }

  function toggleNexus(position: Position) {
    if (!isLegalNexusCell(map, 0, position)) return;

    const existing = nexuses.findIndex((item) => samePosition(item, position));
    if (existing >= 0) {
      setNexuses(nexuses.filter((_, index) => index !== existing));
      return;
    }

    if (nexuses.length >= requiredNexuses) return;
    setNexuses([...nexuses, position]);
  }

  function startMatch() {
    if (!canConfirm) return;
    const enemyDeckId = deckId === 'arcane' ? 'bastion' : 'arcane';
    const enemyNexuses = chooseAINexusPositions(map, 1);

    const created = createGame(mode, nexuses, enemyNexuses, deckId, enemyDeckId);
    setGame(startActivePlayerTurn(created));
    setSelectedHandIndex(null);
    setSelectedUnitId(null);
    setSelectedStructureId(null);
    setSpellUnitTargets([]);
    setScreen('game');
  }

  function returnHome() {
    setScreen('home');
    setGame(null);
    setSelectedHandIndex(null);
    setSelectedUnitId(null);
    setSelectedStructureId(null);
    setSpellUnitTargets([]);
    setNexuses([]);
  }

  if (screen === 'home') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.home}>
          <Text style={styles.eyebrow}>TACTICAL CARD BATTLE</Text>
          <Text style={styles.title}>NEXUS RUSH</Text>
          <Text style={styles.subtitle}>
            Carte tattiche, movimento su griglia e terreni che cambiano il modo di raggiungere il Nexus.
          </Text>

          <Text style={styles.sectionTitle}>Modalità</Text>
          <ModeCard
            title="Fronte Orizzontale"
            detail="2 Nexus per giocatore · distruggine 1 per vincere"
            onPress={() => beginSetup('horizontal-dual-nexus')}
          />
          <ModeCard
            title="Assalto Verticale"
            detail="1 Nexus per giocatore · fronte più stretto e diretto"
            onPress={() => beginSetup('vertical-single-nexus')}
          />

          <Text style={styles.sectionTitle}>Mazzo iniziale</Text>
          <View style={styles.deckRow}>
            {STARTER_DECKS.map((candidate) => (
              <TouchableOpacity
                key={candidate.id}
                onPress={() => setDeckId(candidate.id)}
                style={[styles.deckChoice, deckId === candidate.id && styles.deckChoiceActive]}
              >
                <Text style={styles.deckChoiceTitle}>{candidate.name}</Text>
                <Text style={styles.deckChoiceText}>{candidate.description}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.ruleStrip}>
            <Text style={styles.ruleStripText}>20 carte</Text>
            <Text style={styles.ruleStripText}>max 2 copie</Text>
            <Text style={styles.ruleStripText}>mano 5</Text>
            <Text style={styles.ruleStripText}>Nexus 10 HP</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'setup') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.setup}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => setScreen('home')} style={styles.backButton}>
              <Text style={styles.backButtonText}>‹ Menu</Text>
            </TouchableOpacity>
            <View>
              <Text style={styles.modeTitle}>{modeLabel(mode)}</Text>
              <Text style={styles.modeSubtitle}>{map.name}</Text>
            </View>
          </View>

          <Text style={styles.instructions}>
            Posiziona {requiredNexuses} {requiredNexuses === 1 ? 'Nexus' : 'Nexus'} nelle tue prime 2 righe.
            Il lato avversario viene specchiato nel sandbox del prototipo.
          </Text>

          <SetupBoard map={map} playerNexuses={nexuses} onCellPress={toggleNexus} />

          {nexusErrors.length > 0 && nexuses.length === requiredNexuses ? (
            <View style={styles.errorBox}>
              {nexusErrors.map((error) => <Text key={error} style={styles.errorText}>• {error}</Text>)}
            </View>
          ) : null}

          <TouchableOpacity
            disabled={!canConfirm}
            onPress={startMatch}
            style={[styles.primaryButton, !canConfirm && styles.primaryButtonDisabled]}
          >
            <Text style={styles.primaryButtonText}>INIZIA PARTITA</Text>
          </TouchableOpacity>

          <TerrainLegend />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!game) return null;

  return (
    <GameScreen
      game={game}
      setGame={setGame}
      selectedHandIndex={selectedHandIndex}
      setSelectedHandIndex={setSelectedHandIndex}
      selectedUnitId={selectedUnitId}
      setSelectedUnitId={setSelectedUnitId}
      selectedStructureId={selectedStructureId}
      setSelectedStructureId={setSelectedStructureId}
      spellUnitTargets={spellUnitTargets}
      setSpellUnitTargets={setSpellUnitTargets}
      onExit={returnHome}
    />
  );
}

function GameScreen(props: {
  game: GameState;
  setGame: (game: GameState) => void;
  selectedHandIndex: number | null;
  setSelectedHandIndex: (index: number | null) => void;
  selectedUnitId: string | null;
  setSelectedUnitId: (unitId: string | null) => void;
  selectedStructureId: string | null;
  setSelectedStructureId: (structureId: string | null) => void;
  spellUnitTargets: string[];
  setSpellUnitTargets: (unitIds: string[]) => void;
  onExit: () => void;
}) {
  const map = MAPS.find((candidate) => candidate.id === props.game.mapId) ?? MAPS[0];
  const player = props.game.players[props.game.activePlayer];
  const deck = STARTER_DECKS.find((candidate) => candidate.id === player.deckId);
  const selectedHandCard = props.selectedHandIndex === null
    ? null
    : CARDS[player.hand[props.selectedHandIndex]];
  const deploymentCells =
    props.selectedHandIndex !== null && selectedHandCard?.type === 'unit'
      ? getLegalUnitDeploymentCells(props.game, props.selectedHandIndex)
      : [];
  const structurePlacementCells =
    props.selectedHandIndex !== null && selectedHandCard?.type === 'structure'
      ? getLegalStructurePlacementCells(props.game, props.selectedHandIndex)
      : [];
  const movementOptions =
    props.selectedHandIndex === null && props.selectedUnitId !== null
      ? getReachableMovement(props.game, props.selectedUnitId)
      : [];
  const movementCells = movementOptions.map((option) => option.position);
  const unitAttackOptions =
    props.selectedHandIndex === null && props.selectedUnitId !== null
      ? getLegalAttackTargets(props.game, props.selectedUnitId)
      : [];
  const structureAttackOptions =
    props.selectedHandIndex === null && props.selectedStructureId !== null
      ? getLegalStructureAttackTargets(props.game, props.selectedStructureId)
      : [];
  const attackCells = [...unitAttackOptions, ...structureAttackOptions].map((option) => option.position);
  const selectedUnit = props.selectedUnitId === null
    ? null
    : props.game.units.find((unit) => unit.instanceId === props.selectedUnitId) ?? null;
  const selectedStructure = props.selectedStructureId === null
    ? null
    : props.game.structures.find((structure) => structure.instanceId === props.selectedStructureId) ?? null;
  const selectedCard = selectedUnit ? CARDS[selectedUnit.cardId] : null;
  const selectedStructureCard = selectedStructure ? CARDS[selectedStructure.cardId] : null;

  const spellTargetCells = (() => {
    if (props.selectedHandIndex === null || selectedHandCard?.type !== 'spell') return [];

    if (
      selectedHandCard.effect === 'damage' ||
      selectedHandCard.effect === 'slow' ||
      selectedHandCard.effect === 'conditional-damage'
    ) {
      return props.game.units
        .filter((unit) => unit.owner !== props.game.activePlayer)
        .map((unit) => unit.position);
    }

    if (selectedHandCard.effect === 'teleport') {
      if (props.spellUnitTargets.length === 0) {
        return props.game.units
          .filter((unit) => unit.owner === props.game.activePlayer)
          .map((unit) => unit.position);
      }
      return legalTeleportDestinations(props.game, props.spellUnitTargets[0]);
    }

    if (selectedHandCard.effect === 'buff-move') {
      return props.game.units
        .filter((unit) => unit.owner === props.game.activePlayer && !unit.movedThisTurn)
        .map((unit) => unit.position);
    }

    return [];
  })();

  function isLegalDeployment(position: Position) {
    return deploymentCells.some((cell) => samePosition(cell, position));
  }

  function isLegalMovement(position: Position) {
    return movementCells.some((cell) => samePosition(cell, position));
  }

  function isLegalAttack(position: Position) {
    return attackCells.some((cell) => samePosition(cell, position));
  }

  function clearSelection() {
    props.setSelectedHandIndex(null);
    props.setSelectedUnitId(null);
    props.setSelectedStructureId(null);
    props.setSpellUnitTargets([]);
  }

  function handleCellPress(position: Position) {
    if (props.game.winner !== null) return;

    const clickedUnit = props.game.units.find((unit) => samePosition(unit.position, position));
    const clickedStructure = props.game.structures.find((structure) => samePosition(structure.position, position));

    if (props.selectedHandIndex !== null && selectedHandCard) {
      if (selectedHandCard.type === 'unit' && isLegalDeployment(position)) {
        props.setGame(deployUnit(props.game, props.selectedHandIndex, position));
        clearSelection();
        return;
      }

      if (
        selectedHandCard.type === 'structure' &&
        structurePlacementCells.some((cell) => samePosition(cell, position))
      ) {
        props.setGame(placeStructure(props.game, props.selectedHandIndex, position));
        clearSelection();
        return;
      }

      if (selectedHandCard.type === 'spell') {
        if (
          selectedHandCard.effect === 'damage' ||
          selectedHandCard.effect === 'slow' ||
          selectedHandCard.effect === 'conditional-damage'
        ) {
          if (clickedUnit && clickedUnit.owner !== props.game.activePlayer) {
            props.setGame(castSpell(props.game, props.selectedHandIndex, {
              kind: selectedHandCard.effect,
              targetUnitId: clickedUnit.instanceId
            }));
            clearSelection();
          }
          return;
        }

        if (selectedHandCard.effect === 'teleport') {
          if (props.spellUnitTargets.length === 0) {
            if (clickedUnit && clickedUnit.owner === props.game.activePlayer) {
              props.setSpellUnitTargets([clickedUnit.instanceId]);
            }
            return;
          }

          if (spellTargetCells.some((cell) => samePosition(cell, position))) {
            props.setGame(castSpell(props.game, props.selectedHandIndex, {
              kind: 'teleport',
              unitId: props.spellUnitTargets[0],
              destination: position
            }));
            clearSelection();
          }
          return;
        }

        if (selectedHandCard.effect === 'buff-move') {
          if (
            clickedUnit &&
            clickedUnit.owner === props.game.activePlayer &&
            !clickedUnit.movedThisTurn
          ) {
            const exists = props.spellUnitTargets.includes(clickedUnit.instanceId);
            if (exists) {
              props.setSpellUnitTargets(
                props.spellUnitTargets.filter((id) => id !== clickedUnit.instanceId)
              );
            } else if (props.spellUnitTargets.length < 3) {
              props.setSpellUnitTargets([...props.spellUnitTargets, clickedUnit.instanceId]);
            }
          }
          return;
        }
      }
    }

    if (isLegalAttack(position)) {
      const owner = props.game.activePlayer;
      const target = attackTargetAtPosition(props.game, owner, position);
      if (target && props.selectedUnitId !== null) {
        const updated = attackTarget(props.game, props.selectedUnitId, target);
        props.setGame(updated);
        if (updated.winner !== null) clearSelection();
        return;
      }
      if (target && props.selectedStructureId !== null) {
        const updated = attackWithStructure(props.game, props.selectedStructureId, target);
        props.setGame(updated);
        if (updated.winner !== null) clearSelection();
        return;
      }
    }

    if (
      clickedUnit &&
      clickedUnit.owner === props.game.activePlayer &&
      (!clickedUnit.movedThisTurn || !clickedUnit.attackedThisTurn)
    ) {
      props.setSelectedUnitId(
        props.selectedUnitId === clickedUnit.instanceId ? null : clickedUnit.instanceId
      );
      props.setSelectedStructureId(null);
      props.setSelectedHandIndex(null);
      props.setSpellUnitTargets([]);
      return;
    }

    if (
      clickedStructure &&
      clickedStructure.owner === props.game.activePlayer &&
      !clickedStructure.attackedThisTurn
    ) {
      props.setSelectedStructureId(
        props.selectedStructureId === clickedStructure.instanceId
          ? null
          : clickedStructure.instanceId
      );
      props.setSelectedUnitId(null);
      props.setSelectedHandIndex(null);
      props.setSpellUnitTargets([]);
      return;
    }

    if (props.selectedUnitId !== null && isLegalMovement(position)) {
      props.setGame(moveUnit(props.game, props.selectedUnitId, position));
    }
  }

  function handleEndTurn() {
    if (props.game.winner !== null) return;

    let next = startActivePlayerTurn(endTurn(props.game));

    if (next.activePlayer === 1 && next.winner === null) {
      const ai = runAITurn(next, 'challenging');
      next = ai.state;

      if (next.winner === null) {
        next = startActivePlayerTurn(endTurn(next));
      }
    }

    props.setGame(next);
    props.setSelectedHandIndex(null);
    props.setSelectedUnitId(null);
    props.setSelectedStructureId(null);
    props.setSpellUnitTargets([]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.gameScreen}>
        <View style={styles.gameHeader}>
          <TouchableOpacity onPress={props.onExit} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹ Esci</Text>
          </TouchableOpacity>
          <View style={styles.gameHeaderCopy}>
            <Text style={styles.modeTitle}>{modeLabel(props.game.mode)}</Text>
            <Text style={styles.modeSubtitle}>Round {props.game.round} · Giocatore {props.game.activePlayer + 1}</Text>
          </View>
          <TouchableOpacity onPress={handleEndTurn} style={styles.endTurnButton}>
            <Text style={styles.endTurnText}>FINE TURNO</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusRow}>
          <StatusPill label="MANA" value={String(player.mana)} />
          <StatusPill label="TURNO" value={String(player.personalTurn)} />
          <StatusPill label="MANO" value={String(player.hand.length)} />
          <StatusPill label="MAZZO" value={String(player.drawPile.length)} />
        </View>

        <Text style={styles.sandboxNote}>
          Single player · Giocatore 2 controllato dall'AI tattica. Valuta Nexus, terreno, minacce, focus fire, mana, magie e posizionamento.
        </Text>

        <BattleBoard
          map={map}
          game={props.game}
          deploymentCells={deploymentCells}
          structurePlacementCells={structurePlacementCells}
          movementCells={movementCells}
          attackCells={attackCells}
          spellTargetCells={spellTargetCells}
          selectedUnitId={props.selectedUnitId}
          selectedStructureId={props.selectedStructureId}
          spellUnitTargets={props.spellUnitTargets}
          onCellPress={handleCellPress}
        />

        {props.game.winner !== null ? (
          <View style={styles.victoryPanel}>
            <Text style={styles.victoryTitle}>VITTORIA GIOCATORE {props.game.winner + 1}</Text>
            <Text style={styles.victoryText}>Un Nexus nemico è stato distrutto.</Text>
          </View>
        ) : selectedUnit && selectedCard?.type === 'unit' ? (
          <View style={styles.selectedPanel}>
            <Text style={styles.selectedTitle}>{selectedCard.name}</Text>
            <Text style={styles.selectedStats}>
              ♥ {selectedUnit.life}/{selectedCard.life} · MOV {effectiveMovementForUnit(props.game, selectedUnit.instanceId)} · RNG {selectedCard.range} · ATK {attackPowerForUnit(props.game, selectedUnit.instanceId)}
            </Text>
            <Text style={styles.selectedActions}>
              Movimento {selectedUnit.movedThisTurn ? 'usato' : 'disponibile'} · Attacco {selectedUnit.attackedThisTurn ? 'usato' : 'disponibile'}
            </Text>
            {selectedCard.text ? <Text style={styles.abilityText}>{selectedCard.text}</Text> : null}
          </View>
        ) : selectedStructure && selectedStructureCard?.type === 'structure' ? (
          <View style={styles.selectedPanel}>
            <Text style={styles.selectedTitle}>{selectedStructureCard.name}</Text>
            <Text style={styles.selectedStats}>
              ♥ {selectedStructure.life}/{selectedStructureCard.life} · RNG {selectedStructureCard.range} · ATK {selectedStructureCard.attack}
            </Text>
            <Text style={styles.selectedActions}>
              Attacco {selectedStructure.attackedThisTurn ? 'usato' : 'disponibile'}
            </Text>
            {selectedStructureCard.text ? <Text style={styles.abilityText}>{selectedStructureCard.text}</Text> : null}
          </View>
        ) : selectedHandCard?.type === 'spell' ? (
          <View style={styles.selectedPanel}>
            <Text style={styles.selectedTitle}>{selectedHandCard.name}</Text>
            <Text style={styles.abilityText}>{selectedHandCard.text}</Text>
            {selectedHandCard.effect === 'buff-move' ? (
              <>
                <Text style={styles.selectedActions}>Selezionati: {props.spellUnitTargets.length}/3</Text>
                <TouchableOpacity
                  disabled={props.spellUnitTargets.length === 0}
                  onPress={() => {
                    if (props.selectedHandIndex === null) return;
                    props.setGame(castSpell(props.game, props.selectedHandIndex, {
                      kind: 'buff-move',
                      unitIds: props.spellUnitTargets
                    }));
                    clearSelection();
                  }}
                  style={[
                    styles.spellConfirmButton,
                    props.spellUnitTargets.length === 0 && styles.primaryButtonDisabled
                  ]}
                >
                  <Text style={styles.spellConfirmText}>LANCIA ADUNATA</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.handTitle}>
          {deck?.name ?? player.deckId} · Mano
        </Text>

        <View style={styles.handRow}>
          {player.hand.map((cardId, index) => {
            const card = CARDS[cardId];
            const selected = props.selectedHandIndex === index;
            const displayedCost = effectiveDisplayedCardCost(props.game, index) ?? card.cost;
            const playable = canAffordCard(props.game, card.id);

            return (
              <HandCardVisual
                key={cardId + '-' + index}
                card={card}
                displayedCost={displayedCost}
                selected={selected}
                playable={playable}
                disabled={!playable || props.game.winner !== null}
                onPress={() => {
                  props.setSelectedHandIndex(selected ? null : index);
                  props.setSelectedUnitId(null);
                  props.setSelectedStructureId(null);
                  props.setSpellUnitTargets([]);
                }}
              />
            );
          })}
        </View>

        <Text style={styles.gameHint}>
          Viola = movimento · rosso = attacco · verde = schieramento · oro = struttura · azzurro = bersaglio magia.
          Strutture e magie ora usano le regole scritte sulle carte; le magie finiscono negli scarti dopo l'uso.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeCard(props: { title: string; detail: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.modeCard} onPress={props.onPress}>
      <Text style={styles.modeCardTitle}>{props.title}</Text>
      <Text style={styles.modeCardDetail}>{props.detail}</Text>
      <Text style={styles.modeCardAction}>GIOCA  →</Text>
    </TouchableOpacity>
  );
}

function StatusPill(props: { label: string; value: string }) {
  return (
    <View style={styles.statusPill}>
      <Text style={styles.statusLabel}>{props.label}</Text>
      <Text style={styles.statusValue}>{props.value}</Text>
    </View>
  );
}

function SetupBoard(props: {
  map: MapDefinition;
  playerNexuses: Position[];
  onCellPress: (position: Position) => void;
}) {
  const { width: viewportWidth } = useWindowDimensions();
  const geometry = useMemo(
    () => scaledBoardGeometry(props.map.mode, viewportWidth),
    [props.map.mode, viewportWidth]
  );

  return (
    <View style={styles.boardFrame}>
      <View
        style={[
          styles.boardCanvas,
          { width: geometry.displayWidth, height: geometry.displayHeight }
        ]}
      >
        <Image
          source={mapBackground(props.map.mode)}
          resizeMode="stretch"
          style={StyleSheet.absoluteFill}
        />

        <View
          style={[
            styles.referenceGrid,
            {
              left: geometry.gridLeft,
              top: geometry.gridTop,
              width: geometry.gridWidth,
              height: geometry.gridHeight
            }
          ]}
        >
          {props.map.terrain.map((row, y) => (
            <View
              key={y}
              style={[
                styles.boardRow,
                { height: geometry.rowHeights[y] }
              ]}
            >
              {row.map((terrain, x) => {
                const position = { x, y };
                const playerNexus = props.playerNexuses.some((item) => samePosition(item, position));
                const legal = isLegalNexusCell(props.map, 0, position);

                return (
                  <TouchableOpacity
                    key={x}
                    activeOpacity={0.8}
                    onPress={() => props.onCellPress(position)}
                    style={[
                      styles.cell,
                      terrainStyle(terrain),
                      {
                        width: geometry.columnWidths[x],
                        height: geometry.rowHeights[y]
                      },
                      legal && styles.legalCell,
                      playerNexus && styles.playerNexus
                    ]}
                  >
                    {playerNexus ? (
                      <View style={styles.nexusMarker}>
                        <Text style={styles.nexusMarkerText}>N</Text>
                      </View>
                    ) : terrain !== 'plain' ? (
                      <Text style={styles.terrainCornerText}>{terrainLabels[terrain]}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function BattleBoard(props: {
  map: MapDefinition;
  game: GameState;
  deploymentCells: Position[];
  structurePlacementCells: Position[];
  movementCells: Position[];
  attackCells: Position[];
  spellTargetCells: Position[];
  selectedUnitId: string | null;
  selectedStructureId: string | null;
  spellUnitTargets: string[];
  onCellPress: (position: Position) => void;
}) {
  const { width: viewportWidth } = useWindowDimensions();
  const geometry = useMemo(
    () => scaledBoardGeometry(props.map.mode, viewportWidth),
    [props.map.mode, viewportWidth]
  );

  return (
    <View style={styles.boardFrame}>
      <View
        style={[
          styles.boardCanvas,
          { width: geometry.displayWidth, height: geometry.displayHeight }
        ]}
      >
        <Image
          source={mapBackground(props.map.mode)}
          resizeMode="stretch"
          style={StyleSheet.absoluteFill}
        />

        <View
          style={[
            styles.referenceGrid,
            {
              left: geometry.gridLeft,
              top: geometry.gridTop,
              width: geometry.gridWidth,
              height: geometry.gridHeight
            }
          ]}
        >
          {props.map.terrain.map((row, y) => (
            <View
              key={y}
              style={[
                styles.boardRow,
                { height: geometry.rowHeights[y] }
              ]}
            >
              {row.map((terrain, x) => {
                const position = { x, y };
                const nexus = props.game.nexuses.find((item) => samePosition(item.position, position));
                const unit = props.game.units.find((item) => samePosition(item.position, position));
                const structure = props.game.structures.find((item) => samePosition(item.position, position));
                const deploymentLegal = props.deploymentCells.some((item) => samePosition(item, position));
                const structurePlacementLegal = props.structurePlacementCells.some((item) => samePosition(item, position));
                const movementLegal = props.movementCells.some((item) => samePosition(item, position));
                const attackLegal = props.attackCells.some((item) => samePosition(item, position));
                const spellLegal = props.spellTargetCells.some((item) => samePosition(item, position));
                const selectedUnit = unit?.instanceId === props.selectedUnitId;
                const selectedStructure = structure?.instanceId === props.selectedStructureId;
                const spellSelectedUnit = unit ? props.spellUnitTargets.includes(unit.instanceId) : false;
                const cellSize = Math.min(
                  geometry.columnWidths[x],
                  geometry.rowHeights[y]
                );

                return (
                  <TouchableOpacity
                    key={x}
                    activeOpacity={0.82}
                    onPress={() => props.onCellPress(position)}
                    style={[
                      styles.cell,
                      terrainStyle(terrain),
                      {
                        width: geometry.columnWidths[x],
                        height: geometry.rowHeights[y]
                      },
                      deploymentLegal && styles.deployCell,
                      structurePlacementLegal && styles.structureCell,
                      movementLegal && styles.moveCell,
                      spellLegal && styles.spellCell,
                      attackLegal && styles.attackCell,
                      selectedUnit && styles.selectedUnit,
                      selectedStructure && styles.selectedUnit,
                      spellSelectedUnit && styles.spellSelected
                    ]}
                  >
                    {unit ? (
                      <BoardPiece cardId={unit.cardId} life={unit.life} owner={unit.owner} cellSize={cellSize} />
                    ) : structure ? (
                      <BoardPiece
                        cardId={structure.cardId}
                        life={structure.life}
                        owner={structure.owner}
                        cellSize={cellSize}
                        structure
                      />
                    ) : nexus ? (
                      <View style={[
                        styles.nexusMarker,
                        nexus.owner === 0 ? styles.nexusMarkerPlayer : styles.nexusMarkerEnemy
                      ]}>
                        <Text style={styles.nexusMarkerText}>{nexus.owner === 0 ? 'N' : 'X'}</Text>
                        <Text style={styles.nexusLifeText}>♥{nexus.life}</Text>
                      </View>
                    ) : terrain !== 'plain' ? (
                      <Text style={styles.terrainCornerText}>{terrainLabels[terrain]}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}


function terrainStyle(terrain: TerrainType) {
  switch (terrain) {
    case 'water': return styles.water;
    case 'mountain': return styles.mountain;
    case 'hill': return styles.hill;
    default: return styles.plain;
  }
}

function TerrainLegend() {
  return (
    <View style={styles.legend}>
      {(['plain', 'water', 'mountain', 'hill'] as TerrainType[]).map((terrain) => {
        const details =
          terrain === 'water' ? 'non attraversabile · tiro possibile'
          : terrain === 'mountain' ? 'blocca movimento e linea di vista'
          : terrain === 'hill' ? '+1 ATK · salita costa movimento · discesa accelera'
          : 'terreno standard';

        return (
          <View key={terrain} style={styles.legendItem}>
            <View style={[styles.legendIcon, terrainStyle(terrain)]}>
              <Text style={styles.cellText}>{terrainLabels[terrain]}</Text>
            </View>
            <View style={styles.legendCopy}>
              <Text style={styles.legendName}>{terrainNames[terrain]}</Text>
              <Text style={styles.legendText}>{details}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0d1320' },
  home: { padding: 22, paddingBottom: 48, alignItems: 'stretch' },
  setup: { padding: 18, paddingBottom: 48, alignItems: 'center' },
  gameScreen: { padding: 14, paddingBottom: 44, alignItems: 'center' },
  eyebrow: { color: '#63d8ff', fontSize: 12, fontWeight: '800', letterSpacing: 2, marginTop: 18 },
  title: { color: '#f6f8ff', fontSize: 46, fontWeight: '900', letterSpacing: 2, marginTop: 4 },
  subtitle: { color: '#aebad0', fontSize: 16, lineHeight: 23, maxWidth: 720, marginTop: 8, marginBottom: 26 },
  sectionTitle: { color: '#f3f6ff', fontSize: 18, fontWeight: '800', marginTop: 22, marginBottom: 10, alignSelf: 'stretch' },
  modeCard: { backgroundColor: '#172236', borderWidth: 1, borderColor: '#2a3d5c', borderRadius: 16, padding: 18, marginBottom: 12 },
  modeCardTitle: { color: '#ffffff', fontSize: 21, fontWeight: '800' },
  modeCardDetail: { color: '#9cadc8', fontSize: 14, marginTop: 5 },
  modeCardAction: { color: '#63d8ff', fontWeight: '900', marginTop: 16, fontSize: 13 },
  deckRow: { gap: 10 },
  deckChoice: { padding: 15, borderRadius: 13, backgroundColor: '#121b2b', borderWidth: 1, borderColor: '#25344e' },
  deckChoiceActive: { borderColor: '#63d8ff', backgroundColor: '#16263b' },
  deckChoiceTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  deckChoiceText: { color: '#9cadc8', marginTop: 4, lineHeight: 19 },
  ruleStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  ruleStripText: { color: '#cbd6e9', backgroundColor: '#182338', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, fontSize: 12, fontWeight: '700' },
  topBar: { width: '100%', maxWidth: 800, flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 12 },
  backButton: { paddingVertical: 9, paddingHorizontal: 12, backgroundColor: '#172236', borderRadius: 10 },
  backButtonText: { color: '#d9e4f5', fontWeight: '800' },
  modeTitle: { color: '#fff', fontSize: 21, fontWeight: '900' },
  modeSubtitle: { color: '#7fdfff', marginTop: 2 },
  instructions: { color: '#b7c4da', maxWidth: 720, textAlign: 'center', marginBottom: 12, lineHeight: 20 },
  boardFrame: { padding: 6, borderRadius: 16, backgroundColor: '#080c14', borderWidth: 1, borderColor: '#405875', alignSelf: 'center', overflow: 'hidden' },
  boardCanvas: { position: 'relative', overflow: 'hidden', backgroundColor: '#080c14' },
  referenceGrid: { position: 'absolute' },
  boardRow: { flexDirection: 'row' },
  cell: { borderWidth: 0.7, borderColor: 'rgba(245,249,255,0.38)', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  cellText: { color: '#eef4ff', fontWeight: '900', fontSize: 12 },
  terrainCornerText: { position: 'absolute', left: 3, top: 2, color: 'rgba(255,255,255,0.75)', fontWeight: '900', fontSize: 9, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 2 },
  plain: { backgroundColor: 'rgba(91,112,61,0.035)' },
  water: { backgroundColor: 'rgba(30,111,151,0.20)' },
  mountain: { backgroundColor: 'rgba(62,66,74,0.24)' },
  hill: { backgroundColor: 'rgba(150,113,55,0.18)' },
  legalCell: { borderColor: '#5fe2ff', borderWidth: 1.5 },
  deployCell: { borderColor: '#d9ff6a', borderWidth: 2 },
  structureCell: { borderColor: '#ffc85c', borderWidth: 2 },
  moveCell: { borderColor: '#f6a8ff', borderWidth: 2 },
  spellCell: { borderColor: '#65e9ff', borderWidth: 2 },
  spellSelected: { borderColor: '#65e9ff', borderWidth: 3 },
  attackCell: { borderColor: '#ff5f76', borderWidth: 3 },
  selectedUnit: { borderColor: '#ffffff', borderWidth: 3 },
  playerNexus: { borderColor: '#a7efff', borderWidth: 2 },
  enemyNexus: { borderColor: '#ffd1d8', borderWidth: 2 },
  playerUnit: { borderColor: '#b5f2ff', borderWidth: 2 },
  enemyUnit: { borderColor: '#ffd7dd', borderWidth: 2 },
  playerStructure: { borderColor: '#b8d4ef', borderWidth: 2 },
  enemyStructure: { borderColor: '#edbbc5', borderWidth: 2 },
  nexusMarker: { width: '78%', height: '78%', borderRadius: 999, backgroundColor: 'rgba(15,27,45,0.9)', borderWidth: 2, borderColor: '#75ddff', alignItems: 'center', justifyContent: 'center' },
  nexusMarkerPlayer: { borderColor: '#75ddff', backgroundColor: 'rgba(10,78,110,0.9)' },
  nexusMarkerEnemy: { borderColor: '#ff95a5', backgroundColor: 'rgba(113,35,48,0.9)' },
  nexusMarkerText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  nexusLifeText: { color: '#fff', fontSize: 8, fontWeight: '800', marginTop: -1 },
  boardPiece: { borderRadius: 5, borderWidth: 2, overflow: 'hidden', backgroundColor: '#111a28', alignItems: 'center', justifyContent: 'flex-start' },
  boardPiecePlayer: { borderColor: '#8be7ff' },
  boardPieceEnemy: { borderColor: '#ff8fa2' },
  boardPieceStructure: { borderStyle: 'solid' },
  pieceLifeBadge: { position: 'absolute', right: 1, bottom: 1, backgroundColor: 'rgba(8,12,20,0.86)', borderRadius: 7, paddingHorizontal: 3, paddingVertical: 1 },
  pieceLifeText: { color: '#fff', fontSize: 7, fontWeight: '900' },
  primaryButton: { backgroundColor: '#46c7ef', paddingHorizontal: 24, paddingVertical: 13, borderRadius: 12, marginTop: 16 },
  primaryButtonDisabled: { opacity: 0.3 },
  primaryButtonText: { color: '#07121b', fontWeight: '900', letterSpacing: 0.7 },
  errorBox: { maxWidth: 600, backgroundColor: '#361c28', borderRadius: 10, padding: 12, marginTop: 12 },
  errorText: { color: '#ffb7c1', fontSize: 13 },
  legend: { width: '100%', maxWidth: 760, marginTop: 20, gap: 7 },
  legendItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#121b2b', borderRadius: 10, padding: 8 },
  legendIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  legendCopy: { marginLeft: 10, flex: 1 },
  legendName: { color: '#fff', fontWeight: '800' },
  legendText: { color: '#91a2be', fontSize: 12, marginTop: 2 },
  gameHeader: { width: '100%', maxWidth: 820, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  gameHeaderCopy: { flex: 1, marginLeft: 10 },
  endTurnButton: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#f0b84d', borderRadius: 10 },
  endTurnText: { color: '#181108', fontWeight: '900', fontSize: 12 },
  statusRow: { width: '100%', maxWidth: 820, flexDirection: 'row', gap: 7, marginBottom: 8 },
  statusPill: { flex: 1, backgroundColor: '#152238', borderRadius: 9, paddingVertical: 7, alignItems: 'center' },
  statusLabel: { color: '#7286a6', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  statusValue: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 1 },
  sandboxNote: { color: '#8395b1', fontSize: 11, textAlign: 'center', maxWidth: 700, marginBottom: 9 },
  selectedPanel: { width: '100%', maxWidth: 820, backgroundColor: '#17243a', borderWidth: 1, borderColor: '#405675', borderRadius: 10, padding: 10, marginTop: 10 },
  selectedTitle: { color: '#fff', fontWeight: '900', fontSize: 14 },
  selectedStats: { color: '#dbe7f7', fontSize: 11, fontWeight: '700', marginTop: 4 },
  selectedActions: { color: '#91a4c0', fontSize: 10, marginTop: 4 },
  abilityText: { color: '#aebdd2', fontSize: 10, lineHeight: 15, marginTop: 5 },
  spellConfirmButton: { backgroundColor: '#65e9ff', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12, marginTop: 9, alignSelf: 'flex-start' },
  spellConfirmText: { color: '#07141b', fontWeight: '900', fontSize: 10 },
  victoryPanel: { width: '100%', maxWidth: 820, backgroundColor: '#27391f', borderWidth: 1, borderColor: '#91cf68', borderRadius: 12, padding: 14, marginTop: 12, alignItems: 'center' },
  victoryTitle: { color: '#dfffc8', fontWeight: '900', fontSize: 18 },
  victoryText: { color: '#b7d9a0', marginTop: 4 },
  handTitle: { width: '100%', maxWidth: 1080, color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 14, marginBottom: 8 },
  handRow: { width: '100%', maxWidth: 1080, flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  handCardDisabled: { opacity: 0.43 },
  visualCard: { flex: 1, minWidth: 0, maxWidth: 205, minHeight: 244, borderRadius: 13, borderWidth: 2, overflow: 'hidden', backgroundColor: '#111725' },
  visualCardArcane: { borderColor: '#7b63ff', backgroundColor: '#12172f' },
  visualCardBastion: { borderColor: '#cfa54f', backgroundColor: '#2a1719' },
  visualCardSelected: { borderColor: '#efff71', borderWidth: 3, transform: [{ translateY: -4 }] },
  visualCardNameBar: { minHeight: 42, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: 'rgba(9,14,24,0.95)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  visualCardName: { color: '#fff', fontSize: 12, lineHeight: 14, fontWeight: '900', flex: 1, textAlign: 'center' },
  factionGem: { width: 9, height: 9, borderRadius: 5, marginLeft: 4, borderWidth: 1 },
  arcaneGem: { backgroundColor: '#8a5cff', borderColor: '#aee9ff' },
  bastionGem: { backgroundColor: '#b52d3f', borderColor: '#ffd57d' },
  visualCardArtWrap: { height: 142, overflow: 'hidden', position: 'relative', backgroundColor: '#080c14', alignItems: 'center' },
  cardStatRail: { position: 'absolute', left: 5, top: 5, gap: 3 },
  statBadge: { minWidth: 29, height: 23, borderRadius: 7, paddingHorizontal: 3, backgroundColor: 'rgba(7,13,24,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  statBadgeAccent: { backgroundColor: 'rgba(29,95,151,0.94)', borderColor: '#8eeaff' },
  statIcon: { color: '#f6e4a0', fontSize: 8, fontWeight: '900' },
  statValue: { color: '#fff', fontSize: 11, fontWeight: '900' },
  cardTypeRibbon: { position: 'absolute', left: 36, right: 5, bottom: 5, backgroundColor: 'rgba(8,13,23,0.84)', borderRadius: 8, paddingVertical: 3, alignItems: 'center' },
  visualCardType: { color: '#e9edf7', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  visualCardRules: { flex: 1, minHeight: 58, paddingHorizontal: 8, paddingVertical: 7, justifyContent: 'center', backgroundColor: 'rgba(242,236,217,0.96)' },
  visualCardRulesText: { color: '#27231f', fontSize: 9, lineHeight: 12, fontWeight: '700', textAlign: 'center' },
  gameHint: { color: '#8fa1bd', maxWidth: 760, textAlign: 'center', fontSize: 11, lineHeight: 16, marginTop: 11 }
});
