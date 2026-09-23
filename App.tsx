import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { CARDS, STARTER_DECKS } from './src/game/cards';
import {
  createGame,
  deployUnit,
  endTurn,
  getLegalUnitDeploymentCells,
  startActivePlayerTurn
} from './src/game/engine';
import { getReachableMovement, moveUnit } from './src/game/movement';
import { MAPS } from './src/game/maps';
import {
  isLegalNexusCell,
  modeLabel,
  validateNexusPositions
} from './src/game/rules';
import {
  GameMode,
  GameState,
  MapDefinition,
  Position,
  TerrainType
} from './src/game/types';

type Screen = 'home' | 'setup' | 'game';

const terrainLabels: Record<TerrainType, string> = {
  plain: 'P',
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

function mirroredOpponentPositions(map: MapDefinition, positions: Position[]): Position[] {
  return positions.map((position) => ({
    x: position.x,
    y: map.height - 1 - position.y
  }));
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [mode, setMode] = useState<GameMode>('horizontal-dual-nexus');
  const [deckId, setDeckId] = useState(STARTER_DECKS[0].id);
  const [nexuses, setNexuses] = useState<Position[]>([]);
  const [game, setGame] = useState<GameState | null>(null);
  const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

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
    const enemyNexuses = mirroredOpponentPositions(map, nexuses);

    const created = createGame(mode, nexuses, enemyNexuses, deckId, enemyDeckId);
    setGame(startActivePlayerTurn(created));
    setSelectedHandIndex(null);
    setSelectedUnitId(null);
    setScreen('game');
  }

  function returnHome() {
    setScreen('home');
    setGame(null);
    setSelectedHandIndex(null);
    setSelectedUnitId(null);
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
  onExit: () => void;
}) {
  const map = MAPS.find((candidate) => candidate.id === props.game.mapId) ?? MAPS[0];
  const player = props.game.players[props.game.activePlayer];
  const deck = STARTER_DECKS.find((candidate) => candidate.id === player.deckId);
  const deploymentCells = props.selectedHandIndex === null
    ? []
    : getLegalUnitDeploymentCells(props.game, props.selectedHandIndex);
  const movementOptions = props.selectedUnitId === null
    ? []
    : getReachableMovement(props.game, props.selectedUnitId);
  const movementCells = movementOptions.map((option) => option.position);

  function isLegalDeployment(position: Position) {
    return deploymentCells.some((cell) => samePosition(cell, position));
  }

  function isLegalMovement(position: Position) {
    return movementCells.some((cell) => samePosition(cell, position));
  }

  function handleCellPress(position: Position) {
    const clickedUnit = props.game.units.find((unit) => samePosition(unit.position, position));

    if (
      clickedUnit &&
      clickedUnit.owner === props.game.activePlayer &&
      !clickedUnit.movedThisTurn
    ) {
      props.setSelectedUnitId(
        props.selectedUnitId === clickedUnit.instanceId ? null : clickedUnit.instanceId
      );
      props.setSelectedHandIndex(null);
      return;
    }

    if (props.selectedHandIndex !== null && isLegalDeployment(position)) {
      const updated = deployUnit(props.game, props.selectedHandIndex, position);
      props.setGame(updated);
      props.setSelectedHandIndex(null);
      props.setSelectedUnitId(null);
      return;
    }

    if (props.selectedUnitId !== null && isLegalMovement(position)) {
      const updated = moveUnit(props.game, props.selectedUnitId, position);
      props.setGame(updated);
      props.setSelectedUnitId(null);
    }
  }

  function handleEndTurn() {
    const switched = endTurn(props.game);
    props.setGame(startActivePlayerTurn(switched));
    props.setSelectedHandIndex(null);
    props.setSelectedUnitId(null);
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
          Sandbox manuale: il Giocatore 2 è controllato manualmente finché non viene implementata l'AI.
        </Text>

        <BattleBoard
          map={map}
          game={props.game}
          deploymentCells={deploymentCells}
          movementCells={movementCells}
          selectedUnitId={props.selectedUnitId}
          onCellPress={handleCellPress}
        />

        <Text style={styles.handTitle}>
          {deck?.name ?? player.deckId} · Mano
        </Text>

        <View style={styles.handRow}>
          {player.hand.map((cardId, index) => {
            const card = CARDS[cardId];
            const selected = props.selectedHandIndex === index;
            const affordable = player.mana >= card.cost;
            const deployable = card.type === 'unit' && affordable;

            return (
              <TouchableOpacity
                key={cardId + '-' + index}
                disabled={!deployable}
                onPress={() => {
                  props.setSelectedHandIndex(selected ? null : index);
                  props.setSelectedUnitId(null);
                }}
                style={[
                  styles.handCard,
                  selected && styles.handCardSelected,
                  !deployable && styles.handCardDisabled
                ]}
              >
                <View style={styles.handCardTop}>
                  <Text numberOfLines={2} style={styles.handCardName}>{card.name}</Text>
                  <Text style={styles.cardCost}>{card.cost}</Text>
                </View>
                <Text style={styles.cardType}>{card.type.toUpperCase()}</Text>
                {card.type === 'unit' ? (
                  <Text style={styles.handStats}>
                    ♥{card.life} · M{card.movement} · R{card.range} · A{card.attack}
                  </Text>
                ) : (
                  <Text style={styles.handStats}>Disponibile in Task 005</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.gameHint}>
          Seleziona una carta unità per schierarla, oppure tocca una tua unità sulla plancia per muoverla.
          Le caselle evidenziate rispettano Movimento, terreni e ostacoli. Ogni unità può muoversi una volta per turno.
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
  const cellSize = props.map.width > props.map.height ? 27 : 34;

  return (
    <View style={styles.boardFrame}>
      {props.map.terrain.map((row, y) => (
        <View key={y} style={styles.boardRow}>
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
                  { width: cellSize, height: cellSize },
                  legal && styles.legalCell,
                  playerNexus && styles.playerNexus
                ]}
              >
                <Text style={styles.cellText}>
                  {playerNexus ? 'N' : terrainLabels[terrain]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function BattleBoard(props: {
  map: MapDefinition;
  game: GameState;
  deploymentCells: Position[];
  movementCells: Position[];
  selectedUnitId: string | null;
  onCellPress: (position: Position) => void;
}) {
  const cellSize = props.map.width > props.map.height ? 27 : 34;

  return (
    <View style={styles.boardFrame}>
      {props.map.terrain.map((row, y) => (
        <View key={y} style={styles.boardRow}>
          {row.map((terrain, x) => {
            const position = { x, y };
            const nexus = props.game.nexuses.find((item) => samePosition(item.position, position));
            const unit = props.game.units.find((item) => samePosition(item.position, position));
            const deploymentLegal = props.deploymentCells.some((item) => samePosition(item, position));
            const movementLegal = props.movementCells.some((item) => samePosition(item, position));
            const selectedUnit = unit?.instanceId === props.selectedUnitId;
            const unitCard = unit ? CARDS[unit.cardId] : null;

            let label = terrainLabels[terrain];
            if (nexus) label = nexus.owner === 0 ? 'N' : 'X';
            if (unit && unitCard) label = unitCard.name.slice(0, 1).toUpperCase();

            return (
              <TouchableOpacity
                key={x}
                activeOpacity={0.8}
                onPress={() => props.onCellPress(position)}
                style={[
                  styles.cell,
                  terrainStyle(terrain),
                  { width: cellSize, height: cellSize },
                  deploymentLegal && styles.deployCell,
                  movementLegal && styles.moveCell,
                  nexus?.owner === 0 && styles.playerNexus,
                  nexus?.owner === 1 && styles.enemyNexus,
                  unit?.owner === 0 && styles.playerUnit,
                  unit?.owner === 1 && styles.enemyUnit,
                  selectedUnit && styles.selectedUnit
                ]}
              >
                <Text style={styles.cellText}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
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
  boardFrame: { padding: 7, borderRadius: 14, backgroundColor: '#080c14', borderWidth: 1, borderColor: '#30435e', alignSelf: 'center' },
  boardRow: { flexDirection: 'row' },
  cell: { borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  cellText: { color: '#eef4ff', fontWeight: '900', fontSize: 12 },
  plain: { backgroundColor: '#66744b' },
  water: { backgroundColor: '#286b88' },
  mountain: { backgroundColor: '#555967' },
  hill: { backgroundColor: '#8b7445' },
  legalCell: { borderColor: '#5fe2ff', borderWidth: 1.5 },
  deployCell: { borderColor: '#d9ff6a', borderWidth: 2 },
  moveCell: { borderColor: '#f6a8ff', borderWidth: 2 },
  selectedUnit: { borderColor: '#ffffff', borderWidth: 3 },
  playerNexus: { backgroundColor: '#1687b2', borderColor: '#a7efff', borderWidth: 2 },
  enemyNexus: { backgroundColor: '#9c3b4c', borderColor: '#ffd1d8', borderWidth: 2 },
  playerUnit: { backgroundColor: '#2c8fae', borderColor: '#b5f2ff', borderWidth: 2 },
  enemyUnit: { backgroundColor: '#a34b5b', borderColor: '#ffd7dd', borderWidth: 2 },
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
  handTitle: { width: '100%', maxWidth: 820, color: '#fff', fontSize: 16, fontWeight: '900', marginTop: 12, marginBottom: 7 },
  handRow: { width: '100%', maxWidth: 820, flexDirection: 'row', gap: 6 },
  handCard: { flex: 1, minWidth: 0, backgroundColor: '#17243a', borderWidth: 1, borderColor: '#2c405f', borderRadius: 9, padding: 7, minHeight: 100 },
  handCardSelected: { borderColor: '#d9ff6a', borderWidth: 2, backgroundColor: '#243344' },
  handCardDisabled: { opacity: 0.42 },
  handCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  handCardName: { color: '#fff', fontSize: 11, fontWeight: '900', flex: 1, lineHeight: 14 },
  cardCost: { color: '#08131d', backgroundColor: '#62d7ff', minWidth: 23, height: 23, textAlign: 'center', textAlignVertical: 'center', borderRadius: 12, overflow: 'hidden', fontWeight: '900', fontSize: 11 },
  cardType: { color: '#7387a7', fontSize: 8, fontWeight: '900', letterSpacing: 0.6, marginTop: 5 },
  handStats: { color: '#d6e2f2', fontSize: 9, fontWeight: '700', marginTop: 8, lineHeight: 13 },
  gameHint: { color: '#8fa1bd', maxWidth: 760, textAlign: 'center', fontSize: 11, lineHeight: 16, marginTop: 11 }
});
