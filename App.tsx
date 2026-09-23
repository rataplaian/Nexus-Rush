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
import { STARTER_DECKS, CARDS } from './src/game/cards';
import { MAPS } from './src/game/maps';
import {
  attackModifierForTerrain,
  blocksLineOfSight,
  blocksMovement,
  isLegalNexusCell,
  modeLabel,
  validateNexusPositions
} from './src/game/rules';
import { GameMode, MapDefinition, Position, TerrainType } from './src/game/types';

type Screen = 'home' | 'setup';

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
  const [setupComplete, setSetupComplete] = useState(false);

  const map = useMemo(
    () => MAPS.find((candidate) => candidate.mode === mode) ?? MAPS[0],
    [mode]
  );
  const deck = STARTER_DECKS.find((candidate) => candidate.id === deckId) ?? STARTER_DECKS[0];
  const requiredNexuses = mode === 'horizontal-dual-nexus' ? 2 : 1;
  const nexusErrors = validateNexusPositions(map, 0, nexuses);
  const canConfirm = nexuses.length === requiredNexuses && nexusErrors.length === 0;
  const enemyNexuses = setupComplete ? mirroredOpponentPositions(map, nexuses) : [];

  function beginSetup(selectedMode: GameMode) {
    setMode(selectedMode);
    setNexuses([]);
    setSetupComplete(false);
    setScreen('setup');
  }

  function toggleNexus(position: Position) {
    if (setupComplete) return;
    if (!isLegalNexusCell(map, 0, position)) return;

    const existing = nexuses.findIndex((item) => samePosition(item, position));
    if (existing >= 0) {
      setNexuses(nexuses.filter((_, index) => index !== existing));
      return;
    }

    if (nexuses.length >= requiredNexuses) return;
    setNexuses([...nexuses, position]);
  }

  if (screen === 'home') {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" />
        <ScrollView contentContainerStyle={styles.home}>
          <Text style={styles.eyebrow}>TACTICAL CARD BATTLE</Text>
          <Text style={styles.title}>NEXUS RUSH</Text>
          <Text style={styles.subtitle}>
            Scegli la formazione della plancia. Le due modalità condividono carte e regole,
            ma richiedono approcci tattici diversi.
          </Text>

          <Text style={styles.sectionTitle}>Modalità</Text>
          <ModeCard
            title="Fronte Orizzontale"
            detail="2 Nexus per giocatore · ne basta 1 distrutto per vincere"
            onPress={() => beginSetup('horizontal-dual-nexus')}
          />
          <ModeCard
            title="Assalto Verticale"
            detail="1 Nexus per giocatore · corridoi più stretti e fronte più diretto"
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
            <Text style={styles.ruleStripText}>Nexus 10 HP</Text>
            <Text style={styles.ruleStripText}>+2 Mana/turno</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

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
          {setupComplete
            ? 'Setup completato. I Nexus avversari sono mostrati in posizione speculare per il sandbox iniziale.'
            : 'Posiziona ' + requiredNexuses + (requiredNexuses === 1 ? ' Nexus' : ' Nexus') + ' nelle tue prime 2 righe.'}
        </Text>

        <GameBoard
          map={map}
          playerNexuses={nexuses}
          enemyNexuses={enemyNexuses}
          onCellPress={toggleNexus}
        />

        {!setupComplete && nexusErrors.length > 0 && nexuses.length === requiredNexuses ? (
          <View style={styles.errorBox}>
            {nexusErrors.map((error) => <Text key={error} style={styles.errorText}>• {error}</Text>)}
          </View>
        ) : null}

        {!setupComplete ? (
          <TouchableOpacity
            disabled={!canConfirm}
            onPress={() => setSetupComplete(true)}
            style={[styles.primaryButton, !canConfirm && styles.primaryButtonDisabled]}
          >
            <Text style={styles.primaryButtonText}>CONFERMA NEXUS</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.prototypePanel}>
            <Text style={styles.prototypeTitle}>Foundation pronta</Text>
            <Text style={styles.prototypeText}>
              Il prossimo step collegherà mano, mana, schieramento unità, movimento, attacco,
              strutture e magie a questa plancia.
            </Text>
          </View>
        )}

        <TerrainLegend />

        <Text style={styles.sectionTitle}>Mazzo: {deck.name}</Text>
        <View style={styles.cardGrid}>
          {Array.from(new Set(deck.cardIds)).map((cardId) => {
            const card = CARDS[cardId];
            return (
              <View key={cardId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardName}>{card.name}</Text>
                  <Text style={styles.cardCost}>{card.cost}</Text>
                </View>
                <Text style={styles.cardType}>{card.type.toUpperCase()}</Text>
                {card.type === 'unit' ? (
                  <Text style={styles.cardStats}>
                    ♥ {card.life}   MOV {card.movement}   RNG {card.range}   ATK {card.attack}
                  </Text>
                ) : card.type === 'structure' ? (
                  <Text style={styles.cardStats}>♥ {card.life}   RNG {card.range}   ATK {card.attack}</Text>
                ) : (
                  <Text style={styles.cardStats}>MAGIA USA E GETTA</Text>
                )}
                {card.text ? <Text style={styles.cardText}>{card.text}</Text> : null}
              </View>
            );
          })}
        </View>
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

function GameBoard(props: {
  map: MapDefinition;
  playerNexuses: Position[];
  enemyNexuses: Position[];
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
            const enemyNexus = props.enemyNexuses.some((item) => samePosition(item, position));
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
                  playerNexus && styles.playerNexus,
                  enemyNexus && styles.enemyNexus
                ]}
              >
                <Text style={styles.cellText}>
                  {playerNexus ? 'N' : enemyNexus ? 'X' : terrainLabels[terrain]}
                </Text>
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
  playerNexus: { backgroundColor: '#1687b2', borderColor: '#a7efff', borderWidth: 2 },
  enemyNexus: { backgroundColor: '#9c3b4c', borderColor: '#ffd1d8', borderWidth: 2 },
  primaryButton: { backgroundColor: '#46c7ef', paddingHorizontal: 24, paddingVertical: 13, borderRadius: 12, marginTop: 16 },
  primaryButtonDisabled: { opacity: 0.3 },
  primaryButtonText: { color: '#07121b', fontWeight: '900', letterSpacing: 0.7 },
  errorBox: { maxWidth: 600, backgroundColor: '#361c28', borderRadius: 10, padding: 12, marginTop: 12 },
  errorText: { color: '#ffb7c1', fontSize: 13 },
  prototypePanel: { maxWidth: 650, backgroundColor: '#16273b', borderColor: '#2f5b75', borderWidth: 1, borderRadius: 13, padding: 15, marginTop: 16 },
  prototypeTitle: { color: '#7de5ff', fontWeight: '900', fontSize: 16 },
  prototypeText: { color: '#b7c4da', lineHeight: 20, marginTop: 5 },
  legend: { width: '100%', maxWidth: 760, marginTop: 20, gap: 7 },
  legendItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#121b2b', borderRadius: 10, padding: 8 },
  legendIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  legendCopy: { marginLeft: 10, flex: 1 },
  legendName: { color: '#fff', fontWeight: '800' },
  legendText: { color: '#91a2be', fontSize: 12, marginTop: 2 },
  cardGrid: { width: '100%', maxWidth: 800, gap: 8 },
  card: { backgroundColor: '#151f31', borderRadius: 11, padding: 11, borderWidth: 1, borderColor: '#273852' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { color: '#fff', fontSize: 15, fontWeight: '900', flex: 1 },
  cardCost: { color: '#08131d', backgroundColor: '#62d7ff', minWidth: 28, height: 28, textAlign: 'center', textAlignVertical: 'center', borderRadius: 14, overflow: 'hidden', fontWeight: '900' },
  cardType: { color: '#7387a7', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginTop: 5 },
  cardStats: { color: '#d8e4f4', fontSize: 12, marginTop: 5, fontWeight: '700' },
  cardText: { color: '#9fb0c8', fontSize: 12, marginTop: 5, lineHeight: 17 }
});
